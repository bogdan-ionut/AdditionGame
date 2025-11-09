# Codex Prompts for AdditionGame Frontend Enhancements

The following prompts are designed to guide Codex in implementing the remaining multimedia and gamification features in the AdditionGame frontend. Each prompt references existing modules and utilities so the generated code integrates with the current architecture.

---

## 1. Text-to-Speech Narration for Problems and Hints

"""
Update `src/modules/addition/AdditionWithinTenApp.jsx` so every time a new practice card becomes active its problem statement is spoken aloud. Use the existing `useNarrationEngine` hook (already imported near the top of the file) and call the `speakProblem(card, { story })` helper inside the effect that reacts to `currentCard` changes. Ensure the spoken line includes the active theme context (use `aiSessionMeta?.story` to fetch context phrases) and falls back to English narration when no locale is specified.

Also wire up narration for hints: whenever `showHint` flips to `true` or the user opens a number-line mini-lesson, call `speakHint(hintText, { story })`. The hint text should reuse the string passed into the UI (e.g., "Numără de la ${a} încă ${b} pași"). Make sure narration respects `audioSettings.narrationEnabled` and does not trigger when the learner has muted narration.
"""

---

## 2. Audio Feedback and Low-Stim Mode

"""
Enhance the feedback flow in `AdditionWithinTenApp.jsx` by playing sound effects and spoken feedback on user answers. Inside the `checkAnswer` logic (and any other path that marks an attempt as correct/incorrect), call `playSfx('success')` and `speakFeedback(true, { story })` when answers are correct, and `playSfx('error')` / `speakFeedback(false, { story })` when incorrect. Add a celebratory `playSfx('progress')` whenever the `streak` counters reach multiples of five or the learner levels up.

Implement a Low-Stim audio toggle within the existing settings drawer (see `ParentAISettings` usage). Persist the choice in audio preferences by extending `AudioSettings` in `src/lib/audio/preferences.ts` with a `lowStimMode` boolean and exposing it in the `useNarrationEngine` hook. When low-stim is enabled, reduce narration and SFX volume (e.g., scale to 0.4) and skip longer celebratory clips.
"""

---

## 3. Drag-and-Drop Manipulatives / Interactive Number Line

"""
Extract the inline `NumberLine` helper inside `src/modules/addition/AdditionWithinTenApp.jsx` into a reusable component `src/components/InteractiveNumberLine.jsx`. Preserve the existing SVG visuals, but add a draggable marker the learner can move between ticks. The marker should snap to integer positions between 0 and 10 (or `max`) and emit callbacks like `onMove(start, end)` so the parent can infer counting steps.

Integrate this component back into `AdditionWithinTenApp.jsx` so it appears alongside each problem (not only after mistakes). Initialize the marker at the first addend and allow the learner to drag to the final sum; when the marker lands on the correct answer, show a subtle highlight and call `setAnswerInput`. Maintain keyboard accessibility by preserving the previous button controls.
"""

---

## 4. Gamification UI: Badges, Avatar, Progress Tower

"""
Augment the learner dashboard inside `AdditionWithinTenApp.jsx` to include gamified progress. Introduce state to track unlocked badges, avatar status, and a Jenga-style tower that fills with each correct answer. Store badge metadata in a new file `src/lib/gamification/badges.ts` (export arrays describing id, label, requirement). Award badges when streaks or mastery thresholds are met and show them in a modal accessible from the header.

Add an avatar panel that changes sprites based on mastery snapshots (`masterySnapshot.add_within_10`)—use `resolveMotifTheme` to pick on-theme accessories. Display a stacked tower UI (e.g., flex column of blocks) that grows with `totalCorrect`. Ensure state persists via localStorage (extend the personalization persistence helpers) so progress remains across sessions.
"""
