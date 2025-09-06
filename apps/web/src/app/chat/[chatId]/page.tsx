"use client";

import { useEffect, useState, use } from "react";
import Chat from "@/components/chat/chat";
import { loadChat } from "@/lib/chat-store";
import { ChatHistorySidebar } from "@/components/chat/chat-sidebar";

export default function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const unwrappedParams = use(params);
  const { chatId } = unwrappedParams;
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);

  useEffect(() => {
    loadChat(chatId)
      .then(setMessages)
      .finally(() => setLoadingChat(false));
  }, [chatId]);

  return (
    !loadingChat && (
      <div className="flex h-screen">
        <ChatHistorySidebar currentChatId={chatId} />
        <Chat id={chatId} initialMessages={messages} />
      </div>
    )
  );
}
