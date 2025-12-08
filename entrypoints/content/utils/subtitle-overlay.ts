import { Subtitle } from "../interfaces/Subtitle";
import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS, SETTINGS_KEY, SubtitleSettings } from "./settings";
import { createHighlighter, HighlighterFn } from "./highlighter";
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
  const highlighters: HighlighterFn[] = [];

  // Define wordsToHighlight here so it's accessible to onTimeUpdate closure
  let wordsToHighlight: TokenData[] = [];

  if (videoId) {
    const rankCacheKey = `vocab_ranked_${videoId}`;
    const storedData = await browser.storage.local.get(rankCacheKey);
    const masterList = (storedData[rankCacheKey] as TokenData[]) || [];

    if (masterList.length > 0) {
      // Loop through categories (A1..C2, norank)
      Object.keys(currentSettings.highlights).forEach((key) => {
        const option = currentSettings.highlights[key];

        if (!option || !option.enabled) return;

        const filtered =
          key === "norank"
            ? masterList.filter((t) => t.category === "norank")
            : masterList.filter(
                (t) =>
                  t.category === "word" &&
                  t.cefr &&
                  t.cefr.toUpperCase() === key
              );

        if (filtered.length === 0) return;

        // Create a highlighter for this category
        const wordStrings = filtered.map((t) => t.word);
        highlighters.push(createHighlighter(wordStrings, option.color));

        // Accumulate for the overall debug/list AND floating window
        wordsToHighlight.push(...filtered);
      });

      // --- OPTIMIZED: Batch Translation using ROOT form ---
      // 1. Identify words that need translation
      const missingTranslationTokens = wordsToHighlight.filter(
        (t) => !t.translation
      );

      if (missingTranslationTokens.length > 0) {
        // 2. Get unique ROOTS to avoid duplicate requests and group variations
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

            // 3. Apply translations to the master tokens (by reference)
            wordsToHighlight.forEach((token) => {
              // We match the translation against the token's root
              const key = token.root || token.word;
              if (!token.translation && translationsMap[key]) {
                token.translation = translationsMap[key];
                updatesCount++;
              }
            });

            // 4. Save to storage ONLY if we actually updated something
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
    // Debugging: Print the list of words (with full metadata) to be highlighted
    console.log(`[WXT-DEBUG] Highlight:`, wordsToHighlight);
  }

  cleanupSubtitleSync();
  const overlay = createOverlay();
  applyState(overlay);

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      currentSettings = changes[SETTINGS_KEY].newValue;
      applyState(document.getElementById("wxt-subtitle-layer"));

      // Update floating window immediately on setting change (e.g. toggle off)
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
  });

  const video = document.querySelector(
    "video.html5-main-video"
  ) as HTMLVideoElement;
  if (!video) return;

  let lastIndex = -1;

  const onTimeUpdate = () => {
    const currentTime = video.currentTime;

    // --- Update Floating Window ---
    // We do this every frame check to ensure sync
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
