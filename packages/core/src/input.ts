import type { SMTPConfig, IMAPConfig, UserConfig } from "./types/config";
import type { ChatRoomId, Message } from "./types/messages";

export type Input = {
  smtp: SMTPConfig;
  imap: IMAPConfig;
  user: UserConfig;
  /** 对端邮箱（OpenChat 双邮箱交换）；发件收件人均须为本邮箱与对端之一 */
  peerEmail: string;
  /** 若设置，仅同步该聊天室（Subject 解析出的 chatroomId）下的消息 */
  chatRoomId?: ChatRoomId;
};

export interface InputHandler {
  receive(input: Input): Promise<Message[]>;
  /** 邮件主题为消息 id；正文为 content，可在正文中携带同一 id 以便收信端关联 */
  send(input: Input, id: string, content: string): Promise<void>;
}
