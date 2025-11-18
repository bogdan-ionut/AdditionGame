import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { X, Sparkles, Rocket, Crown, Award, Lock, CircleCheckBig, Gem, Star, Shield, Zap } from 'lucide-react';

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
      // "Theme" colors for the mastered state
      themeColor: 'rose', // Used for dynamic tailwind classes if needed, but mostly we use hex/gradients
      mainGradient: 'linear-gradient(135deg, #fb7185 0%, #d946ef 50%, #8b5cf6 100%)',
      glowColor: '#f472b6',
      icon: 'Sparkles',
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
      themeColor: 'indigo',
      mainGradient: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)',
      glowColor: '#6366f1',
      icon: 'Rocket',
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
      themeColor: 'emerald',
      mainGradient: 'linear-gradient(135deg, #34d399 0%, #0ea5e9 50%, #8b5cf6 100%)',
      glowColor: '#10b981',
      icon: 'Award',
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
      themeColor: 'violet',
      mainGradient: 'linear-gradient(135deg, #c084fc 0%, #db2777 50%, #4f46e5 100%)',
      glowColor: '#a855f7',
      icon: 'Gem',
    },
  },
];

const ICONS = {
  Sparkles,
  Rocket,
  Crown,
  Award,
  Gem,
  Star,
  Shield,
  Zap,
};

const pickIcon = (iconName) => {
  if (iconName && ICONS[iconName]) {
    return ICONS[iconName];
  }
  return Sparkles;
};

// --- Visual Helpers ---

const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

/**
 * Determines the visual tier (0, 1, 2, 3) based on progress.
 * 0 = Locked / No progress
 * 1 = 1/3 runs (Outer Ring)
 * 2 = 2/3 runs (Middle Ring)
 * 3 = 3/3 runs (Mastered - Inner Ring + Core)
 */
const getTier = (currentRuns, requiredRuns) => {
  if (!requiredRuns || requiredRuns <= 0) return 3; // Fallback if no requirement
  if (currentRuns >= requiredRuns) return 3;

  const progressRatio = currentRuns / requiredRuns;
  if (progressRatio >= 0.66) return 2;
  if (progressRatio >= 0.33) return 1;
  return 0;
};

const StageBadgeShowcase = ({ stages = [], onClose, runThresholdPercent = 85 }) => {
  const [debugMode, setDebugMode] = useState(false);
  const [debugOverride, setDebugOverride] = useState(null); // null, 0, 1, 2, 3

  // Secret trigger: Click title 5 times
  const [titleClicks, setTitleClicks] = useState(0);
  const handleTitleClick = () => {
    const newCount = titleClicks + 1;
    setTitleClicks(newCount);
    if (newCount >= 5) {
      setDebugMode(true);
      setTitleClicks(0);
    }
  };

  const normalizedStages = useMemo(() => {
    const sourceStages = (Array.isArray(stages) && stages.length > 0) ? stages : FALLBACK_STAGE_BLUEPRINT;

    return sourceStages.map((stage, index) => {
      let requiredRuns = stage.requiredHighAccuracyRuns ?? stage.requiredPerfectRuns ?? 3;
      let currentRuns = stage.highAccuracyRuns ?? stage.perfectRuns ?? 0;

      // DEBUG OVERRIDE
      if (debugOverride !== null) {
        if (debugOverride === 3) {
          currentRuns = requiredRuns;
        } else if (debugOverride === 2) {
          currentRuns = Math.ceil(requiredRuns * 0.67);
        } else if (debugOverride === 1) {
          currentRuns = Math.ceil(requiredRuns * 0.34);
        } else {
          currentRuns = 0;
        }
      }

      // Calculate strict tier
      const tier = getTier(currentRuns, requiredRuns);

      return {
        ...stage,
        requiredHighAccuracyRuns: requiredRuns,
        highAccuracyRuns: currentRuns,
        tier, // 0, 1, 2, or 3
        unlocked: debugOverride !== null ? true : (stage.unlocked ?? index === 0),
        mastered: tier === 3,
      };
    });
  }, [stages, debugOverride]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-500"
        aria-hidden="true"
        onMouseDown={handleBackdropClick}
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl xl:max-w-[1600px] overflow-hidden rounded-[3rem] border border-white/10 bg-slate-900/90 shadow-2xl ring-1 ring-white/10">

        {/* Header */}
        <div className="relative overflow-hidden bg-slate-950 px-8 py-8 text-white sm:px-12">
          {/* Background decorative elements */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                onClick={handleTitleClick}
                className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-indigo-200 drop-shadow-sm cursor-pointer select-none active:scale-95 transition-transform"
              >
                Sala Legendelor
              </h2>
              <p className="mt-2 text-lg text-slate-400 font-medium max-w-2xl">
                Fiecare insignă este o relicvă antică. Completează runde perfecte pentru a le trezi la viață și a le dezvălui adevărata putere.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 px-5 py-3 backdrop-blur-sm">
                <TrophyIcon className="h-6 w-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                <span className="text-lg font-bold text-slate-200">
                  {masteredCount} <span className="text-slate-500 mx-1">/</span> {totalCount}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRequestClose}
                className="group relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-all hover:bg-slate-700 hover:text-white hover:scale-110 active:scale-95"
                aria-label="Închide"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Debug Controls */}
        {debugMode && (
          <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-4 flex flex-wrap gap-4 items-center justify-center animate-in fade-in slide-in-from-top-4">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Debug Mode</span>
            <div className="flex gap-2">
              <button onClick={() => setDebugOverride(0)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 0 ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Locked (0/3)</button>
              <button onClick={() => setDebugOverride(1)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 1 ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Tier 1 (1/3)</button>
              <button onClick={() => setDebugOverride(2)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 2 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Tier 2 (2/3)</button>
              <button onClick={() => setDebugOverride(3)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 3 ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Mastered (3/3)</button>
              <button onClick={() => setDebugOverride(null)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === null ? 'bg-slate-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Reset (Real Data)</button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="max-h-[70vh] overflow-y-auto bg-slate-900/50 px-6 py-10 sm:px-10 custom-scrollbar">
          {!hasProgressData && (
            <div className="mb-10 rounded-3xl border border-purple-500/30 bg-purple-500/10 p-8 text-center backdrop-blur-sm">
              <Sparkles className="mx-auto h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-bold text-purple-200">Călătoria ta începe acum</h3>
              <p className="mt-2 text-purple-300/80 max-w-lg mx-auto">
                Aceste relicve sunt adormite. Rezolvă exerciții cu precizie pentru a le infuza cu energie magică.
              </p>
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {orderedStages.map((stage) => (
              <EpicBadgeCard key={stage.id} stage={stage} runThresholdPercent={runThresholdPercent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components for the "Epic" look ---

const TrophyIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const EpicBadgeCard = ({ stage, runThresholdPercent }) => {
  const { tier, badge, highAccuracyRuns, requiredHighAccuracyRuns, unlocked } = stage;
  const BadgeIcon = pickIcon(badge?.icon);

  // Visual State Logic
  const isLocked = !unlocked;
  const isMastered = tier === 3;

  // Card Styles based on Tier
  let cardBorder = 'border-slate-800';
  let cardBg = 'bg-slate-900';
  let glow = 'shadow-none';

  if (isMastered) {
    cardBorder = 'border-purple-500/50';
    cardBg = 'bg-slate-900'; // We'll use a gradient overlay instead
    glow = `shadow-[0_0_50px_-12px_${badge.glowColor || '#a855f7'}]`;
  } else if (tier > 0) {
    cardBorder = 'border-slate-700';
    cardBg = 'bg-slate-900';
  }

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-[2.5rem] border ${cardBorder} ${cardBg} ${glow} transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl`}>

      {/* Mastered Background Effects */}
      {isMastered && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-900/20 opacity-100" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
        </>
      )}

      {/* Locked Background */}
      {isLocked && (
        <div className="absolute inset-0 bg-slate-950/80 z-20 backdrop-blur-[2px] flex flex-col items-center justify-center text-slate-500">
          <Lock className="h-12 w-12 mb-3 opacity-50" />
          <span className="text-sm font-bold uppercase tracking-widest">Nedescoperit</span>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full p-8 items-center text-center">

        {/* --- THE MEDALLION --- */}
        <div className="relative w-48 h-48 mb-8 perspective-1000">
          <Medallion
            tier={tier}
            icon={BadgeIcon}
            colors={badge}
            progress={highAccuracyRuns}
            total={requiredHighAccuracyRuns}
          />
        </div>

        {/* Text Content */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className={`text-[0.65rem] font-bold uppercase tracking-[0.25em] py-1 px-3 rounded-full border ${isMastered ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' :
              tier > 0 ? 'border-slate-600 text-slate-400 bg-slate-800' :
                'border-slate-800 text-slate-600 bg-slate-900'
              }`}>
              {isMastered ? 'Legendary' : tier === 2 ? 'Rare' : tier === 1 ? 'Uncommon' : 'Common'}
            </span>
          </div>

          <h3 className={`text-2xl font-black tracking-tight ${isMastered ? 'text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400' : 'text-slate-300'}`}>
            {badge?.name}
          </h3>

          <p className="text-sm text-slate-400 leading-relaxed font-medium">
            {badge?.description}
          </p>
        </div>

        {/* Stats / Progress Footer */}
        <div className="mt-auto w-full">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            <span>Progres</span>
            <span>{highAccuracyRuns}/{requiredHighAccuracyRuns}</span>
          </div>

          {/* Progress Bar Container */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
            {/* Background segments for visual separation */}
            <div className="absolute inset-0 flex">
              <div className="w-1/3 h-full border-r border-slate-900/50"></div>
              <div className="w-1/3 h-full border-r border-slate-900/50"></div>
            </div>

            {/* Fill */}
            <div
              className="h-full transition-all duration-1000 ease-out relative"
              style={{
                width: `${(highAccuracyRuns / requiredHighAccuracyRuns) * 100}%`,
                background: isMastered ? badge.mainGradient : '#64748b'
              }}
            >
              {isMastered && (
                <div className="absolute inset-0 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full" />
              )}
            </div>
          </div>

          <p className="mt-3 text-[0.7rem] text-slate-500 font-medium">
            {isMastered
              ? 'Insignă stăpânită la perfecție!'
              : `Încă ${requiredHighAccuracyRuns - highAccuracyRuns} runde perfecte pentru a evolua.`}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * The Core Visual Component
 * Renders the 3D-looking layered medallion
 */
const Medallion = ({ tier, icon: Icon, colors, progress, total }) => {
  const isMastered = tier === 3;

  // Dynamic Styles based on Tier

  // 1. Base Plate (The backmost layer)
  const basePlateStyle = {
    background: tier === 0 ? '#1e293b' : tier === 1 ? '#475569' : tier === 2 ? '#94a3b8' : '#0f172a',
    boxShadow: isMastered
      ? `0 0 40px ${colors.glowColor}60, inset 0 0 20px ${colors.glowColor}40`
      : 'inset 0 2px 4px rgba(255,255,255,0.1), 0 10px 20px rgba(0,0,0,0.5)',
    border: isMastered ? 'none' : '1px solid rgba(255,255,255,0.05)',
  };

  // 2. Rings Logic
  // We have 3 rings. 
  // Ring 1 (Outer) -> Active at Tier 1+
  // Ring 2 (Middle) -> Active at Tier 2+
  // Ring 3 (Inner) -> Active at Tier 3

  const ringBaseClass = "absolute rounded-full border transition-all duration-700 ease-out";

  // Ring 1 (Outer)
  const ring1Active = tier >= 1;
  const ring1Style = {
    inset: '0%',
    borderColor: ring1Active ? (isMastered ? 'rgba(255,255,255,0.5)' : '#94a3b8') : '#334155',
    borderWidth: '4px',
    opacity: ring1Active ? 1 : 0.3,
    boxShadow: ring1Active && isMastered ? `0 0 15px ${colors.glowColor}` : 'none',
  };

  // Ring 2 (Middle)
  const ring2Active = tier >= 2;
  const ring2Style = {
    inset: '12%',
    borderColor: ring2Active ? (isMastered ? 'rgba(255,255,255,0.7)' : '#cbd5e1') : '#334155',
    borderWidth: '4px',
    opacity: ring2Active ? 1 : 0.3,
    borderStyle: 'dashed', // Mechanical look
    animation: isMastered ? 'spin-slow 20s linear infinite' : 'none',
  };

  // Ring 3 (Inner)
  const ring3Active = tier >= 3;
  const ring3Style = {
    inset: '24%',
    borderColor: ring3Active ? '#fff' : '#334155',
    borderWidth: '2px',
    opacity: ring3Active ? 1 : 0.3,
    boxShadow: ring3Active ? `0 0 20px ${colors.glowColor}, inset 0 0 10px ${colors.glowColor}` : 'none',
  };

  // 3. Core (The Center)
  const coreActive = tier === 3;
  const coreStyle = {
    inset: '30%',
    background: coreActive ? colors.mainGradient : '#0f172a',
    boxShadow: coreActive ? `inset 0 4px 12px rgba(255,255,255,0.5), 0 0 30px ${colors.glowColor}` : 'inset 0 4px 10px rgba(0,0,0,0.8)',
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">

      {/* Background Glow for Mastered */}
      {isMastered && (
        <div
          className="absolute inset-[-20%] rounded-full blur-2xl animate-pulse"
          style={{ background: colors.glowColor, opacity: 0.4 }}
        />
      )}

      {/* Base Plate */}
      <div
        className="absolute inset-2 rounded-full transition-colors duration-700"
        style={basePlateStyle}
      />

      {/* RINGS */}
      <div className={ringBaseClass} style={ring1Style} />
      <div className={ringBaseClass} style={ring2Style} />
      <div className={ringBaseClass} style={ring3Style} />

      {/* CORE */}
      <div
        className="absolute rounded-full flex items-center justify-center overflow-hidden transition-all duration-1000"
        style={coreStyle}
      >
        {/* Core Texture/Shine */}
        {coreActive && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/20" />
            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/40 to-transparent rotate-45 animate-[shine_3s_infinite_ease-in-out]" />
          </>
        )}

        {/* ICON */}
        <div className={`relative z-10 transition-all duration-700 ${coreActive ? 'scale-110' : 'scale-90 opacity-40 grayscale'}`}>
          <Icon
            size={48}
            className={coreActive ? 'text-white drop-shadow-md' : 'text-slate-600'}
            strokeWidth={coreActive ? 2 : 1.5}
          />
        </div>
      </div>

      {/* Particles (Only Mastered) */}
      {isMastered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-[float_3s_infinite_ease-in-out]"
              style={{
                top: '50%',
                left: '50%',
                animationDelay: `${i * 0.5}s`,
                transform: `rotate(${i * 60}deg) translateY(-60px)`,
                opacity: 0
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StageBadgeShowcase;
