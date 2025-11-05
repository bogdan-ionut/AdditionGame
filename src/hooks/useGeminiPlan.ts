import { useEffect, useRef, useState, useCallback } from "react";
import { fetchGeminiPlan } from "../api/geminiPlan";
import { getAiRuntime } from "../lib/ai/runtime";

type Status = "idle" | "loading" | "ok" | "rate-limited" | "error" | "disabled";

type Meta = { used_model?: string; fallbackFrom?: string } | undefined;

type ErrorState = any;

export function useGeminiPlan() {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<Meta>(undefined);
  const [error, setError] = useState<ErrorState>(null);
  const [retryIn, setRetryIn] = useState(0);
  const timerRef = useRef<number | null>(null);

  const checkStatus = useCallback(async () => {
    const runtime = await getAiRuntime();
    if (!runtime.aiEnabled) {
      setStatus("disabled");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (status !== "rate-limited" || retryIn <= 0) return;

    timerRef.current = window.setInterval(() => {
      setRetryIn((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, retryIn]);

  useEffect(() => {
    if (status === "rate-limited" && retryIn === 0 && timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [status, retryIn]);

  async function requestPlan(prompt: string) {
    const runtime = await getAiRuntime();
    if (!runtime.aiEnabled || !runtime.planningModel) {
      setStatus("disabled");
      setError({ message: "AI features are not configured." });
      return;
    }

    setStatus("loading");
    setError(null);
    setMeta(undefined);

    const result = await fetchGeminiPlan(prompt, runtime.planningModel);

    if (result.ok) {
      setData(result.data);
      setMeta(result.meta);
      setStatus("ok");
      return;
    }

    if (result.rateLimited) {
      setRetryIn(result.retryInSeconds);
      setStatus("rate-limited");
      return;
    }

    setError(result);
    setStatus("error");
  }

  return {
    status,
    data,
    error,
    retryIn,
    meta,
    requestPlan,
    isFallback: Boolean(meta?.used_model && meta.used_model !== "gemini-2.5-pro"),
  };
}

export default useGeminiPlan;
