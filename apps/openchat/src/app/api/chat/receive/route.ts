import { receive } from "@openchat/core";
import { NextResponse } from "next/server";
import { parseReceiveBody } from "@/lib/chat-payload";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const parsed = parseReceiveBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const messages = await receive(parsed.input);
    return NextResponse.json({ messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "IMAP 拉取失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
