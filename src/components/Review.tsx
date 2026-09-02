import { useState } from 'react'
import type { Handover, QuestionType } from '../types'
import { getAIProvider } from '../services/ai'
import type { UnsafeCategory } from '../services/safety'
import { EditIcon } from './icons'

type Props = {
  handover: Handover
  onEdit: (key: QuestionType, value: string) => void
  onCreate: (finalized: Handover) => void
  onBack: () => void
}

type CardDef = {
  key: QuestionType
  idx: string
  label: string
  variant?: 'concern' | 'experience'
  tag?: string
  note?: string
}

const CARDS: CardDef[] = [
  { key: 'searched', idx: '01', label: 'What I searched' },
  { key: 'said', idx: '02', label: 'What it said' },
  {
    key: 'fear',
    idx: '03',
    label: 'What I fear',
    variant: 'concern',
    tag: 'YOUR CONCERN',
    note: 'This is your concern, not a diagnosis.',
  },
  {
    key: 'actuallyFeel',
    idx: '04',
    label: 'What I actually feel',
    variant: 'experience',
    tag: 'YOUR EXPERIENCE',
  },
]

const ai = getAIProvider()

export function Review({ handover, onEdit, onCreate, onBack }: Props) {
  const [editing, setEditing] = useState<QuestionType | null>(null)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    let finalized: Handover
    try {
      // Organize the answers (never diagnoses or rewrites the fear), then build
      // both summaries: one at-a-glance for the nurse, one encouraging note for
      // the patient. Neither diagnoses.
      const organized = await ai.generateHandover(handover)
      const [summary, patientSummary] = await Promise.all([
        ai.summarizeHandover(organized),
        ai.summarizeForPatient(organized),
      ])
      finalized = { ...organized, summary, patientSummary }
    } catch {
      // Non-fatal: fall back to the patient's own words with no summary.
      finalized = { ...handover, reviewed: true }
    }
    setCreating(false)
    onCreate(finalized)
  }

  return (
    <div className="frame fade-in">
      <p className="eyebrow">Review</p>
      <h1 className="display mt-8" style={{ fontSize: '32px' }}>
        Let&rsquo;s check your story.
      </h1>
      <p className="lead mt-16">
        Make sure this says what you actually experienced. Your concern is kept separate from your
        experience.
      </p>

      <div className="mt-24">
        {CARDS.map((c) => (
          <ReviewCard
            key={c.key}
            def={c}
            value={handover[c.key]}
            isEditing={editing === c.key}
            onStartEdit={() => setEditing(c.key)}
            onCancel={() => setEditing(null)}
            onSave={(v) => {
              onEdit(c.key, v)
              setEditing(null)
            }}
          />
        ))}
      </div>

      <div className="btn-row mt-24">
        <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={creating}>
          {creating ? (
            <>
              <span className="spinner" /> Creating&hellip;
            </>
          ) : (
            'Create my handover'
          )}
        </button>
        <button className="btn btn-secondary btn-lg" onClick={onBack}>
          Go back
        </button>
      </div>
    </div>
  )
}

function ReviewCard({
  def,
  value,
  isEditing,
  onStartEdit,
  onCancel,
  onSave,
}: {
  def: CardDef
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onCancel: () => void
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [warn, setWarn] = useState<UnsafeCategory | null>(null)

  const save = async () => {
    const trimmed = draft.trim()
    // Even when editing, the safety boundary applies to the "fear" and any
    // field: we never let a diagnosis/treatment request slip into the handover.
    const { classifyMessage } = ai
    const result = await classifyMessage.call(ai, trimmed || value)
    if (!result.safe) {
      setWarn(result.category === 'treatment_request' ? 'treatment' : 'diagnosis')
      return
    }
    setWarn(null)
    onSave(trimmed || value)
  }

  return (
    <div className={`review-card${def.variant ? ' ' + def.variant : ''}`}>
      <div className="review-top">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="review-idx">{def.idx}</span>
          <span className="review-label">{def.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {def.tag && <span className={`review-tag ${def.variant}`}>{def.tag}</span>}
          {!isEditing && (
            <button className="review-edit" onClick={onStartEdit}>
              <EditIcon /> Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="inline-edit">
          <textarea
            className="textarea"
            value={draft}
            autoFocus
            maxLength={2000}
            style={{ minHeight: 96 }}
            onChange={(e) => {
              setDraft(e.target.value)
              if (warn) setWarn(null)
            }}
          />
          {warn && (
            <div className="field-error">
              Sijui — that reads like a {warn === 'treatment' ? 'treatment' : 'diagnosis'} request.
              Keep this to what you searched, were told, fear, or feel.
            </div>
          )}
          <div className="inline-edit-actions">
            <button className="btn btn-primary" onClick={save} style={{ padding: '10px 18px' }}>
              Save
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setDraft(value)
                setWarn(null)
                onCancel()
              }}
              style={{ padding: '10px 18px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`review-answer${def.variant === 'experience' ? ' strong' : ''}${value ? '' : ' empty'}`}>
            {value || 'Not answered'}
          </p>
          {def.note && <p className="review-note">{def.note}</p>}
        </>
      )}
    </div>
  )
}
