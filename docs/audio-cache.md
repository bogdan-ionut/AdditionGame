# Serviciul de cache audio

Conducta de narațiune vocală păstrează acum clipurile Gemini TTS în browser, astfel încât solicitările repetate să poată fi redate instant fără să mai chemăm din nou API-ul.

## Modelul de stocare

- Clipurile sunt salvate în IndexedDB (`addition-game-audio-cache/clips`) și sunt indexate după:
  - Textul promptului normalizat (litere mici, spații comprimate)
  - Voce, limbă, model, viteză de vorbire, tonalitate și tipul narațiunii (`problem`, `hint` etc.)
- Un rezumat compact (număr de intrări + total octeți) este oglindit în `localStorage` sub cheia `addition-game.audio.cache.summary.v1`, ca UI-ul să poată afișa dimensiunea fără să deschidă IndexedDB.
- Cache-ul este limitat la ~200 de intrări / 25 MB. Clipurile cele mai vechi sunt eliminate atunci când se depășesc limitele.
- De fiecare dată când rezumatul se schimbă, declanșăm pe `window` evenimentul `addition-game.audio.cache.updated`, astfel încât alte module să poată reacționa (de exemplu să reîmprospăteze insigna din UI).

## API

Utilitarul pentru cache se află în `src/lib/audio/cache.ts` și expune:

| Funcție | Descriere |
| --- | --- |
| `getCachedAudioClip(descriptor)` | Returnează un `Blob` din cache pentru promptul respectiv sau `null` dacă nu există. |
| `storeAudioClip(descriptor, blob)` | Salvează un clip generat (asincron, fără să blocheze firul principal). |
| `clearAudioCache()` / `deleteAudioClip()` | Șterge toate intrările sau doar una singură. |
| `getAudioCacheSummary()` | Un snapshot rapid `{ entryCount, totalBytes }` pentru interfețe. |
| `formatCacheSize(bytes)` | Utilitar pentru formatarea dimensiunilor. |
| `CACHE_EVENT_NAME` / `CACHE_SUMMARY_STORAGE_KEY` | Identificatori reutilizabili pentru ascultători. |

Toate funcțiile devin no-op atunci când IndexedDB nu este disponibil, așa că pot fi folosite din cod partajat fără protecții suplimentare.

## Precalcularea manuală a narațiunii

`precomputeNarrationClips` (`src/lib/audio/warmup.ts`) oferă o coadă pe care utilizatorul o pornește manual pentru a genera pachete de clipuri Gemini. Utilitarul primește categoriile dorite (laude, încurajări, mini-lecții, exerciții de adunare, prompturi de numărat) și le sintetizează la cerere, făcând pauze cu `requestIdleCallback` între sarcini.

Nu se generează nimic automat la rulare. În schimb, interfața pentru părinți/admin (`ParentAISettings`) include un panou „Generare manuală” în care adulții pot alege pachetele de pregătit și pot porni/opri manual seria. La fiecare pas verificăm mai întâi cache-ul, deci clipurile existente sunt refolosite, iar API-ul este apelat doar pentru prompturi lipsă.

## Note pentru dezvoltatori

- Trimite toate sintezele prin `synthesize()` ca să păstrăm consecventă logica de cache.
- Dacă adaugi noi tipuri de narațiune, setează un `type`/`kind` stabil pentru a izola corect clipurile în cache.
- Folosește controalele pentru cache din `ParentAISettings` ca să verifici comportamentul și să golești stocarea în timpul dezvoltării.

## Precalcularea locală a pachetelor Google Cloud

Poți genera offline clipuri românești de adunare și să le imporți în bloc în cache-ul din browser. Scripturile ajutătoare din `scripts/` produc o arhivă ZIP gata de încărcat, compatibilă cu manifestul de cache (`manifest.json` + `clips/<cache-key>.mp3`).

### 1. Pregătește mediul

Pe macOS instalează uneltele de linie de comandă necesare:

```bash
brew install google-cloud-sdk jq
```

Autentifică-te o dată cu credențiale implicite pentru aplicație, astfel încât scriptul să poată cere tokenuri temporare:

```bash
gcloud auth application-default login
```

Asigură-te că `gcloud`, `jq`, `curl`, `base64`, `zip` și `node` (v18+) sunt disponibile în `$PATH`.

### 2. Generează clipurile audio și manifestul

Din rădăcina proiectului rulează:

```bash
./scripts/generate-gcloud-addition-pack.sh
```

Scriptul sintetizează tabla adunării `0–9` cu vocea Google Cloud `ro-RO-Chirp3-HD-Kore`, salvează MP3-uri ușor de ascultat în `audio/ro-RO/chirp3-hd-kore/raw/` și apoi construiește un pachet pregătit pentru cache în `audio/ro-RO/chirp3-hd-kore/pack/`. Arhiva finală (`gcloud-ro-addition-pack.zip`) conține:

- `manifest.json` (versiunea 1, cu `model: "gcloud-tts"` și `voice: "ro-RO-Chirp3-HD-Kore"`)
- `clips/<cache-key>.mp3` pentru fiecare exercițiu

Scriptul este idempotent: rulările repetate sar peste MP3-urile deja existente. Folosește `--no-download` pentru a reconstrui manifestul/ZIP-ul din fișierele audio descărcate anterior. Poți ajusta intervalul operanzilor (de exemplu `--min 0 --max 12`) sau directorul de destinație (`-o calea/spre/output`).

### 3. Importă pachetul în aplicație

În interfața pentru părinți/admin deschide panoul „Generare manuală”, alege `Importă pachet audio` și selectează `gcloud-ro-addition-pack.zip`. Rutina de import validează manifestul și stochează fiecare clip în IndexedDB sub cheia care corespunde descrierii din aplicație (text `Cât face X plus Y?`, limbă `ro-RO`, voce `ro-RO-Chirp3-HD-Kore`, model `gcloud-tts`, viteză `1`, tonalitate `1`, format `audio/mpeg`, rată de eșantionare `24000`).

Clipurile sunt marcate cu metadatele furnizorului, astfel încât să rămână separate de conținutul generat cu Gemini.
