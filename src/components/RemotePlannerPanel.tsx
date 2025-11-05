import React from "react";
import { useGeminiPlan } from "../hooks/useGeminiPlan";

export function RemotePlannerPanel() {
  const { status, data, error, retryIn, meta, isFallback, requestPlan } = useGeminiPlan();

  return (
    <div className="rounded-2xl border p-4 bg-white/70 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Remote Planner</h3>
        {isFallback && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-sky-700 border-sky-300 bg-sky-50">
            ⚡ fast fallback (<code>{meta?.used_model}</code>)
          </span>
        )}
      </div>

      <button
        onClick={() => requestPlan("Adaptive plan for 0..9 addition using child interests.")}
        className="mt-3 rounded-lg px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        disabled={status === "loading" || status === "rate-limited"}
      >
        {status === "loading"
          ? "Planning…"
          : status === "rate-limited"
          ? `Rate limited… (${retryIn}s)`
          : "AI Path Session"}
      </button>

      {status === "rate-limited" && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
          <div className="font-medium">Atingem limita temporară a API-ului.</div>
          <div>Reîncearcă în <b>{retryIn}s</b>. Între timp, folosim <i>planul local</i>.</div>
        </div>
      )}

      {status === "ok" && (
        <pre className="mt-3 max-h-56 overflow-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      {status === "error" && (
        <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-800 text-sm">
          <div className="font-medium">Eroare la planner</div>
          <pre className="mt-1 text-xs opacity-80">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default RemotePlannerPanel;
