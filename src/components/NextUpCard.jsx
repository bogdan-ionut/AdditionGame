import { RefreshCw, PlayCircle, Sparkles } from 'lucide-react';

const formatPredicted = (item, fallbackPercent = 82) => {
  if (!item) return fallbackPercent;
  const value = item.predictedSuccess ?? item.difficulty;
  if (typeof value !== 'number' || Number.isNaN(value)) return fallbackPercent;
  return Math.round(value * 100);
};

export default function NextUpCard({
  item,
  story,
  loading,
  planSource,
  targetSuccess = 82,
  configured = false,
  onStartAiPath,
  onRefreshPlan,
}) {
  const predicted = formatPredicted(item, targetSuccess);
  const display = item?.display || (item ? `${item.a} + ${item.b}` : null);
  const showPlan = configured && !!item;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Sparkles className="text-indigo-500" size={18} />
          AI-Driven Next Step
        </h3>
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
          Target ≈{targetSuccess}%
        </span>
      </div>

      <div className="flex-1 bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-100 rounded-3xl p-5 shadow-inner">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-indigo-200/70 rounded" />
            <div className="h-10 bg-indigo-200/70 rounded" />
            <div className="h-4 bg-indigo-200/70 rounded w-1/2" />
          </div>
        ) : showPlan ? (
          <div className="space-y-3">
            {story && <p className="text-sm text-indigo-700 italic">{story}</p>}
            <div className="text-4xl font-extrabold text-gray-900 tracking-wide text-center">
              {display}
            </div>
            <div className="text-sm text-gray-600 text-center">
              Predicted success ≈{predicted}% · Plan source: {planSource || 'local planner'}
            </div>
            {item.hints?.length > 0 && (
              <div className="bg-white/70 border border-indigo-100 rounded-2xl p-3 text-xs text-gray-600 space-y-1">
                {item.hints.slice(0, 2).map((hint, index) => (
                  <p key={index}><span className="font-semibold text-indigo-600">Hint {index + 1}:</span> {hint}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              {configured
                ? 'Complete a few more practice rounds to teach the AI engine what feels “just right.”'
                : 'AI features are turned off. Paste your Gemini key and save model choices in AI Settings to unlock cloud-personalized planning. Until then, we will use the built-in planner.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onStartAiPath}
          disabled={!showPlan || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold shadow ${
            !showPlan || loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          <PlayCircle size={18} /> Start AI Path
        </button>
        <button
          onClick={onRefreshPlan}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-white border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          <RefreshCw size={16} /> Refresh Plan
        </button>
      </div>
    </div>
  );
}
