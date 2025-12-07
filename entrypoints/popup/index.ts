// entrypoints/popup/index.ts
import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
} from "../content/utils/settings";
import { TokenData } from "../content/utils/fetcher";

const getCheck = (id: string) =>
  document.getElementById(id) as HTMLInputElement;
const getColor = (id: string) =>
  document.getElementById(id) as HTMLInputElement;
const getBtn = (id: string) => document.getElementById(id) as HTMLButtonElement;
const setText = (id: string, text: string) =>
  (document.getElementById(id)!.textContent = text);

async function init() {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored[SETTINGS_KEY],
  } as SubtitleSettings;

  const els = {
    enabled: getCheck("enabled"),
    fontSize: getCheck("fontSize"),
    bgOpacity: getCheck("bgOpacity"),

    // Rows (Check, Color, Count, ViewBtn)
    B2: {
      check: getCheck("hl-B2-check"),
      color: getColor("hl-B2-color"),
      count: "hl-B2-count",
      view: getBtn("btn-view-B2"),
    },
    C1: {
      check: getCheck("hl-C1-check"),
      color: getColor("hl-C1-color"),
      count: "hl-C1-count",
      view: getBtn("btn-view-C1"),
    },
    C2: {
      check: getCheck("hl-C2-check"),
      color: getColor("hl-C2-color"),
      count: "hl-C2-count",
      view: getBtn("btn-view-C2"),
    },
    norank: {
      check: getCheck("hl-norank-check"),
      color: getColor("hl-norank-color"),
      count: "hl-norank-count",
      view: getBtn("btn-view-norank"),
    },

    btnSave: getBtn("save-reload"),
    btnClear: getBtn("clear-cache"),

    // Overlay
    overlay: document.getElementById("word-overlay")!,
    overlayTitle: document.getElementById("overlay-title")!,
    overlayContent: document.getElementById("word-list-content")!,
    overlayClose: getBtn("close-overlay"),
  };

  // 1. Apply Settings to UI
  els.enabled.checked = settings.enabled;
  els.fontSize.value = String(settings.fontSize);
  els.bgOpacity.value = String(settings.bgOpacity);

  const applyHighlightUI = (key: string, ui: any) => {
    if (settings.highlights && settings.highlights[key]) {
      ui.check.checked = settings.highlights[key].enabled;
      ui.color.value = settings.highlights[key].color;
    }
  };
  applyHighlightUI("B2", els.B2);
  applyHighlightUI("C1", els.C1);
  applyHighlightUI("C2", els.C2);
  applyHighlightUI("norank", els.norank);

  updateUIState(settings);

  // 2. Fetch Words for Counts & View List
  let masterList: TokenData[] = [];
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (
      tabs.length > 0 &&
      tabs[0].url &&
      tabs[0].url.includes("youtube.com/watch")
    ) {
      const urlParams = new URLSearchParams(new URL(tabs[0].url).search);
      const videoId = urlParams.get("v");
      if (videoId) {
        const cacheKey = `vocab_ranked_${videoId}`;
        const data = await browser.storage.local.get(cacheKey);
        masterList = (data[cacheKey] as TokenData[]) || [];

        // Update Counts
        const counts = { B2: 0, C1: 0, C2: 0, norank: 0 };
        masterList.forEach((t) => {
          if (t.category === "norank") counts.norank++;
          else if (t.category === "word" && t.cefr) {
            const lvl = t.cefr.toUpperCase();
            if (counts[lvl as keyof typeof counts] !== undefined) {
              counts[lvl as keyof typeof counts]++;
            }
          }
        });
        setText(els.B2.count, `(${counts.B2})`);
        setText(els.C1.count, `(${counts.C1})`);
        setText(els.C2.count, `(${counts.C2})`);
        setText(els.norank.count, `(${counts.norank})`);
      }
    }
  } catch (e) {
    console.error("Error loading cache", e);
  }

  // 3. View Logic
  const openWordList = (label: string, filterFn: (t: TokenData) => boolean) => {
    els.overlayTitle.textContent = `${label} Words`;
    els.overlayContent.innerHTML = "";

    const words = masterList.filter(filterFn).map((t) => t.word);

    if (words.length === 0) {
      els.overlayContent.innerHTML = `<div class="empty-msg">No words found for this level.</div>`;
    } else {
      // Sort alphabetically
      words.sort();
      words.forEach((w) => {
        const div = document.createElement("div");
        div.className = "word-item";
        div.textContent = w;
        els.overlayContent.appendChild(div);
      });
    }
    els.overlay.classList.add("active");
  };

  els.B2.view.addEventListener("click", () =>
    openWordList("B2 (Intermediate)", (t) => t.cefr === "B2")
  );
  els.C1.view.addEventListener("click", () =>
    openWordList("C1 (Advanced)", (t) => t.cefr === "C1")
  );
  els.C2.view.addEventListener("click", () =>
    openWordList("C2 (Mastery)", (t) => t.cefr === "C2")
  );
  els.norank.view.addEventListener("click", () =>
    openWordList("Unknown / Rare", (t) => t.category === "norank")
  );

  els.overlayClose.addEventListener("click", () => {
    els.overlay.classList.remove("active");
  });

  // 4. Save & Reload Logic
  const saveSettings = async (shouldReload = false) => {
    const currentHighlights =
      settings.highlights || DEFAULT_SETTINGS.highlights;
    const newSettings: SubtitleSettings = {
      ...settings,
      enabled: els.enabled.checked,
      fontSize: Number(els.fontSize.value),
      bgOpacity: Number(els.bgOpacity.value),
      highlights: {
        ...currentHighlights,
        B2: { enabled: els.B2.check.checked, color: els.B2.color.value },
        C1: { enabled: els.C1.check.checked, color: els.C1.color.value },
        C2: { enabled: els.C2.check.checked, color: els.C2.color.value },
        norank: {
          enabled: els.norank.check.checked,
          color: els.norank.color.value,
        },
      },
    };

    updateUIState(newSettings);
    await browser.storage.local.set({ [SETTINGS_KEY]: newSettings });

    if (shouldReload) {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0].id) {
        browser.tabs.reload(tabs[0].id);
        window.close();
      }
    }
  };

  els.fontSize.addEventListener("input", () => saveSettings(false));
  els.bgOpacity.addEventListener("input", () => saveSettings(false));
  els.enabled.addEventListener("change", () => saveSettings(false));
  els.btnSave.addEventListener("click", () => saveSettings(true));

  els.btnClear.addEventListener("click", async () => {
    if (confirm("Clear cache?")) {
      await browser.storage.local.clear();
      await saveSettings(true);
    }
  });
}

function updateUIState(s: SubtitleSettings) {
  setText("val-size", `${s.fontSize}px`);
  setText("val-bg", String(s.bgOpacity));
  const controls = document.getElementById("controls");
  if (s.enabled) controls?.classList.remove("disabled");
  else controls?.classList.add("disabled");
}

init();
