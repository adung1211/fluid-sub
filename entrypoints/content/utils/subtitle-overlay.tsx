// entrypoints/content/utils/subtitle-overlay.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Subtitle } from "../interfaces/Subtitle";
import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
  KNOWN_WORDS_KEY,
  LEVELS,
} from "./settings";
import {
  createUnifiedHighlighter,
  HighlighterFn,
  HighlightConfig,
} from "./highlighter";
import { TokenData } from "./fetcher";
import { updateFloatingWindow } from "./floating-window";
import { SubtitleOverlay } from '../components/SubtitleOverlay';

// --- Controller State ---

interface OverlayState {
  htmlText: string | null;
  settings: SubtitleSettings;
}

const initialState: OverlayState = {
  htmlText: null,
  settings: DEFAULT_SETTINGS,
};

class SubtitleOverlayController {
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private state: OverlayState = { ...initialState };
  
  // Logic dependencies
  private highlighter: HighlighterFn = (text) => text;
  private wordsToHighlight: TokenData[] = [];
  private video: HTMLVideoElement | null = null;
  private subtitles: Subtitle[] = [];
  private lastIndex = -1;
  private syncListener: (() => void) | null = null;

  // --- Rendering ---

  private getRoot(): Root {
    if (!this.root) {
      // We inject into the player or body
      let container = document.getElementById('wxt-subtitle-root');
      if (!container) {
          container = document.createElement('div');
          container.id = 'wxt-subtitle-root';
          // Important: Append to movie_player if possible so it scales/moves with video
          const player = document.getElementById("movie_player") || document.body;
          player.appendChild(container);
      }
      this.container = container;
      this.root = createRoot(container);
    }
    return this.root;
  }

  private render() {
    const root = this.getRoot();
    root.render(
      <SubtitleOverlay
        htmlText={this.state.htmlText}
        settings={this.state.settings}
      />
    );
  }

  // --- Logic ---

  public async start(subtitles: Subtitle[]) {
    this.subtitles = subtitles;
    this.video = document.querySelector("video.html5-main-video");

    if (!this.video) return;

    // Load initial settings
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    if (stored[SETTINGS_KEY]) {
      this.state.settings = {
        ...DEFAULT_SETTINGS,
        ...stored[SETTINGS_KEY],
        highlights: {
          ...DEFAULT_SETTINGS.highlights,
          ...stored[SETTINGS_KEY].highlights,
        },
      };
    }

    // Initialize highlighting logic
    await this.refreshHighlights();
    
    // Initial Render
    this.render();

    // Start Listeners
    this.startSync();
    this.setupStorageListener();
  }

  public cleanup() {
    if (this.video && this.syncListener) {
      this.video.removeEventListener("timeupdate", this.syncListener);
      this.syncListener = null;
    }
    
    // Hide overlay
    this.state.htmlText = null;
    this.render();
  }

  private startSync() {
    if (!this.video) return;
    
    // Clean up old listener if exists
    if (this.syncListener) {
        this.video.removeEventListener("timeupdate", this.syncListener);
    }

    this.syncListener = () => {
        if (!this.video) return;
        const currentTime = this.video.currentTime;

        // 1. Update Floating Window (Side Effect)
        updateFloatingWindow(this.wordsToHighlight, currentTime, this.state.settings);

        if (!this.state.settings.enabled) {
            if (this.state.htmlText !== null) {
                this.state.htmlText = null;
                this.render();
            }
            return;
        }

        // 2. Check if we need to change subtitle
        // Optimization: Check current index first
        if (this.lastIndex !== -1) {
            const currentSub = this.subtitles[this.lastIndex];
            if (currentSub && currentTime >= currentSub.start && currentTime <= currentSub.end) {
                // Still valid, do nothing
                return;
            }
        }

        // Find new index
        const foundIndex = this.subtitles.findIndex(
            (s) => currentTime >= s.start && currentTime <= s.end
        );

        if (foundIndex !== -1) {
            this.lastIndex = foundIndex;
            let rawText = this.subtitles[foundIndex].text;
            
            // Apply highlighting
            const processedText = this.highlighter(rawText);
            const htmlText = processedText.replace(/\n/g, "<br>");

            if (this.state.htmlText !== htmlText) {
                this.state.htmlText = htmlText;
                this.render();
            }
        } else {
            if (this.lastIndex !== -1 || this.state.htmlText !== null) {
                this.lastIndex = -1;
                this.state.htmlText = null;
                this.render();
            }
        }
    };

    this.video.addEventListener("timeupdate", this.syncListener);
  }

  private async refreshHighlights() {
    const urlParams = new URLSearchParams(location.search);
    const videoId = urlParams.get("v");
    if (!videoId) return;

    const nextConfigs: HighlightConfig[] = [];
    const nextWordsToHighlight: TokenData[] = [];
    const rankCacheKey = `vocab_ranked_${videoId}`;

    const [storedRank, knownData] = await Promise.all([
      browser.storage.local.get(rankCacheKey),
      browser.storage.local.get(KNOWN_WORDS_KEY),
    ]);

    const masterList = (storedRank[rankCacheKey] as TokenData[]) || [];
    const knownSet = new Set((knownData[KNOWN_WORDS_KEY] as string[]) || []);

    if (masterList.length > 0) {
      LEVELS.forEach((levelKey) => {
        const option = this.state.settings.highlights[levelKey];
        if (!option || !option.enabled) return;

        const filtered = masterList.filter((t) => {
          const isMatch = t.cefr && t.cefr.toUpperCase() === levelKey;
          const isNotKnown = !knownSet.has(t.root || t.word);
          return isMatch && isNotKnown;
        });

        if (filtered.length === 0) return;

        nextConfigs.push({ words: filtered.map((t) => t.word), color: option.color });
        nextWordsToHighlight.push(...filtered);
      });

      // Batch Translation Logic (Preserved)
      const missingTranslationTokens = nextWordsToHighlight.filter((t) => !t.translation);
      if (missingTranslationTokens.length > 0) {
        const uniqueRoots = [...new Set(missingTranslationTokens.map((t) => t.root || t.word))];
        try {
          const response = await browser.runtime.sendMessage({
            type: "TRANSLATE_BATCH",
            texts: uniqueRoots,
          });
          if (response && response.success && response.data) {
             let updatesCount = 0;
             nextWordsToHighlight.forEach((token) => {
                 const key = token.root || token.word;
                 if (!token.translation && response.data[key]) {
                     token.translation = response.data[key];
                     updatesCount++;
                 }
             });
             if (updatesCount > 0) {
                 await browser.storage.local.set({ [rankCacheKey]: masterList });
             }
          }
        } catch (err) {
           console.error("[WXT-DEBUG] Translation Error:", err);
        }
      }
    }

    this.highlighter = createUnifiedHighlighter(nextConfigs);
    this.wordsToHighlight = nextWordsToHighlight;
  }

  private setupStorageListener() {
      browser.storage.onChanged.addListener(async (changes, areaName) => {
          if (areaName === "local") {
              let shouldRefresh = false;
              if (changes[SETTINGS_KEY]) {
                  this.state.settings = changes[SETTINGS_KEY].newValue;
                  shouldRefresh = true;
                  // Immediately re-render to reflect style changes
                  this.render(); 
              }
              if (changes[KNOWN_WORDS_KEY]) {
                  shouldRefresh = true;
              }

              if (shouldRefresh) {
                  await this.refreshHighlights();
                  // Force immediate UI update for floating window
                  if (this.video) {
                      updateFloatingWindow(this.wordsToHighlight, this.video.currentTime, this.state.settings);
                  }
              }
          }
      });
  }
}

const controller = new SubtitleOverlayController();

// --- Exported Facade ---

export function startSubtitleSync(subtitles: Subtitle[]) {
  controller.start(subtitles);
}

export function cleanupSubtitleSync() {
  controller.cleanup();
}
