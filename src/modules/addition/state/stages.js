import { TARGET_SUCCESS_BAND } from '../../../lib/aiPersonalization';

export const MASTERED_REQUIRED_ATTEMPTS = 3;
export const PERFECT_SAMPLE_ATTEMPTS = 2;
export const HIGH_ACCURACY_RUN_THRESHOLD = 0.85;
export const HIGH_ACCURACY_RUN_PERCENT = Math.round(HIGH_ACCURACY_RUN_THRESHOLD * 100);

export const ADDITION_STAGE_SEQUENCE = [
  {
    id: 'add-up-to-3',
    label: 'Adunări cu numere 0-3',
    shortLabel: 'Stăpânire 0-3',
    description: 'Familiarizează-te cu sumele mici folosind termeni cuprinși între 0 și 3.',
    maxAddend: 3,
    minAddend: 0,
    masteryThreshold: 0.9,
    requiredPerfectRuns: 3,
    badge: {
      name: 'Inițiat Aurora',
      description: 'Aprinde inelul nebuloasei cu aventuri curajoase de +3.',
      gradient: 'from-amber-300 via-rose-400 to-fuchsia-500',
      accent: 'text-rose-900',
      icon: 'Sparkles',
      cardGradient: 'from-rose-50 via-amber-50/70 to-purple-50',
      haloGradient: 'from-amber-200/90 via-rose-300/60 to-purple-300/70',
      coreGradient: 'from-amber-400 via-rose-500 to-purple-600',
      innerGlowGradient: 'from-white/85 via-rose-200/50 to-transparent',
      frameColor: 'border-amber-100/80',
      pattern:
        'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%), radial-gradient(circle at 80% 35%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)',
      ribbonGradient: 'from-amber-400 via-rose-500 to-purple-600',
      sparkleGradientEarned: 'linear-gradient(135deg, #fde68a 0%, #f472b6 45%, #7c3aed 100%)',
      sparkleGradientLocked: 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.2) 100%)',
      sparkleShadow: 'rgba(244,114,182,0.45)',
      sparklePalette: ['rgba(251,191,36,0.6)', 'rgba(244,114,182,0.55)', 'rgba(167,139,250,0.5)'],
      progressGradient: 'from-amber-400 via-rose-500 to-purple-600',
      runProgressGradient: 'from-emerald-400 via-emerald-500 to-teal-400',
      beamGradient: 'from-amber-200/80 via-rose-200/50 to-transparent',
      iconColor: 'text-white',
      iconBackdrop: 'bg-white/20',
      iconRing: 'ring-2 ring-rose-100/70',
      iconShadow: 'drop-shadow-[0_6px_12px_rgba(225,29,72,0.45)]',
      cardBorder: 'border-rose-200/70',
      shadow: 'shadow-[0_24px_50px_rgba(244,114,182,0.25)]',
    },
  },
  {
    id: 'add-up-to-5',
    label: 'Adunări cu numere 0-5',
    shortLabel: 'Stăpânire 0-5',
    description: 'Construiește încredere în sumele până la 10 adunând numere cuprinse între 0 și 5.',
    maxAddend: 5,
    minAddend: 0,
    masteryThreshold: 0.9,
    prerequisites: ['add-up-to-3'],
    requiredPerfectRuns: 3,
    badge: {
      name: 'Navigatorul Nebuloasei',
      description: 'Trasează căi strălucitoare prin fiecare combinație de +5.',
      gradient: 'from-sky-300 via-indigo-500 to-purple-700',
      accent: 'text-indigo-900',
      icon: 'Rocket',
      cardGradient: 'from-sky-50 via-indigo-50/80 to-purple-50',
      haloGradient: 'from-sky-200/80 via-indigo-300/50 to-purple-400/60',
      coreGradient: 'from-sky-400 via-indigo-500 to-purple-600',
      innerGlowGradient: 'from-white/80 via-sky-200/50 to-transparent',
      frameColor: 'border-sky-100/80',
      pattern:
        'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.75), rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)',
      ribbonGradient: 'from-sky-400 via-indigo-500 to-purple-700',
      sparkleGradientEarned: 'linear-gradient(135deg, #bae6fd 0%, #60a5fa 40%, #a855f7 100%)',
      sparkleGradientLocked: 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(209,213,219,0.35) 100%)',
      sparkleShadow: 'rgba(96,165,250,0.4)',
      sparklePalette: ['rgba(125,211,252,0.55)', 'rgba(99,102,241,0.5)', 'rgba(129,140,248,0.45)'],
      progressGradient: 'from-sky-400 via-indigo-500 to-purple-600',
      runProgressGradient: 'from-cyan-400 via-sky-400 to-emerald-400',
      beamGradient: 'from-sky-200/80 via-indigo-200/50 to-transparent',
      iconColor: 'text-white',
      iconBackdrop: 'bg-white/25',
      iconRing: 'ring-2 ring-sky-100/70',
      iconShadow: 'drop-shadow-[0_6px_12px_rgba(30,64,175,0.5)]',
      cardBorder: 'border-sky-200/70',
      shadow: 'shadow-[0_24px_50px_rgba(79,70,229,0.28)]',
    },
  },
  {
    id: 'add-up-to-7',
    label: 'Adunări cu numere 0-7',
    shortLabel: 'Stăpânire 0-7',
    description: 'Stăpânește strategii de completare și descompunere pentru sume până la 7.',
    maxAddend: 7,
    minAddend: 0,
    masteryThreshold: 0.9,
    prerequisites: ['add-up-to-5'],
    requiredPerfectRuns: 3,
    badge: {
      name: 'Cartograful Constelațiilor',
      description: 'Desenează hărți strălucitoare pentru fiecare combinație de +7.',
      gradient: 'from-emerald-300 via-teal-400 to-cyan-500',
      accent: 'text-emerald-900',
      icon: 'Award',
      cardGradient: 'from-emerald-50 via-teal-50/80 to-cyan-50',
      haloGradient: 'from-emerald-200/80 via-teal-200/50 to-cyan-300/60',
      coreGradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      innerGlowGradient: 'from-white/80 via-emerald-200/50 to-transparent',
      frameColor: 'border-emerald-100/80',
      pattern:
        'radial-gradient(circle at 22% 20%, rgba(255,255,255,0.8), rgba(255,255,255,0) 55%), radial-gradient(circle at 78% 32%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)',
      ribbonGradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      sparkleGradientEarned: 'linear-gradient(135deg, #bbf7d0 0%, #34d399 40%, #22d3ee 100%)',
      sparkleGradientLocked: 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(191,219,254,0.35) 100%)',
      sparkleShadow: 'rgba(52,211,153,0.35)',
      sparklePalette: ['rgba(110,231,183,0.55)', 'rgba(52,211,153,0.5)', 'rgba(45,212,191,0.45)'],
      progressGradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      runProgressGradient: 'from-lime-400 via-emerald-400 to-teal-400',
      beamGradient: 'from-emerald-200/80 via-teal-200/50 to-transparent',
      iconColor: 'text-white',
      iconBackdrop: 'bg-white/20',
      iconRing: 'ring-2 ring-emerald-100/70',
      iconShadow: 'drop-shadow-[0_6px_12px_rgba(16,185,129,0.45)]',
      cardBorder: 'border-emerald-200/70',
      shadow: 'shadow-[0_24px_50px_rgba(16,185,129,0.22)]',
    },
  },
  {
    id: 'add-up-to-9',
    label: 'Adunări cu numere 0-9',
    shortLabel: 'Stăpânire 0-9',
    description: 'Finalizează traseul până la 10 consolidând toate combinațiile cu numere între 0 și 9.',
    maxAddend: 9,
    minAddend: 0,
    masteryThreshold: 0.9,
    prerequisites: ['add-up-to-7'],
    requiredPerfectRuns: 3,
    badge: {
      name: 'Laureatul Celest',
      description: 'Încoronează fiecare faptă până la 10 cu automatism strălucitor.',
      gradient: 'from-fuchsia-400 via-purple-500 to-violet-700',
      accent: 'text-violet-900',
      icon: 'Gem',
      cardGradient: 'from-violet-50 via-fuchsia-50/80 to-indigo-50',
      haloGradient: 'from-fuchsia-200/80 via-purple-300/60 to-indigo-400/70',
      coreGradient: 'from-fuchsia-400 via-purple-500 to-violet-600',
      innerGlowGradient: 'from-white/85 via-fuchsia-200/50 to-transparent',
      frameColor: 'border-fuchsia-100/80',
      pattern:
        'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.8), rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 35%,rgba(255,255,255,0.4), rgba(255,255,255,0) 60%)',
      ribbonGradient: 'from-fuchsia-500 via-purple-600 to-violet-700',
      sparkleGradientEarned: 'linear-gradient(135deg, #f5d0fe 0%, #f472b6 35%, #6366f1 100%)',
      sparkleGradientLocked: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(214,188,250,0.35) 100%)',
      sparkleShadow: 'rgba(192,132,252,0.45)',
      sparklePalette: ['rgba(251,207,232,0.6)', 'rgba(196,181,253,0.55)', 'rgba(244,114,182,0.55)'],
      progressGradient: 'from-fuchsia-400 via-purple-500 to-indigo-600',
      runProgressGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      beamGradient: 'from-fuchsia-200/80 via-purple-200/50 to-transparent',
      iconColor: 'text-white',
      iconBackdrop: 'bg-white/25',
      iconRing: 'ring-2 ring-fuchsia-100/70',
      iconShadow: 'drop-shadow-[0_6px_14px_rgba(134,25,143,0.5)]',
      cardBorder: 'border-fuchsia-200/70',
      shadow: 'shadow-[0_24px_55px_rgba(162,28,175,0.28)]',
    },
  },
];

const parseCounter = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const computeNumberMasteryPercent = (node) => {
  if (!node || typeof node !== 'object') return 0;
  const attempts = Number.isFinite(node.totalAttempts) ? node.totalAttempts : 0;
  if (attempts <= 0) return 0;
  const correct = Number.isFinite(node.correctAttempts) ? node.correctAttempts : 0;
  return (correct / attempts) * 100;
};

export const computeAdditionStageProgress = (masteryTracking = {}, stageAchievements = {}) => {
  const stages = [];

  ADDITION_STAGE_SEQUENCE.forEach((stageConfig, index) => {
    const {
      id,
      label,
      shortLabel,
      description,
      maxAddend,
      minAddend = 1,
      masteryThreshold = 0.9,
      prerequisites = [],
      requiredPerfectRuns = 0,
      badge = null,
    } = stageConfig;

    const addends = [];
    for (let value = minAddend; value <= maxAddend; value += 1) {
      addends.push(value);
    }

    const summary = addends.reduce(
      (acc, addend) => {
        const node = masteryTracking[addend] || {};
        const percent = computeNumberMasteryPercent(node);
        const attempts = Number.isFinite(node.totalAttempts) ? node.totalAttempts : 0;
        const correct = Number.isFinite(node.correctAttempts) ? node.correctAttempts : 0;
        const hasEnoughAttempts = attempts >= MASTERED_REQUIRED_ATTEMPTS;
        const hasPerfectSample = attempts >= PERFECT_SAMPLE_ATTEMPTS && correct === attempts && attempts > 0;
        const meetsThreshold = attempts > 0 && percent >= masteryThreshold * 100;
        const mastered =
          node.level === 'mastered' ||
          (hasEnoughAttempts && meetsThreshold) ||
          hasPerfectSample;

        acc.totalAttempts += attempts;
        acc.totalCorrect += correct;
        acc.percentSum += percent;
        acc.masteredCount += mastered ? 1 : 0;
        if (!mastered) {
          acc.allMastered = false;
          if (attempts === 0) {
            acc.unseenCount += 1;
          } else if (hasEnoughAttempts) {
            acc.blockerCount += 1;
          } else {
            acc.pendingCount += 1;
          }
        }
        if (!mastered && acc.nextTarget === null) {
          acc.nextTarget = addend;
        }
        if (mastered) {
          acc.highestMasteredAddend = Math.max(acc.highestMasteredAddend, addend);
        }
        return acc;
      },
      {
        totalAttempts: 0,
        totalCorrect: 0,
        percentSum: 0,
        masteredCount: 0,
        allMastered: true,
        nextTarget: null,
        pendingCount: 0,
        blockerCount: 0,
        unseenCount: 0,
        highestMasteredAddend: -1,
      },
    );

    const avgPercent = addends.length > 0 ? Math.round(summary.percentSum / addends.length) : 0;

    const stageBadge = stageAchievements?.[id] || {};
    const highAccuracyRuns =
      stageBadge.highAccuracyRuns != null ? parseCounter(stageBadge.highAccuracyRuns) : parseCounter(stageBadge.perfectRuns);
    const totalStageRuns = Math.max(
      0,
      Number.isFinite(stageBadge.attempts) ? stageBadge.attempts : Number.parseInt(stageBadge.attempts, 10) || 0,
    );
    const lastAccuracy = Number.isFinite(stageBadge.lastAccuracy) ? stageBadge.lastAccuracy : null;
    const bestAccuracy = Number.isFinite(stageBadge.bestAccuracy) ? stageBadge.bestAccuracy : null;
    const meetsHighAccuracyRequirement = requiredPerfectRuns <= 0 || highAccuracyRuns >= requiredPerfectRuns;
    const perAddendMastered =
      addends.length > 0 &&
      summary.blockerCount === 0 &&
      summary.unseenCount === 0 &&
      summary.masteredCount === addends.length;
    const stageAccuracy = Number.isFinite(lastAccuracy)
      ? lastAccuracy
      : Number.isFinite(bestAccuracy)
        ? bestAccuracy
        : avgPercent;
    const stageAccuracyMastered = Number.isFinite(stageAccuracy) && stageAccuracy >= masteryThreshold * 100;
    const meetsAccuracyRequirement = perAddendMastered && stageAccuracyMastered;
    const stageMastered = meetsAccuracyRequirement && meetsHighAccuracyRequirement;
    const badgeEarnedAt = Number.isFinite(stageBadge.badgeEarnedAt) ? stageBadge.badgeEarnedAt : stageBadge.badgeEarnedAt || null;

    const prerequisitesMet = prerequisites.every((reqId) => {
      const prerequisiteStage = stages.find((entry) => entry.id === reqId);
      return prerequisiteStage?.mastered === true;
    });

    const unlocked = index === 0 ? true : prerequisitesMet;

    stages.push({
      id,
      label,
      shortLabel,
      description,
      maxAddend,
      minAddend,
      masteryThreshold,
      prerequisites,
      addends,
      unlocked,
      prerequisitesMet,
      mastered: stageMastered,
      accuracyMastered: stageAccuracyMastered,
      accuracyRequirementsMet: meetsAccuracyRequirement,
      perAddendAccuracyMastered: perAddendMastered,
      stageAccuracy,
      stageAccuracyMastered,
      meetsPerfectRunRequirement: meetsHighAccuracyRequirement,
      meetsHighAccuracyRequirement,
      progressPercent: avgPercent,
      totalAttempts: summary.totalAttempts,
      totalCorrect: summary.totalCorrect,
      masteredCount: summary.masteredCount,
      nextTarget: summary.nextTarget,
      pendingCount: summary.pendingCount,
      blockerCount: summary.blockerCount,
      unseenCount: summary.unseenCount,
      highestMasteredAddend: summary.highestMasteredAddend,
      perfectRuns: highAccuracyRuns,
      requiredPerfectRuns,
      highAccuracyRuns,
      requiredHighAccuracyRuns: requiredPerfectRuns,
      highAccuracyRunThreshold: HIGH_ACCURACY_RUN_PERCENT,
      badge,
      badgeEarned: Boolean(badgeEarnedAt),
      badgeEarnedAt,
      totalStageRuns,
      lastAccuracy,
      bestAccuracy,
    });
  });

  return stages;
};

export const resolveMaxUnlockedAddend = (stageProgress = []) => {
  const unlockedStages = stageProgress.filter((stage) => stage.unlocked);
  if (!unlockedStages.length) {
    return ADDITION_STAGE_SEQUENCE[0]?.maxAddend ?? 3;
  }
  return unlockedStages.reduce((max, stage) => Math.max(max, stage.maxAddend), unlockedStages[0].maxAddend);
};

const clampAddendLimit = (value) => {
  const fallback = ADDITION_STAGE_SEQUENCE[0]?.maxAddend ?? 3;
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(9, value));
};

export const resolveUnlockedAddendLimit = (masteryTracking = {}, stageAchievements = {}) => {
  const stageSnapshot = computeAdditionStageProgress(masteryTracking || {}, stageAchievements || {});
  const rawLimit = resolveMaxUnlockedAddend(stageSnapshot);
  return clampAddendLimit(rawLimit);
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const filterItemsWithinAddendLimit = (items = [], limit) => {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const a = toNumber(item.a);
    const b = toNumber(item.b);
    if (a == null || b == null) return false;
    return a <= limit && b <= limit;
  });
};

export const findStageById = (stageProgress = [], id) => stageProgress.find((stage) => stage.id === id) || null;

export const TARGET_SUCCESS_DEFAULT = TARGET_SUCCESS_BAND.midpoint;
