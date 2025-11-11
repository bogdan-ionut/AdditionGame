# Google Cloud Chirp 3 HD integration analysis

## Context
- The AdditionGame app is a static React/Vite site that we deploy to GitHub Pages, so we currently ship only client-side assets with no persistent server components.【F:README.md†L5-L35】
- Text-to-speech today is implemented entirely in the browser via the Gemini SDK: we keep the API key in build-time env/localStorage, call `@google/genai` directly from the client, and lean on IndexedDB-backed caching/rate-limit logic inside `src/api/tts.ts`.【F:src/api/tts.ts†L1-L120】【F:src/api/tts.ts†L486-L627】
- Parent AI settings already expose Gemini-centric knobs (voice id, language, "Model Gemini TTS", audio format, sample rate, pitch) that persist to local settings state.【F:src/components/ParentAISettings.jsx†L1367-L1479】

The proposal introduces a Google Cloud Text-to-Speech proxy (Chirp 3 HD + WaveNet) sitting behind a new Node/Express service, and expects the browser client to route traffic through it when a user selects that provider.

## Fit with our architecture

### Hosting model impact
- Because our production deployment is static hosting on GitHub Pages, we do not have an existing runtime for an Express proxy. Adopting the proposal therefore mandates new infrastructure (e.g. Cloud Run + service account) and a deployment pipeline separate from the current Pages workflow. We would need to manage secrets, billing, and a secure origin allowlist outside of GitHub Actions.
- Local development would also need adjustment: today the Vite dev server proxies everything; with a Cloud TTS proxy we would either need to run the Express app locally (and add a Vite proxy entry) or rely on a remote instance that accepts localhost origins. That is a non-trivial shift in our dev ergonomics.

### Client/runtime considerations
- Our TTS module assumes direct Gemini access and enforces rate limits, caching keys, and prompt flavors under that model name. To reuse the IndexedDB cache we must mint distinct `model` identifiers (e.g. `gcloud-tts`) and ensure the `format` string follows our builder so clips stay separable.【F:src/api/tts.ts†L492-L615】【F:src/lib/audio/cache.ts†L32-L104】
- The proposal’s response contract (`audioBase64`) is compatible with our existing blob handling, but the current code expects an inlineData structure from Gemini. Introducing the Cloud proxy means creating a parallel synthesize path that bypasses `client.models.generateContent` entirely and manually stores blobs in the cache with descriptors that include provider + voice.
- We do not yet have provider-level toggles in settings. Renaming “Model Gemini TTS” to “TTS Provider” and injecting dynamic voice lists requires UI changes plus persistence updates so that existing localStorage migrations keep working. Settings consumers elsewhere in the codebase assume Gemini ids and may need guardrails when the provider is not Gemini.

### Security & privacy
- Moving prompts through our server proxy does mitigate exposing Google Cloud credentials, but it also changes our data residency story: prompts that currently stay on the client would now transit through our backend infrastructure. We must ensure logging/monitoring stays within contract (the proposal suggests request IDs only) and review our privacy policy accordingly.
- The 1 KB payload cap aligns with our math use case, but we should enforce it both client- and server-side to avoid accidental oversize prompts given that the existing UI allows narrating arbitrary parent-generated stories.

### Resilience & fallbacks
- Our current Gemini client already handles retries, exponential backoff, and daily/minute rate limits on the front end. For the Google Cloud path we would need equivalent retry semantics in the proxy (or surface structured error codes so the client can fall back to Gemini gracefully). Otherwise the UX regresses when the Cloud endpoint rate-limits.
- The proposal’s WaveNet fallback expects SSML support; however, our client-side speechConfig builder currently emits Gemini-flavored parameters. We would have to expand the settings schema to capture when SSML is active and ensure our normalizer for “problem” prompts continues to respect the verbatim-only requirement before hitting Chirp.

## Gaps / adaptations required
1. **Infrastructure** – provision and manage a Cloud Run (or equivalent) deployment, CI/CD, and service account with `roles/texttospeech.user`. This is new operational overhead compared to our static site.
2. **Client refactor** – split `src/api/tts.ts` so Gemini and Google Cloud providers share caching but have isolated synthesis flows. We also need provider-aware error handling and a way to inject the Cloud base URL (especially for local vs. production).
3. **Settings persistence** – extend the settings model to remember provider + voice/SSML flags without breaking existing saved preferences. That likely touches reducers/selectors beyond `ParentAISettings`.
4. **Access control** – enforce CORS and auth in the proxy while keeping the experience smooth for localhost/Pages origins; we may need a lightweight auth token or signed requests if we do not want to rely solely on origin headers.
5. **Cost monitoring** – Gemini usage is currently controlled by the end-user’s API key. Once we front Google Cloud, the billing responsibility moves to us, so we need quotas, monitoring, and possibly per-user rate limiting on the proxy to stay within budget.

## Plan A – fully static “voice pack” alternative

Because our production stack is already a static Vite build hosted on GitHub Pages, we can ship pre-generated MP3 assets without adding a backend. All files placed under `public/` are copied verbatim into the final bundle that Pages serves, so a locally synthesized library of Chirp 3 HD clips would be available at runtime with zero architectural changes to deployment.【F:README.md†L5-L35】【F:vite.config.js†L1-L9】

### Why it matches the repo
- The only math prompt that hits TTS today is generated from `speakProblem`, which deterministically emits strings such as `Cât face 2 + 3?` in Romanian.【F:src/lib/tts/index.ts†L318-L369】 Enumerating the limited operand/operator space lets us pre-render every clip offline.
- Our `speak()` flow already hashes prompt metadata into a `TtsDescriptor` and writes blobs to IndexedDB. Adding a `model: "gcloud-tts-local"` (or similar) branch that maps descriptors to static file URLs keeps caching semantics intact while still reusing playback/storage helpers.【F:src/lib/tts/index.ts†L253-L347】【F:src/lib/audio/cache.ts†L32-L104】
- Shipping audio through `public/audio/...` aligns with the repo’s existing asset strategy; no additional bundler plugins are required, and the assets can be version-controlled alongside a manifest for lookup.

### Implementation outline inside this project
1. **Offline synthesis script** – Create a Node CLI (e.g., `scripts/build-chirp-pack.mjs`) that enumerates all prompt variants, calls Google Cloud TTS with a developer-held service account, and writes files to `public/audio/ro-RO/chirp3-hd-a/<sha1>.mp3` plus a JSON manifest describing text → file mapping. The service account key and generation step stay local and out of git.
2. **Manifest loader** – Add a lightweight module (for example `src/data/tts-packs/chirp3-ro.json`) generated by the script or imported at build time. During startup we can load it into memory to translate prompts to file paths.
3. **Provider plumbing** – Extend settings to expose a “Chirp 3 HD (local pack)” option. When selected, pass `model: "gcloud-tts-local"` into `speak()` so the descriptor keys new cache entries without conflicting with Gemini recordings.【F:src/components/ParentAISettings.jsx†L1367-L1479】【F:src/lib/tts/index.ts†L253-L347】
4. **Static fetch path** – In the Gemini synthesize call site, branch on the provider: instead of invoking the remote API, fetch the pre-baked MP3 via `fetch(new URL(path, import.meta.env.BASE_URL))`, wrap it in a Blob, and feed it through the same caching/playback logic. Because the files live on our CDN, `fetch` works in both dev (`vite` serves `/public`) and production (`/AdditionGame/` base path).
5. **Quality assurance** – Regenerate audio whenever prompt text changes, sanity-check a few clips, and commit the assets plus manifest. Storage overhead is small (hundreds of clips × ~20 KB each).

### Trade-offs
- **Pros** – Zero runtime infra, consistent Chirp 3 HD quality, predictable cost (one-time generation), and continues honoring the verbatim math contract because prompts never touch a live model. Works offline after first load thanks to IndexedDB.
- **Cons** – Static coverage only: ad-hoc parent stories or new prompt variations would require regenerating and re-deploying the pack. We also depend on developers to own the private service account used during asset generation.

## Recommendation
If we want live flexibility (arbitrary prompts, pitch controls, WaveNet fallback), adopting the proxy architecture remains viable but comes with the infrastructure and operational commitments noted above. If our immediate goal is to upgrade the quality of deterministic math prompts without leaving the GitHub Pages comfort zone, the static “voice pack” Plan A fits perfectly within this repo and can ship today with modest scripting effort. We can start with the static pack and reassess the proxy once we outgrow the pre-generated inventory.
