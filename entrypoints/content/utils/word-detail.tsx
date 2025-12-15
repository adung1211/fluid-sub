// entrypoints/content/utils/word-detail.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WordDetail, ID_WORD_DETAIL_POPUP } from '../components/WordDetail';

// --- Controller State ---

interface DetailState {
  word: string | null;
  triggerRect: DOMRect | null;
}

const initialState: DetailState = {
  word: null,
  triggerRect: null,
};

class WordDetailController {
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private state: DetailState = { ...initialState };

  private getRoot(): Root {
    if (!this.root) {
      let container = document.getElementById('wxt-word-detail-root');
      if (!container) {
        container = document.createElement('div');
        container.id = 'wxt-word-detail-root';
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
      <WordDetail
        word={this.state.word}
        triggerRect={this.state.triggerRect}
        onClose={() => this.hide()}
      />
    );
  }

  public show(word: string, triggerEl: HTMLElement) {
    this.state.word = word;
    this.state.triggerRect = triggerEl.getBoundingClientRect();
    this.render();
  }

  public hide() {
    this.state.word = null;
    this.state.triggerRect = null;
    this.render();
  }
}

const controller = new WordDetailController();

// --- Exported Facade ---

export function showWordDetail(word: string, triggerEl: HTMLElement) {
  controller.show(word, triggerEl);
}

export function hideWordDetail() {
  controller.hide();
}
