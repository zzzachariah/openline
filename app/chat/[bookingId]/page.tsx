import ChatRoom from "@/components/ChatRoom";

export default function UserChatPage({ params }: { params: { bookingId: string } }) {
  return <ChatRoom bookingId={params.bookingId} role="user" />;
}
