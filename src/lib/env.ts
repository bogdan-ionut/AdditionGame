// src/lib/env.ts
import { resolveApiBaseUrl as resolveBase } from './api/baseUrl';

export function stripTrailingSlash(u: string) {
  return u ? u.replace(/\/+$/, '') : '';
}

export const resolveApiBaseUrl = () => resolveBase();

export function joinApi(base: string, path: string) {
  const b = stripTrailingSlash(base || '');
  return `${b}${path.startsWith('/') ? '' : '/'}${path}`;
}
