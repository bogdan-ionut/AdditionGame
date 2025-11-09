// math-galaxy-api.browser.js
import { joinApi, resolveApiBaseUrl, stripTrailingSlash } from '../lib/env';

const OFFLINE_EVENT = 'ai:offline';
const ONLINE_EVENT = 'ai:online';

let onlineNotified = false;

const emitOnline = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  if (onlineNotified) return;
  window.dispatchEvent(new Event(ONLINE_EVENT));
  onlineNotified = true;
};

const emitOffline = (reason) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  onlineNotified = false;
  let detail;
  if (reason && typeof reason.message === 'string') {
    detail = reason.message;
  } else if (typeof reason === 'string') {
    detail = reason;
  } else {
    try {
      detail = JSON.stringify(reason);
    } catch {
      detail = 'AI offline';
    }
  }
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail }));
};

const MISSING_BASE_MESSAGE =
  '[MathGalaxyAPI] baseUrl is empty. Open AI Settings and set the Cloud API Base URL.';

export class MathGalaxyAPI {
  constructor(cfg = {}) {
    const runtimeBase = (() => {
      try {
        return resolveApiBaseUrl();
      } catch (error) {
        return '';
      }
    })();
    const provided = typeof cfg.baseUrl === 'string' ? stripTrailingSlash(cfg.baseUrl) : '';
    const fallback = stripTrailingSlash(runtimeBase || '');
    this.baseUrl = stripTrailingSlash(provided || fallback || '');

    if (!this.baseUrl) {
      emitOffline(new Error(MISSING_BASE_MESSAGE));
      throw new Error(MISSING_BASE_MESSAGE);
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
          if (navigator.sendBeacon(joinApi(this.baseUrl, '/v1/sessions/attempt'), blob)) return {ok:true, transport:"beacon"};
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
    const url = joinApi(this.baseUrl, path);
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
        const payload = ct.includes("application/json") ? res.json() : res.text();
        emitOnline();
        return payload;
      }catch(e){ err=e; await new Promise(r=>setTimeout(r, 250)); }
    }
    const failure = err || new Error("Network error");
    emitOffline(failure);
    throw failure;
  }
}
