import "dotenv/config";
import { MongoClient } from "mongodb";
import { VoyageAIClient } from "voyageai";

const MONGODB_URI = process.env.MONGODB_URI;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI in environment. Ensure that you have created a .env file and added your connection string."
  );
}

if (!VOYAGE_API_KEY) {
  throw new Error(
    "Missing VOYAGE_API_KEY in environment. Ensure that you have created a .env file and added your Voyage AI key."
  );
}

export const client = new MongoClient(MONGODB_URI, {
  appName: "devrel-github-javascript-music-recommender",
});

const voyage = new VoyageAIClient({ apiKey: VOYAGE_API_KEY, environment: "https://ai.mongodb.com/v1" });

const DB_NAME = process.env.MONGODB_DATABASE ?? "song_vibe_search";
const COLLECTION_NAME = "songs";
export const VECTOR_INDEX = "vibe_vector_index";
const EMBEDDING_MODEL = "voyage-4-lite";
export const NUM_RESULTS = 5;
export const NUM_CANDIDATES = 100;

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

  // Run $vectorSearch against the songs collection.
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  const results = await collection
    .aggregate<SearchResult>([
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
    ])
    .toArray();

  return { results, queryVector };
}
