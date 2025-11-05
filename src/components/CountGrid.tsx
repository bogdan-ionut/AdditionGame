import React from "react";
import { getSpriteUrl, SPRITE_CACHE_EVENT } from "../lib/spriteCache";
import { ensureSpriteFor } from "../features/interests/ensureSpriteFor";

type CountGridProps = {
  count: number;
  interest: string;
  size?: number;
};

export function CountGrid({ count, interest, size = 48 }: CountGridProps) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = interest?.trim();

    if (!trimmed) {
      setUrl(null);
      return () => {
        cancelled = true;
      };
    }

    const cached = getSpriteUrl(trimmed);
    setUrl(cached);

    if (typeof window === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ interest?: string; url?: string }>).detail;
      if (!detail?.interest) return;
      if (detail.interest === "*" || detail.interest.toLowerCase() === trimmed.toLowerCase()) {
        if (!cancelled) {
          setUrl(detail.url && detail.url.length ? detail.url : getSpriteUrl(trimmed));
        }
      }
    };

    window.addEventListener(SPRITE_CACHE_EVENT, listener);

    if (!cached) {
      ensureSpriteFor(trimmed).then((result) => {
        if (!cancelled) {
          setUrl(result);
        }
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener(SPRITE_CACHE_EVENT, listener);
    };
  }, [interest]);

  const items = React.useMemo(() => {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    return Array.from({ length: safeCount });
  }, [count]);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`, maxWidth: size * 7 }}
    >
      {items.map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded border bg-white"
          style={{ width: size, height: size }}
        >
          {url ? (
            <img
              src={url}
              alt={interest || "counting object"}
              className="object-contain w-[85%] h-[85%] pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}

export default CountGrid;
