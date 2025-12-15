# FluidSub - Project Context

## Overview
**FluidSub** is a browser extension designed to enhance the YouTube learning experience by overlaying standard captions with intelligent, educational context. It transforms passive video consumption into an active language learning session.

## Tech Stack
- **Framework:** [WXT](https://wxt.dev/) (Web Extension Tools)
- **Language:** TypeScript
- **Backend:** Python (External dependency/service)
- **Platforms:** Chrome, Edge

## Project Structure

### Entrypoints (`entrypoints/`)
- **`background.ts`**: The extension's service worker/background script.
- **`popup/`**: The browser action popup (UI and logic).
- **`content/`**: Content scripts injected into web pages (specifically YouTube).
  - **`index.ts`**: Main entry point for the content script.
  - **`utils/`**: Helper modules for the content script:
    - `fetcher.ts`: Handles data fetching (likely from the backend).
    - `floating-window.ts`: Manages floating UI elements.
    - `highlighter.ts`: Logic for highlighting vocabulary based on CEFR levels.
    - `subtitle-overlay.ts`: Controls the custom subtitle display overlay.
    - `word-detail.ts`: logic for showing details about specific words.
    - `settings.ts`: Manages extension settings.

### Components (`components/`)
- Reusable UI components (e.g., `counter.ts`).

### Configuration
- **`wxt.config.ts`**: Configuration file for the WXT framework.
- **`package.json`**: Dependencies and scripts.

## Key Features
- **Refined Caption Display**: Replaces/overlays standard YouTube subtitles.
- **CEFR Level Highlighting**: Detects and highlights words based on proficiency levels (A1, A2, B1, etc.).
- **Smart Anticipation**: Visualizes complex vocabulary before it appears.

## Development Commands
- `npm run dev`: Start the development server (Chrome).
- `npm run dev:firefox`: Start the development server (Firefox).
- `npm run build`: Build the extension for production.
- `npm run compile`: Run TypeScript type checking.
- `npm run zip`: Package the extension for distribution.
