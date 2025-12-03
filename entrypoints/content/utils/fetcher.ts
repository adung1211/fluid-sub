import { browser } from "wxt/browser";
import { Subtitle } from "../interfaces/Subtitle";

// Define the new unified shape for our tokens
export interface TokenData {
  word: string;
  category: "word" | "unknown";
  difficulty_score: number;
  root: string;
  cefr: string;
  count: number;
  timestamps: number[];
}

/**
 * Helper to format seconds into MM:SS
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Helper to nicely print the vocabulary list to the console for debugging
 */
function printTopWords(words: TokenData[]) {
  const fullList = words.map((w) => ({
    Word: w.word,
    Category: w.category,
    Score: w.difficulty_score,
    Root: w.root,
    "First 3 Times":
      w.timestamps.slice(0, 3).map(formatTime).join(", ") +
      (w.timestamps.length > 3 ? "..." : ""),
  }));

  console.groupCollapsed(
    `[WXT-DEBUG] 📊 Vocabulary List (${words.length} items) - Click to expand`
  );
  console.table(fullList);
  console.groupEnd();
}

/**
 * Fetches parsed subtitles and their difficulty ranking.
 */
export async function fetchSubtitles(
  videoId: string,
  videoUrl: string
): Promise<Subtitle[] | null> {
  const subCacheKey = `subs_parsed_${videoId}`;
  const rankCacheKey = `vocab_ranked_${videoId}`;

  // 1. Try Cache
  const cachedData = await browser.storage.local.get([
    subCacheKey,
    rankCacheKey,
  ]);

  if (cachedData[subCacheKey]) {
    console.log(`[WXT-DEBUG] Cache Hit for ${videoId}`);

    if (cachedData[rankCacheKey]) {
      console.log("[WXT-DEBUG] Loaded cached vocabulary ranking.");
      printTopWords(cachedData[rankCacheKey] as TokenData[]);
    }

    return cachedData[subCacheKey] as Subtitle[];
  }

  // 2. Fetch Subtitles from Python Backend
  console.log(`[WXT-DEBUG] Cache Miss. Fetching from Python...`);
  try {
    const subResponse = await browser.runtime.sendMessage({
      type: "FETCH_FROM_PYTHON",
      videoUrl: videoUrl,
    });

    if (!subResponse || !subResponse.success) {
      const errorMsg = subResponse?.error || "Unknown Error";
      if (errorMsg.includes("No subtitles found")) {
        console.log(`[WXT-DEBUG] Info: ${errorMsg} (Skipping video)`);
      } else {
        console.error(`[WXT-DEBUG] Backend Error: ${errorMsg}`);
      }
      return null;
    }

    const subtitles = subResponse.subtitles as Subtitle[];

    // 3. Save Subtitles to Cache
    await browser.storage.local.set({ [subCacheKey]: subtitles });

    // 4. Call Ranker Service
    console.log("[WXT-DEBUG] Fetching Vocabulary Ranking...");
    const rankResponse = await browser.runtime.sendMessage({
      type: "RANK_VOCABULARY",
      subtitles: subtitles,
    });

    if (rankResponse && rankResponse.success) {
      const masterList = rankResponse.data as TokenData[];

      console.log(`[WXT-DEBUG] Received ${masterList.length} tokens.`);
      printTopWords(masterList);

      await browser.storage.local.set({ [rankCacheKey]: masterList });
    } else {
      console.warn("[WXT-DEBUG] Ranking Failed:", rankResponse?.error);
    }

    return subtitles;
  } catch (err) {
    console.error("[WXT-DEBUG] Network Error:", err);
    return null;
  }
}
