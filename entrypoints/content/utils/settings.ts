// entrypoints/content/utils/settings.ts

// 1. Add "B1" to the start of the list
export const LEVELS = ["B1", "B2", "C1", "C2", "NR"];

export interface HighlightOption {
  enabled: boolean;
  color: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;
  bgOpacity: number;
  textOpacity: number;
  floatingWindowEnabled: boolean;
  floatingTimeWindowBack: number;
  floatingTimeWindowFront: number;
  floatingWindowHeight: number;
  highlights: Record<string, HighlightOption>;
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
  floatingWindowEnabled: true,
  floatingTimeWindowBack: 3,
  floatingTimeWindowFront: 5,
  floatingWindowHeight: 350,
  highlights: {
    // 2. Add B1 default config (Disabled by default, using a Blue color)
    B1: { enabled: false, color: "#00ff0d" },
    B2: { enabled: true, color: "#0091ff" },
    C1: { enabled: true, color: "#ff9900" },
    C2: { enabled: true, color: "#ffe600" },
    NR: { enabled: true, color: "#ff0000" },
  },
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
export const KNOWN_WORDS_KEY = "wxt_known_words";
