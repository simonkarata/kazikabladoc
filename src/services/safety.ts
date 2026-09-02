// Application-level safety guard.
//
// This is deliberately DETERMINISTIC and lives OUTSIDE any AI model.
// Even after Claude is connected, this boundary must remain: the safety
// layer runs BEFORE any model-generated content is displayed.
//
// It detects when a patient is asking Kabla to diagnose or to recommend
// treatment/medication — the two things Kabla must never do. The correct
// response to any of these is "Sijui."

export type UnsafeCategory = 'diagnosis' | 'treatment' | null

export type UnsafeMedicalRequest = {
  unsafe: boolean
  category: UnsafeCategory
}

// Phrases that signal the patient is asking us to name/confirm a condition.
const DIAGNOSIS_PATTERNS: RegExp[] = [
  /\bdo (i|you think i|we) (have|got)\b/, // "do I have", "do you think I have"
  /\bdo i actually have\b/,
  /\bhave i got\b/,
  /\bam i (sick|dying|infected)\b/,
  /\bis (this|it|that)\s+\w+/, // "is this malaria", "is it typhoid"
  /\bcould (this|it) be\b/,
  /\bwhat (disease|illness|condition|sickness|infection) (do|might)\b/,
  /\bwhat('?s| is) wrong with me\b/,
  /\bwhat do i have\b/,
  /\bdiagnos(e|is|ing)\b/,
  /\bwhat('?s| is) my (diagnosis|condition)\b/,
  /\btell me (what|if) i have\b/,
]

// Phrases that signal the patient is asking for treatment / medication.
const TREATMENT_PATTERNS: RegExp[] = [
  /\bwhat (medicine|medication|drug|drugs|pills?|tablets?)\b/,
  /\bwhich (medicine|medication|drug|drugs|pills?|tablets?)\b/,
  /\bwhat should i (take|use|drink|do)\b/,
  /\bshould i take\b/,
  /\bhow (do|can) i (treat|cure)\b/,
  /\bhow to (treat|cure)\b/,
  /\b(treatment|cure) for\b/,
  /\bwhat('?s| is) the (treatment|cure|dose|dosage)\b/,
  /\bdosage\b/,
  /\bprescri(be|ption)\b/,
  /\bhow many (pills?|tablets?|mg)\b/,
]

function normalize(message: string): string {
  return message.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Inspect a patient message for an obvious diagnosis or treatment request.
 *
 * This runs on every free-text answer BEFORE it is accepted or shown back,
 * and never depends on an AI model to enforce the boundary.
 */
export function detectUnsafeMedicalRequest(message: string): UnsafeMedicalRequest {
  const text = normalize(message)
  if (!text) return { unsafe: false, category: null }

  for (const pattern of TREATMENT_PATTERNS) {
    if (pattern.test(text)) return { unsafe: true, category: 'treatment' }
  }
  for (const pattern of DIAGNOSIS_PATTERNS) {
    if (pattern.test(text)) return { unsafe: true, category: 'diagnosis' }
  }

  return { unsafe: false, category: null }
}

// Phrases that turn a patient's account into a CLINICAL ASSERTION — a diagnosis,
// differential, probability, or treatment recommendation. Used to guard any
// AI-generated summary text BEFORE it is shown: if a generated summary contains
// any of these, we reject it and fall back to the deterministic summary.
//
// Note: this deliberately does NOT flag a bare disease name — a faithful summary
// may say "the patient fears malaria" or "worries it may be malaria" (attributing
// the concern to the patient). It flags language that asserts a condition or
// recommends care.
const CLINICAL_ASSERTION_PATTERNS: RegExp[] = [
  /\b(possible|possibly|probable|probably|likely|suspected|presumed|apparent)\b/,
  /\bdifferential\b/,
  /\b(consistent with|indicative of|suggestive of|points to)\b/,
  /\bappears to (be|have)\b/,
  /\bpresents? with\b/,
  // "signs of X" is clinical-observation language; note we deliberately do NOT
  // flag "symptoms of ..." because a faithful summary may restate a patient's
  // own search terms ("searched for symptoms of fever and headache").
  /\bsigns of\b/,
  /\bdiagnos(e|is|ed|ing|tic)\b/,
  /\brule[- ]?out\b/,
  // "the patient may/might/could have X" as the summarizer's own claim — but
  // NOT when it's attributed to the patient's worry ("worried they might have
  // X", "thinks they might have X"). The negative lookbehind allows the latter.
  /(?<!\b(?:worried|worry|worries|fear|fears|feared|afraid|scared|think|thinks|thought|believe|believes|concerned|concern)\b.{0,25})\b(?:you|they|the patient|patient)\s+(?:probably|may|might|could|likely)\s+(?:have|has)\b/,
  /\b(recommend|prescrib|treatment|medication|dosage)\b/,
  /\bshould (take|see|start|get)\b/,
]

/**
 * True if `text` reads like a clinical assertion rather than a plain restatement
 * of what the patient described. Applied to AI-generated summaries as a final,
 * model-independent safety net.
 */
export function containsClinicalAssertion(text: string): boolean {
  const t = normalize(text)
  if (!t) return false
  return CLINICAL_ASSERTION_PATTERNS.some((p) => p.test(t))
}
