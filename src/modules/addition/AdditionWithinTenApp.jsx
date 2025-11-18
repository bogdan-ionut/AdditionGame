import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, X, RotateCcw, Star, Trophy, Hash, ArrowLeft, BarChart3, Brain, Sparkles, Flame, Zap } from 'lucide-react';
import ParentDashboard from './components/ParentDashboard.jsx';
import ModeSelection from './components/ModeSelection.jsx';
import CountableObjects from './components/CountableObjects.jsx';
import NumberLine from './components/NumberLine.jsx';
import GuidedCountingAnimation from './components/GuidedCountingAnimation.jsx';
import {
  ensurePersonalization,
  updatePersonalizationAfterAttempt,
  generateLocalPlan,
  deriveMotifsFromInterests,
  TARGET_SUCCESS_BAND,
  normalizeMotifTokens,
} from '../../lib/aiPersonalization';
import { buildThemePacksForInterests, resolveMotifTheme } from '../../lib/interestThemes';
import { requestGeminiPlan, requestInterestMotifs, requestRuntimeContent } from '../../services/aiPlanner';
import { getAiRuntime } from '../../lib/ai/runtime';
import { showToast } from '../../lib/ui/toast';
import Register from '../../Register';
import { useNarrationEngine } from '../../lib/audio/useNarrationEngine';

import {
  resolveActiveLearningPath,
  createDefaultGameState,
  migrateGameState,
  createDefaultMotifJobState,
  dayKey,
  updateSpriteCacheEntryFromUi,
} from './state/gameState';
import {
  resolveMaxUnlockedAddend,
  resolveUnlockedAddendLimit,
  filterItemsWithinAddendLimit,
  findStageById,
  HIGH_ACCURACY_RUN_THRESHOLD,
  HIGH_ACCURACY_RUN_PERCENT,
} from './state/stages';
import { pickReviewDue, scheduleReview } from './state/review';
import {
  sanitizeInterestList,
  buildMasterySnapshot,
  resolveLearnerGrade,
  resolveNarrationLocale,
  extractOperandsFromPlanItem,
  describeSpriteUrl,
  toNumber,
} from './utils/personalization';
import { usePersistentGameState } from './hooks/usePersistentGameState';

const DIFFICULTY_LABELS = {
  easy: 'ușor',
  medium: 'mediu',
  hard: 'dificil',
};

export default function AdditionWithinTenApp({ learningPath, onExit, onOpenAiSettings }) {
  const activeLearningPath = useMemo(
    () => resolveActiveLearningPath(learningPath),
    [learningPath],
  );
  const handleExit = onExit ?? (() => { });

  const { gameState, setGameState, gameStateRef, aiPersonalization, stageProgress } = usePersistentGameState();

  const [gameMode, setGameMode] = useState(null);
  const [focusNumber, setFocusNumber] = useState(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [cards, setCards] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [problemStartTime, setProblemStartTime] = useState(null);
  const [guidedHelp, setGuidedHelp] = useState({ active: false, step: 0, complete: false });
  const [aiRuntime, setAiRuntime] = useState({
    aiEnabled: false,
    serverHasKey: false,
    planningModel: null,
    spriteModel: null,
    audioModel: null,
    aiAllowed: true,
    defaultTtsModel: null,
    allowedTtsModels: [],
    runtimeLabel: null,
  });
  const [aiPlanStatus, setAiPlanStatus] = useState({ loading: false, error: null, source: null });
  const [motifJobState, setMotifJobState] = useState(() => createDefaultMotifJobState());
  const [aiSessionMeta, setAiSessionMeta] = useState(null);
  const [interestDraft, setInterestDraft] = useState('');
  const [activeTheme, setActiveTheme] = useState(null);
  const [rangeLimit, setRangeLimit] = useState(null);
  const [activeStageId, setActiveStageId] = useState(null);
  const [checkpointState, setCheckpointState] = useState({
    active: false,
    reviewCards: [],
    cardsData: {},
    totalAttempts: 0,
    totalCorrect: 0,
    status: 'idle',
  });
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [badgeSpotlight, setBadgeSpotlight] = useState(null);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
  const inputRef = useRef(null);
  const narrationCooldownRef = useRef(0);
  const {
    settings: audioSettings,
    speakText,
    speakProblem,
    speakCountOn,
    speakHint,
    speakMiniLesson,
    speakFeedback,
    playSfx,
    stopNarration,
    narrationNotice,
  } = useNarrationEngine({ runtime: aiRuntime });
  const sessionSolvedRef = useRef(0);
  const streakProgressRef = useRef(0);
  const checkpointStatusRef = useRef('idle');
  const spokenModeRef = useRef(null);
  const stageRunRef = useRef(null);
  const stageRunHistoryRef = useRef({});
  const stageRunInitRef = useRef(false);
  const aiBadgeActive = useMemo(() => Boolean(aiRuntime.aiEnabled), [aiRuntime.aiEnabled]);

  const openSettings = useCallback(() => {
    if (typeof onOpenAiSettings === 'function') {
      onOpenAiSettings();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ai:open-settings'));
    }
  }, [onOpenAiSettings]);

  const learnerName = gameState?.studentInfo?.name?.trim?.() || null;

  const speakProblemDebounced = useCallback(
    (card) => {
      if (!card) return Promise.resolve();
      const now = Date.now();
      if (now - narrationCooldownRef.current < 600) {
        return Promise.resolve();
      }
      narrationCooldownRef.current = now;
      return speakProblem(card, { studentName: learnerName });
    },
    [learnerName, speakProblem],
  );

  const { studentInfo } = gameState;
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
    if (!Array.isArray(stageProgress) || !stageProgress.length) return;
    const newlyMastered = stageProgress.filter((stage) => stage.mastered && !stage.badgeEarned);
    if (!newlyMastered.length) return;
    const awardedAt = Date.now();
    setGameState((prev) => {
      const achievements = {
        ...(prev.achievements || { stageBadges: {} }),
        stageBadges: { ...(prev.achievements?.stageBadges || {}) },
      };
      newlyMastered.forEach((stage) => {
        const current = achievements.stageBadges[stage.id] || {};
        if (!current.badgeEarnedAt) {
          achievements.stageBadges[stage.id] = {
            ...current,
            badgeEarnedAt: awardedAt,
          };
        }
      });
      return { ...prev, achievements };
    });
    const spotlightStage = newlyMastered[0];
    if (!spotlightStage) return;
    if (badgeSpotlight && badgeSpotlight.stageId === spotlightStage.id && !badgeSpotlight.progressOnly) return;
    const playerDisplayName = (studentInfo?.preferredName || studentInfo?.nickname || studentInfo?.name || '')
      .toString()
      .trim();

    setShowBadgeCelebration(true);
    setBadgeSpotlight({
      stageId: spotlightStage.id,
      stageLabel: spotlightStage.label,
      badgeName: spotlightStage.badge?.name || spotlightStage.shortLabel,
      description: spotlightStage.badge?.description,
      gradient: spotlightStage.badge?.gradient,
      accent: spotlightStage.badge?.accent,
      icon: spotlightStage.badge?.icon,
      highAccuracyRuns: spotlightStage.highAccuracyRuns,
      requiredHighAccuracyRuns: spotlightStage.requiredHighAccuracyRuns,
      runThresholdPercent: spotlightStage.highAccuracyRunThreshold || HIGH_ACCURACY_RUN_PERCENT,
      progressOnly: false,
      playerName: playerDisplayName || 'Exploratorule',
    });
    stageRunHistoryRef.current = {
      ...stageRunHistoryRef.current,
      [spotlightStage.id]: {
        runs: spotlightStage.highAccuracyRuns ?? 0,
        badgeEarned: true,
      },
    };
  }, [badgeSpotlight, setGameState, stageProgress, studentInfo]);

  useEffect(() => {
    if (!showBadgeCelebration) return undefined;
    const timeout = setTimeout(() => setShowBadgeCelebration(false), 5000);
    return () => clearTimeout(timeout);
  }, [showBadgeCelebration]);

  const defaultRangeLimit = useMemo(
    () => resolveMaxUnlockedAddend(stageProgress),
    [stageProgress],
  );

  const currentRangeLimit = Number.isFinite(rangeLimit) ? rangeLimit : defaultRangeLimit;

  const activeStage = useMemo(() => {
    if (activeStageId) {
      const stage = findStageById(stageProgress, activeStageId);
      if (stage) return stage;
    }
    if (!stageProgress.length) return null;
    const matching = stageProgress.find((stage) => stage.maxAddend === currentRangeLimit);
    if (matching) return matching;
    const unlocked = stageProgress.filter((stage) => stage.unlocked);
    if (unlocked.length) return unlocked[unlocked.length - 1];
    return stageProgress[0];
  }, [activeStageId, currentRangeLimit, stageProgress]);

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
        defaultTtsModel: null,
        allowedTtsModels: [],
        runtimeLabel: null,
      };
      setAiRuntime(fallback);
      return fallback;
    }
  }, []);

  useEffect(() => {
    refreshAiRuntime();
  }, [refreshAiRuntime]);

  const handleModeSelect = (mode, number = null, options = {}) => {
    const profile = gameStateRef.current?.aiPersonalization?.learnerProfile || {};
    const interests = profile?.interests || [];
    if (mode !== 'ai-path') {
      setActiveTheme(null); // Force dark theme for now
    } else {
      setActiveTheme(null);
    }
    setGameMode(mode);
    setFocusNumber(number);
    if (Number.isFinite(options.rangeLimit)) {
      setRangeLimit(options.rangeLimit);
    } else {
      setRangeLimit(null);
    }
    setActiveStageId(options.stageId ?? null);
    generateCards(mode, number, options.rangeLimit);
  };

  const generateCards = useCallback((mode, number, limit) => {
    const max = limit || 10;
    const newCards = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.floor(Math.random() * (max + 1));
      const b = Math.floor(Math.random() * (max - a + 1));
      newCards.push({ id: i, a, b, answer: a + b });
    }
    setCards(newCards);
    setCurrentCard(0);
    setProblemStartTime(Date.now());
  }, []);

  const resetToMenu = () => {
    stopNarration();
    setFeedback(null);
    setGameMode(null);
    setFocusNumber(null);
    setUserAnswer('');
    setShowCelebration(false);
    setCards([]);
    setGuidedHelp({ active: false, step: 0, complete: false });
    setProblemStartTime(null);
    setAiSessionMeta(null);
    setRangeLimit(null);
    setActiveStageId(null);
    stageRunRef.current = null;
  };

  const checkAnswer = () => {
    if (!cards[currentCard]) return;
    const correct = parseInt(userAnswer, 10) === cards[currentCard].answer;
    setFeedback(correct ? 'correct' : 'incorrect');

    if (correct) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1200);
      setTimeout(() => {
        if (currentCard < cards.length - 1) {
          setCurrentCard(prev => prev + 1);
          setUserAnswer('');
          setFeedback(null);
        } else {
          resetToMenu();
        }
      }, 1200);
    }
  };

  const handleRegister = (info) => {
    setGameState((prev) => ({
      ...prev,
      studentInfo: {
        ...prev.studentInfo,
        ...info,
      },
      aiPersonalization: ensurePersonalization(prev.aiPersonalization, { ...prev.studentInfo, ...info }),
    }));
  };

  const importGameState = (e) => {
    const file = e?.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.version && data.studentInfo && data.statistics && data.masteryTracking) {
            setGameState(migrateGameState(data));
            showToast({ level: 'success', message: 'Progresul a fost importat cu succes!' });
          } else {
            showToast({ level: 'error', message: 'Formatul stării de joc este invalid!' });
          }
        } catch (error) {
          showToast({ level: 'error', message: 'A apărut o eroare la importul progresului!' });
        }
      };
      reader.readAsText(file);
      if (e?.target) {
        e.target.value = '';
      }
    } else {
      showToast({ level: 'error', message: 'Nu am putut citi fișierul selectat.' });
    }
  };

  if (!studentInfo || !studentInfo.name || !studentInfo.gender) {
    return <Register onRegister={handleRegister} onImport={importGameState} />;
  }

  if (showDashboard) {
    return <ParentDashboard gameState={gameState} aiRuntime={aiRuntime} onClose={() => setShowDashboard(false)} />;
  }

  if (!gameMode) {
    return (
      <ModeSelection
        learningPath={activeLearningPath}
        onExit={handleExit}
        onSelectMode={handleModeSelect}
        gameState={gameState}
        onShowDashboard={() => setShowDashboard(true)}
        aiRuntime={aiRuntime}
        stageProgress={stageProgress}
        aiBadgeActive={aiBadgeActive}
      />
    );
  }

  const card = cards[currentCard];

  if (!card) return null;

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center relative z-10">
        <button
          onClick={resetToMenu}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
          <span className="font-cinzel font-bold text-sm">Înapoi</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
            <Trophy className="text-amber-400" size={18} />
            <span className="text-white font-bold font-mono">{gameState.statistics?.totalCorrect || 0}</span>
          </div>
        </div>
      </div>

      {/* ARENA CONTAINER */}
      <div className="relative w-full max-w-3xl">

        {/* Magical Circle / Tablet */}
        <div className="relative bg-slate-900/80 backdrop-blur-xl border-2 border-indigo-500/30 rounded-[3rem] p-8 md:p-12 shadow-[0_0_50px_-10px_rgba(79,70,229,0.3)] overflow-hidden">

          {/* Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-purple-500/5 pointer-events-none" />

          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-2 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${((currentCard) / cards.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-8">

            {/* Equation Display */}
            <div className="flex items-center justify-center gap-4 md:gap-12">
              <div className="flex flex-col items-center gap-4">
                <span className="text-6xl md:text-8xl font-black text-white font-mono drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  {card.a}
                </span>
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/5">
                  <CountableObjects digit={card.a} type={card.a} theme={null} />
                </div>
              </div>

              <PlusSign />

              <div className="flex flex-col items-center gap-4">
                <span className="text-6xl md:text-8xl font-black text-white font-mono drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  {card.b}
                </span>
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/5">
                  <CountableObjects digit={card.b} type={card.b} theme={null} />
                </div>
              </div>

              <EqualsSign />

              {/* Input Area */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  value={userAnswer}
                  onChange={(e) => {
                    setUserAnswer(e.target.value);
                    setFeedback(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                  className={`w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-slate-950 border-4 text-center text-6xl md:text-7xl font-bold text-white outline-none transition-all duration-300 ${feedback === 'correct'
                    ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110'
                    : feedback === 'incorrect'
                      ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-shake'
                      : 'border-indigo-500/50 focus:border-indigo-400 focus:shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                    }`}
                  placeholder="?"
                />
                {feedback === 'correct' && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-emerald-400 font-bold font-cinzel text-xl animate-bounce">
                      Magistral!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={checkAnswer}
                disabled={!userAnswer}
                className={`px-8 py-4 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 ${!userAnswer
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-900/40'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Zap size={20} fill="currentColor" />
                  Lansează Vraja
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-slate-500 font-cinzel text-sm">
        Provocarea {currentCard + 1} din {cards.length}
      </div>

    </div>
  );
}

// Simple visual components
const PlusSign = () => (
  <div className="text-4xl md:text-6xl text-indigo-400 font-black drop-shadow-lg">+</div>
);

const EqualsSign = () => (
  <div className="text-4xl md:text-6xl text-indigo-400 font-black drop-shadow-lg">=</div>
);
