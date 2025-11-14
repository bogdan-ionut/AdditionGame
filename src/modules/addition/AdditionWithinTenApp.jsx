import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, X, RotateCcw, Star, Trophy, Hash, ArrowLeft, BarChart3, Brain } from 'lucide-react';
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
  const handleExit = onExit ?? (() => {});

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
  }, [badgeSpotlight, setGameState, stageProgress]);

  useEffect(() => {
    if (!showBadgeCelebration) return undefined;
    const timeout = setTimeout(() => setShowBadgeCelebration(false), 5000);
    return () => clearTimeout(timeout);
  }, [showBadgeCelebration]);

  useEffect(() => {
    if (!Array.isArray(stageProgress) || !stageProgress.length) {
      return;
    }

    if (!stageRunInitRef.current) {
      const initial = {};
      stageProgress.forEach((stage) => {
        initial[stage.id] = {
          runs: Number.isFinite(stage.highAccuracyRuns) ? stage.highAccuracyRuns : 0,
          badgeEarned: Boolean(stage.badgeEarned),
        };
      });
      stageRunHistoryRef.current = initial;
      stageRunInitRef.current = true;
      return;
    }

    let progressSpotlight = null;
    const history = { ...stageRunHistoryRef.current };

    stageProgress.forEach((stage) => {
      const currentRuns = Number.isFinite(stage.highAccuracyRuns) ? stage.highAccuracyRuns : 0;
      const previous = history[stage.id] || { runs: 0, badgeEarned: false };
      history[stage.id] = {
        runs: currentRuns,
        badgeEarned: Boolean(stage.badgeEarned),
      };

      if (stage.mastered) {
        return;
      }

      if (currentRuns > previous.runs) {
        const targetRuns = Number.isFinite(stage.requiredHighAccuracyRuns)
          ? stage.requiredHighAccuracyRuns
          : Number.isFinite(stage.requiredPerfectRuns)
            ? stage.requiredPerfectRuns
            : 0;
        const playerDisplayName = (studentInfo?.preferredName || studentInfo?.nickname || studentInfo?.name || '')
          .toString()
          .trim();

        progressSpotlight = {
          stageId: stage.id,
          stageLabel: stage.label,
          badgeName: stage.badge?.name || stage.shortLabel,
          description: stage.badge?.description,
          gradient: stage.badge?.gradient,
          accent: stage.badge?.accent,
          icon: stage.badge?.icon,
          highAccuracyRuns: currentRuns,
          requiredHighAccuracyRuns: targetRuns,
          runThresholdPercent: stage.highAccuracyRunThreshold || HIGH_ACCURACY_RUN_PERCENT,
          progressOnly: true,
          playerName: playerDisplayName || 'Exploratorule',
        };
      }
    });

    stageRunHistoryRef.current = history;

    if (progressSpotlight && !badgeSpotlight) {
      setShowBadgeCelebration(true);
      setBadgeSpotlight(progressSpotlight);
    }
  }, [badgeSpotlight, stageProgress]);

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

  useEffect(() => () => {
    stopNarration();
  }, [stopNarration]);

  const refreshInterestMotifs = useCallback(
    async (rawInterests) => {
      if (!Array.isArray(rawInterests)) return;

      const interests = rawInterests
        .map((interest) => (typeof interest === 'string' ? interest.trim() : ''))
        .filter(Boolean);

      const clearMotifs = () => {
        const now = Date.now();
        const resetState = { ...createDefaultMotifJobState(), lastUpdated: now };
        setGameState((prev) => {
          const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
          if (!ai.learnerProfile.interestMotifs?.length && !ai.learnerProfile.motifSprites?.length) {
            return prev;
          }
          return {
            ...prev,
            aiPersonalization: {
              ...ai,
              learnerProfile: {
                ...ai.learnerProfile,
                interestMotifs: [],
                motifSprites: [],
                motifsUpdatedAt: now,
                motifSpritesUpdatedAt: now,
                motifSpriteCacheKey: null,
                motifJob: null,
              },
            },
          };
        });
        setMotifJobState(resetState);
      };

      if (interests.length === 0) {
        clearMotifs();
        return;
      }

      const fallbackTokens = deriveMotifsFromInterests(interests);
      const applyFallback = (errorMessage = null) => {
        const now = Date.now();
        setGameState((prev) => {
          const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
          return {
            ...prev,
            aiPersonalization: {
              ...ai,
              learnerProfile: {
                ...ai.learnerProfile,
                interestMotifs: fallbackTokens,
                motifSprites: [],
                motifsUpdatedAt: now,
                motifSpritesUpdatedAt: now,
                motifSpriteCacheKey: null,
                motifJob: null,
              },
            },
          };
        });
        setMotifJobState({
          ...createDefaultMotifJobState(),
          loading: false,
          error: errorMessage,
          done: fallbackTokens.length,
          pending: 0,
          lastUpdated: now,
        });
      };

      if (!aiRuntime.aiEnabled || !aiRuntime.spriteModel) {
        applyFallback(null);
        return;
      }

      setMotifJobState({
        ...createDefaultMotifJobState(),
        loading: true,
        lastUpdated: Date.now(),
      });

      try {
        const result = await requestInterestMotifs(interests, aiRuntime.spriteModel, {
          aiEnabled: aiRuntime.aiEnabled,
          timeoutMs: 16000,
          pollIntervalMs: 2000,
          batchLimit: 1,
        });

        const resolvedAt = Date.now();
        const spriteUrls = Array.isArray(result?.urls)
          ? result.urls.filter((url) => typeof url === 'string' && url.trim())
          : [];
        const fallbackMotifs = Array.isArray(result?.motifs) && result.motifs.length
          ? result.motifs
          : fallbackTokens;
        const cacheKey = result?.cacheKey || null;
        const pending = Number.isFinite(result?.pending) ? Math.max(0, result.pending) : 0;
        const done = Number.isFinite(result?.done) ? Math.max(0, result.done) : spriteUrls.length;

        setGameState((prev) => {
          const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
          return {
            ...prev,
            aiPersonalization: {
              ...ai,
              learnerProfile: {
                ...ai.learnerProfile,
                interestMotifs: fallbackMotifs,
                motifsUpdatedAt: resolvedAt,
                motifSprites: spriteUrls,
                motifSpritesUpdatedAt: resolvedAt,
                motifSpriteCacheKey: cacheKey,
                motifJob: {
                  jobId: null,
                  pending,
                  done,
                  lastUpdated: resolvedAt,
                  nextRetryAt: null,
                  cacheKey,
                },
              },
            },
          };
        });

        setMotifJobState({
          jobId: null,
          loading: false,
          error: result?.source === 'fallback' && !spriteUrls.length ? 'AI motifs unavailable' : null,
          done,
          pending,
          lastUpdated: resolvedAt,
          nextRetryAt: null,
          rateLimited: false,
          cacheKey,
        });

        if (cacheKey) {
          updateSpriteCacheEntryFromUi(cacheKey, () => ({
            urls: spriteUrls,
            jobId: null,
            pending,
            done,
          }));
        }
      } catch (error) {
        console.warn('Interest motif request failed, using fallback motifs.', error);
        const message = error instanceof Error ? error.message : String(error);
        applyFallback(message);
      }
    },
    [aiRuntime.aiEnabled, aiRuntime.spriteModel, setGameState],
  );

  const collectMotifHintsForProfile = useCallback((profile) => {
    if (!profile || typeof profile !== 'object') return [];
    const spriteHints = Array.isArray(profile.motifSprites)
      ? profile.motifSprites
          .filter((url) => typeof url === 'string' && url.trim())
          .map((url) => ({ url, label: describeSpriteUrl(url) }))
      : [];
    const baseMotifs = Array.isArray(profile.interestMotifs) ? profile.interestMotifs : [];
    return [...spriteHints, ...baseMotifs];
  }, []);

  const ensureAiPlan = useCallback(async (force = false) => {
    const current = gameStateRef.current;
    const ai = ensurePersonalization(current.aiPersonalization, current.studentInfo);
    if (!force && (ai.planQueue?.length || 0) >= 8) {
      return { reused: true, appended: [] };
    }

    const unlockedAddendLimit = resolveUnlockedAddendLimit(current.masteryTracking || {});
    const enforceAddendLimit = (items) => filterItemsWithinAddendLimit(items, unlockedAddendLimit);

    setAiPlanStatus((prev) => ({ ...prev, loading: true, error: null, source: aiRuntime.aiEnabled ? aiRuntime.planningModel : 'local planner' }));
    let resolvedSource = aiRuntime.aiEnabled ? aiRuntime.planningModel || 'gemini-planner' : 'local planner';

    const weakFamilies = Object.entries(ai.mastery || {})
      .map(([key, node]) => ({ key, sum: Number(key.replace('sum=', '')), predicted: node?.alpha ? node.alpha / (node.alpha + node.beta) : TARGET_SUCCESS_BAND.midpoint }))
      .sort((a, b) => a.predicted - b.predicted)
      .slice(0, 3)
      .map((entry) => `sum=${entry.sum}`);

    const motifHints = normalizeMotifTokens(collectMotifHintsForProfile(ai.learnerProfile));
    const interestList = sanitizeInterestList(ai.learnerProfile.interests || []);
    const masterySnapshot = buildMasterySnapshot(ai.mastery || {});
    const successTarget = ai.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint;
    const runtimeTtsModel = aiRuntime.audioModel || aiRuntime.defaultTtsModel || '';
    const planRequest = {
      userId: ai.learnerProfile.learnerId || (current.studentInfo?.name || 'elev'),
      grade: resolveLearnerGrade(current.studentInfo),
      interests: interestList,
      mastery: masterySnapshot,
      target: {
        successRate: successTarget,
        minutes: 10,
      },
      context: {
        weakFamilies,
        motifs: motifHints,
        needItems: 10,
        learnerName: current.studentInfo?.name || 'Elev',
      },
    };
    const modelsPayload = {};
    if (aiRuntime.planningModel) modelsPayload.planner = aiRuntime.planningModel;
    if (aiRuntime.spriteModel) modelsPayload.sprite = aiRuntime.spriteModel;
    if (runtimeTtsModel) modelsPayload.tts = runtimeTtsModel;
    if (Object.keys(modelsPayload).length) {
      planRequest.models = modelsPayload;
    }
    if (!Object.keys(planRequest.mastery || {}).length) {
      delete planRequest.mastery;
    }

    if (aiRuntime.aiEnabled && aiRuntime.planningModel) {
      try {
        const remotePlan = await requestGeminiPlan(planRequest, {
          plannerModel: aiRuntime.planningModel,
          spriteModel: aiRuntime.spriteModel || undefined,
          audioModel: runtimeTtsModel || undefined,
        });
        if (remotePlan && Array.isArray(remotePlan.items) && remotePlan.items.length) {
          const planSource = remotePlan.source || remotePlan.items[0]?.source || aiRuntime.planningModel;
          resolvedSource = planSource;
          let planStory = remotePlan.microStory || remotePlan.story || '';
          if (!planStory) {
            try {
              const runtimePayload = {
                kind: 'narration',
                locale: resolveNarrationLocale(audioSettings.narrationLanguage),
                seed: Date.now() % 1_000_000,
                context: {
                  userId: planRequest.userId,
                  grade: planRequest.grade,
                  interests: planRequest.interests,
                  motifs: motifHints,
                  weakFamilies,
                  target: planRequest.target,
                  planId: remotePlan.planId || null,
                  items: remotePlan.items.slice(0, 10).map((item, index) => {
                    const { a, b } = extractOperandsFromPlanItem(item);
                    return {
                      index,
                      a,
                      b,
                      display:
                        item.display ||
                        item.prompt ||
                        item.expression ||
                        (a != null && b != null ? `${a} + ${b}` : `Problem ${index + 1}`),
                    };
                  }),
                },
              };
              const runtimeResult = await requestRuntimeContent(runtimePayload);
              if (runtimeResult?.text) {
                planStory = runtimeResult.text;
              }
            } catch (runtimeError) {
              console.warn('Runtime narration request failed', runtimeError);
            }
          }
          const planIdBase = remotePlan.planId || `gemini-${Date.now()}`;
          const normalized = remotePlan.items.map((item, index) => {
            const { a, b } = extractOperandsFromPlanItem(item);
            const fallbackTarget = planRequest.target.successRate;
            const predicted =
              toNumber(item.predictedSuccess) ??
              toNumber(item.successRate) ??
              toNumber(item.difficulty) ??
              fallbackTarget;
            const hintsArray = Array.isArray(item.hints)
              ? item.hints
              : Array.isArray(item.scaffolds)
                ? item.scaffolds
                : [];
            const answerValue =
              toNumber(item.answer) ??
              toNumber(item.result) ??
              (a != null && b != null ? a + b : null);
            const planId = item.planId || item.plan_id || planIdBase;
            return {
              id: item.itemId || item.id || `${planId}-${index}`,
              a: a ?? 0,
              b: b ?? 0,
              answer: answerValue ?? ((a ?? 0) + (b ?? 0)),
              display:
                item.display ||
                item.prompt ||
                item.expression ||
                (a != null && b != null ? `${a} + ${b}` : `Problem ${index + 1}`),
              predictedSuccess: typeof predicted === 'number' ? predicted : fallbackTarget,
              difficulty: typeof predicted === 'number' ? predicted : fallbackTarget,
              hints: hintsArray.filter((hint) => typeof hint === 'string' && hint.trim()),
              praise: typeof item.praise === 'string' ? item.praise : '',
              microStory: planStory || remotePlan.microStory || remotePlan.story || '',
              source: planSource,
              planId,
            };
          });

          const limitedNormalized = enforceAddendLimit(normalized);
          const sanitizedRemotePlan = {
            ...remotePlan,
            items: limitedNormalized,
            microStory: planStory || remotePlan.microStory || remotePlan.story || '',
          };

          setGameState((prev) => {
            const aiPrev = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
            return {
              ...prev,
              aiPersonalization: {
                ...aiPrev,
                planQueue: [...(aiPrev.planQueue || []), ...limitedNormalized],
                lastPlan: {
                  id: limitedNormalized[0]?.planId,
                  generatedAt: Date.now(),
                  source: limitedNormalized[0]?.source,
                  microStory: limitedNormalized[0]?.microStory || planStory || '',
                  itemCount: limitedNormalized.length,
                  metadata: sanitizedRemotePlan.metadata || sanitizedRemotePlan.meta || sanitizedRemotePlan._meta || null,
                },
              },
            };
          });

          setAiPlanStatus({ loading: false, error: null, source: planSource });
          return { reused: false, appended: limitedNormalized, plan: sanitizedRemotePlan };
        }
      } catch (error) {
        console.warn('Gemini planning failed, falling back to local planner.', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gemini planning failed.';
        setAiPlanStatus((prev) => ({ ...prev, error: message }));
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

    const limitedFallbackItems = enforceAddendLimit(fallbackPlan.items);
    const sanitizedFallbackPlan = {
      ...fallbackPlan,
      items: limitedFallbackItems,
    };

    setGameState((prev) => {
      const aiPrev = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
      return {
        ...prev,
        aiPersonalization: {
          ...aiPrev,
          planQueue: [...(aiPrev.planQueue || []), ...limitedFallbackItems],
          lastPlan: {
            id: sanitizedFallbackPlan.planId,
            generatedAt: sanitizedFallbackPlan.generatedAt,
            source: sanitizedFallbackPlan.source,
            microStory: sanitizedFallbackPlan.story || sanitizedFallbackPlan.microStory || '',
            itemCount: limitedFallbackItems.length,
            metadata: sanitizedFallbackPlan.metadata || null,
          },
        },
      };
    });

    setAiPlanStatus({ loading: false, error: null, source: resolvedSource || 'local planner' });
    return { reused: false, appended: limitedFallbackItems, plan: sanitizedFallbackPlan };
  }, [
    aiRuntime.aiEnabled,
    aiRuntime.planningModel,
    aiRuntime.spriteModel,
    aiRuntime.audioModel,
    aiRuntime.defaultTtsModel,
    audioSettings.narrationLanguage,
    collectMotifHintsForProfile,
    gameStateRef,
    setAiPlanStatus,
    setGameState,
  ]);

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
    const currentState = gameStateRef.current;
    const unlockedAddendLimit = resolveUnlockedAddendLimit(currentState.masteryTracking || {});
    const ai = ensurePersonalization(currentState.aiPersonalization, currentState.studentInfo);
    const combined = [...(ai.planQueue || [])];
    if (planResult?.appended?.length) {
      combined.push(...planResult.appended);
    }

    const filteredCandidates = filterItemsWithinAddendLimit(combined, unlockedAddendLimit);
    const sessionItems = filteredCandidates.slice(0, Math.min(targetDeckSize, filteredCandidates.length));
    const remaining = filteredCandidates.slice(sessionItems.length);
    const hadOutOfRange = combined.length > filteredCandidates.length;

    if (!sessionItems.length) {
      if (hadOutOfRange) {
        showToast({ level: 'info', message: 'Planul AI e peste nivelul curent. Continuăm cu exerciții potrivite nivelului tău.' });
        setGameState((prev) => {
          const aiPrev = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
          return {
            ...prev,
            aiPersonalization: {
              ...aiPrev,
              planQueue: remaining,
            },
          };
        });
      } else {
        showToast({ level: 'info', message: 'Avem nevoie de mai multe date înainte să pornim traseul AI. Mai parcurge câteva runde de exerciții.' });
      }
      return;
    }

    setGameState((prev) => {
      const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
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

    setCards(
      sessionItems.map((item) => {
        const resolvedA = toNumber(item.a);
        const resolvedB = toNumber(item.b);
        const resolvedAnswer = toNumber(item.answer);
        return {
          a: resolvedA ?? item.a,
          b: resolvedB ?? item.b,
          answer: resolvedAnswer ?? ((resolvedA ?? 0) + (resolvedB ?? 0)),
          aiPlanItem: item,
        };
      }),
    );
    setRangeLimit(null);
    setActiveStageId(null);
    setGameMode('ai-path');
    setCurrentCard(0);
    setUserAnswer('');
    setFeedback(null);
    setShowHint(false);
    setGuidedHelp({ active: false, step: 0, complete: false });
  }, [
    aiRuntime.aiEnabled,
    aiRuntime.planningModel,
    ensureAiPlan,
    gameStateRef,
    setAiSessionMeta,
    setCards,
    setRangeLimit,
    setActiveStageId,
    setGameMode,
    setCurrentCard,
    setUserAnswer,
    setFeedback,
    setShowHint,
    setGuidedHelp,
    setGameState,
  ]);

  const loadStoredGameState = useCallback((key) => {
    if (!key || typeof window === 'undefined') {
      return { state: null, error: null };
    }

    try {
      const storage = window.localStorage;
      const rawState = storage.getItem(key);

      if (!rawState) {
        return { state: null, error: null };
      }

      try {
        return { state: migrateGameState(JSON.parse(rawState)), error: null };
      } catch (parseError) {
        console.error('Failed to parse stored addition game state', parseError);
        try {
          storage.removeItem(key);
        } catch (removeError) {
          console.error('Failed to remove corrupt addition game state', removeError);
        }
        return { state: null, error: parseError };
      }
    } catch (storageError) {
      console.error('Failed to access localStorage for addition game state', storageError);
      return { state: null, error: storageError };
    }
  }, []);

  const handleRegister = (userInfo) => {
    const userKey = `additionFlashcardsGameState_${userInfo.name}`;
    const { state: storedState, error } = loadStoredGameState(userKey);

    if (storedState) {
      setGameState(storedState);
      return;
    }

    if (error) {
      showToast({
        level: 'warning',
        message: 'Nu am putut accesa progresul salvat (mod privat sau date corupte). Am pornit un joc nou.',
      });
    }

    const newGameState = createDefaultGameState();
    setGameState({
      ...newGameState,
      studentInfo: {
        ...newGameState.studentInfo,
        ...userInfo,
        startDate: new Date().toISOString(),
      },
    });
  };

  const handleLogout = () => {
    if (window.confirm('Do you want to save your progress before logging out?')) {
      exportGameState();
    }
    setAchievementsOpen(false);
    setBadgeSpotlight(null);
    setShowBadgeCelebration(false);
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

    const defaultLimit = resolveUnlockedAddendLimit(
      currentState.masteryTracking || {},
      currentState.achievements?.stageBadges || {},
    );
    const activeLimit = Number.isFinite(rangeLimit) ? rangeLimit : defaultLimit;
    const limit = Math.max(0, Math.min(9, activeLimit));

    const filteredReviewCards = reviewCards.filter(({ a, b }) => a <= limit && b <= limit);
    let newCards = [];

    if (gameMode === 'sequential' || (gameMode && gameMode.startsWith('stage-'))) {
      for (let a = 0; a <= limit; a++) {
        for (let b = 0; b <= limit; b++) {
          newCards.push({ a, b, answer: a + b });
        }
      }
      if (gameMode && gameMode.startsWith('stage-')) {
        for (let i = newCards.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
        }
      }
    } else if (gameMode === 'random') {
      for (let a = 0; a <= limit; a++) {
        for (let b = 0; b <= limit; b++) {
          newCards.push({ a, b, answer: a + b });
        }
      }
      for (let i = newCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
      }
    } else if (gameMode?.startsWith('focus-')) {
      const partnerLimit = Math.min(9, Math.max(limit, focusNumber ?? 0));
      for (let i = 0; i <= partnerLimit; i++) {
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

    const generatedDeck = [...filteredReviewCards, ...newCards];

    setCards(generatedDeck);
    if (gameMode && gameMode.startsWith('stage-')) {
      const stageId = gameMode.slice('stage-'.length);
      stageRunRef.current = { stageId, attempts: 0, correct: 0 };
    } else {
      stageRunRef.current = null;
    }
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
  }, [
    gameMode,
    focusNumber,
    rangeLimit,
    gameStateRef,
    setCards,
    setCheckpointState,
    setCurrentCard,
    setGameState,
    setGuidedHelp,
  ]);

  useEffect(() => {
    if (gameMode) {
      generateCards();
    }
  }, [gameMode, generateCards]);

  useEffect(() => {
    if (!gameMode) {
      spokenModeRef.current = null;
      return;
    }
    if (!audioSettings.narrationEnabled) return;
    if (spokenModeRef.current === gameMode) return;
    spokenModeRef.current = gameMode;
    const lang = audioSettings.narrationLanguage?.toLowerCase?.() || 'ro-ro';
    const isRomanian = lang.startsWith('ro');
    let intro = '';
    if (gameMode === 'ai-path') {
      intro = isRomanian
        ? 'Am pregătit o aventură adaptată special pentru tine. Ascultă indiciile și răspunde cu voce tare!'
        : 'Am pregătit o aventură adaptată special pentru tine. Ascultă indiciile și răspunde cu voce tare!';
    } else if (gameMode === 'random') {
      intro = isRomanian
        ? 'Începem o sesiune cu exerciții surpriză. Spune rezultatul și mergem mai departe!'
        : 'Începem o sesiune cu exerciții surpriză. Spune rezultatul și mergem mai departe!';
    } else if (gameMode === 'sequential') {
      intro = isRomanian
        ? 'Vom parcurge toate adunările pe rând. Respira adânc și spune răspunsul corect!'
        : 'Vom parcurge toate adunările pe rând. Respira adânc și spune răspunsul corect!';
    } else if (gameMode.startsWith('stage-')) {
      const stageLabel = activeStage?.label || `adunări până la +${currentRangeLimit}`;
      intro = isRomanian
        ? `Exersăm ${stageLabel.toLowerCase()}. Rămâi atent și menține acuratețea peste 90%.`
        : `Exersăm ${stageLabel.toLowerCase()}. Rămâi atent și menține acuratețea peste 90%.`;
    } else if (gameMode.startsWith('focus-') && Number.isFinite(focusNumber)) {
      intro = isRomanian
        ? `Ne concentrăm pe adunări cu ${focusNumber}. Imaginează-ți ${focusNumber} obiecte și adaugă restul.`
        : `Ne concentrăm pe adunări cu ${focusNumber}. Imaginează-ți ${focusNumber} obiecte și adaugă restul.`;
    } else {
      intro = isRomanian
        ? 'Hai să rezolvăm probleme de adunare! Eu te ghidez pas cu pas.'
        : 'Hai să rezolvăm probleme de adunare! Eu te ghidez pas cu pas.';
    }
    speakText({ text: intro, type: 'custom', speakingRate: audioSettings.speakingRate * 0.95 }).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('Unable to narrate mode intro', error);
      }
    });
  }, [
    activeStage?.label,
    audioSettings.narrationEnabled,
    audioSettings.narrationLanguage,
    audioSettings.speakingRate,
    currentRangeLimit,
    focusNumber,
    gameMode,
    speakText,
  ]);

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
      setShowHint(false);
      setGuidedHelp({ active: false, step: 0, complete: false });
      // Focus the input when card changes
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentCard, cards]);

  useEffect(() => {
    if (!audioSettings.narrationEnabled || !audioSettings.narrationAutoplay) return;
    if (!gameMode) return;
    const card = cards[currentCard];
    if (!card) return;
    speakProblemDebounced(card).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('Unable to narrate problem prompt', error);
      }
    });
  }, [
    audioSettings.narrationAutoplay,
    audioSettings.narrationEnabled,
    cards,
    currentCard,
    gameMode,
    speakProblemDebounced,
  ]);

  useEffect(() => {
    if (!audioSettings.narrationEnabled) return;
    if (!showHint) return;
    const card = cards[currentCard];
    if (!card) return;
    const languageKey = (audioSettings.narrationLanguage || 'ro-RO').split('-')[0]?.toLowerCase?.() || 'ro';
    const aiHints = card.aiPlanItem?.hints?.length ? card.aiPlanItem.hints.slice(0, 2) : [];
    const hasAiHints = aiHints.length > 0;
    const fallbackHint = hasAiHints
      ? null
      : languageKey === 'ro'
        ? `Hai să numărăm împreună. Începem de la ${card.a} și mai adăugăm ${card.b} pași.`
        : `Hai să numărăm împreună. Începem de la ${card.a} și mai adăugăm ${card.b} pași.`;
    const hintText = hasAiHints ? aiHints.join(' ') : fallbackHint;

    let cancelled = false;
    const run = async () => {
      try {
        if (hintText) {
          await speakHint(hintText);
        }
        if (!cancelled && !hasAiHints) {
          await speakCountOn(card, { includeFinal: false, mode: 'hint' });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Unable to narrate hint', error);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    audioSettings.narrationEnabled,
    audioSettings.narrationLanguage,
    cards,
    currentCard,
    showHint,
    speakHint,
    speakCountOn,
  ]);

  // drive the guided counting animation once it is active
  useEffect(() => {
    if (!guidedHelp.active || guidedHelp.complete) return;
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

  useEffect(() => {
    if (!audioSettings.narrationEnabled) return;
    if (!guidedHelp.active) return;
    if (showHint) return;
    speakMiniLesson('count-on').catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('Unable to narrate mini-lesson', error);
      }
    });
  }, [audioSettings.narrationEnabled, guidedHelp.active, showHint, speakMiniLesson]);

  useEffect(() => {
    const solved = gameState.sessionData?.currentSession?.problemsSolved ?? 0;
    const previous = sessionSolvedRef.current;
    if (solved > previous) {
      if (solved % 5 === 0) {
        playSfx('progress');
        if (audioSettings.narrationEnabled) {
          const lang = audioSettings.narrationLanguage?.toLowerCase?.() || 'ro-ro';
          const isRomanian = lang.startsWith('ro');
          const message = isRomanian
            ? `Bravo! Ai rezolvat ${solved} exerciții până acum. Hai să continuăm!`
        : `Bravo! Ai rezolvat ${solved} exerciții până acum. Hai să continuăm!`;
          speakText({ text: message, type: 'praise' }).catch((error) => {
            if (import.meta.env.DEV) {
              console.warn('Unable to narrate milestone praise', error);
            }
          });
        }
      }
      sessionSolvedRef.current = solved;
    } else if (solved < previous) {
      sessionSolvedRef.current = solved;
    }
  }, [audioSettings.narrationEnabled, audioSettings.narrationLanguage, gameState.sessionData?.currentSession?.problemsSolved, playSfx, speakText]);

  useEffect(() => {
    const streak = gameState.adaptiveLearning?.consecutiveCorrect ?? 0;
    const previous = streakProgressRef.current;
    if (streak > previous) {
      if (streak > 0 && streak % 5 === 0) {
        playSfx('progress');
        if (audioSettings.narrationEnabled) {
          const lang = audioSettings.narrationLanguage?.toLowerCase?.() || 'ro-ro';
          const isRomanian = lang.startsWith('ro');
          const message = isRomanian
            ? `Streak de ${streak} răspunsuri corecte! Sunt foarte mândru de tine.`
        : `Uau! ${streak} răspunsuri corecte la rând. Sunt foarte mândru de tine!`;
          speakText({ text: message, type: 'praise' }).catch((error) => {
            if (import.meta.env.DEV) {
              console.warn('Unable to narrate streak celebration', error);
            }
          });
        }
      }
      streakProgressRef.current = streak;
    } else if (streak < previous) {
      streakProgressRef.current = streak;
    }
  }, [audioSettings.narrationEnabled, audioSettings.narrationLanguage, gameState.adaptiveLearning?.consecutiveCorrect, playSfx, speakText]);

  useEffect(() => {
    const status = checkpointState.status || 'idle';
    const previous = checkpointStatusRef.current;
    if (status === previous) return;
    checkpointStatusRef.current = status;
    const lang = audioSettings.narrationLanguage?.toLowerCase?.() || 'ro-ro';
    const isRomanian = lang.startsWith('ro');
    if (status === 'passed') {
      playSfx('progress');
      if (audioSettings.narrationEnabled) {
        const message = isRomanian
          ? 'Ai depășit checkpoint-ul! Felicitări pentru concentrare și răbdare.'
          : 'Ai depășit checkpoint-ul! Felicitări pentru concentrare și răbdare!';
        speakText({ text: message, type: 'praise' }).catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('Unable to narrate checkpoint success', error);
          }
        });
      }
    } else if (status === 'failed') {
      playSfx('error');
      if (audioSettings.narrationEnabled) {
        const message = isRomanian
          ? 'Nu-i nimic, luăm o mică pauză și mai încercăm. Știu că vei reuși!'
          : 'Nu-i nimic, luăm o mică pauză și mai încercăm. Știu că vei reuși!';
        speakText({ text: message, type: 'encouragement' }).catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('Unable to narrate checkpoint encouragement', error);
          }
        });
      }
    }
  }, [audioSettings.narrationEnabled, audioSettings.narrationLanguage, checkpointState.status, playSfx, speakText]);

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
  }, [
    cards,
    checkpointState.cardsData,
    checkpointState.reviewCards,
    checkpointState.status,
    setCards,
    setCheckpointState,
    setCurrentCard,
    setFeedback,
    setGameState,
    setGuidedHelp,
    setShowHint,
    setUserAnswer,
  ]);

  useEffect(() => {
    if (!feedback) return;
    if (!gameMode) return;
    const card = cards[currentCard];
    if (!card) return;
    if (feedback === 'correct') {
      playSfx('success');
      speakFeedback(true).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Unable to narrate positive feedback', error);
        }
      });
    } else if (feedback === 'incorrect') {
      playSfx('error');
      speakFeedback(false).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Unable to narrate encouragement', error);
        }
      });
    }
  }, [cards, currentCard, feedback, gameMode, playSfx, speakFeedback]);

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

      if (gameMode && gameMode.startsWith('stage-')) {
        const stageId = gameMode.slice('stage-'.length);
        const currentRun =
          stageRunRef.current && stageRunRef.current.stageId === stageId
            ? stageRunRef.current
            : { stageId, attempts: 0, correct: 0 };
        currentRun.attempts += 1;
        if (correct) currentRun.correct += 1;
        stageRunRef.current = currentRun;
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

  const handleModeSelect = (mode, number = null, options = {}) => {
    const profile = gameStateRef.current?.aiPersonalization?.learnerProfile || {};
    const interests = profile?.interests || [];
    const motifs = collectMotifHintsForProfile(profile);
    if (mode !== 'ai-path') {
      const themePacks = buildThemePacksForInterests(interests, { motifHints: motifs });
      const theme = resolveMotifTheme({ themePacks });
      setActiveTheme(theme);
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
  };

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

  const checkAnswer = () => {
    if (!cards[currentCard]) return;

    const timeSpent = problemStartTime ? Date.now() - problemStartTime : 0;
    const correct = parseInt(userAnswer, 10) === cards[currentCard].answer;

    setFeedback(correct ? 'correct' : 'incorrect');

    recordProblemAttempt(cards[currentCard], correct, timeSpent);

    const stageModeActive = gameMode && gameMode.startsWith('stage-');
    const stageId = stageModeActive ? gameMode.slice('stage-'.length) : null;
    const isLastCard = currentCard >= cards.length - 1;

    if (stageId && correct && isLastCard) {
      const runSnapshot =
        stageRunRef.current && stageRunRef.current.stageId === stageId
          ? stageRunRef.current
          : { stageId, attempts: 0, correct: 0 };
      const attempts = Math.max(0, runSnapshot.attempts || 0);
      const correctAttempts = Math.max(0, runSnapshot.correct || 0);
      const accuracy = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 0;
      const perfect = attempts > 0 && correctAttempts === attempts;
      const highAccuracy = attempts > 0 && (correctAttempts / attempts) >= HIGH_ACCURACY_RUN_THRESHOLD;
      const timestamp = Date.now();
      const parseNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      if (attempts > 0) {
        setGameState((prev) => {
          const achievements = {
            ...(prev.achievements || { stageBadges: {} }),
            stageBadges: { ...(prev.achievements?.stageBadges || {}) },
          };
          const prevEntry = achievements.stageBadges[stageId] || {};
          const prevPerfectRuns = parseNumber(prevEntry.perfectRuns);
          const prevHighAccuracyRuns = prevEntry.highAccuracyRuns != null
            ? parseNumber(prevEntry.highAccuracyRuns)
            : prevPerfectRuns;
          const nextPerfectRuns = perfect ? prevPerfectRuns + 1 : prevPerfectRuns;
          const nextHighAccuracyRuns = highAccuracy ? prevHighAccuracyRuns + 1 : prevHighAccuracyRuns;
          const nextAttempts = parseNumber(prevEntry.attempts) + 1;
          const nextBest = Math.max(parseNumber(prevEntry.bestAccuracy), accuracy);
          achievements.stageBadges[stageId] = {
            ...prevEntry,
            attempts: nextAttempts,
            lastAccuracy: accuracy,
            bestAccuracy: nextBest,
            perfectRuns: nextPerfectRuns,
            highAccuracyRuns: nextHighAccuracyRuns,
            lastRunAt: timestamp,
            ...(perfect ? { lastPerfectAt: timestamp } : {}),
            ...(highAccuracy ? { lastHighAccuracyAt: timestamp } : {}),
          };
          return { ...prev, achievements };
        });
      }

      stageRunRef.current = null;
    }

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
      setGuidedHelp({ active: false, step: 0, complete: false });
      return;
    }

    if (currentCard < cards.length - 1) {
      setCurrentCard(prev => prev + 1);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
      setGuidedHelp({ active: false, step: 0, complete: false });
    }
  };

  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prev => prev - 1);
      setUserAnswer('');
      setFeedback(null);
      setShowHint(false);
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

  const showSetupReminder = Boolean(aiRuntime.lastError);
  const setupReminderMessage = aiRuntime.lastError;

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
        onExit={() => {
          setFeedback(null);
          stopNarration();
          handleExit();
        }}
        onSelectMode={handleModeSelect}
        gameState={gameState}
        onShowDashboard={() => {
          setFeedback(null);
          setShowDashboard(true);
        }}
        onExport={exportGameState}
        onImport={importGameState}
        onLogout={handleLogout}
        onOpenAiSettings={openSettings}
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
        motifJobState={motifJobState}
        aiBadgeActive={aiBadgeActive}
        narrationNotice={narrationNotice}
        stageProgress={stageProgress}
        achievementsOpen={achievementsOpen}
        onOpenAchievements={() => setAchievementsOpen(true)}
        onCloseAchievements={() => setAchievementsOpen(false)}
        showBadgeCelebration={showBadgeCelebration}
        badgeSpotlight={badgeSpotlight}
        onDismissBadgeSpotlight={() => setBadgeSpotlight(null)}
      />
    );
  }

  const card = cards[currentCard];

  if (!card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl shadow-xl p-10 max-w-md">
          <div className="text-3xl font-bold text-gray-800 mb-2">Totul este bifat! 🎉</div>
            <p className="text-gray-600 mb-6">Ai terminat toate cardurile de checkpoint. Alege următoarea aventură sau repetă acest mod.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetToMenu}
              className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Înapoi la selectarea modurilor
            </button>
            <button
              onClick={generateCards}
              className="px-5 py-3 rounded-xl bg-white border-2 border-blue-300 text-blue-700 font-semibold hover:bg-blue-50 transition"
            >
              Reia exercițiile
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
        {showSetupReminder && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              {setupReminderMessage || 'Configurează cheia Gemini în setările AI pentru a activa vocea și funcțiile personalizate.'}
            </span>
            <button
              type="button"
              onClick={openSettings}
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600"
            >
              Deschide setările AI
            </button>
          </div>
        )}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <button
              onClick={() => {
                setFeedback(null);
                stopNarration();
                handleExit();
              }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-xl shadow hover:shadow-lg transition"
          >
            <ArrowLeft size={18} />
            <span>Trasee de învățare</span>
          </button>
          <div className="bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm text-gray-700 flex flex-col sm:items-end gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{activeLearningPath.operationLabel || 'Operație'}</span>
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
          <span>Meniu</span>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setFeedback(null);
              setShowDashboard(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <BarChart3 size={18} className="text-blue-600" />
            <span>Tablou de bord</span>
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
        {gameMode === 'sequential' && `📋 Exerciții secvențiale (până la +${currentRangeLimit})`}
        {gameMode === 'random' && `🎲 Exerciții surpriză (până la +${currentRangeLimit})`}
        {gameMode?.startsWith('stage-') && `🧱 Etapă de stăpânire: ${activeStage?.shortLabel || activeStage?.label || `+${currentRangeLimit}`}`}
        {gameMode?.startsWith('focus-') && `🎯 Exersează cu ${focusNumber}`}
        {gameMode === 'ai-path' && '🤖 Sesiune traseu AI'}
        </div>
        {gameMode !== 'ai-path' && activeStage && (
          <div className="px-3 py-1 bg-white rounded-full shadow text-xs font-semibold text-indigo-600">
            Etapă activă: {activeStage.label}
          </div>
        )}
        {gameMode !== 'ai-path' && (
          <div className="px-3 py-1 bg-white rounded-full shadow text-xs font-semibold text-gray-700">
            Interval: până la +{currentRangeLimit}
          </div>
        )}
        <div className="px-3 py-1 bg-white rounded-full shadow text-xs font-semibold text-gray-700">
          Dificultate: <span className={{ easy: 'text-green-600', medium: 'text-orange-600', hard: 'text-red-600' }[gameState.adaptiveLearning.currentDifficulty] || 'text-gray-600'}>{DIFFICULTY_LABELS[gameState.adaptiveLearning.currentDifficulty] || gameState.adaptiveLearning.currentDifficulty}</span>
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
              <div className="text-3xl font-bold text-green-600">Super!</div>
            </div>
          </div>
        )}

        {gameMode === 'ai-path' && aiSessionMeta?.story && (
          <div className="mb-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl text-indigo-700 text-sm">
            {aiSessionMeta.story}
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-700 mb-6 flex items-center justify-between">
          <span>Adună numerele:</span>
          {card.review && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-1">REVIZUIRE</span>}
        </h2>

        {card.aiPlanItem && (
          <div className="mb-4 text-sm text-indigo-600 font-medium flex items-center gap-2">
            <Brain size={16} className="text-indigo-500" />
            Succes estimat ~{Math.round((card.aiPlanItem.predictedSuccess ?? aiPersonalization.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint) * 100)}%
          </div>
        )}

        {checkpointActive && (
          <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl text-center text-purple-800">
            <div className="font-semibold text-sm">Revizuire de control în desfășurare</div>
            <div className="text-xs mt-1">Țintește cel puțin 80% acuratețe pentru a continua. Acuratețe: {checkpointAccuracy}%</div>
            <div className="mt-2 text-xs text-purple-600">
              {checkpointState.totalAttempts} încercări · {checkpointCleared}/{checkpointState.reviewCards.length} carduri rezolvate
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
                    <span className="font-bold">💡 Ajutor {index + 1}:</span>
                    <span>{hint}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-yellow-800 font-medium text-center">
                💡 Ajutor: Numără toate obiectele de mai jos sau folosește linia numerelor pentru a sări de la {card.a} cu {card.b} pași.
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
              aria-label="Răspunsul tău"
            />
            {feedback === 'correct' && (
              <div className="mt-2 text-green-600 font-semibold flex items-center gap-1"><Check size={18}/> Corect!</div>
            )}
            {feedback === 'incorrect' && (
              <div className="mt-2 text-red-600 font-semibold flex items-center gap-1"><X size={18}/> Mai încearcă</div>
            )}
          </div>
        </div>

        {/* Number line hint */}
        {showHint && (
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
            Verifică
          </button>

          <button
            onClick={() => {
              setUserAnswer('');
              setFeedback(null);
              setShowHint(false);
              setGuidedHelp({ active: false, step: 0, complete: false });
              setProblemStartTime(Date.now());
              inputRef.current?.focus();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow bg-white border hover:bg-gray-50"
          >
            <RotateCcw size={18} />
            Resetează
          </button>

          <button
            onClick={prevCard}
            disabled={currentCard === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${currentCard === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
          >
            ‹ Înapoi
          </button>

          <button
            onClick={nextCard}
            disabled={currentCard >= cards.length - 1}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${currentCard >= cards.length - 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
          >
            Înainte ›
          </button>

          <button
            onClick={() => {
              stopNarration();
              setShowHint(prev => {
                const next = !prev;
                setGuidedHelp(next ? { active: true, step: 0, complete: false } : { active: false, step: 0, complete: false });
                return next;
              });
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${showHint ? 'bg-yellow-100 border-yellow-300' : 'bg-white border hover:bg-gray-50'}`}
          >
            💡 Ajutor
          </button>
          <button
            onClick={() => {
              if (!card) return;
              speakProblemDebounced(card).catch(() => {});
            }}
            disabled={!audioSettings.narrationEnabled}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow ${
              audioSettings.narrationEnabled ? 'bg-white border hover:bg-gray-50' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            🔊 Ascultă din nou
          </button>
        </div>
      </div>

      {/* Footer stats */}
      <div className="text-sm text-gray-700 bg-white rounded-full px-4 py-2 shadow">
        Cartonașul {currentCard + 1} din {cards.length}
      </div>
    </div>
    </>
  );
}
