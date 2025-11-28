import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
} from "../content/utils/settings";

const get = (id: string) => document.getElementById(id) as HTMLInputElement;
const setText = (id: string, text: string) =>
  (document.getElementById(id)!.textContent = text);

async function init() {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const settings =
    (stored[SETTINGS_KEY] as SubtitleSettings) || DEFAULT_SETTINGS;

  const els = {
    enabled: get("enabled"),
    fontSize: get("fontSize"),
    bgOpacity: get("bgOpacity"),
    textOpacity: get("textOpacity"),
    controlsDiv: document.getElementById("controls")!,
  };

  // Set initial values
  els.enabled.checked = settings.enabled;
  els.fontSize.value = String(settings.fontSize);
  els.bgOpacity.value = String(settings.bgOpacity);
  els.textOpacity.value = String(settings.textOpacity);

  updateUIState(settings);

  // Save handler
  const save = async () => {
    const newSettings: SubtitleSettings = {
      enabled: els.enabled.checked,
      fontSize: Number(els.fontSize.value),
      bgOpacity: Number(els.bgOpacity.value),
      textOpacity: Number(els.textOpacity.value),
    };

    updateUIState(newSettings);
    await browser.storage.local.set({ [SETTINGS_KEY]: newSettings });
  };

  // Listeners
  els.enabled.addEventListener("change", save);
  els.fontSize.addEventListener("input", save);
  els.bgOpacity.addEventListener("input", save);
  els.textOpacity.addEventListener("input", save);
}

function updateUIState(s: SubtitleSettings) {
  setText("val-size", `${s.fontSize}px`);
  setText("val-bg", String(s.bgOpacity));
  setText("val-text", String(s.textOpacity));

  const controls = document.getElementById("controls");
  if (s.enabled) {
    controls?.classList.remove("disabled");
  } else {
    controls?.classList.add("disabled");
  }
}

init();
