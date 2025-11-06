const DEFAULT_API_BASE = 'https://ionutbogdan.ro/api';

export function getApiBase() {
  const base = import.meta?.env?.VITE_AI_PROXY_URL;
  if (!base) return DEFAULT_API_BASE;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function getGeminiKeyUrl() {
  return `${getApiBase()}/gemini/svsm/entry/key`;
}

export function getGeminiHealthUrl() {
  return `${getApiBase()}/health/gemini_post.php`;
}

export function getPlanningUrl() {
  return `${getApiBase()}/gemini/plan`;
}

export function getSpriteBatchUrl() {
  return `${getApiBase()}/gemini/sprites/batch`;
}
