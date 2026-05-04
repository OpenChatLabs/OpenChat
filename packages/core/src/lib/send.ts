import type { Input } from "../input";
import nodemailer from "nodemailer";

export async function send(input: Input, id: string, content: string): Promise<void> {
  const peer = input.peerEmail.trim();
  if (!peer) {
    throw new Error("OpenChat send requires peerEmail");
  }

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

  await transporter.sendMail({
    from: config.username,
    to: peer,
    subject: id,
    text: content,
  });
}
