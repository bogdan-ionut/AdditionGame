import { API_URL } from './config'

export interface StatusResponse {
  ok: boolean
  service: string
  key_on_server: boolean
  planning_model?: string
  sprite_model?: string
  tts_model?: string
  accepts_client_key?: boolean
}

export type GradeLevel =
  | 'preschool'
  | 'grade1'
  | 'grade2'
  | 'grade3'
  | 'grade4'
  | 'grade5'
  | 'grade6'

export interface PlanBody {
  userId?: string
  grade?: GradeLevel
  interests?: string[]
  mastery?: Record<string, unknown>
  target?: Record<string, unknown>
  models?: { planner?: string }
  text?: string
  prompt?: string
}

export type PlanResponse =
  | {
      ok: true
      plan: Record<string, unknown>
    }
  | {
      ok: false
      fallback_local: true
      message?: string
    }

const trailingSlashPattern = /\/+$/
const API_BASE = API_URL.replace(trailingSlashPattern, '')

function createUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalizedPath}`
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = createUrl(path)
  const headers = new Headers(init.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Network error while requesting ${url}: ${error.message}`)
    }
    throw new Error(`Network error while requesting ${url}.`)
  }

  const text = response.status === 204 ? '' : await response.text()
  let data: unknown = null

  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new Error(`Failed to parse JSON response from ${url}.`)
    }
  }

  if (!response.ok) {
    let message = `Request to ${url} failed with status ${response.status}`
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
    throw new Error(`Empty response received from ${url}.`)
  }

  return data as T
}

export function status(): Promise<StatusResponse> {
  return http<StatusResponse>('v1/ai/status')
}

export function plan(body: PlanBody): Promise<PlanResponse> {
  return http<PlanResponse>('v1/ai/plan', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
