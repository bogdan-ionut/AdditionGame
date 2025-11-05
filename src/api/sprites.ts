import { getAiRuntime } from "../lib/ai/runtime";

const BATCH_ENDPOINT = "https://ionutbogdan.ro/api/gemini/sprites/batch";
const STEP_ENDPOINT = "https://ionutbogdan.ro/api/gemini/sprites/step";

export type SpriteRow = {
  interest: string;
  url?: string;
  cached?: boolean;
  error?: string;
};

export type SpriteJobPayload = {
  job_id: string;
  total?: number;
  completed?: number;
  pending?: number;
  done?: number;
  remaining?: number;
  sprites?: SpriteRow[];
};

export type SpriteJobSnapshot = {
  jobId: string;
  total: number;
  completed: number;
  pending: number;
  sprites: SpriteRow[];
};

export class SpriteRateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super("sprite-rate-limit");
    this.retryAfter = retryAfter;
  }
}

function parseRetryAfter(res: Response, body: any): number {
  const header = Number(res.headers.get("Retry-After") ?? "0");
  const payload = Number(body?.retry_after ?? body?.retryAfter ?? body?.retry_in_seconds ?? 0);
  const retry = Math.max(header, payload);
  return Number.isFinite(retry) && retry > 0 ? Math.round(retry) : 45;
}

function toSnapshot(payload: SpriteJobPayload, fallback?: SpriteJobSnapshot | null): SpriteJobSnapshot {
  const prev = fallback ?? null;
  const jobId = String(payload?.job_id ?? prev?.jobId ?? "");
  const completedRaw = payload?.completed ?? payload?.done ?? prev?.completed ?? 0;
  const pendingRaw = payload?.pending ?? payload?.remaining ?? prev?.pending ?? 0;
  const totalRaw = payload?.total ?? (prev ? prev.total : completedRaw + pendingRaw);

  const completed = Number.isFinite(Number(completedRaw)) ? Number(completedRaw) : prev?.completed ?? 0;
  const pending = Number.isFinite(Number(pendingRaw)) ? Number(pendingRaw) : Math.max((Number(totalRaw) || 0) - completed, 0);
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : completed + pending;

  const sprites = Array.isArray(payload?.sprites) ? payload.sprites : [];

  return {
    jobId,
    total: total < completed ? completed : total,
    completed: completed < 0 ? 0 : completed,
    pending: pending < 0 ? 0 : pending,
    sprites,
  };
}

async function request(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    mode: "cors",
    credentials: "omit",
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch (error) {
    json = null;
  }

  if (res.status === 429) {
    throw new SpriteRateLimitError(parseRetryAfter(res, json));
  }

  if (!res.ok || !json) {
    const error = new Error(`sprites-http-${res.status}`);
    (error as any).details = json;
    throw error;
  }

  return json;
}

export async function requestSpriteBatch(interests: string[]): Promise<SpriteJobSnapshot> {
  const runtime = await getAiRuntime();
  if (!runtime.aiEnabled || !runtime.spriteModel) {
    throw new Error("ai-disabled");
  }
  if (!Array.isArray(interests) || interests.length === 0) {
    throw new Error("interests-required");
  }

  const payload = await request(BATCH_ENDPOINT, { interests, model: runtime.spriteModel });
  return toSnapshot(payload, null);
}

export async function stepSpriteJob(jobId: string, limit = 1): Promise<SpriteJobSnapshot> {
  if (!jobId) {
    throw new Error("job-id-required");
  }

  const payload = await request(STEP_ENDPOINT, { job_id: jobId, limit });
  return toSnapshot(payload, { jobId, total: 0, completed: 0, pending: 0, sprites: [] });
}

export { toSnapshot as normalizeSpriteJob };
