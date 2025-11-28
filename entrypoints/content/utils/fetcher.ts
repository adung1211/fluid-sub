import { browser } from "wxt/browser";

/**
 * Fetches subtitles for a given video ID.
 * 1. Checks Local Storage Cache.
 * 2. If missing, asks the Background Script to fetch from Python.
 * 3. Saves result to Cache.
 */
export async function fetchSubtitles(
  videoId: string,
  videoUrl: string
): Promise<string | null> {
  const cacheKey = `subs_${videoId}`;

  // 1. Try Cache
  const cachedData = await browser.storage.local.get(cacheKey);
  if (cachedData[cacheKey]) {
    console.log(`[WXT-DEBUG] Cache Hit for ${videoId}`);
    return cachedData[cacheKey];
  }

  // 2. Fetch from Python Backend (via Background Script)
  console.log(`[WXT-DEBUG] Cache Miss. Fetching from Python...`);
  try {
    const response = await browser.runtime.sendMessage({
      type: "FETCH_FROM_PYTHON",
      videoUrl: videoUrl,
    });

    if (!response || !response.success) {
      console.error(`[WXT-DEBUG] Backend Error: ${response?.error}`);
      return null;
    }

    // 3. Save to Cache
    await browser.storage.local.set({ [cacheKey]: response.subtitles });
    return response.subtitles;
  } catch (err) {
    console.error("[WXT-DEBUG] Network Error:", err);
    return null;
  }
}
