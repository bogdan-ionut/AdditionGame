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
    label: 'Adunare până la 3',
    description: 'Fixează strategiile de numărat complet folosind termeni de la 1 la 3.',
    maxAddend: 3,
    minAddend: 1,
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
    label: 'Adunare până la 5',
    description: 'Construiește încredere în sumele până la 10 adunând numere până la 5.',
    maxAddend: 5,
    minAddend: 1,
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
    id: 'add-up-to-10',
    label: 'Adunare până la 10',
    description: 'Încheie traseul până la 10 cu rechemare automată a tuturor faptelor.',
    maxAddend: 9,
    minAddend: 1,
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:auto-rows-fr">
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
                const StatusIcon = locked ? Lock : BadgeIcon;
                const ringProgressPercent = clampPercent(stage.badgeProgressPercent ?? runPercent ?? 0);
                const ringBackground = buildRingProgressGradient(
                  visual.ringPalette,
                  ringProgressPercent,
                  visual.ringTrackColor,
                  locked,
                );
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
                          <div
                            className={`relative z-10 flex h-full w-full items-center justify-center rounded-full border-[6px] ${visual.frameColor} shadow-[0_12px_30px_rgba(45,17,90,0.25)]`}
                            style={{ backgroundImage: ringBackground }}
                          >
                            {visual.pattern && (
                              <div
                                className="absolute inset-[12%] rounded-full opacity-90"
                                style={{ backgroundImage: visual.pattern, backgroundSize: '160% 160%' }}
                              />
                            )}
                            <div
                              className={`absolute inset-[16%] rounded-full bg-gradient-to-br ${visual.innerGlowGradient}`}
                              style={{ opacity: innerGlowOpacity }}
                            />
                            <div className="absolute inset-[10%] rounded-full border border-white/20" />
                            <div className={`relative z-20 flex h-16 w-16 items-center justify-center rounded-full ${visual.iconBackdrop} backdrop-blur-md ${visual.iconRing}`}>
                              <BadgeIcon className={`h-9 w-9 ${visual.iconColor} ${visual.iconShadow}`} strokeWidth={1.6} />
                            </div>
                            <div className={`pointer-events-none absolute inset-[28%] flex flex-col items-center justify-center rounded-full text-center drop-shadow ${progressMedallionClass}`}>
                              <span className="text-xs font-bold uppercase tracking-wide">
                                {completedRuns}
                                {runTarget ? `/${runTarget}` : ''}
                              </span>
                              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] opacity-80">Runde</span>
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
                            <StatusIcon className="h-3.5 w-3.5" />
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
