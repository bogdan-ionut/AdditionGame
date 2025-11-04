# AdditionGame

An addition game for my 3.5 year old boy.

## Feature Implementation Status

### Implemented
- **Real-time dashboard metrics** covering today's minutes from `dailyTotals`, average time per problem, focus vs. waste, struggle zones, mastery by number, and 7-day growth rate vs. baseline. The parent dashboard pulls these metrics directly from saved session data.
- **Coverage tracking** for the full (0..9)×(0..9) grid, marking a problem pair as covered once it has at least one correct answer.
- **Mastery gates** for the "Adding with _n_" modes, which unlock only after the previous number reaches the mastered threshold.
- **Adaptive difficulty** that shifts between easy/medium/hard based on streaks and recent timing data.
- **Spaced review queue** with 10m → 1h → 1d intervals and a REVIEW badge on due cards.
- **Lightweight checkpoints** every 10 problems that inject up to five low-accuracy review items.
- **Automatic hinting** after two incorrect attempts, including the interactive number-line helper.
- **WASTE detection** for too-fast/too-slow answers and for patterned inputs delivered in under three seconds.
- **Progress portability** via JSON import/export plus automatic persistence to `localStorage`.
- **State migration/versioning** through `migrateGameState` (current schema `1.2.0`).
- **Countable SVG objects** and celebration overlays for each digit from 0–9.

### Partially Implemented
- **Dashboard accuracy** currently measures the share of unique problems with a correct answer, not total-correct divided by total-attempts.
- **Struggle detector & auto-help** provides hints after repeated mistakes and can lower difficulty, but it lacks the "30s without response" trigger and the guided counting animation.
- **Growth tracking** surfaces a 7-day growth multiplier but has no comparative chart against typical performance.
- **Checkpoint tests** only inject review problems; there is no pass/fail gate (e.g., 80% mastery) before resuming the main deck.

### Not Implemented
- **Fully individualized learning paths** beyond the `n-1` mastery gates.
- **Knowledge grade vs. age grade readouts** or related visualizations.
- **Multi-modal supports** such as TTS audio, drag-and-drop number lines, or instructional videos.
- **Progress visualizations** like Jenga towers, trophies, or printable mastery certificates.
- **Adaptive breaks** (e.g., child-friendly Pomodoro timers).
- **Chapter-style progress bars** that track segments independently of global coverage.
- **Printable review reports** or UI exposure of `reviewNeeded` items.
- **Initial assessment mode** for rapid difficulty calibration.
- **Audio feedback** for positive/negative responses or narrated equations.

