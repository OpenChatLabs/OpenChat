// SMTP configuration
export type SMTPConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

// IMAP configuration
export type IMAPConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
};

// user configuration
export type UserConfig = {
  username: string;
  avatar: string | null;
  location: string | null;
  gender: "male" | "female" | null;
};