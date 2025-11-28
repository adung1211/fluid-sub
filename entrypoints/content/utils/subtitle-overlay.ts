import { Subtitle } from "../interfaces/Subtitle";

/**
 * Removes the sync listener and clears the overlay.
 * Call this when switching videos or when no subtitles are available.
 */
export function cleanupSubtitleSync() {
  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;

  // Remove the listener if it exists
  if (video && (video as any).__wxt_sync_listener) {
    video.removeEventListener("timeupdate", (video as any).__wxt_sync_listener);
    delete (video as any).__wxt_sync_listener;
    console.log("[WXT-DEBUG] Previous sync listener removed.");
  }

  // Clear the overlay content and hide it
  const overlay = document.getElementById("wxt-subtitle-layer");
  if (overlay) {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }
}

/**
 * Starts the subtitle sync loop.
 * Creates an overlay on the video player and updates text based on video time.
 */
export function startSubtitleSync(subtitles: Subtitle[]) {
  console.log("[WXT-DEBUG] Initializing Subtitle UI...");

  // 1. CLEANUP FIRST
  cleanupSubtitleSync();

  const video = (document.querySelector("video.html5-main-video") ||
    document.querySelector("video")) as HTMLVideoElement;

  if (!video) {
    console.error("[WXT-DEBUG] No video element found. UI Sync aborted.");
    return;
  }

  // Initialize Overlay (Safe to call multiple times, it reuses the element)
  const overlay = createOverlay();

  // Sync Logic variables
  let lastIndex = -1;
  let lastSecondLogged = -1;

  const onTimeUpdate = () => {
    const currentTime = video.currentTime;

    // DEBUG HEARTBEAT (Optional logging)
    const currentSecond = Math.floor(currentTime);
    if (currentSecond !== lastSecondLogged) {
      lastSecondLogged = currentSecond;
      if (!document.getElementById("wxt-subtitle-layer")) {
        console.warn("[WXT-DEBUG] Warning: Overlay element disappeared!");
      }
    }

    // Optimization: Check if still inside the current subtitle
    if (lastIndex !== -1) {
      const currentSub = subtitles[lastIndex];
      if (
        currentSub &&
        currentTime >= currentSub.start &&
        currentTime <= currentSub.end
      ) {
        return;
      }
    }

    // Search for new subtitle
    const foundIndex = subtitles.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );

    if (foundIndex !== -1) {
      lastIndex = foundIndex;
      const sub = subtitles[foundIndex];
      // Convert newlines to breaks for HTML
      const htmlText = sub.text.replace(/\n/g, "<br>");

      if (overlay.innerHTML !== htmlText) {
        overlay.innerHTML = htmlText;
        overlay.style.display = "block";
      }
    } else {
      // No active subtitle
      if (lastIndex !== -1) {
        lastIndex = -1;
        overlay.style.display = "none";
        overlay.innerHTML = "";
      }
    }
  };

  video.addEventListener("timeupdate", onTimeUpdate);
  (video as any).__wxt_sync_listener = onTimeUpdate;

  console.log(`[WXT-DEBUG] UI Sync Active.`);
}

/**
 * Creates a minimalist overlay that adapts to YouTube's UI.
 * It uses a MutationObserver to detect when controls appear/disappear.
 */
function createOverlay(): HTMLElement {
  const id = "wxt-subtitle-layer";
  let overlay = document.getElementById(id);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = id;

    // Base Styles
    Object.assign(overlay.style, {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "10%", // Default position
      transition: "bottom 0.2s ease-out", // Smooth animation when moving up/down
      color: "#FFFFFF",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      fontSize: "20px", // Slightly larger for better readability
      fontWeight: "600",
      textAlign: "center",
      lineHeight: "1.4",
      textShadow: "0px 2px 4px rgba(0,0,0,0.9)",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: "8px",
      padding: "8px 16px",
      pointerEvents: "none",
      userSelect: "none",
      zIndex: "2147483647",
      width: "auto",
      maxWidth: "80%",
      display: "none",
    });

    const player = document.getElementById("movie_player") || document.body;
    player.appendChild(overlay);

    // --- FLEXIBLE POSITIONING LOGIC ---
    // We observe the player for the 'ytp-autohide' class.
    // If present: Controls are HIDDEN -> Move text DOWN (10%)
    // If missing: Controls are VISIBLE -> Move text UP (20% to clear bar)

    const updatePosition = () => {
      // 'ytp-autohide' means controls are hidden (mouse is away)
      const controlsHidden = player.classList.contains("ytp-autohide");

      if (controlsHidden) {
        overlay!.style.bottom = "10%";
      } else {
        // Controls are visible, push text up
        overlay!.style.bottom = "20%";
      }
    };

    // 1. Initial check
    updatePosition();

    // 2. Watch for class changes on the player
    const observer = new MutationObserver(updatePosition);
    observer.observe(player, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return overlay;
}
