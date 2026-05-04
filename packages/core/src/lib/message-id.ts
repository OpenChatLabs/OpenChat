/** 聊天消息 Subject 前缀：`openchat+<chatroom_id>+...` */
export const OPENCHAT_MESSAGE_PREFIX = "openchat";

/**
 * 凡是以此为前缀的 Subject 均视为 OpenChat 协议邮件。
 * 必须先满足此前缀再解析 chatRoomId。
 */
export const OPENCHAT_PROTOCOL_SUBJECT_PREFIX = "openchat";

function randomSegment(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 发起 OpenChat 时生成聊天室 id（两侧底层邮箱据此配对交换）。
 * 勿包含字符 `+`，否则无法按四段格式解析消息 id。
 */
export function createChatRoomId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/**
 * 消息 id：`openchat+<chatroom_id>+<timestampMs>+<random>`，
 * 用作邮件 Subject；`chatroom_id` 内不得含 `+`。
 */
export function createMessageId(chatroomId: string): string {
  const ts = Date.now();
  return `${OPENCHAT_MESSAGE_PREFIX}+${chatroomId}+${ts}+${randomSegment()}`;
}

/** Subject 是否属于 OpenChat 协议（先过滤标题再解析 chatRoomId） */
export function isOpenChatProtocolSubject(subject: string): boolean {
  return subject.trim().startsWith(OPENCHAT_PROTOCOL_SUBJECT_PREFIX);
}

export type ParsedOpenChatMessageId = {
  chatroomId: string;
  timestampMs: number;
  randomId: string;
};

/** 解析 {@link createMessageId} 生成的 id（要求恰好四段，chatroom_id 不含 `+`） */
export function parseOpenChatMessageId(id: string): ParsedOpenChatMessageId | null {
  const parts = id.split("+");
  if (parts.length !== 4 || parts[0] !== OPENCHAT_MESSAGE_PREFIX) {
    return null;
  }
  const [, chatroomId, tsStr, randomId] = parts;
  const timestampMs = Number(tsStr);
  if (!chatroomId || !randomId || !Number.isFinite(timestampMs)) {
    return null;
  }
  return { chatroomId, timestampMs, randomId };
}

/** 将 Subject 规范化为与发送端一致的字符串，便于去重与比对 */
export function canonicalOpenChatSubject(subject: string): string {
  const s = subject.trim();
  const p = parseOpenChatMessageId(s);
  if (!p) {
    return s;
  }
  return `${OPENCHAT_MESSAGE_PREFIX}+${p.chatroomId}+${p.timestampMs}+${p.randomId}`;
}

/** 协议内消息的稳定去重键（非协议 Subject 则退回规范化后的整串） */
export function openChatMessageDedupeKey(subject: string): string {
  const canon = canonicalOpenChatSubject(subject);
  const p = parseOpenChatMessageId(canon);
  if (p) {
    return `${p.chatroomId}\0${p.timestampMs}\0${p.randomId}`;
  }
  return `\xff${canon}`;
}
