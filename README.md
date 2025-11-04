# AdditionGame

An addition game for my 3.5 year old boy.

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

