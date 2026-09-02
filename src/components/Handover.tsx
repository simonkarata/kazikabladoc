import type { Handover as HandoverData } from '../types'
import { LogoMark } from './icons'

type Props = {
  handover: HandoverData
  onShowNurse: () => void
  onEdit: () => void
}

function Value({ text, className }: { text: string; className?: string }) {
  return (
    <p className={`doc-value${text ? '' : ' empty'}${className ? ' ' + className : ''}`}>
      {text || 'Not answered'}
    </p>
  )
}

export function Handover({ handover, onShowNurse, onEdit }: Props) {
  return (
    <div className="frame fade-in">
      <div className="doc">
        <div className="doc-head">
          <div className="doc-head-top">
            <span className="doc-brand">
              <LogoMark /> KABLA
            </span>
            <span className="doc-session">Handover #{handover.sessionNumber}</span>
          </div>
          <div className="doc-title">Patient handover</div>
          <div style={{ marginTop: 12 }}>
            <span className="badge">AI-assisted • Patient reviewed</span>
          </div>
        </div>

        {handover.summary && (
          <div className="doc-summary">
            <div className="doc-summary-label">At a glance</div>
            <p className="doc-summary-text">{handover.summary}</p>
            <p className="doc-summary-note">
              A plain-language summary of what the patient described &mdash; not a clinical assessment.
            </p>
          </div>
        )}

        <div className="doc-body">
          <section className="doc-section">
            <div className="doc-section-label">What I searched</div>
            <Value text={handover.searched} />
          </section>

          <section className="doc-section">
            <div className="doc-section-label">What it said</div>
            <Value text={handover.said} />
          </section>

          <section className="doc-section concern">
            <div className="doc-section-label">
              What I fear <span className="mini-tag concern">Patient&rsquo;s concern</span>
            </div>
            <Value text={handover.fear} />
          </section>

          <section className="doc-section experience">
            <div className="doc-section-label">
              What I actually feel <span className="mini-tag experience">Patient&rsquo;s experience</span>
            </div>
            <Value text={handover.actuallyFeel} />
          </section>
        </div>

        <div className="doc-boundary">
          <h4>Important</h4>
          <p>
            AI was involved in preparing this handover. This note is not a diagnosis or treatment
            recommendation.
          </p>
          <h4 style={{ marginTop: 16 }}>For the healthcare professional</h4>
          <p>Please assess the patient directly.</p>
        </div>

        <div className="doc-foot">
          This handover was prepared by the patient and stays on this device during the session.
        </div>
      </div>

      {handover.patientSummary && (
        <div className="patient-note no-print">
          <div className="patient-note-label">For you</div>
          <p>{handover.patientSummary}</p>
        </div>
      )}

      <div className="btn-row mt-24 no-print">
        <button className="btn btn-primary btn-lg" onClick={onShowNurse}>
          Show to nurse
        </button>
        <button className="btn btn-secondary btn-lg" onClick={onEdit}>
          Edit handover
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => window.print()}>
          Print / Save on this device
        </button>
      </div>
    </div>
  )
}
