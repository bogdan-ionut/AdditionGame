# AdditionGame

An addition game for my 3.5 year old boy.

## Local development

This repository now uses [Vite](https://vitejs.dev/) for the React build. To run the app locally:

1. Install dependencies with `npm install`.
2. Start the dev server with `npm run dev` and open the printed URL.
3. Create a production bundle with `npm run build` (artifacts land in `dist/`).
4. Preview the production build with `npm run preview` if needed.

### Environment configuration

Create a `.env.local` (or the appropriate Vite environment file) with your Gemini API key if you want narration and AI-driven
stories to work:

```
VITE_GEMINI_API_KEY=AIza...
```

The key is read at build time and also cached in `localStorage` when you enter it through **AI Settings**. If you skip this
step, the app still runs but narration falls back to on-device voices or remains muted.

## GitHub Pages deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the app and publishes the contents of `dist/` to the `gh-pages` branch on every push to `main`. Enable **Settings → Pages → Deploy from branch → gh-pages** to serve the latest build at `https://<username>.github.io/AdditionGame/`.

## Data export folders

Two folders are available for saving JSON exports or other assets:

- `public/exports/` – bundled with the static site so files are publicly accessible.
- `data/exports/` – version-controlled alongside the source but not exposed at runtime.

## Feature Implementation Status

### Implemented
- **Real-time dashboard metrics** covering today's minutes from `dailyTotals`, average time per problem, focus vs. waste, struggle zones, mastery by number, and 7-day growth rate vs. baseline. The parent dashboard pulls these metrics directly from saved session data.
- **Dashboard accuracy** now calculated as total-correct divided by total-attempts, ensuring the headline metric matches in-session accuracy tracking.
- **Coverage tracking** for the full (0..9)×(0..9) grid, marking a problem pair as covered once it has at least one correct answer.
- **Mastery gates** for the "Adding with _n_" modes, which unlock only after the previous number reaches the mastered threshold.
- **Adaptive difficulty** that shifts between easy/medium/hard based on streaks and recent timing data.
- **Spaced review queue** with 10m → 1h → 1d intervals and a REVIEW badge on due cards.
- **Lightweight checkpoints** every 10 problems that inject up to five low-accuracy review items.
- **Checkpoint tests** that require an 80% accuracy pass gate before resuming the main deck, with automatic retries on a miss.
- **Automatic hinting** after two incorrect attempts, including the interactive number-line helper.
- **Struggle detector & auto-help** with difficulty downgrades, auto hints after repeat misses, a 30-second inactivity trigger, and guided counting animation support.
- **WASTE detection** for too-fast/too-slow answers and for patterned inputs delivered in under three seconds.
- **Progress portability** via JSON import/export plus automatic persistence to `localStorage`.
- **State migration/versioning** through `migrateGameState` (current schema `1.2.0`).
- **Countable SVG objects** and celebration overlays for each digit from 0–9.
- **Fully individualized learning paths** that analyze mastery data, streaks, and per-number accuracy to unlock AI-curated focus targets even if the previous number is not yet mastered.
- **Knowledge vs. age grade insights** that translate progress into grade-band language and highlight alignment gaps in the parent dashboard.
- **Growth tracking** that pairs the 7-day growth multiplier with a comparative chart against a typical practice baseline.

### Partially Implemented
- _None at this time._

### Not Implemented
- **Multi-modal supports** such as TTS audio, drag-and-drop number lines, or instructional videos.
- **Progress visualizations** like Jenga towers, trophies, or printable mastery certificates.
- **Adaptive breaks** (e.g., child-friendly Pomodoro timers).
- **Chapter-style progress bars** that track segments independently of global coverage.
- **Printable review reports** or UI exposure of `reviewNeeded` items.
- **Initial assessment mode** for rapid difficulty calibration.
- **Audio feedback** for positive/negative responses or narrated equations.

