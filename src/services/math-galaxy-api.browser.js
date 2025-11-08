// math-galaxy-api.browser.js
export class MathGalaxyAPI {
  constructor(cfg = {}) {
    let viteEnv = '';
    try {
      viteEnv = import.meta?.env?.VITE_MATH_API_URL ?? '';
    } catch (error) {
      // ignore environments without import.meta (Node, legacy bundlers)
      viteEnv = '';
    }
    const nodeEnv =
      typeof globalThis !== 'undefined' && globalThis.process?.env
        ? globalThis.process.env.MATH_API_URL ?? ''
        : '';
    let storedBase = '';
    try {
      storedBase = typeof localStorage !== 'undefined' ? localStorage.getItem('MG_API_URL') || '' : '';
    } catch (error) {
      storedBase = '';
    }
    this.baseUrl = (cfg.baseUrl || viteEnv || storedBase || nodeEnv || '').replace(/\/+$/, '');

    if (!this.baseUrl) {
      throw new Error('MathGalaxyAPI requires a baseUrl. Set VITE_MATH_API_URL or pass { baseUrl }.');
    }

    this.cfg = {
      defaultUserId: cfg.defaultUserId || '',
      defaultGame: cfg.defaultGame || 'addition-0-9',
      defaultDevice: cfg.defaultDevice || 'web',
      timeoutMs: cfg.timeoutMs || 7000,
      retries: cfg.retries ?? 1,
    };
    this._lsk = 'mgq_v1';
  }
  status(){ return this._get("/v1/status"); }
  health(){ return this._get("/health"); }
  aiStatus(){ return this._get("/v1/ai/status"); }
  aiRuntime(payload){
    if (payload && Object.keys(payload).length){
      return this._post("/v1/ai/runtime", payload);
    }
    return this._get("/v1/ai/runtime");
  }
  aiPlan(payload){ return this._post("/v1/ai/plan", payload); }
  saveAiKey(payload){ return this._post("/v1/ai/key", payload); }
  getUserStats(userId, days=30){ return this._get(`/v1/sessions/user/${encodeURIComponent(userId)}/stats?days=${days}`); }

  async recordAdditionAttempt(p){
    const body = {
      userId: p.userId || this.cfg.defaultUserId || "anon",
      game: p.game || this.cfg.defaultGame,
      problem: { a: p.a, b: p.b, op: "+" },
      userAnswer: p.answer,
      correct: !!p.correct,
      seconds: p.seconds,
      elapsedMs: p.elapsedMs,
      device: p.device || this.cfg.defaultDevice,
      meta: p.meta || {},
    };
    return this.recordAttempt(body, { beacon: p.beacon });
  }
  async recordAttempt(body, {beacon} = {}){
    if (!body.seconds && !body.elapsedMs){
      const ms = (body.durationMs) || (body.meta && body.meta.durationMs);
      if (typeof ms === "number") body.elapsedMs = Math.round(ms);
    }
    body.device = body.device || this.cfg.defaultDevice;

      if (beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator){
        try{
          const blob = new Blob([JSON.stringify(body)], {type:"application/json"});
          if (navigator.sendBeacon(`${this.baseUrl}/v1/sessions/attempt`, blob)) return {ok:true, transport:"beacon"};
        }catch(error){
          // ignore beacon transport errors and fall back to fetch
        }
      }
    try{
      const res = await this._post("/v1/sessions/attempt", body);
      this.flushQueue().catch(()=>{});
      return res;
      }catch(e){
        try{
          const q = JSON.parse(localStorage.getItem(this._lsk)||"[]"); q.push(body);
          localStorage.setItem(this._lsk, JSON.stringify(q));
        }catch(storageError){
          // ignore localStorage quota errors when queueing attempts
        }
        throw e;
      }
    }
    async flushQueue(){
      let q;
      try{ q = JSON.parse(localStorage.getItem(this._lsk)||"[]"); }catch(error){ q=[]; }
      if(!q.length) return {sent:0};
      let sent=0, keep=[];
      for(const it of q){
        try{ await this._post("/v1/sessions/attempt", it, {keepalive:true}); sent++; }
        catch(error){ keep.push(it); }
      }
      try{ localStorage.setItem(this._lsk, JSON.stringify(keep)); }catch(storageError){
        // ignore persistence errors when pruning the queue
      }
      return {sent, remaining: keep.length};
    }

  // internals
  async _get(p){ return this._fetchJson("GET", p); }
  async _post(p, body, extra={}){
    return this._fetchJson("POST", p, { ...extra, headers:{ "Content-Type":"application/json", ...(extra.headers||{}) }, body:JSON.stringify(body) });
  }
  async _fetchJson(method, path, init={}){
    const url = `${this.baseUrl}${path}`;
    let tries = (this.cfg.retries ?? 1) + 1;
    let err;
    while(tries--){
      const ac = new AbortController();
      const t = setTimeout(()=>ac.abort(), this.cfg.timeoutMs);
      try{
        const res = await fetch(url, {method, signal: ac.signal, ...init});
        clearTimeout(t);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type")||"";
        return ct.includes("application/json") ? res.json() : res.text();
      }catch(e){ err=e; await new Promise(r=>setTimeout(r, 250)); }
    }
    throw err || new Error("Network error");
  }
}
