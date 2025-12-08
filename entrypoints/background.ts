import { browser } from "wxt/browser";

export default defineBackground(() => {
  console.log("[WXT-DEBUG] Background Proxy Ready.");

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // --- Existing GET Handler ---
    if (message.type === "FETCH_FROM_PYTHON") {
      const apiUrl = `http://127.0.0.1:8000/get-subtitles?video_url=${encodeURIComponent(
        message.videoUrl
      )}`;

      console.log("[WXT-DEBUG] Background calling Python (GET):", apiUrl);

      fetch(apiUrl)
        .then((res) => res.json())
        .then((data) => {
          console.log("[WXT-DEBUG] Python responded:", data);
          sendResponse(data);
        })
        .catch((err) => {
          console.error("[WXT-DEBUG] GET Failed:", err);
          sendResponse({
            success: false,
            error: "Cannot connect to Python backend",
          });
        });

      return true; // Keep channel open
    }

    // --- Existing POST Handler for Ranking ---
    if (message.type === "RANK_VOCABULARY") {
      const apiUrl = "http://127.0.0.1:8000/rank-vocabulary";

      console.log("[WXT-DEBUG] Background calling Python (POST):", apiUrl);

      fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subtitles: message.subtitles }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("[WXT-DEBUG] Ranker responded:", data);
          sendResponse(data);
        })
        .catch((err) => {
          console.error("[WXT-DEBUG] POST Failed:", err);
          sendResponse({
            success: false,
            error: "Cannot connect to Ranker backend",
          });
        });

      return true; // Keep channel open
    }

    // --- NEW: Batch Translation Handler ---
    if (message.type === "TRANSLATE_BATCH") {
      const texts = message.texts as string[];
      if (!texts || texts.length === 0) {
        sendResponse({ success: true, data: {} });
        return true;
      }

      // 1. Chunking to avoid hitting API payload limits
      // 75 words per request is usually safe for the free endpoint URL length
      const CHUNK_SIZE = 75;
      const chunks: string[][] = [];
      for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        chunks.push(texts.slice(i, i + CHUNK_SIZE));
      }

      const translateChunk = async (chunk: string[]) => {
        // Join words with newline. The API treats newlines as segment breaks.
        const q = chunk.join("\n");
        const apiUrl =
          "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t";

        // Use POST with URLSearchParams for efficient large body sending
        const body = new URLSearchParams();
        body.append("q", q);

        try {
          const res = await fetch(apiUrl, {
            method: "POST",
            body: body,
            // 'gtx' endpoint accepts form-urlencoded
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          // data[0] contains the segments: [[translated, source, ...], ...]
          // We assume the order matches because we sent them joined by \n
          return data[0].map((item: any) => item[0]);
        } catch (e) {
          console.error("Chunk translation error:", e);
          // Return nulls for this chunk so indices align (or handle partially)
          return chunk.map(() => null);
        }
      };

      // 2. Process chunks
      Promise.all(chunks.map(translateChunk))
        .then((results) => {
          const flatResults = results.flat();

          // 3. Map back to original words
          const translationMap: Record<string, string> = {};
          texts.forEach((word, index) => {
            if (flatResults[index]) {
              // Trim to remove any accidental newlines returned by API
              translationMap[word] = flatResults[index].trim();
            }
          });

          sendResponse({ success: true, data: translationMap });
        })
        .catch((err) => {
          console.error("Batch translate fatal error:", err);
          sendResponse({ success: false, error: err.message });
        });

      return true;
    }
  });
});
