"use client";
import { generateId, UIMessage } from "ai";

const STORAGE_KEY = "chats";

export type ChatMeta = {
  id: string;
  created_at: number;
  modified_at: number;
};

export type StoredChat = {
  meta: ChatMeta;
  messages: UIMessage[];
};

function getStoredChats(): Map<string, StoredChat> {
  const data = localStorage?.getItem(STORAGE_KEY);
  if (!data) return new Map();
  const parsed: Record<string, StoredChat> = JSON.parse(data);
  return new Map(Object.entries(parsed));
}

function saveStoredChats(chats: Map<string, StoredChat>): void {
  const obj = Object.fromEntries(chats);
  localStorage?.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function createChat(): string {
  const chats = getStoredChats();

  const lastChat = Array.from(chats.values()).sort(
    (a, b) => b.meta.modified_at - a.meta.modified_at
  )[0];

  if (lastChat && lastChat.messages.length === 0) {
    return lastChat.meta.id;
  }
  const id = generateId();
  const now = Date.now();

  chats.set(id, {
    meta: {
      id,
      created_at: now,
      modified_at: now,
    },
    messages: [],
  });

  saveStoredChats(chats);
  return id;
}

export function loadChat(id: string): UIMessage[] {
  const chats = getStoredChats();
  return chats.get(id)?.messages ?? [];
}

export function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): void {
  const chats = getStoredChats();
  const chat = chats.get(chatId);

  if (!chat) return;

  chats.set(chatId, {
    ...chat,
    messages,
    meta: {
      ...chat.meta,
      modified_at: Date.now(),
    },
  });

  saveStoredChats(chats);
}

export function listChats(): ChatMeta[] {
  const chats = getStoredChats();

  if (chats.size === 0) {
    return [];
  }
  return Array.from(chats.values())
    .map((c) => c.meta)
    .sort((a, b) => b.modified_at - a.modified_at);
}
