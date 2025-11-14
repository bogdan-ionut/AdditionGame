# Plan: împiedicăm Gemini TTS să răspundă la problemele de matematică

1. **Întărim cererea trimisă către Gemini**
   - Atașăm o instrucțiune de sistem reutilizabilă (descrisă în `docs/research/gemini-tts-2.5-flash.md`) atunci când sintetizăm vorbire, astfel încât modelul să își amintească să rămână la textul promptului.
   - Trimitem fiecare problemă ca un mesaj `user` cu metadate de rol explicite și blocăm modalitatea răspunsului la audio.
2. **Versionăm clipurile din cache**
   - Introducem o „aromă” de cache, astfel încât clipurile nou sintetizate să nu mai reutilizeze înregistrările vechi care conțin deja răspunsurile.
   - Ne asigurăm că atât citirile cât și scrierile codifică aroma în cheia cache pentru a invalida automat clipurile depășite.
3. **Actualizăm utilitarele de narațiune**
   - Propagăm promptul mai strict prin motorul de narațiune, astfel încât problemele să folosească mereu mesajul de sistem verbatim.
   - Păstrăm setările actuale de voce, astfel încât doar disciplina promptului să se schimbe.
