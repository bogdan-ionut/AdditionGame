import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { X, Sparkles, Rocket, Crown, Award, Lock, Gem, Star, Shield, Zap, Flame, Sword } from 'lucide-react';

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
      themeColor: 'rose',
      mainGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
      gemColor: '#f43f5e',
      glowColor: '#fb7185',
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
      mainGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      gemColor: '#6366f1',
      glowColor: '#818cf8',
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
      mainGradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
      gemColor: '#10b981',
      glowColor: '#34d399',
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
      mainGradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
      gemColor: '#a855f7',
      glowColor: '#c084fc',
      icon: 'Crown',
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
  Flame,
  Sword,
};

const pickIcon = (iconName) => {
  if (iconName && ICONS[iconName]) {
    return ICONS[iconName];
  }
  return Sparkles;
};

// --- Visual Helpers ---

const getTier = (currentRuns, requiredRuns) => {
  if (!requiredRuns || requiredRuns <= 0) return 3;
  if (currentRuns >= requiredRuns) return 3;

  const progressRatio = currentRuns / requiredRuns;
  if (progressRatio >= 0.66) return 2;
  if (progressRatio >= 0.33) return 1;
  return 0;
};

const StageBadgeShowcase = ({ stages = [], onClose, runThresholdPercent = 85 }) => {
  const [debugMode, setDebugMode] = useState(false);
  const [debugOverride, setDebugOverride] = useState(null);

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

      const tier = getTier(currentRuns, requiredRuns);

      return {
        ...stage,
        requiredHighAccuracyRuns: requiredRuns,
        highAccuracyRuns: currentRuns,
        tier,
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
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl transition-opacity duration-500"
        aria-hidden="true"
        onMouseDown={handleBackdropClick}
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl xl:max-w-[1600px] overflow-hidden rounded-[3rem] border border-white/10 bg-[#0B0F19] shadow-2xl ring-1 ring-white/5">

        {/* Header */}
        <div className="relative overflow-hidden bg-[#0B0F19] px-8 py-8 text-white sm:px-12 border-b border-white/5">
          {/* Background decorative elements */}
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-purple-600/20 blur-[100px] animate-pulse-glow" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />

          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                onClick={handleTitleClick}
                className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-500 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)] cursor-pointer select-none active:scale-95 transition-transform"
              >
                Sala Legendelor
              </h2>
              <p className="mt-3 text-lg text-slate-400 font-medium max-w-2xl">
                Colectează relicve antice și trezește-le puterea prin măiestrie.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-full bg-slate-800/50 border border-slate-700/50 px-6 py-3 backdrop-blur-md shadow-inner">
                <TrophyIcon className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" />
                <span className="text-xl font-bold text-slate-200 font-mono">
                  {masteredCount} <span className="text-slate-600 mx-1">/</span> {totalCount}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRequestClose}
                className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 transition-all hover:bg-slate-700 hover:text-white hover:scale-110 active:scale-95 border border-white/5 hover:border-white/20"
                aria-label="Închide"
              >
                <X size={28} />
              </button>
            </div>
          </div>
        </div>

        {/* Debug Controls */}
        {debugMode && (
          <div className="bg-slate-900/80 border-b border-slate-800 px-8 py-4 flex flex-wrap gap-4 items-center justify-center animate-in fade-in slide-in-from-top-4">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Debug Mode</span>
            <div className="flex gap-2">
              <button onClick={() => setDebugOverride(0)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 0 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Locked</button>
              <button onClick={() => setDebugOverride(1)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 1 ? 'bg-orange-700 text-white' : 'bg-slate-800 text-slate-300'}`}>Bronze</button>
              <button onClick={() => setDebugOverride(2)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 2 ? 'bg-slate-400 text-white' : 'bg-slate-800 text-slate-300'}`}>Silver</button>
              <button onClick={() => setDebugOverride(3)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === 3 ? 'bg-yellow-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Gold</button>
              <button onClick={() => setDebugOverride(null)} className={`px-3 py-1 rounded text-xs font-bold ${debugOverride === null ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Reset</button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="max-h-[70vh] overflow-y-auto bg-[#0F131F] px-6 py-12 sm:px-12 custom-scrollbar relative">
          {/* Grid Background */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

          {!hasProgressData && (
            <div className="mb-10 rounded-3xl border border-purple-500/30 bg-purple-500/10 p-8 text-center backdrop-blur-sm">
              <Sparkles className="mx-auto h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-bold text-purple-200">Călătoria ta începe acum</h3>
              <p className="mt-2 text-purple-300/80 max-w-lg mx-auto">
                Aceste relicve sunt adormite. Rezolvă exerciții cu precizie pentru a le infuza cu energie magică.
              </p>
            </div>
          )}

          <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-4 relative z-10 pb-12">
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

  const isLocked = !unlocked;
  const isMastered = tier === 3;

  // Dynamic Styles based on Tier
  let borderColor = 'border-slate-800';
  let bgGradient = 'bg-[#131825]';
  let glowEffect = '';
  let tierName = 'Nedescoperit';
  let tierColor = 'bg-slate-800 text-slate-500 border-slate-700';

  if (isLocked) {
    borderColor = 'border-slate-800';
    bgGradient = 'bg-[#0F121A]';
  } else if (tier === 1) {
    tierName = 'Novice';
    tierColor = 'bg-orange-900/50 text-orange-200 border-orange-700/50'; // Bronze
    borderColor = 'border-orange-900/30';
    bgGradient = 'bg-gradient-to-b from-[#1a1510] to-[#131825]';
  } else if (tier === 2) {
    tierName = 'Expert';
    tierColor = 'bg-slate-700/50 text-slate-200 border-slate-500/50'; // Silver
    borderColor = 'border-slate-600/30';
    bgGradient = 'bg-gradient-to-b from-[#1a202c] to-[#131825]';
    glowEffect = 'shadow-[0_0_30px_-10px_rgba(148,163,184,0.1)]';
  } else if (tier === 3) {
    tierName = 'Legendar';
    tierColor = 'bg-yellow-900/50 text-yellow-200 border-yellow-600/50'; // Gold
    borderColor = 'border-yellow-500/30';
    bgGradient = 'bg-gradient-to-b from-[#2a2010] to-[#131825]';
    glowEffect = `shadow-[0_0_60px_-15px_${badge.glowColor || '#a855f7'}]`;
  }

  return (
    <div className={`group relative flex flex-col rounded-[2.5rem] border ${borderColor} ${bgGradient} ${glowEffect} transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl overflow-visible`}>

      {/* Mastered Background Effects */}
      {isMastered && (
        <>
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-50" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-yellow-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <ParticleSystem color={badge.glowColor} />
        </>
      )}

      {/* Locked Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 rounded-[2.5rem] bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-slate-600">
          <Lock className="h-10 w-10 mb-2 opacity-40" />
          <span className="text-xs font-bold uppercase tracking-widest">Nedescoperit</span>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full p-8 items-center text-center">

        {/* --- THE MEDALLION --- */}
        <div className="relative w-64 h-64 mb-8 perspective-1000 -mt-4">
          <Medallion
            tier={tier}
            icon={BadgeIcon}
            colors={badge}
            progress={highAccuracyRuns}
            total={requiredHighAccuracyRuns}
          />
        </div>

        {/* Ribbon for Rank */}
        <div className="relative -mt-12 mb-4 w-full flex justify-center">
          <div className={`relative py-1.5 px-8 rounded-sm shadow-lg border-y border-white/10 ${tierColor} transform skew-x-[-10deg]`}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
            <span className="relative block transform skew-x-[10deg] text-[0.7rem] font-black uppercase tracking-[0.25em] drop-shadow-md">
              {tierName}
            </span>
            {/* Ribbon Ends */}
            <div className={`absolute top-1.5 -left-2 w-4 h-full ${tierColor} transform skew-y-[30deg] -z-10 brightness-75`} />
            <div className={`absolute top-1.5 -right-2 w-4 h-full ${tierColor} transform skew-y-[-30deg] -z-10 brightness-75`} />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2 mb-6 w-full">
          <h3 className={`text-2xl font-black tracking-tight leading-tight ${isMastered ? 'text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300' : 'text-slate-300'}`}>
            {badge?.name}
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed font-medium px-2">
            {badge?.description}
          </p>
        </div>

        {/* Stats / Progress Footer */}
        <div className="mt-auto w-full">
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wider text-slate-600 mb-2">
            <span>Măiestrie</span>
            <span>{highAccuracyRuns} / {requiredHighAccuracyRuns}</span>
          </div>

          {/* Progress Bar Container */}
          <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden relative box-border border border-white/5">
            {/* Fill */}
            <div
              className="h-full transition-all duration-1000 ease-out relative rounded-full"
              style={{
                width: `${(highAccuracyRuns / requiredHighAccuracyRuns) * 100}%`,
                background: isMastered ? badge.mainGradient : tier === 2 ? '#94a3b8' : tier === 1 ? '#c2410c' : '#334155',
                boxShadow: isMastered ? `0 0 10px ${badge.glowColor}` : 'none'
              }}
            >
              {isMastered && (
                <div className="absolute inset-0 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The Core Visual Component
 * Renders the 3D-looking layered medallion with metallic textures
 */
const Medallion = ({ tier, icon: Icon, colors, progress, total }) => {
  const isMastered = tier === 3;

  // Metallic Gradients
  const BRONZE_GRADIENT = 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #78350f 100%)';
  const SILVER_GRADIENT = 'linear-gradient(135deg, #475569 0%, #94a3b8 50%, #475569 100%)';
  const GOLD_GRADIENT = 'linear-gradient(135deg, #b45309 0%, #fcd34d 50%, #b45309 100%)';

  // Base Plate Style
  let baseBackground = '#1e293b';
  let baseShadow = 'shadow-none';

  if (tier === 1) {
    baseBackground = BRONZE_GRADIENT;
    baseShadow = 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]';
  } else if (tier === 2) {
    baseBackground = SILVER_GRADIENT;
    baseShadow = 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_4px_10px_rgba(0,0,0,0.5)]';
  } else if (tier === 3) {
    baseBackground = GOLD_GRADIENT;
    baseShadow = `shadow-[0_0_50px_-10px_${colors.glowColor},inset_0_0_20px_rgba(255,255,255,0.3)]`;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">

      {/* Glow Behind (Mastered) */}
      {isMastered && (
        <div
          className="absolute inset-[-10%] rounded-full blur-2xl animate-pulse-glow"
          style={{ background: colors.glowColor, opacity: 0.6 }}
        />
      )}

      {/* --- LAYER 1: BASE SHAPE --- */}
      {/* Using SVG for complex shapes instead of just rounded-full */}
      <div className={`absolute inset-0 transition-all duration-700 drop-shadow-xl`}>
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={`grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={tier === 3 ? '#b45309' : tier === 2 ? '#475569' : tier === 1 ? '#78350f' : '#1e293b'} />
              <stop offset="50%" stopColor={tier === 3 ? '#fcd34d' : tier === 2 ? '#94a3b8' : tier === 1 ? '#b45309' : '#334155'} />
              <stop offset="100%" stopColor={tier === 3 ? '#b45309' : tier === 2 ? '#475569' : tier === 1 ? '#78350f' : '#1e293b'} />
            </linearGradient>
            <filter id="inner-shadow">
              <feOffset dx="0" dy="1" />
              <feGaussianBlur stdDeviation="1" result="offset-blur" />
              <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
              <feFlood floodColor="black" floodOpacity="0.5" result="color" />
              <feComposite operator="in" in="color" in2="inverse" result="shadow" />
              <feComposite operator="over" in="shadow" in2="SourceGraphic" />
            </filter>
          </defs>

          {/* Shape Logic */}
          {tier === 3 ? (
            // Sunburst / Star Shape for Legendary
            <path
              d="M50 0 L62 25 L90 25 L75 50 L90 75 L62 75 L50 100 L38 75 L10 75 L25 50 L10 25 L38 25 Z"
              fill={`url(#grad-${tier})`}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
              filter="url(#inner-shadow)"
            />
          ) : tier === 2 ? (
            // Gear / Shield Shape for Rare
            <path
              d="M50 2 L65 10 L85 10 L90 30 L98 50 L90 70 L85 90 L65 90 L50 98 L35 90 L15 90 L10 70 L2 50 L10 30 L15 10 L35 10 Z"
              fill={`url(#grad-${tier})`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          ) : (
            // Simple Circle for Common/Locked
            <circle cx="50" cy="50" r="48" fill={`url(#grad-${tier})`} />
          )}
        </svg>
      </div>

      {/* --- LAYER 2: ORNAMENTAL RINGS & RUNES --- */}

      {/* Runic Ring (Silver+) */}
      <div className={`absolute inset-6 rounded-full border border-dashed transition-all duration-700 ${tier >= 2 ? 'opacity-100' : 'opacity-0'}`}
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {tier >= 2 && (
          <div className="absolute inset-0 animate-spin-slow">
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-30">
              <path id="curve" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
              <text width="500">
                <textPath xlinkHref="#curve" className="text-[8px] uppercase font-mono fill-white tracking-[0.5em]">
                  • MĂIESTRIE • PRECIZIE • LEGENDĂ •
                </textPath>
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* Inner Gold Ring (Gold+) */}
      <div
        className={`absolute inset-10 rounded-full border-[3px] transition-all duration-700 ${tier >= 3 ? 'opacity-100 animate-spin-reverse-slow' : 'opacity-0'}`}
        style={{
          borderColor: tier >= 3 ? colors.gemColor : 'transparent',
          boxShadow: tier >= 3 ? `0 0 15px ${colors.glowColor}` : 'none'
        }}
      />

      {/* --- LAYER 3: THE CORE (GEM) --- */}
      <div
        className="absolute inset-12 rounded-full flex items-center justify-center overflow-hidden transition-all duration-1000 shadow-inner"
        style={{
          background: tier >= 3 ? colors.mainGradient : '#0f172a',
          boxShadow: tier >= 3
            ? `inset 0 5px 15px rgba(255,255,255,0.6), 0 5px 20px rgba(0,0,0,0.5)`
            : 'inset 0 5px 10px rgba(0,0,0,0.8)',
          border: tier >= 3 ? '2px solid rgba(255,255,255,0.4)' : '2px solid #1e293b'
        }}
      >
        {/* Gem Facets (Overlay) */}
        {tier >= 3 && (
          <>
            {/* Top Facet */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent clip-path-polygon-[0_0,100%_0,50%_100%]" />
            {/* Bottom Facet */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent clip-path-polygon-[50%_0,100%_100%,0_100%]" />

            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/60 to-transparent rotate-45 animate-[shine_4s_infinite_ease-in-out]" />
            <div className="absolute top-2 right-4 w-6 h-3 bg-white/60 rounded-full blur-[2px] transform rotate-45" />
          </>
        )}

        {/* Icon */}
        <div className={`relative z-10 transition-all duration-700 ${tier >= 3 ? 'scale-125 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'scale-90 opacity-30 grayscale'}`}>
          <Icon
            size={48}
            className={tier >= 3 ? 'text-white' : 'text-slate-500'}
            strokeWidth={tier >= 3 ? 2.5 : 1.5}
          />
        </div>
      </div>
    </div>
  );
};

const ParticleSystem = ({ color }) => {
  const particles = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: `${2 + Math.random() * 4}px`
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2.5rem]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white animate-sparkle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: `0 0 10px ${color}`
          }}
        />
      ))}
    </div>
  );
};

export default StageBadgeShowcase;
