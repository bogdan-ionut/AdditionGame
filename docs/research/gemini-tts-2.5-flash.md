# Gemini 2.5 Flash Preview TTS – note de cerere (2025-03-xx)

## Structura necesară a cererii
- SDK-ul acceptă un `systemInstruction` care poate conține indicații pentru model, permițându-ne să controlăm modul în care este produs audio-ul.【F:node_modules/@google/genai/dist/genai.d.ts†L1263-L1284】
- Cererile sunt compuse din elemente `Content`; fiecare `Content` are `parts` și un `role` opțional (setat la `user` pentru prompturile noastre).【F:node_modules/@google/genai/dist/genai.d.ts†L1164-L1171】

## Configurare specifică audio
- `generationConfig` expune `responseMimeType`, `responseModalities` și `speechConfig`, pe care le folosim pentru a forța un răspuns audio și pentru a controla parametrii vocii.【F:node_modules/@google/genai/dist/genai.d.ts†L3455-L3485】
- `SpeechConfig` ne permite să declarăm codul de limbă și un `voiceConfig`, iar `PrebuiltVoiceConfig` conține `voiceName` pentru vocile presetate de la Google.【F:node_modules/@google/genai/dist/genai.d.ts†L7111-L7118】【F:node_modules/@google/genai/dist/genai.d.ts†L6339-L6343】

## Alegerea modelului
- Proiectul țintește deja modelul de voce preview dedicat `gemini-2.5-flash-preview-tts`, care ar trebui să rămână implicitul nostru până când Google promovează o versiune nouă.【F:src/api/tts.ts†L19-L55】

## Bune practici pentru aplicație
- Furnizează o instrucțiune de sistem strictă care menționează că vocea trebuie să repete promptul utilizatorului verbatim și să nu inventeze răspunsuri. Astfel ținem modelul generativ departe de completările „ajutătoare” atunci când narațiunea redă întrebări de matematică.
- Trimite fiecare problemă ca un singur mesaj `user` cu exact punctuația pe care vrem să o audă copilul; evită să incluzi răspunsul în textul însuși.
- Păstrează MIME type-ul stabil (`audio/mpeg`) astfel încât clipurile din cache să rămână compatibile între browsere și setează parametrii de vorbire (voce, viteză, tonalitate, rată de eșantionare) prin `speechConfig`, nu direct în textul promptului.
