import type { SMTPConfig } from "../types/config";
import nodemailer from "nodemailer";
export const send = async (config: SMTPConfig, message: string) => {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    }
  });
  return await transporter.sendMail({
    from: config.username,
    to: config.username,
    subject: "Hello",
    text: message
  });
};