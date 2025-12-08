// entrypoints/content/utils/floating-window.ts
import { TokenData } from "./fetcher";
import { SubtitleSettings } from "./settings";

const ID_FLOATING_WINDOW = "wxt-floating-vocab-window";
const ID_WINDOW_HEADER = "wxt-floating-header";

/**
 * Creates or retrieves the floating window DOM element with drag capabilities.
 */
function getOrCreateWindow(): HTMLElement {
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
      maxHeight: "300px",
      backgroundColor: "rgba(20, 20, 20, 0.95)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      zIndex: "9999",
      display: "none",
      flexDirection: "column",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      color: "#fff",
      transition: "opacity 0.2s ease, transform 0.2s ease", // Smooth hide/show
      opacity: "0", // Start hidden
    });

    // --- 1. Draggable Header ---
    const header = document.createElement("div");
    header.id = ID_WINDOW_HEADER;
    Object.assign(header.style, {
      height: "18px",
      background: "rgba(255,255,255,0.1)",
      cursor: "grab",
      borderRadius: "12px 12px 0 0",
      marginBottom: "0px",
      flexShrink: "0", // Prevent shrinking
    });
    // Add a tiny visual "grip" indicator
    header.innerHTML = `<div style="width: 30px; height: 3px; background: rgba(255,255,255,0.3); margin: 7px auto; border-radius: 2px;"></div>`;

    container.appendChild(header);

    // --- 2. Content Container (Scrollable) ---
    const content = document.createElement("div");
    content.id = `${ID_FLOATING_WINDOW}-content`;
    Object.assign(content.style, {
      overflowY: "auto",
      padding: "10px",
      flex: "1",
      scrollbarWidth: "thin",
    });
    container.appendChild(content);

    // --- 3. Styles for Animation & Scrollbar ---
    const style = document.createElement("style");
    style.innerHTML = `
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar { width: 4px; }
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar-track { background: transparent; }
      #${ID_FLOATING_WINDOW}-content::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
      
      /* Item Base */
      .wxt-vocab-item { 
        margin-bottom: 8px; padding: 8px; border-radius: 6px; 
        background: rgba(255,255,255,0.05); 
        display: flex; flex-direction: column;
        position: relative;
        /* Hardware acceleration for smooth animation */
        transform: translateZ(0);
      }
      .wxt-vocab-item:hover { background: rgba(255,255,255,0.15); }

      /* Text Styles */
      .wxt-vocab-word { font-weight: 700; font-size: 14px; color: #fff; margin-bottom: 2px; }
      .wxt-vocab-trans { font-size: 13px; color: #ddd; line-height: 1.2; }
      .wxt-vocab-meta { font-size: 10px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

      /* --- Animations --- */
      @keyframes wxt-slide-in {
        from { opacity: 0; transform: translateX(20px); max-height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
        to { opacity: 1; transform: translateX(0); max-height: 100px; margin-bottom: 8px; padding: 8px;}
      }
      @keyframes wxt-fade-out {
        from { opacity: 1; transform: scale(1); max-height: 100px; margin-bottom: 8px; }
        to { opacity: 0; transform: scale(0.9); max-height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
      }

      .wxt-vocab-item.entering {
        animation: wxt-slide-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
      .wxt-vocab-item.exiting {
        animation: wxt-fade-out 0.25s ease-in forwards;
        pointer-events: none; /* Prevent clicks while leaving */
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    // --- 4. Drag Logic ---
    setupDrag(container, header);
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
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Calculate current position (handling 'right' vs 'left' positioning issues)
    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Switch to absolute positioning using Left/Top to make movement math easier
    container.style.right = "auto";
    container.style.left = `${initialLeft}px`;
    container.style.top = `${initialTop}px`;

    handle.style.cursor = "grabbing";
    e.preventDefault(); // Prevent text selection
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

/**
 * Updates the content of the floating window with diffing and animations.
 */
export function updateFloatingWindow(
  allTokens: TokenData[],
  currentTime: number,
  settings: SubtitleSettings
) {
  const container = getOrCreateWindow();
  const contentArea = container.querySelector(
    `#${ID_FLOATING_WINDOW}-content`
  ) as HTMLElement;

  if (!settings.enabled || !settings.floatingWindowEnabled) {
    container.style.opacity = "0";
    setTimeout(() => {
      if (container.style.opacity === "0") container.style.display = "none";
    }, 200);
    return;
  }

  // 1. Calculate Active Range
  const startWindow = currentTime - settings.floatingTimeWindow;
  const endWindow = currentTime + settings.floatingTimeWindow;

  // 2. Filter Active Tokens
  const activeTokens = allTokens.filter((token) =>
    token.timestamps.some((ts) => ts >= startWindow && ts <= endWindow)
  );

  // Hide if empty
  if (activeTokens.length === 0) {
    container.style.opacity = "0";
    setTimeout(() => {
      // Only hide display if still opacity 0 (prevent flickering if data comes back fast)
      if (container.style.opacity === "0") container.style.display = "none";
    }, 200);
    return;
  }

  // Show Container
  container.style.display = "flex";
  // Small delay to allow display:flex to apply before opacity transition
  requestAnimationFrame(() => (container.style.opacity = "1"));

  // 3. Sort Tokens (Stable Sort by Earliest Timestamp inside Window)
  // This keeps the list jumping less than "closest distance"
  activeTokens.sort((a, b) => {
    const getFirstInWindow = (timestamps: number[]) =>
      timestamps.find((t) => t >= startWindow) || 0;
    return getFirstInWindow(a.timestamps) - getFirstInWindow(b.timestamps);
  });

  // 4. DOM Diffing & Animation Logic

  // Create a Set of keys for the NEW active tokens
  // We use word+root as a unique key (timestamps can be tricky if multiple occur)
  const activeKeys = new Set(activeTokens.map((t) => getTokenKey(t)));

  // A. Mark EXITING items
  // Iterate over current DOM children
  const existingChildren = Array.from(contentArea.children) as HTMLElement[];
  existingChildren.forEach((child) => {
    const key = child.dataset.key;
    if (key && !activeKeys.has(key)) {
      // Only add exiting class if not already exiting
      if (!child.classList.contains("exiting")) {
        child.classList.remove("entering"); // Stop entering animation if in progress
        child.classList.add("exiting");

        // Remove from DOM after animation finishes
        child.addEventListener(
          "animationend",
          () => {
            child.remove();
          },
          { once: true }
        );
      }
    }
  });

  // B. Add NEW ENTERING items or UPDATE existing
  activeTokens.forEach((t, index) => {
    const key = getTokenKey(t);
    let el = contentArea.querySelector(
      `.wxt-vocab-item[data-key="${key}"]`
    ) as HTMLElement;

    if (!el) {
      // CREATE NEW
      el = createVocabItem(t, settings);
      el.dataset.key = key;
      el.classList.add("entering");

      // Insert in roughly the correct position?
      // For simplicity/performance in floating windows, appending often looks smoother
      // than trying to insert-sort into a list of animating elements.
      // However, we can append to bottom.
      contentArea.appendChild(el);
    } else {
      // UPDATE EXISTING (If needed, e.g. translation loaded later)
      // Removing 'exiting' class if it was about to die but came back
      if (el.classList.contains("exiting")) {
        el.classList.remove("exiting");
        el.classList.add("entering"); // Re-trigger enter or just fade in?
      }

      // Check if translation updated (async fetch case)
      const transEl = el.querySelector(".wxt-vocab-trans");
      if (transEl && t.translation && transEl.textContent !== t.translation) {
        transEl.textContent = t.translation;
      }

      // Re-order?
      // Moving elements in DOM while animating can be jerky.
      // We usually let them stay in rendered order or simple append.
      // For this specific use case, appending new words to the bottom is usually best natural flow.
      // So we skip re-ordering existing nodes.

      // Ensure it's visible
      el.style.display = "flex";
    }
  });
}

// Helper to generate unique key
function getTokenKey(t: TokenData): string {
  return `${t.word}-${t.root || ""}`;
}

// Helper to create DOM element
function createVocabItem(
  t: TokenData,
  settings: SubtitleSettings
): HTMLElement {
  const div = document.createElement("div");
  div.className = "wxt-vocab-item";

  // Determine Color
  let badgeColor = "#999";
  if (t.category === "word" && t.cefr && settings.highlights[t.cefr]) {
    badgeColor = settings.highlights[t.cefr].color;
  } else if (t.category === "norank" && settings.highlights.norank) {
    badgeColor = settings.highlights.norank.color;
  }
  div.style.borderLeft = `4px solid ${badgeColor}`;

  div.innerHTML = `
        <div class="wxt-vocab-word">${t.word}</div>
        <div class="wxt-vocab-trans">${t.translation || "..."}</div>
        <div class="wxt-vocab-meta">
            ${t.cefr || "Unknown"}
        </div>
    `;
  return div;
}
