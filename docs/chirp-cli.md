# Chirp CLI audio generation (macOS)

The Gemini pipeline in this commit predates the in-app Chirp integration, so you can fall back to the OpenAI REST API to synthesize narration clips straight from Terminal on macOS.

## 1. Install prerequisites

1. Install Homebrew (skip if already present):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Ensure `curl` is available (bundled with macOS) and install `ffmpeg` for quick format conversions:
   ```bash
   brew install ffmpeg
   ```

## 2. Configure your OpenAI key

Add your API key to the shell session so the CLI call can authenticate:

```bash
export OPENAI_API_KEY="sk-..."
```

You can place this line in `~/.zshrc` if you want it loaded automatically for new shells.

## 3. Request a Chirp (gpt-4o-mini-tts) clip

Run the following command to synthesize an MP3 file with the "alloy" voice. Replace the `input` text with the narration you need.

```bash
curl -sS -o warmup.mp3 \
  -X POST https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "voice": "alloy",
    "format": "mp3",
    "input": "Hai să încălzim vocile și să începem cu puțină numărătoare!"
  }'
```

The `gpt-4o-mini-tts` model is the direct successor to the Chirp 3D voice and supports stereo output when you request `format: "wav"` with `sample_rate: 44100`.

## 4. Preview or post-process the file

- Play the result immediately:
  ```bash
  afplay warmup.mp3
  ```
- Convert to 44.1 kHz stereo WAV (optional):
  ```bash
  ffmpeg -i warmup.mp3 -ar 44100 -ac 2 warmup.wav
  ```

## 5. Batch generation helper (optional)

For multiple prompts, create a simple shell script (e.g. `generate-chirp.sh`) and loop through the phrases you need:

```bash
#!/usr/bin/env bash
set -euo pipefail

VOICE="alloy"
MODEL="gpt-4o-mini-tts"
FORMAT="mp3"

while IFS=, read -r slug prompt; do
  echo "→ Generating ${slug}"
  curl -sS -o "${slug}.${FORMAT}" \
    -X POST https://api.openai.com/v1/audio/speech \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"${MODEL}\", \"voice\": \"${VOICE}\", \"format\": \"${FORMAT}\", \"input\": \"${prompt}\"}"
  sleep 1
done < prompts.csv
```

Then store your phrases in `prompts.csv` (comma-separated `filename,prompt`) and run:

```bash
chmod +x generate-chirp.sh
./generate-chirp.sh
```

Each entry becomes its own audio file in the current directory.
