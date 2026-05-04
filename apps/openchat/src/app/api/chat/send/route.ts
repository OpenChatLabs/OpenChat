import { createMessageId, send } from "@openchat/core";
import { NextResponse } from "next/server";
import { parseSendBody } from "@/lib/chat-payload";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const parsed = parseSendBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const id = createMessageId(parsed.chatRoomId);
    await send(parsed.input, id, parsed.content);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP 发送失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
