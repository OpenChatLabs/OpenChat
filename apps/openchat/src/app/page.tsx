import {
  createChatRoomId,
  createMessageId,
  createOpenChatHandler,
} from "@openchat/core";
import Link from "next/link";

export default function Home() {
  const handler = createOpenChatHandler();
  const demoRoom = createChatRoomId();
  const demoMsg = createMessageId(demoRoom);

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="w-full max-w-xl space-y-6 text-zinc-900 dark:text-zinc-50">
        <h1 className="text-3xl font-semibold tracking-tight">OpenChat</h1>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          Monorepo 已接通{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            @openchat/core
          </code>
          ：双邮箱通过 SMTP/IMAP 交换邮件；聊天室在首条消息发出时创建，Subject 使用{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            createMessageId(chatRoomId)
          </code>{" "}
          生成的协议 id。
        </p>
        <p>
          <Link
            href="/chat"
            className="inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            打开聊天页（配置邮箱）
          </Link>
        </p>
        <dl className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">
              InputHandler
            </dt>
            <dd className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
              send / receive 已实现（需配置 peerEmail）
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">
              示例消息 id
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
              {demoMsg}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          handler 方法：{typeof handler.send} send · {typeof handler.receive}{" "}
          receive
        </p>
      </main>
    </div>
  );
}
