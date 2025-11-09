export interface StatusResponse {
  ok: boolean
  service: string
  key_on_server: boolean
  planning_model?: string
  sprite_model?: string
  tts_model?: string
  accepts_client_key?: boolean
}

const trailingSlashPattern = /\/+$/

export function apiBase(): string {
  const envBase = import.meta.env.VITE_API_URL
  if (typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.replace(trailingSlashPattern, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(trailingSlashPattern, '')
  }

  throw new Error('Unable to determine API base URL. Set VITE_API_URL to continue.')
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase()
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
  const headers = new Headers(init.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      ...init,
      headers,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Network error while requesting ${url.pathname}: ${error.message}`)
    }
    throw new Error(`Network error while requesting ${url.pathname}.`)
  }

  const text = response.status === 204 ? '' : await response.text()
  let data: unknown = null

  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new Error(`Failed to parse JSON response from ${url.pathname}.`)
    }
  }

  if (!response.ok) {
    let message = `Request to ${url.pathname} failed with status ${response.status}`
    if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as Record<string, unknown>).message === 'string'
    ) {
      message = (data as Record<string, string>).message
    }

    throw new Error(message)
  }

  if (data == null) {
    throw new Error(`Empty response received from ${url.pathname}.`)
  }

  return data as T
}

export function status(): Promise<StatusResponse> {
  return http<StatusResponse>('/v1/ai/status')
}
