// entrypoints/content/utils/settings.ts
export interface HighlightOption {
  enabled: boolean;
  color: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;
  bgOpacity: number;
  textOpacity: number;
  // New: specific settings for each category
  highlights: {
    [key: string]: HighlightOption; // Index signature for dynamic access
    A1: HighlightOption;
    A2: HighlightOption;
    B1: HighlightOption;
    B2: HighlightOption;
    C1: HighlightOption;
    C2: HighlightOption;
    unrank: HighlightOption;
  };
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
  highlights: {
    A1: { enabled: true, color: "#8bc34a" }, // Light Green
    A2: { enabled: true, color: "#4caf50" }, // Green
    B1: { enabled: true, color: "#ffeb3b" }, // Yellow
    B2: { enabled: true, color: "#ff9800" }, // Orange
    C1: { enabled: true, color: "#f44336" }, // Red
    C2: { enabled: true, color: "#d32f2f" }, // Dark Red
    unrank: { enabled: true, color: "#9e9e9e" }, // Gray
  },
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
