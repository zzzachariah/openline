import ChatRoom from "@/components/ChatRoom";

export default function ListenerChatPage({
  params,
}: {
  params: { bookingId: string };
}) {
  return <ChatRoom bookingId={params.bookingId} role="listener" />;
}
