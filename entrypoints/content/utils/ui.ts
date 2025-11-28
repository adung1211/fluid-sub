import { Subtitle } from "./parser";

/**
 * Starts the subtitle sync loop.
 * Creates an overlay on the video player and updates text based on video time.
 */
export function startSubtitleSync(subtitles: Subtitle[]) {
  console.log("[WXT-DEBUG] Initializing Subtitle UI...");

  // Target the main YouTube video specifically.
  const video = (document.querySelector("video.html5-main-video") ||
    document.querySelector("video")) as HTMLVideoElement;

  if (!video) {
    console.error("[WXT-DEBUG] No video element found. UI Sync aborted.");
    return;
  }

  // DEBUG: Log the full first subtitle to verify the Parser Fix (end time should NOT be 0)
  if (subtitles.length > 0) {
    console.log(
      `[WXT-DEBUG] Ready to sync. First subtitle details:`,
      JSON.stringify(subtitles[0])
    );
  }

  const overlay = createOverlay();

  // Clear any existing text
  overlay.innerHTML = "";
  overlay.style.display = "none";

  // Clean up old listeners
  if ((video as any).__wxt_sync_listener) {
    video.removeEventListener("timeupdate", (video as any).__wxt_sync_listener);
  }

  // Sync Logic
  let lastIndex = -1;
  let lastSecondLogged = -1;

  const onTimeUpdate = () => {
    const currentTime = video.currentTime;

    // DEBUG HEARTBEAT
    const currentSecond = Math.floor(currentTime);
    if (currentSecond !== lastSecondLogged) {
      lastSecondLogged = currentSecond;
      // Check if overlay is still attached
      if (!document.getElementById("wxt-subtitle-layer")) {
        console.warn(
          "[WXT-DEBUG] Warning: Overlay element disappeared from DOM!"
        );
      }
    }

    // Optimization: Check if we are still inside the last found subtitle
    if (lastIndex !== -1) {
      const currentSub = subtitles[lastIndex];
      // We can now trust currentSub.end because the parser is fixed
      if (
        currentSub &&
        currentTime >= currentSub.start &&
        currentTime <= currentSub.end
      ) {
        return;
      }
    }

    // Search for the active subtitle
    const foundIndex = subtitles.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );

    if (foundIndex !== -1) {
      lastIndex = foundIndex;
      const sub = subtitles[foundIndex];

      const htmlText = sub.text.replace(/\n/g, "<br>");

      if (overlay.innerHTML !== htmlText) {
        console.log(`[WXT-DEBUG] UI Showing: "${sub.text}"`);
        overlay.innerHTML = htmlText;
        overlay.style.display = "block";
      }
    } else {
      // No subtitle active
      if (lastIndex !== -1) {
        console.log(`[WXT-DEBUG] UI Clearing`);
        lastIndex = -1;
        overlay.style.display = "none";
        overlay.innerHTML = "";
      }
    }
  };

  video.addEventListener("timeupdate", onTimeUpdate);
  (video as any).__wxt_sync_listener = onTimeUpdate;

  console.log(`[WXT-DEBUG] UI Sync Active. Overlay attached to player.`);
}

/**
 * Creates a minimalist, high-visibility overlay element.
 * Attaches to #movie_player to support Fullscreen mode.
 */
function createOverlay(): HTMLElement {
  const id = "wxt-subtitle-layer";
  let overlay = document.getElementById(id);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = id;

    Object.assign(overlay.style, {
      position: "absolute",
      bottom: "10%",
      left: "50%",
      transform: "translateX(-50%)",
      color: "#FFFFFF",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      fontSize: "16px",
      fontWeight: "600",
      textAlign: "center",
      lineHeight: "1.4",
      textShadow: "0px 2px 4px rgba(0,0,0,0.9)",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: "8px",
      padding: "8px 16px",
      pointerEvents: "none",
      userSelect: "none",
      zIndex: "2147483647",
      width: "auto",
      maxWidth: "90%",
      display: "none",
    });

    const player = document.getElementById("movie_player") || document.body;
    player.appendChild(overlay);
  }

  return overlay;
}
