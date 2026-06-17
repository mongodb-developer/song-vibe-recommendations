/**
 * fetchTracks.ts
 *
 * Reads track metadata from the Free Music Archive (FMA) dataset.
 *
 * Dataset: https://github.com/mdeff/fma
 * License: CC BY 4.0 (metadata) - https://creativecommons.org/licenses/by/4.0/
 * Attribution: Defferrard et al., "FMA: A Dataset For Music Analysis", ISMIR 2017.
 *
 * Setup: Download fma_metadata.zip from:
 *   https://os.unil.cloud.switch.ch/fma/fma_metadata.zip
 * Unzip it and place the resulting fma_metadata/ folder at the root of this
 * project. Only tracks.csv and genres.csv are needed - no audio files required.
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const FMA_METADATA_DIR = path.resolve(process.cwd(), "fma_metadata");
const TRACKS_CSV = path.join(FMA_METADATA_DIR, "tracks.csv");
const GENRES_CSV = path.join(FMA_METADATA_DIR, "genres.csv");

const TARGET_TRACK_COUNT = 500;
const MIN_LISTENS = 1000;

export interface RawTrack {
  title: string;
  artist: string;
  album: string;
  fma_track_id: number;
  fma_url: string;
  play_count: number;
  genre_top: string;
  genres: string[];
}
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parses a Python list-literal genre ID string from tracks.csv.
 */
function parseGenreIds(raw: string): number[] {
  const cleaned = raw.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

async function loadGenreMap(): Promise<Map<number, string>> {
  const genreMap = new Map<number, string>();

  if (!fs.existsSync(GENRES_CSV)) {
    console.warn(
      "  WARNING: genres.csv not found - genre names cannot be resolved.\n" +
      "  Make sure fma_metadata/ contains both tracks.csv and genres.csv."
    );
    return genreMap;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(GENRES_CSV),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) continue;

    const parts = parseCSVLine(line);
    // parts[0] = genre_id, parts[1] = #tracks, parts[2] = parent, parts[3] = title
    const id = parseInt(parts[0]?.trim(), 10);
    const name = parts[3]?.trim();
    if (!isNaN(id) && name) {
      genreMap.set(id, name);
    }
  }

  return genreMap;
}

interface ColumnIndex {
  trackId: number;
  trackTitle: number;
  trackGenreTop: number;
  trackGenres: number;
  trackListens: number;
  artistName: number;
  albumTitle: number;
}

function resolveColumns(
  headerRow0: string[],
  headerRow1: string[]
): ColumnIndex {
  const find = (group: string, field: string): number => {
    for (let i = 1; i < headerRow0.length; i++) {
      if (
        headerRow0[i].trim().toLowerCase() === group.toLowerCase() &&
        headerRow1[i].trim().toLowerCase() === field.toLowerCase()
      ) {
        return i;
      }
    }
    console.warn(`  WARNING: could not find column [${group}][${field}] in tracks.csv header`);
    return -1;
  };

  const cols = {
    trackId: 0,
    trackTitle: find("track", "title"),
    trackGenreTop: find("track", "genre_top"),
    trackGenres: find("track", "genres"),
    trackListens: find("track", "listens"),
    artistName: find("artist", "name"),
    albumTitle: find("album", "title"),
  };

  console.log("\n  Resolved column indices:", cols);
  return cols;
}

function buildFmaUrl(trackId: number): string {
  return `https://freemusicarchive.org/track/${trackId}`;
}

export async function fetchAllTracks(): Promise<RawTrack[]> {
  if (!fs.existsSync(TRACKS_CSV)) {
    throw new Error(
      `tracks.csv not found at: ${TRACKS_CSV}\n\n` +
      `To fix this:\n` +
      `  1. Download fma_metadata.zip (~342MB) from:\n` +
      `     https://os.unil.cloud.switch.ch/fma/fma_metadata.zip\n` +
      `  2. Unzip it - this produces a fma_metadata/ folder\n` +
      `  3. Place fma_metadata/ in the root of this project\n` +
      `  4. Re-run: npm run seed\n\n` +
      `Note: Only tracks.csv and genres.csv are needed.\n` +
      `You do NOT need to download any audio files.`
    );
  }

  console.log("\nLoading FMA metadata...");

  // Step 1: build genre ID -> name map
  const genreMap = await loadGenreMap();

  if (genreMap.size === 0) {
    throw new Error(
      "Genre map is empty - genres.csv was not parsed correctly.\n" +
      "Check the column output above to diagnose the issue."
    );
  }

  // Step 2: parse tracks.csv
  console.log("\n  Parsing tracks.csv (this may take a few seconds)...");

  const rl = readline.createInterface({
    input: fs.createReadStream(TRACKS_CSV),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let headerRow0: string[] = [];
  let headerRow1: string[] = [];
  let cols!: ColumnIndex;
  const candidates: RawTrack[] = [];

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headerRow0 = parseCSVLine(line);
      continue;
    }
    if (lineNum === 2) {
      headerRow1 = parseCSVLine(line);
      cols = resolveColumns(headerRow0, headerRow1);

      // Bail early if core columns weren't found - no point parsing 100K rows
      if (cols.trackTitle === -1 || cols.artistName === -1 || cols.trackListens === -1) {
        throw new Error(
          "Failed to resolve required columns in tracks.csv.\n" +
          "Check the header output above - the column names may have changed.\n"
        );
      }
      continue;
    }

    const parts = parseCSVLine(line);

    const trackIdRaw = parts[cols.trackId]?.trim();
    const title = cols.trackTitle !== -1 ? parts[cols.trackTitle]?.trim() : "";
    const artistName = cols.artistName !== -1 ? parts[cols.artistName]?.trim() : "";
    const albumTitle = cols.albumTitle !== -1 ? parts[cols.albumTitle]?.trim() ?? "" : "";
    const genreTop = cols.trackGenreTop !== -1 ? parts[cols.trackGenreTop]?.trim() ?? "" : "";
    const genresRaw = cols.trackGenres !== -1 ? parts[cols.trackGenres]?.trim() ?? "" : "";
    const listensRaw = cols.trackListens !== -1 ? parts[cols.trackListens]?.trim() ?? "0" : "0";

    if (!trackIdRaw || !title || !artistName) continue;

    const trackId = parseInt(trackIdRaw, 10);
    if (isNaN(trackId)) continue;

    const listens = parseInt(listensRaw, 10);
    if (isNaN(listens) || listens < MIN_LISTENS) continue;

    // Resolve genre IDs -> genre names
    const genreIds = parseGenreIds(genresRaw);
    const resolvedGenres: string[] = genreIds
      .map((id) => genreMap.get(id))
      .filter((name): name is string => Boolean(name));

    // Fall back to genre_top if ID resolution yields nothing
    const genres =
      resolvedGenres.length > 0
        ? resolvedGenres
        : genreTop
        ? [genreTop]
        : [];

    if (genres.length === 0) continue;

    candidates.push({
      title,
      artist: artistName,
      album: albumTitle,
      fma_track_id: trackId,
      fma_url: buildFmaUrl(trackId),
      play_count: listens,
      genre_top: genreTop,
      genres,
    });
  }

  console.log(
    `\n  Found ${candidates.length} tracks passing filters ` +
    `(min ${MIN_LISTENS} listens, has genre).`
  );

  candidates.sort((a, b) => b.play_count - a.play_count);
  const selected = candidates.slice(0, TARGET_TRACK_COUNT);

  console.log(`Selected top ${selected.length} tracks by listen count.`);

  // Log genre distribution
  const genreCounts = new Map<string, number>();
  for (const track of selected) {
    const g = track.genre_top || "Unknown";
    genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  console.log("\n  Genre distribution of selected tracks (top 8):");
  for (const [genre, count] of topGenres) {
    console.log(`    ${genre.padEnd(22)} ${count} tracks`);
  }

  return selected;
}