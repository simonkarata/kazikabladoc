// Core data model for Kabla.
//
// Intentionally tiny. There are NO disease fields, NO diagnosis fields,
// and NO treatment fields. The strength of Kabla is the boundary.

export type QuestionType = 'searched' | 'said' | 'fear' | 'actuallyFeel'

export type Handover = {
  sessionNumber: string
  searched: string
  said: string
  fear: string
  actuallyFeel: string
  reviewed: boolean
  // A plain-language, at-a-glance narrative of WHAT THE PATIENT DESCRIBED,
  // written for the healthcare professional. Derived only from the four answers
  // above — NOT a diagnosis, assessment, or triage; keeps the fear as a fear.
  summary?: string
  // A short, encouraging note written FOR THE PATIENT: it reflects back what
  // they told Kabla and encourages them to share it. No diagnosis, no advice,
  // no reassurance about what the condition might be.
  patientSummary?: string
}

export function emptyHandover(sessionNumber: string): Handover {
  return {
    sessionNumber,
    searched: '',
    said: '',
    fear: '',
    actuallyFeel: '',
    reviewed: false,
  }
}
