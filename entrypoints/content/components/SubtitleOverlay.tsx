import React, { useEffect, useState } from 'react';
import { SubtitleSettings } from '../utils/settings';

export const ID_SUBTITLE_LAYER = "wxt-subtitle-layer";

interface Props {
  htmlText: string | null;
  settings: SubtitleSettings;
}

export const SubtitleOverlay: React.FC<Props> = ({ htmlText, settings }) => {
  const [bottomPos, setBottomPos] = useState("10%");
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    // Hide native YT captions
    const styleId = "wxt-hide-native-subs";
    let styleTag = document.getElementById(styleId);
    if (settings.enabled) {
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        styleTag.innerHTML = `.ytp-caption-window-container, .caption-window { display: none !important; }`;
        document.head.appendChild(styleTag);
      }
    } else {
      if (styleTag) styleTag.remove();
    }
    
    return () => {
        // We generally persist this unless the component unmounts entirely (feature disabled)
        // But the parent controller manages the "enabled" state too.
        // Let's rely on the parent or the `enabled` prop logic above.
    };
  }, [settings.enabled]);

  useEffect(() => {
      // Monitor YouTube player controls to adjust position and view mode
      const player = document.getElementById("movie_player") || document.body;
      const flexy = document.querySelector("ytd-watch-flexy");

      const updateState = () => {
          // 1. Update Position based on controls
          const controlsHidden = player.classList.contains("ytp-autohide");
          setBottomPos(controlsHidden ? "10%" : "20%");

          // 2. Update Font Scale based on view mode
          const isFullscreen = !!document.fullscreenElement || player.classList.contains("ytp-fullscreen");
          const isTheater = flexy?.hasAttribute("theater");

          if (isFullscreen) {
              setFontScale(1.8); 
          } else if (isTheater) {
              setFontScale(1.3);
          } else {
              setFontScale(1.0);
          }
      };

      const observer = new MutationObserver(updateState);
      
      // Observe player for class changes (fullscreen, autohide)
      observer.observe(player, { attributes: true, attributeFilter: ["class"] });

      // Observe flexy for theater mode
      if (flexy) {
          observer.observe(flexy, { attributes: true });
      }

      // Also listen to standard fullscreen events
      document.addEventListener("fullscreenchange", updateState);
      
      // Initial call
      updateState();

      return () => {
          observer.disconnect();
          document.removeEventListener("fullscreenchange", updateState);
      };
  }, []);


  if (!settings.enabled || !htmlText) return null;

  return (
    <div
      id={ID_SUBTITLE_LAYER}
      className="wxt-subtitle-overlay"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: bottomPos,
        fontFamily: '"YouTube Noto", Roboto, Arial, sans-serif',
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.4,
        borderRadius: "8px",
        padding: "8px 16px",
        zIndex: 2147483647,
        maxWidth: "80%",
        display: "block",
        transition: "bottom 0.2s, background-color 0.2s, color 0.2s, font-size 0.2s",
        pointerEvents: "auto",
        userSelect: "text",
        cursor: "text",
        fontSize: `${settings.fontSize * fontScale}px`,
        backgroundColor: `rgba(0, 0, 0, ${settings.bgOpacity})`,
        color: `rgba(255, 255, 255, ${settings.textOpacity})`,
      }}
      // Use dangerouslySetInnerHTML because we have pre-highlighted HTML spans
      dangerouslySetInnerHTML={{ __html: htmlText }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
};
