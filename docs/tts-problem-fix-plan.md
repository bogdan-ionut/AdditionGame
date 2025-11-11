# Plan: keep Gemini TTS from answering the math problems

1. **Harden the request we send to Gemini**  
   - Attach a reusable system instruction (described in `docs/research/gemini-tts-2.5-flash.md`) when we synthesize speech so the model is reminded to stay verbatim.  
   - Send every problem as a `user` turn with explicit role metadata and keep the response modality pinned to audio.
2. **Version the cached audio**  
   - Introduce a cache “flavor” so newly synthesized clips do not reuse the older recordings that already contain answers.  
   - Make sure both reads and writes encode the flavor in the cache key to automatically bust outdated clips.  
3. **Update narration helpers**  
   - Pass the stricter prompt flavor through the narration engine so problem prompts always opt into the verbatim system message.  
   - Keep existing voice settings intact so only the prompt discipline changes.
