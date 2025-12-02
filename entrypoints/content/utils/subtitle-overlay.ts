import { Subtitle } from "../interfaces/Subtitle";
import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "./settings";
import { createHighlighter, HighlighterFn } from "./highlighter";
import { TokenData } from "./fetcher";

let currentSettings = { ...DEFAULT_SETTINGS };

// ... (applyState and cleanupSubtitleSync remain unchanged) ...
function applyState(overlay: HTMLElement | null) {
  // 1. Manage Native Captions (Toggle)
  const styleId = "wxt-hide-native-subs";
  let styleTag = document.getElementById(styleId);

  if (currentSettings.enabled) {
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
    if (styleTag) styleTag.remove();
  }

  // 2. Manage Overlay Appearance
  if (!overlay) return;

  if (!currentSettings.enabled) {
    overlay.style.display = "none";
    return;
  }

  Object.assign(overlay.style, {
    fontSize: `${currentSettings.fontSize}px`,
    backgroundColor: `rgba(0, 0, 0, ${currentSettings.bgOpacity})`,
    color: `rgba(255, 255, 255, ${currentSettings.textOpacity})`,
    display: overlay.innerHTML ? "block" : "none",
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

  // 2. Prepare Highlighters from Master List
  const urlParams = new URLSearchParams(location.search);
  const videoId = urlParams.get("v");
  const highlighters: HighlighterFn[] = [];

  if (videoId) {
    const rankCacheKey = `vocab_ranked_${videoId}`;
    const storedData = await browser.storage.local.get(rankCacheKey);
    const masterList = (storedData[rankCacheKey] as TokenData[]) || [];

    if (masterList.length > 0) {
      // --- Filter 1: Unknown / Gibberish (Gray) ---
      const unknownWords = masterList
        .filter((t) => t.category === "unknown")
        .map((t) => t.word);

      if (unknownWords.length > 0) {
        console.log(
          `[WXT-DEBUG] Highlighting ${unknownWords.length} Unknown Words (Gray)`
        );
        // #9e9e9e is a neutral gray
        highlighters.push(createHighlighter(unknownWords, "#9e9e9e"));
      }
    }
  }

  // 3. Setup UI
  cleanupSubtitleSync();
  const overlay = createOverlay();
  applyState(overlay);

  // 4. Listen for Settings Changes
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      currentSettings = changes[SETTINGS_KEY].newValue;
      const activeOverlay = document.getElementById("wxt-subtitle-layer");
      applyState(activeOverlay);
    }
  });

  // 5. Start Sync Loop
  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;
  if (!video) return;

  let lastIndex = -1;

  const onTimeUpdate = () => {
    if (!currentSettings.enabled) {
      if (overlay.style.display !== "none") overlay.style.display = "none";
      return;
    }

    const currentTime = video.currentTime;

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

    const foundIndex = subtitles.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );

    if (foundIndex !== -1) {
      lastIndex = foundIndex;
      let processedText = subtitles[foundIndex].text;

      for (const highlight of highlighters) {
        processedText = highlight(processedText);
      }

      const htmlText = processedText.replace(/\n/g, "<br>");

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
      pointerEvents: "auto",
      userSelect: "text",
      cursor: "text",
    });

    const player = document.getElementById("movie_player") || document.body;
    player.appendChild(overlay);

    const stopProp = (e: Event) => e.stopPropagation();
    overlay.addEventListener("mousedown", stopProp);
    overlay.addEventListener("click", stopProp);
    overlay.addEventListener("dblclick", stopProp);

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
