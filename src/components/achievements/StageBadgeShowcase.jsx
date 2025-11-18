import React, { useState } from 'react';
import { Lock, Star, Crown, Shield, Hexagon, Zap, Sparkles, Sword, Anchor, Feather, Rocket, Ghost, Skull, Heart, Sun, Moon, Cloud, Droplets, Flame, Snowflake } from 'lucide-react';

// --- ICON MAPPING ---
const ICON_MAP = {
  Lock, Star, Crown, Shield, Hexagon, Zap, Sparkles, Sword, Anchor, Feather, Rocket, Ghost, Skull, Heart, Sun, Moon, Cloud, Droplets, Flame, Snowflake
};

// --- 1. GOD RAYS COMPONENT ---
const GodRays = ({ color = 'gold' }) => {
  const gradient = color === 'gold'
    ? 'conic-gradient(from 0deg, transparent 0deg, rgba(251, 191, 36, 0.4) 20deg, transparent 40deg, rgba(251, 191, 36, 0.4) 60deg, transparent 80deg, rgba(251, 191, 36, 0.4) 100deg, transparent 120deg)'
    : 'conic-gradient(from 0deg, transparent 0deg, rgba(99, 102, 241, 0.4) 20deg, transparent 40deg, rgba(168, 85, 247, 0.4) 60deg, transparent 80deg, rgba(99, 102, 241, 0.4) 100deg, transparent 120deg)';

  return (
    <div className="absolute inset-[-100%] animate-[spin_10s_linear_infinite] pointer-events-none opacity-50 z-0">
      <div
        className="w-full h-full rounded-full"
        style={{ background: gradient, filter: 'blur(20px)' }}
      />
    </div>
  );
};

// --- 2. WING SET COMPONENT ---
const WingSet = ({ variant = 'angel', tier = 2 }) => {
  if (tier < 2) return null; // Wings appear at Expert (Tier 2)

  const isMaster = tier >= 3;
  const scale = isMaster ? 1.2 : 0.9;
  const color = isMaster ? 'url(#goldGradient)' : 'url(#silverGradient)';

  // SVG Paths for different wing types
  const paths = {
    angel: "M80,50 Q110,20 140,10 Q150,5 160,20 Q150,40 130,50 Q160,60 170,80 Q160,100 130,90 Q150,110 140,130 Q110,100 80,80 Z",
    dragon: "M80,50 Q120,10 160,0 Q150,30 130,40 Q170,50 180,80 Q140,70 120,60 Q140,100 130,120 Q100,90 80,80 Z",
    tech: "M80,50 L130,20 L140,40 L160,40 L150,60 L170,80 L130,90 L140,110 L100,80 Z",
    fairy: "M80,50 Q110,10 140,30 Q160,10 170,40 Q180,60 150,70 Q170,90 160,110 Q130,100 110,80 Q100,100 80,80 Z",
  };

  const d = paths[variant] || paths.angel;

  return (
    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] pointer-events-none z-10 transition-all duration-1000 ${isMaster ? 'animate-pulse-slow' : ''}`}>
      <svg viewBox="0 0 300 200" className="w-full h-full drop-shadow-lg">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
        {/* Right Wing */}
        <path d={d} fill={color} transform={`translate(70, 0) scale(${scale})`} className="origin-center" />
        {/* Left Wing (Mirrored) */}
        <path d={d} fill={color} transform={`translate(230, 0) scale(-${scale}, ${scale})`} className="origin-center" />
      </svg>
    </div>
  );
};

// --- 3. ROYAL CROWN COMPONENT ---
const RoyalCrown = ({ variant = 'royal', tier = 3 }) => {
  if (tier < 3) return null; // Crown appears at Master (Tier 3)

  const paths = {
    royal: "M10,30 L10,10 L20,20 L30,0 L40,20 L50,10 L50,30 Z",
    spikes: "M10,30 L15,5 L20,30 L30,0 L40,30 L45,5 L50,30 Z",
    tech: "M10,30 L10,15 L20,15 L20,5 L40,5 L40,15 L50,15 L50,30 Z",
    halo: "M30,5 A25,10 0 1,1 29.9,5 Z", // Ellipse approximation
  };

  const d = paths[variant] || paths.royal;

  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-16 h-16 z-50 animate-float">
      <svg viewBox="0 0 60 40" className="w-full h-full drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
        <path d={d} fill="url(#goldGradient)" stroke="#F59E0B" strokeWidth="1" />
        {/* Gems on crown */}
        <circle cx="30" cy="15" r="3" fill="#EF4444" className="animate-pulse" />
        <circle cx="15" cy="20" r="2" fill="#3B82F6" />
        <circle cx="45" cy="20" r="2" fill="#3B82F6" />
      </svg>
    </div>
  );
};

// --- 4. CORE MEDALLION ---
const Medallion = ({ tier, shapeId, icon: Icon, gradient, accentColor, username, variant }) => {
  // Tier 0: Stone (Locked)
  // Tier 1: Bronze (Novice)
  // Tier 2: Silver (Expert)
  // Tier 3: Gold (Master)

  const isLocked = tier === 0;
  const isMaster = tier === 3;

  // Dynamic Styles based on Tier
  const baseGradient = isLocked
    ? 'bg-slate-700'
    : tier === 1
      ? 'bg-gradient-to-br from-orange-700 to-orange-900' // Bronze
      : tier === 2
        ? 'bg-gradient-to-br from-slate-300 to-slate-500' // Silver
        : 'bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700'; // Gold

  const borderStyle = isLocked
    ? 'border-slate-600'
    : tier === 1
      ? 'border-orange-800'
      : tier === 2
        ? 'border-slate-400'
        : 'border-yellow-400';

  const glowEffect = isMaster
    ? 'shadow-[0_0_50px_rgba(251,191,36,0.6)]'
    : tier === 2
      ? 'shadow-[0_0_30px_rgba(148,163,184,0.4)]'
      : isLocked
        ? ''
        : 'shadow-[0_0_15px_rgba(194,65,12,0.3)]';

  // Shape Logic (Simplified for SVG usage)
  const getShapePath = () => {
    // Map shapeId to SVG paths
    const shapes = {
      starburst: "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z", // 5-point star approx
      hexagon: "M50 0 L93 25 L93 75 L50 100 L7 75 L7 25 Z",
      shield: "M50 0 L90 10 L90 40 Q90 80 50 100 Q10 80 10 40 L10 10 Z",
      diamond: "M50 0 L100 50 L50 100 L0 50 Z",
      circle: "M50 0 A50 50 0 1 1 49.9 0 Z", // Circle
    };
    return shapes[shapeId] || shapes.circle;
  };

  const pathD = getShapePath();

  return (
    <div className={`relative w-32 h-32 flex items-center justify-center transition-transform duration-500 ${isMaster ? 'hover:scale-110' : ''}`}>

      {/* 1. God Rays (Background) */}
      {isMaster && <GodRays color="gold" />}
      {tier === 2 && <GodRays color="silver" />}

      {/* 2. Wings (Mid-ground) */}
      <WingSet variant={variant.wings} tier={tier} />

      {/* 3. Base Plate (The Badge Itself) */}
      <div className={`relative z-20 w-24 h-24 ${glowEffect} rounded-full flex items-center justify-center`}>
        {/* SVG Shape Container */}
        <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-2xl ${isLocked ? 'text-slate-800' : tier === 3 ? 'text-amber-500' : tier === 2 ? 'text-slate-300' : 'text-orange-800'}`}>
          <defs>
            <linearGradient id="metalShine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="transparent" />
              <stop offset="100%" stopColor="black" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d={pathD} fill="currentColor" />
          {/* Overlay Shine */}
          <path d={pathD} fill="url(#metalShine)" className="mix-blend-overlay" />
        </svg>

        {/* 4. Gemstone (Core) */}
        <div className={`absolute inset-0 flex items-center justify-center`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 ${borderStyle} ${isLocked ? 'bg-slate-900' : 'bg-slate-900'}`}>
            {/* Gem Gradient */}
            {!isLocked && (
              <div className={`absolute inset-0 opacity-80 ${gradient}`} />
            )}
            {/* Facets */}
            {!isLocked && (
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay" />
            )}
            {/* Icon */}
            <Icon size={24} className={`relative z-10 ${isLocked ? 'text-slate-700' : 'text-white drop-shadow-md'}`} />

            {/* Shine Animation */}
            {isMaster && (
              <div className="absolute inset-0 bg-white/30 animate-[shine_3s_infinite] -skew-x-12 translate-x-[-150%]" />
            )}
          </div>
        </div>

        {/* 5. Crown (Top-most) */}
        <RoyalCrown variant={variant.crown} tier={tier} />

        {/* 6. Engraved Name (Bottom Curve) */}
        {tier >= 2 && (
          <div className="absolute -bottom-6 w-40 text-center">
            <svg viewBox="0 0 200 60" className="w-full h-full">
              <path id="curve" d="M20,20 Q100,50 180,20" fill="transparent" />
              <text width="200">
                <textPath href="#curve" startOffset="50%" textAnchor="middle" className={`text-[14px] font-cinzel font-bold fill-current ${isMaster ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]' : 'text-slate-300'}`}>
                  {username.toUpperCase()}
                </textPath>
              </text>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 5. MAIN SHOWCASE COMPONENT ---
const StageBadgeShowcase = ({
  stages = [],
  masteryTracking = {},
  username = 'Eroul',
  debugMode = false,
}) => {
  const [debugTier, setDebugTier] = useState(3);

  // Define Badge Variants (Themes)
  const badgeThemes = {
    'aurora': { wings: 'angel', crown: 'halo', shape: 'starburst' },
    'nebula': { wings: 'tech', crown: 'tech', shape: 'hexagon' },
    'constellation': { wings: 'dragon', crown: 'royal', shape: 'shield' },
    'celestial': { wings: 'fairy', crown: 'spikes', shape: 'diamond' },
  };

  const getVariant = (index) => {
    const keys = Object.keys(badgeThemes);
    return badgeThemes[keys[index % keys.length]];
  };

  return (
    <div className="w-full p-8 bg-slate-900/90 rounded-3xl border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white font-cinzel mb-2 flex items-center justify-center gap-3">
          <Crown className="text-amber-500" /> Sala Trofeelor <Crown className="text-amber-500" />
        </h2>
        <p className="text-indigo-300 font-cinzel">Colecția ta de artefacte legendare</p>
      </div>

      {debugMode && (
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(t => (
            <button
              key={t}
              onClick={() => setDebugTier(t)}
              className={`px-4 py-2 rounded-xl font-bold ${debugTier === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Tier {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
        {stages.map((stage, index) => {
          // Determine Tier
          let tier = 0;
          if (stage.mastered) tier = 3;
          else if (stage.unlocked) {
            const runs = stage.highAccuracyRuns || 0;
            if (runs > 0) tier = 2;
            else tier = 1;
          }

          if (debugMode) tier = debugTier;

          const variant = getVariant(index);

          // Resolve Icon Component
          let BadgeIcon = Star;
          if (stage.badge?.icon) {
            if (typeof stage.badge.icon === 'string') {
              BadgeIcon = ICON_MAP[stage.badge.icon] || Star;
            } else {
              BadgeIcon = stage.badge.icon;
            }
          }

          return (
            <div key={stage.id} className="flex flex-col items-center gap-12 group">
              <Medallion
                tier={tier}
                shapeId={variant.shape}
                icon={BadgeIcon}
                gradient={stage.badge?.gradient || 'bg-gradient-to-br from-indigo-500 to-purple-600'}
                accentColor={stage.badge?.accent || '#6366f1'}
                username={username}
                variant={variant}
              />

              <div className="text-center relative z-30 mt-4">
                <h3 className={`text-lg font-bold font-cinzel ${tier === 0 ? 'text-slate-600' : tier === 3 ? 'text-amber-400' : 'text-white'}`}>
                  {stage.badge?.name || stage.label}
                </h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                  {tier === 0 ? 'Sigilat' : tier === 1 ? 'Novice' : tier === 2 ? 'Expert' : 'Maestru Celest'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StageBadgeShowcase;
