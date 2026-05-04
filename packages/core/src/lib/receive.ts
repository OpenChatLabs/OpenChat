import type { Input } from "../input";
import type { Message } from "../types/messages";
import imapFlow from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import {
  canonicalOpenChatSubject,
  isOpenChatProtocolSubject,
  openChatMessageDedupeKey,
  parseOpenChatMessageId,
} from "./message-id";

function normalizeEmail(addr: string | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

function primaryMailbox(obj: AddressObject | undefined): string {
  const addr = obj?.value?.[0]?.address;
  return normalizeEmail(addr);
}

function primaryToEmail(parsed: ParsedMail): string {
  const to = parsed.to;
  if (!to) {
    return "";
  }
  const first = Array.isArray(to) ? to[0] : to;
  return primaryMailbox(first);
}

function extractContent(parsed: ParsedMail): string {
  if (typeof parsed.text === "string" && parsed.text.length > 0) {
    return parsed.text;
  }
  if (parsed.html && typeof parsed.html === "string") {
    return parsed.html;
  }
  return parsed.textAsHtml ?? "";
}

function isBetweenLocalAndPeer(
  parsed: ParsedMail,
  localEmail: string,
  peerEmail: string,
): boolean {
  const from = primaryMailbox(parsed.from);
  const to = primaryToEmail(parsed);
  if (!from || !to) {
    return false;
  }
  return (
    (from === localEmail && to === peerEmail) || (from === peerEmail && to === localEmail)
  );
}

/** 收件搜索范围（天）：缩小可显著加快单次 IMAP；按需可调 */
const DEFAULT_SINCE_DAYS = 7;

function parseChatMail(parsed: ParsedMail): Omit<Message, "from" | "to"> | null {
  const subject = parsed.subject?.trim() ?? "";
  if (!isOpenChatProtocolSubject(subject)) {
    return null;
  }

  const chatParsed = parseOpenChatMessageId(subject);
  if (!chatParsed) {
    return null;
  }

  return {
    id: canonicalOpenChatSubject(subject),
    chatRoomId: chatParsed.chatroomId,
    date: (parsed.date ?? new Date(0)).toISOString(),
    content: extractContent(parsed),
  };
}

export async function receive(input: Input): Promise<Message[]> {
  const localEmail = normalizeEmail(input.imap.username);
  const peerEmail = normalizeEmail(input.peerEmail);
  if (!peerEmail) {
    throw new Error("OpenChat receive requires peerEmail");
  }

  const { imap: config } = input;
  const client = new imapFlow.ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * DEFAULT_SINCE_DAYS);
    const uids = await client.search({ since }, { uid: true });

    if (!uids || uids.length === 0) {
      return [];
    }

    const rows = await client.fetchAll(uids, { source: true }, { uid: true });
    const byDedupeKey = new Map<string, Message>();

    for (const row of rows) {
      if (!row.source) {
        continue;
      }
      const parsed = await simpleParser(row.source);
      const body = parseChatMail(parsed);
      if (!body) {
        continue;
      }
      if (input.chatRoomId && body.chatRoomId !== input.chatRoomId) {
        continue;
      }
      if (!isBetweenLocalAndPeer(parsed, localEmail, peerEmail)) {
        continue;
      }

      const from = primaryMailbox(parsed.from) || (parsed.from?.text ?? "");
      const to = primaryToEmail(parsed) || "";

      const msg: Message = {
        ...body,
        from,
        to,
      };
      const key = openChatMessageDedupeKey(msg.id);
      byDedupeKey.set(key, msg);
    }

    const messages = [...byDedupeKey.values()].sort((a, b) => a.date.localeCompare(b.date));
    return messages;
  } finally {
    lock.release();
    await client.logout();
  }
}
