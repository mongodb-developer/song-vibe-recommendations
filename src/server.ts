import "dotenv/config";
import express from "express";
import path from "path";
import { client, searchSongs, VECTOR_INDEX, NUM_RESULTS, NUM_CANDIDATES } from "./search";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/search", async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== "string" || query.trim() === "") {
    res.status(400).json({ error: "A search query is required." });
    return;
  }

  let results, queryVector;
  try {
    ({ results, queryVector } = await searchSongs(query.trim()));
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).json({ error: "Search failed. Please try again." });
    return;
  }

  console.log(`\nSearch: "${query.trim()}"`);
  console.log(`Results (${results.length}):`);
  results.forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.title} — ${r.artist} (score: ${r.score.toFixed(3)})`)
  );

  res.json({
    results,
    meta: {
      query: query.trim(),
      embeddingDimensions: queryVector.length,
      embeddingPreview: queryVector.slice(0, 6),
      pipeline: [
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: "embedding",
            queryVector: `[${queryVector.slice(0, 3).map(v => v.toFixed(4)).join(", ")}, ...${queryVector.length - 3} more]`,
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
      ],
    },
  });
});

async function startServer() {
  await client.connect();
  console.log("Connected to MongoDB Atlas.");

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  process.on("SIGINT", async () => {
    await client.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await client.close();
    process.exit(0);
  });
}

startServer();
