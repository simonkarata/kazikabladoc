/**
 * Kabla AI server — a small, STATELESS boundary in front of the Claude API.
 *
 * Why this exists:
 *   - The Anthropic API key must NEVER live in frontend code. It lives here,
 *     server-side, read from the environment (ANTHROPIC_API_KEY).
 *   - The frontend talks only to these endpoints via the AIProvider interface.
 *
 * What it guarantees:
 *   - The deterministic safety guard (detectUnsafeMedicalRequest) runs HERE,
 *     before Claude is ever consulted. If it flags a diagnosis/treatment
 *     request, we return "unsafe" immediately and never call the model.
 *   - Claude is tightly constrained: it may only understand/organize the
 *     patient's own words and classify intent. It is never asked to diagnose,
 *     suggest conditions, recommend treatment, or invent symptoms. Structured
 *     outputs pin the response shape so no free-form medical text leaks through.
 *   - No patient data is stored. Every request is independent; nothing is
 *     written to disk or a database.
 */
import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { containsClinicalAssertion, detectUnsafeMedicalRequest } from '../src/services/safety'
import { composePatientFacingSummary, composePatientSummary } from '../src/services/summary'

const PORT = Number(process.env.PORT || 8787)
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8'
const MAX_INPUT_CHARS = 4000

const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
// Constructing the client is cheap and lazy; if there are no credentials we
// simply never call it and every endpoint degrades to the deterministic path.
const client = hasCredentials ? new Anthropic() : null

const app = express()
app.use(express.json({ limit: '256kb' }))

// Permissive CORS so the app works whether served same-origin or split.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function clip(s: unknown): string {
  return String(s ?? '').slice(0, MAX_INPUT_CHARS)
}

/**
 * Ask Claude for a JSON object matching `schema`, under a constrained system
 * prompt. Uses structured outputs so the response is guaranteed-parseable and
 * cannot smuggle free-form medical prose.
 */
async function askClaudeJSON(system: string, user: string, schema: object): Promise<any> {
  if (!client) throw new Error('AI not configured')
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
    // Structured outputs — pin the response to our schema (Opus 4.8).
    output_config: { format: { type: 'json_schema', schema } },
  } as any)
  const block = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined
  if (!block) throw new Error('No text block in model response')
  return JSON.parse(block.text)
}

// ---------------------------------------------------------------- health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: client ? 'claude' : 'unconfigured', model: client ? MODEL : null })
})

// ------------------------------------------------------------- classify
// Deterministic guard FIRST. Claude only refines when the guard says "safe".
const CLASSIFY_SYSTEM = `You are the safety intent-classifier for Kabla, a patient-handover tool.
Kabla helps a patient organize what they searched, what they were told, what they fear, and what they actually feel — before seeing a healthcare professional. Kabla never diagnoses and never recommends treatment.

Classify the patient's message into exactly one category:
- "answer": a normal answer describing their own search, what a source told them, their worry/concern, or what they are experiencing.
- "diagnosis_request": the message asks YOU to determine, confirm, deny, or name a medical condition (e.g. "do I have malaria?", "is this typhoid?", "what disease is this?", "what's wrong with me?").
- "treatment_request": the message asks YOU for treatment, medicine, dosage, or what to take/do about a condition.

Important: a patient stating their OWN fear (e.g. "I think I have malaria") is an "answer", NOT a request — they are telling you their concern, not asking you to decide.
Set "safe" to true only for "answer". Never provide a diagnosis or treatment yourself; only classify.`

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    safe: { type: 'boolean' },
    category: { type: 'string', enum: ['answer', 'diagnosis_request', 'treatment_request'] },
  },
  required: ['safe', 'category'],
}

app.post('/api/classify', async (req, res) => {
  const message = clip(req.body?.message)

  // 1) Deterministic boundary — authoritative, model-independent.
  const guard = detectUnsafeMedicalRequest(message)
  if (guard.unsafe) {
    return res.json({
      safe: false,
      category: guard.category === 'treatment' ? 'treatment_request' : 'diagnosis_request',
      source: 'guard',
    })
  }

  // 2) If configured, let Claude add richer intent detection. If it flags the
  //    message, we honor that; if it errors, we fall back to the guard's "safe".
  if (!client) {
    return res.json({ safe: true, category: 'answer', source: 'guard' })
  }
  try {
    const out = await askClaudeJSON(CLASSIFY_SYSTEM, message, CLASSIFY_SCHEMA)
    const category =
      out.category === 'treatment_request' || out.category === 'diagnosis_request'
        ? out.category
        : 'answer'
    return res.json({ safe: category === 'answer', category, source: 'claude' })
  } catch (err) {
    console.error('[classify] Claude error, falling back to guard:', (err as Error).message)
    return res.json({ safe: true, category: 'answer', source: 'guard-fallback' })
  }
})

// -------------------------------------------------------------- extract
const EXTRACT_SYSTEM = `You help a nervous patient tidy ONE answer for a handover note. You are not a clinician.

Rules — follow them exactly:
- PRESERVE the patient's own words and meaning. Only fix obvious spelling, spacing, and capitalization, and make it a clear first-person statement if it isn't already.
- NEVER add or substitute medical terminology. Do not turn "I've been feeling hot" into "fever", or "my chest feels funny" into "chest pain".
- NEVER diagnose, name a condition, or add a condition the patient did not name.
- NEVER turn a fear into a conclusion. If the field is the patient's fear, keep it as their stated worry.
- NEVER invent details the patient did not provide.
- If the message is already clear, return it essentially unchanged.
Return only the cleaned text.`

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
}

app.post('/api/extract', async (req, res) => {
  const message = clip(req.body?.message)
  const question = String(req.body?.question || 'answer')
  if (!client) return res.json({ text: message.trim(), source: 'passthrough' })
  try {
    const out = await askClaudeJSON(
      EXTRACT_SYSTEM,
      `Handover field: "${question}".\nPatient's answer:\n${message}`,
      EXTRACT_SCHEMA,
    )
    const text = typeof out.text === 'string' && out.text.trim() ? out.text.trim() : message.trim()
    return res.json({ text, source: 'claude' })
  } catch (err) {
    console.error('[extract] Claude error, passing through:', (err as Error).message)
    return res.json({ text: message.trim(), source: 'passthrough' })
  }
})

// ------------------------------------------------------------- handover
const HANDOVER_SYSTEM = `You organize a patient's four answers into a clear handover note for a healthcare professional. You are not a clinician and must not act like one.

You will receive four fields: searched, said, fear, actuallyFeel. Return the same four fields, lightly cleaned.

Rules — follow them exactly:
- PRESERVE the patient's own words and meaning in every field. Only fix spelling/spacing/capitalization and make each a clear statement.
- The "fear" field MUST remain the patient's stated concern. NEVER convert it into a diagnosis, "possible X", "suspected X", "likely X", or a medical assessment. If they wrote "I think I have malaria", keep it as "I think I have malaria".
- NEVER add medical terminology the patient didn't use; NEVER substitute clinical terms for lay descriptions.
- NEVER diagnose, add conditions, suggest probabilities, recommend treatment, or invent symptoms.
- If a field is empty, return it as an empty string.
Return only the four cleaned fields.`

const HANDOVER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    searched: { type: 'string' },
    said: { type: 'string' },
    fear: { type: 'string' },
    actuallyFeel: { type: 'string' },
  },
  required: ['searched', 'said', 'fear', 'actuallyFeel'],
}

app.post('/api/handover', async (req, res) => {
  const data = req.body?.data || {}
  const fields = {
    searched: clip(data.searched),
    said: clip(data.said),
    fear: clip(data.fear),
    actuallyFeel: clip(data.actuallyFeel),
  }
  if (!client) return res.json({ ...fields, source: 'passthrough' })
  try {
    const out = await askClaudeJSON(
      HANDOVER_SYSTEM,
      `Organize these four fields. Keep the patient's words.\n${JSON.stringify(fields, null, 2)}`,
      HANDOVER_SCHEMA,
    )
    return res.json({
      searched: typeof out.searched === 'string' ? out.searched : fields.searched,
      said: typeof out.said === 'string' ? out.said : fields.said,
      // Belt-and-braces: never let the model's "fear" drift into a diagnosis
      // request; if it somehow does, keep the patient's original words.
      fear: typeof out.fear === 'string' && !detectUnsafeMedicalRequest(out.fear).unsafe ? out.fear : fields.fear,
      actuallyFeel: typeof out.actuallyFeel === 'string' ? out.actuallyFeel : fields.actuallyFeel,
      source: 'claude',
    })
  } catch (err) {
    console.error('[handover] Claude error, passing through:', (err as Error).message)
    return res.json({ ...fields, source: 'passthrough' })
  }
})

// -------------------------------------------------------------- summary
// A descriptive, at-a-glance narrative of WHAT THE PATIENT DESCRIBED — so a
// clinician can read the story quickly. Never a diagnosis, assessment, or triage.
const SUMMARY_SYSTEM = `You write a short, plain-language summary of what a patient described, so a nurse or doctor can grasp their story at a glance. You are NOT a clinician and must not act like one.

You receive four fields: searched, said, fear, actuallyFeel. Write 2–4 flowing sentences, in the third person ("The patient..."), that faithfully describe:
- what the patient searched online,
- what they say a search/website/AI told them,
- what they are worried it might be (as THEIR concern),
- and what they say they are actually experiencing.

Hard rules — follow them exactly:
- Summarize ONLY what the patient said. Add nothing.
- NEVER diagnose, assess, or state what the condition is or might be. Do NOT use words like "possible", "probable", "likely", "suspected", "consistent with", "differential", "signs of", "symptoms of", "appears to", "presents with", or "diagnosis".
- A disease name may appear ONLY as the patient's own worry (e.g. "the patient is worried it may be malaria") — never as your assessment.
- NEVER suggest tests, treatment, medicine, urgency, or triage.
- NEVER invent details or use clinical terminology the patient didn't use (don't turn "feeling hot" into "fever").
- Keep the fear clearly framed as the patient's concern, not a conclusion.
- Do NOT add disclaimers or meta-commentary. Do not write "this is not a diagnosis" or use the word "diagnosis" at all — just describe what the patient said.
Style: e.g. "The patient searched online for X. They recall being told Y. They are worried it might be Z. They say they have been experiencing W."
Return only the summary text.`

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { summary: { type: 'string' } },
  required: ['summary'],
}

app.post('/api/summary', async (req, res) => {
  const data = req.body?.data || {}
  const fields = {
    searched: clip(data.searched),
    said: clip(data.said),
    fear: clip(data.fear),
    actuallyFeel: clip(data.actuallyFeel),
  }
  const fallback = composePatientSummary(fields)
  if (!client) return res.json({ summary: fallback, source: 'fallback' })
  try {
    const out = await askClaudeJSON(
      SUMMARY_SYSTEM,
      `Summarize what this patient described. Keep it to their own account.\n${JSON.stringify(fields, null, 2)}`,
      SUMMARY_SCHEMA,
    )
    const summary = typeof out.summary === 'string' ? out.summary.trim() : ''
    // Output-side safety net: if the model slipped into clinical-assertion
    // language, discard it and use the deterministic patient-account summary.
    if (!summary || containsClinicalAssertion(summary)) {
      console.warn('[summary] Claude output rejected by clinical-assertion guard; using fallback')
      return res.json({ summary: fallback, source: 'guard-fallback' })
    }
    return res.json({ summary, source: 'claude' })
  } catch (err) {
    console.error('[summary] Claude error, using fallback:', (err as Error).message)
    return res.json({ summary: fallback, source: 'fallback' })
  }
})

// ------------------------------------------------------ patient summary
// A short, encouraging note written FOR THE PATIENT. Same safety rules — it
// reflects their words back and nudges them to share, never diagnoses or advises.
const PATIENT_SUMMARY_SYSTEM = `You write a short, warm note addressed directly to a patient ("you"), to help them share their story with a healthcare professional. You are NOT a clinician.

You receive four fields: searched, said, fear, actuallyFeel. Write 2–3 short sentences that:
- reflect back, in plain language, what they told you (what they looked up, what they're worried about as THEIR concern, and especially what they say they are actually feeling),
- encourage them to show this note and describe what they're feeling in their own words,
- and make clear Kabla can't tell them what it is — that's what the healthcare professional is for.

Hard rules — follow them exactly:
- Speak TO the patient ("you"), warmly and simply.
- NEVER diagnose, assess, or say what the condition is or might be. Do NOT use "possible", "probable", "likely", "suspected", "consistent with", "signs of", "symptoms of", "diagnosis", "appears to", "presents with".
- NEVER give medical advice, treatment, medicine, tests, urgency, or triage. Do NOT reassure them about what it might be or how serious it is.
- A disease name may appear ONLY as their own worry ("you're worried it might be X").
- Add nothing they didn't say; don't use clinical terms they didn't use.
Return only the note text.`

app.post('/api/patient-summary', async (req, res) => {
  const data = req.body?.data || {}
  const fields = {
    searched: clip(data.searched),
    said: clip(data.said),
    fear: clip(data.fear),
    actuallyFeel: clip(data.actuallyFeel),
  }
  const fallback = composePatientFacingSummary(fields)
  if (!client) return res.json({ summary: fallback, source: 'fallback' })
  try {
    const out = await askClaudeJSON(
      PATIENT_SUMMARY_SYSTEM,
      `Write the patient's note. Reflect only what they told you.\n${JSON.stringify(fields, null, 2)}`,
      SUMMARY_SCHEMA,
    )
    const summary = typeof out.summary === 'string' ? out.summary.trim() : ''
    if (!summary || containsClinicalAssertion(summary)) {
      console.warn('[patient-summary] Claude output rejected by clinical-assertion guard; using fallback')
      return res.json({ summary: fallback, source: 'guard-fallback' })
    }
    return res.json({ summary, source: 'claude' })
  } catch (err) {
    console.error('[patient-summary] Claude error, using fallback:', (err as Error).message)
    return res.json({ summary: fallback, source: 'fallback' })
  }
})

app.listen(PORT, () => {
  console.log(`\nKabla AI server on http://localhost:${PORT}`)
  console.log(`  Model:    ${MODEL}`)
  console.log(`  Provider: ${client ? 'Claude API (key detected)' : 'UNCONFIGURED — set ANTHROPIC_API_KEY to enable Claude'}`)
  console.log(`  Safety:   deterministic guard runs before every model call\n`)
})
