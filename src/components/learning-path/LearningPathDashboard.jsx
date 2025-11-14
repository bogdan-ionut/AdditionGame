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
} from 'lucide-react';
import LearningPathCard from './LearningPathCard.jsx';
import { groupPathsByOperation, LEARNING_PATH_STATUS } from '../../lib/learningPaths.js';

const OPERATION_ICONS = {
  addition: Plus,
  subtraction: Minus,
  multiplication: Multiply,
  division: Divide,
};

const QUICK_CARD_STATUS_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  slate: 'bg-slate-100 text-slate-700',
  sky: 'bg-sky-50 text-sky-700',
};

const getStatusMeta = (statusKey) => {
  const meta = LEARNING_PATH_STATUS[statusKey] || {
    label: 'În curând',
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
      className={`rounded-xl border bg-white px-4 py-5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
        isActive ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.toneStyles}`}
            >
              <Sparkles size={14} />
              {statusMeta.label}
            </span>
            {path.recommendedAges ? (
              <span className="text-xs font-medium text-slate-500">{path.recommendedAges}</span>
            ) : null}
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{path.title}</h3>
            {path.description && <p className="text-sm text-slate-600">{path.description}</p>}
          </div>

          {keyPoints.length > 0 && (
            <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {keyPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handlePreview();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            <MousePointerClick size={14} />
            Vezi detalii
          </button>

          {isAvailable ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLaunch(path);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Pornește
              <ArrowUpRight size={16} />
            </button>
          ) : (
            statusMeta.message && (
              <p className="max-w-[220px] text-left text-xs text-slate-500">{statusMeta.message}</p>
            )
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

  const categorizedPaths = useMemo(() => {
    const sections = [
      {
        id: 'ready',
        title: 'Disponibile acum',
        description: 'Trasee gata de lansat pentru sesiunea de astăzi.',
        statuses: ['available'],
      },
      {
        id: 'pilot',
        title: 'În testare',
        description: 'Suntem încă în lucru pe baza feedback-ului profesorilor.',
        statuses: ['research'],
      },
      {
        id: 'in-design',
        title: 'În lucru',
        description: 'Pregătim materiale și jocuri noi pentru acest modul.',
        statuses: ['in-design'],
      },
      {
        id: 'coming-soon',
        title: 'În curând',
        description: 'Primești un preview al etapelor la care lucrăm.',
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

  const runtimeBadges = useMemo(() => {
    if (!runtimeInfo || typeof runtimeInfo !== 'object') {
      return [];
    }
    const planning = runtimeInfo.planning_model || runtimeInfo.planningModel || null;
    const sprite = runtimeInfo.sprite_model || runtimeInfo.spriteModel || null;
    const tts = runtimeInfo.tts_model || runtimeInfo.ttsModel || null;
    const badges = [
      planning ? { key: 'planner', label: 'Planificator', value: planning } : null,
      sprite ? { key: 'sprites', label: 'Personaje', value: sprite } : null,
      tts ? { key: 'tts', label: 'Voce', value: tts } : null,
    ].filter(Boolean);
    return badges;
  }, [runtimeInfo]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold">Alege aventura de exersare</h1>
            <button
              type="button"
              onClick={onOpenAiSettings}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Setări AI
            </button>
          </div>
          <p className="max-w-3xl text-base text-slate-600">
            Explorează traseele disponibile și pornește rapid exercițiile potrivite pentru copilul tău. Menținem designul simplu
            și familiar cu restul aplicației pentru a putea ajunge mai repede în joc.
          </p>
          {runtimeBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {runtimeBadges.map((badge) => (
                <span
                  key={badge.key}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  {badge.label}: {badge.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {!runtimeInfo?.ok && (
          <div className="mt-8 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{runtimeInfo?.note || 'Configurează cheia Gemini în setările AI pentru a activa vocea și planificarea personalizată.'}</span>
            <button
              type="button"
              onClick={onOpenAiSettings}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Deschide setările AI
            </button>
          </div>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operații</p>
            <div className="flex flex-col gap-2">
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
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                      isActive
                        ? 'border-slate-900 bg-white text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="rounded-md bg-slate-100 p-2 text-slate-700">
                        <OperationIcon size={18} />
                      </span>
                      <span className="text-sm font-semibold">{operation.label}</span>
                    </span>
                    <span className="text-xs text-slate-500">{operation.focusAges}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trasee de învățare</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {activeOperation?.label ?? 'Trasee disponibile'}
                </h2>
              </div>
              <span className="text-xs text-slate-500">Alege un card pentru a vedea detalii și pentru a porni modulul.</span>
            </div>

            {filteredPaths.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                Lucrăm la conținut nou pentru această operație. Revino în curând!
              </div>
            ) : (
              <div className="space-y-8">
                {categorizedPaths.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                      <p className="text-sm text-slate-600">{section.description}</p>
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
        </div>

        {previewPath && (
          <section className="mt-12 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalii traseu</p>
                <h3 className="text-2xl font-semibold text-slate-900">{previewPath.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPathId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <X size={14} />
                Ascunde preview
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <LearningPathCard path={previewPath} onSelect={onSelectPath} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default LearningPathDashboard;
