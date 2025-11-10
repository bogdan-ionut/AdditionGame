# Audio cache service

The audio narration pipeline now keeps Gemini TTS clips in the browser so that repeated prompts can be replayed instantly without calling the API again.

## Storage model

- Clips are stored in IndexedDB (`addition-game-audio-cache/clips`) and keyed by:
  - Normalised prompt text (lowercase, collapsed whitespace)
  - Voice, language, model, speaking rate, pitch and narration type (`problem`, `hint`, etc.)
- A small summary (entry count + total bytes) is mirrored in `localStorage` under `addition-game.audio.cache.summary.v1` so that the UI can show the current footprint without opening IndexedDB.
- The cache is capped at ~200 entries / 25 MB. Least-recently-used clips are pruned when limits are exceeded.
- Whenever the summary changes we dispatch `window` event `addition-game.audio.cache.updated` so other modules can react (e.g. to refresh UI badges).

## API

The cache helper lives in `src/lib/audio/cache.ts` and exposes:

| Function | Description |
| --- | --- |
| `getCachedAudioClip(descriptor)` | Returns a cached `Blob` for the given prompt settings or `null` if missing. |
| `storeAudioClip(descriptor, blob)` | Saves a generated clip (async, non-blocking). |
| `clearAudioCache()` / `deleteAudioClip()` | Removes everything or a single entry. |
| `getAudioCacheSummary()` | Lightweight `{ entryCount, totalBytes }` snapshot for UIs. |
| `formatCacheSize(bytes)` | Helper for rendering file-size strings. |
| `CACHE_EVENT_NAME` / `CACHE_SUMMARY_STORAGE_KEY` | Reusable identifiers for listeners. |

All helpers are no-ops when IndexedDB is unavailable, so you can call them from shared code without additional guards.

## Narration warm-up

`warmupNarrationCache` (`src/lib/audio/warmup.ts`) queues common phrases when narration is enabled:

- UI fallbacks, feedback phrases, and mini-lessons for the active language (plus English fallback).
- All addition questions (0–9) and the corresponding counting prompts.
- Work is scheduled with `requestIdleCallback` to avoid blocking the main thread. Each synthesis call first checks the cache, so clips are only generated the first time.

`useNarrationEngine` kicks off the warm-up whenever the learner enables narration or changes voice/model parameters.

## Developer notes

- Prefer routing all synthesis through `synthesize()` so cache lookups remain consistent.
- If you add new narration types, pass a stable `type`/`kind` so cached clips are isolated correctly.
- Use the `ParentAISettings` cache controls to verify behaviour and to clear storage during development.
