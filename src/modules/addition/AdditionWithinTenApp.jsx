import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, X, RotateCcw, Star, Trophy, Shuffle, Hash, ArrowLeft, Download, Upload, BarChart3, Brain, Zap, Target, User, UserRound, Wand2, Info } from 'lucide-react';
import ParentAISettings from '../../components/ParentAISettings';
import NextUpCard from '../../components/NextUpCard';
import {
  ensurePersonalization,
  updatePersonalizationAfterAttempt,
  generateLocalPlan,
  deriveMotifsFromInterests,
  TARGET_SUCCESS_BAND,
} from '../../lib/aiPersonalization';
import { buildThemePacksForInterests, resolveMotifTheme } from '../../lib/interestThemes';
import { requestGeminiPlan, requestInterestMotifs } from '../../services/aiPlanner';
import { getAiRuntime } from '../../lib/ai/runtime';
import { OPERATIONS } from '../../lib/learningPaths';
import Register from '../../Register';

// --- Helpers & Migration (Sprint 2) ---
const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const createDefaultGameState = () => ({
  version: "1.3.0",
  studentInfo: {
    name: "",
    age: 3.5,
    gender: "",
    startDate: new Date().toISOString(),
  },
  statistics: {
    totalProblemsAttempted: 0,
    totalCorrect: 0,
    totalTimeSpent: 0, // seconds
    averageTimePerProblem: 0, // seconds
    sessionsCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    problemHistory: {},
    strugglingProblems: [],
    wastePercentage: 0,
    // Sprint 1 fields (added now to keep state forward-compatible)
    answersTimeline: [], // [{ts,a,b,correct,timeSec,userAnswer}]
    dailyTotals: {}, // { 'YYYY-MM-DD': { attempts, correct, seconds } }
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
    currentDifficulty: 'medium', // 'easy'|'medium'|'hard'
    strugglesDetected: 0,
    consecutiveCorrect: 0,
    needsReview: [], // [{key,a,b,stage,dueAt}]
    recommendedProblems: [],
    recentAttempts: [], // keep last 10: {correct, ms}
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
    },
    mastery: {},
    planQueue: [],
    activeSession: null,
    lastPlan: null,
    sessionAttempts: [],
  },
  sessionData: {
    currentSession: {
      startTime: null,
      problemsSolved: 0,
      timeSpent: 0, // seconds
      accuracy: 0,
    },
    dailySessions: [],
  }
});

const migrateGameState = (raw) => {
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
    sessionData: { ...base.sessionData, ...(raw?.sessionData || {}) },
  };
  // ensure arrays and maps exist
  if (!Array.isArray(gs.statistics.answersTimeline)) gs.statistics.answersTimeline = [];
  if (!gs.statistics.dailyTotals || typeof gs.statistics.dailyTotals !== 'object') gs.statistics.dailyTotals = {};
  if (!Array.isArray(gs.adaptiveLearning.needsReview)) gs.adaptiveLearning.needsReview = [];
  if (!Array.isArray(gs.adaptiveLearning.recentAttempts)) gs.adaptiveLearning.recentAttempts = [];
  if (!gs.adaptiveLearning.checkpoint) gs.adaptiveLearning.checkpoint = { pending: false, inProgress: false };
    gs.version = '1.3.0';
  return gs;
};

const knowledgeBands = [
  { minNumber: -1, label: 'Pre-K Explorer', detail: 'Building counting and subitizing foundations.', levelIndex: 0 },
  { minNumber: 3, label: 'Kindergarten Super Counter', detail: 'Comfortable with sums to 5 using manipulatives or fingers.', levelIndex: 1 },
  { minNumber: 6, label: '1st Grade Number Ninja', detail: 'Fluent with single-digit facts up to +7 and ready to bridge tens.', levelIndex: 2 },
  { minNumber: 8, label: '2nd Grade Math Adventurer', detail: 'Solid on high addends and preparing for double-digit reasoning.', levelIndex: 3 },
];

const ageBands = [
  { maxAge: 4.5, label: 'Pre-K (ages 3-4)', levelIndex: 0, detail: 'Exploring numbers through play.' },
  { maxAge: 5.5, label: 'Kindergarten (ages 5-6)', levelIndex: 1, detail: 'Working within 5 and early addition.' },
  { maxAge: 6.5, label: '1st Grade (ages 6-7)', levelIndex: 2, detail: 'Mastering facts within 10.' },
  { maxAge: 7.5, label: '2nd Grade (ages 7-8)', levelIndex: 3, detail: 'Extending into regrouping and higher addends.' },
  { maxAge: Infinity, label: 'Upper Elementary (8+)', levelIndex: 4, detail: 'Ready for multi-digit addition and subtraction.' },
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
    return { label: '🚀 Far Ahead', tone: 'ahead', message: 'Operating well beyond age expectations—consider enrichment challenges!' };
  }
  if (diff === 1) {
    return { label: '📈 Slightly Ahead', tone: 'ahead', message: 'Comfortably ahead of age-based benchmarks—keep the momentum.' };
  }
  if (diff === 0) {
    return { label: '✅ On Track', tone: 'balanced', message: 'Knowledge grade aligns with age expectations.' };
  }
  if (diff === -1) {
    return { label: '🎯 Growth Zone', tone: 'support', message: 'A touch of extra practice will close the tiny gap.' };
  }
  return { label: '🧭 Personalized Support Needed', tone: 'support', message: 'Focus reviews and manipulatives to accelerate catch-up.' };
};

const computeKnowledgeInsights = (gameState) => {
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
      return { ...ageBands[0], label: 'Age not set', detail: 'Update student profile to unlock comparisons.', levelIndex: 0 };
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

const computeLearningPathInsights = (gameState) => {
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

  const overrides = new Set();
  for (let i = 0; i <= readinessWindow; i += 1) {
    overrides.add(i);
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
      unlockedByPath: overrides.has(perf.number),
      priority: 0,
      reason: '',
    };

    if (!overrides.has(perf.number) && perf.attempts >= 6 && perf.accuracy >= 0.8) {
      overrides.add(perf.number);
      entry.unlockedByPath = true;
    }

    if (entry.level === 'mastered') {
      entry.reason = 'Maintain mastery with occasional spaced review.';
      entry.priority = 10 + (9 - perf.number);
    } else if (entry.level === 'struggling') {
      entry.reason = 'Frequent errors detected—schedule a focused review set.';
      entry.priority = 110 - entry.masteryPercent;
    } else if (entry.level === 'learning') {
      entry.reason = 'Active learning phase—keep momentum for a mastery badge.';
      entry.priority = 90 - entry.masteryPercent;
    } else if (entry.level === 'proficient') {
      entry.reason = 'Solid performance—polish accuracy to earn full mastery.';
      entry.priority = 70 - (entry.masteryPercent / 2);
    } else {
      if (overrides.has(perf.number)) {
        if (perf.number === highestMastered + 1) {
          entry.reason = 'Next sequential milestone after your latest mastery.';
        } else {
          entry.reason = 'Unlocked early thanks to strong accuracy and focus streaks.';
        }
        entry.priority = 80 - perf.number;
      } else {
        entry.reason = 'Still gated—watch for readiness signals or review earlier numbers.';
        entry.priority = 30 - perf.number;
      }
    }

    entries.push(entry);
  });

  entries.sort((a, b) => b.priority - a.priority);

  return {
    path: entries,
    overrides,
    highestMastered,
    metrics: {
      overallAccuracy: Math.round(overallAccuracy * 100),
      streak: streakPower,
      avgTime: avgTime ? avgTime.toFixed(1) : '0.0',
    },
  };
};

// Beautiful SVG object renderer for each digit
const CountableObjects = ({ digit, type, theme = null }) => {
  const renderThemedObject = (index) => {
    if (!theme || !theme.icons || theme.icons.length === 0) return null;
    const icon = theme.icons[index % theme.icons.length];
    const jitterX = (Math.sin(index * 2.5) * 4);
    const jitterY = (Math.cos(index * 3.2) * 4);
    const rotation = (Math.sin(index * 1.7) * 15);

    return (
      <div key={index} style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`, fontSize: '2.5rem' }}>
        {icon}
      </div>
    );
  };

  const renderObject = (index) => {
    const jitterX = (Math.sin(index * 2.5) * 4);
    const jitterY = (Math.cos(index * 3.2) * 4);
    const rotation = (Math.sin(index * 1.7) * 15);

    switch(type) {
      case 0:
        return (
          <svg key={index} width="40" height="40" viewBox="0 0 40 40" style={{transform: `translate(${jitterX}px, ${jitterY}px)`}}>
            <circle cx="20" cy="20" r="16" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4"/>
            <text x="20" y="26" textAnchor="middle" fill="#94a3b8" fontSize="16" fontWeight="bold">0</text>
          </svg>
        );
      case 1:
        return (
          <svg key={index} width="28" height="50" viewBox="0 0 28 50" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <linearGradient id={`stick-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="50%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <rect x="8" y="2" width="12" height="46" rx="6" fill={`url(#stick-grad-${index})`}/>
            <ellipse cx="10" cy="8" rx="2" ry="8" fill="#d97706" opacity="0.3"/>
          </svg>
        );
      case 2:
        return (
          <svg key={index} width="38" height="32" viewBox="0 0 38 32" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <radialGradient id={`pebble-grad-${index}`}>
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="70%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#6b7280" />
              </radialGradient>
            </defs>
            <ellipse cx="19" cy="16" rx="17" ry="14" fill={`url(#pebble-grad-${index})`}/>
            <ellipse cx="12" cy="10" rx="6" ry="4" fill="white" opacity="0.4"/>
          </svg>
        );
      case 3:
        return (
          <svg key={index} width="40" height="36" viewBox="0 0 40 36" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <linearGradient id={`leaf-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86efac" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
            <path d="M20,2 Q35,18 20,34 Q5,18 20,2 Z" fill={`url(#leaf-grad-${index})`}/>
            <path d="M20,2 L20,34" stroke="#15803d" strokeWidth="2" fill="none"/>
            <path d="M20,10 Q28,14 20,20" stroke="#15803d" strokeWidth="1" fill="none" opacity="0.5"/>
            <path d="M20,16 Q12,20 20,26" stroke="#15803d" strokeWidth="1" fill="none" opacity="0.5"/>
          </svg>
        );
      case 4:
        return (
          <svg key={index} width="36" height="36" viewBox="0 0 36 36" style={{transform: `translate(${jitterX}px, ${jitterY}px)`}}>
            <defs>
              <radialGradient id={`marble-grad-${index}`}>
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e40af" />
              </radialGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#marble-grad-${index})`}/>
            <circle cx="13" cy="12" r="5" fill="white" opacity="0.7"/>
            <circle cx="11" cy="10" r="3" fill="white" opacity="0.9"/>
            <circle cx="22" cy="24" r="3" fill="#1e3a8a" opacity="0.3"/>
          </svg>
        );
      case 5:
        return (
          <svg key={index} width="36" height="36" viewBox="0 0 36 36" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <linearGradient id={`button-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#button-grad-${index})`} stroke="#d97706" strokeWidth="2"/>
            <circle cx="12" cy="13" r="2.5" fill="#92400e"/>
            <circle cx="24" cy="13" r="2.5" fill="#92400e"/>
            <circle cx="12" cy="23" r="2.5" fill="#92400e"/>
            <circle cx="24" cy="23" r="2.5" fill="#92400e"/>
          </svg>
        );
      case 6:
        return (
          <svg key={index} width="42" height="38" viewBox="0 0 42 38" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <radialGradient id={`rock-grad-${index}`}>
                <stop offset="0%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#4b5563" />
              </radialGradient>
            </defs>
            <path d="M8,20 L15,8 L25,6 L35,12 L38,22 L32,32 L20,35 L10,30 Z" fill={`url(#rock-grad-${index})`}/>
            <ellipse cx="16" cy="14" rx="6" ry="4" fill="white" opacity="0.2"/>
            <path d="M12,18 L18,16 L14,22" stroke="#374151" strokeWidth="1.5" fill="none" opacity="0.4"/>
          </svg>
        );
      case 7:
        return (
          <svg key={index} width="32" height="46" viewBox="0 0 32 46" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <radialGradient id={`acorn-cap-${index}`}>
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <radialGradient id={`acorn-body-${index}`}>
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </radialGradient>
            </defs>
            <ellipse cx="16" cy="8" rx="14" ry="8" fill={`url(#acorn-cap-${index})`}/>
            <path d="M4,8 Q16,4 28,8" stroke="#78350f" strokeWidth="1.5" fill="none"/>
            <path d="M6,11 Q16,7 26,11" stroke="#78350f" strokeWidth="1.5" fill="none"/>
            <ellipse cx="16" cy="28" rx="11" ry="16" fill={`url(#acorn-body-${index})`}/>
            <ellipse cx="12" cy="20" rx="3" ry="5" fill="#fef3c7" opacity="0.5"/>
            <circle cx="16" cy="38" r="2" fill="#78350f"/>
          </svg>
        );
      case 8:
        return (
          <svg key={index} width="38" height="38" viewBox="0 0 38 38" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <linearGradient id={`shell-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fed7aa" />
              </linearGradient>
            </defs>
            <path d="M19,4 L6,32 L19,28 L32,32 Z" fill={`url(#shell-grad-${index})`} stroke="#fdba74" strokeWidth="2"/>
            {[8, 14, 20, 26].map((y, i) => (
              <line key={i} x1="19" y1={y} x2="19" y2={y + 4} stroke="#fed7aa" strokeWidth="1.5"/>
            ))}
            <path d="M19,4 L10,28" stroke="#fdba74" strokeWidth="1.5" fill="none" opacity="0.6"/>
            <path d="M19,4 L28,28" stroke="#fdba74" strokeWidth="1.5" fill="none" opacity="0.6"/>
          </svg>
        );
      case 9:
        return (
          <svg key={index} width="34" height="50" viewBox="0 0 34 50" style={{transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`}}>
            <defs>
              <linearGradient id={`pine-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <ellipse cx="17" cy="25" rx="13" ry="22" fill={`url(#pine-grad-${index})`}/>
            {[8, 14, 20, 26, 32, 38].map((y, i) => (
              <g key={i}>
                <ellipse cx="10" cy={y} rx="4" ry="3" fill="#a16207" opacity="0.8"/>
                <ellipse cx="17" cy={y + 2} rx="4" ry="3" fill="#a16207" opacity="0.8"/>
                <ellipse cx="24" cy={y} rx="4" ry="3" fill="#a16207" opacity="0.8"/>
              </g>
            ))}
            <ellipse cx="17" cy="6" rx="3" ry="4" fill="#92400e"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const cols = digit <= 3 ? digit : Math.ceil(Math.sqrt(digit));
  const rows = digit === 0 ? 0 : Math.ceil(digit / cols);
  const itemsToRender = digit;

  return (
    <div className="flex items-center justify-center min-h-[130px] p-2">
      <div
        className="grid gap-3 items-center justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${cols || 1}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
        }}
      >
        {Array.from({ length: itemsToRender }, (_, i) => theme ? renderThemedObject(i) : renderObject(i))}
      </div>
    </div>
  );
};

// Number line with segments for hinting
const NumberLine = ({ max = 18, a = 0, b = 0, showHint = false }) => {
  const total = Math.max(max, a + b);
  const ticks = Array.from({ length: total + 1 }, (_, i) => i);
  return (
    <div className="mt-6 px-2">
      <div className="relative h-12 border-t-2 border-gray-800">
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-gray-800" />
        <div className="flex justify-between items-start h-full">
          {ticks.map((i) => (
            <div key={i} className="flex flex-col items-center -mt-0.5">
              <div className={`w-0.5 h-3 ${
                showHint && ((i <= a && i > 0) ? 'bg-green-600' : (i > a && i <= a + b) ? 'bg-blue-600' : 'bg-gray-800')
              }`}/>
              <span className={`text-sm font-bold mt-1 ${i === a ? 'text-green-700' : i === a + b ? 'text-blue-700' : 'text-gray-900'}`}>{i}</span>
            </div>
          ))}
        </div>
      </div>
      {showHint && (
        <div className="text-center text-sm text-gray-700 mt-2">
          Count to <span className="font-bold text-green-700">{a}</span>, then jump <span className="font-bold text-blue-700">{b}</span> more → <span className="font-bold">{a + b}</span>
        </div>
      )}
    </div>
  );
};

const GuidedCountingAnimation = ({ card, step, complete }) => {
  if (!card) return null;
  const total = card.a + card.b;
  const numbers = Array.from({ length: total + 1 }, (_, i) => i);
  const accuracyMessage = complete
    ? `We landed on ${total}! Type it in the box.`
    : `Let's count from ${card.a} and add ${card.b} more together.`;

  return (
    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
      <div className="text-sm font-semibold text-blue-800 text-center mb-3">{accuracyMessage}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {numbers.map(value => {
          const isStart = value === card.a;
          const isActive = value <= step;
          return (
            <div
              key={value}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                isStart
                  ? 'bg-green-200 text-green-800 border-2 border-green-500'
                  : isActive
                  ? 'bg-blue-500 text-white border-2 border-blue-600'
                  : 'bg-white text-gray-500 border-2 border-blue-200'
              }`}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const pickReviewDue = (adaptiveLearning) => {
  const now = Date.now();
  const queue = adaptiveLearning?.needsReview || [];
  const due = queue.filter((p) => p.dueAt <= now);
  const remaining = queue.filter((p) => p.dueAt > now);
  const reviewCards = due.map(({ a, b }) => ({ a, b, answer: a + b, review: true }));
  return { reviewCards, remaining };
};

const scheduleReview = (needsReview, a, b) => {
  const key = `${a}+${b}`;
  const stages = [10 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];
  const now = Date.now();
  const index = needsReview.findIndex((p) => p.key === key);

  if (index !== -1) {
    const updated = [...needsReview];
    const existing = { ...updated[index] };
    const nextStage = Math.min((existing.stage || 0) + 1, stages.length - 1);
    existing.stage = nextStage;
    existing.dueAt = now + stages[nextStage];
    updated[index] = existing;
    return updated;
  }

  return [...needsReview, { key, a, b, stage: 0, dueAt: now + stages[0] }];
};

// Parent Dashboard Component
const ParentDashboard = ({ gameState, aiRuntime, onClose }) => {
  const stats = gameState.statistics;
  const mastery = gameState.masteryTracking;
  const knowledgeInsights = computeKnowledgeInsights(gameState);
  const { knowledgeGrade, ageGrade, delta } = knowledgeInsights;

  const totalProblems = Object.values(stats.problemHistory).length;
  const correctProblems = Object.values(stats.problemHistory).filter(p => p.correct).length;
  const totalAttempts = stats.totalProblemsAttempted || 0;
  const totalCorrect = stats.totalCorrect || 0;
  const overallAccuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '0.0';

  const avgTime = totalAttempts > 0 ? stats.averageTimePerProblem.toFixed(1) : 0;
  const todayKey = dayKey();
  const todayTotals = stats.dailyTotals?.[todayKey] || { attempts: 0, correct: 0, seconds: 0 };
  const todayMinutes = (todayTotals.seconds / 60).toFixed(1);
  const wastePercentage = (stats.wastePercentage || 0).toFixed(1);

  // Calculate growth rate using answersTimeline (last 7 days) vs baseline 20
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const attempts7d = (stats.answersTimeline || []).filter(e => e.ts >= weekAgo).length;
  const growthRate = totalAttempts > 0 ? ((attempts7d / 20) || 0).toFixed(1) : '0.0';

  const baselineDaily = 20 / 7;
  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = dayKey(date.getTime());
    const attempts = stats.dailyTotals?.[key]?.attempts || 0;
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      attempts,
    };
  });
  const maxDailyAttempts = Math.max(
    baselineDaily,
    ...last7Days.map(day => day.attempts)
  );

  // Coverage bar: percent of 100 pairs with >=1 correct
  const coverageSet = new Set(
    Object.entries(stats.problemHistory)
      .filter(([, v]) => v.correct > 0)
      .map(([k]) => k)
  );
  const coveragePct = ((coverageSet.size / 100) * 100).toFixed(0);

  const deltaToneClasses = {
    ahead: 'border-green-300 bg-green-50 text-green-700',
    balanced: 'border-blue-300 bg-blue-50 text-blue-700',
    support: 'border-orange-300 bg-orange-50 text-orange-700',
  };
  const deltaClass = deltaToneClasses[delta.tone] || deltaToneClasses.balanced;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">Parent Dashboard</h2>
              <p className="text-blue-100">Detailed Learning Analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                  aiRuntime?.aiEnabled
                    ? 'bg-emerald-400/20 border-emerald-200/40 text-emerald-100'
                    : 'bg-white/10 border-white/30 text-white'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${aiRuntime?.aiEnabled ? 'bg-emerald-200' : 'bg-red-200'}`}
                  aria-hidden="true"
                />
                {aiRuntime?.aiEnabled ? 'AI Enabled' : 'AI Disabled'}
              </span>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border-2 border-green-200">
              <div className="text-green-600 text-sm font-medium mb-1">Overall Accuracy</div>
              <div className="text-3xl font-bold text-green-700">{overallAccuracy}%</div>
              <div className="text-xs text-green-600 mt-1">Target: 70-95%</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200">
              <div className="text-blue-600 text-sm font-medium mb-1">Avg Time/Problem</div>
              <div className="text-3xl font-bold text-blue-700">{avgTime}s</div>
              <div className="text-xs text-blue-600 mt-1">Target: 30-60s</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border-2 border-purple-200">
                <div className="text-purple-600 text-sm font-medium mb-1">Today&apos;s Minutes</div>
              <div className="text-3xl font-bold text-purple-700">{todayMinutes}</div>
              <div className="text-xs text-purple-600 mt-1">Target: &lt;20 min</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border-2 border-orange-200">
              <div className="text-orange-600 text-sm font-medium mb-1">Growth Rate</div>
              <div className="text-3xl font-bold text-orange-700">{growthRate}x</div>
              <div className="text-xs text-orange-600 mt-1">vs typical child</div>
            </div>
          </div>

          {/* Knowledge vs Age Grade */}
          <div className="bg-gradient-to-br from-sky-50 to-indigo-50 p-6 rounded-xl border-2 border-sky-200">
            <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
              <Brain className="text-indigo-500" />
              Knowledge Grade vs Age Grade
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4">
                <div className="text-xs uppercase text-indigo-500 font-semibold tracking-wide">Knowledge Grade</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{knowledgeGrade.label}</div>
                <p className="text-sm text-gray-600 mt-2">{knowledgeGrade.detail}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{knowledgeGrade.progressPercent}% of single-digit map</span>
                  </div>
                  <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${knowledgeGrade.progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-indigo-600 mt-2">
                    Highest strong number: {knowledgeGrade.highestStrong >= 0 ? knowledgeGrade.highestStrong : 'in progress'} · Next focus: {knowledgeGrade.nextNumber}
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-sky-200 rounded-2xl p-4">
                <div className="text-xs uppercase text-sky-500 font-semibold tracking-wide">Age Expectation</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{ageGrade.label}</div>
                <p className="text-sm text-gray-600 mt-2">{ageGrade.detail}</p>
                <div className="mt-4 text-xs text-sky-600">
                  Student age: {typeof gameState.studentInfo?.age === 'number' ? `${gameState.studentInfo.age.toFixed(1)} years` : 'Not provided'}
                </div>
              </div>

              <div className={`rounded-2xl p-4 border-2 ${deltaClass}`}>
                <div className="text-xs uppercase font-semibold tracking-wide">Alignment Snapshot</div>
                <div className="text-xl font-bold mt-1">{delta.label}</div>
                <p className="text-sm mt-2">{delta.message}</p>
                <div className="mt-4 text-xs font-semibold">
                  {aiRuntime?.aiEnabled
                    ? `AI suggests leaning into +${knowledgeGrade.nextNumber} next to keep growth on pace.`
                    : 'Local insights recommend continuing steady practice while AI features are paused.'}
                </div>
              </div>
            </div>
          </div>

          {/* Coverage Bar */}
          <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Coverage of (0..9)×(0..9) with ≥1 correct</span>
              <span>{coveragePct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${coveragePct}%` }} />
            </div>
          </div>

          {/* Growth Chart */}
          <div className="bg-white p-6 rounded-xl border-2 border-orange-200">
            <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Target className="text-orange-500" />
              Growth vs Typical Pace
            </h3>
            <div className="h-40 flex items-end gap-3">
              {last7Days.map((day, index) => {
                const actualHeight = maxDailyAttempts > 0 ? (day.attempts / maxDailyAttempts) * 100 : 0;
                const baselineHeight = maxDailyAttempts > 0 ? (baselineDaily / maxDailyAttempts) * 100 : 0;
                return (
                  <div key={`${day.label}-${index}`} className="flex-1 flex flex-col items-center">
                    <div className="relative w-full flex-1 bg-orange-100 rounded-t-xl overflow-hidden">
                      <div
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-500 to-orange-400"
                        style={{ height: `${actualHeight}%` }}
                      />
                      <div
                        className="absolute inset-x-0 border-t-2 border-dashed border-orange-700"
                        style={{ bottom: `${baselineHeight}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-orange-700">{day.label}</div>
                    <div className="text-[10px] text-orange-500">{day.attempts} attempts</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-orange-600 mt-3 text-center">
              Dashed line marks a typical daily pace (~{baselineDaily.toFixed(1)} attempts).
            </p>
          </div>

          {/* Learning Efficiency */}
          <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Zap className="text-yellow-500" />
              Learning Efficiency
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Focus Score</span>
                  <span className="text-sm font-bold text-gray-900">{(100 - parseFloat(wastePercentage)).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${parseFloat(wastePercentage) < 20 ? 'bg-green-500' : parseFloat(wastePercentage) < 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{width: `${100 - parseFloat(wastePercentage)}%`}}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Waste: {wastePercentage}% (Target: &lt;20%)</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Problems Solved</div>
                  <div className="text-2xl font-bold text-gray-800">{totalProblems}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Correct Answers</div>
                  <div className="text-2xl font-bold text-green-600">{correctProblems}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mastery Tracking */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="text-indigo-600" />
              Mastery Progress (by number)
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(mastery).map(([num, data]) => {
                const masteryPercent = data.totalAttempts > 0
                  ? (data.correctAttempts / data.totalAttempts * 100).toFixed(0)
                  : 0;
                const isMastered = parseFloat(masteryPercent) >= 90;

                return (
                  <div key={num} className={`p-3 rounded-xl text-center ${
                    isMastered ? 'bg-green-100 border-2 border-green-400' :
                    parseFloat(masteryPercent) >= 70 ? 'bg-yellow-100 border-2 border-yellow-400' :
                    'bg-red-100 border-2 border-red-400'
                  }`}>
                    <div className="text-2xl font-bold mb-1">{num}</div>
                    <div className="text-xs font-medium">{masteryPercent}%</div>
                    {isMastered && <div className="text-xs text-green-600 mt-1">✓ Mastered</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Struggle Zones */}
          <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Brain className="text-red-600" />
              Struggle Zones (Need Review)
            </h3>
            <div className="space-y-2">
              {stats.strugglingProblems.slice(0, 10).map((problem, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg flex justify-between items-center">
                  <span className="font-mono text-lg font-bold">{problem.a} + {problem.b}</span>
                  <span className="text-sm text-red-600 font-medium">{problem.attempts} attempts</span>
                </div>
              ))}
              {stats.strugglingProblems.length === 0 && (
                <p className="text-gray-600 text-center py-4">🎉 No struggles detected! Excellent work!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mode selection screen (with Mastery Gates)
const ModeSelection = ({
  learningPath,
  onExit,
  onSelectMode,
  gameState,
  onShowDashboard,
  onExport,
  onImport,
  onLogout,
  onOpenAiSettings,
  aiPersonalization,
  aiPreviewItem,
  aiPlanStatus,
  interestDraft,
  onInterestDraftChange,
  onAddInterest,
  onRemoveInterest,
  onStartAiPath,
  onRefreshPlan,
  aiRuntime,
}) => {
  const fileInputRef = useRef(null);
  const [showAbout, setShowAbout] = useState(false);
  const pathMeta = {
    title: 'Addition Flashcards',
    description: 'AI-Powered Mastery Learning for sums within 10.',
    recommendedAges: 'Ages 3-6',
    operationLabel: 'Addition',
    ...learningPath,
  };
  const exitHandler = onExit ?? (() => {});
  const learningInsights = useMemo(() => computeLearningPathInsights(gameState), [gameState]);
  const overrides = learningInsights.overrides || new Set();
  const metrics = learningInsights.metrics || { overallAccuracy: 0, streak: 0, avgTime: '0.0' };
  const targetSuccessPercent = Math.round(((aiPersonalization?.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint) * 100));
  const focusRecommendations = (learningInsights.path || [])
    .filter((entry) => entry.level !== 'mastered' || entry.unlockedByPath)
    .slice(0, 5);

  const modes = [
    { id: 'sequential', name: 'All Numbers', desc: 'Practice all additions 0-9 in order', icon: Hash, color: 'blue' },
    { id: 'random', name: 'Random Practice', desc: 'Random additions from 0-9', icon: Shuffle, color: 'purple' },
  ];

  const numberModes = Array.from({ length: 10 }, (_, i) => ({
    id: `focus-${i}`,
    number: i,
    name: `Adding with ${i}`,
    desc: `Learn all additions with ${i}`,
    color: ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'cyan', 'blue', 'purple'][i]
  }));

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          onImport(data);
        } catch (error) {
          alert('Invalid file format!');
        }
      };
      reader.readAsText(file);
    }
  };

  const isLocked = (n) => {
    if (overrides?.has(n)) return false;
    if (n === 0) return false;
    const prev = gameState.masteryTracking[n - 1];
    const prevAccuracy = prev && prev.totalAttempts > 0 ? prev.correctAttempts / prev.totalAttempts : 0;
    return !(prev && (prev.level === 'mastered' || prevAccuracy >= 0.9));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-8 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <button
            onClick={exitHandler}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-xl shadow hover:shadow-lg transition"
          >
            <ArrowLeft size={18} />
            <span>Learning Paths</span>
          </button>
          <div className="text-sm text-gray-600 sm:text-right">
            <div className="font-semibold uppercase tracking-wider text-indigo-500">{pathMeta.operationLabel || 'Operation'}</div>
            <div>{pathMeta.recommendedAges}</div>
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">{pathMeta.title}</h1>
          <p className="text-xl text-gray-600">{pathMeta.description}</p>
        </div>

        <div className="flex justify-center mb-6">
          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-full border text-sm font-semibold ${
              aiRuntime?.aiEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}
          >
            <span>{aiRuntime?.aiEnabled ? 'AI features enabled' : 'AI features disabled'}</span>
            <span className="text-xs font-normal text-gray-500">
              Server key: {aiRuntime?.serverHasKey ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Profile Section */}
        <div className="flex justify-center items-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg border-2 border-gray-200">
                {gameState.studentInfo.gender === 'male' ? (
                  <User className="text-blue-500" size={20} />
                ) : (
                  <UserRound className="text-pink-500" size={20} />
                )}
                <span className="font-semibold">{gameState.studentInfo.name}</span>
                <span className="text-gray-500">|</span>
                <span className="text-sm">{gameState.studentInfo.age} years old</span>
            </div>
            <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-all"
            >
                Logout
            </button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={onShowDashboard}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-blue-200"
          >
            <BarChart3 className="text-blue-600" size={20} />
            <span className="font-semibold">Parent Dashboard</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-green-200"
          >
            <Download className="text-green-600" size={20} />
            <span className="font-semibold">Export Progress</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-purple-200"
          >
            <Upload className="text-purple-600" size={20} />
            <span className="font-semibold">Import Progress</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => onOpenAiSettings?.()}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-indigo-200"
          >
            <Wand2 className="text-indigo-600" size={20} />
            <span className="font-semibold">AI Settings</span>
          </button>
          <button
            onClick={() => setShowAbout((prev) => !prev)}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-amber-200"
          >
            <Info className="text-amber-600" size={20} />
            <span className="font-semibold">{showAbout ? 'Hide About' : 'About & AI Guide'}</span>
          </button>
        </div>

        {/* Personalized Learning Journey */}
        <div className="bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-50 p-8 rounded-3xl shadow-lg border-2 border-indigo-200 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Personalized Learning Journey</h2>
              <p className="text-gray-600 mt-1">
                AI unlocked practice based on {metrics.overallAccuracy}% accuracy, a streak of {metrics.streak}, and {metrics.avgTime}s average response time.
              </p>
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-2xl px-4 py-2 text-sm text-indigo-700 font-semibold shadow">
              Highest mastery badge: {learningInsights.highestMastered >= 0 ? learningInsights.highestMastered : 'None yet'}
            </div>
        </div>

        {showAbout && (
          <div className="bg-white rounded-3xl shadow-lg border-2 border-amber-200 p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-amber-600" size={24} />
              <h3 className="text-2xl font-bold text-gray-800">About {activeLearningPath.title || 'Addition Flashcards'}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {(activeLearningPath.title || 'Addition Flashcards')} blends classic fact practice with adaptive planning. Use this guide to see what is powered by AI and how to try it out.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h4 className="text-lg font-semibold text-amber-800 mb-3">Core Gameplay</h4>
                <ul className="list-disc list-inside text-sm text-amber-900 space-y-2">
                  <li>Choose All Numbers or Random Practice for traditional drills unlocked through <span className="font-semibold">sequential</span> and <span className="font-semibold">random</span> modes.</li>
                  <li>Target specific fact families with the number tiles (e.g., <em>Adding with 5</em>) for focused repetition.</li>
                  <li>Track progress, export sessions, and review insights in the Parent Dashboard.</li>
                </ul>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <h4 className="text-lg font-semibold text-indigo-800 mb-3">AI-Powered Experiences</h4>
                <ul className="list-disc list-inside text-sm text-indigo-900 space-y-2">
                  <li>
                    <span className="font-semibold">AI-Driven Next Step card</span> previews the upcoming problem using the active plan queue. When a Gemini plan is available it shows the story, hints, and predicted success pulled from the AI response.
                  </li>
                  <li>
                    <span className="font-semibold">Start AI Path</span> requests 10-step sessions from Gemini based on weak fact families and interests. Without a key, it falls back to the local adaptive planner so practice never stops.
                  </li>
                  <li>
                    <span className="font-semibold">Interest motifs</span> transform the learner&apos;s interests into story hooks. Add interests in the panel above to send them to Gemini for motif generation (with local patterning as backup).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {focusRecommendations.map((item) => {
              const badgeStyles = {
                mastered: 'bg-green-100 text-green-700 border-green-300',
                proficient: 'bg-blue-100 text-blue-700 border-blue-300',
                learning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                struggling: 'bg-red-100 text-red-700 border-red-300',
                'not-started': 'bg-slate-100 text-slate-700 border-slate-300',
              };
              const levelBadgeClass = badgeStyles[item.level] || badgeStyles['not-started'];
              return (
                <div key={`focus-${item.number}`} className="bg-white border-2 border-indigo-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-3xl font-bold">
                        {item.number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-800">
                            {item.level === 'mastered' ? 'Maintain mastery' : item.level === 'struggling' ? 'Review focus' : 'Focus on'} +{item.number}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${levelBadgeClass}`}>
                            {item.level.replace('-', ' ')}
                          </span>
                          {item.unlockedByPath && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-300">
                              Path unlocked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{item.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                          <span className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-full">Mastery: {item.masteryPercent}%</span>
                          <span className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-full">Accuracy: {item.accuracy}% ({item.attempts} attempts)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectMode(`focus-${item.number}`, item.number)}
                    className="self-start md:self-center px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                  >
                    Practice +{item.number}
                  </button>
                </div>
              );
            })}
            {focusRecommendations.length === 0 && (
              <div className="bg-white border-2 border-indigo-200 rounded-3xl p-6 text-center text-gray-600">
                We need a few more data points to personalize the journey. Start any mode to unlock tailored recommendations.
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Wand2 className="text-indigo-500" size={18} /> Learner Interests
                </h3>
                <p className="text-sm text-gray-600 mt-1">Add 2-4 interests to personalize stories and examples.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(aiPersonalization?.learnerProfile?.interests || []).map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium"
                  >
                    {interest}
                    <button
                      type="button"
                      className="text-indigo-500 hover:text-indigo-700"
                      onClick={() => onRemoveInterest?.(interest)}
                      aria-label={`Remove ${interest}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {!(aiPersonalization?.learnerProfile?.interests || []).length && (
                  <span className="text-sm text-gray-500">No interests yet—add a few below!</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={interestDraft}
                  onChange={(e) => onInterestDraftChange?.(e.target.value)}
                  placeholder="e.g. dinosaurs, soccer, baking"
                  className="flex-1 px-3 py-2 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={onAddInterest}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              {aiPersonalization?.learnerProfile?.interestMotifs?.length > 0 && (
                <div className="text-xs text-gray-500">
                  Motifs: {aiPersonalization.learnerProfile.interestMotifs.slice(0, 6).join(', ')}
                </div>
              )}
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-5 shadow-sm">
              <NextUpCard
                item={aiPreviewItem}
                story={aiPreviewItem?.microStory || aiPersonalization?.lastPlan?.microStory}
                loading={aiPlanStatus?.loading}
                planSource={aiPlanStatus?.source || aiPreviewItem?.source || aiPersonalization?.lastPlan?.source}
                targetSuccess={targetSuccessPercent}
                configured={aiRuntime?.aiEnabled}
                onStartAiPath={onStartAiPath}
                onRefreshPlan={onRefreshPlan}
              />
            </div>
          </div>
        </div>

        {/* Main modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className="bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 border-4 border-blue-200 hover:border-blue-400"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Icon className="text-blue-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{mode.name}</h3>
                <p className="text-gray-600">{mode.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Number-specific modes with Mastery Gates */}
        <div className="bg-white p-8 rounded-3xl shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Practice with Specific Numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {numberModes.map((mode) => {
              const mastery = gameState.masteryTracking[mode.number];
              const masteryPercent = mastery && mastery.totalAttempts > 0
                ? (mastery.correctAttempts / mastery.totalAttempts * 100).toFixed(0)
                : 0;
              const locked = isLocked(mode.number);
              const aiUnlocked =
                aiRuntime?.aiEnabled && overrides?.has(mode.number) && mode.number > (learningInsights.highestMastered ?? -1) + 1;

              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    if (locked) {
                      alert(`Locked: master ${mode.number - 1} first (≥90% accuracy).`);
                      return;
                    }
                    onSelectMode(mode.id, mode.number);
                  }}
                  disabled={locked}
                  className={`relative bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded-2xl shadow hover:shadow-lg transition-all transform ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} border-2 border-gray-300`}
                  title={locked ? `Requires mastering ${mode.number - 1}` : ''}
                >
                  <div className="text-4xl font-bold text-gray-800 mb-2">{mode.number}</div>
                  <div className="text-sm text-gray-700 font-medium">+ {mode.number}</div>
                  {parseFloat(masteryPercent) >= 90 && (
                    <div className="absolute top-2 right-2">
                      <Star className="text-yellow-500 fill-yellow-500" size={20} />
                    </div>
                  )}
                  {mastery && mastery.totalAttempts > 0 && (
                    <div className="text-xs text-gray-600 mt-2">{masteryPercent}% mastered</div>
                  )}
                  {aiUnlocked && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow">
                      AI Path
                    </div>
                  )}
                  {locked && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-red-300/60 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
export default function AdditionWithinTenApp({ learningPath, onExit }) {
  const defaultPathMeta = {
    id: 'addition-within-10',
    title: 'Addition • 0-9 Sums',
    description: 'Build fluency with single-digit addition using adaptive, story-driven practice.',
    recommendedAges: 'Ages 3-6',
    operation: 'addition',
    operationLabel: 'Addition',
  };
  const operationMeta = (learningPath?.operation && OPERATIONS[learningPath.operation]) || OPERATIONS.addition;
  const activeLearningPath = {
    ...defaultPathMeta,
    ...learningPath,
    operationLabel: learningPath?.operationLabel || operationMeta?.label || defaultPathMeta.operationLabel,
    recommendedAges: learningPath?.recommendedAges || defaultPathMeta.recommendedAges,
  };
  const handleExit = onExit ?? (() => {});

  const [gameState, setGameState] = useState(() => {
    try {
      const lastUser = localStorage.getItem('additionFlashcardsLastUser');
      if (lastUser) {
        const saved = localStorage.getItem(`additionFlashcardsGameState_${lastUser}`);
        if (saved) {
          const parsedState = JSON.parse(saved);
          if (parsedState.studentInfo.name === lastUser) {
            return migrateGameState(parsedState);
          }
        }
      }
      return createDefaultGameState();
    } catch {
      return createDefaultGameState();
    }
  });

  const [gameMode, setGameMode] = useState(null);
  const [focusNumber, setFocusNumber] = useState(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [cards, setCards] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showCountTogether, setShowCountTogether] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [problemStartTime, setProblemStartTime] = useState(null);
  const [guidedHelp, setGuidedHelp] = useState({ active: false, step: 0, complete: false });
  const [aiRuntime, setAiRuntime] = useState({
    aiEnabled: false,
    serverHasKey: false,
    planningModel: null,
    spriteModel: null,
    audioModel: null,
    aiAllowed: true,
  });
  const [aiPlanStatus, setAiPlanStatus] = useState({ loading: false, error: null, source: null });
  const [aiSessionMeta, setAiSessionMeta] = useState(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [interestDraft, setInterestDraft] = useState('');
  const [activeTheme, setActiveTheme] = useState(null);
  const [checkpointState, setCheckpointState] = useState({
    active: false,
    reviewCards: [],
    cardsData: {},
    totalAttempts: 0,
    totalCorrect: 0,
    status: 'idle',
  });
  const inputRef = useRef(null);
  const gameStateRef = useRef(gameState);

  const { studentInfo } = gameState;
  const aiPersonalization = useMemo(
    () => ensurePersonalization(gameState.aiPersonalization, gameState.studentInfo),
    [gameState.aiPersonalization, gameState.studentInfo],
  );
  const aiPreviewItem = useMemo(() => {
    if (aiPersonalization.activeSession?.items && aiPersonalization.activeSession.items.length) {
      const pending = aiPersonalization.activeSession.items.find((item) => {
        if (!aiPersonalization.activeSession?.completed) return true;
        return !aiPersonalization.activeSession.completed.some((c) => c.itemId === item.id);
      });
      if (pending) return pending;
    }
    return aiPersonalization.planQueue?.[0] || null;
  }, [aiPersonalization]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const refreshAiRuntime = useCallback(async () => {
    try {
      const runtime = await getAiRuntime();
      setAiRuntime(runtime);
      return runtime;
    } catch (error) {
      console.warn('Unable to refresh AI runtime state', error);
      const fallback = {
        aiEnabled: false,
        serverHasKey: false,
        planningModel: null,
        spriteModel: null,
        audioModel: null,
        aiAllowed: true,
      };
      setAiRuntime(fallback);
      return fallback;
    }
  }, []);

  useEffect(() => {
    refreshAiRuntime();
  }, [refreshAiRuntime]);

  const refreshInterestMotifs = useCallback(async (interests) => {
    if (!Array.isArray(interests)) return;
    if (interests.length === 0) {
      setGameState((prev) => {
        const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
        if (!ai.learnerProfile.interestMotifs?.length) return prev;
        return {
          ...prev,
          aiPersonalization: {
            ...ai,
            learnerProfile: {
              ...ai.learnerProfile,
              interestMotifs: [],
              motifsUpdatedAt: Date.now(),
            },
          },
        };
      });
      return;
    }
    const shouldRequestRemote = aiRuntime.aiEnabled && aiRuntime.spriteModel;
    if (shouldRequestRemote) {
      try {
        const motifs = await requestInterestMotifs(interests, aiRuntime.spriteModel);
        if (Array.isArray(motifs) && motifs.length) {
          setGameState((prev) => {
            const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
            return {
              ...prev,
              aiPersonalization: {
                ...ai,
                learnerProfile: {
                  ...ai.learnerProfile,
                  interestMotifs: motifs,
                  motifsUpdatedAt: Date.now(),
                },
              },
            };
          });
          return;
        }
      } catch (error) {
        console.warn('Interest motif request failed, using fallback motifs.', error);
      }
    }
    const fallback = deriveMotifsFromInterests(interests);
    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      return {
        ...prev,
        aiPersonalization: {
          ...ai,
          learnerProfile: {
            ...ai.learnerProfile,
            interestMotifs: fallback,
            motifsUpdatedAt: Date.now(),
          },
        },
      };
    });
  }, [aiRuntime.aiEnabled, aiRuntime.spriteModel, setGameState]);

  const ensureAiPlan = useCallback(async (force = false) => {
    const current = gameStateRef.current;
    const ai = ensurePersonalization(current.aiPersonalization, current.studentInfo);
    if (!force && (ai.planQueue?.length || 0) >= 8) {
      return { reused: true, appended: [] };
    }

    setAiPlanStatus((prev) => ({ ...prev, loading: true, error: null, source: aiRuntime.aiEnabled ? aiRuntime.planningModel : 'local planner' }));
    let resolvedSource = aiRuntime.aiEnabled ? aiRuntime.planningModel || 'gemini-planner' : 'local planner';

    const weakFamilies = Object.entries(ai.mastery || {})
      .map(([key, node]) => ({ key, sum: Number(key.replace('sum=', '')), predicted: node?.alpha ? node.alpha / (node.alpha + node.beta) : TARGET_SUCCESS_BAND.midpoint }))
      .sort((a, b) => a.predicted - b.predicted)
      .slice(0, 3)
      .map((entry) => `sum=${entry.sum}`);

    const payload = {
      plan_for: ai.learnerProfile.learnerId || (current.studentInfo?.name || 'learner'),
      target_success: ai.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint,
      weak_families: weakFamilies,
      interest_motifs: ai.learnerProfile.interestMotifs || [],
      need_items: 10,
      learner_name: current.studentInfo?.name || 'Learner',
    };

    if (aiRuntime.aiEnabled && aiRuntime.planningModel) {
      try {
        const remotePlan = await requestGeminiPlan(payload, aiRuntime.planningModel);
        if (remotePlan && Array.isArray(remotePlan.items) && remotePlan.items.length) {
          const planSource = remotePlan.source || remotePlan.items[0]?.source || aiRuntime.planningModel;
          resolvedSource = planSource;
          const normalized = remotePlan.items.map((item, index) => ({
            id: item.itemId || `${remotePlan.planId || 'gemini'}-${Date.now()}-${index}`,
            a: item.a ?? item.operands?.[0] ?? 0,
            b: item.b ?? item.operands?.[1] ?? 0,
            answer: item.answer ?? ((item.a ?? item.operands?.[0] ?? 0) + (item.b ?? item.operands?.[1] ?? 0)),
            display: item.display || `${item.a ?? item.operands?.[0] ?? 0} + ${item.b ?? item.operands?.[1] ?? 0}`,
            predictedSuccess: item.predictedSuccess ?? item.difficulty ?? payload.target_success,
            difficulty: item.difficulty ?? item.predictedSuccess ?? payload.target_success,
            hints: item.hints ?? [],
            praise: item.praise || '',
            microStory: remotePlan.microStory || remotePlan.story || '',
            source: planSource,
            planId: remotePlan.planId || `gemini-${Date.now()}`,
          }));

          setGameState((prev) => {
            const aiPrev = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
            return {
              ...prev,
              aiPersonalization: {
                ...aiPrev,
                planQueue: [...(aiPrev.planQueue || []), ...normalized],
                lastPlan: {
                  id: normalized[0]?.planId,
                  generatedAt: Date.now(),
                  source: normalized[0]?.source,
                  microStory: normalized[0]?.microStory || '',
                  itemCount: normalized.length,
                },
              },
            };
          });

          setAiPlanStatus({ loading: false, error: null, source: planSource });
          return { reused: false, appended: normalized, plan: remotePlan };
        }
      } catch (error) {
        console.warn('Gemini planning failed, falling back to local planner.', error);
        setAiPlanStatus((prev) => ({ ...prev, error: error.message || 'Gemini planning failed.' }));
      }
    }

    resolvedSource = 'local planner';
    const fallbackPlan = generateLocalPlan({
      personalization: ai,
      history: current.statistics?.problemHistory || {},
      timeline: current.statistics?.answersTimeline || [],
      sessionSize: 10,
      now: Date.now(),
    });

    setGameState((prev) => {
      const aiPrev = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      return {
        ...prev,
        aiPersonalization: {
          ...aiPrev,
          planQueue: [...(aiPrev.planQueue || []), ...fallbackPlan.items],
          lastPlan: {
            id: fallbackPlan.planId,
            generatedAt: fallbackPlan.generatedAt,
            source: fallbackPlan.source,
            microStory: fallbackPlan.story || '',
            itemCount: fallbackPlan.items.length,
          },
        },
      };
    });

    setAiPlanStatus({ loading: false, error: null, source: resolvedSource || 'local planner' });
    return { reused: false, appended: fallbackPlan.items, plan: fallbackPlan };
  }, [aiRuntime.aiEnabled, aiRuntime.planningModel, ensurePersonalization, gameStateRef, setAiPlanStatus, setGameState]);

  const handleAddInterest = useCallback(() => {
    const trimmed = interestDraft.trim();
    if (!trimmed) return;
    let updatedList = [];
    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      if (ai.learnerProfile.interests?.some((interest) => interest.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const updated = [...(ai.learnerProfile.interests || []), trimmed].slice(0, 8);
      updatedList = updated;
      return {
        ...prev,
        aiPersonalization: {
          ...ai,
          learnerProfile: {
            ...ai.learnerProfile,
            interests: updated,
          },
        },
      };
    });
    if (updatedList.length) {
      refreshInterestMotifs(updatedList);
    }
    setInterestDraft('');
  }, [interestDraft, refreshInterestMotifs, setGameState]);

  const handleRemoveInterest = useCallback((interest) => {
    let nextInterests = [];
    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      nextInterests = (ai.learnerProfile.interests || []).filter((item) => item !== interest);
      return {
        ...prev,
        aiPersonalization: {
          ...ai,
          learnerProfile: {
            ...ai.learnerProfile,
            interests: nextInterests,
          },
        },
      };
    });
    refreshInterestMotifs(nextInterests);
  }, [refreshInterestMotifs, setGameState]);

  const startAiPath = useCallback(async () => {
    const planResult = await ensureAiPlan(false);
    const targetDeckSize = 8;
    const sessionItems = (() => {
      const ai = ensurePersonalization(gameStateRef.current.aiPersonalization, gameStateRef.current.studentInfo);
      const combined = [...(ai.planQueue || [])];
      if (planResult?.appended?.length) {
        combined.push(...planResult.appended);
      }
      return combined.slice(0, Math.min(targetDeckSize, combined.length));
    })();

    if (!sessionItems.length) {
      alert('We need a bit more data before the AI path can start. Try a few practice rounds first.');
      return;
    }

    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      const remaining = (ai.planQueue || []).slice(sessionItems.length);
      return {
        ...prev,
        aiPersonalization: {
          ...ai,
          planQueue: remaining,
          activeSession: {
            planId: sessionItems[0]?.planId || `session-${Date.now()}`,
            source: sessionItems[0]?.source || 'local-fallback',
            microStory: sessionItems[0]?.microStory || '',
            startedAt: Date.now(),
            items: sessionItems,
            completed: [],
          },
        },
      };
    });

    setAiSessionMeta({
      planId: sessionItems[0]?.planId || null,
      source: sessionItems[0]?.source || (aiRuntime.aiEnabled ? aiRuntime.planningModel || 'cloud-plan' : 'local-fallback'),
      story: sessionItems[0]?.microStory || '',
    });

    setCards(sessionItems.map((item) => ({
      a: item.a,
      b: item.b,
      answer: item.answer,
      aiPlanItem: item,
    })));
    setGameMode('ai-path');
    setCurrentCard(0);
    setUserAnswer('');
    setFeedback(null);
    setShowHint(false);
    setAttemptCount(0);
    setGuidedHelp({ active: false, step: 0, complete: false });
  }, [aiRuntime.aiEnabled, aiRuntime.planningModel, ensureAiPlan]);

  const handleAiSettingsSaved = useCallback(async () => {
    const runtime = await refreshAiRuntime();
    if (runtime.aiEnabled) {
      ensureAiPlan(true);
    }
  }, [ensureAiPlan, refreshAiRuntime]);

  const handleRegister = (userInfo) => {
    const userKey = `additionFlashcardsGameState_${userInfo.name}`;
    const savedState = localStorage.getItem(userKey);

    if (savedState) {
      setGameState(migrateGameState(JSON.parse(savedState)));
    } else {
      const newGameState = createDefaultGameState();
      setGameState({
        ...newGameState,
        studentInfo: {
          ...newGameState.studentInfo,
          ...userInfo,
          startDate: new Date().toISOString(),
        },
      });
    }
  };

  const handleLogout = () => {
    if (window.confirm('Do you want to save your progress before logging out?')) {
      exportGameState();
    }
    setGameState(createDefaultGameState());
    localStorage.removeItem('additionFlashcardsLastUser');
  };

  const generateCards = useCallback(() => {
    const currentState = gameStateRef.current;
    if (gameMode === 'ai-path') {
      return;
    }
    const { reviewCards, remaining } = pickReviewDue(currentState.adaptiveLearning);
    const difficulty = currentState.adaptiveLearning.currentDifficulty || 'medium';

    let newCards = [];

    if (gameMode === 'sequential') {
      for (let a = 0; a <= 9; a++) {
        for (let b = 0; b <= 9; b++) {
          newCards.push({ a, b, answer: a + b });
        }
      }
    } else if (gameMode === 'random') {
      for (let a = 0; a <= 9; a++) {
        for (let b = 0; b <= 9; b++) {
          newCards.push({ a, b, answer: a + b });
        }
      }
      for (let i = newCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
      }
    } else if (gameMode?.startsWith('focus-')) {
      for (let i = 0; i <= 9; i++) {
        newCards.push({ a: focusNumber, b: i, answer: focusNumber + i });
        if (i !== focusNumber) {
          newCards.push({ a: i, b: focusNumber, answer: i + focusNumber });
        }
      }
      for (let i = newCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
      }
    }

    if (difficulty === 'easy') {
      newCards = newCards.filter(c => c.a + c.b <= 8);
    } else if (difficulty === 'hard') {
      newCards.sort((c1, c2) => (c2.a + c2.b) - (c1.a + c1.b));
    }

    const generatedDeck = [...reviewCards, ...newCards];

    setCards(generatedDeck);
    setCurrentCard(0);
    setGuidedHelp({ active: false, step: 0, complete: false });
    setCheckpointState({
      active: false,
      reviewCards: [],
      cardsData: {},
      totalAttempts: 0,
      totalCorrect: 0,
      status: 'idle',
    });
    setGameState((prev) => ({
      ...prev,
      adaptiveLearning: {
        ...prev.adaptiveLearning,
        needsReview: remaining,
      },
      sessionData: {
        ...prev.sessionData,
        currentSession: {
          startTime: Date.now(),
          problemsSolved: 0,
          timeSpent: 0,
          accuracy: 0,
        }
      }
    }));
  }, [gameMode, focusNumber]);


  // Save game state whenever it changes
  useEffect(() => {
    try {
      if (gameState.studentInfo && gameState.studentInfo.name) {
        const userKey = `additionFlashcardsGameState_${gameState.studentInfo.name}`;
        localStorage.setItem(userKey, JSON.stringify(gameState));
        localStorage.setItem('additionFlashcardsLastUser', gameState.studentInfo.name);
      }
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameMode) {
      generateCards();
    }
  }, [gameMode, generateCards]);

  useEffect(() => {
    const interests = aiPersonalization.learnerProfile?.interests || [];
    const lastUpdated = aiPersonalization.learnerProfile?.motifsUpdatedAt;
    if (!interests.length) {
      return;
    }
    if (!lastUpdated) {
      refreshInterestMotifs(interests);
      return;
    }
    const ageMs = Date.now() - lastUpdated;
    if (ageMs > 1000 * 60 * 60 * 24 * 7) {
      refreshInterestMotifs(interests);
    }
  }, [aiPersonalization.learnerProfile?.interests, aiPersonalization.learnerProfile?.motifsUpdatedAt, refreshInterestMotifs]);

  useEffect(() => {
    if (gameMode === 'ai-path') return;
    if (aiPlanStatus.loading) return;
    const queueLength = aiPersonalization.planQueue?.length || 0;
    if (queueLength < 4 && (aiPersonalization.learnerProfile?.interests?.length || queueLength === 0)) {
      ensureAiPlan(false);
    }
  }, [aiPlanStatus.loading, aiPersonalization.planQueue, aiPersonalization.learnerProfile?.interests?.length, ensureAiPlan, gameMode]);

  // Start session timer when card changes
  useEffect(() => {
    if (cards.length > 0) {
      setProblemStartTime(Date.now());
      setAttemptCount(0);
      setShowHint(false);
      setGuidedHelp({ active: false, step: 0, complete: false });
      // Focus the input when card changes
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentCard, cards]);

  // simple adaptive step: if 2 incorrect attempts for current card, enable hint automatically
  useEffect(() => {
    if (attemptCount >= 2 && feedback === 'incorrect') {
      setShowHint(true);
    }
  }, [attemptCount, feedback]);

  // activate guided help after 30 seconds without response submission
  useEffect(() => {
    if (!cards[currentCard] || !problemStartTime) return;
    if (attemptCount > 0 || feedback === 'correct') return;

    const timer = setTimeout(() => {
      setShowHint(true);
      setGuidedHelp({ active: true, step: 0, complete: false });
    }, 30000);

    return () => clearTimeout(timer);
  }, [cards, currentCard, problemStartTime, attemptCount, feedback]);

  // drive the guided counting animation once it is active
  useEffect(() => {
    if (!guidedHelp.active || guidedHelp.complete || showCountTogether) return;
    const card = cards[currentCard];
    if (!card) return;
    const total = card.a + card.b;
    if (total <= 0) return;

    const interval = setInterval(() => {
      setGuidedHelp(prev => {
        if (!prev.active) return prev;
        const nextStep = Math.min(prev.step + 1, total);
        return {
          active: true,
          step: nextStep,
          complete: nextStep >= total,
        };
      });
    }, 700);

    return () => clearInterval(interval);
  }, [guidedHelp.active, guidedHelp.complete, cards, currentCard]);

  // respond to checkpoint review pass/fail outcomes
  useEffect(() => {
    if (checkpointState.status === 'passed') {
      setGameState(prev => ({
        ...prev,
        adaptiveLearning: {
          ...prev.adaptiveLearning,
          checkpoint: { pending: false, inProgress: false },
        },
      }));
      setCards(prevCards => prevCards.slice(checkpointState.reviewCards.length));
      setCurrentCard(0);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setAttemptCount(0);
      setGuidedHelp({ active: false, step: 0, complete: false });
      setCheckpointState({
        active: false,
        reviewCards: [],
        cardsData: {},
        totalAttempts: 0,
        totalCorrect: 0,
        status: 'idle',
      });
    } else if (checkpointState.status === 'failed') {
      const repeatCards = checkpointState.reviewCards.filter(card => {
        const entry = checkpointState.cardsData[`${card.a}+${card.b}`];
        if (!entry) return true;
        const accuracy = entry.attempts > 0 ? entry.correct / entry.attempts : 0;
        return accuracy < 0.8;
      });
      const fallback = repeatCards.length > 0 ? repeatCards : checkpointState.reviewCards;
      setCards(prevCards => [...fallback, ...prevCards.slice(checkpointState.reviewCards.length)]);
      setCurrentCard(0);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setAttemptCount(0);
      setGuidedHelp({ active: false, step: 0, complete: false });
      setCheckpointState({
        active: true,
        reviewCards: fallback,
        cardsData: {},
        totalAttempts: 0,
        totalCorrect: 0,
        status: 'active',
      });
    }
  }, [checkpointState.status, checkpointState.reviewCards, checkpointState.cardsData, cards]);

  const updateMasteryTracking = (number, correct) => {
    setGameState(prev => {
      const masteryTracking = { ...prev.masteryTracking };
      const mastery = { ...masteryTracking[number] };

      mastery.totalAttempts++;
      if (correct) mastery.correctAttempts++;
      mastery.lastPracticed = Date.now();

      const accuracy = mastery.totalAttempts > 0
        ? (mastery.correctAttempts / mastery.totalAttempts * 100)
        : 0;

      if (accuracy >= 90 && mastery.totalAttempts >= 3) mastery.level = 'mastered';
      else if (accuracy >= 70 && mastery.totalAttempts >= 2) mastery.level = 'proficient';
      else if (mastery.totalAttempts >= 3 && accuracy < 60) mastery.level = 'struggling';
      else mastery.level = 'learning';

      masteryTracking[number] = mastery;

      return {
        ...prev,
        masteryTracking,
      };
    });
  };

  const recordProblemAttempt = (card, correct, timeSpent) => {
    const problemKey = `${card.a}+${card.b}`;
    const timeSec = timeSpent / 1000;
    const attemptTimestamp = Date.now();

    setGameState(prev => {
      const statistics = {
        ...prev.statistics,
        problemHistory: { ...prev.statistics.problemHistory },
        strugglingProblems: [...(prev.statistics.strugglingProblems || [])],
        answersTimeline: [...(prev.statistics.answersTimeline || [])],
        dailyTotals: { ...prev.statistics.dailyTotals },
      };
      const sessionData = {
        ...prev.sessionData,
        currentSession: {
          ...prev.sessionData.currentSession,
        },
      };
      const adaptiveLearning = {
        ...prev.adaptiveLearning,
        needsReview: [...(prev.adaptiveLearning.needsReview || [])],
        recentAttempts: [...(prev.adaptiveLearning.recentAttempts || [])],
        checkpoint: { ...prev.adaptiveLearning.checkpoint },
      };
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);

      if (!statistics.problemHistory[problemKey]) {
        statistics.problemHistory[problemKey] = {
          attempts: 0,
          correct: 0,
          totalTime: 0,
          lastAttempt: null,
          timestamp: Date.now(),
        };
      } else {
        statistics.problemHistory[problemKey] = { ...statistics.problemHistory[problemKey] };
      }

      const problem = statistics.problemHistory[problemKey];
      problem.attempts++;
      if (correct) problem.correct++;
      problem.totalTime += timeSpent;
      problem.lastAttempt = Date.now();

      if (problem.attempts >= 2 && (problem.correct / problem.attempts) < 0.6) {
        const existingIndex = statistics.strugglingProblems.findIndex(p => p.a === card.a && p.b === card.b);
        if (existingIndex === -1) {
          statistics.strugglingProblems.push({ a: card.a, b: card.b, attempts: problem.attempts });
        } else {
          statistics.strugglingProblems[existingIndex] = {
            ...statistics.strugglingProblems[existingIndex],
            attempts: problem.attempts,
          };
        }
      }
      if (statistics.strugglingProblems.length) {
        statistics.strugglingProblems.sort((a, b) => b.attempts - a.attempts);
      }

      statistics.totalProblemsAttempted++;
      if (correct) statistics.totalCorrect++;
      statistics.totalTimeSpent += timeSec;
      statistics.averageTimePerProblem =
        statistics.totalTimeSpent / statistics.totalProblemsAttempted;

      statistics.answersTimeline.push({ ts: Date.now(), a: card.a, b: card.b, correct, timeSec, userAnswer });
      const dk = dayKey();
      const existingDaily = statistics.dailyTotals[dk] ? { ...statistics.dailyTotals[dk] } : { attempts: 0, correct: 0, seconds: 0 };
      existingDaily.attempts += 1;
      existingDaily.seconds += timeSec;
      if (correct) existingDaily.correct += 1;
      statistics.dailyTotals[dk] = existingDaily;

      const validProblems = Object.values(statistics.problemHistory).filter(p => {
        const avgTime = (p.totalTime / p.attempts) / 1000;
        return avgTime >= 3 && avgTime <= 120;
      }).length;
      let waste = statistics.totalProblemsAttempted > 0
        ? ((statistics.totalProblemsAttempted - validProblems) / statistics.totalProblemsAttempted * 100)
        : 0;

      const last5 = statistics.answersTimeline.slice(-5);
      if (last5.length === 5) {
        const nums = last5.map(e => (e.userAnswer != null ? Number(e.userAnswer) : null));
        const times = last5.map(e => e.timeSec || 0);
        const strictlyIncreasingBy1 = nums.every((n, i) => i === 0 || (n != null && nums[i - 1] != null && n - nums[i - 1] === 1));
        const fastAvg = (times.reduce((s, t) => s + t, 0) / 5) < 3;
        if (strictlyIncreasingBy1 && fastAvg) {
          waste = Math.min(100, waste + 10);
        }
      }
      statistics.wastePercentage = waste;

      sessionData.currentSession = {
        ...sessionData.currentSession,
        problemsSolved: (sessionData.currentSession?.problemsSolved || 0) + 1,
        timeSpent: (sessionData.currentSession?.timeSpent || 0) + timeSec,
        accuracy: (statistics.totalCorrect / statistics.totalProblemsAttempted * 100) || 0,
      };

      if (correct) adaptiveLearning.consecutiveCorrect++;
      else {
        adaptiveLearning.consecutiveCorrect = 0;
        adaptiveLearning.strugglesDetected++;
      }

      adaptiveLearning.recentAttempts.push({ correct, ms: timeSpent });
      if (adaptiveLearning.recentAttempts.length > 10) adaptiveLearning.recentAttempts.shift();

      const r5 = adaptiveLearning.recentAttempts.slice(-5);
      const incorrect5 = r5.filter(r => !r.correct).length;
      const r4 = adaptiveLearning.recentAttempts.slice(-4);
      const avg4 = r4.reduce((s, r) => s + r.ms, 0) / Math.max(r4.length, 1);
      if (adaptiveLearning.consecutiveCorrect >= 4 && avg4 <= 15000) {
        adaptiveLearning.currentDifficulty = 'hard';
      } else if (incorrect5 >= 3) {
        adaptiveLearning.currentDifficulty = 'easy';
      } else {
        adaptiveLearning.currentDifficulty = 'medium';
      }

      if (!correct) {
        adaptiveLearning.needsReview = scheduleReview(adaptiveLearning.needsReview, card.a, card.b);
      } else {
        const acc = problem.correct / problem.attempts;
        adaptiveLearning.needsReview = adaptiveLearning.needsReview.filter(p => p.key !== problemKey || acc < 0.8);
      }

      const solved = sessionData.currentSession.problemsSolved;
      if (solved > 0 && solved % 10 === 0) {
        adaptiveLearning.checkpoint = {
          ...adaptiveLearning.checkpoint,
          pending: true,
        };
      }

      const updatedAi = updatePersonalizationAfterAttempt(ai, {
        a: card.a,
        b: card.b,
        correct,
        latencyMs: timeSpent,
        timestamp: attemptTimestamp,
        itemId: problemKey,
        planItemId: card.aiPlanItem?.id,
        source: card.aiPlanItem?.source,
      });

      return {
        ...prev,
        statistics,
        sessionData,
        adaptiveLearning,
        aiPersonalization: updatedAi,
      };
    });

    setCheckpointState(prevState => {
      if (!prevState.active || !card.review) return prevState;
      const key = `${card.a}+${card.b}`;
      const current = prevState.cardsData[key] || { attempts: 0, correct: 0 };
      const updatedEntry = {
        attempts: current.attempts + 1,
        correct: current.correct + (correct ? 1 : 0),
      };
      const cardsData = {
        ...prevState.cardsData,
        [key]: updatedEntry,
      };

      const totals = Object.values(cardsData).reduce(
        (acc, entry) => ({
          attempts: acc.attempts + entry.attempts,
          correct: acc.correct + entry.correct,
        }),
        { attempts: 0, correct: 0 }
      );

      const haveAllCards = Object.keys(cardsData).length === prevState.reviewCards.length;
      const allClearedOnce = haveAllCards && Object.values(cardsData).every(entry => entry.correct > 0);
      let status = prevState.status;
      if (haveAllCards && allClearedOnce) {
        const accuracy = totals.attempts > 0 ? totals.correct / totals.attempts : 0;
        status = accuracy >= 0.8 ? 'passed' : 'failed';
      }

      return {
        ...prevState,
        cardsData,
        totalAttempts: totals.attempts,
        totalCorrect: totals.correct,
        status,
      };
    });

    updateMasteryTracking(card.a, correct);
    updateMasteryTracking(card.b, correct);
  };

  const handleModeSelect = (mode, number = null) => {
    const interests = gameStateRef.current?.aiPersonalization?.learnerProfile?.interests || [];
    const motifs = gameStateRef.current?.aiPersonalization?.learnerProfile?.interestMotifs || [];
    if (mode !== 'ai-path') {
      const themePacks = buildThemePacksForInterests(interests, { motifHints: motifs });
      const theme = resolveMotifTheme({ themePacks });
      setActiveTheme(theme);
    } else {
      setActiveTheme(null);
    }
    setGameMode(mode);
    setFocusNumber(number);
  };

  const resetToMenu = () => {
    setGameMode(null);
    setFocusNumber(null);
    setUserAnswer('');
    setFeedback(null);
    setShowCelebration(false);
    setCards([]);
    setGuidedHelp({ active: false, step: 0, complete: false });
    setProblemStartTime(null);
    setAiSessionMeta(null);
    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      if (!ai.activeSession) return prev;
      return {
        ...prev,
        aiPersonalization: {
          ...ai,
          activeSession: null,
        },
      };
    });
    setCheckpointState({
      active: false,
      reviewCards: [],
      cardsData: {},
      totalAttempts: 0,
      totalCorrect: 0,
      status: 'idle',
    });
  };

  const exportGameState = () => {
    const dataStr = JSON.stringify(gameState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `addition-flashcards-progress-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const importGameState = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.version && data.studentInfo && data.statistics && data.masteryTracking) {
            setGameState(migrateGameState(data));
            alert('Progress imported successfully!');
          } else {
            alert('Invalid game state format!');
          }
        } catch (error) {
          alert('Error importing progress!');
        }
      };
      reader.readAsText(file);
    }
  };

  const checkAnswer = () => {
    if (!cards[currentCard]) return;

    const timeSpent = problemStartTime ? Date.now() - problemStartTime : 0;
    const correct = parseInt(userAnswer, 10) === cards[currentCard].answer;

    setFeedback(correct ? 'correct' : 'incorrect');
    setAttemptCount(prev => prev + 1);

    recordProblemAttempt(cards[currentCard], correct, timeSpent);

    if (correct) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1200);
      setGuidedHelp({ active: false, step: 0, complete: false });
      setTimeout(() => {
        if (currentCard < cards.length - 1) {
          nextCard();
        } else {
          resetToMenu();
        }
      }, 1200);
    }
  };

  const nextCard = () => {
    let injectedReviewCards = null;

    setGameState(prev => {
      const adaptiveLearning = {
        ...prev.adaptiveLearning,
        checkpoint: { ...prev.adaptiveLearning.checkpoint },
      };

      if (adaptiveLearning.checkpoint.pending && !adaptiveLearning.checkpoint.inProgress) {
        const candidates = Object.entries(prev.statistics.problemHistory)
          .map(([key, v]) => ({ key, a: Number(key.split('+')[0]), b: Number(key.split('+')[1]), acc: v.correct / v.attempts }))
          .sort((a, b) => (a.acc ?? 0) - (b.acc ?? 0))
          .slice(0, 5)
          .map(p => ({ a: p.a, b: p.b, answer: p.a + p.b, review: true }));
        if (candidates.length) {
          injectedReviewCards = candidates;
        }
        adaptiveLearning.checkpoint.inProgress = true;
        adaptiveLearning.checkpoint.pending = false;
      }

      return {
        ...prev,
        adaptiveLearning,
      };
    });

    if (injectedReviewCards) {
      setCheckpointState({
        active: true,
        reviewCards: injectedReviewCards,
        cardsData: {},
        totalAttempts: 0,
        totalCorrect: 0,
        status: 'active',
      });
      setCards(prevCards => [...injectedReviewCards, ...prevCards]);
      setCurrentCard(0);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setAttemptCount(0);
      setGuidedHelp({ active: false, step: 0, complete: false });
      return;
    }

    if (currentCard < cards.length - 1) {
      setCurrentCard(prev => prev + 1);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setAttemptCount(0);
      setGuidedHelp({ active: false, step: 0, complete: false });
    }
  };

  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prev => prev - 1);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setAttemptCount(0);
      setGuidedHelp({ active: false, step: 0, complete: false });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && userAnswer && feedback !== 'correct' && cards[currentCard]) {
      checkAnswer();
    }
  };

  const checkpointActive = checkpointState.active && checkpointState.reviewCards.length > 0;
  const checkpointAccuracy = checkpointState.totalAttempts > 0
    ? Math.round((checkpointState.totalCorrect / checkpointState.totalAttempts) * 100)
    : 0;
  const checkpointCleared = Object.values(checkpointState.cardsData || {}).filter(entry => entry.correct > 0).length;

  if (!studentInfo || !studentInfo.name || !studentInfo.gender) {
    return <Register onRegister={handleRegister} onImport={importGameState} />;
  }

  if (showDashboard) {
    return <ParentDashboard gameState={gameState} aiRuntime={aiRuntime} onClose={() => setShowDashboard(false)} />;
  }

  if (!gameMode) {
    return (
      <>
        <ModeSelection
          learningPath={activeLearningPath}
          onExit={handleExit}
          onSelectMode={handleModeSelect}
          gameState={gameState}
          onShowDashboard={() => setShowDashboard(true)}
          onExport={exportGameState}
          onImport={importGameState}
          onLogout={handleLogout}
          onOpenAiSettings={() => setShowAiSettings(true)}
          aiPersonalization={aiPersonalization}
          aiPreviewItem={aiPreviewItem}
          aiPlanStatus={aiPlanStatus}
          interestDraft={interestDraft}
          onInterestDraftChange={setInterestDraft}
          onAddInterest={handleAddInterest}
          onRemoveInterest={handleRemoveInterest}
          onStartAiPath={startAiPath}
          onRefreshPlan={() => ensureAiPlan(true)}
          aiRuntime={aiRuntime}
        />
        {showAiSettings && (
          <ParentAISettings
            onClose={() => setShowAiSettings(false)}
            onSaved={handleAiSettingsSaved}
          />
        )}
      </>
    );
  }

  const card = cards[currentCard];

  if (!card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl shadow-xl p-10 max-w-md">
          <div className="text-3xl font-bold text-gray-800 mb-2">All caught up! 🎉</div>
            <p className="text-gray-600 mb-6">You&apos;ve cleared every checkpoint card. Choose the next adventure or replay this mode.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetToMenu}
              className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Back to Mode Select
            </button>
            <button
              onClick={generateCards}
              className="px-5 py-3 rounded-xl bg-white border-2 border-blue-300 text-blue-700 font-semibold hover:bg-blue-50 transition"
            >
              Practice Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStats = gameState.statistics;
  const sessionCorrect = currentStats.totalCorrect;
  const sessionTotal = currentStats.totalProblemsAttempted;

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-xl shadow hover:shadow-lg transition"
          >
            <ArrowLeft size={18} />
            <span>Learning Paths</span>
          </button>
          <div className="bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm text-gray-700 flex flex-col sm:items-end gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{activeLearningPath.operationLabel || 'Operation'}</span>
            <span className="text-base font-semibold text-gray-800">{activeLearningPath.title}</span>
            {activeLearningPath.recommendedAges && (
              <span className="text-xs text-gray-500">{activeLearningPath.recommendedAges}</span>
            )}
          </div>
        </div>
      </div>
      {/* Header */}
      <div className="w-full max-w-2xl mb-6 flex justify-between items-center">
        <button
          onClick={resetToMenu}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <Hash size={18} />
          <span>Menu</span>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <BarChart3 size={18} className="text-blue-600" />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
            <Trophy className="text-yellow-500" />
            <span className="text-lg font-bold">{sessionCorrect} / {sessionTotal}</span>
          </div>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="mb-2 flex items-center gap-2">
        <div className="px-4 py-2 bg-white rounded-full shadow text-sm font-medium text-gray-700">
          {gameMode === 'sequential' && '📋 All Numbers (Sequential)'}
          {gameMode === 'random' && '🎲 Random Practice'}
          {gameMode?.startsWith('focus-') && `🎯 Practice with ${focusNumber}`}
          {gameMode === 'ai-path' && '🤖 AI Path Session'}
        </div>
        <div className="px-3 py-1 bg-white rounded-full shadow text-xs font-semibold text-gray-700">
          Difficulty: <span className={{ easy: 'text-green-600', medium: 'text-orange-600', hard: 'text-red-600' }[gameState.adaptiveLearning.currentDifficulty] || 'text-gray-600'}>{gameState.adaptiveLearning.currentDifficulty}</span>
        </div>
      </div>

      {/* Flashcard */}
      <div
        key={activeTheme ? activeTheme.key : 'default'}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 mb-6"
        style={
          activeTheme && activeTheme.swatches[0]
            ? {
                backgroundColor: activeTheme.swatches[0].bg,
                borderColor: activeTheme.swatches[0].border,
                boxShadow: activeTheme.swatches[0].shadow,
              }
            : {}
        }
      >
        {/* Decorative stars */}
        <Star className="absolute top-4 left-4 text-yellow-400 fill-yellow-400" size={20} />
        <Star className="absolute top-4 right-4 text-pink-400 fill-pink-400" size={20} />
        <Star className="absolute bottom-4 left-4 text-blue-400 fill-blue-400" size={20} />
        <Star className="absolute bottom-4 right-4 text-purple-400 fill-purple-400" size={20} />

        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-3xl z-10 animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-3xl font-bold text-green-600">Awesome!</div>
            </div>
          </div>
        )}

        {gameMode === 'ai-path' && aiSessionMeta?.story && (
          <div className="mb-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl text-indigo-700 text-sm">
            {aiSessionMeta.story}
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-700 mb-6 flex items-center justify-between">
          <span>Add the numbers:</span>
          {card.review && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-1">REVIEW</span>}
        </h2>

        {card.aiPlanItem && (
          <div className="mb-4 text-sm text-indigo-600 font-medium flex items-center gap-2">
            <Brain size={16} className="text-indigo-500" />
            Predicted success ~{Math.round((card.aiPlanItem.predictedSuccess ?? aiPersonalization.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint) * 100)}%
          </div>
        )}

        {checkpointActive && (
          <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl text-center text-purple-800">
            <div className="font-semibold text-sm">Checkpoint review in progress</div>
            <div className="text-xs mt-1">Aim for at least 80% accuracy to continue. Accuracy: {checkpointAccuracy}%</div>
            <div className="mt-2 text-xs text-purple-600">
              {checkpointState.totalAttempts} attempts · {checkpointCleared}/{checkpointState.reviewCards.length} cards cleared
            </div>
          </div>
        )}

        {/* Hint System */}
        {showHint && !feedback && (
          <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
            {card.aiPlanItem?.hints?.length ? (
              <div className="text-yellow-800 text-sm space-y-2">
                {card.aiPlanItem.hints.slice(0, 2).map((hint, index) => (
                  <p key={index} className="font-medium flex items-start gap-2">
                    <span className="font-bold">💡 Hint {index + 1}:</span>
                    <span>{hint}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-yellow-800 font-medium text-center">
                💡 Hint: Count all the objects below or use the number line to jump from {card.a} by {card.b}.
              </p>
            )}
          </div>
        )}

        {/* Equation and objects */}
        <div className="flex items-center justify-center gap-6 mb-6">
          {/* First operand */}
          <div className="flex flex-col items-center">
            <div className="text-6xl font-mono font-bold text-gray-900 mb-2">{card.a}</div>
            <CountableObjects digit={card.a} type={card.a} theme={activeTheme} />
          </div>

          {/* Plus sign */}
          <div className="text-6xl font-mono font-bold text-gray-900">+</div>

          {/* Second operand */}
          <div className="flex flex-col items-center">
            <div className="text-6xl font-mono font-bold text-gray-900 mb-2">{card.b}</div>
            <CountableObjects digit={card.b} type={card.b} theme={activeTheme} />
          </div>

          {/* Equals sign */}
          <div className="text-6xl font-mono font-bold text-gray-900">=</div>

          {/* Answer box */}
          <div className="flex flex-col items-center">
            <input
              type="number"
              ref={inputRef}
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                if (feedback) setFeedback(null);
              }}
              onKeyPress={handleKeyPress}
              min="0"
              max="18"
              className={`w-24 h-24 text-5xl font-mono font-bold text-center border-4 rounded-2xl focus:outline-none focus:ring-4 ${
                feedback === 'correct'
                  ? 'border-green-500 bg-green-50 focus:ring-green-300'
                  : feedback === 'incorrect'
                  ? 'border-red-500 bg-red-50 focus:ring-red-300'
                  : 'border-gray-400 bg-white focus:ring-blue-300'
              }`}
              aria-label="Your answer"
            />
            {feedback === 'correct' && (
              <div className="mt-2 text-green-600 font-semibold flex items-center gap-1"><Check size={18}/> Correct!</div>
            )}
            {feedback === 'incorrect' && (
              <div className="mt-2 text-red-600 font-semibold flex items-center gap-1"><X size={18}/> Try again</div>
            )}
          </div>
        </div>

        {/* Number line hint */}
        {(showHint || feedback === 'incorrect') && (
          <NumberLine a={card.a} b={card.b} showHint={true} />
        )}

        {guidedHelp.active && (
          <GuidedCountingAnimation card={card} step={guidedHelp.step} complete={guidedHelp.complete} />
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button
            onClick={checkAnswer}
            disabled={!userAnswer || feedback === 'correct'}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${
              !userAnswer || feedback === 'correct' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Check size={18} />
            Check
          </button>

          <button
            onClick={() => {
              setUserAnswer('');
              setFeedback(null);
              setShowHint(false);
              setAttemptCount(0);
              setGuidedHelp({ active: false, step: 0, complete: false });
              setProblemStartTime(Date.now());
              inputRef.current?.focus();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow bg-white border hover:bg-gray-50"
          >
            <RotateCcw size={18} />
            Reset
          </button>

          <button
            onClick={prevCard}
            disabled={currentCard === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${currentCard === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
          >
            ‹ Prev
          </button>

          <button
            onClick={nextCard}
            disabled={currentCard >= cards.length - 1}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${currentCard >= cards.length - 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
          >
            Next ›
          </button>

          <button
            onClick={() => {
              setShowHint((s) => !s);
              setShowCountTogether((s) => !s);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${showHint ? 'bg-yellow-100 border-yellow-300' : 'bg-white border hover:bg-gray-50'}`}
          >
            💡 Hint
          </button>
          {showCountTogether && (
            <button
              onClick={() => {
                setGuidedHelp({ active: true, step: 0, complete: false });
                setShowCountTogether(false);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow bg-blue-600 text-white hover:bg-blue-700"
            >
              Count Together
            </button>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="text-sm text-gray-700 bg-white rounded-full px-4 py-2 shadow">
        Card {currentCard + 1} / {cards.length}
      </div>
    </div>
    {showAiSettings && (
      <ParentAISettings
        onClose={() => setShowAiSettings(false)}
        onSaved={handleAiSettingsSaved}
      />
    )}
    </>
  );
}
