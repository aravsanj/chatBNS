import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { pipeline, env } from "@xenova/transformers";
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
} from "ai";
import { google } from "@ai-sdk/google";

dotenv.config();

env.localModelPath = "models";
env.allowRemoteModels = true;

interface SupabaseMatchRow {
  content: string;
  chapter: string;
  chapter_name: string;
  section: string;
  section_name: string;
  similarity: number;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase environment variables are not set.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

const app = express();
app.use(express.json());
const port = process.env.PORT || 3001;

app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const messages = req.body?.messages || [];
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.parts?.[0]?.text;

    if (!userQuery) {
      return res.status(400).json({ error: "userQuery is required." });
    }

    const output = await embedder(userQuery, {
      pooling: "mean",
      normalize: true,
    });
    const queryEmbedding: number[] = Array.from(output.data);

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.8,
      match_count: 3,
    });

    if (error) {
      return res.status(500).json({ error: "Failed to search documents." });
    }

    const matchingDocs: SupabaseMatchRow[] = data || [];

    let prompt: string;
    if (matchingDocs.length === 0) {
      prompt = `I could not find a relevant answer in the provided BNS sections.\n\nUser's Question:\n${userQuery}`;
    } else {
      const context = matchingDocs
        .map(
          (row) => `
Chapter ${row.chapter} - ${row.chapter_name}
Section ${row.section}: ${row.section_name}
${row.content}
`
        )
        .join("\n\n");

      prompt = `You are an AI legal assistant specialized in the Bharatiya Nyaya Sanhita (BNS).
Answer the user's query based only on the provided BNS sections.

Guidelines:
- Treat both the Section titles and the Content as sources of truth.
- If the user's query matches a Section title (even partially), return that Section as relevant.
- If the definition in the Content describes the query, return that Section as relevant.
- Always reference the relevant Chapter and Section numbers.
- If multiple Sections mention the term, summarize them all.
- If nothing matches, say:
  "I could not find a relevant answer in the provided BNS sections."
- Do not use knowledge outside the given context.

Context:
${context}

User's Question:
${userQuery}`;
    }

    pipeUIMessageStreamToResponse({
      response: res,
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start" });
          const result = streamText({
            model: google("gemini-2.5-flash"),
            prompt,
          });
          writer.merge(result.toUIMessageStream({ sendStart: false }));
        },
      }),
    });
  } catch (err) {
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log("API endpoint available at /api/chat");
});
