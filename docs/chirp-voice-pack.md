# Chirp 3 HD voice pack workflow

This repository now ships a local Node CLI that can synthesize a static Google Cloud Text-to-Speech voice pack based on the prompts you export from the Parent AI Settings UI.

## 1. Select the prompts in the UI

1. Open the Parent → AI Settings modal.
2. In the **Generare manuală clipuri TTS** section, select the prompt categories and individual prompts you want in the voice pack.
3. Click **Descarcă manifest Chirp 3 (JSON)**. The browser downloads `chirp-pack-request.json`, which contains the selected prompts and synthesis defaults (Chirp 3 HD voice, MP3 @ 24 kHz).

> ℹ️ The card below the button shows the exact npm command to run and lets you copy it to the clipboard.

## 2. Run the offline generator

1. Move the downloaded `chirp-pack-request.json` into the project root (next to `package.json`).
2. Ensure the Google Cloud credentials for Text-to-Speech are available via Application Default Credentials (e.g. `GOOGLE_APPLICATION_CREDENTIALS=...`).
3. Run the CLI:

```bash
npm run chirp-pack
```

The script writes all MP3 files to `public/audio/ro-RO/chirp3-hd-a/` and stores a build summary in `public/audio/ro-RO/chirp3-hd-a/manifest.json`.

### CLI options

Use `node ./scripts/build-chirp-voice-pack.mjs --help` to see all options. Common overrides:

- `--manifest` — custom manifest path if you keep multiple exports.
- `--out-dir` — change the output directory.
- `--force` — re-synthesize even when files already exist.
- `--dry-run` — validate the manifest without calling the API.

## 3. Commit the generated assets

After the CLI finishes, review the generated clips, then commit `public/audio/ro-RO/chirp3-hd-a/` (MP3 files + summary manifest) so the static build can serve them.
