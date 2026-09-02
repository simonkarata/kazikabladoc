import type { Handover } from '../types'

type Props = {
  handover: Handover
  onExit: () => void
}

function Block({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant?: 'concern' | 'experience'
}) {
  return (
    <div className={`nurse-block${variant ? ' ' + variant : ''}`}>
      <div className="nurse-block-label">{label}</div>
      <p className={`nurse-block-value${value ? '' : ' empty'}`}>{value || 'Not answered'}</p>
    </div>
  )
}

export function NurseMode({ handover, onExit }: Props) {
  return (
    <div className="nurse fade-in">
      <button className="btn btn-secondary nurse-exit no-print" onClick={onExit}>
        Done
      </button>

      <div className="nurse-inner">
        <span className="nurse-topbadge">AI-assisted • Patient reviewed</span>
        <h1 className="nurse-title">My handover</h1>
        <div className="nurse-session">Handover #{handover.sessionNumber}</div>

        {handover.summary && (
          <div className="nurse-summary">
            <div className="nurse-summary-label">At a glance</div>
            <p>{handover.summary}</p>
          </div>
        )}

        <Block label="What I searched" value={handover.searched} />
        <Block label="What it said" value={handover.said} />
        <Block label="What I fear" value={handover.fear} variant="concern" />
        <Block label="What I actually feel" value={handover.actuallyFeel} variant="experience" />

        <div className="nurse-foot">
          <p className="strong">This note is not a diagnosis.</p>
          <p className="soft">The patient can discuss this information with a healthcare professional.</p>
        </div>
      </div>
    </div>
  )
}
