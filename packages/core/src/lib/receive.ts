import type { IMAPConfig } from "../types/config";
import imapFlow from "imapflow";
import { simpleParser } from "mailparser";

export const receive = async (config: IMAPConfig) => {
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
    const uids = await client.search(
      {
        since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      },
      { uid: true },
    );
    if (!uids || uids.length === 0) {
      return [];
    }
    const messages = await client.fetchAll(uids, { source: true }, { uid: true });
    return Promise.all(
      messages.map(async (message) => {
        if (!message.source) {
          return "";
        }
        const parsed = await simpleParser(message.source);
        return parsed.html ?? parsed.textAsHtml ?? parsed.text ?? "";
      }),
    );
  } finally {
    lock.release();
    await client.logout();
  }
};
