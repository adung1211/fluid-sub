// entrypoints/content/index.ts
import { fetchSubtitles } from "./utils/fetcher";
import {
  startSubtitleSync,
  cleanupSubtitleSync,
} from "./utils/subtitle-overlay";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  main() {
    console.log("[WXT-DEBUG] Main Controller Loaded");

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

      currentVideoId = newVideoId;
      cleanupSubtitleSync(); // Clear previous video state

      const subtitles = await fetchSubtitles(newVideoId, videoUrl);

      if (!subtitles || subtitles.length === 0) {
        return;
      }

      startSubtitleSync(subtitles);
    };

    document.addEventListener("yt-navigate-finish", () => {
      processVideo();
    });

    // Fallback polling for SPA navigation
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
