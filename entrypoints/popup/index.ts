import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
} from "../content/utils/settings";
import { TokenData } from "../content/utils/fetcher";

const get = (id: string) => document.getElementById(id) as HTMLInputElement;
const setText = (id: string, text: string) =>
  (document.getElementById(id)!.textContent = text);

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "unrank"];

async function init() {
  const els = {
    enabled: get("enabled"),
    fontSize: get("fontSize"),
    bgOpacity: get("bgOpacity"),
    textOpacity: get("textOpacity"),
    highlightList: document.getElementById("highlight-list")!,
    saveReloadBtn: document.getElementById("save-reload")!,
    clearBtn: document.getElementById("clear-cache")!,
    // Views
    loadingView: document.getElementById("loading-view")!,
    errorView: document.getElementById("error-view")!,
    mainView: document.getElementById("main-view")!,
  };

  // Helper to switch views
  const showView = (view: "loading" | "error" | "main") => {
    els.loadingView.classList.remove("active");
    els.errorView.classList.remove("active");
    els.mainView.classList.remove("active");

    if (view === "loading") els.loadingView.classList.add("active");
    else if (view === "error") els.errorView.classList.add("active");
    else els.mainView.classList.add("active");
  };

  // --- CORE LOGIC: Fetch State & Counts ---
  const refreshState = async () => {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Default: If not on YouTube or no video, show error or simple controls
    if (
      !tabs.length ||
      !tabs[0].url ||
      !tabs[0].url.includes("youtube.com/watch")
    ) {
      showView("error");
      (
        document.querySelector("#error-view .error-text") as HTMLElement
      ).innerText = "Not a YouTube Video";
      return;
    }

    const url = new URL(tabs[0].url);
    const videoId = url.searchParams.get("v");

    if (!videoId) {
      showView("error");
      return;
    }

    const statusKey = `vocab_status_${videoId}`;
    const rankKey = `vocab_ranked_${videoId}`;

    // Fetch Status and Data
    const stored = await browser.storage.local.get([
      statusKey,
      rankKey,
      SETTINGS_KEY,
    ]);
    const status = stored[statusKey];
    const rankData = (stored[rankKey] as TokenData[]) || [];

    // 1. Handle Status UI
    if (status === "loading") {
      showView("loading");
    } else if (status === "not_found" || status === "error") {
      showView("error");
    } else if (status === "success" || rankData.length > 0) {
      // Success: Calculate counts and render Main View
      const counts: Record<string, number> = {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
        C1: 0,
        C2: 0,
        unrank: 0,
      };

      rankData.forEach((t) => {
        if (t.category === "unknown") {
          counts.unrank++;
        } else if (t.category === "word" && t.cefr) {
          const level = t.cefr.toUpperCase();
          if (counts[level] !== undefined) {
            counts[level]++;
          }
        }
      });

      renderHighlightControls(counts, stored[SETTINGS_KEY]);
      showView("main");
    } else {
      // Fallback: If no status found yet (maybe just opened), assume loading if script is active
      showView("loading");
    }

    // 2. Sync Global Settings (like font size) which are independent of video status
    const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
    els.enabled.checked = settings.enabled;
    els.fontSize.value = String(settings.fontSize);
    els.bgOpacity.value = String(settings.bgOpacity);
    els.textOpacity.value = String(settings.textOpacity);
    updateValUI(settings);
  };

  // Helper to render the dynamic list
  const renderHighlightControls = (
    counts: Record<string, number>,
    storedSettings: any
  ) => {
    const settings: SubtitleSettings = {
      ...DEFAULT_SETTINGS,
      ...(storedSettings || {}),
      highlights: {
        ...DEFAULT_SETTINGS.highlights,
        ...(storedSettings?.highlights || {}),
      },
    };

    els.highlightList.innerHTML = "";
    LEVELS.forEach((level) => {
      const row = document.createElement("div");
      row.className = "highlight-row";
      const labelText = level === "unrank" ? "unrank" : level;
      const count = counts[level] || 0;
      const descText = `${count} words`;

      row.innerHTML = `
        <div class="highlight-info">
          <div class="cb-wrapper">
             <input type="checkbox" id="hl-en-${level}">
          </div>
          <span class="highlight-label">${labelText}</span>
          <span class="highlight-desc">${descText}</span>
        </div>
        <input type="color" id="hl-col-${level}">
      `;
      els.highlightList.appendChild(row);

      // Attach Listeners immediately after creation
      const cb = row.querySelector(`#hl-en-${level}`) as HTMLInputElement;
      const col = row.querySelector(`#hl-col-${level}`) as HTMLInputElement;

      if (settings.highlights[level]) {
        cb.checked = settings.highlights[level].enabled;
        col.value = settings.highlights[level].color;
      }

      cb.addEventListener("change", saveSettings);
      col.addEventListener("input", saveSettings);
    });
  };

  const updateValUI = (s: any) => {
    setText("val-size", `${s.fontSize}px`);
    setText("val-bg", String(s.bgOpacity));
    setText("val-text", String(s.textOpacity));
  };

  const saveSettings = async () => {
    // Re-read current UI state
    const currentSettings = await browser.storage.local.get(SETTINGS_KEY);
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(currentSettings[SETTINGS_KEY] || {}),
    };

    settings.enabled = els.enabled.checked;
    settings.fontSize = Number(els.fontSize.value);
    settings.bgOpacity = Number(els.bgOpacity.value);
    settings.textOpacity = Number(els.textOpacity.value);

    // Update highlights
    LEVELS.forEach((level) => {
      const cb = document.getElementById(`hl-en-${level}`) as HTMLInputElement;
      const col = document.getElementById(
        `hl-col-${level}`
      ) as HTMLInputElement;
      if (cb && col) {
        settings.highlights = settings.highlights || {};
        settings.highlights[level] = { enabled: cb.checked, color: col.value };
      }
    });

    updateValUI(settings);
    await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  };

  // --- LISTENERS ---

  // 1. Initial Load
  refreshState();

  // 2. Real-time Listener for Storage Changes (Background updates status -> Popup updates UI)
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      // If status changed or new vocab data arrived, refresh
      const keys = Object.keys(changes);
      if (
        keys.some(
          (k) => k.startsWith("vocab_status_") || k.startsWith("vocab_ranked_")
        )
      ) {
        refreshState();
      }
    }
  });

  // 3. UI Listeners
  els.enabled.addEventListener("change", saveSettings);
  els.fontSize.addEventListener("input", saveSettings);
  els.bgOpacity.addEventListener("input", saveSettings);
  els.textOpacity.addEventListener("input", saveSettings);

  if (els.saveReloadBtn) {
    els.saveReloadBtn.addEventListener("click", async () => {
      await saveSettings();
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0].id) {
        await browser.tabs.reload(tabs[0].id);
      }
      window.close();
    });
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", async () => {
      if (!confirm("Clear cache and reload page?")) return;
      await browser.storage.local.clear();
      await saveSettings();
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0].id) {
        await browser.tabs.reload(tabs[0].id);
      }
      window.close();
    });
  }
}

init();
