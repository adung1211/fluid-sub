// utils/settings.ts
export interface HighlightOption {
  enabled: boolean;
  color: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;
  bgOpacity: number;
  textOpacity: number;
  highlights: {
    [key: string]: HighlightOption;
    A1: HighlightOption;
    A2: HighlightOption;
    B1: HighlightOption;
    B2: HighlightOption;
    C1: HighlightOption;
    C2: HighlightOption;
    norank: HighlightOption; // Changed from 'unrank'
  };
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
  highlights: {
    A1: { enabled: false, color: "#8bc34a" },
    A2: { enabled: false, color: "#4caf50" },
    B1: { enabled: false, color: "#44ff00" },
    B2: { enabled: true, color: "#00ff33" },
    C1: { enabled: true, color: "#3700ff" },
    C2: { enabled: true, color: "#fffb00" },
    norank: { enabled: true, color: "#f44336" }, // Changed from 'unrank'
  },
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
