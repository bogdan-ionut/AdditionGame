import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Minus,
  Divide,
  X as Multiply,
  Sparkles,
  Compass,
  Clock,
  ChevronRight,
  ArrowUpRight,
  MousePointerClick,
  Layers,
  Gauge,
  X,
} from 'lucide-react';
import LearningPathCard from './LearningPathCard.jsx';
import { groupPathsByOperation, LEARNING_PATH_STATUS } from '../../lib/learningPaths.js';
import AiOfflineBanner from '../AiOfflineBanner.jsx';

const OPERATION_ICONS = {
  addition: Plus,
  subtraction: Minus,
  multiplication: Multiply,
  division: Divide,
};

const QUICK_CARD_STATUS_STYLES = {
  emerald: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  amber: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  indigo: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200',
  slate: 'border-slate-500/30 bg-slate-600/10 text-slate-200',
  sky: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
};

const getStatusMeta = (statusKey) => {
  const meta = LEARNING_PATH_STATUS[statusKey] || {
    label: 'Coming Soon',
    tone: 'slate',
  };

  return {
    ...meta,
    toneStyles: QUICK_CARD_STATUS_STYLES[meta.tone] || QUICK_CARD_STATUS_STYLES.slate,
  };
};

const QuickPathCard = ({ path, isActive, onPreview, onLaunch }) => {
  const statusMeta = getStatusMeta(path.status);
  const isAvailable = path.status === 'available';
  const keyPoints = Array.isArray(path.learningObjectives)
    ? path.learningObjectives.slice(0, 2)
    : [];

  const handlePreview = () => {
    onPreview(path);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handlePreview}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handlePreview();
        }
      }}
      className={`group relative overflow-hidden rounded-3xl border bg-slate-900/70 p-6 text-left transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        isActive ? 'border-emerald-400/60 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.6)]' : 'border-slate-800/80'
      }`}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-x-6 top-6 h-32 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent blur-xl" />
      </div>

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusMeta.toneStyles}`}>
              <Sparkles size={14} />
              {statusMeta.label}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{path.recommendedAges}</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white md:text-xl">{path.title}</h3>
            <p className="text-sm text-slate-300/90 md:text-base md:leading-relaxed">{path.description}</p>
          </div>

          {keyPoints.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {keyPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-3 text-sm text-slate-300/80"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-4 md:items-end">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handlePreview();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200"
          >
            <MousePointerClick size={14} />
            Peek flow
          </button>

          {isAvailable ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLaunch(path);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-300"
            >
              Launch now
              <ArrowUpRight size={16} />
            </button>
          ) : (
            <div className="max-w-[220px] text-left text-xs text-slate-400">
              {statusMeta.message}
            </div>
          )}

          <ChevronRight
            size={18}
            className={`self-end transition-transform duration-300 ${
              isActive ? 'translate-x-0 text-emerald-300' : 'translate-x-1 text-slate-500 group-hover:translate-x-2 group-hover:text-emerald-200'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

const LearningPathDashboard = ({ operations, learningPaths, onSelectPath, aiOffline = false, onOpenAiSettings }) => {
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

  const categorizedPaths = useMemo(() => {
    const sections = [
      {
        id: 'ready',
        title: 'Ready to Play',
        description: 'Launch these adventures instantly with adaptive guidance and reporting.',
        statuses: ['available'],
      },
      {
        id: 'pilot',
        title: 'In Pilot & Research',
        description: 'Educators are actively shaping these missions. Follow along and share feedback.',
        statuses: ['research'],
      },
      {
        id: 'in-design',
        title: 'In Design',
        description: 'Storyboards, manipulatives, and AI scaffolds are being crafted with experts.',
        statuses: ['in-design'],
      },
      {
        id: 'coming-soon',
        title: 'Coming Soon',
        description: 'Sneak a peek at the larger worlds we’re building next for confident learners.',
        statuses: ['coming-soon'],
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        paths: filteredPaths.filter((path) => section.statuses.includes(path.status)),
      }))
      .filter((section) => section.paths.length > 0);
  }, [filteredPaths]);

  useEffect(() => {
    if (!filteredPaths.some((path) => path.id === previewPathId)) {
      const nextPreview = categorizedPaths.find((section) => section.paths.length > 0)?.paths[0] ?? null;
      setPreviewPathId(nextPreview?.id ?? null);
    }
  }, [categorizedPaths, filteredPaths, previewPathId]);

  const previewPath = useMemo(
    () => learningPaths.find((path) => path.id === previewPathId) ?? filteredPaths[0] ?? null,
    [filteredPaths, learningPaths, previewPathId],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-sky-500/20 via-slate-900/40 to-slate-950 blur-3xl" />
      <div className="pointer-events-none absolute -left-48 top-40 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        {aiOffline && (
          <AiOfflineBanner onOpenSettings={onOpenAiSettings} />
        )}
        <header className="space-y-12">
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_120px_-60px_rgba(56,189,248,0.45)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
                <Sparkles size={14} className="text-amber-300" />
                Personalized Math Galaxy · 2025 Edition
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                <Gauge size={16} />
                Adaptive in under 3 minutes
              </div>
            </div>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
              <div className="space-y-6">
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Chart a Math Adventure That Learners Love to Replay
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Explore story-driven modes, adaptive practice, and hands-on missions designed with educators for the 2025 classroom and home. Pick a mode to preview key beats, then launch instantly when your learner is ready.
                </p>
                <div className="flex flex-col gap-3 text-sm text-slate-200 sm:flex-row">
                  <div className="inline-flex flex-1 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3">
                    <GraduationCap size={18} className="text-emerald-300" />
                    Mastery mapped to ages 3-14 and core standards.
                  </div>
                  <div className="inline-flex flex-1 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3">
                    <Compass size={18} className="text-sky-300" />
                    Narrative quests + AI planners keep practice joyful.
                  </div>
                  <div className="inline-flex flex-1 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3">
                    <Clock size={18} className="text-amber-300" />
                    Built for focused 10-minute learning bursts.
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-6 shadow-[0_25px_80px_-50px_rgba(16,185,129,0.8)]">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-emerald-100">Live Spotlight</h2>
                  <p className="text-sm leading-relaxed text-slate-200">
                    Addition • 0-9 Sums is fully playable today. Parents and educators can monitor mastery, assign quests, and celebrate streaks in real time.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const livePath = learningPaths.find((path) => path.status === 'available');
                      if (!livePath) return;
                      setActiveOperationId(livePath.operation);
                      setPreviewPathId(livePath.id);
                      onSelectPath?.(livePath);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
                  >
                    Jump into the live mode
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur">
            <div className="flex items-center gap-3 text-slate-200">
              <Layers size={18} className="text-sky-300" />
              Every mode is organized into stages with measurable wins. Hover or tap a tile to preview its flow.
            </div>
          </div>
        </header>

        <section className="grid gap-12 lg:grid-cols-[minmax(0,260px)_1fr] lg:items-start">
          <aside className="space-y-6">
            <div className="text-xs uppercase tracking-wide text-slate-400">Operations</div>
            <div className="grid gap-4">
              {operationList.map((operation) => {
                const OperationIcon = OPERATION_ICONS[operation.id] || GraduationCap;
                const isActive = operation.id === activeOperation?.id;
                return (
                  <button
                    key={operation.id}
                    type="button"
                    onClick={() => {
                      setActiveOperationId(operation.id);
                    }}
                    className={`group relative overflow-hidden rounded-3xl border px-5 py-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      isActive
                        ? 'border-sky-400/50 bg-sky-500/10 text-white shadow-[0_18px_60px_-40px_rgba(56,189,248,0.8)]'
                        : 'border-slate-800/80 bg-slate-900/70 text-slate-300 hover:border-sky-400/40 hover:bg-slate-900'
                    }`}
                  >
                    <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="absolute inset-x-4 top-4 h-24 rounded-3xl bg-gradient-to-br from-sky-500/20 via-transparent to-transparent blur-xl" />
                    </div>
                    <div className="relative space-y-3">
                      <div className="inline-flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-950/40 p-3 text-slate-200">
                          <OperationIcon size={22} />
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                          {operation.focusAges}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-white">{operation.label}</h2>
                        <p className="text-sm leading-relaxed text-slate-300/90">{operation.description}</p>
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-200">
                        {operation.highlight}
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Modes inside</div>
                <h3 className="text-2xl font-semibold text-white sm:text-3xl">
                  {activeOperation?.label ?? 'Learning Modes'}
                </h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Tap to preview · Launch instantly when ready
              </div>
            </div>

            {filteredPaths.length === 0 ? (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-10 text-center text-sm text-slate-300">
                More adventures for this operation are on the roadmap.
              </div>
            ) : (
              <div className="space-y-8">
                {categorizedPaths.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white">{section.title}</h4>
                      <p className="text-sm text-slate-300/80">{section.description}</p>
                    </div>
                    <div className="space-y-4">
                      {section.paths.map((path) => (
                        <QuickPathCard
                          key={path.id}
                          path={path}
                          isActive={previewPath?.id === path.id}
                          onPreview={(selectedPath) => setPreviewPathId(selectedPath.id)}
                          onLaunch={(selectedPath) => onSelectPath?.(selectedPath)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {previewPath && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Deep dive</div>
                <h3 className="text-2xl font-semibold text-white sm:text-3xl">{previewPath.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPathId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                <X size={14} />
                Collapse preview
              </button>
            </div>
            <div className="overflow-hidden rounded-[2.25rem] border border-slate-800/80 bg-slate-900/70 p-1">
              <LearningPathCard path={previewPath} onSelect={onSelectPath} />
            </div>
          </section>
        )}

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-slate-200 backdrop-blur lg:grid-cols-3">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-white">Evidence-based flow</h4>
            <p className="text-sm leading-relaxed text-slate-300/90">
              Every mission is co-designed with classroom educators and aligned to the science of learning—balancing spaced retrieval, storytelling, and feedback loops.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-white">Unified family dashboard</h4>
            <p className="text-sm leading-relaxed text-slate-300/90">
              Track streaks, celebrate achievements, and assign the next quest from a single view that works seamlessly across desktop, tablet, and mobile.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-white">Built for neurodiverse learners</h4>
            <p className="text-sm leading-relaxed text-slate-300/90">
              Choose between narration styles, movement breaks, and sensory-friendly themes so every learner feels seen and supported.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LearningPathDashboard;
