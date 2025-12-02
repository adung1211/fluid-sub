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

    // --- New POST Handler for Ranking ---
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
  });
});