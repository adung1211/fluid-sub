import { browser } from "wxt/browser";
import { Subtitle } from "../interfaces/Subtitle";

/**
 * Fetches parsed subtitles for a given video ID.
 * Returns the Array of Subtitle objects directly from the backend/cache.
 */
export async function fetchSubtitles(
  videoId: string,
  videoUrl: string
): Promise<Subtitle[] | null> {
  const cacheKey = `subs_parsed_${videoId}`;

  // 1. Try Cache
  const cachedData = await browser.storage.local.get(cacheKey);
  if (cachedData[cacheKey]) {
    console.log(`[WXT-DEBUG] Cache Hit for ${videoId}`);
    return cachedData[cacheKey] as Subtitle[];
  }

  // 2. Fetch from Python Backend
  console.log(`[WXT-DEBUG] Cache Miss. Fetching from Python...`);
  try {
    const response = await browser.runtime.sendMessage({
      type: "FETCH_FROM_PYTHON",
      videoUrl: videoUrl,
    });

    if (!response || !response.success) {
      const errorMsg = response?.error || "Unknown Error";

      // If it's just "No subtitles", treat it as Info (Yellow/White), not Error (Red)
      if (errorMsg.includes("No subtitles found")) {
        console.log(`[WXT-DEBUG] Info: ${errorMsg} (Skipping video)`);
      } else {
        // Only log REAL errors (like 429 or connection fails) as errors
        console.error(`[WXT-DEBUG] Backend Error: ${errorMsg}`);
      }
      return null;
    }

    // response.subtitles is now an Array of objects, not a string
    const subtitles = response.subtitles as Subtitle[];

    // 3. Save to Cache
    await browser.storage.local.set({ [cacheKey]: subtitles });
    return subtitles;
  } catch (err) {
    console.error("[WXT-DEBUG] Network Error:", err);
    return null;
  }
}
