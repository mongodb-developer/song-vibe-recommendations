import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import type { RawTrack } from "./fetchTracks";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const BATCH_SIZE = 50;

export interface TrackWithVibe extends RawTrack {
  vibe_description: string;
}

function buildPrompt(tracks: RawTrack[]): string {
  const trackList = tracks
    .map(
      (t, i) =>
        `${i + 1}. Title: "${t.title}" | Artist: "${t.artist}" | Album: "${t.album}" | Genres: ${t.genres.join(", ")}`
    )
    .join("\n");

  return `For each track listed below, write a 2-3 sentence vibe description in third person. Focus on mood, energy, atmosphere, and ideal listening context. Avoid simply restating the genre — describe how it feels to listen to it. Return a JSON array of strings, one description per track, in the same order as the input. Return only the JSON array with no additional text. Tracks: ${trackList}`;
}

function parseResponse(text: string): string[] {
  // Extract the JSON array by finding the outermost [ ... ] bounds.
  // This handles cases where the model adds explanatory text before or after the JSON.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON array found in model response:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateVibeDescriptions(
  tracks: RawTrack[]
): Promise<TrackWithVibe[]> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env file.\n" +
      "Get a free key at: https://aistudio.google.com/apikey"
    );
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const results: TrackWithVibe[] = [];
  const totalBatches = Math.ceil(tracks.length / BATCH_SIZE);

  console.log(`\nGenerating vibe descriptions via Gemini (${totalBatches} batches)...`);

  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`  Batch ${batchNum}/${totalBatches}`);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(batch),
    });

    const descriptions = parseResponse(response.text ?? "");

    if (descriptions.length !== batch.length) {
      throw new Error(
        `Batch ${batchNum}: expected ${batch.length} descriptions, got ${descriptions.length}`
      );
    }

    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], vibe_description: descriptions[j] });
    }

  }

  console.log(`  ${results.length} vibe descriptions generated.`);
  return results;
}
