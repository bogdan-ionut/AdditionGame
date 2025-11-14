# AdditionGame

Un joc de adunare creat pentru copiii de vârstă preșcolară, acum tradus complet în limba română.

## Dezvoltare locală

Acest proiect folosește [Vite](https://vitejs.dev/) pentru configurarea aplicației React. Pentru a rula proiectul local:

1. Instalează dependențele cu `npm install`.
2. Pornește serverul de dezvoltare cu `npm run dev` și deschide adresa afișată în terminal.
3. Creează un pachet de producție cu `npm run build` (fișierele rezultate ajung în `dist/`).
4. Dacă ai nevoie să verifici varianta de producție, folosește `npm run preview`.

### Configurarea mediului

Creează un fișier `.env.local` (sau un alt fișier de mediu acceptat de Vite) și adaugă cheia ta Gemini pentru a activa narațiunea și funcțiile AI:

```
VITE_GEMINI_API_KEY=AIza...
```

Cheia este citită la build și salvată în `localStorage` atunci când o introduci în **setările AI**. Dacă sari peste acest pas, aplicația rulează în continuare, dar narațiunea folosește vocea dispozitivului sau rămâne dezactivată.

## Publicare pe GitHub Pages

Fluxul GitHub Actions (`.github/workflows/deploy.yml`) construiește aplicația și publică conținutul directorului `dist/` în branch-ul `gh-pages` la fiecare push în `main`. Activează **Settings → Pages → Deploy from branch → gh-pages** pentru a servi cea mai recentă versiune la `https://<username>.github.io/AdditionGame/`.

## Foldere pentru exporturi

Poți salva date JSON sau alte resurse în două locuri:

- `public/exports/` – este inclus în site-ul static, astfel încât fișierele sunt accesibile public.
- `data/exports/` – este versionat în depozit, dar nu este expus la rularea aplicației.

## Generarea audio Chirp din terminal

Dacă vrei să generezi narațiunea fără a porni aplicația, urmează ghidul pas cu pas din [`docs/chirp-cli.md`](docs/chirp-cli.md). Vei găsi instrucțiuni pentru instalarea prerechizitelor pe macOS, exportarea variabilei `OPENAI_API_KEY` și folosirea modelului `gpt-4o-mini-tts` (Chirp) prin `curl` pentru a salva fișiere MP3 sau WAV.

## Stadiul funcționalităților

### Implementate
- **Metrici în timp real pe tabloul de bord**: minutele de astăzi din `dailyTotals`, timpul mediu per problemă, zonele de focus vs. pierdere de timp, zonele de dificultate, stăpânirea pe număr și rata de creștere pe 7 zile comparată cu baza inițială. Tabloul de bord pentru părinți folosește direct datele salvate din sesiuni.
- **Acuratețe pe tabloul de bord** calculată ca raportul dintre răspunsurile corecte și totalul încercărilor, astfel încât indicatorul principal să corespundă urmăririi din timpul jocului.
- **Urmărirea acoperirii** pentru grila completă (0..9)×(0..9), marcând fiecare pereche ca acoperită după cel puțin un răspuns corect.
- **Etape de stăpânire** pentru modurile „Adunări cu _n_”, deblocate doar după atingerea pragului la numărul anterior.
- **Dificultate adaptivă** care trece între ușor/mediu/greu pe baza seriilor și a timpilor recenți.
- **Cozi de recapitulare eșalonată** cu intervale 10m → 1h → 1d și o insignă REVIEW pe cardurile restante.
- **Checkpoint-uri ușoare** la fiecare 10 probleme, care adaugă până la cinci exerciții suplimentare pentru recapitulare.
- **Teste de checkpoint** ce cer o acuratețe de 80% înainte de a reveni la pachetul principal, cu reluare automată dacă este nevoie.
- **Indicații automate** după două încercări greșite, inclusiv linia numerică interactivă.
- **Detector de dificultăți și ajutor automat** cu reducerea nivelului, indicii suplimentare după greșeli repetate, declanșare la 30 de secunde de inactivitate și suport audio pentru numărat.
- **Detectarea răspunsurilor nepotrivite (WASTE)** pentru răspunsuri prea rapide/lente sau tipare repetate introduse în mai puțin de trei secunde.
- **Portabilitatea progresului** prin import/export JSON și salvare automată în `localStorage`.
- **Migrarea stării** prin `migrateGameState` (schema curentă `1.2.0`).
- **Obiecte SVG numărabile** și animații de celebrare pentru fiecare cifră 0–9.
- **Trasee de învățare complet personalizate** care analizează stăpânirea, seriile și acuratețea pe număr pentru a recomanda ținte create de AI chiar dacă numărul anterior nu este încă stăpânit.
- **Analize între nivelul de cunoștințe și vârsta școlară** care traduc progresul în limbaj specific claselor și evidențiază diferențele în tabloul de bord pentru părinți.
- **Monitorizare a creșterii** care combină multiplicatorul pe 7 zile cu un grafic comparativ față de practica obișnuită.

### Parțial implementate
- _Niciuna momentan._

### Neimplementate
- **Suporturi multimodale** precum audio TTS suplimentar, linii numerice de tip drag-and-drop sau clipuri explicative.
- **Vizualizări de progres** de tip turnuri Jenga, trofee sau certificate printabile.
- **Pauze adaptive** (de exemplu, un Pomodoro prietenos pentru copii).
- **Bare de progres pe capitole** care urmăresc segmente independente de acoperirea globală.
- **Rapoarte de recapitulare printabile** sau expunerea în interfață a elementelor `reviewNeeded`.
- **Mod de evaluare inițială** pentru calibrarea rapidă a dificultății.
- **Feedback audio suplimentar** pentru răspunsuri corecte/greșite sau pentru ecuații narate.

