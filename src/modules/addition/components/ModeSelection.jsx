import { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowLeft,
  Hash,
  Shuffle,
  BarChart3,
  Download,
  Upload,
  Award,
  Wand2,
  Info,
  Sparkles,
  Check,
  Zap,
  Target,
  User,
  UserRound,
  Lock,
  X,
  Star,
  Brain,
  Scroll,
  Map as MapIcon,
  Crown,
  Gem,
  Sword
} from 'lucide-react';
import ConfettiBurst from '../../../components/achievements/ConfettiBurst.jsx';
import StageBadgeShowcase from '../../../components/achievements/StageBadgeShowcase.jsx';
import NextUpCard from '../../../components/NextUpCard';
import { TARGET_SUCCESS_BAND, normalizeMotifTokens } from '../../../lib/aiPersonalization';
import { showToast } from '../../../lib/ui/toast';
import { createDefaultMotifJobState } from '../state/gameState';
import { computeAdditionStageProgress, resolveMaxUnlockedAddend, HIGH_ACCURACY_RUN_PERCENT } from '../state/stages';
import { computeLearningPathInsights } from '../state/insights';
import { BADGE_ICON_MAP } from './badgeIcons';
import { describeSpriteUrl } from '../utils/personalization';

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
  motifJobState,
  aiBadgeActive,
  narrationNotice,
  stageProgress,
  achievementsOpen,
  onOpenAchievements,
  onCloseAchievements,
  showBadgeCelebration,
  badgeSpotlight,
  onDismissBadgeSpotlight,
}) => {
  const fileInputRef = useRef(null);
  const [showAbout, setShowAbout] = useState(false);
  const pathMeta = {
    title: 'Jurnalul Eroului',
    description: 'Alege-ți următoarea aventură în Tărâmul Adunării.',
    recommendedAges: 'Vârste 3-6',
    operationLabel: 'Adunare',
    ...learningPath,
  };
  const exitHandler = onExit ?? (() => { });
  const learningInsights = useMemo(() => computeLearningPathInsights(gameState), [gameState]);
  const recommendedNumbers = learningInsights.recommendations || new Set();
  const metrics = learningInsights.metrics || { overallAccuracy: 0, streak: 0, avgTime: '0.0' };
  const targetSuccessPercent = Math.round(((aiPersonalization?.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint) * 100));
  const focusRecommendations = (learningInsights.path || [])
    .filter((entry) => entry.level !== 'mastered' || entry.recommended)
    .slice(0, 5);

  const additionStages = useMemo(() => {
    if (Array.isArray(stageProgress) && stageProgress.length) {
      return stageProgress;
    }
    return computeAdditionStageProgress(
      gameState?.masteryTracking || {},
      gameState?.achievements?.stageBadges || {},
    );
  }, [gameState?.achievements?.stageBadges, gameState?.masteryTracking, stageProgress]);

  const handleViewAchievements = useCallback(() => {
    onOpenAchievements?.();
    onDismissBadgeSpotlight?.();
  }, [onDismissBadgeSpotlight, onOpenAchievements]);

  const handleCloseSpotlight = useCallback(() => {
    onDismissBadgeSpotlight?.();
  }, [onDismissBadgeSpotlight]);

  const SpotlightIcon = badgeSpotlight?.icon && BADGE_ICON_MAP[badgeSpotlight.icon]
    ? BADGE_ICON_MAP[badgeSpotlight.icon]
    : Sparkles;
  const CelebrationIcon = BADGE_ICON_MAP.PartyPopper || BADGE_ICON_MAP.Sparkles || Sparkles;
  const playerDisplayName = (() => {
    const candidate = badgeSpotlight?.playerName
      || gameState?.studentInfo?.preferredName
      || gameState?.studentInfo?.nickname
      || gameState?.studentInfo?.name;
    return candidate ? candidate.toString().trim() : '';
  })();

  const defaultRangeLimit = useMemo(
    () => resolveMaxUnlockedAddend(additionStages),
    [additionStages],
  );

  const defaultStageForModes = useMemo(() => {
    if (!additionStages.length) return null;
    const matching = additionStages.find((stage) => stage.maxAddend === defaultRangeLimit);
    if (matching) return matching;
    const unlocked = additionStages.filter((stage) => stage.unlocked);
    if (unlocked.length) return unlocked[unlocked.length - 1];
    return additionStages[0];
  }, [additionStages, defaultRangeLimit]);

  const stageMapByAddend = useMemo(() => {
    const map = new Map();
    additionStages.forEach((stage) => {
      stage.addends.forEach((addend) => {
        map.set(addend, stage);
      });
    });
    return map;
  }, [additionStages]);

  const stageMapById = useMemo(() => {
    const map = new Map();
    additionStages.forEach((stage) => {
      map.set(stage.id, stage);
    });
    return map;
  }, [additionStages]);

  const safeMotifJobState = motifJobState || createDefaultMotifJobState();

  const modes = [
    { id: 'sequential', name: 'Antrenament', desc: 'Toate numerele în ordine', icon: Sword, color: 'blue' },
    { id: 'random', name: 'Ambuscadă', desc: 'Exerciții surpriză', icon: Shuffle, color: 'purple' },
  ];

  const handleImport = (event) => {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
      showToast({ level: 'error', message: 'Nu am putut citi fișierul selectat.' });
      return;
    }

    onImport?.(event);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    } else if (event.target) {
      event.target.value = '';
    }
  };

  const getLockInfo = useCallback((addend) => {
    if (!Number.isInteger(addend) || addend <= 0) {
      return { locked: false, message: '', tooltip: '' };
    }

    const stage = stageMapByAddend.get(addend);
    if (!stage) {
      if (addend <= defaultRangeLimit) {
        return { locked: false, message: '', tooltip: '' };
      }
      const message = `Sigiliu Magic · Termină misiunea curentă pentru a ajunge la +${addend}.`;
      return {
        locked: true,
        message,
        tooltip: message,
      };
    }

    if (stage.unlocked) {
      return { locked: false, message: '', tooltip: '', stage };
    }

    const unmetPrerequisite = (stage.prerequisites || [])
      .map((stageId) => stageMapById.get(stageId))
      .find((prereq) => prereq && !prereq.mastered);

    if (unmetPrerequisite) {
      const { minAddend, maxAddend, label, masteryThreshold } = unmetPrerequisite;
      const rangeLabel = Number.isInteger(minAddend) && Number.isInteger(maxAddend)
        ? `+${minAddend} până la +${maxAddend}`
        : label || 'etapa prealabilă';
      const prerequisiteLabel = label || rangeLabel;
      const accuracyTarget = Math.round(((masteryThreshold ?? stage.masteryThreshold ?? 0.9) || 0.9) * 100);
      const message = `Sigiliu Magic · Termină ${prerequisiteLabel} pentru a debloca +${addend}.`;
      const tooltip = `Finalizați ${prerequisiteLabel} (≥${accuracyTarget}% acuratețe) pentru a rupe sigiliul.`;
      return {
        locked: true,
        message,
        tooltip,
        stage,
        blockingStage: unmetPrerequisite,
      };
    }

    const fallbackLabel = stage.label || `adunările până la +${stage.maxAddend}`;
    const fallback = `Sigiliu Magic · Termină ${fallbackLabel} pentru a continua.`;
    return { locked: true, message: fallback, tooltip: fallback, stage };
  }, [defaultRangeLimit, stageMapByAddend, stageMapById]);


  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-4 sm:p-8 flex flex-col items-center">
      {showBadgeCelebration && <ConfettiBurst />}

      <div className="max-w-6xl w-full space-y-8">

        {/* --- HEADER & HUD --- */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button
              onClick={exitHandler}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-300 hover:text-white"
            >
              <ArrowLeft size={18} />
              <span className="font-cinzel font-bold text-sm tracking-wider">Harta Lumii</span>
            </button>

            <div className="flex items-center gap-3 bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
              <div className={`w-2 h-2 rounded-full ${aiBadgeActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {aiBadgeActive ? 'Magie AI Activă' : 'Magie AI Inactivă'}
              </span>
            </div>
          </div>

          <div className="relative p-6 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border-2 border-indigo-500/50 flex items-center justify-center shadow-lg shadow-indigo-900/30">
                    {gameState.studentInfo.gender === 'male' ? (
                      <User className="text-indigo-400" size={40} />
                    ) : (
                      <UserRound className="text-pink-400" size={40} />
                    )}
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center text-slate-900 font-bold text-xs shadow-lg">
                    {gameState.studentInfo.age}
                  </div>
                </div>

                <div>
                  <h1 className="text-3xl font-bold text-white font-cinzel mb-1">{gameState.studentInfo.name}</h1>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Crown size={14} className="text-amber-500" />
                      Nivel {Math.floor(metrics.overallAccuracy / 10) || 1}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span className="flex items-center gap-1.5">
                      <Sword size={14} className="text-blue-400" />
                      {pathMeta.operationLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onLogout}
                  className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all"
                >
                  Deconectare
                </button>
              </div>
            </div>
          </div>
        </div>

        {narrationNotice && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-3 text-sm font-medium text-amber-200 shadow-lg backdrop-blur-sm flex items-center gap-3">
            <Info size={18} className="shrink-0" />
            {narrationNotice}
          </div>
        )}

        {/* --- ACTION GRID (Magical Artifacts) --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={onShowDashboard}
            className="group relative p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="text-indigo-400" size={24} />
            </div>
            <span className="font-cinzel font-bold text-slate-300 group-hover:text-white text-sm">Oracolul Părinților</span>
          </button>

          <button
            onClick={() => onOpenAchievements?.()}
            className="group relative p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/60 hover:border-purple-500/30 transition-all flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="text-purple-400" size={24} />
            </div>
            <span className="font-cinzel font-bold text-slate-300 group-hover:text-white text-sm">Sala Trofeelor</span>
          </button>

          <button
            onClick={() => onOpenAiSettings?.()}
            className="group relative p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wand2 className="text-emerald-400" size={24} />
            </div>
            <span className="font-cinzel font-bold text-slate-300 group-hover:text-white text-sm">Grimoar AI</span>
          </button>

          <div className="relative group">
            <button
              onClick={() => setShowAbout((prev) => !prev)}
              className="w-full h-full p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/60 hover:border-amber-500/30 transition-all flex flex-col items-center gap-3 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scroll className="text-amber-400" size={24} />
              </div>
              <span className="font-cinzel font-bold text-slate-300 group-hover:text-white text-sm">Pergamentul Cunoașterii</span>
            </button>
            {/* Hidden Import/Export for power users, accessible via small corner buttons if needed, or integrated elsewhere. For now keeping clean. */}
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
        </div>

        {/* --- THE PROPHECY (AI Journey) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Current Quest */}
          <div className="lg:col-span-2 rounded-3xl border border-indigo-500/20 bg-slate-900/60 backdrop-blur-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="text-amber-400" size={24} />
              <h2 className="text-xl font-bold text-white font-cinzel">Profeția (Următorul Pas)</h2>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-white/5">
                <NextUpCard
                  item={aiPreviewItem}
                  story={aiPreviewItem?.microStory || aiPersonalization?.lastPlan?.microStory}
                  loading={aiPlanStatus?.loading}
                  planSource={aiPlanStatus?.source || aiPreviewItem?.source || aiPersonalization?.lastPlan?.source}
                  targetSuccess={targetSuccessPercent}
                  configured={aiRuntime?.aiEnabled}
                  onStartAiPath={onStartAiPath}
                  onRefreshPlan={onRefreshPlan}
                  darkTheme={true}
                />
              </div>

              {/* Stats Mini-Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 flex flex-col items-center text-center">
                  <Target className="text-emerald-400 mb-2" size={20} />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Acuratețe</span>
                  <span className="text-lg font-bold text-white">{metrics.overallAccuracy}%</span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 flex flex-col items-center text-center">
                  <Zap className="text-amber-400 mb-2" size={20} />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Serie</span>
                  <span className="text-lg font-bold text-white">{metrics.streak}</span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 flex flex-col items-center text-center">
                  <Gem className="text-purple-400 mb-2" size={20} />
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Nivel</span>
                  <span className="text-lg font-bold text-white">{learningInsights.highestMastered >= 0 ? learningInsights.highestMastered : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interests & Motifs */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <Wand2 className="text-pink-400" size={24} />
              <h2 className="text-xl font-bold text-white font-cinzel">Inspirație Magică</h2>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(aiPersonalization?.learnerProfile?.interests || []).map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold uppercase tracking-wide"
                  >
                    {interest}
                    <button
                      type="button"
                      className="hover:text-white transition-colors"
                      onClick={() => onRemoveInterest?.(interest)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {!(aiPersonalization?.learnerProfile?.interests || []).length && (
                  <span className="text-sm text-slate-500 italic">Adaugă interese pentru a personaliza magia...</span>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                <input
                  type="text"
                  value={interestDraft}
                  onChange={(e) => onInterestDraftChange?.(e.target.value)}
                  placeholder="ex. dragoni, spațiu"
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                />
                <button
                  onClick={onAddInterest}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-pink-900/20"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- WORLD MAP (Stages) --- */}
        {additionStages.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <MapIcon className="text-indigo-400" size={24} />
              <h2 className="text-2xl font-bold text-white font-cinzel">Harta Lumii (Etape)</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {additionStages.map((stage) => {
                const isLocked = !stage.unlocked && !stage.mastered;
                const BadgeIcon = stage.badge?.icon && BADGE_ICON_MAP[stage.badge.icon]
                  ? BADGE_ICON_MAP[stage.badge.icon]
                  : Sparkles;

                return (
                  <div
                    key={stage.id}
                    className={`relative group rounded-2xl border-2 p-6 transition-all duration-300 ${stage.mastered
                      ? 'bg-slate-900/80 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                      : stage.unlocked
                        ? 'bg-slate-800/80 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'bg-slate-950/50 border-white/5 opacity-70 grayscale'
                      }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${stage.mastered ? 'bg-amber-500/20 text-amber-400' : stage.unlocked ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}>
                        {isLocked ? <Lock size={20} /> : <BadgeIcon size={20} />}
                      </div>
                      {stage.mastered && (
                        <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                          Stăpânit
                        </span>
                      )}
                    </div>

                    <h3 className={`text-lg font-bold font-cinzel mb-2 ${isLocked ? 'text-slate-500' : 'text-white'}`}>
                      {stage.label}
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 line-clamp-2">
                      {stage.description}
                    </p>

                    {/* Progress Bar */}
                    {!isLocked && (
                      <div className="mb-6">
                        <div className="flex justify-between text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">
                          <span>Progres</span>
                          <span>{stage.progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${stage.mastered ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                            style={{ width: `${stage.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (isLocked) {
                          const lockInfo = getLockInfo(stage.maxAddend);
                          showToast({ level: 'error', message: lockInfo.message });
                          return;
                        }
                        onSelectMode(`stage-${stage.id}`, null, {
                          rangeLimit: stage.maxAddend,
                          stageId: stage.id,
                        });
                      }}
                      disabled={isLocked}
                      className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${isLocked
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : stage.mastered
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/50 hover:bg-amber-500/20'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'
                        }`}
                    >
                      {isLocked ? 'Sigilat' : stage.mastered ? 'Antrenează-te' : 'Începe Misiunea'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- TRAINING GROUNDS (Modes) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id, null, {
                  rangeLimit: defaultRangeLimit,
                  stageId: defaultStageForModes?.id ?? null,
                })}
                className="group relative p-8 rounded-3xl bg-slate-900/40 border border-white/10 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon size={100} />
                </div>

                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="text-indigo-400" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white font-cinzel mb-2">{mode.name}</h3>
                  <p className="text-slate-400">{mode.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {showAbout && (
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-amber-500" size={24} />
              <h3 className="text-2xl font-bold text-white font-cinzel">Despre {pathMeta.title}</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              Aceasta este o unealtă magică de învățare. Folosește puterea AI pentru a crea povești și a adapta dificultatea.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-5">
                <h4 className="text-lg font-bold text-amber-400 mb-3 font-cinzel">Moduri Clasice</h4>
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-2">
                  <li>Antrenament: Exerciții în ordine.</li>
                  <li>Ambuscadă: Exerciții aleatorii.</li>
                </ul>
              </div>
              <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-5">
                <h4 className="text-lg font-bold text-indigo-400 mb-3 font-cinzel">Magie AI</h4>
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-2">
                  <li>Povești generate pe loc.</li>
                  <li>Adaptare dinamică la nivelul tău.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

ModeSelection.propTypes = {
  learningPath: PropTypes.object,
  onExit: PropTypes.func,
  onSelectMode: PropTypes.func,
  gameState: PropTypes.object,
  onShowDashboard: PropTypes.func,
  onExport: PropTypes.func,
  onImport: PropTypes.func,
  onLogout: PropTypes.func,
  onOpenAiSettings: PropTypes.func,
  aiPersonalization: PropTypes.object,
  aiPreviewItem: PropTypes.object,
  aiPlanStatus: PropTypes.object,
  interestDraft: PropTypes.string,
  onInterestDraftChange: PropTypes.func,
  onAddInterest: PropTypes.func,
  onRemoveInterest: PropTypes.func,
  onStartAiPath: PropTypes.func,
  onRefreshPlan: PropTypes.func,
  aiRuntime: PropTypes.object,
  motifJobState: PropTypes.object,
  aiBadgeActive: PropTypes.bool,
  narrationNotice: PropTypes.string,
  stageProgress: PropTypes.array,
  achievementsOpen: PropTypes.bool,
  onOpenAchievements: PropTypes.func,
  onCloseAchievements: PropTypes.func,
  showBadgeCelebration: PropTypes.bool,
  badgeSpotlight: PropTypes.object,
  onDismissBadgeSpotlight: PropTypes.func,
};

export default ModeSelection;
