// src/hooks/useGeminiPlan.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { requestPlan as fetchPlan } from "../services/ai";
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
  const lastPromptRef = useRef<string | null>(null);

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
    if (status !== "rate-limited" || retryIn <= 0) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
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

  const requestPlan = useCallback(async (prompt: string) => {
    lastPromptRef.current = prompt;

    const runtime = await getAiRuntime();
    if (!runtime.aiEnabled) {
      setStatus("disabled");
      setError({ message: "AI features are not configured." });
      return;
    }

    setStatus("loading");
    setError(null);
    setMeta(undefined);

    try {
      const result = await fetchPlan(prompt);
      if (result.ok) {
        setData(result.data);
        setMeta(result.meta);
        setStatus("ok");
        setRetryIn(0);
      } else if (result.rateLimited) {
        setRetryIn(result.retryInSeconds);
        setStatus("rate-limited");
      } else {
        setError(result);
        setStatus("error");
      }
    } catch (e) {
      setError(e);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (status === "rate-limited" && retryIn === 0 && lastPromptRef.current) {
      requestPlan(lastPromptRef.current);
    }
  }, [status, retryIn, requestPlan]);

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
