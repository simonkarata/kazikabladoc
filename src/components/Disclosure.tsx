import { ShieldIcon } from './icons'

type Props = {
  onContinue: () => void
}

export function Disclosure({ onContinue }: Props) {
  return (
    <div className="frame fade-in">
      <p className="eyebrow">Before we begin</p>
      <h1 className="display mt-8" style={{ fontSize: '32px' }}>
        A few things to know
      </h1>

      <div className="card card-pad-lg mt-24">
        <div className="alert-card strong">
          <div className="alert-title">AI is involved in this session.</div>
        </div>

        <div className="disclosure-split mt-24">
          <div className="disclosure-col">
            <h4>What Kabla does</h4>
            <ul className="do-list">
              <li>
                <span className="mark yes">✓</span> Helps you describe what happened
              </li>
              <li>
                <span className="mark yes">✓</span> Organizes your answers
              </li>
              <li>
                <span className="mark yes">✓</span> Creates a note for you to review
              </li>
              <li>
                <span className="mark yes">✓</span> Helps you prepare to speak with a professional
              </li>
            </ul>
          </div>

          <div className="disclosure-col">
            <h4>What Kabla does not do</h4>
            <ul className="do-list">
              <li>
                <span className="mark no">×</span> Diagnose
              </li>
              <li>
                <span className="mark no">×</span> Recommend medicine
              </li>
              <li>
                <span className="mark no">×</span> Recommend treatment
              </li>
              <li>
                <span className="mark no">×</span> Replace a healthcare professional
              </li>
            </ul>
          </div>
        </div>

        <div className="highlight-card">
          <div className="sijui-line">Sometimes the safest answer is &ldquo;Sijui.&rdquo;</div>
          <p>
            If you ask me something I cannot safely determine, I will tell you rather than guess.
          </p>
        </div>

        <div className="privacy-inline">
          <span style={{ color: 'var(--accent)', flex: 'none', marginTop: 1 }}>
            <ShieldIcon />
          </span>
          <span>
            <strong>Your session is not a patient record.</strong> Your handover stays on this device
            during this session. Kabla does not keep a patient history.
          </span>
        </div>

        <div className="mt-24">
          <button className="btn btn-primary btn-block btn-lg" onClick={onContinue}>
            I understand — continue
          </button>
        </div>
      </div>
    </div>
  )
}
