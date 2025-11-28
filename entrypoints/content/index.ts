import { fetchSubtitles } from "./utils/fetcher";
import {
  startSubtitleSync,
  cleanupSubtitleSync,
} from "./utils/subtitle-overlay";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  main() {
    console.log("[WXT-DEBUG] Extension Loaded (Main Controller)");

    let currentVideoId: string | null = null;

    const processVideo = async () => {
      const urlParams = new URLSearchParams(location.search);
      const newVideoId = urlParams.get("v");
      const videoUrl = location.href;

      if (
        location.pathname !== "/watch" ||
        !newVideoId ||
        newVideoId === currentVideoId
      ) {
        return;
      }

      console.log(`[WXT-DEBUG] New Video Detected: ${newVideoId}`);
      currentVideoId = newVideoId;

      // --- CRITICAL FIX START ---
      // Stop doing anything related to the previous video immediately
      cleanupSubtitleSync();
      // --- CRITICAL FIX END ---

      // 1. Fetching (Returns Parsed JSON now)
      const subtitles = await fetchSubtitles(newVideoId, videoUrl);

      if (!subtitles || subtitles.length === 0) {
        console.log("[WXT-DEBUG] No subtitles available.");
        // We already cleaned up, so we just return here.
        // The extension is now "doing absolutely nothing".
        return;
      }

      console.log(`[WXT-DEBUG] Loaded ${subtitles.length} lines from backend.`);

      // 2. Rendering
      startSubtitleSync(subtitles);
    };

    document.addEventListener("yt-navigate-finish", () => {
      processVideo();
    });

    setInterval(() => {
      const urlParams = new URLSearchParams(location.search);
      const vid = urlParams.get("v");
      if (vid && vid !== currentVideoId) {
        processVideo();
      }
    }, 1000);

    processVideo();
  },
});
