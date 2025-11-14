# Prompturi Codex pentru extinderi AdditionGame

Aceste prompturi îl ghidează pe Codex în implementarea funcțiilor multimedia și de gamificare rămase în interfața AdditionGame. Fiecare propunere face trimitere la module și utilitare existente pentru ca modificările să se integreze corect.

---

## 1. Narațiune text-to-speech pentru probleme și indicii

"""
Actualizează `src/modules/addition/AdditionWithinTenApp.jsx` astfel încât de fiecare dată când un nou card de exersare devine activ, enunțul problemei să fie citit cu voce tare. Folosește hook-ul `useNarrationEngine` (deja importat în partea superioară a fișierului) și apelează helperul `speakProblem(card, { story })` în efectul care reacționează la schimbarea lui `currentCard`. Asigură-te că mesajul rostit include contextul temei active (folosește `aiSessionMeta?.story`) și revine la narațiune în limba română când nu există o localizare explicită.

Adaugă narațiune și pentru indicii: când `showHint` devine `true` sau când utilizatorul deschide mini-lecția cu linia numerică, apelează `speakHint(hintText, { story })`. Textul indiciei trebuie să reutilizeze șirul afișat în interfață (de exemplu „Numără de la ${a} încă ${b} pași”). Respectă setarea `audioSettings.narrationEnabled` și evită declanșarea narațiunii dacă elevul a dezactivat sunetul.
"""

---

## 2. Feedback audio și mod Low-Stim

"""
Îmbunătățește fluxul de feedback din `AdditionWithinTenApp.jsx` prin redarea de efecte sonore și mesaje vorbite pentru răspunsurile elevului. În logica `checkAnswer` (și în orice altă ramură care marchează o încercare ca fiind corectă/greșită) apelează `playSfx('success')` și `speakFeedback(true, { story })` pentru răspunsurile corecte, respectiv `playSfx('error')` și `speakFeedback(false, { story })` pentru cele greșite. Redă `playSfx('progress')` de fiecare dată când seriile ating multipli de cinci sau când elevul urcă o etapă.

Implementează un comutator audio Low-Stim în panoul de setări pentru părinți (vezi utilizarea `ParentAISettings`). Persistă alegerea în preferințele audio extinzând `AudioSettings` din `src/lib/audio/preferences.ts` cu un boolean `lowStimMode` și expunându-l în hook-ul `useNarrationEngine`. Când modul este activ, micșorează volumul narațiunii și al efectelor sonore (de exemplu la 0.4) și omite clipurile de celebrare mai lungi.
"""

---

## 3. Manipulative drag-and-drop / linie numerică interactivă

"""
Extrage helperul `NumberLine` din `src/modules/addition/AdditionWithinTenApp.jsx` într-un component reutilizabil `src/components/InteractiveNumberLine.jsx`. Păstrează grafica SVG existentă, dar adaugă un marcaj dragabil pe care copilul îl poate muta între gradații. Marcajul trebuie să se fixeze pe poziții întregi între 0 și 10 (sau `max`) și să emită callback-uri precum `onMove(start, end)` pentru ca părintele să înțeleagă pașii de numărare.

Reintegrează componentul în `AdditionWithinTenApp.jsx` astfel încât să apară lângă fiecare problemă (nu doar după greșeli). Inițializează marcajul la primul termen și permite copilului să tragă până la suma finală; când ajunge pe răspunsul corect, evidențiază ușor zona și apelează `setAnswerInput`. Menține accesibilitatea la tastatură păstrând controalele anterioare.
"""

---

## 4. Interfață gamificată: insigne, avatar, turn de progres

"""
Extinde tabloul elevului din `AdditionWithinTenApp.jsx` cu elemente de gamificare. Introdu starea necesară pentru insigne deblocate, avatar și un turn tip Jenga care crește cu fiecare răspuns corect. Stochează metadatele despre insigne într-un fișier nou `src/lib/gamification/badges.ts` (exportă array-uri cu id, etichetă, condiție). Acordă insigne când sunt atinse serii sau praguri de stăpânire și afișează-le într-un modal accesibil din antet.

Adaugă un panou pentru avatar care schimbă sprite-urile pe baza instantaneelor de stăpânire (`masterySnapshot.add_within_10`) — folosește `resolveMotifTheme` pentru a alege accesorii potrivite. Afișează un turn compus din blocuri (coloană flex) care crește odată cu `totalCorrect`. Asigură-te că starea persistă în `localStorage` (extinde helperii de personalizare) astfel încât progresul să rămână între sesiuni.
"""

