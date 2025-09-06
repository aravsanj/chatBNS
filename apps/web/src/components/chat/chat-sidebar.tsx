"use client";

import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, MessageSquare, PlusCircle } from "lucide-react";
import Link from "next/link";
import { get } from "http";
import { getStoredChats } from "@/lib/chat-store";
import { TextUIPart } from "ai";

export function ChatHistorySidebar({
  currentChatId,
}: {
  currentChatId?: string;
}) {
  const chatsMap = getStoredChats();

  const chats = Array.from(chatsMap.entries()).map(([id, messages]) => {
    const firstUserMessage = messages.find((msg) => msg.role === "user");

    const title =
      firstUserMessage?.parts?.find(
        (part): part is TextUIPart => part.type === "text"
      )?.text || "New Chat";

    return { id, title };
  });
  return (
    <SidebarProvider className="w-fit">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <History className="mr-2 h-5 w-5" /> Chat History
            </h2>
            <Link href="/chat">
              <Button variant="ghost" size="icon" aria-label="New chat">
                <PlusCircle className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="flex-1 px-2 py-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {chats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        asChild
                        className={
                          currentChatId === chat.id ? "bg-secondary" : ""
                        }
                      >
                        <Link href={`/chat/${chat.id}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
      <SidebarTrigger className="lg:hidden p-4" />
    </SidebarProvider>
  );
}
