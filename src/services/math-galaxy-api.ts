// math-galaxy-api.ts
// Tiny SDK for Math Galaxy API (FastAPI @ Cloud Run)
import { joinApi, resolveApiBaseUrl, stripTrailingSlash } from "../lib/env";

export type Problem = { a: number; b: number; op?: string };
export type AttemptIn = {
  userId: string;
  game: string;                 // e.g. "addition-0-9"
  numbers?: [number, number];   // optional; SDK setează automat dacă vrei
  problem?: Problem;            // preferat: {a,b,op:'+'}
  userAnswer: number;
  correct: boolean;
  seconds?: number;             // one of seconds / elapsedMs is required
  elapsedMs?: number;
  device?: string;
  meta?: Record<string, any>;
};

export type ApiConfig = {
  baseUrl?: string;        // e.g. https://math-api-...a.run.app
  defaultUserId?: string;
  defaultGame?: string;    // e.g. "addition-0-9"
  defaultDevice?: string;
  timeoutMs?: number;      // default 7000
  retries?: number;        // default 1 (total 2 încercări)
};

type PostOpts = { beacon?: boolean };

const LSQ_KEY = "mgq_v1";

const MISSING_BASE_ERROR =
  "[MathGalaxyAPI] baseUrl is empty. Open AI Settings and set the Cloud API Base URL.";

export const BASE_URL = resolveApiBaseUrl();

export function requireApiUrl(): string {
  if (!BASE_URL) {
    console.warn(MISSING_BASE_ERROR);
  }
  return BASE_URL;
}

export type HeaderMap = Record<string, string>;

export type MathGalaxyJsonResult<T = unknown> = {
  data: T | null;
  response: Response;
};

export class MathGalaxyApiError extends Error {
  status?: number;
  data?: unknown;
  headers?: HeaderMap;

  constructor(
    message: string,
    options: { status?: number; data?: unknown; headers?: HeaderMap; cause?: unknown } = {},
  ) {
    super(message || 'Math Galaxy API error');
    this.name = 'MathGalaxyApiError';
    this.status = options.status;
    this.data = options.data;
    this.headers = options.headers;
    if (options.cause) {
      (this as any).cause = options.cause;
    }
  }
}

function detectBaseUrl(): string {
  return BASE_URL;
}

function defaultDevice(): string {
  try {
    const ua = navigator.userAgent || "unknown";
    return `web@${ua.slice(0, 40)}`;
  } catch {
    return "web";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadQueue(): AttemptIn[] {
  try {
    const raw = localStorage.getItem(LSQ_KEY);
    return raw ? (JSON.parse(raw) as AttemptIn[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: AttemptIn[]) {
  try {
    localStorage.setItem(LSQ_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

export class MathGalaxyAPI {
  readonly baseUrl: string;
  readonly cfg: Required<Omit<ApiConfig, "baseUrl">>;

  constructor(cfg: ApiConfig = {}) {
    const provided = typeof cfg.baseUrl === "string" ? stripTrailingSlash(cfg.baseUrl) : "";
    const fallback = stripTrailingSlash(detectBaseUrl() || "");
    const base = stripTrailingSlash(provided || fallback || "");
    if (!base) {
      requireApiUrl();
      throw new MathGalaxyApiError(
        MISSING_BASE_ERROR,
      );
    }

    this.baseUrl = base;
    this.cfg = {
      defaultUserId: cfg.defaultUserId ?? "",
      defaultGame: cfg.defaultGame ?? "addition-0-9",
      defaultDevice: cfg.defaultDevice ?? defaultDevice(),
      timeoutMs: cfg.timeoutMs ?? 7000,
      retries: cfg.retries ?? 1,
    };
  }

  /** Ping new API */
  async status<T = any>() {
    const { data } = await this.getWithMeta<T>("/v1/status");
    return data;
  }

  /** Health */
  async health<T = any>() {
    const { data } = await this.getWithMeta<T>("/health");
    return data;
  }

  async aiStatus<T = any>() {
    const { data } = await this.getWithMeta<T>("/v1/ai/status");
    return data;
  }

  async aiRuntime<T = any>(payload?: Record<string, unknown>) {
    if (payload && Object.keys(payload).length > 0) {
      return this.post<T>("/v1/ai/runtime", payload);
    }
    const { data } = await this.getWithMeta<T>("/v1/ai/runtime");
    return data;
  }

  async aiTtsModels<T = any>() {
    return this.get<T>("/v1/ai/tts/models");
  }

  async aiTtsVoices<T = any>(params: { mode?: string } = {}) {
    const search = new URLSearchParams();
    if (params.mode) {
      search.set("mode", params.mode);
    }
    const path = search.size ? `/v1/ai/tts/voices?${search.toString()}` : "/v1/ai/tts/voices";
    return this.get<T>(path);
  }

  async aiAudioSfx<T = any>(params: { mode?: string } = {}) {
    const search = new URLSearchParams();
    if (params.mode) {
      search.set("mode", params.mode);
    }
    const path = search.size ? `/v1/ai/audio/sfx?${search.toString()}` : "/v1/ai/audio/sfx";
    return this.get<T>(path);
  }

  async aiTtsSynthesize<T = any>(payload: Record<string, unknown>) {
    return this.post<T>("/v1/ai/tts/synthesize", payload);
  }

  async saveAiKey<T = any>(payload: Record<string, unknown>) {
    return this.post<T>("/v1/ai/key", payload);
  }

  async aiPlan<T = any>(payload: Record<string, unknown>) {
    return this.post<T>("/v1/ai/plan", payload);
  }

  async postSpriteInterests<T = any>(payload: Record<string, unknown>, init: RequestInit = {}) {
    return this.postWithMeta<T>("/v1/interests/packs", payload, init);
  }

  async getSpriteJob<T = any>(jobId: string) {
    if (!jobId) {
      throw new MathGalaxyApiError("jobId is required to fetch sprite job status.");
    }

    const encoded = encodeURIComponent(jobId);
    return this.getWithMeta<T>(`/v1/sprites/job_status?job_id=${encoded}`);
  }

  async postSpriteProcessJob<T = any>(jobId: string, payload: Record<string, unknown> = {}) {
    if (!jobId) {
      throw new MathGalaxyApiError("jobId is required to process sprite job.");
    }

    const body: Record<string, unknown> & { job_id?: string; jobId?: string } = { ...payload };
    if (typeof body.job_id !== "string" || !body.job_id.trim()) {
      body.job_id = jobId;
    }
    if (typeof body.jobId !== "string" || !body.jobId.trim()) {
      body.jobId = jobId;
    }

    return this.postWithMeta<T>("/v1/sprites/process_job", body);
  }

  /** Quick stats for a user */
  async getUserStats(userId: string, days = 30) {
    const u = encodeURIComponent(userId);
    const { data } = await this.getWithMeta(`/v1/sessions/user/${u}/stats?days=${days}`);
    return data;
  }

  /** High-level helper for + : a + b */
  async recordAdditionAttempt(params: {
    userId?: string;
    a: number;
    b: number;
    answer: number;
    correct: boolean;
    elapsedMs?: number;
    seconds?: number;
    game?: string;
    device?: string;
    meta?: Record<string, any>;
    beacon?: boolean; // if true, prefer sendBeacon
  }) {
    const {
      userId,
      a,
      b,
      answer,
      correct,
      elapsedMs,
      seconds,
      game,
      device,
      meta,
      beacon,
    } = params;

    const payload: AttemptIn = {
      userId: userId || this.cfg.defaultUserId || "anon",
      game: game || this.cfg.defaultGame,
      problem: { a, b, op: "+" },
      userAnswer: answer,
      correct,
      elapsedMs,
      seconds,
      device: device || this.cfg.defaultDevice,
      meta: meta || {},
    };

    return this.recordAttempt(payload, { beacon });
  }

  /** Low-level: mirrors FastAPI AttemptIn contract */
  async recordAttempt(body: AttemptIn, opts: PostOpts = {}) {
    if (body.seconds == null && body.elapsedMs == null) {
      const ms = (body as any).durationMs ?? body.meta?.durationMs;
      if (typeof ms === "number") body.elapsedMs = Math.round(ms);
    }

    body.device = body.device || this.cfg.defaultDevice;

    if (opts.beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      try {
        const url = joinApi(this.baseUrl, "/v1/sessions/attempt");
        const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        const ok = (navigator as any).sendBeacon(url, blob);
        if (ok) return { ok: true, transport: "beacon" };
      } catch {
        /* fall back */
      }
    }

    try {
      const res = await this.post("/v1/sessions/attempt", body);
      this.flushQueue().catch(() => {});
      return res;
    } catch (err) {
      try {
        const q = loadQueue();
        q.push(body);
        saveQueue(q);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  /** Try to send all queued attempts saved from offline/errors */
  async flushQueue() {
    const q = loadQueue();
    if (!q.length) return { sent: 0 };
    let sent = 0;
    const keep: AttemptIn[] = [];
    for (const item of q) {
      try {
        await this.post("/v1/sessions/attempt", item, { keepalive: true });
        sent++;
      } catch {
        keep.push(item);
      }
    }
    saveQueue(keep);
    return { sent, remaining: keep.length };
  }

  private async getWithMeta<T = unknown>(path: string, init: RequestInit = {}): Promise<MathGalaxyJsonResult<T>> {
    const response = await this.request(path, { ...init, method: "GET" });
    const data = await readResponseBody<T>(response);
    return { data: data as T | null, response };
  }

  private async postWithMeta<T = unknown>(
    path: string,
    body: unknown,
    init: RequestInit = {},
  ): Promise<MathGalaxyJsonResult<T>> {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const prepared: RequestInit & { method: string } = {
      ...init,
      method: "POST",
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    };
    const response = await this.request(path, prepared);
    const data = await readResponseBody<T>(response);
    return { data: data as T | null, response };
  }

  private async get<T = unknown>(path: string, init: RequestInit = {}) {
    const { data } = await this.getWithMeta<T>(path, init);
    return data as T;
  }

  private async post<T = unknown>(path: string, body: unknown, init: RequestInit = {}) {
    const { data } = await this.postWithMeta<T>(path, body, init);
    return data as T;
  }

  private async request(path: string, init: RequestInit & { method: string }): Promise<Response> {
    const url = joinApi(this.baseUrl, path);
    let attempt = 0;
    let lastErr: MathGalaxyApiError | null = null;

    while (attempt <= this.cfg.retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        const headers = new Headers(init.headers ?? {});
        if (!headers.has("Accept")) {
          headers.set("Accept", "application/json");
        }
        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          throw await this.buildHttpError(response);
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        const normalized =
          error instanceof MathGalaxyApiError
            ? error
            : new MathGalaxyApiError(
                error instanceof Error ? error.message : "Network error",
                { cause: error },
              );

        if (normalized.status != null) {
          throw normalized;
        }

        lastErr = normalized;
        if (attempt >= this.cfg.retries) {
          throw normalized;
        }

        await sleep(250 * (attempt + 1));
      }
      attempt++;
    }

    throw lastErr ?? new MathGalaxyApiError("Network error");
  }

  private async buildHttpError(response: Response): Promise<MathGalaxyApiError> {
    const { data, raw } = await readResponseData(response);
    const headers = headersToObject(response.headers);
    const detail = extractErrorMessage(data) || raw;
    const message = detail?.trim?.() ? detail : `HTTP ${response.status} ${response.statusText}`;
    return new MathGalaxyApiError(message, {
      status: response.status,
      data,
      headers,
    });
  }
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function readResponseBody<T>(response: Response): Promise<T | null> {
  const { data } = await readResponseData(response);
  return (data as T | null) ?? null;
}

async function readResponseData(response: Response): Promise<{ raw: string; data: unknown }> {
  const raw = await safeText(response);
  if (!raw) {
    return { raw: "", data: null };
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return { raw, data: parseJsonSafe(raw) };
  }
  return { raw, data: raw };
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function headersToObject(headers: Headers): HeaderMap {
  const result: HeaderMap = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object") {
    const source = data as Record<string, unknown>;
    const fields = ["error", "message", "detail", "reason", "title"];
    for (const field of fields) {
      const value = source[field];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  return null;
}
