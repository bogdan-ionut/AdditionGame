import { ArrowRight, Sparkles } from 'lucide-react';
import { LEARNING_PATH_STATUS } from '../../lib/learningPaths.js';

const STATUS_STYLES = {
  emerald: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/60',
    card: 'border-emerald-200/60 shadow-lg shadow-emerald-100/50',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    button: 'bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-amber-200/60',
    card: 'border-amber-200/60 shadow-lg shadow-amber-100/50',
  },
  indigo: {
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/60',
    card: 'border-indigo-200/60 shadow-lg shadow-indigo-100/50',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    button: 'bg-slate-200 text-slate-500 cursor-not-allowed',
    card: 'border-slate-200/60 shadow-md shadow-slate-200/40',
  },
  sky: {
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    button: 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-200/60',
    card: 'border-sky-200/60 shadow-lg shadow-sky-100/50',
  },
};

const defaultStatus = {
  label: 'În curând',
  cta: 'Previzualizare',
  tone: 'slate',
  message: 'Lucrăm la acest traseu de învățare chiar acum.',
};

const buildStatusMeta = (statusKey) => {
  const meta = LEARNING_PATH_STATUS[statusKey] || defaultStatus;
  const toneStyles = STATUS_STYLES[meta.tone] || STATUS_STYLES.slate;
  return { ...meta, toneStyles };
};

const LearningPathCard = ({ path, onSelect }) => {
  const statusMeta = buildStatusMeta(path.status);
  const isAvailable = path.status === 'available';
  const cardStyles = statusMeta.toneStyles.card;
  const badgeStyles = statusMeta.toneStyles.badge;
  const buttonStyles = statusMeta.toneStyles.button;

  const handleSelect = () => {
    if (!isAvailable) return;
    onSelect?.(path);
  };

  return (
    <div className={`relative rounded-3xl border bg-white/90 backdrop-blur p-8 transition-shadow ${cardStyles}`}>
      <div className="absolute right-6 top-6">
        <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full border ${badgeStyles}`}>
          <Sparkles size={14} />
          {statusMeta.label}
        </span>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-slate-900">{path.title}</h3>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">{path.description}</p>
        </div>

        {Array.isArray(path.badges) && path.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {path.badges.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wide"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {Array.isArray(path.learningObjectives) && path.learningObjectives.length > 0 && (
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-4 space-y-2">
            {path.learningObjectives.map((objective) => (
              <div key={objective} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <span>{objective}</span>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(path.milestones) && path.milestones.length > 0 && (
          <div className="space-y-3">
            {path.milestones.map(({ title, detail }) => (
              <div key={`${path.id}-${title}`} className="bg-white/70 border border-slate-200/60 rounded-2xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-800">{title}</div>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recomandat: {path.recommendedAges}</div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-500 flex-1">{statusMeta.message}</p>
            <button
              onClick={handleSelect}
              disabled={!isAvailable}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${buttonStyles}`}
            >
              <span>{isAvailable ? 'Pornește traseul' : statusMeta.cta}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {!isAvailable && path.previewContent && (
          <div className="bg-gradient-to-br from-slate-900/5 via-slate-900/2 to-slate-900/5 border border-slate-200/60 rounded-2xl p-4 text-sm text-slate-600">
            {path.previewContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPathCard;
