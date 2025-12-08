// entrypoints/background.ts
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

    // --- NEW: Translation Handler ---
    if (message.type === "TRANSLATE_TEXT") {
      // Using the free 'gtx' endpoint for Google Translate
      // sl=auto (source auto), tl=vi (target vietnamese), dt=t (return translation)
      const text = message.text;
      const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(
        text
      )}`;

      fetch(apiUrl)
        .then((res) => res.json())
        .then((data) => {
          // Response structure: [[["Translated Text", "Source Text", ...], ...], ...]
          const translation =
            data && data[0] && data[0][0] && data[0][0][0]
              ? data[0][0][0]
              : null;

          sendResponse({ success: true, translation });
        })
        .catch((err) => {
          console.error("[WXT-DEBUG] Translation Failed:", err);
          sendResponse({ success: false, error: err.message });
        });

      return true; // Keep channel open
    }
  });
});
