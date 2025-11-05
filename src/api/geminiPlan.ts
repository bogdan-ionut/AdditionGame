export type PlanOK = { ok: true; data: any; meta?: { used_model?: string; fallbackFrom?: string } };
export type Plan429 = { ok: false; rateLimited: true; retryInSeconds: number; upstream?: any };
export type PlanErr = { ok: false; rateLimited: false; error: string; details?: any };
export type PlanResult = PlanOK | Plan429 | PlanErr;

const ENDPOINT = "https://ionutbogdan.ro/api/gemini/plan";

export async function fetchGeminiPlan(
  prompt: string,
  model: string,
): Promise<PlanResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, allow_fallback: true }),
      mode: "cors",
      credentials: "omit",
    });
  } catch (e: any) {
    return { ok: false, rateLimited: false, error: "network-error", details: String(e) };
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }

  if (res.status === 200 && json) {
    return { ok: true, data: json, meta: json?._meta };
  }

  if (res.status === 429) {
    const hdr = Number(res.headers.get("Retry-After") ?? "0");
    const body = Number(json?.retry_in_seconds ?? 0);
    return { ok: false, rateLimited: true, retryInSeconds: Math.max(hdr, body) || 45, upstream: json };
  }

  return { ok: false, rateLimited: false, error: "upstream-" + res.status, details: json ?? null };
}

export default fetchGeminiPlan;
