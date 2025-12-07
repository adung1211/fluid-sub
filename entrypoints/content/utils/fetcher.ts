import { browser } from "wxt/browser";
import { Subtitle } from "../interfaces/Subtitle";

// Define the new unified shape for our tokens
export interface TokenData {
  word: string;
  category: "word" | "unknown" | "norank" | "norank_name";
  root: string;
  cefr: string;
  timestamps: number[];
}

/**
 * Helper to nicely print the vocabulary list to the console for debugging
 */
function printTopWords(words: TokenData[]) {
  // ... (keeping existing logging logic unchanged) ...
  console.groupCollapsed(
    `[WXT-DEBUG] 📊 Vocabulary List (${words.length} items)`
  );
  console.log("Raw Data:", words);
  console.groupEnd();
}

/**
 * Fetches parsed subtitles and their difficulty ranking.
 * Manages 'status' in storage so Popup can react in real-time.
 */
export async function fetchSubtitles(
  videoId: string,
  videoUrl: string
): Promise<Subtitle[] | null> {
  const subCacheKey = `subs_parsed_${videoId}`;
  const rankCacheKey = `vocab_ranked_${videoId}`;
  const statusKey = `vocab_status_${videoId}`; // New Status Key

  // 1. Set Initial Loading State
  // We check if we already have data to avoid flickering 'loading' if cache exists
  const cachedData = await browser.storage.local.get([
    subCacheKey,
    rankCacheKey,
    statusKey,
  ]);

  if (cachedData[subCacheKey] && cachedData[rankCacheKey]) {
    console.log(`[WXT-DEBUG] Cache Hit for ${videoId}`);
    // Ensure status is success if data exists
    if (cachedData[statusKey] !== "success") {
      await browser.storage.local.set({ [statusKey]: "success" });
    }
    return cachedData[subCacheKey] as Subtitle[];
  }

  // Not in cache, start loading process
  console.log(`[WXT-DEBUG] Cache Miss. Fetching from Python...`);
  await browser.storage.local.set({ [statusKey]: "loading" });

  try {
    // 2. Fetch Subtitles from Python Backend
    const subResponse = await browser.runtime.sendMessage({
      type: "FETCH_FROM_PYTHON",
      videoUrl: videoUrl,
    });

    if (!subResponse || !subResponse.success) {
      const errorMsg = subResponse?.error || "Unknown Error";
      console.log(`[WXT-DEBUG] Backend Error: ${errorMsg}`);

      // Update status to specific error or generic error
      if (errorMsg.includes("No subtitles found")) {
        await browser.storage.local.set({ [statusKey]: "not_found" });
      } else {
        await browser.storage.local.set({ [statusKey]: "error" });
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
      // printTopWords(masterList);

      // Save data AND status 'success' atomically-ish
      await browser.storage.local.set({
        [rankCacheKey]: masterList,
        [statusKey]: "success",
      });
    } else {
      console.warn("[WXT-DEBUG] Ranking Failed:", rankResponse?.error);
      // We have subs but no ranking, treating as partial success or error?
      // Let's treat as error for the UI highlights
      await browser.storage.local.set({ [statusKey]: "error" });
    }

    return subtitles;
  } catch (err) {
    console.error("[WXT-DEBUG] Network Error:", err);
    await browser.storage.local.set({ [statusKey]: "error" });
    return null;
  }
}
