// entrypoints/content/utils/floating-window.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TokenData } from "./fetcher";
import { SubtitleSettings, SETTINGS_KEY, DEFAULT_SETTINGS } from "./settings";
import { browser } from "wxt/browser";
import { FloatingWindow, ID_FLOATING_WINDOW } from '../components/FloatingWindow';

// --- Singleton State Management ---

interface WindowState {
  tokens: TokenData[];
  currentTime: number;
  settings: SubtitleSettings;
  isLoading: boolean;
  errorMessage: string | null;
  visible: boolean;
}

const initialState: WindowState = {
  tokens: [],
  currentTime: 0,
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  errorMessage: null,
  visible: false,
};

class FloatingWindowController {
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private state: WindowState = { ...initialState };

  private getRoot(): Root {
    if (!this.root) {
      // Create container if it doesn't exist
      let container = document.getElementById('wxt-react-root');
      if (!container) {
        container = document.createElement('div');
        container.id = 'wxt-react-root';
        // We append to body. The React component inside handles its own fixed positioning.
        document.body.appendChild(container);
      }
      this.container = container;
      this.root = createRoot(container);
    }
    return this.root;
  }

  private render() {
    const root = this.getRoot();
    root.render(
      <FloatingWindow
        tokens={this.state.tokens}
        currentTime={this.state.currentTime}
        settings={this.state.settings}
        isLoading={this.state.isLoading}
        errorMessage={this.state.errorMessage}
        visible={this.state.visible}
      />
    );
  }

  public async init() {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    const settings = (stored[SETTINGS_KEY] as SubtitleSettings) || DEFAULT_SETTINGS;
    this.state.settings = settings;
    this.state.visible = false; // Start hidden
    this.render(); 
  }

  public setLoading(isLoading: boolean) {
    this.state.isLoading = isLoading;
    if (isLoading) {
      this.state.errorMessage = null; // Clear error on load
      this.state.visible = true; // Show when loading starts
    }
    this.render();
  }

  public showError(message: string) {
    this.state.errorMessage = message;
    this.state.isLoading = false;
    this.state.visible = true; // Show to display error
    this.render();
  }

  public clear() {
    this.state.tokens = [];
    this.state.errorMessage = null;
    this.state.visible = false; // Hide when cleared
    this.render();
  }

  public update(allTokens: TokenData[], currentTime: number, settings: SubtitleSettings) {
    this.state.tokens = allTokens;
    this.state.currentTime = currentTime;
    this.state.settings = settings;
    // Only show if we have tokens or if previously visible (e.g. keeping window open even if empty segments?)
    // Actually, `update` is called continuously. We want to ensure it's visible if enabled.
    if (settings.enabled) {
        this.state.visible = true;
    } else {
        this.state.visible = false;
    }
    this.render();
  }
}

const controller = new FloatingWindowController();

// --- Exported Facade (API Compatibility) ---

export async function initFloatingWindow() {
  await controller.init();
}

export async function setFloatingWindowLoading(isLoading: boolean) {
  controller.setLoading(isLoading);
}

export async function showFloatingErrorMessage(message: string) {
  controller.showError(message);
}

export function clearFloatingWindow() {
  controller.clear();
}

export function updateFloatingWindow(
  allTokens: TokenData[],
  currentTime: number,
  settings: SubtitleSettings
) {
  controller.update(allTokens, currentTime, settings);
}
