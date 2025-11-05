import { useEffect } from "react";
import { useGeminiPlan } from "../hooks/useGeminiPlan";

const DEFAULT_PROMPT = "Make an adaptive plan for 0..9 addition (+ focus on interests if present).";

export default function RemotePlannerPanel({ prompt = DEFAULT_PROMPT }) {
  const { status, data, error, retryIn, meta, isFallback, requestPlan } = useGeminiPlan();

  useEffect(() => {
    if (status === "rate-limited" && retryIn === 0) {
      // The countdown finished; the next click can try again.
    }
  }, [status, retryIn]);

  async function handlePlanRequest() {
    await requestPlan(prompt, "gemini-2.5-pro");
  }

  return (
    <div className="w-full max-w-2xl mb-4">
      <div className="rounded-2xl border border-indigo-100 bg-white/80 shadow-sm backdrop-blur p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Remote Planner</h3>
          {isFallback && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-sky-700 border-sky-300 bg-sky-50">
              ⚡ fast fallback (<code>{meta?.used_model}</code>)
            </span>
          )}
        </div>
        <button
          onClick={handlePlanRequest}
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
            <div>
              Reîncearcă în <b>{retryIn}s</b>. Între timp, folosim <i>planul local</i>.
            </div>
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
    </div>
  );
}
