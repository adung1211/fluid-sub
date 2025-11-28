import { browser } from "wxt/browser";

export default defineBackground(() => {
  console.log("[WXT-DEBUG] Background Proxy Ready.");

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_FROM_PYTHON") {
      const apiUrl = `http://127.0.0.1:8000/get-subtitles?video_url=${encodeURIComponent(
        message.videoUrl
      )}`;

      console.log("[WXT-DEBUG] Background calling Python:", apiUrl);

      fetch(apiUrl)
        .then((res) => res.json())
        .then((data) => {
          console.log("[WXT-DEBUG] Python responded:", data);
          sendResponse(data);
        })
        .catch((err) => {
          console.error(
            "[WXT-DEBUG] Connection Failed. Is Python running?",
            err
          );
          sendResponse({
            success: false,
            error: "Cannot connect to Python backend",
          });
        });

      return true; // Keep channel open
    }
  });
});
