import { sanitizeThemePacks } from './motifThemes';

export const TARGET_SUCCESS_BAND = {
  min: 0.8,
  midpoint: 0.825,
  max: 0.85,
};

const DEFAULT_PRIOR = { alpha: 3, beta: 2 };

const sumKey = (sum) => `sum=${sum}`;

const toTitle = (value = '') =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function createLearnerId(name = '') {
  if (!name || typeof name !== 'string') return 'learner';
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'learner';
}

export function ensurePersonalization(raw = {}, studentInfo = {}) {
  const learnerProfile = {
    learnerId: raw?.learnerProfile?.learnerId || createLearnerId(studentInfo?.name),
    parentId: raw?.learnerProfile?.parentId || 'local-parent',
    name: studentInfo?.name || raw?.learnerProfile?.name || '',
    ageYears: studentInfo?.age ?? raw?.learnerProfile?.ageYears ?? null,
    interests: Array.isArray(raw?.learnerProfile?.interests) ? raw.learnerProfile.interests : [],
    interestMotifs: Array.isArray(raw?.learnerProfile?.interestMotifs) ? raw.learnerProfile.interestMotifs : [],
    interestThemePacks: sanitizeThemePacks(raw?.learnerProfile?.interestThemePacks || []),
    motifsUpdatedAt: raw?.learnerProfile?.motifsUpdatedAt ?? null,
    interestThemeDebug: raw?.learnerProfile?.interestThemeDebug || null,
  };

  return {
    targetSuccess: typeof raw?.targetSuccess === 'number' ? raw.targetSuccess : TARGET_SUCCESS_BAND.midpoint,
    learnerProfile,
    mastery: { ...(raw?.mastery || {}) },
    planQueue: Array.isArray(raw?.planQueue) ? raw.planQueue : [],
    activeSession: raw?.activeSession || null,
    lastPlan: raw?.lastPlan || null,
    sessionAttempts: Array.isArray(raw?.sessionAttempts) ? raw.sessionAttempts : [],
    lastInteractionAt: raw?.lastInteractionAt || null,
  };
}

export function ensureMasteryNode(node) {
  return {
    alpha: typeof node?.alpha === 'number' ? node.alpha : DEFAULT_PRIOR.alpha,
    beta: typeof node?.beta === 'number' ? node.beta : DEFAULT_PRIOR.beta,
    streak: typeof node?.streak === 'number' ? node.streak : 0,
    lastAskedAt: node?.lastAskedAt || null,
  };
}

export function predictSuccess(node) {
  const safeNode = ensureMasteryNode(node);
  const alpha = Math.max(safeNode.alpha, 1);
  const beta = Math.max(safeNode.beta, 1);
  const probability = alpha / (alpha + beta);
  return Math.min(TARGET_SUCCESS_BAND.max + 0.05, Math.max(0.05, probability));
}

export function updateMasteryNode(node, correct) {
  const safeNode = ensureMasteryNode(node);
  return {
    ...safeNode,
    alpha: safeNode.alpha + (correct ? 1 : 0),
    beta: safeNode.beta + (correct ? 0 : 1),
    streak: correct ? safeNode.streak + 1 : 0,
    lastAskedAt: Date.now(),
  };
}

export function deriveMotifsFromInterests(interests = []) {
  if (!Array.isArray(interests) || !interests.length) return [];
  const templates = ['quest', 'parade', 'mission', 'challenge', 'festival', 'journey', 'safari'];
  const motifs = [];
  interests.forEach((interest, index) => {
    if (typeof interest !== 'string' || !interest.trim()) return;
    const base = interest.trim().split(/\s+/)[0].toLowerCase();
    const template = templates[index % templates.length];
    const motif = `${base} ${template}`.replace(/[^a-z0-9\s]/g, '').trim();
    if (motif && !motifs.includes(motif)) {
      motifs.push(motif);
    }
  });
  return motifs.slice(0, 8);
}

function buildFactsForSum(sum) {
  const facts = [];
  for (let a = 0; a <= 9; a += 1) {
    for (let b = 0; b <= 9; b += 1) {
      if (a + b === sum) {
        facts.push({ a, b, sum });
      }
    }
  }
  return facts;
}

function getHistoryStats(history = {}, key) {
  const record = history?.[key];
  if (!record) return { attempts: 0, correct: 0, lastAttempt: 0 };
  return {
    attempts: record.attempts || 0,
    correct: record.correct || 0,
    lastAttempt: record.lastAttempt || 0,
  };
}

function pickFactForSum(sum, { used = new Set(), history = {} } = {}) {
  const candidates = buildFactsForSum(sum).map((fact) => {
    const key = `${fact.a}+${fact.b}`;
    const stats = getHistoryStats(history, key);
    return {
      ...fact,
      key,
      attempts: stats.attempts,
      lastAttempt: stats.lastAttempt,
    };
  });

  candidates.sort((a, b) => {
    if ((a.attempts || 0) !== (b.attempts || 0)) return (a.attempts || 0) - (b.attempts || 0);
    return (a.lastAttempt || 0) - (b.lastAttempt || 0);
  });

  const choice = candidates.find((fact) => !used.has(fact.key)) || candidates[0];
  if (choice) used.add(choice.key);
  return choice;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function generateLocalPlan({ personalization, history = {}, timeline = [], sessionSize = 8, now = Date.now() }) {
  const ai = ensurePersonalization(personalization);
  const target = typeof ai.targetSuccess === 'number' ? ai.targetSuccess : TARGET_SUCCESS_BAND.midpoint;
  const families = Array.from({ length: 19 }, (_, sum) => {
    const node = ensureMasteryNode(ai.mastery?.[sumKey(sum)]);
    const predicted = predictSuccess(node);
    const exposures = node.alpha + node.beta - DEFAULT_PRIOR.alpha - DEFAULT_PRIOR.beta;
    return { sum, key: sumKey(sum), predicted, exposures };
  });

  const weakFamilies = [...families].sort((a, b) => a.predicted - b.predicted).slice(0, Math.max(2, Math.ceil(sessionSize * 0.4)));
  const strongFamilies = families.filter((family) => family.predicted >= 0.93).slice(0, 4);
  const targetWeakCount = clamp(Math.round(sessionSize * 0.7), 3, sessionSize);
  const targetReviewCount = clamp(Math.round(sessionSize * 0.2), 1, sessionSize);
  const targetChallengeCount = clamp(sessionSize - targetWeakCount - targetReviewCount, 1, sessionSize);

  const usedFacts = new Set();
  const items = [];

  const pushItem = (fact, role) => {
    if (!fact) return;
    const predicted = families.find((family) => family.sum === fact.sum)?.predicted ?? target;
    const hints = [
      `Start at ${fact.a} and count up ${fact.b}.`,
      fact.b > 1 ? `Break ${fact.b} into ${Math.floor(fact.b / 2)} and ${Math.ceil(fact.b / 2)} to add in steps.` : `Think about making ${fact.sum} using number partners.`,
    ];
    items.push({
      id: `local-${now}-${fact.a}-${fact.b}-${items.length}`,
      a: fact.a,
      b: fact.b,
      answer: fact.sum,
      display: `${fact.a} + ${fact.b}`,
      predictedSuccess: predicted,
      difficulty: predicted,
      hints,
      praise: `Nice! ${fact.a} + ${fact.b} builds your ${fact.sum} fact family.`,
      role,
    });
  };

  weakFamilies.forEach((family) => {
    if (items.length >= targetWeakCount) return;
    const fact = pickFactForSum(family.sum, { used: usedFacts, history });
    if (fact) pushItem(fact, 'weak');
  });

  const recentFacts = [];
  for (let i = timeline.length - 1; i >= 0 && recentFacts.length < 12; i -= 1) {
    const entry = timeline[i];
    const key = `${entry.a}+${entry.b}`;
    if (!usedFacts.has(key) && !recentFacts.includes(key)) {
      recentFacts.push(key);
      pushItem({ a: entry.a, b: entry.b, sum: entry.a + entry.b, key }, 'review');
    }
    if (items.length >= targetWeakCount + targetReviewCount) break;
  }

  strongFamilies.forEach((family) => {
    if (items.length >= targetWeakCount + targetReviewCount + targetChallengeCount) return;
    const fact = pickFactForSum(family.sum, { used: usedFacts, history });
    if (fact) pushItem(fact, 'challenge');
  });

  while (items.length < sessionSize) {
    const nextFamily = [...families]
      .map((family) => ({ ...family, gap: Math.abs(family.predicted - target) }))
      .sort((a, b) => a.gap - b.gap)[0];
    const fact = pickFactForSum(nextFamily.sum, { used: usedFacts, history });
    if (!fact) break;
    pushItem(fact, 'balanced');
  }

  const motifs = ai.learnerProfile.interestMotifs?.length
    ? ai.learnerProfile.interestMotifs
    : deriveMotifsFromInterests(ai.learnerProfile.interests);
  const themeName = ai.learnerProfile.interestThemePacks?.[0]?.label || null;
  const motif = motifs[0] || (themeName ? themeName.toLowerCase() : 'math adventure');
  const focusFamilies = weakFamilies.slice(0, 2).map((family) => family.sum).join(' & ');
  const missionName = themeName || toTitle(motif);
  const microStory = `During the ${missionName} mission, strengthen your ${focusFamilies || 'addition'} sums while staying near ${Math.round(target * 100)}% success.`;

  const planId = `local-plan-${now}`;
  const finalItems = items.slice(0, sessionSize).map((item) => ({
    ...item,
    microStory,
    source: 'local-fallback',
    planId,
  }));

  return {
    planId,
    source: 'local-fallback',
    generatedAt: now,
    microStory,
    items: finalItems,
    summary: {
      weakFamilies: weakFamilies.map((family) => family.sum),
      target,
    },
  };
}

export function updatePersonalizationAfterAttempt(personalization, attempt) {
  const ai = ensurePersonalization(personalization);
  const mastery = { ...(ai.mastery || {}) };
  const sum = attempt?.a + attempt?.b;
  const key = sumKey(sum);
  mastery[key] = updateMasteryNode(mastery[key], attempt?.correct);

  const sessionAttempts = [...(ai.sessionAttempts || [])];
  sessionAttempts.push({
    itemId: attempt?.planItemId || attempt?.itemId,
    sum,
    correct: Boolean(attempt?.correct),
    latencyMs: attempt?.latencyMs ?? null,
    source: attempt?.source || null,
    timestamp: attempt?.timestamp || Date.now(),
  });
  const trimmedAttempts = sessionAttempts.slice(-200);

  let activeSession = ai.activeSession;
  if (activeSession) {
    const completed = Array.isArray(activeSession.completed) ? [...activeSession.completed] : [];
    completed.push({
      itemId: attempt?.planItemId || attempt?.itemId,
      correct: Boolean(attempt?.correct),
      latencyMs: attempt?.latencyMs ?? null,
      timestamp: attempt?.timestamp || Date.now(),
    });
    const isComplete = completed.length >= (activeSession.items?.length || 0);
    activeSession = {
      ...activeSession,
      completed,
      completedAt: isComplete ? (attempt?.timestamp || Date.now()) : activeSession.completedAt,
    };
  }

  return {
    ...ai,
    mastery,
    sessionAttempts: trimmedAttempts,
    activeSession,
    lastInteractionAt: attempt?.timestamp || Date.now(),
  };
}
