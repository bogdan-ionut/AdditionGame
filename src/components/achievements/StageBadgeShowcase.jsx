import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { X, Sparkles, Rocket, Crown, Award, Lock, CircleCheckBig, Gem } from 'lucide-react';

const FALLBACK_STAGE_BLUEPRINT = [
  {
    id: 'add-up-to-3',
    label: 'Adunări cu numere 0-3',
    description: 'Familiarizează-te cu sumele mici folosind termeni cuprinși între 0 și 3.',
    maxAddend: 3,
    minAddend: 0,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Inițiat Aurora',
      description: 'Aprinde inelul nebuloasei cu aventuri curajoase de +3.',
      gradient: 'from-amber-300 via-rose-400 to-fuchsia-500',
      accent: 'text-rose-900',
      icon: 'Sparkles',
      ringPalette: ['#fde68a', '#f472b6', '#c084fc'],
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
    description: 'Construiește încredere în sumele până la 10 adunând numere cuprinse între 0 și 5.',
    maxAddend: 5,
    minAddend: 0,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Navigatorul Nebuloasei',
      description: 'Trasează căi strălucitoare prin fiecare combinație de +5.',
      gradient: 'from-sky-300 via-indigo-500 to-purple-700',
      accent: 'text-indigo-900',
      icon: 'Rocket',
      ringPalette: ['#bae6fd', '#60a5fa', '#a855f7'],
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
    description: 'Stăpânește strategii de completare și descompunere pentru sume până la 7.',
    maxAddend: 7,
    minAddend: 0,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Cartograful Constelațiilor',
      description: 'Desenează hărți strălucitoare pentru fiecare combinație de +7.',
      gradient: 'from-emerald-300 via-teal-400 to-cyan-500',
      accent: 'text-emerald-900',
      icon: 'Award',
      ringPalette: ['#bbf7d0', '#34d399', '#22d3ee'],
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
    description: 'Finalizează traseul până la 10 consolidând toate combinațiile cu numere între 0 și 9.',
    maxAddend: 9,
    minAddend: 0,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Laureatul Celest',
      description: 'Încoronează fiecare faptă până la 10 cu automatism strălucitor.',
      gradient: 'from-fuchsia-400 via-purple-500 to-violet-700',
      accent: 'text-violet-900',
      icon: 'Gem',
      ringPalette: ['#f5d0fe', '#f472b6', '#6366f1'],
      cardGradient: 'from-violet-50 via-fuchsia-50/80 to-indigo-50',
      haloGradient: 'from-fuchsia-200/80 via-purple-300/60 to-indigo-400/70',
      coreGradient: 'from-fuchsia-400 via-purple-500 to-violet-600',
      innerGlowGradient: 'from-white/85 via-fuchsia-200/50 to-transparent',
      frameColor: 'border-fuchsia-100/80',
      pattern:
        'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.8), rgba(255,255,255,0) 55%), radial-gradient(circle at 70% 35%, rgba(255,255,255,0.4), rgba(255,255,255,0) 60%)',
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

const ICONS = {
  Sparkles,
  Rocket,
  Crown,
  Award,
  Gem,
};

const pickIcon = (iconName) => {
  if (iconName && ICONS[iconName]) {
    return ICONS[iconName];
  }
  return Sparkles;
};

const buildBadgeVisual = (badge = {}) => {
  const palette = Array.isArray(badge.sparklePalette) && badge.sparklePalette.length > 0
    ? badge.sparklePalette
    : ['rgba(196,181,253,0.45)', 'rgba(167,139,250,0.35)', 'rgba(244,114,182,0.35)'];

  return {
    haloGradient: badge.haloGradient || 'from-indigo-200/70 via-purple-200/40 to-fuchsia-200/60',
    beamGradient: badge.beamGradient || 'from-white/70 via-purple-200/30 to-transparent',
    coreGradient: badge.coreGradient || badge.gradient || 'from-indigo-500 via-purple-500 to-fuchsia-600',
    innerGlowGradient: badge.innerGlowGradient || 'from-white/85 via-white/15 to-transparent',
    frameColor: badge.frameColor || 'border-white/70',
    pattern: badge.pattern || null,
    ribbonGradient: badge.ribbonGradient || 'from-indigo-500 via-purple-600 to-fuchsia-600',
    sparklePalette: palette,
    ringPalette: Array.isArray(badge.ringPalette) && badge.ringPalette.length > 0
      ? badge.ringPalette
      : ['#c4b5fd', '#a855f7', '#f472b6'],
    ringTrackColor: badge.ringTrackColor || 'rgba(255,255,255,0.18)',
    sparkleGradientEarned: badge.sparkleGradientEarned
      || 'linear-gradient(135deg, rgba(129,140,248,0.9) 0%, rgba(236,72,153,0.9) 50%, rgba(253,224,71,0.9) 100%)',
    sparkleGradientLocked: badge.sparkleGradientLocked
      || 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(226,232,240,0.4) 100%)',
    sparkleShadow: badge.sparkleShadow || 'rgba(129,140,248,0.35)',
    progressGradient: badge.progressGradient || 'from-indigo-500 via-purple-500 to-fuchsia-600',
    runProgressGradient: badge.runProgressGradient || 'from-emerald-400 via-teal-400 to-cyan-400',
    cardGradient: badge.cardGradient || 'from-white via-purple-50/50 to-white',
    cardBorder: badge.cardBorder || 'border-purple-100/80',
    shadow: badge.shadow || 'shadow-[0_24px_50px_rgba(76,29,149,0.25)]',
    iconColor: badge.iconColor || 'text-white',
    iconBackdrop: badge.iconBackdrop || 'bg-white/20',
    iconRing: badge.iconRing || 'ring-2 ring-white/70',
    iconShadow: badge.iconShadow || 'drop-shadow-[0_6px_12px_rgba(76,29,149,0.4)]',
    accent: badge.accent || 'text-purple-900',
  };
};

const SPARKLE_POSITIONS = [
  { top: '6%', left: '12%' },
  { top: '18%', right: '12%' },
  { bottom: '12%', left: '20%' },
];

const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const buildRingProgressGradient = (palette, percent, trackColor, locked) => {
  const safePercent = clampPercent(percent);
  const clampedPalette = Array.isArray(palette) && palette.length > 0 ? palette : ['#c4b5fd', '#a855f7', '#f472b6'];
  const arcDegrees = (safePercent / 100) * 360;
  const mutedTrack = locked ? 'rgba(148,163,184,0.25)' : trackColor;

  if (safePercent <= 0) {
    return `conic-gradient(${mutedTrack} 0deg 360deg)`;
  }

  const segments = clampedPalette.map((color, index) => {
    const start = (arcDegrees * index) / clampedPalette.length;
    const end = (arcDegrees * (index + 1)) / clampedPalette.length;
    return `${color} ${start}deg ${end}deg`;
  });

  if (safePercent < 100) {
    segments.push(`${mutedTrack} ${arcDegrees}deg 360deg`);
  }

  return `conic-gradient(from -90deg, ${segments.join(', ')})`;
};

const rotateArray = (array, offset = 0) => {
  if (!Array.isArray(array) || array.length === 0) return [];
  const length = array.length;
  const normalizedOffset = ((offset % length) + length) % length;
  return Array.from({ length }, (_, idx) => array[(idx + normalizedOffset) % length]);
};

const buildTierRingGradient = (palette, percent, trackColor, locked, tierIndex, totalTiers = 3) => {
  if (totalTiers <= 0) {
    return buildRingProgressGradient(palette, percent, trackColor, locked);
  }
  const tierSpan = 100 / totalTiers;
  const tierProgress = clampPercent(((percent - tierIndex * tierSpan) / tierSpan) * 100);
  return buildRingProgressGradient(rotateArray(palette, tierIndex), tierProgress, trackColor, locked);
};

const StageBadgeShowcase = ({ stages = [], onClose, runThresholdPercent = 85 }) => {
  const normalizedStages = useMemo(() => {
    if (Array.isArray(stages) && stages.length > 0) {
      return stages.map((stage, index) => {
        const requiredRuns = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0;
        const currentRuns = stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;
        const badgeProgressPercent = requiredRuns > 0
          ? Math.min(100, Math.round((Math.min(currentRuns, requiredRuns) / requiredRuns) * 100))
          : 0;

        return {
          requiredHighAccuracyRuns: requiredRuns,
          requiredPerfectRuns: stage.requiredPerfectRuns ?? stage.requiredHighAccuracyRuns ?? 0,
          highAccuracyRuns: currentRuns,
          unlocked: stage.unlocked ?? index === 0,
          mastered: Boolean(stage.mastered),
          accuracyMastered: Boolean(stage.accuracyMastered),
          perAddendAccuracyMastered: Boolean(stage.perAddendAccuracyMastered ?? stage.accuracyMastered),
          accuracyRequirementsMet: Boolean(stage.accuracyRequirementsMet ?? stage.mastered),
          stageAccuracy: Number.isFinite(stage.stageAccuracy)
            ? stage.stageAccuracy
            : Number.isFinite(stage.lastAccuracy)
              ? stage.lastAccuracy
              : Number.isFinite(stage.bestAccuracy)
                ? stage.bestAccuracy
                : null,
          stageAccuracyMastered: Boolean(stage.stageAccuracyMastered),
          meetsHighAccuracyRequirement: Boolean(stage.meetsHighAccuracyRequirement ?? stage.meetsPerfectRunRequirement),
          progressPercent: Number.isFinite(stage.progressPercent) ? stage.progressPercent : 0,
          badgeProgressPercent,
          totalStageRuns: Number.isFinite(stage.totalStageRuns)
          ? stage.totalStageRuns
          : Number.isFinite(stage.highAccuracyRuns)
            ? stage.highAccuracyRuns
            : 0,
          bestAccuracy: Number.isFinite(stage.bestAccuracy) ? stage.bestAccuracy : null,
          lastAccuracy: Number.isFinite(stage.lastAccuracy)
            ? stage.lastAccuracy
            : Number.isFinite(stage.stageAccuracy)
              ? stage.stageAccuracy
              : null,
          badgeEarned: Boolean(stage.badgeEarned),
          ...stage,
        };
      });
    }

    return FALLBACK_STAGE_BLUEPRINT.map((stage, index) => ({
      ...stage,
      unlocked: index === 0,
      mastered: false,
      accuracyMastered: false,
      accuracyRequirementsMet: false,
      perAddendAccuracyMastered: false,
      stageAccuracy: null,
      stageAccuracyMastered: false,
      meetsHighAccuracyRequirement: false,
      progressPercent: 0,
      badgeProgressPercent: 0,
      totalStageRuns: 0,
      bestAccuracy: null,
      lastAccuracy: null,
      pendingCount: 0,
      blockerCount: 0,
      badgeEarned: false,
      highAccuracyRuns: 0,
      requiredPerfectRuns: stage.requiredHighAccuracyRuns,
    }));
  }, [stages]);

  const orderedStages = useMemo(() => {
    return [...normalizedStages].sort((a, b) => (a.maxAddend || 0) - (b.maxAddend || 0));
  }, [normalizedStages]);

  const hasProgressData = Array.isArray(stages) && stages.length > 0;

  const masteredCount = orderedStages.filter((stage) => stage.mastered).length;
  const totalCount = orderedStages.length;

  const [allowClose, setAllowClose] = useState(false);

  useEffect(() => {
    let frameId = null;
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      frameId = window.requestAnimationFrame(() => setAllowClose(true));
    } else {
      frameId = setTimeout(() => setAllowClose(true), 0);
    }
    return () => {
      if (typeof window !== 'undefined' && window.cancelAnimationFrame && frameId != null) {
        window.cancelAnimationFrame(frameId);
      } else if (frameId != null) {
        clearTimeout(frameId);
      }
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (!allowClose) return;
    onClose?.();
  }, [allowClose, onClose]);

  const handleBackdropClick = useCallback(
    (event) => {
      if (!allowClose) return;
      if (event.target === event.currentTarget) {
        handleRequestClose();
      }
    },
    [allowClose, handleRequestClose],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRequestClose]);

  const miniBadgeRows = (stage) => {
    const target = stage?.requiredHighAccuracyRuns ?? stage?.requiredPerfectRuns ?? 0;
    if (!target || target <= 0) return null;
    const completed = Math.min(stage?.highAccuracyRuns ?? stage?.perfectRuns ?? 0, target);
    return Array.from({ length: target }, (_, idx) => idx < completed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur"
        aria-hidden="true"
        onMouseDown={handleBackdropClick}
      />
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl border-4 border-purple-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 px-8 py-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Galerie de insigne</h2>
              <p className="text-sm opacity-90">
                Atinge 90% stăpânire și înregistrează runde cu acuratețe de peste {runThresholdPercent}% în fiecare etapă pentru a debloca următoarea aventură.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/20 px-4 py-2 text-sm font-semibold">
              <CircleCheckBig className="h-5 w-5" />
              <span>{masteredCount}/{totalCount} insigne câștigate</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-purple-700 shadow"
            aria-label="Închide insignele"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto bg-gradient-to-br from-white via-violet-50 to-white px-8 py-6">
          {!hasProgressData && (
            <div className="mb-6 rounded-3xl border-2 border-purple-100 bg-white/70 p-6 text-sm text-purple-700 shadow">
              <p className="font-semibold text-purple-900">Previzualizează drumul insignei</p>
              <p className="mt-1">
                Nu ai înregistrat încă nicio realizare, dar iată o privire asupra fiecărei insigne care te așteaptă.
                Continuă să exersezi—fiecare etapă va străluci în culori vii imediat ce o câștigi!
              </p>
            </div>
          )}
          {orderedStages.length === 0 ? (
            <div className="rounded-3xl border-2 border-purple-100 bg-white/70 p-8 text-center text-purple-700 shadow">
              <p className="text-lg font-semibold">Nu există insigne disponibile</p>
              <p className="mt-2 text-sm">Revino mai târziu pentru noi realizări.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:auto-rows-fr">
              {orderedStages.map((stage, index) => {
                const runTarget = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0;
                const completedRuns = runTarget > 0
                  ? Math.min(stage.highAccuracyRuns ?? stage.perfectRuns ?? 0, runTarget)
                  : stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;
                const runPercent = runTarget > 0
                  ? Math.min(100, Math.round((completedRuns / runTarget) * 100))
                  : 100;
                const accuracyPercent = Number.isFinite(stage.progressPercent) ? stage.progressPercent : 0;
                const masteryPercentRequirement = Number.isFinite(stage.masteryThreshold)
                  ? Math.round(stage.masteryThreshold * 100)
                  : 90;
                const lastAccuracy = Number.isFinite(stage.lastAccuracy) ? stage.lastAccuracy : null;
                const bestAccuracy = Number.isFinite(stage.bestAccuracy) ? stage.bestAccuracy : null;
                const lastAccuracyBelowThreshold = lastAccuracy != null && lastAccuracy < masteryPercentRequirement;
                const focusSegments = [];
                if (stage.nextTarget != null) {
                  focusSegments.push(`+${stage.nextTarget}`);
                }
                if (Number.isFinite(stage.pendingCount) && stage.pendingCount > 0) {
                  focusSegments.push(`${stage.pendingCount} aproape`);
                }
                if (Number.isFinite(stage.blockerCount) && stage.blockerCount > 0) {
                  focusSegments.push(`${stage.blockerCount} blocat${stage.blockerCount === 1 ? '' : 'e'}`);
                }
                const mastered = Boolean(stage.mastered);
                const locked = !stage.unlocked;
                const badges = miniBadgeRows(stage);
                const BadgeIcon = pickIcon(stage.badge?.icon);
                const visual = buildBadgeVisual(stage.badge || {});
                const accentTextClass = visual.accent || 'text-purple-900';
                const stageIndex = index + 1;
                const statusLabel = mastered ? 'Insignă deblocată' : locked ? 'Blocat' : 'În progres';
                const statusTone = mastered
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200/70'
                  : locked
                    ? 'bg-slate-200/40 text-slate-600 border-slate-200/70'
                    : 'bg-purple-500/15 text-purple-700 border-purple-200/70';
                const ringProgressPercent = clampPercent(stage.badgeProgressPercent ?? runPercent ?? 0);
                const totalBadgeTiers = 3;
                const tierSpan = 100 / totalBadgeTiers;
                const tierProgressValues = Array.from({ length: totalBadgeTiers }, (_, tierIndex) => clampPercent(
                  ((ringProgressPercent - tierIndex * tierSpan) / tierSpan) * 100,
                ));
                const tierGradients = tierProgressValues.map((_, tierIndex) => buildTierRingGradient(
                  visual.ringPalette,
                  ringProgressPercent,
                  visual.ringTrackColor,
                  locked,
                  tierIndex,
                  totalBadgeTiers,
                ));
                const tierActiveStates = tierProgressValues.map((value) => value > 0);
                const tierCompleteStates = tierProgressValues.map((value) => value >= 100);
                const showFinalBurst = mastered || ringProgressPercent >= 99.5;
                const IconComponent = locked ? Lock : BadgeIcon;
                const sparkleOpacity = locked ? 0.2 : 0.35 + (ringProgressPercent / 100) * 0.45;
                const innerGlowOpacity = locked ? 0.35 : 0.5 + (ringProgressPercent / 100) * 0.35;
                const progressMedallionClass = locked
                  ? 'bg-white/50 text-slate-600'
                  : mastered
                    ? 'bg-white/90 text-emerald-600'
                    : 'bg-white/80 text-purple-700';
                const statCards = [
                  {
                    key: 'best',
                    label: 'Cea mai bună acuratețe',
                    value: Number.isFinite(stage.bestAccuracy) ? `${stage.bestAccuracy}%` : '—',
                    tone: 'purple',
                  },
                  {
                    key: 'last',
                    label: 'Ultima rundă',
                    value: lastAccuracy != null ? `${lastAccuracy}%` : '—',
                    tone: lastAccuracy == null ? 'slate' : lastAccuracyBelowThreshold ? 'amber' : 'emerald',
                  },
                  {
                    key: 'runs',
                    label: 'Runde înregistrate',
                    value: stage.totalStageRuns || stage.highAccuracyRuns || stage.perfectRuns || 0,
                    tone: 'slate',
                  },
                  {
                    key: 'status',
                    label: 'Starea insignei',
                    value: statusLabel,
                    tone: mastered ? 'emerald' : locked ? 'slate' : 'purple',
                  },
                ];
                if (focusSegments.length > 0) {
                  statCards.push({
                    key: 'focus',
                    label: 'Ținta următoare',
                    value: focusSegments.join(' · '),
                    tone: 'purple',
                  });
                }

                return (
                  <div
                    key={stage.id}
                    className={`relative flex h-full flex-col overflow-hidden rounded-[2.5rem] border ${visual.cardBorder} bg-gradient-to-br ${visual.cardGradient} p-6 ${visual.shadow} transition-transform duration-300 hover:-translate-y-1`}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-white/25 backdrop-blur-[2px]" aria-hidden="true" />
                    <div
                      className={`pointer-events-none absolute -left-16 right-[-16px] top-0 h-40 bg-gradient-to-br ${visual.beamGradient} opacity-60 blur-3xl`}
                      aria-hidden="true"
                    />
                    <div className="relative z-10 flex h-full flex-col gap-6">
                      <div className="flex flex-col items-center gap-5 text-center xl:flex-row xl:items-start xl:text-left xl:gap-6">
                        <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
                          <div
                            className={`pointer-events-none absolute inset-[-25%] rounded-full bg-gradient-to-br ${visual.haloGradient} opacity-80 blur-3xl`}
                            aria-hidden="true"
                          />
                          {visual.sparklePalette.map((color, sparkleIndex) => {
                            const position = SPARKLE_POSITIONS[sparkleIndex % SPARKLE_POSITIONS.length];
                            return (
                              <span
                                key={`${stage.id}-sparkle-${sparkleIndex}`}
                                className="pointer-events-none absolute h-12 w-12 rounded-full blur-[18px]"
                                style={{ background: color, ...position, opacity: sparkleOpacity }}
                                aria-hidden="true"
                              />
                            );
                          })}
                          {showFinalBurst && (
                            <>
                              <span
                                className="pointer-events-none absolute -left-7 top-1/2 h-16 w-12 -translate-y-1/2 rotate-[-12deg] opacity-80"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(253,224,71,0.85), rgba(249,115,22,0.7))',
                                  clipPath: 'polygon(10% 0%, 100% 25%, 80% 100%, 0% 80%)',
                                  filter: 'drop-shadow(0 12px 18px rgba(249,115,22,0.35))',
                                }}
                                aria-hidden="true"
                              />
                              <span
                                className="pointer-events-none absolute -right-7 top-1/2 h-16 w-12 -translate-y-1/2 rotate-[12deg] opacity-80"
                                style={{
                                  background: 'linear-gradient(45deg, rgba(147,197,253,0.85), rgba(196,181,253,0.75))',
                                  clipPath: 'polygon(0% 25%, 90% 0%, 100% 80%, 20% 100%)',
                                  filter: 'drop-shadow(0 12px 18px rgba(147,197,253,0.35))',
                                }}
                                aria-hidden="true"
                              />
                            </>
                          )}
                          <div
                            className={`relative z-10 flex h-full w-full items-center justify-center rounded-full border-[6px] ${visual.frameColor} shadow-[0_18px_35px_rgba(45,17,90,0.25)]`}
                          >
                            <div className="absolute inset-[4%] rounded-full bg-white/30 blur-md" aria-hidden="true" />
                            <div
                              className="absolute inset-[8%] rounded-full border border-white/40 bg-white/10"
                              style={{ boxShadow: locked ? '0 16px 28px rgba(148,163,184,0.25)' : '0 18px 34px rgba(168,85,247,0.28)' }}
                              aria-hidden="true"
                            />
                            {[0, 1, 2].map((tierIndex) => {
                              const insetMap = ['12%', '22%', '34%'];
                              const glowStrength = locked
                                ? ['0 8px 16px rgba(148,163,184,0.25)', '0 6px 12px rgba(148,163,184,0.22)', '0 4px 10px rgba(148,163,184,0.2)']
                                : ['0 12px 22px rgba(249,115,22,0.25)', '0 10px 18px rgba(168,85,247,0.28)', '0 8px 14px rgba(59,130,246,0.22)'];
                              const opacityMap = locked ? [0.55, 0.4, 0.32] : [0.98, 0.9, 0.82];
                              const tierGradient = tierGradients[tierIndex];
                              const tierActive = tierActiveStates[tierIndex];
                              const tierComplete = tierCompleteStates[tierIndex];
                              return (
                                <div
                                  key={`${stage.id}-tier-${tierIndex}`}
                                  className="absolute rounded-full transition-all duration-500"
                                  style={{
                                    inset: insetMap[tierIndex],
                                    backgroundImage: tierGradient,
                                    opacity: opacityMap[tierIndex] * (locked && !tierActive ? 0.65 : 1),
                                    boxShadow: glowStrength[tierIndex],
                                    filter: tierComplete ? 'saturate(1.15)' : tierActive ? 'saturate(1)' : 'saturate(0.65)',
                                  }}
                                  aria-hidden="true"
                                >
                                  <div
                                    className="absolute inset-[8%] rounded-full border border-white/20"
                                    style={{ opacity: tierActive ? 0.4 : 0.18 }}
                                  />
                                  {tierComplete && (
                                    <div
                                      className="absolute inset-[20%] rounded-full"
                                      style={{
                                        background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
                                        opacity: 0.6,
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                            <div
                              className={`absolute inset-[46%] rounded-[1.35rem] bg-gradient-to-br ${visual.innerGlowGradient}`}
                              style={{ opacity: innerGlowOpacity }}
                            />
                            <div
                              className={`absolute inset-[42%] rounded-[1.5rem] bg-gradient-to-br ${visual.coreGradient} ${showFinalBurst ? 'shadow-[0_20px_40px_rgba(251,191,36,0.45)]' : 'shadow-[0_16px_28px_rgba(124,58,237,0.35)]'}`}
                              style={{ opacity: locked ? 0.6 : 1 }}
                            />
                            {visual.pattern && (
                              <div
                                className="absolute inset-[14%] rounded-full opacity-80"
                                style={{ backgroundImage: visual.pattern, backgroundSize: '170% 170%' }}
                              />
                            )}
                            <div className="relative z-20 flex h-[55%] w-[55%] flex-col items-center justify-center gap-2 text-white">
                              <div
                                className={`relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br ${visual.coreGradient} ${visual.iconShadow} ${showFinalBurst ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}
                                style={{ boxShadow: showFinalBurst ? '0 22px 38px rgba(251,191,36,0.45)' : undefined }}
                              >
                                <div className={`absolute inset-[18%] rounded-[1.25rem] ${visual.iconBackdrop} ${visual.iconRing}`} />
                                <IconComponent className={`relative z-10 h-10 w-10 ${locked ? 'text-slate-400' : `${visual.iconColor} ${visual.iconShadow}`}`} />
                                {showFinalBurst && (
                                  <div
                                    className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-80"
                                    style={{
                                      background: 'radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 60%)',
                                    }}
                                  />
                                )}
                              </div>
                              <div
                                className={`flex items-center gap-1 rounded-full ${progressMedallionClass} px-3 py-1 text-xs font-semibold shadow`}
                              >
                                <IconComponent className="h-4 w-4" />
                                {ringProgressPercent}%
                              </div>
                              {runTarget > 0 && (
                                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white/85">
                                  {completedRuns}/{runTarget} runde
                                </span>
                              )}
                            </div>
                          </div>
                          {visual.ribbonGradient && (
                            <div className="pointer-events-none absolute -bottom-6 flex w-full justify-center" aria-hidden="true">
                              <div className={`relative h-14 w-40 rounded-b-[2.5rem] bg-gradient-to-r ${visual.ribbonGradient} shadow-lg`}>
                                <div className="absolute inset-x-8 bottom-1 h-2 rounded-t-full bg-white/40 blur-[2px]" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wide text-purple-600 xl:justify-start">
                          <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Etapa {stageIndex}</span>
                          <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Termen maxim {stage.maxAddend}</span>
                          {runTarget > 0 && (
                            <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Runde țintă {runTarget}</span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${statusTone}`}>
                            <IconComponent className="h-3.5 w-3.5" />
                            {statusLabel}
                          </span>
                        </div>
                        <div className="space-y-2 xl:max-w-[14rem]">
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-500">{stage.label}</p>
                          <h3 className={`text-2xl font-black tracking-tight ${accentTextClass}`}>{stage.badge?.name}</h3>
                          <p className="text-sm text-purple-900/75 leading-relaxed">{stage.badge?.description || stage.description}</p>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-inner">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                            <span>Acuratețe pentru stăpânire</span>
                            <span>{accuracyPercent}%</span>
                          </div>
                          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/40 shadow-inner">
                            <div className={`h-full rounded-full bg-gradient-to-r ${visual.progressGradient}`} style={{ width: `${Math.min(100, accuracyPercent)}%` }} />
                          </div>
                          <p className="mt-3 text-xs text-purple-800/80">
                            <span className="block">
                              Stăpânirea cere {masteryPercentRequirement}% acuratețe pentru fiecare termen din această etapă.
                              {' '}
                              {stage.perAddendAccuracyMastered
                                ? 'Bravo! Fiecare termen atinge deja pragul de stăpânire.'
                                : 'Continuă să exersezi termenii mai fragili pentru a atinge pragul pe toată linia.'}
                            </span>
                            {lastAccuracy != null && (
                              <span
                                className={`block mt-1 ${lastAccuracyBelowThreshold ? 'text-amber-600/90' : 'text-emerald-600/90'}`}
                              >
                                Ultima rundă: {lastAccuracy}% {lastAccuracyBelowThreshold ? '(sub țintă)' : '(peste țintă)'}.
                              </span>
                            )}
                            {bestAccuracy != null && (
                              <span className="block text-purple-700/80 mt-1">
                                Record personal: {bestAccuracy}%.
                              </span>
                            )}
                            {focusSegments.length > 0 && (
                              <span className="block text-purple-700/80 mt-1">
                                Următorul focus: {focusSegments.join(' · ')}.
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-inner">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                            <span>Runde cu acuratețe ≥{runThresholdPercent}%</span>
                            <span>{completedRuns}{runTarget ? `/${runTarget}` : ''}</span>
                          </div>
                          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/40 shadow-inner">
                            <div className={`h-full rounded-full bg-gradient-to-r ${visual.runProgressGradient}`} style={{ width: `${runPercent}%` }} />
                          </div>
                          {badges ? (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {badges.map((earned, idx) => (
                                <div
                                  key={idx}
                                  className="relative flex h-10 w-9 items-center justify-center text-white transition-transform duration-200 hover:-translate-y-0.5"
                                  style={{
                                    clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                                    backgroundImage: earned ? visual.sparkleGradientEarned : visual.sparkleGradientLocked,
                                    boxShadow: earned ? `0 14px 22px ${visual.sparkleShadow}` : '0 8px 14px rgba(148,163,184,0.25)',
                                  }}
                                >
                                  <Sparkles className={`h-4 w-4 ${earned ? 'drop-shadow-[0_2px_6px_rgba(255,255,255,0.65)]' : 'text-purple-400'}`} />
                                  {earned && (
                                    <span
                                      className="pointer-events-none absolute inset-0 opacity-60"
                                      style={{
                                        clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                                        background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.8), rgba(255,255,255,0))',
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-purple-800/70">Finalizează runde precise pentru a aprinde această insignă.</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {statCards.map((stat) => {
                          const valueClass = stat.tone === 'emerald'
                            ? 'text-emerald-600'
                            : stat.tone === 'amber'
                              ? 'text-amber-600'
                              : stat.tone === 'slate'
                                ? 'text-slate-700'
                                : 'text-purple-700';
                          return (
                            <div key={stat.key} className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 shadow-inner">
                              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-purple-500">{stat.label}</div>
                              <div className={`mt-1 text-lg font-bold ${valueClass}`}>{stat.value}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {locked && !mastered && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        <div className="flex items-center gap-3 rounded-full border border-purple-200/80 bg-white px-5 py-2 text-sm font-semibold text-purple-700 shadow-lg">
                          <Lock className="h-5 w-5" />
                          Câștigă insigna precedentă pentru a debloca
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StageBadgeShowcase;
