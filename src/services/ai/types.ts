import type { Handover, QuestionType } from '../../types'

export type MessageClassification = {
  // Whether the message is a safe handover answer (true) or a request the
  // application must refuse with "Sijui" (false).
  safe: boolean
  category: 'answer' | 'diagnosis_request' | 'treatment_request'
  reason?: string
}

/**
 * Provider interface for AI-assisted behaviour.
 *
 * The UI depends ONLY on this interface — never on Anthropic directly.
 * Today it is backed by {@link MockAIProvider}; later it can be backed by a
 * ClaudeAIProvider that talks to a stateless server endpoint. No API keys
 * ever live in frontend code.
 *
 * Whatever the provider, the deterministic safety guard in services/safety.ts
 * remains the source of truth for the Sijui boundary.
 */
export interface AIProvider {
  /** Classify whether a message is a normal answer or an unsafe request. */
  classifyMessage(message: string): Promise<MessageClassification>

  /**
   * Turn a natural-language answer into clean text for the given question.
   * MUST preserve the patient's own words — no medical terminology invented,
   * no "fever" substituted for "feeling hot".
   */
  extractAnswer(message: string, question: QuestionType): Promise<string>

  /**
   * Organize the collected answers into the final handover.
   * MUST NOT diagnose, must NOT transform a fear into a conclusion.
   */
  generateHandover(data: Handover): Promise<Handover>

  /**
   * Produce a short, descriptive, at-a-glance narrative of WHAT THE PATIENT
   * DESCRIBED (search, what they were told, their fear-as-a-fear, and their
   * experience), so a clinician can read the story quickly. MUST NOT diagnose,
   * assess, triage, suggest probabilities, or recommend treatment.
   */
  summarizeHandover(data: Handover): Promise<string>

  /**
   * Produce a short, encouraging summary FOR THE PATIENT — reflecting their own
   * words back and nudging them to share the note. MUST NOT diagnose, advise,
   * or reassure about what the condition might be.
   */
  summarizeForPatient(data: Handover): Promise<string>
}
