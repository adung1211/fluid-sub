# FluidSub - Project Context

## Overview
**FluidSub** is a browser extension designed to enhance the YouTube learning experience by overlaying standard captions with intelligent, educational context. It transforms passive video consumption into an active language learning session.

## Tech Stack
- **Framework:** [WXT](https://wxt.dev/) (Web Extension Tools)
- **UI Library:** React (v18)
- **Language:** TypeScript
- **Backend:** Python (External dependency/service)
- **Platforms:** Chrome, Edge

## Project Structure

### Entrypoints (`entrypoints/`)
- **`background.ts`**: The extension's service worker/background script.
- **`popup/`**: The browser action popup (UI and logic).
- **`content/`**: Content scripts injected into web pages (specifically YouTube).
  - **`index.ts`**: Main orchestrator for the content script. Handles page navigation events and delegates initialization.
  - **`components/`**: React components for the content UI.
    - `SubtitleOverlay.tsx`: The main subtitle display component.
    - `FloatingWindow.tsx`: Side panel for anticipating vocabulary.
    - `WordDetail.tsx`: Component for displaying detailed word info.
  - **`interfaces/`**: TypeScript interfaces (e.g., `Subtitle.ts`).
  - **`utils/`**: Logic controllers and helpers that bridge WXT/YouTube events with React components:
    - `fetcher.ts`: Handles data fetching (subtitles, translations).
    - `floating-window.tsx`: Controller for the FloatingWindow component.
    - `highlighter.ts`: Logic for highlighting vocabulary based on CEFR levels.
    - `subtitle-overlay.tsx`: Controller for the SubtitleOverlay component (syncs with video time).
    - `word-detail.tsx`: Controller/logic for word details.
    - `settings.ts`: Manages extension settings.

### Configuration
- **`wxt.config.ts`**: Configuration file for the WXT framework.
- **`package.json`**: Dependencies and scripts.

### Public Assets
- **`public/`**: Static assets, including extension icons.
  - **`wxt.svg`**: WXT framework logo.
  - **`icon/`**: Directory containing various sizes of the extension icon.
    - `128.png`, `16.png`, `32.png`, `48.png`, `96.png`: Different dimensions of the extension icon.

## Key Features
- **Refined Caption Display**: React-based overlay replacing standard YouTube subtitles.
- **CEFR Level Highlighting**: Detects and highlights words based on proficiency levels (A1, A2, B1, etc.).
- **Smart Anticipation**: Visualizes complex vocabulary before it appears using a floating window.
- **Interactive Learning**: Click on words to see detailed definitions and translations.

## Development Commands
- `npm run dev`: Start the development server (Chrome).
- `npm run dev:firefox`: Start the development server (Firefox).
- `npm run build`: Build the extension for production.
- `npm run compile`: Run TypeScript type checking.
- `npm run zip`: Package the extension for distribution.