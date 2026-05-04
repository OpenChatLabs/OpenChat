import type { Input } from "@openchat/core";

type Mailbox = Input["smtp"];

export type WireMailbox = Mailbox;

/** IMAP 拉取：chatRoomId 可选；不传则返回双方往来中所有「标题以 openchat 开头」的协议邮件 */
export type ChatReceiveBody = {
  smtp: WireMailbox;
  imap: WireMailbox;
  peerEmail: string;
  chatRoomId?: string;
};

export type ChatSendBody = {
  smtp: WireMailbox;
  imap: WireMailbox;
  peerEmail: string;
  chatRoomId: string;
  content: string;
};

function parseMailbox(raw: unknown): Mailbox | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const host = String(o.host ?? "").trim();
  const username = String(o.username ?? "").trim();
  const password = String(o.password ?? "");
  const port = Number(o.port);
  const secure = Boolean(o.secure);
  if (!host || !username) {
    return null;
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return null;
  }
  return { host, port, secure, username, password };
}

export function wireToInput(
  smtp: Mailbox,
  imap: Mailbox,
  peerEmail: string,
  chatRoomId?: string,
): Input {
  return {
    smtp,
    imap,
    peerEmail: peerEmail.trim(),
    user: {
      username: smtp.username,
      avatar: null,
      location: null,
      gender: null,
    },
    ...(chatRoomId ? { chatRoomId } : {}),
  };
}

export function parseReceiveBody(
  body: unknown,
): { ok: true; input: Input } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "请求体无效" };
  }
  const o = body as Record<string, unknown>;
  const smtp = parseMailbox(o.smtp);
  const imap = parseMailbox(o.imap);
  if (!smtp || !imap) {
    return { ok: false, error: "SMTP/IMAP 配置不完整或端口无效" };
  }
  const peerEmail = String(o.peerEmail ?? "").trim();
  if (!peerEmail) {
    return { ok: false, error: "请填写对端邮箱 peerEmail" };
  }
  const chatRoomIdRaw = String(o.chatRoomId ?? "").trim();
  return {
    ok: true,
    input: wireToInput(smtp, imap, peerEmail, chatRoomIdRaw || undefined),
  };
}

export function parseSendBody(
  body: unknown,
): { ok: true; input: Input; chatRoomId: string; content: string } | { ok: false; error: string } {
  const cred = parseReceiveBody(body);
  if (!cred.ok) {
    return cred;
  }
  const o = body as Record<string, unknown>;
  const content = String(o.content ?? "");
  if (!content.trim()) {
    return { ok: false, error: "消息内容不能为空" };
  }
  const chatRoomId = String(o.chatRoomId ?? "").trim();
  if (!chatRoomId) {
    return { ok: false, error: "发送消息需要 chatRoomId" };
  }
  return {
    ok: true,
    input: wireToInput(cred.input.smtp, cred.input.imap, cred.input.peerEmail),
    chatRoomId,
    content: content.trim(),
  };
}
