// Wrapper for the remote Gemini plan endpoint with rate-limit awareness.
export const ENDPOINT = "https://ionutbogdan.ro/api/gemini/plan";

export async function fetchGeminiPlan({
  model = "gemini-2.5-pro",
  prompt,
  allowFallback = true,
  signal,
}) {
  const body = {
    model,
    prompt,
    allow_fallback: allowFallback,
  };

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      mode: "cors",
      credentials: "omit",
      signal,
    });
  } catch (error) {
    return {
      ok: false,
      rateLimited: false,
      error: "network-error",
      details: String(error),
    };
  }

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (response.status === 200 && json) {
    return {
      ok: true,
      data: json,
      meta: json?._meta,
    };
  }

  if (response.status === 429) {
    const headerRetry = Number(response.headers.get("Retry-After") ?? "0");
    const bodyRetry = Number(json?.retry_in_seconds ?? 0);
    const retryIn = Math.max(headerRetry || 0, bodyRetry || 0) || 45;
    return {
      ok: false,
      rateLimited: true,
      retryInSeconds: retryIn,
      upstream: json,
    };
  }

  return {
    ok: false,
    rateLimited: false,
    error: `upstream-${response.status}`,
    details: json ?? null,
  };
}

export default fetchGeminiPlan;
