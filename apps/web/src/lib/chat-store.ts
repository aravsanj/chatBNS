"use client";
import { generateId, UIMessage } from "ai";

const STORAGE_KEY = "chats";

export function getStoredChats(): Map<string, UIMessage[]> {
  const data = localStorage?.getItem(STORAGE_KEY);
  if (!data) return new Map();
  const parsed: Record<string, UIMessage[]> = JSON.parse(data);
  return new Map(Object.entries(parsed));
}

function saveStoredChats(chats: Map<string, UIMessage[]>): void {
  const obj = Object.fromEntries(chats);
  localStorage?.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export async function createChat(): Promise<string> {
  const chats = getStoredChats();
  const id = generateId();
  chats.set(id, []);
  saveStoredChats(chats);
  return id;
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  const chats = getStoredChats();
  return chats.get(id) ?? [];
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  const chats = getStoredChats();
  chats.set(chatId, messages);
  saveStoredChats(chats);
}
