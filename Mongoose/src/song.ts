import dotenv from "dotenv";
import path from "path";
import mongoose, { Schema, InferSchemaType } from "mongoose";

// Load the .env file from the Mongoose/ folder, regardless of where the script is run from.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI in environment. Ensure that you have created a .env file and added your connection string."
  );
}

export const DB_NAME = process.env.MONGODB_DATABASE ?? "song_vibe_search";
export const COLLECTION_NAME = "songs";
export const VECTOR_INDEX = "vibe_vector_index";

// ---------------------------------------------------------------------------
// Schema and model
// Mirrors every field written by the seed pipeline (RawTrack + vibe_description,
// embedding, and seeded_at).
// ---------------------------------------------------------------------------
const songSchema = new Schema(
  {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String, default: "" },
    fma_track_id: { type: Number, required: true },
    fma_url: { type: String, required: true },
    play_count: { type: Number, required: true },
    genre_top: { type: String, default: "" },
    genres: { type: [String], default: [] },
    vibe_description: { type: String, required: true },
    embedding: { type: [Number], required: true }, // 512 dimensions (voyage-3-lite)
    seeded_at: { type: Date, default: Date.now },
  },
  {
    collection: COLLECTION_NAME, // use the existing "songs" collection as-is
    versionKey: false, // the seed script does not write __v
  }
);

export type Song = InferSchemaType<typeof songSchema>;

// Reuse the model if it is already registered (avoids OverwriteModelError on reload).
export const SongModel =
  mongoose.models.Song ?? mongoose.model("Song", songSchema);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
export async function connectDB(appName = "devrel-tutorial-javascript-music-recommender"): Promise<void> {
  await mongoose.connect(MONGODB_URI!, {
    dbName: DB_NAME,
    appName,
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

