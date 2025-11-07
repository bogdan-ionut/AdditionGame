// math-galaxy-api.ts
// Tiny SDK for Math Galaxy API (FastAPI @ Cloud Run)

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

function detectBaseUrl(): string {
  // Vite / Webpack env, altfel gol
  // (setează VITE_MATH_API_URL în .env.*)
  const vite = (import.meta as any)?.env?.VITE_MATH_API_URL;
  // @ts-ignore
  const node = typeof process !== "undefined" ? process?.env?.MATH_API_URL : undefined;
  return vite || node || "";
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
    const baseUrl = (cfg.baseUrl || detectBaseUrl()).replace(/\/+$/, "");
    if (!baseUrl) {
      console.warn("[MathGalaxyAPI] baseUrl is empty. Pass { baseUrl } or set VITE_MATH_API_URL.");
    }
    this.baseUrl = baseUrl;
    this.cfg = {
      defaultUserId: cfg.defaultUserId ?? "",
      defaultGame: cfg.defaultGame ?? "addition-0-9",
      defaultDevice: cfg.defaultDevice ?? defaultDevice(),
      timeoutMs: cfg.timeoutMs ?? 7000,
      retries: cfg.retries ?? 1,
    };
  }

  /** Ping new API */
  async status() {
    return this._get("/v1/status");
  }

  /** Health */
  async health() {
    return this._get("/health");
  }

  /** Quick stats for a user */
  async getUserStats(userId: string, days = 30) {
    const u = encodeURIComponent(userId);
    return this._get(`/v1/sessions/user/${u}/stats?days=${days}`);
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
    // normalize one of seconds / elapsedMs
    if (body.seconds == null && body.elapsedMs == null) {
      // if not provided, try meta.elapsedMs or durationMs
      const ms = (body as any).durationMs ?? body.meta?.durationMs;
      if (typeof ms === "number") body.elapsedMs = Math.round(ms);
    }

    // If both present, keep both (API le suportă) — dar păstrăm consistență
    // Ensure device default
    body.device = body.device || this.cfg.defaultDevice;

    // try sendBeacon for unload events
    if (opts.beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      try {
        const url = `${this.baseUrl}/v1/sessions/attempt`;
        const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        const ok = (navigator as any).sendBeacon(url, blob);
        if (ok) return { ok: true, transport: "beacon" };
        // fall through to fetch if beacon refused
      } catch {
        /* fall back */
      }
    }

    try {
      const res = await this._post("/v1/sessions/attempt", body);
      // try flush queue (if any older failed)
      this.flushQueue().catch(() => {});
      return res;
    } catch (err) {
      // enqueue on failure
      try {
        const q = loadQueue();
        q.push(body);
        saveQueue(q);
      } catch { /* ignore */ }
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
        await this._post("/v1/sessions/attempt", item, { keepalive: true });
        sent++;
      } catch {
        keep.push(item);
      }
    }
    saveQueue(keep);
    return { sent, remaining: keep.length };
  }

  // ---------- internals ----------
  private async _get(path: string) {
    return this._fetchJson("GET", path);
  }

  private async _post(path: string, body: any, extra?: RequestInit) {
    return this._fetchJson("POST", path, {
      ...extra,
      headers: { "Content-Type": "application/json", ...(extra?.headers || {}) },
      body: JSON.stringify(body),
      keepalive: extra?.keepalive ?? false,
    });
  }

  private async _fetchJson(method: string, path: string, init: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt <= this.cfg.retries) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(url, { method, signal: ac.signal, ...init });
        clearTimeout(t);
        if (!res.ok) {
          const text = await safeText(res);
          throw new Error(`HTTP ${res.status} ${res.statusText} – ${text}`);
        }
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        return res.text();
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
        // small backoff
        if (attempt < this.cfg.retries) await sleep(250 * (attempt + 1));
      }
      attempt++;
    }
    throw lastErr ?? new Error("Network error");
  }
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}
