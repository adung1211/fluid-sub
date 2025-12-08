// entrypoints/content/utils/word-detail.ts
import { browser } from "wxt/browser";
import { KNOWN_WORDS_KEY } from "./settings";

const ID_WORD_DETAIL_POPUP = "wxt-word-detail-popup";

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
  sourceUrls?: string[];
}

/**
 * Singleton to manage the popup element
 */
function getOrCreatePopup(): HTMLElement {
  let popup = document.getElementById(ID_WORD_DETAIL_POPUP);

  if (!popup) {
    popup = document.createElement("div");
    popup.id = ID_WORD_DETAIL_POPUP;

    // Base Styles
    Object.assign(popup.style, {
      position: "fixed",
      width: "300px",
      maxHeight: "400px",
      backgroundColor: "rgba(30, 30, 30, 0.98)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "12px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      zIndex: "2147483650", // Higher than floating window
      display: "none",
      flexDirection: "column",
      fontFamily: '"Roboto", "Segoe UI", Arial, sans-serif',
      color: "#e0e0e0",
      opacity: "0",
      transition: "opacity 0.2s ease, transform 0.2s ease",
      transform: "scale(0.95)",
      overflow: "hidden",
    });

    const style = document.createElement("style");
    // ... (rest of styles will be injected in showWordDetail)
    popup.appendChild(style);
    document.body.appendChild(popup);

    // Close on click outside
    document.addEventListener("mousedown", (e) => {
      if (popup && popup.style.display !== "none") {
        if (
          !popup.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest(".wxt-vocab-item")
        ) {
          hideWordDetail();
        }
      }
    });
  }
  return popup;
}

export async function showWordDetail(word: string, triggerEl: HTMLElement) {
  const popup = getOrCreatePopup();

  // Reset Content & Styles
  popup.innerHTML = "";
  const style = document.createElement("style");
  style.innerHTML = `
      #${ID_WORD_DETAIL_POPUP} * { box-sizing: border-box; }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-header {
        padding: 16px;
        background: rgba(255,255,255,0.03);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-word {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
        text-transform: capitalize;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-phonetic {
        font-family: monospace;
        color: #aaa;
        font-size: 13px;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-audio-btn {
        cursor: pointer;
        background: transparent;
        border: none;
        color: #4CAF50;
        padding: 4px;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex; align-items: center; justify-content: center;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-audio-btn:hover { background: rgba(76, 175, 80, 0.2); }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-content {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        scrollbar-width: thin;
        scrollbar-color: #555 transparent;
        max-height: 250px; /* Reduced to fit footer */
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-content::-webkit-scrollbar { width: 4px; }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-content::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
      
      #${ID_WORD_DETAIL_POPUP} .wxt-pos-group { margin-bottom: 16px; }
      #${ID_WORD_DETAIL_POPUP} .wxt-pos-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        background: rgba(255,255,255,0.1);
        color: #ccc;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 8px;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-def-item {
        margin-bottom: 8px;
        font-size: 13px;
        line-height: 1.5;
        color: #ddd;
        position: relative;
        padding-left: 12px;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-def-item::before {
        content: "•";
        position: absolute;
        left: 0;
        color: #666;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-example {
        color: #888;
        font-style: italic;
        margin-top: 2px;
        font-size: 12px;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-footer {
        padding: 12px 16px;
        border-top: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.02);
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-known-btn {
        width: 100%;
        padding: 8px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.1);
        color: #ddd;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
      }
      #${ID_WORD_DETAIL_POPUP} .wxt-known-btn:hover {
        background: rgba(255,255,255,0.15);
        color: #fff;
        border-color: rgba(255,255,255,0.2);
      }

      #${ID_WORD_DETAIL_POPUP} .wxt-detail-loading { padding: 40px; display: flex; justify-content: center; }
      #${ID_WORD_DETAIL_POPUP} .wxt-detail-error { padding: 20px; text-align: center; color: #aaa; font-size: 13px; }
      .wxt-spinner-sm {
        width: 24px; height: 24px; 
        border: 2px solid rgba(255,255,255,0.1);
        border-radius: 50%; border-top-color: #4CAF50;
        animation: wxt-spin 0.8s ease-in-out infinite;
      }
  `;
  popup.appendChild(style);

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "wxt-detail-loading";
  loadingDiv.innerHTML = `<div class="wxt-spinner-sm"></div>`;
  popup.appendChild(loadingDiv);

  // Position Popup
  const rect = triggerEl.getBoundingClientRect();
  const popupWidth = 300;
  const gap = 12;

  let top = rect.top;
  let left = rect.left - popupWidth - gap;

  if (left < 10) left = rect.right + gap;
  const maxTop = window.innerHeight - 400;
  if (top > maxTop) top = maxTop;
  if (top < 10) top = 10;

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  popup.style.display = "flex";
  popup.offsetHeight;
  popup.style.opacity = "1";
  popup.style.transform = "scale(1)";

  // Fetch Data
  try {
    const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`
    );

    if (!response.ok) throw new Error("Not found");

    const data = await response.json();
    const entry = data[0] as DictionaryEntry;

    // We pass the original 'word' (which is the root from the token) to the renderer for the 'Mark as Known' logic
    renderContent(popup, entry, style, word);
  } catch (err) {
    popup.innerHTML = "";
    popup.appendChild(style);
    popup.innerHTML += `
      <div class="wxt-detail-header">
        <div><div class="wxt-detail-word">${word}</div></div>
      </div>
      <div class="wxt-detail-error">Definition not found.</div>
    `;
    // Add "Mark as known" even if definition fails
    addFooter(popup, word);
  }
}

function hideWordDetail() {
  const popup = document.getElementById(ID_WORD_DETAIL_POPUP);
  if (popup) {
    popup.style.opacity = "0";
    popup.style.transform = "scale(0.95)";
    setTimeout(() => {
      if (popup.style.opacity === "0") {
        popup.style.display = "none";
      }
    }, 200);
  }
}

function renderContent(
  container: HTMLElement,
  entry: DictionaryEntry,
  styleElement: HTMLStyleElement,
  rootWord: string
) {
  container.innerHTML = "";
  container.appendChild(styleElement);

  // Header
  const header = document.createElement("div");
  header.className = "wxt-detail-header";
  const phoneticText =
    entry.phonetic || entry.phonetics.find((p) => p.text)?.text || "";
  const audioUrl = entry.phonetics.find(
    (p) => p.audio && p.audio.length > 0
  )?.audio;

  let audioHtml = "";
  if (audioUrl) {
    audioHtml = `
      <button class="wxt-audio-btn" title="Play pronunciation">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </button>`;
  }

  header.innerHTML = `
    <div>
      <div class="wxt-detail-word">${entry.word}</div>
      ${
        phoneticText
          ? `<div class="wxt-detail-phonetic">${phoneticText}</div>`
          : ""
      }
    </div>
    ${audioHtml}`;
  container.appendChild(header);

  if (audioUrl) {
    const btn = header.querySelector(".wxt-audio-btn") as HTMLButtonElement;
    btn.onclick = () => new Audio(audioUrl).play();
  }

  // Content
  const content = document.createElement("div");
  content.className = "wxt-detail-content";

  entry.meanings.slice(0, 3).forEach((meaning) => {
    const group = document.createElement("div");
    group.className = "wxt-pos-group";
    group.innerHTML = `<span class="wxt-pos-tag">${meaning.partOfSpeech}</span>`;
    meaning.definitions.slice(0, 3).forEach((def) => {
      const defDiv = document.createElement("div");
      defDiv.className = "wxt-def-item";
      defDiv.innerHTML = `${def.definition} ${
        def.example ? `<div class="wxt-example">"${def.example}"</div>` : ""
      }`;
      group.appendChild(defDiv);
    });
    content.appendChild(group);
  });
  container.appendChild(content);

  // Footer (Mark as Known)
  addFooter(container, rootWord);
}

function addFooter(container: HTMLElement, rootWord: string) {
  const footer = document.createElement("div");
  footer.className = "wxt-detail-footer";

  const btn = document.createElement("button");
  btn.className = "wxt-known-btn";
  btn.textContent = "Mark as Known (Hide)";

  btn.onclick = async () => {
    try {
      const data = await browser.storage.local.get(KNOWN_WORDS_KEY);
      const list = (data[KNOWN_WORDS_KEY] as string[]) || [];
      if (!list.includes(rootWord)) {
        await browser.storage.local.set({
          [KNOWN_WORDS_KEY]: [...list, rootWord],
        });
        hideWordDetail();
      }
    } catch (e) {
      console.error("Failed to mark as known", e);
    }
  };

  footer.appendChild(btn);
  container.appendChild(footer);
}
