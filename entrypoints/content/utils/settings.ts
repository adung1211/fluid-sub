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
  highlights: Record<string, HighlightOption>;
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
  highlights: {
    // Only high levels + unknown
    B2: { enabled: true, color: "#66bb6a" },
    C1: { enabled: true, color: "#ffa726" },
    C2: { enabled: true, color: "#ef5350" },
    norank: { enabled: true, color: "#9e9e9e" },
  },
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
