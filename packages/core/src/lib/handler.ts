import type { InputHandler } from "../input";
import { receive } from "./receive";
import { send } from "./send";

/** 默认 {@link InputHandler}：SMTP 发件 + IMAP 收件，协议见 `Message.id` */
export function createOpenChatHandler(): InputHandler {
  return {
    receive,
    send,
  };
}
