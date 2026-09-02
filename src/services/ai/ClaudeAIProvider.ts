import type { Handover, QuestionType } from '../../types'
import { detectUnsafeMedicalRequest } from '../safety'
import { MockAIProvider } from './MockAIProvider'
import type { AIProvider, MessageClassification } from './types'

// Base URL for the stateless AI server. Empty string = same origin (the Vite
// dev server proxies /api → the Node server; in production serve both together).
const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const TIMEOUT_MS = 20000

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * ClaudeAIProvider — routes AI work through the stateless server (which holds
 * the API key), while keeping the deterministic safety boundary on the client
 * too and degrading gracefully to MockAIProvider whenever the server or Claude
 * is unavailable. The UI depends only on the AIProvider interface, so nothing
 * downstream changes.
 */
export class ClaudeAIProvider implements AIProvider {
  private fallback = new MockAIProvider()

  async classifyMessage(message: string): Promise<MessageClassification> {
    // 1) Deterministic boundary FIRST — instant, offline, authoritative.
    //    A diagnosis/treatment request is refused without any network call.
    const guard = detectUnsafeMedicalRequest(message)
    if (guard.unsafe) {
      return {
        safe: false,
        category: guard.category === 'treatment' ? 'treatment_request' : 'diagnosis_request',
        reason: 'Blocked by deterministic safety guard.',
      }
    }

    // 2) The guard says safe — let Claude add richer intent detection. If the
    //    server/Claude is unavailable, we keep the guard's "safe" verdict.
    try {
      const out = await postJSON<MessageClassification>('/api/classify', { message })
      return {
        safe: out.category === 'answer',
        category: out.category ?? 'answer',
        reason: out.reason,
      }
    } catch {
      return { safe: true, category: 'answer' }
    }
  }

  async extractAnswer(message: string, question: QuestionType): Promise<string> {
    try {
      const out = await postJSON<{ text: string }>('/api/extract', { message, question })
      return out.text?.trim() || message.trim()
    } catch {
      // Claude unavailable → preserve the patient's words via the mock path.
      return this.fallback.extractAnswer(message, question)
    }
  }

  async generateHandover(data: Handover): Promise<Handover> {
    try {
      const out = await postJSON<Pick<Handover, 'searched' | 'said' | 'fear' | 'actuallyFeel'>>(
        '/api/handover',
        {
          data: {
            searched: data.searched,
            said: data.said,
            fear: data.fear,
            actuallyFeel: data.actuallyFeel,
          },
        },
      )
      return {
        ...data,
        searched: out.searched ?? data.searched,
        said: out.said ?? data.said,
        fear: out.fear ?? data.fear,
        actuallyFeel: out.actuallyFeel ?? data.actuallyFeel,
        reviewed: true,
      }
    } catch {
      return this.fallback.generateHandover(data)
    }
  }

  async summarizeHandover(data: Handover): Promise<string> {
    try {
      const out = await postJSON<{ summary: string }>('/api/summary', {
        data: {
          searched: data.searched,
          said: data.said,
          fear: data.fear,
          actuallyFeel: data.actuallyFeel,
        },
      })
      return out.summary?.trim() || this.fallback.summarizeHandover(data)
    } catch {
      // Claude unavailable → deterministic patient-account summary.
      return this.fallback.summarizeHandover(data)
    }
  }

  async summarizeForPatient(data: Handover): Promise<string> {
    try {
      const out = await postJSON<{ summary: string }>('/api/patient-summary', {
        data: {
          searched: data.searched,
          said: data.said,
          fear: data.fear,
          actuallyFeel: data.actuallyFeel,
        },
      })
      return out.summary?.trim() || this.fallback.summarizeForPatient(data)
    } catch {
      return this.fallback.summarizeForPatient(data)
    }
  }
}

export type AIHealth = { ok: boolean; provider: 'claude' | 'unconfigured' | 'offline'; model: string | null }

/** Best-effort check of whether the live Claude backend is reachable. */
export async function checkAIHealth(): Promise<AIHealth> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error('bad status')
    return (await res.json()) as AIHealth
  } catch {
    return { ok: false, provider: 'offline', model: null }
  }
}
