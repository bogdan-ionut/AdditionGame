import { getSpriteUrl, SPRITE_CACHE_EVENT } from "../../lib/spriteCache";

export async function ensureSpriteFor(interest: string, waitMs = 6000): Promise<string | null> {
  if (!interest) return null;
  const cached = getSpriteUrl(interest);
  if (cached) return cached;

  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    let settled = false;
    let timeout: number | null = null;
    const normalized = interest.toLowerCase();

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ interest?: string; url?: string }>).detail;
      if (!detail?.interest) return;
      if (detail.interest === "*") {
        cleanup(null);
        return;
      }
      if (detail.interest.toLowerCase() === normalized) {
        cleanup(typeof detail.url === "string" && detail.url ? detail.url : null);
      }
    };

    function cleanup(result: string | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener(SPRITE_CACHE_EVENT, listener);
      if (timeout) window.clearTimeout(timeout);
      resolve(result);
    }

    window.addEventListener(SPRITE_CACHE_EVENT, listener);

    timeout = window.setTimeout(() => {
      cleanup(getSpriteUrl(interest));
    }, Math.max(500, waitMs));
  });
}

export default ensureSpriteFor;
