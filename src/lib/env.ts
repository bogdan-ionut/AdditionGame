// src/lib/env.ts
export function stripTrailingSlash(u: string) {
  return u ? u.replace(/\/+$/, "") : "";
}

export function resolveApiBaseUrl(): string {
  // 1) explicit local override
  const ls = (typeof window !== "undefined")
    ? window.localStorage.getItem("mg:apiBaseUrl")?.trim()
    : "";
  if (ls) return stripTrailingSlash(ls);

  // 2) runtime window var (optional future use)
  const win = (globalThis as any).__MG_ENV__?.API_BASE_URL;
  if (win) return stripTrailingSlash(String(win));

  // 3) <meta name="mg-api-base" content="...">
  const meta =
    (typeof document !== "undefined")
      ? document.querySelector<HTMLMetaElement>('meta[name="mg-api-base"]')?.content?.trim()
      : "";
  if (meta) return stripTrailingSlash(meta);

  // 4) Vite build-time env (works in local dev / custom deployments)
  // (This might be empty on GitHub Pages; keep it as a lower-priority fallback.)
  // @ts-ignore
  const vite = import.meta?.env?.VITE_MATH_API_URL as string | undefined;
  if (vite) return stripTrailingSlash(vite);

  // 5) sensible default for GitHub Pages host
  if (typeof location !== "undefined" && location.hostname.endsWith("github.io")) {
    return "https://math-api-811756754621.us-central1.run.app";
  }

  // No API base known
  return "";
}

export function joinApi(base: string, path: string) {
  const b = stripTrailingSlash(base || "");
  return `${b}${path.startsWith("/") ? "" : "/"}${path}`;
}
