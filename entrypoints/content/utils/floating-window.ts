// entrypoints/content/utils/floating-window.ts
import { TokenData } from "./fetcher";
import { SubtitleSettings, SETTINGS_KEY, DEFAULT_SETTINGS } from "./settings";
import { browser } from "wxt/browser";
import { showWordDetail } from "./word-detail";

const ID_FLOATING_WINDOW = "wxt-floating-vocab-window";
const ID_WINDOW_HEADER = "wxt-floating-header";
const ID_RESIZE_HANDLE = "wxt-floating-resize-handle";
const ID_LOADING_OVERLAY = "wxt-floating-loading";

interface DisplayItem {
  token: TokenData;
  start: number;
  end: number;
  uniqueKey: string;
}

// ... (getOrCreateWindow, setupDrag, setupResize, setFloatingWindowLoading, showFloatingErrorMessage, clearFloatingWindow, initFloatingWindow stay the same)

// HELPER: Keep the window creation functions as they were ...
function getOrCreateWindow(initialHeight: number): HTMLElement {
  let container = document.getElementById(ID_FLOATING_WINDOW);
  if (!container) {
    container = document.createElement("div");
    container.id = ID_FLOATING_WINDOW;

    // Initial CSS
    Object.assign(container.style, {
      position: "fixed",
      top: "100px",
      right: "20px",
      width: "220px",
      height: `${initialHeight}px`,
      minHeight: "150px",
      maxHeight: "80vh",
      backgroundColor: "rgba(20, 20, 20, 0.95)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      zIndex: "9999",
      display: "none",
      flexDirection: "column",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      color: "#fff",
      transition: "opacity 0.2s ease",
      opacity: "0",
    });

    // --- 1. Draggable Header ---
    const header = document.createElement("div");
    header.id = ID_WINDOW_HEADER;
    Object.assign(header.style, {
      height: "24px",
      background: "transparent",
      cursor: "grab",
      borderRadius: "16px 16px 0 0",
      marginBottom: "0px",
      flexShrink: "0",
      position: "relative",
      zIndex: "2",
    });
    header.innerHTML = `<div style="width: 32px; height: 4px; background: rgba(255,255,255,0.2); margin: 10px auto; border-radius: 2px;"></div>`;
    container.appendChild(header);

    // --- 2. Loading Overlay ---
    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = ID_LOADING_OVERLAY;
    Object.assign(loadingOverlay.style, {
      position: "absolute",
      top: "24px",
      left: "0",
      width: "100%",
      height: "calc(100% - 40px)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(20,20,20,0.8)",
      zIndex: "10",
      backdropFilter: "blur(2px)",
      borderRadius: "0 0 16px 16px",
    });
    loadingOverlay.innerHTML = `<div class="wxt-spinner"></div>`;
    container.appendChild(loadingOverlay);

    // --- 3. Content Container ---
    const content = document.createElement("div");
    content.id = `${ID_FLOATING_WINDOW}-content`;
    Object.assign(content.style, {
      overflowY: "auto",
      padding: "0 10px 0 10px",
      flex: "1",
      scrollbarWidth: "thin",
      minHeight: "40px",
    });
    container.appendChild(content);

    // --- 4. Resize Handle ---
    const resizeHandle = document.createElement("div");
    resizeHandle.id = ID_RESIZE_HANDLE;
    Object.assign(resizeHandle.style, {
      height: "16px",
      width: "100%",
      cursor: "ns-resize",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      borderRadius: "0 0 16px 16px",
    });
    resizeHandle.innerHTML = `<div style="display:flex; gap:3px; opacity:0.3;">
        <div style="width:3px; height:3px; border-radius:50%; background:#fff;"></div>
        <div style="width:3px; height:3px; border-radius:50%; background:#fff;"></div>
        <div style="width:3px; height:3px; border-radius:50%; background:#fff;"></div>
    </div>`;
    container.appendChild(resizeHandle);

    // --- 5. Styles ---
    const style = document.createElement("style");
    style.innerHTML = `
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar { width: 4px; }
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar-track { background: transparent; }
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
      
      .wxt-vocab-item { 
        margin-bottom: 8px; padding: 10px; border-radius: 8px; 
        background: rgba(255,255,255,0.05); border: 2px solid transparent;
        display: flex; flex-direction: column; position: relative;
        transform: translateZ(0);
        transition: all 0.4s ease;
        cursor: pointer;
      }
      .wxt-vocab-item:hover { background: rgba(255,255,255,0.1); opacity: 1 !important; filter: none !important; }
      .wxt-vocab-item.active-word {
        border-color: #4CAF50; background: rgba(76, 175, 80, 0.12);
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15); transform: scale(1.02); z-index: 2; opacity: 1;
      }
      .wxt-vocab-item.passed { opacity: 0.5; filter: grayscale(100%); border-color: transparent !important; }
      .wxt-vocab-item.passed .wxt-vocab-word { color: #aaa !important; }
      .wxt-vocab-item.passed .wxt-vocab-trans { color: #777 !important; }
      .wxt-vocab-item.passed .wxt-vocab-meta { color: #555 !important; }

      .wxt-vocab-word { font-weight: 700; font-size: 15px; color: #fff; margin-bottom: 2px; }
      .wxt-vocab-trans { font-size: 13px; color: #ddd; line-height: 1.3; }
      .wxt-vocab-meta { font-size: 10px; color: #888; margin-top: 6px; display:flex; justify-content:space-between; align-items:center; }
      .wxt-time-tag { background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px; font-family: monospace; }

      .wxt-spinner {
        width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.3);
        border-radius: 50%; border-top-color: #4CAF50;
        animation: wxt-spin 1s ease-in-out infinite;
      }
      @keyframes wxt-spin { to { transform: rotate(360deg); } }

      @keyframes wxt-slide-in {
        from { opacity: 0; transform: translateY(10px) scale(0.95); max-height: 0; margin-bottom: 0; padding: 0 10px; border-width: 0; }
        to { opacity: 1; transform: translateY(0) scale(1); max-height: 100px; margin-bottom: 8px; padding: 10px; border-width: 2px; }
      }
      @keyframes wxt-fade-out {
        from { opacity: 1; transform: scale(1); max-height: 100px; margin-bottom: 8px; }
        to { opacity: 0; transform: scale(0.9); max-height: 0; margin-bottom: 0; padding: 0 10px; border-width: 0; }
      }
      .wxt-vocab-item.entering { animation: wxt-slide-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      .wxt-vocab-item.exiting { animation: wxt-fade-out 0.25s ease-in forwards; pointer-events: none; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    setupDrag(container, header);
    setupResize(container, resizeHandle);
  }
  return container;
}

function setupDrag(container: HTMLElement, handle: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    container.style.right = "auto";
    container.style.left = `${initialLeft}px`;
    container.style.top = `${initialTop}px`;
    handle.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    container.style.left = `${initialLeft + dx}px`;
    container.style.top = `${initialTop + dy}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  });
}

function setupResize(container: HTMLElement, handle: HTMLElement) {
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;
    startY = e.clientY;
    startHeight = container.getBoundingClientRect().height;
    document.body.style.cursor = "ns-resize";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const dy = e.clientY - startY;
    container.style.height = `${startHeight + dy}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      const finalHeight = container.getBoundingClientRect().height;
      try {
        const stored = await browser.storage.local.get(SETTINGS_KEY);
        const current = stored[SETTINGS_KEY] || DEFAULT_SETTINGS;
        const newSettings = { ...current, floatingWindowHeight: finalHeight };
        await browser.storage.local.set({ [SETTINGS_KEY]: newSettings });
      } catch (e) {}
    }
  });
}

export function setFloatingWindowLoading(isLoading: boolean) {
  const container = document.getElementById(ID_FLOATING_WINDOW);
  if (!container) return;

  if (container.style.display === "none" || container.style.opacity === "0") {
    container.style.display = "flex";
    requestAnimationFrame(() => (container.style.opacity = "1"));
  }

  const loader = document.getElementById(ID_LOADING_OVERLAY);
  if (loader) {
    loader.style.display = isLoading ? "flex" : "none";
  }
}

export function showFloatingErrorMessage(message: string) {
  const container = document.getElementById(ID_FLOATING_WINDOW);
  if (!container) return;

  // Ensure visible
  if (container.style.display === "none" || container.style.opacity === "0") {
    container.style.display = "flex";
    requestAnimationFrame(() => (container.style.opacity = "1"));
  }

  // Hide loader
  const loader = document.getElementById(ID_LOADING_OVERLAY);
  if (loader) loader.style.display = "none";

  const contentArea = container.querySelector(`#${ID_FLOATING_WINDOW}-content`);
  if (contentArea) {
    contentArea.innerHTML = `
      <div style="
        height: 100%; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        text-align: center; 
        color: #aaa; 
        padding: 20px;
        opacity: 0;
        animation: wxt-slide-in 0.3s forwards;
      ">
        <div style="font-size: 12px; line-height: 1.4;">${message}</div>
      </div>
    `;
  }
}

export function clearFloatingWindow() {
  const container = document.getElementById(ID_FLOATING_WINDOW);
  if (!container) return;
  const contentArea = container.querySelector(`#${ID_FLOATING_WINDOW}-content`);
  if (contentArea) {
    contentArea.innerHTML = "";
  }
}

export async function initFloatingWindow() {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const settings =
    (stored[SETTINGS_KEY] as SubtitleSettings) || DEFAULT_SETTINGS;

  if (settings.enabled && settings.floatingWindowEnabled) {
    const container = getOrCreateWindow(settings.floatingWindowHeight || 350);
    container.style.display = "flex";
    requestAnimationFrame(() => (container.style.opacity = "1"));
  }
}

export function updateFloatingWindow(
  allTokens: TokenData[],
  currentTime: number,
  settings: SubtitleSettings
) {
  const container = getOrCreateWindow(settings.floatingWindowHeight || 350);
  const contentArea = container.querySelector(
    `#${ID_FLOATING_WINDOW}-content`
  ) as HTMLElement;

  if (!settings.enabled || !settings.floatingWindowEnabled) {
    if (container.style.opacity !== "0") {
      container.style.opacity = "0";
      setTimeout(() => {
        if (container.style.opacity === "0") container.style.display = "none";
      }, 200);
    }
    return;
  }

  container.style.display = "flex";
  if (container.style.opacity !== "1") {
    requestAnimationFrame(() => (container.style.opacity = "1"));
  }

  // 1. Identify which words SHOULD be visible based on time
  const startWindow = currentTime - settings.floatingTimeWindow;
  const endWindow = currentTime + settings.floatingTimeWindow;
  const displayItems: DisplayItem[] = [];

  allTokens.forEach((token) => {
    const validSegments = token.timestamps.filter(
      (ts) => ts.start <= endWindow && ts.end >= startWindow
    );
    validSegments.forEach((seg) => {
      displayItems.push({
        token: token,
        start: seg.start,
        end: seg.end,
        uniqueKey: `${token.word}-${seg.start}`,
      });
    });
  });

  displayItems.sort((a, b) => a.start - b.start);

  const activeKeysSet = new Set(displayItems.map((i) => i.uniqueKey));

  // 2. NEW: Build a set of ALL valid keys from the current source list (allTokens)
  // This allows us to check if a word currently in the DOM still "exists" in our known universe.
  // If it's missing from this set, it means the user marked it as known (removed it).
  const allValidKeysSet = new Set<string>();
  allTokens.forEach((token) => {
    token.timestamps.forEach((seg) => {
      allValidKeysSet.add(`${token.word}-${seg.start}`);
    });
  });

  // 3. Remove/Animate Out Old Elements
  Array.from(contentArea.children).forEach((child) => {
    const el = child as HTMLElement;
    const key = el.dataset.key;

    // If the element is not in the active set (needs to be hidden)
    if (key && !activeKeysSet.has(key)) {
      // LOGIC:
      // If key is in allValidKeysSet -> It's a valid word, just passed the time window -> ANIMATE OUT
      // If key is NOT in allValidKeysSet -> It was removed from the list (marked known) -> REMOVE INSTANTLY

      if (allValidKeysSet.has(key)) {
        if (!el.classList.contains("exiting")) {
          el.classList.remove("entering");
          el.classList.add("exiting");
          el.addEventListener("animationend", () => el.remove(), {
            once: true,
          });
        }
      } else {
        // Instant removal for known words or category changes
        el.remove();
      }
    }
  });

  // 4. Add New Elements or Update Existing
  if (
    displayItems.length > 0 &&
    !contentArea.querySelector(".wxt-vocab-item")
  ) {
    contentArea.innerHTML = "";
  }

  // Active Keys vs Passed Keys (grayed out)
  const activeTimeKeys = new Set<string>();
  const passedTimeKeys = new Set<string>();

  for (const item of displayItems) {
    if (currentTime >= item.start && currentTime <= item.end) {
      activeTimeKeys.add(item.uniqueKey);
    } else if (currentTime > item.end) {
      passedTimeKeys.add(item.uniqueKey);
    }
  }

  displayItems.forEach((item) => {
    let el = contentArea.querySelector(
      `.wxt-vocab-item[data-key="${item.uniqueKey}"]`
    ) as HTMLElement;

    if (!el) {
      el = createVocabItem(item, settings);
      el.dataset.key = item.uniqueKey;
      el.classList.add("entering");

      const firstChild = contentArea.firstElementChild as HTMLElement;
      if (
        firstChild &&
        firstChild.dataset.ts &&
        item.start < Number(firstChild.dataset.ts)
      ) {
        contentArea.insertBefore(el, firstChild);
      } else {
        contentArea.appendChild(el);
      }
    } else {
      // If re-entering from exiting state
      if (el.classList.contains("exiting")) {
        el.classList.remove("exiting");
        el.classList.add("entering");
      }
      // Update translation if it came in late
      const transEl = el.querySelector(".wxt-vocab-trans");
      if (
        transEl &&
        item.token.translation &&
        transEl.textContent !== item.token.translation
      ) {
        transEl.textContent = item.token.translation;
      }
    }

    if (activeTimeKeys.has(item.uniqueKey)) {
      el.classList.add("active-word");
      el.classList.remove("passed");
    } else {
      el.classList.remove("active-word");
      if (passedTimeKeys.has(item.uniqueKey)) {
        el.classList.add("passed");
      } else {
        el.classList.remove("passed");
      }
    }
  });
}

function createVocabItem(
  item: DisplayItem,
  settings: SubtitleSettings
): HTMLElement {
  const div = document.createElement("div");
  div.className = "wxt-vocab-item";
  div.dataset.ts = String(item.start);

  let badgeColor = "#999";
  const t = item.token;
  if (t.category === "word" && t.cefr && settings.highlights[t.cefr]) {
    badgeColor = settings.highlights[t.cefr].color;
  } else if (t.category === "norank" && settings.highlights.norank) {
    badgeColor = settings.highlights.norank.color;
  }
  div.style.borderLeftColor = badgeColor;
  div.style.borderLeftWidth = "4px";
  div.style.borderLeftStyle = "solid";

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  div.innerHTML = `
        <div class="wxt-vocab-word">${t.word}</div>
        <div class="wxt-vocab-trans">${t.translation || "..."}</div>
        <div class="wxt-vocab-meta">
            <span>${t.cefr || "VR"}</span>
            <span class="wxt-time-tag">${formatTime(item.start)}</span>
        </div>
    `;

  div.addEventListener("click", (e) => {
    e.stopPropagation();
    const searchWord = t.root || t.word;
    showWordDetail(searchWord, div);
  });

  return div;
}
