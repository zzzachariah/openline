"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Copy, Check, ChevronDown } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";

type Message = {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "meeting_code" | "system";
  created_at: string;
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
};

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tick once per second to drive the timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push(`/login?redirect=${role === "listener" ? "/listener" : "/me"}`);
        return;
      }
      setMe(auth.user.id);

      const { data: b } = await supabase
        .from("bookings")
        .select(
          "id, user_id, listener_id, status, slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
        )
        .eq("id", bookingId)
        .single();

      if (!b) {
        if (!cancelled) {
          setForbidden(true);
          setLoading(false);
        }
        return;
      }

      const expectedRole = role === "user" ? b.user_id : b.listener_id;
      if (expectedRole !== auth.user.id) {
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
      });

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, booking_id, sender_id, content, message_type, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (!cancelled && msgs) setMessages(msgs as Message[]);

      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [bookingId, role, router]);

  useEffect(() => {
    // Auto-scroll to bottom when new message arrives
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const endTs = booking ? new Date(booking.end_time).getTime() : 0;
  const startTs = booking ? new Date(booking.start_time).getTime() : 0;
  const remainingMs = booking ? Math.max(0, endTs - now) : 0;
  const sessionStarted = booking ? now >= startTs : false;
  const sessionEnded = booking ? now >= endTs : false;

  // Mark booking completed once it ends
  useEffect(() => {
    if (!booking || endingSent) return;
    if (sessionEnded && booking.status === "upcoming") {
      setEndingSent(true);
      const supabase = createBrowserClient();
      supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id)
        .then(() => {
          setBooking((b) => (b ? { ...b, status: "completed" } : b));
        });
    }
  }, [sessionEnded, booking, endingSent]);

  async function sendMessage(content: string, type: "text" | "meeting_code") {
    if (!me || !booking) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) return;
    if (sessionEnded) return;

    const supabase = createBrowserClient();
    await supabase.from("messages").insert({
      booking_id: booking.id,
      sender_id: me,
      content: trimmed,
      message_type: type,
    });
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

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">载入中...</div>
    );
  }
  if (forbidden) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-h2 font-medium mb-3">无法访问</p>
        <p className="text-muted mb-6">这个聊天室不属于你，或者预约不存在。</p>
        <Link href={role === "listener" ? "/listener" : "/me"} className="btn-primary">
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
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href={role === "listener" ? "/listener" : "/me"}
            className="flex items-center gap-1.5 text-[14px] text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </Link>
          <div className="text-[14px] text-muted">
            {sessionEnded ? "已结束" : sessionStarted ? `倾诉中 · 还剩 ${timeStr}` : "等待开始"}
          </div>
          {sessionStarted && !sessionEnded ? (
            <span className="text-[13px] text-muted">{booking.counterparty_username}</span>
          ) : (
            <span className="w-10" />
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

      {/* Content */}
      {sessionEnded ? (
        <EndedScreen
          role={role}
          resourcesOpen={resourcesOpen}
          setResourcesOpen={setResourcesOpen}
        />
      ) : (
        <>
          <div ref={containerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center text-muted text-[14px] py-12">
                  这是你们的聊天室。
                  <br />
                  说点什么开始吧。
                </div>
              )}
              {messageGroups.map((group, i) => (
                <div key={i} className="space-y-2">
                  {group.showTimestamp && (
                    <div className="text-center text-caption text-muted py-1">
                      {formatTime(new Date(group.messages[0].created_at))}
                    </div>
                  )}
                  {group.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} mine={m.sender_id === me} />
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-background">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
              {role === "listener" && meetingPanelOpen && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    placeholder="粘贴腾讯会议号"
                    className="input flex-1"
                  />
                  <button
                    onClick={handleSendMeetingCode}
                    disabled={!meetingCode.trim()}
                    className="btn-primary"
                  >
                    发送
                  </button>
                  <button
                    onClick={() => setMeetingPanelOpen(false)}
                    className="btn-ghost"
                  >
                    取消
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                    onKeyDown={onKeyDown}
                    placeholder="说点什么..."
                    rows={1}
                    className="input resize-none min-h-[44px] max-h-32 py-2.5"
                    style={{ paddingRight: draft.length > 800 ? 60 : undefined }}
                  />
                  {draft.length > 800 && (
                    <span className="absolute right-3 bottom-2 text-[12px] text-muted">
                      {draft.length} / 1000
                    </span>
                  )}
                </div>
                {role === "listener" && (
                  <button
                    type="button"
                    onClick={() => setMeetingPanelOpen((v) => !v)}
                    className="btn-secondary py-2.5 px-3 text-[13px]"
                    title="发送腾讯会议号"
                  >
                    发送会议号
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sessionEnded}
                  className="btn-primary py-2.5 px-4"
                  aria-label="发送"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
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
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[70%]">
          <div className="text-caption text-muted mb-1 px-1">腾讯会议号</div>
          <div className="rounded-xl border border-accent bg-accent-soft px-4 py-3 flex items-center gap-3">
            <span className="font-mono text-[15px] tracking-wider">{message.content}</span>
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
      </div>
    );
  }

  if (message.message_type === "system") {
    return (
      <div className="text-center text-caption text-muted py-1">{message.content}</div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
          mine
            ? "bg-accent text-white rounded-br-sm"
            : "bg-surface border border-border rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
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

function EndedScreen({
  role,
  resourcesOpen,
  setResourcesOpen,
}: {
  role: "user" | "listener";
  resourcesOpen: boolean;
  setResourcesOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-prose w-full py-12">
        <p className="text-h2 font-medium tracking-tight text-center mb-10">
          这次倾诉结束了。
        </p>
        <p className="text-[15px] text-foreground/85 leading-relaxed text-center mb-6">
          如果今天聊的内容让你觉得有些事情可能需要更专业的帮助，
        </p>
        <button
          onClick={() => setResourcesOpen(!resourcesOpen)}
          className="mx-auto flex items-center gap-1 text-[14px] text-accent mb-4"
        >
          {resourcesOpen ? "收起" : "展开"}{" "}
          <ChevronDown
            size={14}
            className={`transition-transform ${resourcesOpen ? "rotate-180" : ""}`}
          />
          {!resourcesOpen && <span className="ml-1 text-foreground">这里有一些资源</span>}
        </button>
        {resourcesOpen && (
          <div className="card mb-10 text-[14px] leading-relaxed text-foreground/85 space-y-2">
            <ResourceItem text="全国心理援助热线: 400-161-9995" />
            <ResourceItem text="北京心理危机研究与干预中心: 010-82951332" />
            <ResourceItem text="12355 青少年服务热线" />
            <ResourceItem text="各地三甲医院的精神科 / 心理科" />
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
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
