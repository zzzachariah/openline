"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Copy,
  Check,
  ChevronDown,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Plus,
  X,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";
import ChatRoomSkeleton from "./ChatRoomSkeleton";

type Message = {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "meeting_code" | "system";
  created_at: string;
  pending?: boolean;
  failed?: boolean;
};

type ChatRoomProps = {
  bookingId: string;
  role: "user" | "listener";
};

type BookingInfo = {
  id: string;
  user_id: string;
  listener_id: string;
  status: "upcoming" | "completed" | "cancelled";
  end_time: string;
  start_time: string;
  counterparty_username: string;
  is_saved: boolean;
};

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export default function ChatRoom({ bookingId, role }: ChatRoomProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [meetingPanelOpen, setMeetingPanelOpen] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [endingSent, setEndingSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createBrowserClient(), []);

  // Tick once per second to drive the timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    async function fetchMessages() {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, booking_id, sender_id, content, message_type, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (cancelled || !msgs) return;
      setMessages((prev) => {
        // Preserve any still-pending or failed local messages while merging
        const pendingLocal = prev.filter((m) => m.pending || m.failed);
        const serverIds = new Set((msgs as Message[]).map((m) => m.id));
        const keep = pendingLocal.filter((m) => !serverIds.has(m.id));
        return [...(msgs as Message[]), ...keep];
      });
    }

    async function init() {
      // Resolve auth FIRST so the realtime client has a JWT before .subscribe().
      // Subscribing before auth resolves means RLS filters out every INSERT event
      // and the recipient never sees new messages.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push(
          `/login?redirect=${role === "listener" ? "/listener" : "/me"}`
        );
        return;
      }
      // Defensive: make sure realtime has the current access token.
      supabase.realtime.setAuth(session.access_token);

      if (cancelled) return;
      setMe(session.user.id);

      const { data: b } = await supabase
        .from("bookings")
        .select(
          "id, user_id, listener_id, status, is_saved, slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
        )
        .eq("id", bookingId)
        .single();

      if (cancelled) return;
      if (!b) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      const expectedRole = role === "user" ? b.user_id : b.listener_id;
      if (expectedRole !== session.user.id) {
        if (!cancelled) {
          setForbidden(true);
          setLoading(false);
        }
        return;
      }

      const counterpartyId = role === "user" ? b.listener_id : b.user_id;
      const { data: cp } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", counterpartyId)
        .single();

      const slotData = Array.isArray(b.slot) ? b.slot[0] : b.slot;

      if (cancelled) return;
      setBooking({
        id: b.id,
        user_id: b.user_id,
        listener_id: b.listener_id,
        status: b.status,
        start_time: slotData.start_time,
        end_time: slotData.end_time,
        counterparty_username: cp?.username || "",
        is_saved: !!b.is_saved,
      });

      await fetchMessages();
      if (cancelled) return;
      setLoading(false);

      channel = supabase
        .channel(`messages:${bookingId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `booking_id=eq.${bookingId}`,
          },
          (payload) => {
            const m = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              // If this insert is an echo of an optimistic placeholder we
              // added locally, replace it in place. Match by temp-* id +
              // sender + content so the swap works regardless of whether
              // the local row is still pending or has been cleared by
              // the insert response.
              const idx = prev.findIndex(
                (x) =>
                  x.id.startsWith("temp-") &&
                  x.sender_id === m.sender_id &&
                  x.content === m.content
              );
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = m;
                return next;
              }
              return [...prev, m];
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Reconnect → fill any gap that arrived while we were offline.
            fetchMessages();
          }
        });
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bookingId, role, router, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const endTs = booking ? new Date(booking.end_time).getTime() : 0;
  const startTs = booking ? new Date(booking.start_time).getTime() : 0;
  const remainingMs = booking ? Math.max(0, endTs - now) : 0;
  const sessionStarted = booking ? now >= startTs : false;
  const sessionEnded = booking ? now >= endTs : false;
  const pastRetention =
    !!booking && sessionEnded && !booking.is_saved && now - endTs > RETENTION_MS;

  // Mark booking completed once it ends
  useEffect(() => {
    if (!booking || endingSent) return;
    if (sessionEnded && booking.status === "upcoming") {
      setEndingSent(true);
      supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id)
        .then(() => {
          setBooking((b) => (b ? { ...b, status: "completed" } : b));
        });
    }
  }, [sessionEnded, booking, endingSent, supabase]);

  async function sendMessage(content: string, type: "text" | "meeting_code") {
    if (!me || !booking) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) return;
    if (sessionEnded) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      booking_id: booking.id,
      sender_id: me,
      content: trimmed,
      message_type: type,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    // Plain insert — no .select().single(). The post-insert SELECT
    // can return zero rows through RLS (PGRST116 "Cannot coerce the
    // result to a single JSON object") even when the row landed
    // successfully, which used to mis-flag every send as 失败. We let
    // the realtime channel deliver the real row instead.
    const { error } = await supabase.from("messages").insert({
      booking_id: booking.id,
      sender_id: me,
      content: trimmed,
      message_type: type,
    });

    if (error) {
      console.error("send message failed", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m
        )
      );
      const detail = [error.message, error.code, error.details, error.hint]
        .filter(Boolean)
        .join(" · ");
      setSendError(`发送失败：${detail || "请重试"}`);
      return;
    }

    // Clear the pending flag so the bubble drops the "发送中…" caption.
    // The realtime echo will swap the temp-* row for the real one.
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m))
    );
  }

  async function handleSend() {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await sendMessage(text, "text");
  }

  async function handleSendMeetingCode() {
    if (!meetingCode.trim()) return;
    const code = meetingCode;
    setMeetingCode("");
    setMeetingPanelOpen(false);
    await sendMessage(code, "meeting_code");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function toggleSaved() {
    if (!booking || role !== "user" || saveBusy) return;
    const next = !booking.is_saved;
    setSaveBusy(true);
    // Optimistic flip
    setBooking((b) => (b ? { ...b, is_saved: next } : b));
    const { error } = await supabase
      .from("bookings")
      .update({ is_saved: next })
      .eq("id", booking.id);
    setSaveBusy(false);
    if (error) {
      // Roll back
      setBooking((b) => (b ? { ...b, is_saved: !next } : b));
    }
  }

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  if (loading) {
    return <ChatRoomSkeleton />;
  }
  if (forbidden) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-h2 font-medium mb-3">无法访问</p>
        <p className="text-muted mb-6">这个聊天室不属于你，或者预约不存在。</p>
        <Link
          href={role === "listener" ? "/listener" : "/me"}
          className="btn-primary"
        >
          返回
        </Link>
      </div>
    );
  }
  if (!booking) return null;

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const showFiveMinBanner =
    sessionStarted && !sessionEnded && remainingMs > 0 && remainingMs <= 5 * 60 * 1000;

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">
          <Link
            href={role === "listener" ? "/listener" : "/me"}
            aria-label="返回"
            className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-foreground transition-colors shrink-0 py-2 -ml-1 pr-2"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-[14px] text-foreground truncate">
              {sessionEnded
                ? "已结束"
                : sessionStarted
                ? `倾诉中 · 还剩 ${timeStr}`
                : "等待开始"}
            </div>
            {(sessionStarted || sessionEnded) && (
              <div className="text-[12px] text-muted truncate sm:hidden">
                {booking.counterparty_username}
              </div>
            )}
          </div>
          {sessionStarted || sessionEnded ? (
            <span className="text-[13px] text-muted shrink-0 hidden sm:inline truncate max-w-[40%]">
              {booking.counterparty_username}
            </span>
          ) : (
            <span className="w-10 shrink-0" aria-hidden="true" />
          )}
        </div>
        {showFiveMinBanner && (
          <div className="bg-accent-soft border-t border-accent/30">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2 text-[13px] text-foreground/80 text-center">
              还剩 5 分钟。如果聊得还不够，可以再约一次。
            </div>
          </div>
        )}
      </header>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {pastRetention && messages.length === 0 ? (
            <div className="card text-center text-muted">
              <p className="mb-1 text-foreground/80">聊天记录已自动删除</p>
              <p className="text-caption">
                未保存的聊天记录会在 7 天后清空，倾诉记录仍会保留。
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted text-[14px] py-12">
              这是你们的聊天室。
              <br />
              {sessionEnded ? "这一次没有留下文字。" : "说点什么开始吧。"}
            </div>
          ) : (
            messageGroups.map((group, i) => (
              <div key={i} className="space-y-2">
                {group.showTimestamp && (
                  <div className="text-center text-caption text-muted py-1">
                    {formatTime(new Date(group.messages[0].created_at))}
                  </div>
                )}
                {group.messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    mine={m.sender_id === me}
                  />
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {sessionEnded ? (
        <EndedFooter
          role={role}
          isSaved={booking.is_saved}
          saveBusy={saveBusy}
          onToggleSaved={role === "user" ? toggleSaved : undefined}
          resourcesOpen={resourcesOpen}
          setResourcesOpen={setResourcesOpen}
          pastRetention={pastRetention}
        />
      ) : (
        <div className="border-t border-border bg-background safe-bottom">
          <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">
            {sendError && (
              <div className="mb-2 text-[13px] text-danger inline-flex items-center gap-1.5">
                <AlertCircle size={14} />
                {sendError}
              </div>
            )}
            {role === "listener" && meetingPanelOpen && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  placeholder="粘贴腾讯会议号"
                  autoFocus
                  className="block flex-1 min-w-0 h-11 rounded-lg border border-border bg-surface text-foreground text-[16px] sm:text-[15px] px-3.5 outline-none focus:border-accent placeholder:text-muted transition-colors"
                />
                <button
                  onClick={handleSendMeetingCode}
                  disabled={!meetingCode.trim()}
                  className="inline-flex items-center justify-center h-11 px-4 sm:px-5 rounded-full bg-accent text-white border border-accent text-[15px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  发送
                </button>
                <button
                  onClick={() => setMeetingPanelOpen(false)}
                  aria-label="取消"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              {role === "listener" && (
                <button
                  type="button"
                  onClick={() => setMeetingPanelOpen((v) => !v)}
                  aria-label={meetingPanelOpen ? "关闭会议号输入" : "发送腾讯会议号"}
                  aria-pressed={meetingPanelOpen}
                  title="发送腾讯会议号"
                  className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full border transition-colors ${
                    meetingPanelOpen
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  <Plus
                    size={18}
                    className={`transition-transform ${meetingPanelOpen ? "rotate-45" : ""}`}
                  />
                </button>
              )}
              <div className="flex-1 relative min-w-0">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                  onKeyDown={onKeyDown}
                  placeholder="说点什么..."
                  rows={1}
                  className="block w-full resize-none rounded-lg border border-border bg-surface text-foreground text-[16px] sm:text-[15px] leading-5 py-[11px] px-3.5 min-h-[44px] max-h-32 outline-none focus:border-accent placeholder:text-muted transition-colors"
                  style={{ paddingRight: draft.length > 800 ? 60 : undefined }}
                />
                {draft.length > 800 && (
                  <span className="absolute right-3 bottom-2 text-[12px] text-muted">
                    {draft.length} / 1000
                  </span>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sessionEnded}
                aria-label="发送"
                className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-accent text-white border border-accent transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const [copied, setCopied] = useState(false);

  if (message.message_type === "meeting_code") {
    async function copy() {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
        className={`flex ${mine ? "justify-end" : "justify-start"}`}
      >
        <div className="max-w-[70%]">
          <div className="text-caption text-muted mb-1 px-1">腾讯会议号</div>
          <div className="rounded-xl border border-accent bg-accent-soft px-4 py-3 flex items-center gap-3">
            <span className="font-mono text-[15px] tracking-wider">
              {message.content}
            </span>
            <button
              onClick={copy}
              className="text-[13px] text-accent hover:opacity-80 inline-flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check size={12} /> 已复制
                </>
              ) : (
                <>
                  <Copy size={12} /> 复制
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (message.message_type === "system") {
    return (
      <div className="text-center text-caption text-muted py-1">
        {message.content}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div className="flex flex-col max-w-[70%]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
            mine
              ? `bg-accent text-white rounded-br-sm ${message.pending ? "opacity-70" : ""} ${message.failed ? "opacity-60" : ""}`
              : "bg-surface border border-border rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        {mine && (message.pending || message.failed) && (
          <span
            className={`text-caption mt-1 px-1 self-end ${
              message.failed ? "text-danger" : "text-muted"
            }`}
          >
            {message.failed ? "发送失败" : "发送中…"}
          </span>
        )}
      </div>
    </motion.div>
  );
}

type Group = { showTimestamp: boolean; messages: Message[] };

function groupMessages(messages: Message[]): Group[] {
  const groups: Group[] = [];
  let last: Message | null = null;
  for (const m of messages) {
    const t = new Date(m.created_at).getTime();
    const lastT = last ? new Date(last.created_at).getTime() : null;
    const showTimestamp = !last || (lastT !== null && t - lastT > 5 * 60 * 1000);
    if (showTimestamp) {
      groups.push({ showTimestamp: true, messages: [m] });
    } else {
      groups[groups.length - 1].messages.push(m);
    }
    last = m;
  }
  return groups;
}

function EndedFooter({
  role,
  isSaved,
  saveBusy,
  onToggleSaved,
  resourcesOpen,
  setResourcesOpen,
  pastRetention,
}: {
  role: "user" | "listener";
  isSaved: boolean;
  saveBusy: boolean;
  onToggleSaved?: () => void;
  resourcesOpen: boolean;
  setResourcesOpen: (v: boolean) => void;
  pastRetention: boolean;
}) {
  return (
    <div className="border-t border-border bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[14px] text-muted">
            {pastRetention
              ? "这次倾诉的聊天记录已自动删除。"
              : isSaved
              ? "这次的聊天记录已保存，不会被自动删除。"
              : "未保存的聊天记录会在 7 天后自动删除，倾诉记录会一直保留。"}
          </div>
          {onToggleSaved && !pastRetention && (
            <button
              onClick={onToggleSaved}
              disabled={saveBusy}
              className={`inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md border transition-colors ${
                isSaved
                  ? "border-accent text-accent bg-accent-soft"
                  : "border-border text-muted hover:text-foreground"
              } ${saveBusy ? "opacity-60" : ""}`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck size={14} />
                  已保存
                </>
              ) : (
                <>
                  <Bookmark size={14} />
                  保存聊天记录
                </>
              )}
            </button>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => setResourcesOpen(!resourcesOpen)}
            className="inline-flex items-center gap-1 text-[14px] text-accent"
          >
            {resourcesOpen ? "收起" : "如果想看一些专业资源"}{" "}
            <ChevronDown
              size={14}
              className={`transition-transform ${resourcesOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {resourcesOpen && (
          <div className="card text-[14px] leading-relaxed text-foreground/85 space-y-2">
            <ResourceItem text="全国心理援助热线: 400-161-9995" />
            <ResourceItem text="北京心理危机研究与干预中心: 010-82951332" />
            <ResourceItem text="12355 青少年服务热线" />
            <ResourceItem text="各地三甲医院的精神科 / 心理科" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          {role === "user" && (
            <Link href="/book" className="btn-primary">
              预约下一次
            </Link>
          )}
          {role === "listener" && (
            <Link href="/listener" className="btn-primary">
              返回后台
            </Link>
          )}
          <Link href="/" className="btn-ghost">
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-accent shrink-0">·</span>
      <span>{text}</span>
    </div>
  );
}
