import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { X, Sparkles, Rocket, Crown, Award, Lock, CircleCheckBig } from 'lucide-react';

const ICONS = {
  Sparkles,
  Rocket,
  Crown,
  Award,
};

const gradientBackground = (stage) => {
  if (stage?.badge?.gradient) {
    return `bg-gradient-to-br ${stage.badge.gradient}`;
  }
  return 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100';
};

const pickIcon = (iconName) => {
  if (iconName && ICONS[iconName]) {
    return ICONS[iconName];
  }
  return Sparkles;
};

const StageBadgeShowcase = ({ stages = [], onClose, runThresholdPercent = 85 }) => {
  const orderedStages = useMemo(() => {
    return [...stages].sort((a, b) => (a.maxAddend || 0) - (b.maxAddend || 0));
  }, [stages]);

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
          {orderedStages.length === 0 ? (
            <div className="rounded-3xl border-2 border-purple-100 bg-white/70 p-8 text-center text-purple-700 shadow">
              <p className="text-lg font-semibold">No badges earned yet</p>
              <p className="mt-2 text-sm">
                Complete your first practice run to start earning mini badges and stage achievements.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {orderedStages.map((stage) => {
                const runTarget = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0;
                const completedRuns = runTarget > 0
                  ? Math.min(stage.highAccuracyRuns ?? stage.perfectRuns ?? 0, runTarget)
                  : stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;
                const runPercent = runTarget > 0
                  ? Math.min(100, Math.round((completedRuns / runTarget) * 100))
                  : 100;
                const BadgeIcon = pickIcon(stage.badge?.icon);
                const accuracyPercent = Number.isFinite(stage.progressPercent) ? stage.progressPercent : 0;
                const mastered = Boolean(stage.mastered);
                const locked = !stage.unlocked;
                const badges = miniBadgeRows(stage);

                return (
                  <div
                    key={stage.id}
                    className={`relative overflow-hidden rounded-3xl border-2 border-purple-100 p-6 shadow-lg transition transform hover:-translate-y-1 ${gradientBackground(stage)}`}
                >
                  <div className="absolute inset-0 bg-white/60" aria-hidden="true" />
                  <div className="relative flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-purple-600">Stage</div>
                        <h3 className="text-2xl font-bold text-purple-900">{stage.label}</h3>
                        <p className="text-sm text-purple-800/80">{stage.badge?.description || stage.description}</p>
                      </div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${mastered ? 'bg-emerald-500/20 text-emerald-700' : 'bg-purple-500/15 text-purple-700'}`}>
                        <BadgeIcon className="h-4 w-4" />
                        {mastered ? 'Badge unlocked' : 'In progress'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 shadow-inner">
                      <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                        <span>Accuracy mastery</span>
                        <span>{accuracyPercent}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-purple-100">
                        <div className={`h-full rounded-full ${mastered ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(100, accuracyPercent)}%` }} />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-purple-900">
                        <span>High-accuracy runs ≥{runThresholdPercent}%</span>
                        <span>{completedRuns}{runTarget ? `/${runTarget}` : ''}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-purple-100">
                        <div className={`h-full rounded-full ${completedRuns >= runTarget && runTarget > 0 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${runPercent}%` }} />
                      </div>
                      {badges && (
                        <div className="mt-4 flex items-center gap-2">
                          {badges.map((earned, idx) => (
                            <div
                              // eslint-disable-next-line react/no-array-index-key
                              key={idx}
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${earned
                                ? 'border-emerald-300 bg-emerald-400/90 text-white shadow'
                                : 'border-purple-200 bg-white/80 text-purple-400'}`}
                            >
                              <Sparkles className="h-4 w-4" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-900/80">
                      <span>Highest accuracy: {Number.isFinite(stage.bestAccuracy) ? `${stage.bestAccuracy}%` : '—'}</span>
                      <span>Runs logged: {stage.totalStageRuns || stage.highAccuracyRuns || stage.perfectRuns || 0}</span>
                    </div>
                    {locked && !mastered && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2 rounded-full border-2 border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700">
                          <Lock size={16} />
                          Locked until badge earned
                        </div>
                      </div>
                    )}
                  </div>
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
