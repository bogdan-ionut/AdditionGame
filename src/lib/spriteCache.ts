const LS_KEY = "sprite_urls_v1";
export const SPRITE_CACHE_EVENT = "sprite-cache-update";

type SpriteMap = Record<string, string>;

function readMap(): SpriteMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function getSpriteUrl(interest: string): string | null {
  try {
    const map = readMap();
    return typeof map[interest] === "string" ? map[interest] : null;
  } catch {
    return null;
  }
}

export function setSpriteUrl(interest: string, url: string) {
  let map: SpriteMap = {};
  try {
    map = readMap();
  } catch {
    map = {};
  }
  map[interest] = url;
  localStorage.setItem(LS_KEY, JSON.stringify(map));
  notifySpriteUpdate(interest, url);
}

export function clearSpriteCache() {
  localStorage.removeItem(LS_KEY);
  notifySpriteUpdate("*", "");
}

function notifySpriteUpdate(interest: string, url: string | null) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    const detail = { interest, url };
    window.dispatchEvent(new CustomEvent(SPRITE_CACHE_EVENT, { detail }));
  } catch {
    // no-op
  }
}
