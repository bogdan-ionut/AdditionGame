// src/lib/env.ts
import { getApiBaseUrl as getBaseFromOverrides } from './api/baseUrl';

export function stripTrailingSlash(u: string) {
  return u ? u.replace(/\/+$/, '') : '';
}

export function resolveApiBaseUrl(): string {
  const resolved = getBaseFromOverrides();
  return resolved ? stripTrailingSlash(resolved) : '';
}

export function joinApi(base: string, path: string) {
  const b = stripTrailingSlash(base || '');
  return `${b}${path.startsWith('/') ? '' : '/'}${path}`;
}
