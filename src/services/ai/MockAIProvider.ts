import type { Handover, QuestionType } from '../../types'
import { detectUnsafeMedicalRequest } from '../safety'
import { composePatientFacingSummary, composePatientSummary } from '../summary'
import type { AIProvider, MessageClassification } from './types'

// Small artificial delay so the UI can show a calm "thinking" state and so the
// interaction feels the same once a real network-backed provider is wired in.
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * MockAIProvider — makes the entire application work with NO API key.
 *
 * It never diagnoses and never transforms the patient's meaning. Classification
 * is delegated to the deterministic safety guard so the mock behaves exactly
 * like the safety boundary the real provider must also respect.
 */
export class MockAIProvider implements AIProvider {
  async classifyMessage(message: string): Promise<MessageClassification> {
    const { unsafe, category } = detectUnsafeMedicalRequest(message)
    if (!unsafe) {
      return delay({ safe: true, category: 'answer' as const })
    }
    return delay({
      safe: false,
      category: category === 'treatment' ? ('treatment_request' as const) : ('diagnosis_request' as const),
      reason: 'Message asks Kabla to diagnose or recommend treatment.',
    })
  }

  async extractAnswer(message: string, _question: QuestionType): Promise<string> {
    // Preserve the patient's words. We only tidy surrounding whitespace and
    // collapse runs of blank lines — we never rephrase or medicalise.
    const cleaned = message.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    return delay(cleaned, 120)
  }

  async generateHandover(data: Handover): Promise<Handover> {
    // The handover is the patient's own words, organized. Nothing is invented,
    // nothing is diagnosed, and the fear is never rewritten into a conclusion.
    return delay({ ...data, reviewed: true }, 320)
  }

  async summarizeHandover(data: Handover): Promise<string> {
    // Deterministic restatement of the patient's own account — never a diagnosis.
    return delay(composePatientSummary(data), 260)
  }

  async summarizeForPatient(data: Handover): Promise<string> {
    return delay(composePatientFacingSummary(data), 200)
  }
}
