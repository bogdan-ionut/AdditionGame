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
    label: 'Addition up to 3',
    description: 'Lock in counting-all strategies using addends from 1 to 3.',
    maxAddend: 3,
    minAddend: 1,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Aurora Initiate',
      description: 'Ignite the nebula ring with fearless +3 adventures.',
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
    label: 'Addition up to 5',
    description: 'Build confidence with teen totals by adding numbers up to 5.',
    maxAddend: 5,
    minAddend: 1,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Nebula Navigator',
      description: 'Chart shimmering pathways through every +5 combination.',
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
    id: 'add-up-to-10',
    label: 'Addition up to 10',
    description: 'Finish the within-10 journey with automatic recall of all facts.',
    maxAddend: 9,
    minAddend: 1,
    requiredHighAccuracyRuns: 3,
    badge: {
      name: 'Celestial Laureate',
      description: 'Crown every within-10 fact with radiant automaticity.',
      gradient: 'from-fuchsia-400 via-purple-500 to-violet-700',
      accent: 'text-violet-900',
      icon: 'Gem',
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

const StageBadgeShowcase = ({ stages = [], onClose, runThresholdPercent = 85 }) => {
  const normalizedStages = useMemo(() => {
    if (Array.isArray(stages) && stages.length > 0) {
      return stages.map((stage, index) => ({
        requiredHighAccuracyRuns: stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0,
        requiredPerfectRuns: stage.requiredPerfectRuns ?? stage.requiredHighAccuracyRuns ?? 0,
        highAccuracyRuns: stage.highAccuracyRuns ?? stage.perfectRuns ?? 0,
        unlocked: stage.unlocked ?? index === 0,
        mastered: Boolean(stage.mastered),
        accuracyMastered: Boolean(stage.accuracyMastered),
        meetsHighAccuracyRequirement: Boolean(stage.meetsHighAccuracyRequirement ?? stage.meetsPerfectRunRequirement),
        progressPercent: Number.isFinite(stage.progressPercent) ? stage.progressPercent : 0,
        totalStageRuns: Number.isFinite(stage.totalStageRuns)
          ? stage.totalStageRuns
          : Number.isFinite(stage.highAccuracyRuns)
            ? stage.highAccuracyRuns
            : 0,
        bestAccuracy: Number.isFinite(stage.bestAccuracy) ? stage.bestAccuracy : null,
        lastAccuracy: Number.isFinite(stage.lastAccuracy) ? stage.lastAccuracy : null,
        badgeEarned: Boolean(stage.badgeEarned),
        ...stage,
      }));
    }

    return FALLBACK_STAGE_BLUEPRINT.map((stage, index) => ({
      ...stage,
      unlocked: index === 0,
      mastered: false,
      accuracyMastered: false,
      meetsHighAccuracyRequirement: false,
      progressPercent: 0,
      totalStageRuns: 0,
      bestAccuracy: null,
      lastAccuracy: null,
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
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border-4 border-purple-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 px-8 py-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Badge Gallery</h2>
              <p className="text-sm opacity-90">
                Reach 90% mastery and log {runThresholdPercent}%+ accuracy runs in each stage to unlock the next adventure.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/20 px-4 py-2 text-sm font-semibold">
              <CircleCheckBig className="h-5 w-5" />
              <span>{masteredCount}/{totalCount} badges earned</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-purple-700 shadow"
            aria-label="Close achievements"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto bg-gradient-to-br from-white via-violet-50 to-white px-8 py-6">
          {!hasProgressData && (
            <div className="mb-6 rounded-3xl border-2 border-purple-100 bg-white/70 p-6 text-sm text-purple-700 shadow">
              <p className="font-semibold text-purple-900">Preview the badge journey</p>
              <p className="mt-1">
                You haven&apos;t logged any achievements yet, but here&apos;s a peek at every badge waiting to be unlocked.
                Keep practicing—each stage will glow in full color once you earn it!
              </p>
            </div>
          )}
          {orderedStages.length === 0 ? (
            <div className="rounded-3xl border-2 border-purple-100 bg-white/70 p-8 text-center text-purple-700 shadow">
              <p className="text-lg font-semibold">No badges available</p>
              <p className="mt-2 text-sm">Check back later for new achievements.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {orderedStages.map((stage, index) => {
                const runTarget = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0;
                const completedRuns = runTarget > 0
                  ? Math.min(stage.highAccuracyRuns ?? stage.perfectRuns ?? 0, runTarget)
                  : stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;
                const runPercent = runTarget > 0
                  ? Math.min(100, Math.round((completedRuns / runTarget) * 100))
                  : 100;
                const accuracyPercent = Number.isFinite(stage.progressPercent) ? stage.progressPercent : 0;
                const mastered = Boolean(stage.mastered);
                const locked = !stage.unlocked;
                const badges = miniBadgeRows(stage);
                const BadgeIcon = pickIcon(stage.badge?.icon);
                const visual = buildBadgeVisual(stage.badge || {});
                const accentTextClass = visual.accent || 'text-purple-900';
                const stageIndex = index + 1;
                const masteryPercentRequirement = Number.isFinite(stage.masteryThreshold)
                  ? Math.round(stage.masteryThreshold * 100)
                  : 90;
                const statusLabel = mastered ? 'Badge unlocked' : locked ? 'Locked' : 'In progress';
                const statusTone = mastered
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200/70'
                  : locked
                    ? 'bg-slate-200/40 text-slate-600 border-slate-200/70'
                    : 'bg-purple-500/15 text-purple-700 border-purple-200/70';
                const StatusIcon = locked ? Lock : BadgeIcon;
                const statCards = [
                  {
                    key: 'best',
                    label: 'Highest accuracy',
                    value: Number.isFinite(stage.bestAccuracy) ? `${stage.bestAccuracy}%` : '—',
                    tone: 'purple',
                  },
                  {
                    key: 'last',
                    label: 'Recent run',
                    value: Number.isFinite(stage.lastAccuracy) ? `${stage.lastAccuracy}%` : '—',
                    tone: 'purple',
                  },
                  {
                    key: 'runs',
                    label: 'Runs logged',
                    value: stage.totalStageRuns || stage.highAccuracyRuns || stage.perfectRuns || 0,
                    tone: 'slate',
                  },
                  {
                    key: 'status',
                    label: 'Badge status',
                    value: statusLabel,
                    tone: mastered ? 'emerald' : locked ? 'slate' : 'purple',
                  },
                ];

                return (
                  <div
                    key={stage.id}
                    className={`relative overflow-hidden rounded-[2.5rem] border ${visual.cardBorder} bg-gradient-to-br ${visual.cardGradient} p-6 ${visual.shadow} transition-transform duration-300 hover:-translate-y-1`}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-white/25 backdrop-blur-[2px]" aria-hidden="true" />
                    <div
                      className={`pointer-events-none absolute -left-16 right-[-16px] top-0 h-40 bg-gradient-to-br ${visual.beamGradient} opacity-60 blur-3xl`}
                      aria-hidden="true"
                    />
                    <div className="relative z-10 flex flex-col gap-6">
                      <div className="flex flex-col items-center gap-5 text-center">
                        <div className="relative flex h-44 w-44 items-center justify-center">
                          <div
                            className={`pointer-events-none absolute inset-[-25%] rounded-full bg-gradient-to-br ${visual.haloGradient} opacity-80 blur-3xl`}
                            aria-hidden="true"
                          />
                          {visual.sparklePalette.map((color, sparkleIndex) => {
                            const position = SPARKLE_POSITIONS[sparkleIndex % SPARKLE_POSITIONS.length];
                            return (
                              <span
                                key={`${stage.id}-sparkle-${sparkleIndex}`}
                                className="pointer-events-none absolute h-12 w-12 rounded-full opacity-70 blur-[18px]"
                                style={{ background: color, ...position }}
                                aria-hidden="true"
                              />
                            );
                          })}
                          <div
                            className={`relative z-10 flex h-full w-full items-center justify-center rounded-full border-[6px] ${visual.frameColor} bg-gradient-to-br ${visual.coreGradient} shadow-[0_12px_30px_rgba(45,17,90,0.25)]`}
                          >
                            {visual.pattern && (
                              <div
                                className="absolute inset-[12%] rounded-full opacity-90"
                                style={{ backgroundImage: visual.pattern, backgroundSize: '160% 160%' }}
                              />
                            )}
                            <div className={`absolute inset-[16%] rounded-full bg-gradient-to-br ${visual.innerGlowGradient} opacity-90`} />
                            <div className="absolute inset-[10%] rounded-full border border-white/20" />
                            <div className={`relative z-20 flex h-16 w-16 items-center justify-center rounded-full ${visual.iconBackdrop} backdrop-blur-md ${visual.iconRing}`}>
                              <BadgeIcon className={`h-9 w-9 ${visual.iconColor} ${visual.iconShadow}`} strokeWidth={1.6} />
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
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wide text-purple-600">
                          <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Stage {stageIndex}</span>
                          <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Max addend {stage.maxAddend}</span>
                          {runTarget > 0 && (
                            <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-purple-700">Target runs {runTarget}</span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${statusTone}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusLabel}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-500">{stage.label}</p>
                          <h3 className={`text-2xl font-black tracking-tight ${accentTextClass}`}>{stage.badge?.name}</h3>
                          <p className="text-sm text-purple-900/75">{stage.badge?.description || stage.description}</p>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-inner">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                            <span>Accuracy mastery</span>
                            <span>{accuracyPercent}%</span>
                          </div>
                          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/40 shadow-inner">
                            <div className={`h-full rounded-full bg-gradient-to-r ${visual.progressGradient}`} style={{ width: `${Math.min(100, accuracyPercent)}%` }} />
                          </div>
                          <p className="mt-3 text-xs text-purple-800/80">
                            Mastery requires {masteryPercentRequirement}% accuracy across every addend in this stage.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-inner">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                            <span>High-accuracy runs ≥{runThresholdPercent}%</span>
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
                            <p className="mt-3 text-xs text-purple-800/70">Complete high-accuracy runs to light up this badge.</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {statCards.map((stat) => {
                          const valueClass = stat.tone === 'emerald'
                            ? 'text-emerald-600'
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
                          Earn the previous badge to unlock
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
