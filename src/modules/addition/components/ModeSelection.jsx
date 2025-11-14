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
    title: 'Carduri de Adunare',
    description: 'Învățare asistată de AI pentru sume până la 10.',
    recommendedAges: 'Vârste 3-6',
    operationLabel: 'Adunare',
    ...learningPath,
  };
  const exitHandler = onExit ?? (() => {});
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
    { id: 'sequential', name: 'Toate numerele', desc: 'Exersează toate adunările 0-9 în ordine', icon: Hash, color: 'blue' },
    { id: 'random', name: 'Exerciții surpriză', desc: 'Adunări aleatoare din 0-9', icon: Shuffle, color: 'purple' },
  ];

  const numberModes = Array.from({ length: 10 }, (_, i) => ({
    id: `focus-${i}`,
    number: i,
    name: `Adunări cu ${i}`,
    desc: `Învață toate adunările cu ${i}`,
    color: ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'cyan', 'blue', 'purple'][i]
  }));

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
      const message = `Blocat · Termină traseul de stăpânire curent pentru a ajunge la +${addend}.`;
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
      const message = `Blocat · Termină ${prerequisiteLabel} pentru a debloca +${addend}.`;
      const tooltip = `Finalizați ${prerequisiteLabel} (≥${accuracyTarget}% acuratețe) pentru a debloca acest număr de focus.`;
      return {
        locked: true,
        message,
        tooltip,
        stage,
        blockingStage: unmetPrerequisite,
      };
    }

    const fallbackLabel = stage.label || `adunările până la +${stage.maxAddend}`;
    const fallback = `Blocat · Termină ${fallbackLabel} pentru a continua.`;
    return { locked: true, message: fallback, tooltip: fallback, stage };
  }, [defaultRangeLimit, stageMapByAddend, stageMapById]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-8 flex flex-col items-center justify-center">
      {showBadgeCelebration && <ConfettiBurst />}
      <div className="max-w-5xl w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <button
            onClick={exitHandler}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-xl shadow hover:shadow-lg transition"
          >
            <ArrowLeft size={18} />
            <span>Trasee de învățare</span>
          </button>
          <div className="text-sm text-gray-600 sm:text-right">
            <div className="font-semibold uppercase tracking-wider text-indigo-500">{pathMeta.operationLabel || 'Operație'}</div>
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
              aiBadgeActive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}
          >
            <span>{aiBadgeActive ? 'AI features enabled' : 'AI features disabled'}</span>
            <span className="text-xs font-normal text-gray-500">
              Cheie Gemini: {aiRuntime?.serverHasKey ? 'Da' : 'Nu'} · Narațiune:{' '}
              {aiRuntime?.aiEnabled ? 'Activă' : 'Oprită'}
            </span>
          </div>
        </div>

        {narrationNotice && (
          <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow">
            {narrationNotice}
          </div>
        )}

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
            <span className="text-sm">{gameState.studentInfo.age} ani</span>
            </div>
            <button
                onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-all"
            >
                Deconectare
            </button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={onShowDashboard}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-blue-200"
          >
            <BarChart3 className="text-blue-600" size={20} />
            <span className="font-semibold">Tablou pentru părinți</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-green-200"
          >
            <Download className="text-green-600" size={20} />
            <span className="font-semibold">Exportă progresul</span>
          </button>

          <button
            onClick={() => onOpenAchievements?.()}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-purple-200"
          >
            <Award className="text-purple-600" size={20} />
            <span className="font-semibold">Realizări și insigne</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-purple-200"
          >
            <Upload className="text-purple-600" size={20} />
            <span className="font-semibold">Importă progresul</span>
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
            <span className="font-semibold">Setări AI</span>
          </button>
          <button
            onClick={() => setShowAbout((prev) => !prev)}
            className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-amber-200"
          >
            <Info className="text-amber-600" size={20} />
            <span className="font-semibold">{showAbout ? 'Ascunde detaliile' : 'Despre & ghid AI'}</span>
          </button>
        </div>

        {/* Personalized Learning Journey */}
        <div className="bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-50 p-6 md:p-7 rounded-3xl shadow-lg border border-indigo-200/80 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Călătorie de învățare personalizată</h2>
                <p className="text-sm text-gray-600 mt-1">
                  AI a adaptat exercițiile pe baza unei acurateți de {metrics.overallAccuracy}%, a unei serii de {metrics.streak} și a unui timp mediu de răspuns de {metrics.avgTime}s.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 font-semibold text-indigo-700 shadow-sm">
                  <Star size={14} className="text-indigo-500" /> Cel mai înalt nivel: {learningInsights.highestMastered >= 0 ? learningInsights.highestMastered : 'Încă nimic'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 font-semibold text-indigo-700 shadow-sm">
                  <Brain size={14} className="text-indigo-500" /> Ținte în coadă: {focusRecommendations.length}
                </span>
              </div>
            </div>
            {focusRecommendations.length > 0 && (
              <div className="grid w-full gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/70 px-3 py-2 font-medium">
                  <Check size={14} className="text-emerald-500" />
                  Ținta de acuratețe ≥ {Math.round(TARGET_SUCCESS_BAND[0] * 100)}%
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/70 px-3 py-2 font-medium">
                  <Zap size={14} className="text-indigo-500" />
                  Timp mediu {metrics.avgTime}s
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/70 px-3 py-2 font-medium">
                  <Target size={14} className="text-indigo-500" />
                  Serie de concentrare {metrics.streak}
                </div>
              </div>
            )}
          </div>
        </div>

        {showAbout && (
          <div className="bg-white rounded-3xl shadow-lg border-2 border-amber-200 p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-amber-600" size={24} />
              <h3 className="text-2xl font-bold text-gray-800">Despre {pathMeta.title || 'Carduri de Adunare'}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {(pathMeta.title || 'Carduri de Adunare')} combină exercițiile clasice cu planificarea adaptivă. Folosește acest ghid ca să descoperi ce este alimentat de AI și cum poți testa rapid.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h4 className="text-lg font-semibold text-amber-800 mb-3">Jocul de bază</h4>
                <ul className="list-disc list-inside text-sm text-amber-900 space-y-2">
                  <li>Alege <span className="font-semibold">Toate numerele</span> sau <span className="font-semibold">Exerciții surpriză</span> pentru antrenamentul clasic din modurile secvențial și aleatoriu.</li>
                  <li>Țintește familii specifice de fapte cu dalele numerelor (de exemplu <em>Adunări cu 5</em>) pentru repetiții concentrate.</li>
                  <li>Urmărește progresul, exportă sesiunile și analizează perspectivele în tabloul de bord pentru părinți.</li>
                </ul>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <h4 className="text-lg font-semibold text-indigo-800 mb-3">Experiențe cu ajutorul AI</h4>
                <ul className="list-disc list-inside text-sm text-indigo-900 space-y-2">
                  <li>
                    <span className="font-semibold">Cardul „Pasul următor”</span> anticipează următoarea problemă folosind coada planului activ. Când există un plan Gemini, apar povestea, indiciile și șansa estimată de reușită.
                  </li>
                  <li>
                    <span className="font-semibold">Pornește traseul AI</span> solicită sesiuni de 10 pași din Gemini pe baza familiilor vulnerabile și a intereselor. Fără cheie, revine la planificatorul local pentru a continua ritmul.
                  </li>
                  <li>
                    <span className="font-semibold">Motivurile de interes</span> transformă pasiunile copilului în fire narative. Adaugă interese în panoul de mai sus pentru a le trimite la Gemini, iar modelarea locală rămâne ca rezervă.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-6">
          <div className="space-y-3">
            {focusRecommendations.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {focusRecommendations.map((item) => {
                const badgeStyles = {
                  mastered: 'bg-green-100 text-green-700 border-green-300',
                  proficient: 'bg-blue-100 text-blue-700 border-blue-300',
                  learning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                  struggling: 'bg-red-100 text-red-700 border-red-300',
                  'not-started': 'bg-slate-100 text-slate-700 border-slate-300',
                };
                const levelBadgeClass = badgeStyles[item.level] || badgeStyles['not-started'];
                const recommendationLockInfo = getLockInfo(item.number);
                const recommendationLocked = recommendationLockInfo.locked;
                const levelLabels = {
                  mastered: 'Stăpânit',
                  proficient: 'Sigur pe sine',
                  learning: 'În învățare',
                  struggling: 'În dificultate',
                  'not-started': 'Neînceput',
                };

                return (
                  <div
                    key={`focus-${item.number}`}
                    className="flex h-full flex-col gap-2 rounded-2xl border border-indigo-200/80 bg-white/90 p-3 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700">
                        {item.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {item.level === 'mastered'
                              ? 'Menține stăpânirea'
                              : item.level === 'struggling'
                              ? 'Revizuiește zona'
                              : 'Concentrează-te pe'} +{item.number}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${levelBadgeClass}`}>
                            {levelLabels[item.level] || levelLabels['not-started']}
                          </span>
                          {item.recommended && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-300">
                              Recomandat de AI
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{item.reason}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                      <span className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-2 py-1 font-medium">
                        Stăpânire {item.masteryPercent}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-2 py-1 font-medium">
                        Acuratețe {item.accuracy}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-2 py-1 font-medium">
                        {item.attempts} încercări
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (recommendationLocked) {
                          showToast({
                            level: 'error',
                            message:
                              recommendationLockInfo.message || 'Acest set de exerciții este blocat până când parcurgi etapele necesare.',
                          });
                          return;
                        }
                        onSelectMode(`focus-${item.number}`, item.number);
                      }}
                      disabled={recommendationLocked}
                      title={recommendationLocked ? recommendationLockInfo.tooltip : ''}
                      className={`mt-auto w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${recommendationLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      Exersează +{item.number}
                    </button>
                  </div>
                );
                })}
              </div>
          ) : (
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-6 text-center text-gray-600">
              Avem nevoie de câteva date în plus pentru a personaliza parcursul. Pornește orice mod pentru a debloca recomandări dedicate.
            </div>
          )}
        </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Wand2 className="text-indigo-500" size={18} /> Interesele copilului
                </h3>
                <p className="text-sm text-gray-600 mt-1">Adaugă 2-4 interese pentru a personaliza poveștile și exemplele.</p>
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
                      aria-label={`Elimină ${interest}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {!(aiPersonalization?.learnerProfile?.interests || []).length && (
                  <span className="text-sm text-gray-500">Încă nu există interese—adaugă câteva mai jos!</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={interestDraft}
                  onChange={(e) => onInterestDraftChange?.(e.target.value)}
                  placeholder="ex. dinozauri, fotbal, gătit"
                  className="flex-1 px-3 py-2 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={onAddInterest}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700"
                >
                  Adaugă
                </button>
              </div>
              {(() => {
                const motifSprites = Array.isArray(aiPersonalization?.learnerProfile?.motifSprites)
                  ? aiPersonalization.learnerProfile.motifSprites.filter((url) => typeof url === 'string' && url.trim())
                  : [];
                const motifLabels = normalizeMotifTokens(
                  [
                    ...(motifSprites.map((url) => ({ url, label: describeSpriteUrl(url) }))),
                    ...(aiPersonalization?.learnerProfile?.interestMotifs || []),
                  ],
                );
                const total = Math.max(0, (safeMotifJobState.done || 0) + (safeMotifJobState.pending || 0));
                const ready = Math.max(0, safeMotifJobState.done || 0);

                return (
                  <>
                    {motifSprites.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {motifSprites.slice(0, 6).map((url) => (
                          <div
                            key={url}
                            className="w-12 h-12 rounded-xl overflow-hidden border border-indigo-200 bg-indigo-50 flex items-center justify-center"
                          >
                            <img
                              src={url}
                              alt={describeSpriteUrl(url)}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {motifSprites.length > 6 && (
                          <div className="w-12 h-12 rounded-xl border border-dashed border-indigo-300 text-xs flex items-center justify-center text-indigo-500">
                            +{motifSprites.length - 6}
                          </div>
                        )}
                      </div>
                    )}
                    {motifLabels.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Motivuri: {motifLabels.slice(0, 6).join(', ')}
                      </div>
                    )}
                    {safeMotifJobState.loading && (
                      <div className="text-xs text-indigo-500">Generăm sprite-uri AI…</div>
                    )}
                    {!safeMotifJobState.loading && safeMotifJobState.jobId && total > 0 && (
                      <div className="text-xs text-indigo-500">
                        Sprite-uri pregătite: {ready} / {total}
                      </div>
                    )}
                    {safeMotifJobState.error && !safeMotifJobState.loading && (
                      <div className="text-xs text-red-500">Eroare sprite AI: {safeMotifJobState.error}</div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-5 shadow-sm">
              {aiPlanStatus?.error && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                  {aiPlanStatus.error}
                </div>
              )}
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
        </section>

        {/* Main modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id, null, {
                  rangeLimit: defaultRangeLimit,
                  stageId: defaultStageForModes?.id ?? null,
                })}
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

        {additionStages.length > 0 && (
          <div className="bg-white p-8 rounded-3xl shadow-lg border-4 border-indigo-100 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Repere de stăpânire</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Cucerește fiecare etapă cu 90% acuratețe și serii de peste {HIGH_ACCURACY_RUN_PERCENT}% înainte de a debloca următorul interval.
                </p>
              </div>
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-700">
                Nivel deblocat: +{defaultRangeLimit}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {additionStages.map((stage) => {
                const thresholdPercent = Math.round((stage.masteryThreshold ?? 0.9) * 100);
                const statusMeta = stage.mastered
                  ? { label: 'Stăpânit', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                  : stage.unlocked
                    ? { label: 'În progres', tone: 'bg-amber-100 text-amber-700 border-amber-200' }
                    : { label: 'Blocat', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
                const prerequisiteStage = (stage.prerequisites || [])
                  .map((id) => additionStages.find((entry) => entry.id === id))
                  .find(Boolean);
                const prerequisiteThreshold = Math.round(((prerequisiteStage?.masteryThreshold ?? stage.masteryThreshold ?? 0.9) || 0.9) * 100);
                const runTarget = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 0;
                const completedRunsRaw = stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;
                const runProgress = runTarget > 0
                  ? Math.min(completedRunsRaw, runTarget)
                  : completedRunsRaw;
                const runPercent = runTarget > 0
                  ? Math.min(100, Math.round((runProgress / runTarget) * 100))
                  : 100;
                const runProgressLabel = runTarget > 0
                  ? `${runProgress}/${runTarget}`
                  : `${runProgress}`;
                const runBadgeSlots = runTarget > 0
                  ? Array.from({ length: runTarget }, (_, idx) => idx < runProgress)
                  : null;
                const BadgeIcon = stage.badge?.icon && BADGE_ICON_MAP[stage.badge.icon]
                  ? BADGE_ICON_MAP[stage.badge.icon]
                  : Sparkles;
                const bestAccuracyLabel = Number.isFinite(stage.bestAccuracy)
                  ? `Record personal: ${stage.bestAccuracy}%`
                  : 'Fără date despre runde';
                const lastAccuracy = Number.isFinite(stage.lastAccuracy) ? stage.lastAccuracy : null;
                const lastAccuracyBelowThreshold = lastAccuracy != null && lastAccuracy < thresholdPercent;
                const lastAccuracyChipTone = lastAccuracy == null
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                  : lastAccuracyBelowThreshold
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
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
                const focusSummary = focusSegments.length > 0 ? `Focus actual: ${focusSegments.join(' · ')}.` : '';
                const slumpReminder = focusSegments.length > 0
                  ? focusSegments.join(', ')
                  : 'faptele esențiale';
                let supportingMessage;
                if (stage.mastered) {
                  supportingMessage = lastAccuracyBelowThreshold
                    ? `Insigna este deblocată, dar ultima rundă a coborât sub ${thresholdPercent}%. Reîmprospătează ${slumpReminder} pentru a păstra strălucirea.${focusSummary ? ` ${focusSummary}` : ''}`
                    : `Insigna este deblocată! Continuă verificările încrezătoare ca ${stage.badge?.name || 'insigna ta'} să rămână strălucitoare.${focusSummary ? ` ${focusSummary}` : ''}`;
                } else if (stage.unlocked) {
                  supportingMessage = `Atige ${thresholdPercent}% acuratețe și finalizează ${runTarget || 1} rund${runTarget === 1 ? 'ă' : 'e'} cu precizie ridicată (${runProgressLabel}) la ≥${stage.highAccuracyRunThreshold || HIGH_ACCURACY_RUN_PERCENT}% pentru a obține ${stage.badge?.name || 'insigna'}.${focusSummary ? ` ${focusSummary}` : ''}`;
                } else {
                  supportingMessage = prerequisiteStage
                    ? `Blocat · Finalizează ${prerequisiteStage.label} (≥${prerequisiteThreshold}% acuratețe).`
                    : `Blocat · Termină adunările până la +${stage.maxAddend - 1}.`;
                }

                return (
                  <div
                    key={stage.id}
                    className="relative border-2 border-indigo-100 rounded-2xl p-5 flex flex-col gap-4 bg-white/90 dark:bg-slate-800/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-indigo-500 uppercase tracking-widest">Etapă</div>
                        <h3 className="text-xl font-bold text-gray-800">{stage.label}</h3>
                        <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                        {stage.badge && (
                          <div className="mt-3">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-white shadow ${stage.badge.gradient ? `bg-gradient-to-r ${stage.badge.gradient}` : 'bg-indigo-500'}`}
                            >
                              <BadgeIcon size={14} className="drop-shadow" />
                              {stage.badge.name}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusMeta.tone}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                        Progres: {stage.progressPercent}%
                      </span>
                      <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                        Stăpânite: {stage.masteredCount}/{stage.addends.length}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                        Țintă: ≥{thresholdPercent}% acuratețe
                      </span>
                      <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                        {runTarget > 0 ? `Runde precise: ${runProgressLabel}` : `Runde precise: ${runProgress}`}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">{bestAccuracyLabel}</span>
                      <span className={`px-2 py-1 rounded-full border ${lastAccuracyChipTone}`}>
                        {lastAccuracy != null ? `Ultima rundă: ${lastAccuracy}%` : 'Ultima rundă: —'}
                      </span>
                      {stage.nextTarget != null && (
                        <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                          Următorul focus: +{stage.nextTarget}
                        </span>
                      )}
                      {Number.isFinite(stage.pendingCount) && stage.pendingCount > 0 && (
                        <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                          Aproape: {stage.pendingCount}
                        </span>
                      )}
                      {Number.isFinite(stage.blockerCount) && stage.blockerCount > 0 && (
                        <span className="px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                          Necesită atenție: {stage.blockerCount}
                        </span>
                      )}
                    </div>
                    {runTarget > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-indigo-600">
                          <span>Runde de etapă cu acuratețe ridicată</span>
                          <span>{runProgressLabel}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-indigo-100 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${stage.mastered ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${runPercent}%` }}
                          />
                        </div>
                        {runBadgeSlots && (
                          <div className="flex items-center gap-2 pt-1">
                              {runBadgeSlots.map((earned, idx) => (
                                <div
                                  key={idx}
                                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${earned
                                    ? 'border-emerald-400 bg-emerald-400/90 text-white shadow'
                                    : 'border-indigo-200 bg-white/80 text-indigo-400'}`}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300">{supportingMessage}</p>
                    {!stage.unlocked && !stage.mastered && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2"
                      >
                        <Lock aria-hidden="true" className="text-indigo-500 dark:text-indigo-200" size={28} />
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-200">Blocat</span>
                      </div>
                    )}
                    <button
                      onClick={() => onSelectMode(`stage-${stage.id}`, null, {
                        rangeLimit: stage.maxAddend,
                        stageId: stage.id,
                      })}
                      disabled={!stage.unlocked}
                      className={`relative inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold transition ${
                        stage.unlocked
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow dark:bg-indigo-500 dark:hover:bg-indigo-400'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {stage.mastered ? 'Revizuiește etapa' : 'Exersează etapa'}
                      {!stage.unlocked && (
                        <Lock aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-300" size={18} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Number-specific modes with Mastery Gates */}
        <div className="bg-white p-8 rounded-3xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Exersează cu numere alese</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {numberModes.map((mode) => {
              const mastery = gameState.masteryTracking[mode.number];
              const masteryPercent = mastery && mastery.totalAttempts > 0
                ? (mastery.correctAttempts / mastery.totalAttempts * 100).toFixed(0)
                : 0;
              const lockInfo = getLockInfo(mode.number);
              const locked = lockInfo.locked;
              const aiRecommended =
                aiRuntime?.aiEnabled && recommendedNumbers.has(mode.number) && mode.number > (learningInsights.highestMastered ?? -1) + 1;

              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    if (locked) {
                      showToast({
                        level: 'error',
                        message: lockInfo.message || 'Acest set de exerciții este blocat. Parcurge mai întâi etapa necesară.',
                      });
                      return;
                    }
                    onSelectMode(mode.id, mode.number);
                  }}
                  disabled={locked}
                  className={`relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 p-6 rounded-2xl shadow hover:shadow-lg transition-all transform ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} border-2 border-gray-300 dark:border-slate-700`}
                  title={locked ? lockInfo.tooltip : ''}
                >
                  <div className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">{mode.number}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-200 font-medium">+ {mode.number}</div>
                  {parseFloat(masteryPercent) >= 90 && (
                    <div className="absolute top-2 right-2">
                      <Star className="text-yellow-500 fill-yellow-500" size={20} />
                    </div>
                  )}
                  {mastery && mastery.totalAttempts > 0 && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">{masteryPercent}% stăpânit</div>
                  )}
                  {aiRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow">
                      Recomandare AI
                    </div>
                  )}
                  {locked && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl border-2 border-red-300/60 dark:border-red-500/50 pointer-events-none bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2"
                    >
                      <Lock aria-hidden="true" className="text-red-500 dark:text-red-300" size={26} />
                      <span className="text-sm font-semibold text-red-600 dark:text-red-200">Blocat</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {achievementsOpen && (
        <StageBadgeShowcase
          stages={additionStages}
          runThresholdPercent={HIGH_ACCURACY_RUN_PERCENT}
          onClose={() => onCloseAchievements?.()}
        />
      )}
      {badgeSpotlight && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleCloseSpotlight}
          />
          <div
            className={`relative z-10 w-full max-w-lg rounded-3xl border-4 border-purple-200 p-8 text-center shadow-2xl bg-gradient-to-br ${
              badgeSpotlight.gradient || 'from-purple-200 via-pink-200 to-indigo-200'
            }`}
          >
            <button
              type="button"
              onClick={handleCloseSpotlight}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-purple-700 shadow"
              aria-label="Închide celebrarea insignei"
            >
              <X size={20} />
            </button>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/85 shadow-inner">
              <SpotlightIcon size={40} className="text-purple-700" />
            </div>
            <p className="text-lg font-semibold text-purple-900/90">
              {playerDisplayName ? `Felicitări, ${playerDisplayName}!` : 'Felicitări!'}
            </p>
            <h3 className="text-3xl font-extrabold text-purple-900 drop-shadow">{badgeSpotlight.badgeName}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-purple-800">{badgeSpotlight.stageLabel}</p>
            {badgeSpotlight.description && (
              <p className="mt-4 text-base text-purple-900/90">{badgeSpotlight.description}</p>
            )}
            <p className="mt-4 text-sm font-semibold text-purple-900">
              <span className="inline-flex items-center gap-2">
                <CelebrationIcon size={18} />
                {badgeSpotlight.highAccuracyRuns}/{badgeSpotlight.requiredHighAccuracyRuns || badgeSpotlight.highAccuracyRuns} runde cu acuratețe ridicată ≥{badgeSpotlight.runThresholdPercent || HIGH_ACCURACY_RUN_PERCENT}% finalizate
              </span>
            </p>
            <p className="mt-2 text-xs text-purple-900/70 text-balance">
              {badgeSpotlight.progressOnly
                ? (() => {
                    const remaining = Math.max(
                      (badgeSpotlight.requiredHighAccuracyRuns || badgeSpotlight.highAccuracyRuns || 0)
                        - (badgeSpotlight.highAccuracyRuns || 0),
                      0,
                    );
                    if (remaining <= 0) {
                      return `${playerDisplayName ? `${playerDisplayName}, ` : ''}Ești la un pas de insigna completă—mai finalizează o rundă pentru a o debloca definitiv!`;
                    }
                    return `${playerDisplayName ? `${playerDisplayName}, ` : ''}Excelent! Ai câștigat o stea de precizie. Mai ai ${remaining} rund${remaining === 1 ? 'ă' : 'e'} concentrate pentru a aprinde insigna completă și a debloca etapa următoare.`;
                  })()
                : `${playerDisplayName ? `Bravo, ${playerDisplayName}! ` : ''}Insigna este completă! Etapa următoare este acum deschisă—continuă să exersezi pentru a păstra strălucirea cosmică.`}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleViewAchievements}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/90 px-5 py-3 text-sm font-semibold text-purple-700 shadow hover:bg-white"
              >
                <Award size={18} />
                Vezi realizările
              </button>
              <button
                type="button"
                onClick={handleCloseSpotlight}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/70 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-white/10"
              >
                Continuă exercițiile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ModeSelection.propTypes = {
  learningPath: PropTypes.object,
  onExit: PropTypes.func,
  onSelectMode: PropTypes.func.isRequired,
  gameState: PropTypes.object.isRequired,
  onShowDashboard: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onImport: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onOpenAiSettings: PropTypes.func,
  aiPersonalization: PropTypes.object.isRequired,
  aiPreviewItem: PropTypes.object,
  aiPlanStatus: PropTypes.object.isRequired,
  interestDraft: PropTypes.string.isRequired,
  onInterestDraftChange: PropTypes.func.isRequired,
  onAddInterest: PropTypes.func.isRequired,
  onRemoveInterest: PropTypes.func.isRequired,
  onStartAiPath: PropTypes.func.isRequired,
  onRefreshPlan: PropTypes.func.isRequired,
  aiRuntime: PropTypes.object.isRequired,
  motifJobState: PropTypes.object,
  aiBadgeActive: PropTypes.bool.isRequired,
  narrationNotice: PropTypes.string,
  stageProgress: PropTypes.array,
  achievementsOpen: PropTypes.bool.isRequired,
  onOpenAchievements: PropTypes.func.isRequired,
  onCloseAchievements: PropTypes.func.isRequired,
  showBadgeCelebration: PropTypes.bool.isRequired,
  badgeSpotlight: PropTypes.object,
  onDismissBadgeSpotlight: PropTypes.func.isRequired,
};

ModeSelection.defaultProps = {
  learningPath: null,
  onExit: undefined,
  onOpenAiSettings: undefined,
  aiPreviewItem: null,
  motifJobState: null,
  narrationNotice: null,
  stageProgress: null,
  badgeSpotlight: null,
};

export default ModeSelection;
