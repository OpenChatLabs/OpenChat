import type { SMTPConfig, IMAPConfig, UserConfig } from "./types/config";

export type Input = {
  smtp: SMTPConfig;
  imap: IMAPConfig;
  user: UserConfig;
};

export interface InputHandler {
  handle(input: Input): Promise<void>;
}