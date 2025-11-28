import { fetchSubtitles } from "./utils/fetcher";
import { parseVTT } from "./utils/parser";
import { startSubtitleSync } from "./utils/ui";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  main() {
    console.log("[WXT-DEBUG] Extension Loaded (Main Controller)");

    let currentVideoId: string | null = null;

    // --- THE MAIN FLOW ---
    const processVideo = async () => {
      // 1. Identification
      const urlParams = new URLSearchParams(location.search);
      const newVideoId = urlParams.get("v");
      const videoUrl = location.href;

      // Ensure we are on a video page and it's a new video
      if (
        location.pathname !== "/watch" ||
        !newVideoId ||
        newVideoId === currentVideoId
      ) {
        return;
      }

      console.log(`[WXT-DEBUG] New Video Detected: ${newVideoId}`);
      currentVideoId = newVideoId;

      // 2. Fetching (Using Downloader Util)
      const rawSubtitleText = await fetchSubtitles(newVideoId, videoUrl);

      if (!rawSubtitleText) {
        console.log("[WXT-DEBUG] No subtitles available or backend error.");
        return;
      }

      // 3. Parsing (Using Parser Util)
      const subtitles = parseVTT(rawSubtitleText);
      console.log(`[WXT-DEBUG] Parsed ${subtitles.length} lines.`);

      // 4. Rendering (Using UI Util)
      if (subtitles.length > 0) {
        startSubtitleSync(subtitles);
      }
    };

    // --- NAVIGATION HANDLERS ---

    // YouTube SPA Event
    document.addEventListener("yt-navigate-finish", () => {
      processVideo();
    });

    // Fallback Polling (Checks every 1s)
    setInterval(() => {
      const urlParams = new URLSearchParams(location.search);
      const vid = urlParams.get("v");
      if (vid && vid !== currentVideoId) {
        processVideo();
      }
    }, 1000);

    // Initial Load
    processVideo();
  },
});
