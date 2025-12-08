// entrypoints/content/utils/floating-window.ts
import { TokenData } from "./fetcher";
import { SubtitleSettings } from "./settings";

const ID_FLOATING_WINDOW = "wxt-floating-vocab-window";

/**
 * Creates or retrieves the floating window DOM element.
 */
function getOrCreateWindow(): HTMLElement {
  let container = document.getElementById(ID_FLOATING_WINDOW);
  if (!container) {
    container = document.createElement("div");
    container.id = ID_FLOATING_WINDOW;

    // Initial Styles (Vertical, Floating, Right side)
    Object.assign(container.style, {
      position: "fixed",
      top: "80px", // Below YouTube header
      right: "20px",
      width: "220px",
      maxHeight: "calc(100vh - 150px)",
      backgroundColor: "rgba(20, 20, 20, 0.95)",
      backdropFilter: "blur(4px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      zIndex: "9999",
      overflowY: "auto",
      padding: "12px",
      display: "none",
      transition: "opacity 0.2s ease",
      fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
      color: "#fff",
      scrollbarWidth: "thin", // Firefox
      pointerEvents: "auto", // Allow scrolling/copying
    });

    // Custom Scrollbar styling for Webkit
    const style = document.createElement("style");
    style.innerHTML = `
      #${ID_FLOATING_WINDOW}::-webkit-scrollbar { width: 6px; }
      #${ID_FLOATING_WINDOW}::-webkit-scrollbar-track { background: transparent; }
      #${ID_FLOATING_WINDOW}::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      #${ID_FLOATING_WINDOW} .vocab-item { 
        margin-bottom: 8px; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); 
        transition: transform 0.1s; display: flex; flex-direction: column;
      }
      #${ID_FLOATING_WINDOW} .vocab-item:hover { transform: translateX(-2px); background: rgba(255,255,255,0.1); }
      #${ID_FLOATING_WINDOW} .vocab-word { font-weight: bold; font-size: 14px; color: #fff; }
      #${ID_FLOATING_WINDOW} .vocab-trans { font-size: 12px; color: #aaa; margin-top: 2px; }
      #${ID_FLOATING_WINDOW} .vocab-meta { font-size: 10px; color: #666; margin-top: 4px; display: flex; justify-content: space-between; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Updates the content of the floating window based on current time.
 */
export function updateFloatingWindow(
  allTokens: TokenData[],
  currentTime: number,
  settings: SubtitleSettings
) {
  const container = getOrCreateWindow();

  if (!settings.enabled || !settings.floatingWindowEnabled) {
    container.style.display = "none";
    return;
  }

  // Define Window Range [Current - X, Current + X]
  const startWindow = currentTime - settings.floatingTimeWindow;
  const endWindow = currentTime + settings.floatingTimeWindow;

  // Filter Tokens
  // A token is included if ANY of its timestamps falls within the window
  const activeTokens = allTokens.filter((token) => {
    return token.timestamps.some((ts) => ts >= startWindow && ts <= endWindow);
  });

  if (activeTokens.length === 0) {
    container.style.opacity = "0";
    // Slight delay before hiding completely to prevent flickering
    setTimeout(() => {
      if (container.style.opacity === "0") container.style.display = "none";
    }, 200);
    return;
  }

  container.style.display = "block";
  container.style.opacity = "1";

  // Sort by the timestamp closest to Current Time (to determine order)
  activeTokens.sort((a, b) => {
    const getClosest = (timestamps: number[]) => {
      return timestamps.reduce((prev, curr) =>
        Math.abs(curr - currentTime) < Math.abs(prev - currentTime)
          ? curr
          : prev
      );
    };
    return getClosest(a.timestamps) - getClosest(b.timestamps);
  });

  // Render
  // Optimization: Only re-render if the list of words has changed to avoid layout thrashing
  const newHTML = activeTokens
    .map((t) => {
      // Get color from settings based on level
      let badgeColor = "#999";
      if (t.category === "word" && t.cefr && settings.highlights[t.cefr]) {
        badgeColor = settings.highlights[t.cefr].color;
      } else if (t.category === "norank" && settings.highlights.norank) {
        badgeColor = settings.highlights.norank.color;
      }

      return `
      <div class="vocab-item" style="border-left: 3px solid ${badgeColor}">
        <div class="vocab-word">${t.word}</div>
        <div class="vocab-trans">${t.translation || "..."}</div>
        <div class="vocab-meta">
            <span>${t.cefr || "Unknown"}</span>
        </div>
      </div>
    `;
    })
    .join("");

  if (container.innerHTML !== newHTML) {
    container.innerHTML = newHTML;
  }
}
