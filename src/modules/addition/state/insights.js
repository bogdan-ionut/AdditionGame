export const knowledgeBands = [
  { minNumber: -1, label: 'Explorator preșcolar', detail: 'Construiește bazele pentru numărat și percepția cantității.', levelIndex: 0 },
  { minNumber: 3, label: 'Super-numărător de grădiniță', detail: 'Se simte confortabil cu sume până la 5 folosind materiale sau degete.', levelIndex: 1 },
  { minNumber: 6, label: 'Ninja al numerelor din clasa I', detail: 'Este fluent cu fapte de adunare până la +7 și pregătit să treacă de 10.', levelIndex: 2 },
  { minNumber: 8, label: 'Aventurier matematic din clasa a II-a', detail: 'Stăpânește termenii mari și se pregătește pentru raționament cu două cifre.', levelIndex: 3 },
];

export const ageBands = [
  { maxAge: 4.5, label: 'Preșcolar (3-4 ani)', levelIndex: 0, detail: 'Descoperă numerele prin joacă.' },
  { maxAge: 5.5, label: 'Grădiniță (5-6 ani)', levelIndex: 1, detail: 'Lucrează cu sume până la 5 și primele adunări.' },
  { maxAge: 6.5, label: 'Clasa I (6-7 ani)', levelIndex: 2, detail: 'Stăpânește faptele până la 10.' },
  { maxAge: 7.5, label: 'Clasa a II-a (7-8 ani)', levelIndex: 3, detail: 'Extinde spre regrupare și termeni mai mari.' },
  { maxAge: Infinity, label: 'Clase primare superioare (8+)', levelIndex: 4, detail: 'Gata pentru adunări și scăderi cu mai multe cifre.' },
];

const analyzeNumberPerformance = (gameState) => {
  const stats = gameState.statistics || {};
  const aggregates = Array.from({ length: 10 }, (_, number) => ({ number, attempts: 0, correct: 0 }));

  Object.entries(stats.problemHistory || {}).forEach(([key, value]) => {
    const [a, b] = key.split('+').map(Number);
    [a, b].forEach((num) => {
      if (Number.isInteger(num) && num >= 0 && num <= 9) {
        aggregates[num].attempts += value?.attempts || 0;
        aggregates[num].correct += value?.correct || 0;
      }
    });
  });

  return aggregates.map((entry) => ({
    ...entry,
    accuracy: entry.attempts > 0 ? entry.correct / entry.attempts : 0,
  }));
};

const describeDelta = (diff) => {
  if (diff >= 2) {
    return { label: '🚀 Mult înainte', tone: 'ahead', message: 'Depășește cu mult așteptările vârstei—propune provocări suplimentare!' };
  }
  if (diff === 1) {
    return { label: '📈 Puțin înainte', tone: 'ahead', message: 'Este peste media vârstei—păstrează ritmul actual.' };
  }
  if (diff === 0) {
    return { label: '✅ Pe traiectorie', tone: 'balanced', message: 'Nivelul de cunoștințe se potrivește cu așteptările pentru vârstă.' };
  }
  if (diff === -1) {
    return { label: '🎯 Zonă de creștere', tone: 'support', message: 'Un strop de exercițiu suplimentar va închide diferența mică.' };
  }
  return { label: '🧭 Necesită sprijin personalizat', tone: 'support', message: 'Concentrează recapitulările și folosește materiale concrete pentru a recupera.' };
};

export const computeKnowledgeInsights = (gameState) => {
  const mastery = gameState.masteryTracking || {};
  const performance = analyzeNumberPerformance(gameState);
  let highestStrong = -1;
  let aggregateScore = 0;
  let countedNumbers = 0;

  const masterySnapshots = performance.map((perf) => {
    const data = mastery[perf.number] || {};
    const masteryPercent = data.totalAttempts > 0
      ? (data.correctAttempts / data.totalAttempts) * 100
      : 0;
    const combined = Math.max(masteryPercent, perf.accuracy * 100);
    if (combined >= 85) {
      highestStrong = Math.max(highestStrong, perf.number);
    }
    if (combined > 0) {
      aggregateScore += combined;
      countedNumbers += 1;
    }
    return {
      number: perf.number,
      masteryPercent,
      combined,
    };
  });

  let knowledgeBand = knowledgeBands[0];
  knowledgeBands.forEach((band) => {
    if (highestStrong >= band.minNumber) {
      knowledgeBand = band;
    }
  });

  const progressFraction = countedNumbers > 0
    ? Math.min(1, aggregateScore / (countedNumbers * 100))
    : 0;
  const progressPercent = Math.round(progressFraction * 100);
  const nextNumber = Math.min(9, Math.max(0, highestStrong + 1));

  const studentAge = gameState.studentInfo?.age ?? null;
  const ageBand = (() => {
    if (typeof studentAge !== 'number' || Number.isNaN(studentAge)) {
      return { ...ageBands[0], label: 'Vârsta nu este setată', detail: 'Actualizează profilul copilului pentru comparații relevante.', levelIndex: 0 };
    }
    return ageBands.find((band) => studentAge <= band.maxAge) || ageBands[ageBands.length - 1];
  })();

  const delta = describeDelta(knowledgeBand.levelIndex - ageBand.levelIndex);

  return {
    knowledgeGrade: {
      ...knowledgeBand,
      highestStrong,
      nextNumber,
      progressPercent,
      masterySnapshots,
    },
    ageGrade: ageBand,
    delta,
  };
};

export const computeLearningPathInsights = (gameState) => {
  const mastery = gameState.masteryTracking || {};
  const stats = gameState.statistics || {};
  const performance = analyzeNumberPerformance(gameState);

  let highestMastered = -1;
  const entries = [];

  Object.entries(mastery).forEach(([key, value]) => {
    const number = Number(key);
    const masteryPercent = value.totalAttempts > 0
      ? (value.correctAttempts / value.totalAttempts) * 100
      : 0;
    if ((value.level === 'mastered' || masteryPercent >= 90) && number > highestMastered) {
      highestMastered = number;
    }
  });

  const overallAccuracy = stats.totalProblemsAttempted > 0
    ? stats.totalCorrect / stats.totalProblemsAttempted
    : 0;
  const avgTime = stats.averageTimePerProblem || 0;
  const streakPower = Math.max(stats.currentStreak || 0, stats.longestStreak || 0);

  let readinessWindow = highestMastered + 1;
  if (overallAccuracy >= 0.85) readinessWindow += 1;
  if (streakPower >= 5) readinessWindow += 1;
  if (avgTime > 0 && avgTime <= 22) readinessWindow += 1;
  readinessWindow = Math.min(9, Math.max(0, readinessWindow));

  const recommendations = new Set();
  for (let i = 0; i <= readinessWindow; i += 1) {
    recommendations.add(i);
  }

  performance.forEach((perf) => {
    const masteryData = mastery[perf.number] || { level: 'not-started', totalAttempts: 0, correctAttempts: 0 };
    const masteryPercent = masteryData.totalAttempts > 0
      ? (masteryData.correctAttempts / masteryData.totalAttempts) * 100
      : 0;

    const entry = {
      number: perf.number,
      level: masteryData.level || 'not-started',
      masteryPercent: Math.round(masteryPercent),
      accuracy: Math.round(perf.accuracy * 100),
      attempts: perf.attempts,
      recommended: recommendations.has(perf.number),
      priority: 0,
      reason: '',
    };

    if (!recommendations.has(perf.number) && perf.attempts >= 6 && perf.accuracy >= 0.8) {
      recommendations.add(perf.number);
      entry.recommended = true;
    }

    if (entry.level === 'mastered') {
      entry.reason = 'Menține stăpânirea cu recapitulări distanțate.';
      entry.priority = 10 + (9 - perf.number);
    } else if (entry.level === 'struggling') {
      entry.reason = 'Identificăm erori dese—planifică o sesiune de recapitulare concentrată.';
      entry.priority = 110 - entry.masteryPercent;
    } else if (entry.level === 'learning') {
      entry.reason = 'Ești în fază activă de învățare—păstrează ritmul pentru insigna de stăpânire.';
      entry.priority = 90 - entry.masteryPercent;
    } else if (entry.level === 'proficient') {
      entry.reason = 'Performanță solidă—șlefuiește acuratețea pentru stăpânire deplină.';
      entry.priority = 60 - entry.masteryPercent;
    } else {
      entry.reason = 'Începe cu exerciții concrete pentru a construi încrederea.';
      entry.priority = 50 - entry.masteryPercent;
    }

    entries.push(entry);
  });

  entries.sort((a, b) => b.priority - a.priority);

  const metrics = {
    overallAccuracy: Math.round(overallAccuracy * 100),
    avgTime: avgTime.toFixed(1),
    streak: stats.currentStreak || 0,
  };

  return {
    path: entries,
    recommendations,
    metrics,
  };
};
