import { ArrowLeft } from './icons'

type Props = {
  onBack: () => void
}

export function Privacy({ onBack }: Props) {
  return (
    <div className="frame fade-in">
      <button className="btn btn-ghost" onClick={onBack} style={{ alignSelf: 'flex-start', padding: '8px 12px' }}>
        <ArrowLeft /> Back
      </button>

      <div className="card card-pad-lg mt-16 prose">
        <p className="eyebrow">Privacy</p>
        <h2 style={{ marginTop: 8 }}>Your information</h2>
        <p>Here is honestly how your information works in Kabla.</p>

        <ul>
          <li>
            <span className="tick" /> Kabla does not create a patient account.
          </li>
          <li>
            <span className="tick" /> Kabla does not maintain a patient history.
          </li>
          <li>
            <span className="tick" /> Your handover is prepared for this session.
          </li>
          <li>
            <span className="tick" /> The note is kept on your device during the experience.
          </li>
          <li>
            <span className="tick" /> Ending the session clears the active handover from Kabla.
          </li>
        </ul>

        <div className="divider" />

        <p>
          If you choose to show or copy the note to a clinic, that clinic may handle it under its own
          rules. Kabla does not create or maintain that clinic record.
        </p>
      </div>
    </div>
  )
}
