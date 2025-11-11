# Gemini 2.5 Flash Preview TTS – request notes (2025-03-xx)

## Required request structure
- The SDK accepts a `systemInstruction` that can hold guiding content for the model, allowing us to constrain how audio is produced.【F:node_modules/@google/genai/dist/genai.d.ts†L1263-L1284】
- Requests are composed from `Content` entries; each `Content` has `parts` and an optional `role` (set to `user` for our prompts).【F:node_modules/@google/genai/dist/genai.d.ts†L1164-L1171】

## Audio-specific configuration
- `generationConfig` exposes `responseMimeType`, `responseModalities`, and `speechConfig`, which we use to force an audio response and control voice parameters.【F:node_modules/@google/genai/dist/genai.d.ts†L3455-L3485】
- `SpeechConfig` lets us declare the language code and a `voiceConfig`, while `PrebuiltVoiceConfig` contains the `voiceName` for Google’s preset narrators.【F:node_modules/@google/genai/dist/genai.d.ts†L7111-L7118】【F:node_modules/@google/genai/dist/genai.d.ts†L6339-L6343】

## Model selection
- The project already targets the dedicated preview voice model `gemini-2.5-flash-preview-tts`, which should remain our default until Google promotes a newer version.【F:src/api/tts.ts†L19-L55】

## Best practices for our app
- Supply a strict system instruction that states the voice must repeat the user prompt verbatim and never invent answers. This steers the generative model away from “helpful” completions when narrating math questions.
- Send each problem as a single `user` turn with the exact punctuation we want the child to hear; avoid providing the answer in the text itself.
- Keep the MIME type stable (`audio/mpeg`) so cached clips remain compatible across browsers, and set speech parameters (voice, rate, pitch, sample rate) through `speechConfig` rather than embedding them into the text prompt.
