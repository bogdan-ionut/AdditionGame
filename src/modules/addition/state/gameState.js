import { ensurePersonalization, TARGET_SUCCESS_BAND } from '../../../lib/aiPersonalization';
import { OPERATIONS } from '../../../lib/learningPaths';

export const DEFAULT_LEARNING_PATH_META = {
  id: 'addition-within-10',
  title: 'Adunare • Sume 0-9',
  description: 'Dezvoltă fluența la adunarea cu o cifră prin exerciții adaptive și povești interactive.',
  recommendedAges: 'Vârste 3-6',
  operation: 'addition',
  operationLabel: 'Adunare',
};

export const resolveActiveLearningPath = (learningPath) => {
  const operationKey = learningPath?.operation;
  const operationMeta = (operationKey && OPERATIONS[operationKey]) || OPERATIONS.addition || {};
  const merged = {
    ...DEFAULT_LEARNING_PATH_META,
    ...(learningPath || {}),
  };
  return {
    ...merged,
    operationLabel:
      learningPath?.operationLabel || operationMeta.label || DEFAULT_LEARNING_PATH_META.operationLabel,
    recommendedAges:
      learningPath?.recommendedAges || merged.recommendedAges || DEFAULT_LEARNING_PATH_META.recommendedAges,
  };
};

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const createDefaultMotifJobState = () => ({
  jobId: null,
  loading: false,
  error: null,
  done: 0,
  pending: 0,
  lastUpdated: null,
  nextRetryAt: null,
  rateLimited: false,
  cacheKey: null,
});

export const createDefaultGameState = () => ({
  version: '1.4.0',
  studentInfo: {
    name: '',
    age: 3.5,
    gender: '',
    startDate: new Date().toISOString(),
  },
  statistics: {
    totalProblemsAttempted: 0,
    totalCorrect: 0,
    totalTimeSpent: 0,
    averageTimePerProblem: 0,
    sessionsCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    problemHistory: {},
    strugglingProblems: [],
    wastePercentage: 0,
    answersTimeline: [],
    dailyTotals: {},
  },
  masteryTracking: {
    0: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    1: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    2: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    3: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    4: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    5: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    6: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    7: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    8: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
    9: { level: 'not-started', totalAttempts: 0, correctAttempts: 0, lastPracticed: null },
  },
  adaptiveLearning: {
    currentDifficulty: 'medium',
    strugglesDetected: 0,
    consecutiveCorrect: 0,
    needsReview: [],
    recommendedProblems: [],
    recentAttempts: [],
    checkpoint: { pending: false, inProgress: false },
  },
  aiPersonalization: {
    targetSuccess: TARGET_SUCCESS_BAND.midpoint,
    learnerProfile: {
      learnerId: '',
      parentId: 'local-parent',
      name: '',
      ageYears: null,
      interests: [],
      interestMotifs: [],
      motifsUpdatedAt: null,
      motifJob: null,
      motifSprites: [],
      motifSpritesUpdatedAt: null,
      motifSpriteCacheKey: null,
    },
    mastery: {},
    planQueue: [],
    activeSession: null,
    lastPlan: null,
    sessionAttempts: [],
  },
  achievements: {
    stageBadges: {},
  },
  sessionData: {
    currentSession: {
      startTime: null,
      problemsSolved: 0,
      timeSpent: 0,
      accuracy: 0,
    },
    dailySessions: [],
  },
});

export const migrateGameState = (raw) => {
  const base = createDefaultGameState();
  const gs = {
    ...base,
    ...raw,
    statistics: { ...base.statistics, ...(raw?.statistics || {}) },
    masteryTracking: { ...base.masteryTracking, ...(raw?.masteryTracking || {}) },
    adaptiveLearning: { ...base.adaptiveLearning, ...(raw?.adaptiveLearning || {}) },
    aiPersonalization: ensurePersonalization(
      raw?.aiPersonalization,
      raw?.studentInfo ?? base.studentInfo,
    ),
    achievements: {
      ...base.achievements,
      ...(raw?.achievements || {}),
      stageBadges: {
        ...(base.achievements?.stageBadges || {}),
        ...(raw?.achievements?.stageBadges || {}),
      },
    },
    sessionData: { ...base.sessionData, ...(raw?.sessionData || {}) },
  };

  if (!Array.isArray(gs.statistics.answersTimeline)) gs.statistics.answersTimeline = [];
  if (!gs.statistics.dailyTotals || typeof gs.statistics.dailyTotals !== 'object') gs.statistics.dailyTotals = {};
  if (!Array.isArray(gs.adaptiveLearning.needsReview)) gs.adaptiveLearning.needsReview = [];
  if (!Array.isArray(gs.adaptiveLearning.recentAttempts)) gs.adaptiveLearning.recentAttempts = [];
  if (!gs.adaptiveLearning.checkpoint) gs.adaptiveLearning.checkpoint = { pending: false, inProgress: false };
  if (gs.achievements?.stageBadges && typeof gs.achievements.stageBadges === 'object') {
    Object.keys(gs.achievements.stageBadges).forEach((key) => {
      const entry = gs.achievements.stageBadges[key];
      if (entry && typeof entry === 'object' && entry.highAccuracyRuns == null && entry.perfectRuns != null) {
        entry.highAccuracyRuns = entry.perfectRuns;
      }
    });
  }

  gs.version = '1.4.0';
  return gs;
};

export const SPRITE_CACHE_STORAGE_KEY = 'ai.sprite.cache';
export const SPRITE_CACHE_VERSION = 'v1';
export const SPRITE_CACHE_LIMIT = 12;

export const updateSpriteCacheEntryFromUi = (cacheKey, updater) => {
  if (!cacheKey || typeof window === 'undefined' || !window.localStorage || typeof updater !== 'function') {
    return;
  }
  try {
    const raw = window.localStorage.getItem(SPRITE_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const base =
      parsed && parsed.version === SPRITE_CACHE_VERSION && typeof parsed.entries === 'object'
        ? parsed
        : { version: SPRITE_CACHE_VERSION, entries: {} };
    const currentEntry = base.entries?.[cacheKey] || {};
    const nextEntry = updater(currentEntry) || {};
    const entries = { ...(base.entries || {}), [cacheKey]: { ...nextEntry, updatedAt: Date.now() } };
    const keys = Object.keys(entries);
    if (keys.length > SPRITE_CACHE_LIMIT) {
      keys
        .sort((a, b) => {
          const aTs = entries[a]?.updatedAt || 0;
          const bTs = entries[b]?.updatedAt || 0;
          return aTs - bTs;
        })
        .slice(0, keys.length - SPRITE_CACHE_LIMIT)
        .forEach((stale) => {
          delete entries[stale];
        });
    }
    window.localStorage.setItem(
      SPRITE_CACHE_STORAGE_KEY,
      JSON.stringify({ version: SPRITE_CACHE_VERSION, entries }),
    );
  } catch (error) {
    // ignore quota/JSON issues in UI
  }
};
