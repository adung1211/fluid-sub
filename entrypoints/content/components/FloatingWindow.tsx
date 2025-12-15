import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TokenData } from '../utils/fetcher';
import { SubtitleSettings, SETTINGS_KEY, DEFAULT_SETTINGS } from '../utils/settings';
import { showWordDetail } from '../utils/word-detail';
import { browser } from 'wxt/browser';

export const ID_FLOATING_WINDOW = "wxt-floating-vocab-window";

interface Props {
  tokens: TokenData[];
  currentTime: number;
  settings: SubtitleSettings;
  isLoading: boolean;
  errorMessage: string | null;
  visible: boolean;
}

interface DisplayItem {
  token: TokenData;
  start: number;
  end: number;
  uniqueKey: string;
}

export const FloatingWindow: React.FC<Props> = ({ 
  tokens, 
  currentTime, 
  settings, 
  isLoading, 
  errorMessage,
  visible
}) => {
  const [position, setPosition] = useState({ x: 0, y: 100, isSet: false });
  const [height, setHeight] = useState(settings.floatingWindowHeight || 350);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize position once based on viewport
  useEffect(() => {
    if (!position.isSet) {
      setPosition({ 
        x: window.innerWidth - 240, // 20px from right (width is 220)
        y: 100,
        isSet: true 
      });
    }
  }, [position.isSet]);

  // --- Drag Logic ---
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = position.x;
    const startTop = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setPosition(prev => ({ ...prev, x: startLeft + dx, y: startTop + dy }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position]);

  // --- Resize Logic ---
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    document.body.style.cursor = "ns-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = moveEvent.clientY - startY;
      setHeight(Math.max(150, startHeight + dy));
    };

    const handleMouseUp = async () => {
      document.body.style.cursor = "";
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save new height
      try {
        const stored = await browser.storage.local.get(SETTINGS_KEY);
        const current = stored[SETTINGS_KEY] || DEFAULT_SETTINGS;
        // Accessing the latest height from state inside the closure might be stale if we didn't use refs,
        // but here we just need the final value. 
        // Better to calculate final height based on mouse up or trust the state if it updated fast enough.
        // We will just read the DOM element's actual height or current state.
        // Using a ref for height might be safer for async saves, but let's try reading state.
      } catch (e) {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);
  
  // Save height to settings when it changes (debounced ideally, but simple for now)
  useEffect(() => {
    const saveHeight = async () => {
      try {
        const stored = await browser.storage.local.get(SETTINGS_KEY);
        const current = stored[SETTINGS_KEY] || DEFAULT_SETTINGS;
        if (current.floatingWindowHeight !== height) {
           await browser.storage.local.set({ [SETTINGS_KEY]: { ...current, floatingWindowHeight: height } });
        }
      } catch (e) {}
    };
    const timer = setTimeout(saveHeight, 500);
    return () => clearTimeout(timer);
  }, [height]);


  // --- Filter Items ---
  const getDisplayItems = () => {
    const startWindow = currentTime - settings.floatingTimeWindow;
    const endWindow = currentTime + settings.floatingTimeWindow;
    const items: DisplayItem[] = [];

    tokens.forEach((token) => {
      const validSegments = token.timestamps.filter(
        (ts) => ts.start <= endWindow && ts.end >= startWindow
      );
      validSegments.forEach((seg) => {
        items.push({
          token: token,
          start: seg.start,
          end: seg.end,
          uniqueKey: `${token.word}-${seg.start}`,
        });
      });
    });
    return items.sort((a, b) => a.start - b.start);
  };

  const displayItems = getDisplayItems();

  // --- Styles ---
  // We inject the keyframe styles once
  useEffect(() => {
    const styleId = "wxt-react-floating-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        @keyframes wxt-spin { to { transform: rotate(360deg); } }
        @keyframes wxt-slide-in {
          from { opacity: 0; transform: translateY(10px) scale(0.95); max-height: 0; margin-bottom: 0; padding: 0 10px; border-width: 0; }
          to { opacity: 1; transform: translateY(0) scale(1); max-height: 100px; margin-bottom: 8px; padding: 10px; border-width: 2px; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!settings.enabled || !settings.floatingWindowEnabled) return null;

  return (
    <div
      id={ID_FLOATING_WINDOW}
      ref={containerRef}
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        width: "220px",
        height: `${height}px`,
        minHeight: "150px",
        maxHeight: "80vh",
        backgroundColor: "rgba(20, 20, 20, 0.95)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: "9999",
        display: visible ? "flex" : "none",
        flexDirection: "column",
        fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
        color: "#fff",
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleDragStart}
        style={{
          height: "24px",
          background: "transparent",
          cursor: "grab",
          borderRadius: "16px 16px 0 0",
          marginBottom: "0px",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ width: "32px", height: "4px", background: "rgba(255,255,255,0.2)", margin: "10px auto", borderRadius: "2px" }}></div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: "absolute", top: "24px", left: 0, width: "100%", height: "calc(100% - 40px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(20,20,20,0.8)", zIndex: 10, backdropFilter: "blur(2px)", borderRadius: "0 0 16px 16px"
        }}>
          <div style={{
            width: "30px", height: "30px", border: "3px solid rgba(255,255,255,0.3)",
            borderRadius: "50%", borderTopColor: "#4CAF50", animation: "wxt-spin 1s ease-in-out infinite"
          }}></div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && !isLoading && (
         <div style={{
          height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          color: "#aaa", padding: "20px", animation: "wxt-slide-in 0.3s forwards"
        }}>
          <div style={{ fontSize: "12px", lineHeight: "1.4" }}>{errorMessage}</div>
        </div>
      )}

      {/* Content */}
      <div style={{
        overflowY: "auto", padding: "0 10px", flex: 1, scrollbarWidth: "thin", minHeight: "40px"
      }}>
        {!isLoading && !errorMessage && displayItems.map(item => (
          <VocabItem 
            key={item.uniqueKey} 
            item={item} 
            settings={settings} 
            currentTime={currentTime} 
          />
        ))}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          height: "16px", width: "100%", cursor: "ns-resize", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", borderRadius: "0 0 16px 16px"
        }}
      >
        <div style={{ display: "flex", gap: "3px", opacity: 0.3 }}>
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff" }}></div>
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff" }}></div>
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff" }}></div>
        </div>
      </div>
    </div>
  );
};

const VocabItem: React.FC<{ item: DisplayItem, settings: SubtitleSettings, currentTime: number }> = ({ item, settings, currentTime }) => {
  const isActive = currentTime >= item.start && currentTime <= item.end;
  const isPassed = currentTime > item.end;
  
  let badgeColor = "#999";
  if (item.token.cefr && settings.highlights[item.token.cefr]) {
    badgeColor = settings.highlights[item.token.cefr].color;
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // We need to pass the current target as the anchor for the popover
    showWordDetail(item.token.root || item.token.word, e.currentTarget as HTMLElement);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        marginBottom: "8px", padding: "10px", borderRadius: "8px",
        background: isActive ? "rgba(76, 175, 80, 0.12)" : "rgba(255,255,255,0.05)",
        border: "2px solid",
        borderColor: isActive ? "#4CAF50" : "transparent",
        borderLeft: `4px solid ${badgeColor}`,
        display: "flex", flexDirection: "column", position: "relative",
        transform: isActive ? "scale(1.02)" : "translateZ(0)",
        transition: "all 0.4s ease",
        cursor: "pointer",
        opacity: isPassed ? 0.5 : 1,
        filter: isPassed ? "grayscale(100%)" : "none",
        zIndex: isActive ? 2 : 1,
        boxShadow: isActive ? "0 4px 12px rgba(76, 175, 80, 0.15)" : "none",
        animation: "wxt-slide-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards"
      }}
      className="wxt-vocab-item-react" 
    >
      <div style={{ fontWeight: 700, fontSize: "15px", color: isPassed ? "#aaa" : "#fff", marginBottom: "2px" }}>
        {item.token.word}
      </div>
      <div style={{ fontSize: "13px", color: isPassed ? "#777" : "#ddd", lineHeight: "1.3" }}>
        {item.token.translation || "..."}
      </div>
      <div style={{ fontSize: "10px", color: isPassed ? "#555" : "#888", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{item.token.cefr || "NA"}</span>
        <span style={{ background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: "4px", fontFamily: "monospace" }}>
          {formatTime(item.start)}
        </span>
      </div>
    </div>
  );
};
