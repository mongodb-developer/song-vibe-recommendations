# Song Vibe Search

A Node.js app that uses MongoDB Vector Search to recommend songs based on a mood or feeling you describe. Type something like "rainy afternoon drive" or "high energy workout" and the app returns tracks whose vibe matches.

Each song in the database has an AI-generated description of how it feels to listen to — that description is embedded with Voyage AI and stored as a vector. At search time, your query is embedded the same way and compared against every track using cosine similarity.

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (free M0 works)
- A Voyage AI API key (See how to get started with Voyage AI [here](https://www.mongodb.com/products/platform/ai-search-and-retrieval/getting-started))

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```
MONGODB_URI=your_atlas_connection_string
VOYAGE_API_KEY=your_voyage_api_key
```

### 3. Seed the database

There are two ways to seed depending on whether you want to use the pre-built dataset or generate your own from scratch.

---

**Option A — Pre-built dataset (recommended)**

The repo includes a pre-built dataset at `seed/data/songs.json` with 500 tracks, pre-generated vibe descriptions, and embeddings ready to import. Just run:

```bash
npm run seed
```

The script detects the file and loads it directly. No Gemini or Voyage AI keys are needed for this path.

---

**Option B — Full pipeline**

Regenerates the dataset from the raw FMA music metadata, using Gemini to write vibe descriptions and Voyage AI to generate embeddings. Choose this if you want to understand how the dataset was built, modify the prompt, or change the track selection criteria.

You'll have two additional requirements:

- A Gemini API key (free tier works): https://aistudio.google.com/apikey
- The FMA metadata CSV files — see [`seed/fetchTracks.ts`](seed/fetchTracks.ts) for download instructions

Add to `.env`:

```
GEMINI_API_KEY=your_gemini_api_key
```

Remove `seed/data/songs.json`, then run:

```bash
npm run seed
```

The script will prompt for confirmation before making any paid API calls.

---

### 4. Run the app

```bash
npm run dev
```

Open http://localhost:3000.
