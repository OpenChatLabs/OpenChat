import type { Message } from "@openchat/core";
import { canonicalOpenChatSubject, openChatMessageDedupeKey } from "@openchat/core/message-id";

const HISTORY_PREFIX = "openchat:v2:history:";

export function historyStorageKey(chatRoomId: string): string {
  return `${HISTORY_PREFIX}${chatRoomId}`;
}

function normalizeMessage(m: Message): Message {
  return {
    ...m,
    id: canonicalOpenChatSubject(m.id),
  };
}

function isValidMessageRow(row: unknown): row is Message {
  if (!row || typeof row !== "object") {
    return false;
  }
  const m = row as Partial<Message>;
  return (
    typeof m.id === "string" &&
    typeof m.chatRoomId === "string" &&
    typeof m.from === "string" &&
    typeof m.to === "string" &&
    typeof m.date === "string" &&
    typeof m.content === "string"
  );
}

export function loadRoomHistory(chatRoomId: string): Message[] {
  if (typeof window === "undefined" || !chatRoomId.trim()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(historyStorageKey(chatRoomId.trim()));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const map = new Map<string, Message>();
    for (const row of parsed) {
      if (!isValidMessageRow(row)) {
        continue;
      }
      const n = normalizeMessage(row);
      map.set(openChatMessageDedupeKey(n.id), n);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveRoomHistory(chatRoomId: string, messages: Message[]): void {
  if (typeof window === "undefined" || !chatRoomId.trim()) {
    return;
  }
  localStorage.setItem(
    historyStorageKey(chatRoomId.trim()),
    JSON.stringify(mergeById([], messages)),
  );
}

export function mergeById(a: Message[], b: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const m of a) {
    const n = normalizeMessage(m);
    map.set(openChatMessageDedupeKey(n.id), n);
  }
  for (const m of b) {
    const n = normalizeMessage(m);
    map.set(openChatMessageDedupeKey(n.id), n);
  }
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date));
}

/** 按邮件解析出的 chatRoomId 写入各聊天室的本地记录 */
export function persistMessagesByRoom(incoming: Message[]): void {
  if (typeof window === "undefined" || incoming.length === 0) {
    return;
  }
  const rooms = new Set(incoming.map((m) => m.chatRoomId));
  for (const room of rooms) {
    const batch = incoming.filter((m) => m.chatRoomId === room);
    const prev = loadRoomHistory(room);
    saveRoomHistory(room, mergeById(prev, batch));
  }
}
