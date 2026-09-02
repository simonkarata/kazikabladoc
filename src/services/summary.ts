// Deterministic, safe fallback for the "at a glance" handover summary.
//
// This is a plain restatement of the patient's OWN account — it never
// diagnoses, assesses, or adds anything the patient did not say. It is used
// offline and whenever Claude is unavailable or its output trips the
// clinical-assertion guard.

type SummaryInput = {
  searched?: string
  said?: string
  fear?: string
  actuallyFeel?: string
}

function tidy(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function strip(s: string): string {
  return s.replace(/[.\s]+$/, '')
}

export function composePatientSummary(d: SummaryInput): string {
  const searched = tidy(d.searched)
  const said = tidy(d.said)
  const fear = tidy(d.fear)
  const feel = tidy(d.actuallyFeel)

  const parts: string[] = []
  if (searched) parts.push(`Before this visit, the patient searched online for “${strip(searched)}”.`)
  if (said) parts.push(`They recall being told or reading: “${strip(said)}”.`)
  if (fear) {
    parts.push(`Their main concern, in their own words, is “${strip(fear)}”.`)
  }
  if (feel) parts.push(`What they say they are actually experiencing: ${strip(feel)}.`)

  if (!parts.length) return 'The patient has not yet described their situation.'
  return parts.join(' ')
}

const NO_SEARCH_MARKERS = ["i didn't search", "didn't look anything up"]

/**
 * A short, encouraging summary written FOR THE PATIENT. It reflects their own
 * words back and nudges them to share the note — it never diagnoses, advises,
 * or reassures about what the condition might be.
 */
export function composePatientFacingSummary(d: SummaryInput): string {
  const searched = tidy(d.searched)
  const fear = tidy(d.fear)
  const feel = tidy(d.actuallyFeel)
  const didSearch = searched && !NO_SEARCH_MARKERS.some((m) => searched.toLowerCase().includes(m))

  const bits: string[] = []
  bits.push('Here’s your story, ready to share.')
  if (didSearch) bits.push(`You looked up “${strip(searched)}” before coming in.`)
  if (fear) bits.push(`You’re worried it might be “${strip(fear)}” — that’s your concern to raise, in your own words.`)
  if (feel) bits.push(`Most importantly, tell the healthcare professional what you’re actually feeling: ${strip(feel)}.`)
  bits.push('Kabla can’t tell you what it is — that’s exactly what the healthcare professional is there to help with.')
  return bits.join(' ')
}
