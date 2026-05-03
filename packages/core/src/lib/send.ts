import type { Input } from "../input";
import nodemailer from "nodemailer";

export const send = async (input: Input, message: string) => {
  const { smtp: config } = input;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
  return await transporter.sendMail({
    from: config.username,
    to: config.username,
    subject: "Hello",
    text: message
  });
};