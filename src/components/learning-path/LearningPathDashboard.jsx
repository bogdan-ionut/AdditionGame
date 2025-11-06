import { useMemo } from 'react';
import { GraduationCap, Plus, Minus, Divide, X as Multiply, Sparkles, Compass, Clock } from 'lucide-react';
import LearningPathCard from './LearningPathCard.jsx';
import { groupPathsByOperation } from '../../lib/learningPaths.js';

const OPERATION_ICONS = {
  addition: Plus,
  subtraction: Minus,
  multiplication: Multiply,
  division: Divide,
};

const LearningPathDashboard = ({ operations, learningPaths, onSelectPath }) => {
  const groupedPaths = useMemo(() => groupPathsByOperation(learningPaths), [learningPaths]);
  const operationList = useMemo(() => Object.values(operations), [operations]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
        <header className="text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700 text-sm font-semibold tracking-wide uppercase">
            <Sparkles size={16} className="text-amber-400" />
            Ages 2-14 Learning Universe
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Chart a Math Adventure That Grows with Your Learner
          </h1>
          <p className="max-w-3xl mx-auto text-slate-300 text-base md:text-lg leading-relaxed">
            Choose a path to begin. Addition within 10 is live today, and new journeys unlock soon—each blending playful narratives, adaptive practice, and parent insight tools.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 text-slate-300 text-sm">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700">
              <GraduationCap size={16} className="text-emerald-300" />
              Scaffolded by age bands and mastery data
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700">
              <Compass size={16} className="text-sky-300" />
              AI-personalized stories & practice plans
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700">
              <Clock size={16} className="text-amber-300" />
              Designed for 10-minute, high-impact sessions
            </div>
          </div>
        </header>

        {operationList.map((operation) => {
          const OperationIcon = OPERATION_ICONS[operation.id] || GraduationCap;
          const paths = groupedPaths[operation.id] || [];
          return (
            <section
              key={operation.id}
              className="rounded-3xl bg-slate-900/70 border border-slate-800 shadow-[0_30px_120px_-60px_rgba(15,23,42,0.9)]"
            >
              <div className="px-6 sm:px-10 py-8 border-b border-slate-800/70">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-3xl bg-slate-800 text-white shadow-inner">
                      <OperationIcon size={28} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold text-white">{operation.label}</h2>
                      <p className="text-slate-300 text-sm md:text-base leading-relaxed">{operation.description}</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 rounded-3xl px-4 py-3 text-sm text-slate-300">
                    <div className="font-semibold text-slate-100">{operation.focusAges}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">{operation.highlight}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-10">
                <div className="grid gap-8 md:grid-cols-2">
                  {paths.map((path) => (
                    <LearningPathCard key={path.id} path={path} onSelect={onSelectPath} />
                  ))}
                  {paths.length === 0 && (
                    <div className="text-slate-400 text-sm bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
                      More adventures for this operation are on the roadmap.
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default LearningPathDashboard;
