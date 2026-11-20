import "dotenv/config";
import express from "express";
import path from "path";
import { connectDB, disconnectDB, searchSongs } from "./search";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
// Serve the front end from the public/ folder.
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

  res.json({ results });
});

async function startServer() {
  await connectDB();
  console.log("Connected to MongoDB Atlas.");

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  process.on("SIGINT", async () => {
    await disconnectDB();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await disconnectDB();
    process.exit(0);
  });
}

startServer();
