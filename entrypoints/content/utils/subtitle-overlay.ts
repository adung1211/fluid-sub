// entrypoints/content/utils/subtitle-overlay.ts
import { Subtitle } from "../interfaces/Subtitle";
import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS, SETTINGS_KEY, SubtitleSettings } from "./settings";

let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * Applies styles to the overlay and manages Native Caption visibility
 */
function applyState(overlay: HTMLElement | null) {
  // 1. Manage Native Captions (Toggle)
  const styleId = "wxt-hide-native-subs";
  let styleTag = document.getElementById(styleId);

  if (currentSettings.enabled) {
    // Enable Extension: Hide Native YouTube Captions
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.innerHTML = `
        .ytp-caption-window-container, .caption-window {
          display: none !important;
        }
      `;
      document.head.appendChild(styleTag);
    }
  } else {
    // Disable Extension: Show Native YouTube Captions
    if (styleTag) {
      styleTag.remove();
    }
  }

  // 2. Manage Overlay Appearance
  if (!overlay) return;

  if (!currentSettings.enabled) {
    overlay.style.display = "none";
    return; // Don't bother styling if hidden
  }

  // Apply visual settings
  Object.assign(overlay.style, {
    fontSize: `${currentSettings.fontSize}px`,
    backgroundColor: `rgba(0, 0, 0, ${currentSettings.bgOpacity})`,
    color: `rgba(255, 255, 255, ${currentSettings.textOpacity})`,
    display: overlay.innerHTML ? "block" : "none", // Keep hidden if empty
  });
}

export function cleanupSubtitleSync() {
  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;
  if (video && (video as any).__wxt_sync_listener) {
    video.removeEventListener("timeupdate", (video as any).__wxt_sync_listener);
    delete (video as any).__wxt_sync_listener;
  }

  const overlay = document.getElementById("wxt-subtitle-layer");
  if (overlay) {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }
}

export async function startSubtitleSync(subtitles: Subtitle[]) {
  // 1. Load Settings
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  if (stored[SETTINGS_KEY]) {
    currentSettings = stored[SETTINGS_KEY];
  }

  // 2. Setup UI
  cleanupSubtitleSync();
  const overlay = createOverlay();
  applyState(overlay);

  // 3. Listen for Storage Changes (Real-time Toggle)
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      currentSettings = changes[SETTINGS_KEY].newValue;
      const activeOverlay = document.getElementById("wxt-subtitle-layer");
      applyState(activeOverlay);
    }
  });

  // 4. Start Sync Loop
  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;
  if (!video) return;

  let lastIndex = -1;

  const onTimeUpdate = () => {
    // If disabled, ensure overlay is hidden and do nothing
    if (!currentSettings.enabled) {
      if (overlay.style.display !== "none") overlay.style.display = "none";
      return;
    }

    const currentTime = video.currentTime;

    // Optimization: Check current subtitle first
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

    // Find new subtitle
    const foundIndex = subtitles.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );

    if (foundIndex !== -1) {
      lastIndex = foundIndex;
      const htmlText = subtitles[foundIndex].text.replace(/\n/g, "<br>");

      if (overlay.innerHTML !== htmlText) {
        overlay.innerHTML = htmlText;
        overlay.style.display = "block";
      }
    } else {
      if (lastIndex !== -1) {
        lastIndex = -1;
        overlay.style.display = "none";
        overlay.innerHTML = "";
      }
    }
  };

  video.addEventListener("timeupdate", onTimeUpdate);
  (video as any).__wxt_sync_listener = onTimeUpdate;
}

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
      bottom: "10%",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      fontWeight: "600",
      textAlign: "center",
      lineHeight: "1.4",
      borderRadius: "8px",
      padding: "8px 16px",
      zIndex: "2147483647",
      maxWidth: "80%",
      display: "none",
      transition:
        "bottom 0.2s, background-color 0.2s, color 0.2s, font-size 0.2s",

      // Interaction Styles
      pointerEvents: "auto", // Allow interactions
      userSelect: "text", // Allow highlighting
      cursor: "text", // Show text cursor
    });

    const player = document.getElementById("movie_player") || document.body;
    player.appendChild(overlay);

    // --- SMART EVENT HANDLING ---
    const stopProp = (e: Event) => e.stopPropagation();

    // 1. Stop these to prevent YouTube from Pausing/Fullscreening
    overlay.addEventListener("mousedown", stopProp);
    overlay.addEventListener("click", stopProp);
    overlay.addEventListener("dblclick", stopProp);

    // 2. We explicitly DO NOT stop 'mouseup'.
    // This allows the "selection complete" event to reach the browser/extensions
    // so the Translate popup can trigger.

    // Auto-adjust position based on controls
    const updatePosition = () => {
      const controlsHidden = player.classList.contains("ytp-autohide");
      overlay!.style.bottom = controlsHidden ? "10%" : "20%";
    };
    const observer = new MutationObserver(updatePosition);
    observer.observe(player, { attributes: true, attributeFilter: ["class"] });
    updatePosition();
  }

  return overlay;
}
