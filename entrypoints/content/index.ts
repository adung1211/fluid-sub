// entrypoints/content/index.ts
import { fetchSubtitles } from "./utils/fetcher";
import {
  startSubtitleSync,
  cleanupSubtitleSync,
} from "./utils/subtitle-overlay";
import {
  initFloatingWindow,
  setFloatingWindowLoading,
  clearFloatingWindow,
} from "./utils/floating-window";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  main() {
    console.log("[WXT-DEBUG] Main Controller Loaded");

    let currentVideoId: string | null = null;

    // Ensure floating window is created on load (empty)
    initFloatingWindow();

    const processVideo = async () => {
      const urlParams = new URLSearchParams(location.search);
      const newVideoId = urlParams.get("v");
      const videoUrl = location.href;

      // Detect if we navigated AWAY from a video (e.g. to Home)
      if (location.pathname !== "/watch" || !newVideoId) {
        if (currentVideoId) {
          console.log("[WXT-DEBUG] Left video, clearing window.");
          currentVideoId = null;
          cleanupSubtitleSync();
          clearFloatingWindow(); // Clear content but keep window
          setFloatingWindowLoading(false);
        }
        return;
      }

      // If same video, ignore
      if (newVideoId === currentVideoId) {
        return;
      }

      // New Video Detected
      currentVideoId = newVideoId;
      cleanupSubtitleSync();
      clearFloatingWindow(); // Clear old video words
      setFloatingWindowLoading(true); // Start Loading Spinner

      const subtitles = await fetchSubtitles(newVideoId, videoUrl);

      setFloatingWindowLoading(false); // Stop Spinner

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
      // Check if we switched videos OR if we left the watch page (vid is null)
      if (vid !== currentVideoId) {
        processVideo();
      }
    }, 1000);

    processVideo();
  },
});
