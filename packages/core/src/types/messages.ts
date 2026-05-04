/** 发起会话时生成；底层双邮箱交换协议用此标识聊天室（勿含 `+`） */
export type ChatRoomId = string;

export type Message = {
  /**
   * 邮件 Subject：`openchat+<chatroom_id>+<timestampMs>+<random>`
   */
  id: string;
  /** 从 Subject 解析出的聊天室 id */
  chatRoomId: ChatRoomId;
  from: string;
  to: string;
  date: string;
  content: string;
};
