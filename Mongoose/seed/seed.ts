import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { SongModel, Song, VECTOR_INDEX, DB_NAME, COLLECTION_NAME, connectDB, disconnectDB } from "../src/song";

// Pre-built dataset (500 songs with vibe descriptions and Voyage AI embeddings).
const DATA_FILE = path.resolve(__dirname, "data/songs.json");

async function createVectorSearchIndex(): Promise<void> {
  console.log("\nCreating Vector Search index...");

  try {
    await SongModel.createSearchIndex({
      name: VECTOR_INDEX,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: 512,
            similarity: "cosine",
          },
        ],
      },
    });
    console.log(`  Index "${VECTOR_INDEX}" created. It may take a moment to become active.`);
  } catch (err: any) {
    if (err?.message?.includes("already exists")) {
      console.log(`  Index "${VECTOR_INDEX}" already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

async function main(): Promise<void> {
  console.log("=== Song Vibe Search - Seeding Pipeline (Mongoose) ===\n");
  console.log(`Target database  : ${DB_NAME}`);
  console.log(`Target collection: ${COLLECTION_NAME}`);

  try {
    console.log("\nConnecting to MongoDB...");
    await connectDB("devrel-github-javascript-music-recommender-seed");
    console.log("Connected.");

    // Make sure the collection exists before creating the search index on it.
    await SongModel.createCollection();

    const existingCount = await SongModel.countDocuments();

    if (existingCount > 0) {
      console.log(`\nCollection already contains ${existingCount} documents — skipping insert.`);
    } else {
      console.log(`\nLoading pre-built dataset from ${DATA_FILE}...`);
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as (Omit<Song, "seeded_at"> & {
        _id?: { $oid: string };
      })[];

      // songs.json is an Extended JSON export, so _id is { "$oid": "..." }. Convert it to a real ObjectId.
      const documents = raw.map(({ _id, ...doc }) => ({
        ...doc,
        ...(_id?.$oid ? { _id: new mongoose.Types.ObjectId(_id.$oid) } : {}),
        seeded_at: new Date(),
      }));

      console.log(`Inserting ${documents.length} documents into MongoDB...`);
      await SongModel.insertMany(documents);
      console.log("  Done.");
    }

    // Always runs — safe to call when the index already exists.
    await createVectorSearchIndex();

    const finalCount = await SongModel.countDocuments();
    console.log(`\n=== Seeding complete ===`);
    console.log(`Documents in '${COLLECTION_NAME}': ${finalCount}`);
  } catch (err) {
    console.error("\nSeeding failed:", err);
    process.exit(1);
  } finally {
    await disconnectDB();
    console.log("\nMongoDB connection closed.");
  }
}

main();
