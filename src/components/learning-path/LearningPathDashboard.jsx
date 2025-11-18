import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Minus,
  Divide,
  X as Multiply,
  Sparkles,
  MousePointerClick,
  ArrowUpRight,
  X,
  BookOpen,
  Star,
  Zap,
  Crown
} from 'lucide-react';
import LearningPathCard from './LearningPathCard.jsx';
import { groupPathsByOperation, LEARNING_PATH_STATUS } from '../../lib/learningPaths.js';

const OPERATION_ICONS = {
  addition: Plus,
  subtraction: Minus,
  multiplication: Multiply,
  division: Divide,
};

const REALM_CONFIG = {
  addition: {
    title: 'Tărâmul Adunării',
    description: 'Unește forțele numerelor pentru a crea ceva mai mare.',
    color: 'from-orange-500 to-red-600',
    iconColor: 'text-orange-400',
    bgGlow: 'bg-orange-500/20'
  },
  subtraction: {
    title: 'Valea Diferențelor',
    description: 'Descoperă ce rămâne când norii se risipesc.',
    color: 'from-blue-500 to-cyan-600',
    iconColor: 'text-blue-400',
    bgGlow: 'bg-blue-500/20'
  },
  multiplication: {
    title: 'Turnul Multiplicării',
    description: 'Construiește rapid structuri înalte de numere.',
    color: 'from-purple-500 to-pink-600',
    iconColor: 'text-purple-400',
    bgGlow: 'bg-purple-500/20'
  },
  division: {
    title: 'Grădina Împărțirii',
    description: 'Împarte comorile în mod egal pentru toți.',
    color: 'from-emerald-500 to-teal-600',
    iconColor: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/20'
  }
};

const QuickPathCard = ({ path, isActive, onPreview, onLaunch }) => {
  const isAvailable = path.status === 'available';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPreview(path)}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 ${isActive
          ? 'border-amber-500/50 bg-slate-800/80 shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)] scale-[1.02]'
          : 'border-white/5 bg-slate-900/40 hover:border-white/20 hover:bg-slate-800/60 hover:-translate-y-1'
        }`}
    >
      {/* Glow Effect */}
      <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-45 group-hover:animate-[shine_1.5s_ease-in-out]" />

      <div className="relative p-6 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${isAvailable ? 'from-indigo-500/20 to-purple-500/20' : 'from-slate-700/20 to-slate-800/20'} border border-white/5`}>
            {isAvailable ? <Sparkles className="text-indigo-400" size={20} /> : <Star className="text-slate-500" size={20} />}
          </div>
          {path.recommendedAges && (
            <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">
              {path.recommendedAges}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-100 mb-2 font-cinzel leading-tight group-hover:text-amber-200 transition-colors">
          {path.title}
        </h3>
        <p className="text-sm text-slate-400 mb-6 line-clamp-2">
          {path.description}
        </p>

        <div className="mt-auto flex gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(path); }}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10 transition-colors"
          >
            Detalii
          </button>
          {isAvailable && (
            <button
              onClick={(e) => { e.stopPropagation(); onLaunch(path); }}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-orange-900/20 hover:shadow-orange-500/40 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={14} fill="currentColor" /> Joacă
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const LearningPathDashboard = ({
  operations,
  learningPaths,
  onSelectPath,
  onOpenAiSettings,
  runtimeInfo = null,
}) => {
  const groupedPaths = useMemo(() => groupPathsByOperation(learningPaths), [learningPaths]);
  const operationList = useMemo(() => Object.values(operations), [operations]);
  const [activeOperationId, setActiveOperationId] = useState(operationList[0]?.id ?? null);
  const [previewPathId, setPreviewPathId] = useState(null);

  const activeOperation = useMemo(
    () => operationList.find((operation) => operation.id === activeOperationId) ?? operationList[0] ?? null,
    [activeOperationId, operationList],
  );

  const filteredPaths = useMemo(() => {
    if (!activeOperation) return [];
    return groupedPaths[activeOperation.id] || [];
  }, [activeOperation, groupedPaths]);

  const previewPath = useMemo(
    () => learningPaths.find((path) => path.id === previewPathId),
    [learningPaths, previewPathId],
  );

  const realmTheme = REALM_CONFIG[activeOperationId] || REALM_CONFIG.addition;

  return (
    <div className="min-h-screen text-slate-200 pb-20">

      {/* --- HERO SECTION --- */}
      <div className="relative w-full h-[400px] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <Crown size={14} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">Bun venit, Eroule</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 drop-shadow-2xl mb-6 font-cinzel">
            Academia de Matematică
          </h1>

          <p className="max-w-2xl mx-auto text-lg text-slate-400 font-light leading-relaxed">
            Alege-ți calea, stăpânește artele numerice și colectează relicve legendare.
            Aventura ta începe aici.
          </p>

          <button
            onClick={onOpenAiSettings}
            className="mt-8 px-8 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 backdrop-blur-sm"
          >
            Setări Magice (AI)
          </button>
        </div>
      </div>

      {/* --- REALM SELECTOR (Operations) --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {operationList.map((op) => {
            const isActive = op.id === activeOperationId;
            const OpIcon = OPERATION_ICONS[op.id] || BookOpen;
            const config = REALM_CONFIG[op.id] || REALM_CONFIG.addition;

            return (
              <button
                key={op.id}
                onClick={() => { setActiveOperationId(op.id); setPreviewPathId(null); }}
                className={`relative group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 ${isActive
                    ? 'bg-slate-800 border-amber-500/50 shadow-lg shadow-amber-900/20 scale-105 z-10'
                    : 'bg-slate-900/60 border-white/5 hover:bg-slate-800 hover:border-white/20'
                  }`}
              >
                <div className={`p-4 rounded-full bg-slate-950 border border-white/10 mb-3 group-hover:scale-110 transition-transform ${isActive ? config.iconColor : 'text-slate-500'}`}>
                  <OpIcon size={24} />
                </div>
                <span className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {op.label}
                </span>
                {isActive && (
                  <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/20 pointer-events-none animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">

        <div className="flex flex-col md:flex-row gap-12">

          {/* LEFT: Quest List */}
          <div className="flex-1">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white font-cinzel mb-2 flex items-center gap-3">
                <span className={`w-2 h-8 rounded-full bg-gradient-to-b ${realmTheme.color}`} />
                {realmTheme.title}
              </h2>
              <p className="text-slate-400">{realmTheme.description}</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {filteredPaths.map((path) => (
                <QuickPathCard
                  key={path.id}
                  path={path}
                  isActive={previewPathId === path.id}
                  onPreview={(p) => setPreviewPathId(p.id)}
                  onLaunch={onSelectPath}
                />
              ))}
              {filteredPaths.length === 0 && (
                <div className="col-span-2 p-12 rounded-3xl border border-dashed border-white/10 bg-white/5 text-center">
                  <p className="text-slate-500">Acest tărâm este încă nedescoperit. Revino curând.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Mission Briefing (Preview) */}
          <div className="w-full md:w-[400px] xl:w-[450px] shrink-0">
            <div className="sticky top-8">
              {previewPath ? (
                <div className="rounded-3xl border border-white/10 bg-[#0F131F] overflow-hidden shadow-2xl ring-1 ring-white/5 animate-in slide-in-from-right-4 duration-500">
                  {/* Header Image / Gradient */}
                  <div className={`h-32 w-full bg-gradient-to-br ${realmTheme.color} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay" />
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0F131F] to-transparent" />
                    <div className="absolute bottom-4 left-6">
                      <span className="px-3 py-1 bg-black/30 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase text-white border border-white/10">
                        Misiune Activă
                      </span>
                    </div>
                  </div>

                  <div className="p-8 relative">
                    <button
                      onClick={() => setPreviewPathId(null)}
                      className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>

                    <h3 className="text-2xl font-bold text-white font-cinzel mb-4 leading-tight">
                      {previewPath.title}
                    </h3>

                    <div className="space-y-6">
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {previewPath.description}
                      </p>

                      {/* Objectives */}
                      {previewPath.learningObjectives && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Obiective</h4>
                          <ul className="space-y-2">
                            {previewPath.learningObjectives.map((obj, i) => (
                              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                {obj}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Button */}
                      {previewPath.status === 'available' ? (
                        <button
                          onClick={() => onSelectPath(previewPath)}
                          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold uppercase tracking-widest shadow-lg shadow-orange-900/40 hover:shadow-orange-500/60 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                          Începe Misiunea
                          <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>
                      ) : (
                        <div className="w-full py-4 rounded-xl border border-dashed border-white/10 text-center text-slate-500 text-sm font-medium">
                          Misiune Indisponibilă Momentan
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] rounded-3xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <MousePointerClick className="text-slate-600" size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">
                    Selectează o misiune din stânga pentru a vedea detaliile tactice.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LearningPathDashboard;
