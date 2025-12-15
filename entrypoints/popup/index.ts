// entrypoints/popup/index.ts
import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
  KNOWN_WORDS_KEY,
  LEVELS, // Import levels
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
    fontSize: getCheck("fontSize"),
    bgOpacity: getCheck("bgOpacity"),
    floatingTimeBack: getCheck("floatingTimeBack"),
    floatingTimeFront: getCheck("floatingTimeFront"),
    btnManageKnown: getBtn("btn-manage-known"),
    btnClear: getBtn("clear-cache"),
    overlay: document.getElementById("word-overlay")!,
    overlayTitle: document.getElementById("overlay-title")!,
    overlayContent: document.getElementById("word-list-content")!,
    overlayClose: getBtn("close-overlay"),
  };

  // 1. Basic UI Setup
  els.fontSize.value = String(settings.fontSize);
  els.bgOpacity.value = String(settings.bgOpacity);
  els.floatingTimeBack.value = String(settings.floatingTimeWindowBack ?? 5);
  setText("val-floating-back", `${els.floatingTimeBack.value}s`);
  els.floatingTimeFront.value = String(settings.floatingTimeWindowFront ?? 15);
  setText("val-floating-front", `${els.floatingTimeFront.value}s`);

  // 2. DYNAMIC Highlight Controls Setup
  // We store references to controls so we can update counts later
  const levelUI: Record<
    string,
    { check: HTMLInputElement; color: HTMLInputElement; countId: string }
  > = {};

  LEVELS.forEach((level) => {
    const check = getCheck(`hl-${level}-check`);
    const color = getColor(`hl-${level}-color`);
    const viewBtn = getBtn(`btn-view-${level}`);
    const countId = `hl-${level}-count`;

    levelUI[level] = { check, color, countId };

    // Set initial values
    if (settings.highlights && settings.highlights[level]) {
      check.checked = settings.highlights[level].enabled;
      color.value = settings.highlights[level].color;
    }

    // Add listeners (Autosave)
    const save = () => saveSettings(false);
    check.addEventListener("change", save);
    color.addEventListener("input", save);

    // View button listener
    viewBtn.addEventListener("click", () =>
      openCategoryList(`${level} Words`, (t) => t.cefr === level)
    );
  });

  updateUIState(settings);

  // 3. Fetch Words for Counts
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

        const knownData = await browser.storage.local.get(KNOWN_WORDS_KEY);
        const knownSet = new Set(
          (knownData[KNOWN_WORDS_KEY] as string[]) || []
        );

        // Calculate counts
        const counts: Record<string, number> = {};
        LEVELS.forEach((l) => (counts[l] = 0));

        masterList.forEach((t) => {
          if (knownSet.has(t.root || t.word)) return;
          if (t.cefr && counts[t.cefr] !== undefined) {
            counts[t.cefr]++;
          }
        });

        // Update UI
        LEVELS.forEach((level) => {
          setText(levelUI[level].countId, `(${counts[level]})`);
        });
      }
    }
  } catch (e) {
    console.error("Error loading cache", e);
  }

  // 4. View Logic (Shared)
  const openWordList = (
    label: string,
    items: { text: string; isRemovable?: boolean }[]
  ) => {
    els.overlayTitle.textContent = label;
    els.overlayContent.innerHTML = "";

    if (items.length === 0) {
      els.overlayContent.innerHTML = `<div class="empty-msg">No words found.</div>`;
    } else {
      items.sort((a, b) => a.text.localeCompare(b.text));
      items.forEach((item) => {
        const div = document.createElement("div");
        div.className = "word-item";
        const span = document.createElement("span");
        span.textContent = item.text;
        div.appendChild(span);

        if (item.isRemovable) {
          const btn = document.createElement("button");
          btn.className = "word-remove-btn";
          btn.textContent = "Remove";
          btn.onclick = async () => {
            const data = await browser.storage.local.get(KNOWN_WORDS_KEY);
            let list = (data[KNOWN_WORDS_KEY] as string[]) || [];
            list = list.filter((w) => w !== item.text);
            await browser.storage.local.set({ [KNOWN_WORDS_KEY]: list });
            div.remove();
          };
          div.appendChild(btn);
        }
        els.overlayContent.appendChild(div);
      });
    }
    els.overlay.classList.add("active");
  };

  const openCategoryList = async (
    label: string,
    filterFn: (t: TokenData) => boolean
  ) => {
    const knownData = await browser.storage.local.get(KNOWN_WORDS_KEY);
    const knownSet = new Set((knownData[KNOWN_WORDS_KEY] as string[]) || []);

    const words = masterList
      .filter((t) => filterFn(t) && !knownSet.has(t.root || t.word))
      .map((t) => ({ text: t.word, isRemovable: false }));

    openWordList(label, words);
  };

  els.btnManageKnown.addEventListener("click", async () => {
    const data = await browser.storage.local.get(KNOWN_WORDS_KEY);
    const list = (data[KNOWN_WORDS_KEY] as string[]) || [];
    const items = list.map((w) => ({ text: w, isRemovable: true }));
    openWordList("Known Words (Hidden)", items);
  });

  els.overlayClose.addEventListener("click", () => {
    els.overlay.classList.remove("active");
  });

  // 5. Save Settings (Dynamic)
  const saveSettings = async (shouldReload = false) => {
    const currentHighlights =
      settings.highlights || DEFAULT_SETTINGS.highlights;

    // Construct new highlights object by looping levels
    const newHighlights: Record<string, any> = {};
    LEVELS.forEach((level) => {
      newHighlights[level] = {
        enabled: levelUI[level].check.checked,
        color: levelUI[level].color.value,
      };
    });

    const newSettings: SubtitleSettings = {
      ...settings,
      enabled: true,
      fontSize: Number(els.fontSize.value),
      bgOpacity: Number(els.bgOpacity.value),
      floatingWindowEnabled: true,
      floatingTimeWindowBack: Number(els.floatingTimeBack.value),
      floatingTimeWindowFront: Number(els.floatingTimeFront.value),
      highlights: newHighlights,
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
  els.floatingTimeBack.addEventListener("input", () => {
    setText("val-floating-back", `${els.floatingTimeBack.value}s`);
    saveSettings(false);
  });
  els.floatingTimeFront.addEventListener("input", () => {
    setText("val-floating-front", `${els.floatingTimeFront.value}s`);
    saveSettings(false);
  });

  els.btnClear.addEventListener("click", async () => {
    if (confirm("Clear temporary subtitles data?")) {
      // Fetch all storage keys
      const allData = await browser.storage.local.get(null);
      const allKeys = Object.keys(allData);

      // Filter keys: Remove everything EXCEPT settings and known words
      const keysToRemove = allKeys.filter(
        (key) => key !== SETTINGS_KEY && key !== KNOWN_WORDS_KEY
      );

      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
      }

      // Reload to refresh state
      await saveSettings(true);
    }
  });
}

function updateUIState(s: SubtitleSettings) {
  setText("val-size", `${s.fontSize}px`);
  setText("val-bg", String(s.bgOpacity));
  const controls = document.getElementById("controls");
  controls?.classList.remove("disabled");
}

init();
