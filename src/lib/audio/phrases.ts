export const OFFLINE_MESSAGE =
  'Vocea AI nu este disponibilă. Adaugă cheia Gemini în AI Settings pentru a folosi narațiunea.';

export const UI_TEXT = {
  offline: OFFLINE_MESSAGE,
  webSpeechFallback: 'Nu am putut reda vocea din cloud. Folosesc vocea dispozitivului.',
  deviceVoiceUnavailable: 'Vocea dispozitivului nu este disponibilă pe acest browser.',
  ttsUnavailable: 'Serviciul TTS nu este disponibil momentan. Încearcă din nou mai târziu.',
  genericPlaybackError: 'Nu am putut reda vocea. Verifică setările audio.',
};

export const PRAISE_LINES_RO: readonly string[] = [
  'Bravo, ai calculat corect! Matematica devine distractivă cu tine!',
  'Excelent! Ai găsit suma ca un adevărat explorator al numerelor.',
  'Felicitări! Fiecare exercițiu rezolvat te face mai încrezător.',
  'Super! Aduci mereu zâmbete când aduni numerele atât de bine.',
];

export const PRAISE_LINES_EN: readonly string[] = [
  'Great job, you did it!',
  'Excellent work! I love how focused you were.',
  'Fantastic! Keep shining!',
];

export const ENCOURAGE_LINES_RO: readonly string[] = [
  'Nu-i nimic dacă greșești; refacem pașii și descoperim răspunsul corect.',
  'Respiră adânc și încearcă din nou; sunt aici să te ghidez printre numere.',
  'Aproape! Să analizăm împreună și să vedem ce pas ne-a scăpat.',
  'Hai să transformăm provocarea într-un joc și să găsim soluția pas cu pas.',
];

export const ENCOURAGE_LINES_EN: readonly string[] = [
  "That's okay, try again! I know you can do it!",
  'Take a breath and give it another go. I believe in you!',
  'So close! Together we will get it right.',
];

export const MINI_LESSONS_RO: Record<string, string> = {
  'count-on':
    'Hai să numărăm împreună. Pornim de la primul număr și adăugăm fiecare pas cu voce tare pentru a vedea cum crește suma.',
  'make-10':
    'Gândește-te la numărul 10 ca la un prieten bun. Împarte al doilea număr astfel încât să ajungi la 10 și apoi adaugă ce a rămas.',
  commutativity:
    'Ordinea numerelor într-o adunare nu schimbă suma. Poți schimba locul numerelor pentru a calcula mai ușor.',
};

export const MINI_LESSONS_EN: Record<string, string> = {
  'count-on': 'Let’s count on together. Start at the first number and add the steps one by one.',
  'make-10': 'Think of 10 as a friendly helper. Break the second number to make 10, then add the rest.',
  commutativity: 'Switching the order does not change the sum. Swap the numbers to make it easier.',
};

export const FEEDBACK_MESSAGES = {
  praise: {
    ro: PRAISE_LINES_RO,
    en: PRAISE_LINES_EN,
  },
  encouragement: {
    ro: ENCOURAGE_LINES_RO,
    en: ENCOURAGE_LINES_EN,
  },
  miniLessons: {
    ro: MINI_LESSONS_RO,
    en: MINI_LESSONS_EN,
  },
};

const toLanguageKey = (value: string | null | undefined) => {
  if (!value) return 'en';
  return value.split('-')[0]?.toLowerCase() || value.toLowerCase();
};

export const buildProblemPrompt = (a: number, b: number, language: string | null | undefined): string => {
  const languageKey = toLanguageKey(language);
  if (languageKey === 'ro') {
    return `Cât face ${a} + ${b}?`;
  }
  return `What is ${a} + ${b}?`;
};

export const buildCountingPrompt = (
  start: number,
  count: number,
  language: string | null | undefined,
): string => {
  const languageKey = toLanguageKey(language);
  const sequence = Array.from({ length: count }, (_, index) => start + index + 1).join(', ');
  if (languageKey === 'ro') {
    return `Hai să numărăm împreună: ${start}, ${sequence}.`;
  }
  return `Let’s count together: ${start}, ${sequence}.`;
};

export const getAdditionPrompts = (language: string | null | undefined, max = 9): string[] => {
  const prompts: string[] = [];
  for (let a = 0; a <= max; a += 1) {
    for (let b = 0; b <= max; b += 1) {
      prompts.push(buildProblemPrompt(a, b, language));
    }
  }
  return prompts;
};

export const STATIC_UI_PHRASES: readonly string[] = [
  UI_TEXT.offline,
  UI_TEXT.webSpeechFallback,
  UI_TEXT.deviceVoiceUnavailable,
  UI_TEXT.ttsUnavailable,
  UI_TEXT.genericPlaybackError,
];
