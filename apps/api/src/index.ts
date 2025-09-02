import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { pipeline, env } from "@xenova/transformers";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

env.localModelPath = "models";
env.allowRemoteModels = true;

interface QueryRequestBody {
  userQuery: string;
}

interface SupabaseMatchRow {
  content: string;
  chapter: string;
  chapter_name: string;
  section: string;
  section_name: string;
  similarity: number;
}

interface Source {
  chapter: string;
  chapter_name: string;
  section: string;
  section_name: string;
  similarity: number;
}

interface ApiResponse {
  answer: string;
  sources: Source[];
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

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set.");
}

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

app.post(
  "/query",
  async (req: Request, res: Response<ApiResponse | { error: string }>) => {
    const { userQuery }: QueryRequestBody = req.body;

    if (!userQuery) {
      return res.status(400).json({ error: "userQuery is required." });
    }

    try {
      console.log("Generating query embedding...");
      const output = await embedder(userQuery, {
        pooling: "mean",
        normalize: true,
      });
      const queryEmbedding: number[] = Array.from(output.data);

      console.log("Searching for similar documents in Supabase...");
      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.8,
        match_count: 3,
      });
      console.log(data);
      if (error) {
        console.error("Supabase search error:", error);
        return res.status(500).json({ error: "Failed to search documents." });
      }

      const matchingDocs: SupabaseMatchRow[] = data || [];

      if (matchingDocs.length === 0) {
        return res.status(200).json({
          answer:
            "I could not find any relevant information to answer your question.",
          sources: [],
        });
      }

      const context = matchingDocs
        .map(
          (row) => `
Chapter ${row.chapter} - ${row.chapter_name}
Section ${row.section}: ${row.section_name}
${row.content}
`
        )
        .join("\n\n");

      console.log(context, "context");
      const prompt = `You are an AI legal assistant specialized in the Bharatiya Nyaya Sanhita (BNS).
Answer the user's query based only on the provided BNS sections.

Guidelines:
- Treat both the Section titles and the Content as sources of truth.
- If the user's query matches a Section title (even partially, e.g., query: "theft", title: "Theft in a dwelling house"), return that Section as relevant.
- If the definition in the Content describes the query (e.g., "theft is snatching"), return that Section as relevant.
- Always reference the relevant Chapter and Section numbers.
- If multiple Sections mention the term, summarize them all.
- If nothing matches, say:
  "I could not find a relevant answer in the provided BNS sections."
- Do not use knowledge outside the given context.

Context:
${context}

User's Question:
${userQuery}`;

      console.log("Generating response with Gemini...");
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const textAnswer = result.text ?? "No answer was generated.";

      const sources: Source[] = matchingDocs.map((row) => ({
        chapter: row.chapter,
        chapter_name: row.chapter_name,
        section: row.section,
        section_name: row.section_name,
        similarity: row.similarity,
      }));

      res.json({
        answer: textAnswer,
        sources,
      });
    } catch (err) {
      console.error("An unexpected error occurred:", err);
      res.status(500).json({ error: "An internal server error occurred." });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log("API endpoint available at /query");
});
