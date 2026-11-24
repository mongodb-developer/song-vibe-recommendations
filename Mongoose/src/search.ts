import dotenv from "dotenv";
import path from "path";
import { SongModel, VECTOR_INDEX, connectDB, disconnectDB } from "./song";
import { VoyageAIClient } from "voyageai";

// Load the .env file from the Mongoose/ folder, regardless of where the script is run from.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!VOYAGE_API_KEY) {
  throw new Error(
    "Missing VOYAGE_API_KEY in environment. Ensure that you have created a .env file and added your Voyage AI key."
  );
}

export { VECTOR_INDEX, connectDB, disconnectDB };

const voyage = new VoyageAIClient({ apiKey: VOYAGE_API_KEY, environment: "https://ai.mongodb.com/v1" });

const EMBEDDING_MODEL = "voyage-4-lite";
export const NUM_RESULTS = 5;
export const NUM_CANDIDATES = 100;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface SearchResult {
  title: string;
  artist: string;
  genre_top: string;
  genres: string[];
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  queryVector: number[];
}

export async function searchSongs(query: string): Promise<SearchResponse> {
  // Embed the user's query by using Voyage AI.
  const embedResponse = await voyage.embed({
    model: EMBEDDING_MODEL,
    input: [query],
    inputType: "query",
  });

  const queryVector = embedResponse.data![0].embedding!;

  // Run $vectorSearch against the songs collection through the Mongoose model.
  // Model.aggregate() sends the pipeline to MongoDB unchanged (Mongoose does not
  // cast it), so ranking and scores match the native driver.
  const results = await SongModel.aggregate<SearchResult>([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: "embedding",
        queryVector,
        numCandidates: NUM_CANDIDATES,
        limit: NUM_RESULTS,
      },
    },
    {
      $project: {
        _id: 0,
        title: 1,
        artist: 1,
        genre_top: 1,
        genres: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return { results, queryVector };
}
