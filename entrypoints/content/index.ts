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
  showFloatingErrorMessage,
} from "./utils/floating-window";

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  main() {
    console.log("[WXT-DEBUG] Main Controller Loaded");

    let currentVideoId: string | null = null;

    initFloatingWindow();

    const processVideo = async () => {
      const urlParams = new URLSearchParams(location.search);
      const newVideoId = urlParams.get("v");
      const videoUrl = location.href;

      if (location.pathname !== "/watch" || !newVideoId) {
        if (currentVideoId) {
          console.log("[WXT-DEBUG] Left video, clearing window.");
          currentVideoId = null;
          cleanupSubtitleSync();
          clearFloatingWindow();
          await setFloatingWindowLoading(false);
        }
        return;
      }

      if (newVideoId === currentVideoId) {
        return;
      }

      currentVideoId = newVideoId;
      cleanupSubtitleSync();
      clearFloatingWindow();
      await setFloatingWindowLoading(true);

      const subtitles = await fetchSubtitles(newVideoId, videoUrl);

      await setFloatingWindowLoading(false);

      if (!subtitles || subtitles.length === 0) {
        // Trigger notification in floating window
        await showFloatingErrorMessage(
          "No English subtitle found for this video"
        );
        return;
      }

      startSubtitleSync(subtitles);
    };

    document.addEventListener("yt-navigate-finish", () => {
      processVideo();
    });

    setInterval(() => {
      const urlParams = new URLSearchParams(location.search);
      const vid = urlParams.get("v");
      if (vid !== currentVideoId) {
        processVideo();
      }
    }, 1000);

    processVideo();
  },
});
