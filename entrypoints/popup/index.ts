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
    // Make sure you have added the button with this ID in your HTML
    clearBtn: document.getElementById("clear-cache")!,
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

  // Debug: Clear Cache & Reload Listener
  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", async () => {
      if (!confirm("Clear cache and reload page?")) return;

      // 1. Clear all storage (removes cached subs and rankings)
      await browser.storage.local.clear();

      // 2. Re-save current UI settings so we don't reset user preferences
      await save();

      // 3. Reload the active tab to re-fetch data
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0].id) {
        await browser.tabs.reload(tabs[0].id);
      }

      // 4. Close the popup since the page is reloading
      window.close();
    });
  }
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
