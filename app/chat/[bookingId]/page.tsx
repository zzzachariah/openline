import ChatRoom, { type Message } from "@/components/ChatRoom";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UserChatPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const initialMessages = await loadInitialMessages(params.bookingId);
  return (
    <ChatRoom
      bookingId={params.bookingId}
      role="user"
      initialMessages={initialMessages}
    />
  );
}

async function loadInitialMessages(bookingId: string): Promise<Message[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, booking_id, sender_id, content, message_type, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("server-side initial messages fetch failed", error);
    return [];
  }
  return (data ?? []) as Message[];
}
