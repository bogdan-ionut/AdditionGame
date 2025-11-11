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

## Manual narration precompute

`precomputeNarrationClips` (`src/lib/audio/warmup.ts`) exposes a user-triggered queue for generating batches of Gemini clips. The helper accepts the desired categories (praise, encouragement, mini-lessons, addition problems, counting prompts) and synthesises them on demand while yielding to `requestIdleCallback` between tasks.

Nothing is generated automatically at runtime. Instead, the parent/admin UI (`ParentAISettings`) offers a "Generare manuală" panel where adults can choose which packs to precompute and start/stop the batch explicitly. Each call still checks the cache first, so existing clips are reused and only missing prompts hit the API.

## Developer notes

- Prefer routing all synthesis through `synthesize()` so cache lookups remain consistent.
- If you add new narration types, pass a stable `type`/`kind` so cached clips are isolated correctly.
- Use the `ParentAISettings` cache controls to verify behaviour and to clear storage during development.

## Precomputing Google Cloud packs locally

You can generate Romanian addition clips offline and import them in bulk into the browser cache. The helper scripts in `scripts/` produce a ready-to-upload ZIP archive that matches the cache manifest format (`manifest.json` + `clips/<cache-key>.mp3`).

### 1. Prepare the environment

On macOS install the required command-line tools:

```bash
brew install google-cloud-sdk jq
```

Authenticate once with application-default credentials so the script can request short-lived tokens:

```bash
gcloud auth application-default login
```

Make sure `gcloud`, `jq`, `curl`, `base64`, `zip` and `node` (v18+) are available in `$PATH`.

### 2. Generate the audio clips and manifest

From the project root run:

```bash
./scripts/generate-gcloud-addition-pack.sh
```

The script synthesises the `0–9` addition table with the Google Cloud voice `ro-RO-Chirp3-HD-Kore`, saves human-readable MP3s under `audio/ro-RO/chirp3-hd-kore/raw/` and then builds a cache-ready pack under `audio/ro-RO/chirp3-hd-kore/pack/`. The final ZIP (`gcloud-ro-addition-pack.zip`) contains:

- `manifest.json` (version 1, marked with `model: "gcloud-tts"` and `voice: "ro-RO-Chirp3-HD-Kore"`)
- `clips/<cache-key>.mp3` for each problem

The script is idempotent: reruns skip existing MP3s. Use `--no-download` to rebuild the manifest/ZIP from previously downloaded audio files. You can also adjust the operand range (for example `--min 0 --max 12`) or the destination directory (`-o path/to/output`).

### 3. Import the pack in the app

In the Parent/Admin UI open the "Generare manuală" panel, choose `Importă pachet audio` and select `gcloud-ro-addition-pack.zip`. The import routine validates the manifest and stores each clip in IndexedDB under the cache key that matches the runtime descriptor (text `Cât face X plus Y?`, language `ro-RO`, voice `ro-RO-Chirp3-HD-Kore`, model `gcloud-tts`, rate `1`, pitch `1`, format `audio/mpeg`, sample-rate `24000`).

The clips are tagged with the provider metadata, so they stay separate from Gemini-generated content.
