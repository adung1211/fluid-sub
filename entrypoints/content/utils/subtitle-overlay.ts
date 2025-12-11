// entrypoints/content/utils/subtitle-overlay.ts
import { Subtitle } from "../interfaces/Subtitle";
import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
  KNOWN_WORDS_KEY,
  LEVELS,
} from "./settings";
// UPDATE IMPORT:
import {
  createUnifiedHighlighter,
  HighlighterFn,
  HighlightConfig,
} from "./highlighter";
import { TokenData } from "./fetcher";
import { updateFloatingWindow } from "./floating-window";

let currentSettings: SubtitleSettings = { ...DEFAULT_SETTINGS };

function applyState(overlay: HTMLElement | null) {
  const styleId = "wxt-hide-native-subs";
  let styleTag = document.getElementById(styleId);

  if (currentSettings.enabled) {
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.innerHTML = `.ytp-caption-window-container, .caption-window { display: none !important; }`;
      document.head.appendChild(styleTag);
    }
  } else {
    if (styleTag) styleTag.remove();
  }

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
  // Also hide floating window on cleanup
  const floatWin = document.getElementById("wxt-floating-vocab-window");
  if (floatWin) floatWin.style.display = "none";
}

export async function startSubtitleSync(subtitles: Subtitle[]) {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  if (stored[SETTINGS_KEY]) {
    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...stored[SETTINGS_KEY],
      highlights: {
        ...DEFAULT_SETTINGS.highlights,
        ...stored[SETTINGS_KEY].highlights,
      },
    };
  }

  const urlParams = new URLSearchParams(location.search);
  const videoId = urlParams.get("v");

  // CHANGED: Use a single highlighter function instead of an array
  let highlighter: HighlighterFn = (text) => text;
  let wordsToHighlight: TokenData[] = [];

  // Function to refresh highlight logic based on settings AND known words
  const refreshHighlights = async () => {
    if (!videoId) return;

    // 1. Prepare collection for new configs
    const nextConfigs: HighlightConfig[] = [];
    const nextWordsToHighlight: TokenData[] = [];

    const rankCacheKey = `vocab_ranked_${videoId}`;

    // Fetch data
    const [storedRank, knownData] = await Promise.all([
      browser.storage.local.get(rankCacheKey),
      browser.storage.local.get(KNOWN_WORDS_KEY),
    ]);

    const masterList = (storedRank[rankCacheKey] as TokenData[]) || [];
    const knownSet = new Set((knownData[KNOWN_WORDS_KEY] as string[]) || []);

    if (masterList.length > 0) {
      // --- REFACTORED LOOP ---
      LEVELS.forEach((levelKey) => {
        const option = currentSettings.highlights[levelKey];

        // 1. Check if this level is enabled in settings
        if (!option || !option.enabled) return;

        // 2. Filter words that match this level (cefr) AND are not known
        const filtered = masterList.filter((t) => {
          const isMatch = t.cefr && t.cefr.toUpperCase() === levelKey;
          const isNotKnown = !knownSet.has(t.root || t.word);
          return isMatch && isNotKnown;
        });

        if (filtered.length === 0) return;

        // 3. Collect configuration for this level
        const wordStrings = filtered.map((t) => t.word);
        nextConfigs.push({ words: wordStrings, color: option.color });

        // Accumulate for the floating window
        nextWordsToHighlight.push(...filtered);
      });
      // -----------------------

      // --- Batch Translation using ROOT form ---
      // We check against our NEW local list 'nextWordsToHighlight'
      const missingTranslationTokens = nextWordsToHighlight.filter(
        (t) => !t.translation
      );

      if (missingTranslationTokens.length > 0) {
        const uniqueRoots = [
          ...new Set(missingTranslationTokens.map((t) => t.root || t.word)),
        ];

        console.log(
          `[WXT-DEBUG] Batch translating ${uniqueRoots.length} roots...`
        );

        try {
          const response = await browser.runtime.sendMessage({
            type: "TRANSLATE_BATCH",
            texts: uniqueRoots,
          });

          if (response && response.success && response.data) {
            const translationsMap = response.data;
            let updatesCount = 0;

            // Apply translations to the tokens in our new list
            nextWordsToHighlight.forEach((token) => {
              const key = token.root || token.word;
              if (!token.translation && translationsMap[key]) {
                token.translation = translationsMap[key];
                updatesCount++;
              }
            });

            // Save to storage ONLY if we actually updated something
            if (updatesCount > 0) {
              console.log(
                `[WXT-DEBUG] Saving ${updatesCount} new translations to storage.`
              );
              await browser.storage.local.set({ [rankCacheKey]: masterList });
            }
          }
        } catch (err) {
          console.error("[WXT-DEBUG] Translation Error:", err);
        }
      }
    }

    // 2. Create the unified highlighter
    highlighter = createUnifiedHighlighter(nextConfigs);
    wordsToHighlight = nextWordsToHighlight;

    console.log(
      `[WXT-DEBUG] Highlights refreshed. Active words: ${wordsToHighlight.length}`
    );
  };

  // Initial load
  await refreshHighlights();

  cleanupSubtitleSync();
  const overlay = createOverlay();
  applyState(overlay);

  // Storage Listener
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local") {
      let shouldRefresh = false;

      // Settings changed
      if (changes[SETTINGS_KEY]) {
        currentSettings = changes[SETTINGS_KEY].newValue;
        applyState(document.getElementById("wxt-subtitle-layer"));
        // We might need to rebuild highlighters if colors/categories changed
        shouldRefresh = true;
      }

      // Known words changed
      if (changes[KNOWN_WORDS_KEY]) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        await refreshHighlights();
        // Force immediate UI update for the floating window
        const videoEl = document.querySelector(
          "video.html5-main-video"
        ) as HTMLVideoElement;
        if (videoEl) {
          updateFloatingWindow(
            wordsToHighlight,
            videoEl.currentTime,
            currentSettings
          );
        }
      }
    }
  });

  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;
  if (!video) return;

  let lastIndex = -1;

  const onTimeUpdate = () => {
    const currentTime = video.currentTime;

    // --- Update Floating Window ---
    updateFloatingWindow(wordsToHighlight, currentTime, currentSettings);

    if (!currentSettings.enabled) {
      if (overlay.style.display !== "none") overlay.style.display = "none";
      return;
    }

    if (lastIndex !== -1) {
      const currentSub = subtitles[lastIndex];
      if (
        currentSub &&
        currentTime >= currentSub.start &&
        currentTime <= currentSub.end
      )
        return;
    }

    const foundIndex = subtitles.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );

    if (foundIndex !== -1) {
      lastIndex = foundIndex;
      let processedText = subtitles[foundIndex].text;

      // CHANGED: Call single unified highlighter
      processedText = highlighter(processedText);

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
