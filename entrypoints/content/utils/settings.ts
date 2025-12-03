// utils/settings.ts
export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;
  bgOpacity: number;
  textOpacity: number;
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 16,
  bgOpacity: 0.6,
  textOpacity: 1.0,
};

export const SETTINGS_KEY = "wxt_subtitle_settings";
