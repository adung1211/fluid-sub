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
  // --- New Settings ---
  floatingWindowEnabled: boolean;
  floatingTimeWindow: number;
  floatingWindowHeight: number; // <--- ADDED: Persist height
  // --------------------
  highlights: Record<string, HighlightOption>;
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
  // --- Defaults ---
  floatingWindowEnabled: true,
  floatingTimeWindow: 10,
  floatingWindowHeight: 350, // <--- ADDED: Default height
  // ----------------
  highlights: {
    // Only high levels + unknown
    B2: { enabled: true, color: "#00ff0d" },
    C1: { enabled: true, color: "#ff9900" },
    C2: { enabled: true, color: "#ffe600" },
    norank: { enabled: true, color: "#ff0000" },
  },
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
