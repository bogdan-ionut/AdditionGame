import { useMemo, useState } from 'react';
import { Bug, ChevronDown, ChevronRight, Sparkles, Activity, AlertTriangle } from 'lucide-react';
import { clearSpriteCache } from '../lib/spriteCache';

function formatTimestamp(value) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    return '—';
  }
}

function StatusPill({ label, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone] || toneClasses.default}`}>
      {label}
    </span>
  );
}

export default function ThemeDebugPanel({ activeTheme, motifHints = [], themePacks = [], debug }) {
  const [expanded, setExpanded] = useState(false);
  const onDevice = debug?.onDevice || null;
  const remote = debug?.remote || null;
  const final = debug?.final || null;

  const motifPreview = useMemo(() => motifHints.filter(Boolean).slice(0, 6), [motifHints]);
  const packPreview = useMemo(
    () => (Array.isArray(themePacks) ? themePacks : []).slice(0, 6),
    [themePacks],
  );

  const nanoStatus = useMemo(() => {
    if (!onDevice) return { label: 'Not attempted', tone: 'default' };
    if (!onDevice.available) return { label: 'Gemini Nano unavailable', tone: 'warning' };
    if (onDevice.error) return { label: 'Error', tone: 'danger' };
    if (onDevice.returnedCount > 0) return { label: 'On-device packs ready', tone: 'success' };
    if (onDevice.attempted) return { label: 'Attempted with no packs', tone: 'warning' };
    return { label: 'Available', tone: 'default' };
  }, [onDevice]);

  const rawPreview = useMemo(() => {
    if (!onDevice?.rawText) return null;
    const trimmed = onDevice.rawText.trim();
    if (trimmed.length <= 280) return trimmed;
    return `${trimmed.slice(0, 280)}…`;
  }, [onDevice?.rawText]);

  const showPanel = debug || activeTheme;
  if (!showPanel) return null;

  return (
    <div className="w-full max-w-2xl mb-4">
      <div className="rounded-2xl border border-indigo-100 bg-white/80 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-indigo-50/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Bug size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">Gemini Nano Theme Debug</span>
              <span className="text-xs text-slate-500">
                Active theme: {activeTheme?.label || '—'} · Model: {final?.model || onDevice?.model || remote?.model || '—'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label={nanoStatus.label} tone={nanoStatus.tone} />
            {expanded ? <ChevronDown size={18} className="text-indigo-500" /> : <ChevronRight size={18} className="text-indigo-500" />}
          </div>
        </button>
        {expanded && (
          <div className="space-y-4 border-t border-indigo-100 px-4 py-4 text-sm text-slate-600">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 underline"
                onClick={() => {
                  clearSpriteCache();
                  alert('Sprite cache cleared.');
                }}
              >
                Clear sprites cache
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Sparkles size={14} /> Final Theme Snapshot
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Theme label</span>
                    <span className="font-semibold text-slate-800">{activeTheme?.label || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Source model</span>
                    <span className="font-semibold text-slate-800">{final?.model || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Theme pack count</span>
                    <span className="font-semibold text-slate-800">{final?.themeCount ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Motif count</span>
                    <span className="font-semibold text-slate-800">{final?.motifCount ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Updated</span>
                    <span className="font-semibold text-slate-800">{formatTimestamp(debug?.updatedAt)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Activity size={14} /> Interest Signals
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Motif hints</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {motifPreview.length ? (
                        motifPreview.map((hint) => (
                          <span key={hint} className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-indigo-600">
                            {hint}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Theme packs</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {packPreview.length ? (
                        packPreview.map((pack) => (
                          <span
                            key={pack.key}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700"
                          >
                            <span aria-hidden>{pack.icons?.[0] || '⭐'}</span>
                            {pack.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Bug size={14} /> Gemini Nano (on-device)
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span>Status</span><StatusPill label={nanoStatus.label} tone={nanoStatus.tone} /></div>
                  <div className="flex items-center justify-between"><span>Attempted</span><span className="font-semibold text-slate-800">{onDevice?.attempted ? 'Yes' : 'No'}</span></div>
                  <div className="flex items-center justify-between"><span>Parsed packs</span><span className="font-semibold text-slate-800">{onDevice?.parsedCount ?? '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Returned packs</span><span className="font-semibold text-slate-800">{onDevice?.returnedCount ?? '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Model</span><span className="font-semibold text-slate-800">{onDevice?.model || '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Timestamp</span><span className="font-semibold text-slate-800">{formatTimestamp(onDevice?.timestamp)}</span></div>
                  {onDevice?.error && (
                    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/80 p-2 text-rose-600">
                      <AlertTriangle size={14} className="mt-0.5" />
                      <span className="text-xs">{onDevice.error}</span>
                    </div>
                  )}
                  {rawPreview && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Raw response preview</div>
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] leading-tight text-slate-600">{rawPreview}</pre>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Activity size={14} /> Remote planner
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span>Model</span><span className="font-semibold text-slate-800">{remote?.model || '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Motif count</span><span className="font-semibold text-slate-800">{remote?.motifCount ?? '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Theme pack count</span><span className="font-semibold text-slate-800">{remote?.themeCount ?? '—'}</span></div>
                  {!remote && <div className="text-xs text-slate-400">No remote response recorded.</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
