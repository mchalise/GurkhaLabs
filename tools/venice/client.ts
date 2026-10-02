// Venice AI client — OpenAI-compatible REST over fetch, no SDK dependency.
// Base URL + key come from the environment; nothing is hardcoded here.
//
//   VENICE_API_KEY   required (gitignored .env)
//   VENICE_BASE_URL  optional, default https://api.venice.ai/api/v1
//
// Docs: https://docs.venice.ai
import { loadEnv, requireEnv } from './env'
import { parseRetryAfter } from './retry'

loadEnv()

export const VENICE_BASE_URL = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1'
export const DEFAULT_CHAT_MODEL = 'zai-org-glm-5-2' // GLM 5.2

export class VeniceError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
    /** the server's Retry-After (or rate-limit reset) hint, in ms, when it sent one */
    public retryAfterMs: number | null = null,
  ) {
    super(message ?? `Venice ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
}

type Json = Record<string, unknown>

async function request<T = Json>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: Json; raw?: boolean } = {},
): Promise<{ json?: T; bytes?: Buffer; contentType: string; headers: Headers }> {
  const key = requireEnv('VENICE_API_KEY')
  const res = await fetch(`${VENICE_BASE_URL}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: init.raw ? '*/*' : 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok) {
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      /* keep text */
    }
    const hint =
      res.headers.get('retry-after') ??
      res.headers.get('x-ratelimit-reset-requests') ??
      res.headers.get('x-ratelimit-reset')
    throw new VeniceError(res.status, parsed, undefined, parseRetryAfter(hint))
  }
  if (contentType.includes('application/json')) {
    return { json: (await res.json()) as T, contentType, headers: res.headers }
  }
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType, headers: res.headers }
}

// ── chat (OpenAI-compatible) ────────────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
export interface ChatResult {
  id: string
  model: string
  choices: { index: number; message: ChatMessage; finish_reason: string }[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}
export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; max_tokens?: number } = {},
): Promise<ChatResult> {
  const { json } = await request<ChatResult>('/chat/completions', {
    body: {
      model: opts.model ?? DEFAULT_CHAT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.max_tokens ?? 256,
    },
  })
  return json!
}

// ── balances ────────────────────────────────────────────────────────────────
export interface Balances {
  USD?: number
  DIEM?: number
  BUNDLED_CREDITS?: number
}
export async function balances(): Promise<Balances> {
  const { json } = await request<{ balances?: Balances }>('/api_keys/rate_limits')
  return json?.balances ?? {}
}

// ── video (async queue) ─────────────────────────────────────────────────────
export interface VideoRequest {
  model: string
  prompt?: string
  negative_prompt?: string
  duration: string // '5s' …
  aspect_ratio?: string // '1:1' | '9:16' | …
  resolution?: string // '480p' | '720p' | '1080p'
  image_url?: string // http(s) or data: URL — image-to-video
  audio?: boolean
  seed?: number
  consents?: {
    seedance?: {
      confirmed_terms_and_privacy: boolean
      confirmed_legal_right: boolean
      confirmed_screening_acknowledged: boolean
    }
  }
}
/** Price estimate in USD for a video job. Always call before queueing. */
export async function quoteVideo(req: Omit<VideoRequest, 'image_url' | 'prompt'>): Promise<number> {
  const { json } = await request<{ quote: number }>('/video/quote', {
    body: req as unknown as Json,
  })
  return Number(json?.quote ?? NaN)
}
export async function queueVideo(
  req: VideoRequest,
): Promise<{ queue_id: string; model: string; download_url?: string }> {
  const { json } = await request<{ queue_id: string; model: string; download_url?: string }>(
    '/video/queue',
    { body: req as unknown as Json },
  )
  return json!
}
/** Poll the queue. Resolves to mp4 bytes when done, or null while processing. */
export async function retrieveVideo(
  model: string,
  queue_id: string,
): Promise<{ bytes: Buffer } | { status: string; progress?: number }> {
  const r = await request<{
    status: string
    execution_duration?: number
    average_execution_time?: number
  }>('/video/retrieve', { body: { model, queue_id }, raw: true })
  if (r.bytes) return { bytes: r.bytes }
  const j = r.json!
  const progress =
    j.execution_duration && j.average_execution_time
      ? Math.min(0.99, j.execution_duration / j.average_execution_time)
      : undefined
  return { status: j.status, progress }
}

// ── image ───────────────────────────────────────────────────────────────────
export interface ImageRequest {
  model: string
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  format?: 'png' | 'jpeg' | 'webp'
  seed?: number
  cfg_scale?: number
  steps?: number
  hide_watermark?: boolean
  safe_mode?: boolean
  style_references?: { image: string; strength?: number }[]
}
export async function generateImage(
  req: ImageRequest,
): Promise<{ id: string; images: string[]; timing?: Record<string, number> }> {
  const { json } = await request<{ id: string; images: string[]; timing?: Record<string, number> }>(
    '/image/generate',
    { body: { format: 'png', hide_watermark: true, ...req } as unknown as Json },
  )
  return json!
}

// ── image edit: the source image IS the input (identity is kept) ─────────────
// Unlike /image/generate + style_references (which only borrows a look and
// lets the model invent its own character), /image/edit redraws the given
// image — the way to get new framings of Haki that are still Haki.
export interface ImageEditRequest {
  model: string
  /** raw base64 (no data: prefix) or an http(s) URL */
  image: string
  prompt: string
  resolution?: '1K' | '2K' | '4K'
  aspect_ratio?: 'auto' | '1:1' | '3:2' | '16:9' | '21:9' | '9:16' | '2:3' | '3:4' | '4:3' | '4:5'
  output_format?: 'png' | 'jpeg' | 'webp'
}
export async function editImage(req: ImageEditRequest): Promise<Buffer> {
  const { bytes, json } = await request<{ images?: string[]; image?: string }>('/image/edit', {
    body: {
      output_format: 'png',
      resolution: '1K',
      aspect_ratio: '1:1',
      ...req,
    } as unknown as Json,
    raw: true,
  })
  if (bytes && bytes.length) return bytes
  const b64 = json?.images?.[0] ?? json?.image
  if (b64) return Buffer.from(b64, 'base64')
  throw new Error('image/edit returned no image')
}

// ── speech (text-to-speech) ─────────────────────────────────────────────────
// POST /audio/speech → binary audio. Paid per character of `input` (see
// TTS_MODELS in ./voicePlan for the per-model price).
export interface SpeechRequest {
  model: string
  /** 1–4096 characters */
  input: string
  voice: string
  response_format?: 'mp3' | 'wav' | 'opus' | 'aac' | 'flac' | 'pcm'
  /** 0.25–4, default 1 */
  speed?: number
  streaming?: boolean
  language?: string
  /** style prompt — Qwen 3 models only */
  prompt?: string
  /** Qwen 3, Orpheus, Chatterbox HD */
  temperature?: number
}
export async function speech(req: SpeechRequest): Promise<Buffer> {
  const { bytes, json, contentType } = await request('/audio/speech', {
    body: { response_format: 'mp3', streaming: false, ...req } as unknown as Json,
    raw: true,
  })
  // a 2xx with a JSON body is an error report, not audio
  if (json) throw new VeniceError(200, json, `Venice speech returned JSON: ${JSON.stringify(json)}`)
  if (!bytes || bytes.length === 0) {
    throw new VeniceError(200, contentType, `Venice speech returned no audio (${contentType})`)
  }
  return bytes
}

// ── models ──────────────────────────────────────────────────────────────────
export interface VeniceModel {
  id: string
  type?: string
  model_spec?: Record<string, unknown>
  [k: string]: unknown
}
/** GET /models?type=<type> (free) — e.g. listModels('tts'). */
export async function listModels(type: string): Promise<VeniceModel[]> {
  const { json } = await request<{ data?: VeniceModel[] }>(
    `/models?type=${encodeURIComponent(type)}`,
  )
  return json?.data ?? []
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
