# Generarea audio cu Chirp CLI (macOS)

Conducta Gemini din acest commit este anterioară integrării Chirp direct în aplicație, așa că poți apela API-ul REST OpenAI pentru a sintetiza clipuri de narațiune direct din Terminal pe macOS.

## 1. Instalează prerechizitele

1. Instalează Homebrew (dacă nu este deja prezent):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Verifică faptul că `curl` este disponibil (vine cu macOS) și instalează `ffmpeg` pentru conversii rapide de format:
   ```bash
   brew install ffmpeg
   ```

## 2. Configurează cheia OpenAI

Adaugă cheia API în sesiunea shell pentru ca apelul CLI să se poată autentifica:

```bash
export OPENAI_API_KEY="sk-..."
```

Poți pune această linie în `~/.zshrc` dacă vrei să se încarce automat pentru shell-urile noi.

## 3. Cere un clip Chirp (gpt-4o-mini-tts)

Rulează următoarea comandă pentru a sintetiza un fișier MP3 cu vocea „alloy”. Înlocuiește textul `input` cu narațiunea de care ai nevoie.

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

Modelul `gpt-4o-mini-tts` este succesorul direct al vocii Chirp 3D și permite ieșire stereo dacă soliciți `format: "wav"` cu `sample_rate: 44100`.

## 4. Previzualizează sau postprocesează fișierul

- Redă imediat rezultatul:
  ```bash
  afplay warmup.mp3
  ```
- Convertește la WAV stereo 44,1 kHz (opțional):
  ```bash
  ffmpeg -i warmup.mp3 -ar 44100 -ac 2 warmup.wav
  ```

## 5. Generator pentru loturi (opțional)

Pentru mai multe prompturi, creează un mic script shell (de exemplu `generate-chirp.sh`) și parcurge frazele necesare:

```bash
#!/usr/bin/env bash
set -euo pipefail

VOICE="alloy"
MODEL="gpt-4o-mini-tts"
FORMAT="mp3"

while IFS=, read -r slug prompt; do
  echo "→ Generăm ${slug}"
  curl -sS -o "${slug}.${FORMAT}" \
    -X POST https://api.openai.com/v1/audio/speech \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"${MODEL}\", \"voice\": \"${VOICE}\", \"format\": \"${FORMAT}\", \"input\": \"${prompt}\"}"
  sleep 1
done < prompts.csv
```

Apoi stochează frazele în `prompts.csv` (format `filename,prompt` separat prin virgulă) și rulează:

```bash
chmod +x generate-chirp.sh
./generate-chirp.sh
```

Fiecare intrare devine propriul fișier audio în directorul curent.
