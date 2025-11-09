// math-galaxy-api.ts
// Tiny SDK for Math Galaxy API (FastAPI @ Cloud Run)
import { joinApi, resolveApiBaseUrl, stripTrailingSlash } from "../lib/env";

const OFFLINE_EVENT = "ai:offline";
const ONLINE_EVENT = "ai:online";
const HEALTH_EVENT = "mg:health:updated";

let onlineNotified = false;

function emitOnline() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  if (onlineNotified) {
    return;
  }
  window.dispatchEvent(new Event(ONLINE_EVENT));
  onlineNotified = true;
}

function emitOffline(reason: unknown) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  onlineNotified = false;
  const detail = (() => {
    if (reason instanceof Error && reason.message) {
      return reason.message;
    }
    if (typeof reason === "string") {
      return reason;
    }
    try {
      return JSON.stringify(reason);
    } catch {
      return "AI offline";
    }
  })();
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail }));
}

export type MathGalaxyHealth = {
  ok: boolean;
  has_key: boolean;
  cors_ok: boolean;
  tts_ok: boolean;
  sprites_ok: boolean;
  lastCheckedAt: string | null;
};

const DEFAULT_HEALTH: MathGalaxyHealth = {
  ok: false,
  has_key: false,
  cors_ok: false,
  tts_ok: false,
  sprites_ok: false,
  lastCheckedAt: null,
};

function emitHealthUpdate(health: MathGalaxyHealth) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  window.dispatchEvent(new CustomEvent(HEALTH_EVENT, { detail: health }));
}

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
  const resolved = resolveApiBaseUrl();
  if (!resolved) {
    const error = new Error(MISSING_BASE_ERROR);
    emitOffline(error);
    throw error;
  }
  return stripTrailingSlash(resolved);
}

export type HeaderMap = Record<string, string>;

export type MathGalaxyJsonResult<T = unknown> = {
  data: T | null;
  response: Response;
};

export type SpritePrompt = {
  id: string;
  prompt: string;
  style?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
};

export async function request(
  path: string,
  init: RequestInit = {},
  baseOverride?: string | null,
): Promise<Response> {
  const base = baseOverride ?? resolveApiBaseUrl();
  if (!base) {
    throw new Error('Cloud AI base URL not configured');
  }

  const url = new URL(path, base).toString();
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...init,
      method: init.method ?? 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers,
    });

    if (!response.ok) {
      console.error(`[MathGalaxyAPI] Request failed (${response.status}) ${url}`);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MathGalaxyAPI] Request error for ${url}: ${message}`);
    throw error;
  }
}

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

function detectBaseUrl(): string | null {
  const base = resolveApiBaseUrl();
  return base ? stripTrailingSlash(base) : null;
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
  private _baseUrl: string;
  readonly cfg: Required<Omit<ApiConfig, "baseUrl">>;
  private healthState: MathGalaxyHealth;

  constructor(cfg: ApiConfig = {}) {
    const provided = typeof cfg.baseUrl === "string" ? stripTrailingSlash(cfg.baseUrl) : "";
    const fallback = detectBaseUrl() || "";
    const base = stripTrailingSlash(provided || fallback || "");
    if (!base) {
      requireApiUrl();
      throw new MathGalaxyApiError(
        MISSING_BASE_ERROR,
      );
    }

    this._baseUrl = base;
    this.cfg = {
      defaultUserId: cfg.defaultUserId ?? "",
      defaultGame: cfg.defaultGame ?? "addition-0-9",
      defaultDevice: cfg.defaultDevice ?? defaultDevice(),
      timeoutMs: cfg.timeoutMs ?? 7000,
      retries: cfg.retries ?? 1,
    };
    this.healthState = { ...DEFAULT_HEALTH };
    this.refreshHealth().catch((error) => {
      console.warn("[MathGalaxyAPI] Failed to refresh health during init.", error);
    });
  }

  get baseUrl() {
    return this._baseUrl;
  }

  get health(): MathGalaxyHealth {
    return this.healthState;
  }

  private persistBaseUrl(value: string) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      if (value) {
        window.localStorage.setItem("mg.baseUrl", value);
      } else {
        window.localStorage.removeItem("mg.baseUrl");
      }
    } catch (error) {
      console.warn("[MathGalaxyAPI] Failed to persist baseUrl override.", error);
    }
  }

  async setBaseUrl(url: string) {
    const normalized = typeof url === "string" ? stripTrailingSlash(url.trim()) : "";
    this._baseUrl = normalized;
    this.persistBaseUrl(normalized);
    if (!normalized) {
      this.healthState = { ...DEFAULT_HEALTH };
      emitHealthUpdate(this.healthState);
      return this.healthState;
    }
    return this.refreshHealth();
  }

  async refreshHealth(): Promise<MathGalaxyHealth> {
    if (!this._baseUrl) {
      this.healthState = { ...DEFAULT_HEALTH };
      emitHealthUpdate(this.healthState);
      return this.healthState;
    }

    const now = new Date().toISOString();
    let statusPayload: Record<string, any> | null = null;

    try {
      statusPayload = await this.get<Record<string, any>>("/v1/ai/status");
    } catch (error) {
      console.warn("[MathGalaxyAPI] Failed to read /v1/ai/status", error);
      statusPayload = null;
    }

    const probes = await Promise.allSettled([
      request("/v1/ai/tts/voices", { method: "GET", mode: "cors", credentials: "omit" }, this._baseUrl),
      request("/v1/ai/audio/sfx", { method: "GET", mode: "cors", credentials: "omit" }, this._baseUrl),
    ]);

    const corsProbeValues = probes.filter(
      (probe): probe is PromiseFulfilledResult<Response> => probe.status === "fulfilled",
    );

    const corsOk =
      probes.length > 0 &&
      corsProbeValues.length === probes.length &&
      corsProbeValues.every((result) => Boolean(result.value.headers.get("access-control-allow-origin")));

    const ttsOk =
      probes[0]?.status === "fulfilled" &&
      (probes[0] as PromiseFulfilledResult<Response>).value.ok === true;

    const sfxOk =
      probes[1]?.status === "fulfilled" &&
      (probes[1] as PromiseFulfilledResult<Response>).value.ok === true;

    this.healthState = {
      ok: Boolean(statusPayload?.ok),
      has_key:
        Boolean(statusPayload?.has_key ?? statusPayload?.hasKey ?? statusPayload?.key_configured ?? statusPayload?.keyConfigured),
      cors_ok: corsOk,
      tts_ok: ttsOk,
      sprites_ok: Boolean(statusPayload?.sprites_ok ?? statusPayload?.spritesOk ?? statusPayload?.sprites_ready),
      lastCheckedAt: now,
    };

    emitHealthUpdate(this.healthState);
    return this.healthState;
  }

  /** Ping new API */
  async status<T = any>() {
    const { data } = await this.getWithMeta<T>("/v1/status");
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

  async aiTtsVoices<T = any>(params: { lang?: string; model?: string; mode?: string } = {}) {
    const search = new URLSearchParams();
    if (params.lang) {
      search.set("lang", params.lang);
    }
    if (params.model) {
      search.set("model", params.model);
    }
    if (params.mode) {
      search.set("mode", params.mode);
    }
    const path = search.size ? `/v1/ai/tts/voices?${search.toString()}` : "/v1/ai/tts/voices";
    return this.get<T>(path);
  }

  async aiAudioSfx<T = any>(params: { pack?: string; name?: string } = {}) {
    const search = new URLSearchParams();
    if (params.pack) {
      search.set("pack", params.pack);
    }
    if (params.name) {
      search.set("name", params.name);
    }
    const path = search.size ? `/v1/ai/audio/sfx?${search.toString()}` : "/v1/ai/audio/sfx";
    return this.get<T>(path);
  }

  async aiTtsSynthesize<T = any>(payload: Record<string, unknown>) {
    return this.post<T>("/v1/ai/tts/synthesize", payload);
  }

  async generateSprites<T = any>(items: SpritePrompt[], model = "gemini-2.5-flash-image") {
    if (!Array.isArray(items) || !items.length) {
      throw new MathGalaxyApiError("Sprite prompts are required to generate sprites.");
    }
    const payload = {
      model,
      items: items.map((item) => ({
        id: item.id,
        prompt: item.prompt,
        style: item.style ?? null,
        tags: Array.isArray(item.tags) ? item.tags : undefined,
        metadata: item.metadata ?? undefined,
      })),
    };
    return this.post<T>("/v1/ai/sprites/generate", payload);
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
    const response = await this.performRequest(path, { ...init, method: "GET" });
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
    const response = await this.performRequest(path, prepared);
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

  private async performRequest(path: string, init: RequestInit & { method: string }): Promise<Response> {
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
        const response = await request(
          path,
          {
            ...init,
            headers,
            signal: controller.signal,
          },
          this.baseUrl,
        );
        clearTimeout(timeout);
        if (!response.ok) {
          throw await this.buildHttpError(response);
        }
        emitOnline();
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
          emitOffline(normalized);
          throw normalized;
        }

        await sleep(250 * (attempt + 1));
      }
      attempt++;
    }

    const failure = lastErr ?? new MathGalaxyApiError("Network error");
    emitOffline(failure);
    throw failure;
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
