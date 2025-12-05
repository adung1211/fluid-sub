import { browser } from "wxt/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SubtitleSettings,
} from "../content/utils/settings";
import { TokenData } from "../content/utils/fetcher";

const get = (id: string) => document.getElementById(id) as HTMLElement;
const getInput = (id: string) =>
  document.getElementById(id) as HTMLInputElement;
const setText = (id: string, text: string) =>
  (document.getElementById(id)!.textContent = text);

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Changed 'unrank' to 'norank'
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "norank"];

async function init() {
  const els = {
    enabled: getInput("enabled"),
    fontSize: getInput("fontSize"),
    bgOpacity: getInput("bgOpacity"),
    textOpacity: getInput("textOpacity"),
    highlightList: get("highlight-list"),
    saveReloadBtn: get("save-reload"),
    clearBtn: get("clear-cache"),
    loadingView: get("loading-view"),
    errorView: get("error-view"),
    mainView: get("main-view"),
    modal: get("word-modal"),
    modalClose: get("modal-close"),
    modalTitle: get("modal-title"),
    modalTableBody: get("modal-table-body"),
  };

  const closeModal = () => els.modal.classList.remove("show");
  els.modalClose.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });

  const openWordList = async (level: string) => {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tabs.length || !tabs[0].url) return;
    const url = new URL(tabs[0].url);
    const videoId = url.searchParams.get("v");
    if (!videoId) return;

    const key = `vocab_ranked_${videoId}`;
    const stored = await browser.storage.local.get(key);
    const masterList = (stored[key] as TokenData[]) || [];

    const words = masterList.filter((t) => {
      // Fix: Use 'norank' category, ignoring 'unknown' (garbage)
      if (level === "norank") return t.category === "norank";
      return t.cefr && t.cefr.toUpperCase() === level;
    });

    words.sort((a, b) => a.word.localeCompare(b.word));

    setText(
      "modal-title",
      `${level === "norank" ? "Unranked" : level} Words (${words.length})`
    );
    els.modalTableBody.innerHTML = "";

    if (words.length === 0) {
      els.modalTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px; color: #888;">No words found for this level.</td></tr>`;
    } else {
      const fragment = document.createDocumentFragment();
      words.forEach((w) => {
        const tr = document.createElement("tr");
        const timeTags = w.timestamps
          .slice(0, 5)
          .map((t) => `<span class="timestamp-tag">${formatTime(t)}</span>`)
          .join("");

        tr.innerHTML = `
          <td><strong>${w.word}</strong></td>
          <td>${timeTags}${w.timestamps.length > 5 ? "..." : ""}</td>
        `;
        fragment.appendChild(tr);
      });
      els.modalTableBody.appendChild(fragment);
    }
    els.modal.classList.add("show");
  };

  const showView = (view: "loading" | "error" | "main") => {
    els.loadingView.classList.remove("active");
    els.errorView.classList.remove("active");
    els.mainView.classList.remove("active");
    if (view === "loading") els.loadingView.classList.add("active");
    else if (view === "error") els.errorView.classList.add("active");
    else els.mainView.classList.add("active");
  };

  const refreshState = async () => {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
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
    const stored = await browser.storage.local.get([
      statusKey,
      rankKey,
      SETTINGS_KEY,
    ]);

    const status = stored[statusKey];
    const rankData = (stored[rankKey] as TokenData[]) || [];

    if (status === "loading") {
      showView("loading");
    } else if (status === "not_found" || status === "error") {
      showView("error");
    } else if (status === "success" || rankData.length > 0) {
      const counts: Record<string, number> = {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
        C1: 0,
        C2: 0,
        norank: 0,
      };
      rankData.forEach((t) => {
        // Fix: Count 'norank' correctly
        if (t.category === "norank") counts.norank++;
        else if (t.category === "word" && t.cefr) {
          const lvl = t.cefr.toUpperCase();
          if (counts[lvl] !== undefined) counts[lvl]++;
        }
      });
      renderHighlightControls(counts, stored[SETTINGS_KEY]);
      showView("main");
    } else {
      showView("loading");
    }

    const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
    els.enabled.checked = settings.enabled;
    els.fontSize.value = String(settings.fontSize);
    els.bgOpacity.value = String(settings.bgOpacity);
    els.textOpacity.value = String(settings.textOpacity);
    updateValUI(settings);
  };

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
      const labelText = level === "norank" ? "NoCerf" : level;
      const count = counts[level] || 0;
      const descText = `${count} words`;

      row.innerHTML = `
        <div class="highlight-info">
          <div class="cb-wrapper">
             <input type="checkbox" id="hl-en-${level}">
          </div>
          <span class="highlight-label" id="hl-lbl-${level}" title="Click to see list">${labelText}</span>
          <span class="highlight-desc">${descText}</span>
        </div>
        <input type="color" id="hl-col-${level}">
      `;
      els.highlightList.appendChild(row);

      const cb = row.querySelector(`#hl-en-${level}`) as HTMLInputElement;
      const col = row.querySelector(`#hl-col-${level}`) as HTMLInputElement;
      const lbl = row.querySelector(`#hl-lbl-${level}`) as HTMLElement;

      if (settings.highlights[level]) {
        cb.checked = settings.highlights[level].enabled;
        col.value = settings.highlights[level].color;
      }

      cb.addEventListener("change", saveSettings);
      col.addEventListener("input", saveSettings);
      lbl.addEventListener("click", () => openWordList(level));
    });
  };

  const updateValUI = (s: any) => {
    setText("val-size", `${s.fontSize}px`);
    setText("val-bg", String(s.bgOpacity));
    setText("val-text", String(s.textOpacity));
  };

  const saveSettings = async () => {
    const currentSettings = await browser.storage.local.get(SETTINGS_KEY);
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(currentSettings[SETTINGS_KEY] || {}),
    };

    settings.enabled = els.enabled.checked;
    settings.fontSize = Number(els.fontSize.value);
    settings.bgOpacity = Number(els.bgOpacity.value);
    settings.textOpacity = Number(els.textOpacity.value);

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

  refreshState();
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
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
