"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createChat } from "@/lib/chat-store";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const id = await createChat();
      router.replace(`/chat/${id}`);
    }
    init();
  }, [router]);

  return null;
}
