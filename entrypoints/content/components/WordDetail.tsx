import React, { useEffect, useState, useRef } from 'react';
import { browser } from "wxt/browser";
import { KNOWN_WORDS_KEY } from "../utils/settings";

export const ID_WORD_DETAIL_POPUP = "wxt-word-detail-popup";

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

interface Props {
  word: string | null;
  triggerRect: DOMRect | null;
  onClose: () => void;
}

export const WordDetail: React.FC<Props> = ({ word, triggerRect, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<DictionaryEntry | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!word || !triggerRect) return;

    setLoading(true);
    setError(false);
    setData(null);

    // Calculate Position
    const popupWidth = 300;
    const gap = 12;
    let top = triggerRect.top;
    let left = triggerRect.left - popupWidth - gap;

    if (left < 10) left = triggerRect.right + gap;
    const maxTop = window.innerHeight - 400;
    if (top > maxTop) top = maxTop;
    if (top < 10) top = 10;

    setPosition({ top, left });

    // Fetch Data
    const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`)
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(json => {
        setData(json[0]);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [word, triggerRect]);

  // Click Outside Listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        // Ensure we aren't clicking the trigger element itself (handled by parent logic usually, but good to check)
        // Also check if we are clicking INSIDE the floating window, if so, we might want to keep it open?
        // Original logic: "!(e.target as HTMLElement).closest(".wxt-vocab-item")"
        // But here, if we click outside THIS popup, we close.
        if (!(event.target as HTMLElement).closest(".wxt-vocab-item-react")) {
           onClose();
        }
      }
    };
    
    // Slight delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
       document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const playAudio = (url: string) => {
    new Audio(url).play();
  };

  const markAsKnown = async () => {
    if (!word) return;
    try {
      const storage = await browser.storage.local.get(KNOWN_WORDS_KEY);
      const list = (storage[KNOWN_WORDS_KEY] as string[]) || [];
      if (!list.includes(word)) {
        await browser.storage.local.set({ [KNOWN_WORDS_KEY]: [...list, word] });
        onClose();
      }
    } catch (e) {
      console.error("Failed to mark as known", e);
    }
  };

  if (!word) return null;

  const phoneticText = data?.phonetic || data?.phonetics.find((p) => p.text)?.text || "";
  const audioUrl = data?.phonetics.find((p) => p.audio && p.audio.length > 0)?.audio;

  return (
    <div
      ref={popupRef}
      id={ID_WORD_DETAIL_POPUP}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: "300px",
        maxHeight: "400px",
        backgroundColor: "rgba(30, 30, 30, 0.98)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "12px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        zIndex: 2147483650,
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Roboto", "Segoe UI", Arial, sans-serif',
        color: "#e0e0e0",
        overflow: "hidden",
        animation: "wxt-fade-in 0.2s ease forwards"
      }}
    >
      <style>{`
        @keyframes wxt-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .wxt-audio-btn:hover { background: rgba(76, 175, 80, 0.2); }
        .wxt-known-btn:hover { background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.2); }
        .wxt-detail-content::-webkit-scrollbar { width: 4px; }
        .wxt-detail-content::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start"
      }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "4px", textTransform: "capitalize" }}>
            {data?.word || word}
          </div>
          {phoneticText && (
            <div style={{ fontFamily: "monospace", color: "#aaa", fontSize: "13px" }}>{phoneticText}</div>
          )}
        </div>
        {audioUrl && (
          <button 
            className="wxt-audio-btn" 
            title="Play pronunciation"
            onClick={() => playAudio(audioUrl)}
            style={{
              cursor: "pointer", background: "transparent", border: "none", color: "#4CAF50",
              padding: "4px", borderRadius: "50%", transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="wxt-detail-content" style={{
        padding: "16px", overflowY: "auto", flex: 1, scrollbarWidth: "thin", maxHeight: "250px"
      }}>
        {loading && (
          <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
            <div style={{
               width: "24px", height: "24px", border: "2px solid rgba(255,255,255,0.1)",
               borderRadius: "50%", borderTopColor: "#4CAF50", animation: "wxt-spin 0.8s ease-in-out infinite"
            }}></div>
          </div>
        )}

        {error && (
          <div style={{ padding: "20px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>
            Definition not found.
          </div>
        )}

        {!loading && !error && data && data.meanings.slice(0, 3).map((meaning, i) => (
          <div key={i} style={{ marginBottom: "16px" }}>
            <span style={{
              display: "inline-block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
              background: "rgba(255,255,255,0.1)", color: "#ccc", padding: "2px 6px", borderRadius: "4px", marginBottom: "8px"
            }}>
              {meaning.partOfSpeech}
            </span>
            {meaning.definitions.slice(0, 3).map((def, j) => (
              <div key={j} style={{
                marginBottom: "8px", fontSize: "13px", lineHeight: 1.5, color: "#ddd", position: "relative", paddingLeft: "12px"
              }}>
                <span style={{ position: "absolute", left: 0, color: "#666" }}>•</span>
                {def.definition}
                {def.example && (
                  <div style={{ color: "#888", fontStyle: "italic", marginTop: "2px", fontSize: "12px" }}>
                    "{def.example}"
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)"
      }}>
        <button 
          className="wxt-known-btn"
          onClick={markAsKnown}
          style={{
            width: "100%", padding: "8px", background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.1)", color: "#ddd", borderRadius: "6px",
            cursor: "pointer", fontSize: "12px", fontWeight: 600, transition: "all 0.2s"
          }}
        >
          Mark as Known (Hide)
        </button>
      </div>
    </div>
  );
};
