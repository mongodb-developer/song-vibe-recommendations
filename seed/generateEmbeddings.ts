import "dotenv/config";
import { VoyageAIClient } from "voyageai";
import type { TrackWithVibe } from "./generateVibeDescriptions";

// voyage-4-lite produces 1024-dimensional vectors.
// numDimensions in your Atlas Vector Search index must match this value.
const EMBEDDING_MODEL = "voyage-4-lite";

export interface TrackWithEmbedding extends TrackWithVibe {
  embedding: number[];
}

export async function generateEmbeddings(
  tracks: TrackWithVibe[]
): Promise<TrackWithEmbedding[]> {
  const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
  if (!VOYAGE_API_KEY) {
    throw new Error("Missing VOYAGE_API_KEY in environment");
  }

  const voyage = new VoyageAIClient({ apiKey: VOYAGE_API_KEY, environment: "https://ai.mongodb.com/v1" });

  console.log(`\nGenerating embeddings for ${tracks.length} tracks...`);

  const response = await voyage.embed({
    model: EMBEDDING_MODEL,
    input: tracks.map((t) => t.vibe_description),
    inputType: "document",
  });

  const results: TrackWithEmbedding[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const embeddingData = response.data?.[i];
    if (!embeddingData?.embedding) {
      console.warn(`  Warning: no embedding returned for "${tracks[i].title}" — skipping`);
      continue;
    }
    results.push({ ...tracks[i], embedding: embeddingData.embedding });
  }

  console.log(`  ${results.length} embeddings generated.`);
  return results;
}
