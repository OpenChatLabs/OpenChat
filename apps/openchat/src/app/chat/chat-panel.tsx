"use client";

import type { Message } from "@openchat/core";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadRoomHistory,
  mergeById,
  persistMessagesByRoom,
  saveRoomHistory,
} from "@/lib/chat-history";

const STORAGE_KEY = "openchat:v1:form";

/** 标签页在前台时的 IMAP 轮询间隔（毫秒）；静默拉取，不冻结发送按钮 */
const POLL_VISIBLE_MS = 1100;
/** 标签页在后台时放慢，减轻服务商限流 */
const POLL_HIDDEN_MS = 12000;

/** 发送成功后追加的短时间同步调度（毫秒），用于更快收到对端回信 */
const POST_SEND_BURST_MS = [120, 350, 700, 1400, 2800, 5500];

type FormState = {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  email: string;
  password: string;
  peerEmail: string;
  chatRoomId: string;
  rememberPassword: boolean;
};

const defaultForm: FormState = {
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  email: "",
  password: "",
  peerEmail: "",
  chatRoomId: "",
  rememberPassword: false,
};

function newRoomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function loadForm(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultForm };
    }
    const p = JSON.parse(raw) as Partial<FormState>;
    const merged = { ...defaultForm, ...p };
    if (!merged.rememberPassword) {
      merged.password = "";
    }
    return merged;
  } catch {
    return { ...defaultForm };
  }
}

function saveForm(f: FormState) {
  const toSave: FormState = {
    ...f,
    password: f.rememberPassword ? f.password : "",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function buildReceivePayload(f: FormState) {
  const smtpPort = Number.parseInt(f.smtpPort, 10);
  const imapPort = Number.parseInt(f.imapPort, 10);
  return {
    smtp: {
      host: f.smtpHost.trim(),
      port: smtpPort,
      secure: f.smtpSecure,
      username: f.email.trim(),
      password: f.password,
    },
    imap: {
      host: f.imapHost.trim(),
      port: imapPort,
      secure: f.imapSecure,
      username: f.email.trim(),
      password: f.password,
    },
    peerEmail: f.peerEmail.trim(),
  };
}

function buildSendPayload(f: FormState) {
  return {
    ...buildReceivePayload(f),
    chatRoomId: f.chatRoomId.trim(),
  };
}

export function ChatPanel() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(form);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后从 localStorage 恢复，避免 SSR 与客户端初始不一致
    setForm(loadForm());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveForm(form);
  }, [form, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const room = form.chatRoomId.trim();
    if (!room) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 无聊天室时清空列表
      setMessages([]);
      return;
    }
    setMessages(loadRoomHistory(room));
  }, [form.chatRoomId, hydrated]);

  const sync = useCallback(async (opts: { silent?: boolean } = {}) => {
    const silent = opts.silent ?? false;
    const f = formRef.current;

    if (syncInFlightRef.current) {
      return;
    }

    if (!silent) {
      setStatus(null);
    }

    const p = buildReceivePayload(f);
    if (
      !p.smtp.host ||
      !p.imap.host ||
      !p.smtp.username ||
      !p.smtp.password ||
      !p.peerEmail
    ) {
      if (!silent) {
        setStatus("请先填写完整邮箱配置（含密码）");
      }
      return;
    }
    if (!Number.isFinite(p.smtp.port) || !Number.isFinite(p.imap.port)) {
      if (!silent) {
        setStatus("端口必须是数字");
      }
      return;
    }

    syncInFlightRef.current = true;
    if (!silent) {
      setBusy(true);
    }
    try {
      const res = await fetch("/api/chat/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = (await res.json()) as { messages?: Message[]; error?: string };
      if (!res.ok) {
        if (!silent) {
          setStatus(data.error ?? `同步失败 (${res.status})`);
        }
        return;
      }
      const apiMsgs = data.messages ?? [];
      persistMessagesByRoom(apiMsgs);
      const room = f.chatRoomId.trim();
      if (!room) {
        setMessages([]);
        return;
      }
      const slice = apiMsgs.filter((m) => m.chatRoomId === room);
      const merged = mergeById(loadRoomHistory(room), slice);
      saveRoomHistory(room, merged);
      setMessages(merged);
    } catch {
      if (!silent) {
        setStatus("网络错误");
      }
    } finally {
      syncInFlightRef.current = false;
      if (!silent) {
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const poll = () => void sync({ silent: true });

    const startInterval = () => {
      const ms = document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
      return window.setInterval(poll, ms);
    };

    let intervalId = startInterval();
    poll();

    const onVisibility = () => {
      window.clearInterval(intervalId);
      intervalId = startInterval();
      if (document.visibilityState === "visible") {
        poll();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated, sync]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    const prev = formRef.current;
    let roomId = prev.chatRoomId.trim();
    if (!roomId) {
      roomId = newRoomId();
      setForm((p) => ({ ...p, chatRoomId: roomId }));
    }

    const mergedForm: FormState = { ...prev, chatRoomId: roomId };
    const p = { ...buildSendPayload(mergedForm), content: text };
    if (
      !p.smtp.host ||
      !p.imap.host ||
      !p.smtp.username ||
      !p.smtp.password ||
      !p.peerEmail ||
      !p.chatRoomId
    ) {
      setStatus("发送前请填完整邮箱配置");
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        setStatus(data.error ?? `发送失败 (${res.status})`);
        return;
      }
      const msgId = data.id;
      if (msgId && roomId) {
        const optimistic: Message = {
          id: msgId,
          chatRoomId: roomId,
          from: mergedForm.email.trim().toLowerCase(),
          to: mergedForm.peerEmail.trim().toLowerCase(),
          date: new Date().toISOString(),
          content: text,
        };
        const next = mergeById(loadRoomHistory(roomId), [optimistic]);
        saveRoomHistory(roomId, next);
        setMessages(next);
      }
      setDraft("");
      void sync({ silent: true });
      for (const ms of POST_SEND_BURST_MS) {
        window.setTimeout(() => void sync({ silent: true }), ms);
      }
    } catch {
      setStatus("网络错误");
    } finally {
      setBusy(false);
    }
  };

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selfLower = form.email.trim().toLowerCase();

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            OpenChat
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            基于邮箱协议，无法达到 IM 级即时；前台约每秒静默拉取，发送后额外密集同步。实际延迟仍取决于邮局投递。
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          返回首页
        </Link>
      </header>

      <details className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          邮箱基本配置
        </summary>
        <div className="grid gap-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">本邮箱账号（SMTP/IMAP 用户名）</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => patch("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">密码 / 应用专用密码</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => patch("password", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.rememberPassword}
              onChange={(e) => patch("rememberPassword", e.target.checked)}
            />
            记住密码（仅存浏览器本地，请勿在公共设备勾选）
          </label>

          <fieldset className="space-y-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-medium text-zinc-500">SMTP 发信</legend>
            <input
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="主机，如 smtp.example.com"
              value={form.smtpHost}
              onChange={(e) => patch("smtpHost", e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="w-24 rounded border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="端口"
                value={form.smtpPort}
                onChange={(e) => patch("smtpPort", e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => patch("smtpSecure", e.target.checked)}
                />
                TLS/SSL
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-medium text-zinc-500">IMAP 收信</legend>
            <input
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="主机，如 imap.example.com"
              value={form.imapHost}
              onChange={(e) => patch("imapHost", e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="w-24 rounded border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="端口"
                value={form.imapPort}
                onChange={(e) => patch("imapPort", e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={form.imapSecure}
                  onChange={(e) => patch("imapSecure", e.target.checked)}
                />
                TLS/SSL
              </label>
            </div>
          </fieldset>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-500 dark:text-zinc-400">对端邮箱</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              type="email"
              value={form.peerEmail}
              onChange={(e) => patch("peerEmail", e.target.value)}
              placeholder="peer@example.com"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <label className="block min-w-[12rem] flex-1 text-sm">
              <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                聊天室 ID（首条消息发出后生成；接入已有会话可粘贴对方 Subject 中的 id）
              </span>
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                value={form.chatRoomId}
                onChange={(e) => patch("chatRoomId", e.target.value)}
                placeholder="留空即可，发送第一条消息时创建"
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              onClick={() => patch("chatRoomId", "")}
            >
              清空聊天室
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              disabled={busy}
              onClick={() => void sync()}
            >
              立即同步
            </button>
          </div>
        </div>
      </details>

      {status ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {status}
        </p>
      ) : null}

      <section className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {busy
                ? "加载中…"
                : "暂无消息；填写邮箱后可发送第一条消息（将自动创建聊天室），或粘贴对方会话的聊天室 ID 后同步"}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.from.toLowerCase() === selfLower;
              return (
                <article
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  }`}
                >
                  <div className="mb-1 text-[10px] opacity-70">
                    {mine ? "我" : m.from} · {new Date(m.date).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </article>
              );
            })
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
          <textarea
            className="min-h-[44px] flex-1 resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            rows={2}
            placeholder="输入消息…（首条将创建聊天室）"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={busy || !draft.trim()}
            onClick={() => void sendMessage()}
          >
            发送
          </button>
        </div>
      </section>
    </div>
  );
}
