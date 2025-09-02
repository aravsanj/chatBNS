import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";
import fs from "fs";
import path from "path";
import Papa, { ParseResult } from "papaparse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase environment variables are not set.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CsvRow {
  Chapter: string;
  Chapter_name: string;
  Chapter_subtype: string;
  Section: string;
  Section_name: string;
  Description: string;
}

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

async function ingestData() {
  console.log("Starting data ingestion...");

  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "data",
    "bns_sections.csv"
  );
  const csvFile = fs.readFileSync(filePath, "utf8");
  const parsedResult: ParseResult<CsvRow> = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsedResult.data || parsedResult.data.length === 0) {
    console.error("No data found in the CSV file.");
    return;
  }
  if (!parsedResult.data || parsedResult.data.length === 0) {
    console.error("No data found in the CSV file.");
    return;
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  for (const row of parsedResult.data) {
    const {
      Chapter,
      Chapter_name,
      Chapter_subtype,
      Section,
      Section_name,
      Description,
    } = row;

    if (!Description || Description.trim() === "") {
      continue;
    }

    try {
      const textChunks = await splitter.splitText(Description);

      for (const chunk of textChunks) {
        const output = await embedder(chunk, {
          pooling: "mean",
          normalize: true,
        });
        const embedding = Array.from(output.data);

        const { error } = await supabase.from("documents").insert([
          {
            content: chunk,
            embedding: embedding,
            chapter: Chapter,
            chapter_name: Chapter_name,
            chapter_subtype: Chapter_subtype,
            section: Section,
            section_name: Section_name,
          },
        ]);

        if (error) {
          if (error.code === "23505") {
            console.error(`Duplicate entry for Section ${Section}. Skipping.`);
            continue;
          }
          throw error;
        }
      }
      console.log(`Ingested section ${Section}`);
    } catch (err) {
      console.error(`Failed to ingest section ${Section}:`, err);
    }
  }

  console.log("Data ingestion complete!");
}

ingestData();
