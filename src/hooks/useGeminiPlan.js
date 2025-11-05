import { useEffect, useRef, useState } from "react";
import { fetchGeminiPlan } from "../api/geminiPlan";

const DEFAULT_MODEL = "gemini-2.5-pro";

export function useGeminiPlan() {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryIn, setRetryIn] = useState(0);
  const [meta, setMeta] = useState(undefined);

  const timerRef = useRef(null);

  useEffect(() => {
    if (status !== "rate-limited" || retryIn <= 0) return;

    timerRef.current = window.setInterval(() => {
      setRetryIn((current) => (current > 0 ? current - 1 : 0));
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

  async function requestPlan(prompt, model = DEFAULT_MODEL) {
    setStatus("loading");
    setError(null);
    setMeta(undefined);

    const result = await fetchGeminiPlan({ prompt, model, allowFallback: true });

    if (result.ok) {
      setData(result.data);
      setMeta(result.meta);
      setStatus("ok");
      return result.data;
    }

    if (result.rateLimited) {
      setRetryIn(result.retryInSeconds);
      setStatus("rate-limited");
      return null;
    }

    setError(result);
    setStatus("error");
    return null;
  }

  return {
    status,
    data,
    error,
    retryIn,
    meta,
    requestPlan,
    isFallback: Boolean(meta?.used_model && meta.used_model !== DEFAULT_MODEL),
  };
}

export default useGeminiPlan;
