type Props = {
  sessionNumber: string
  onStart: () => void
}

export function SessionNumber({ sessionNumber, onStart }: Props) {
  return (
    <div className="frame fade-in">
      <div className="card card-pad-lg session-screen">
        <p className="eyebrow">Your handover number</p>

        <div className="session-ring mt-16">
          <span className="session-cap">Handover</span>
          <div className="session-number">{sessionNumber}</div>
        </div>

        <p className="lead mt-24" style={{ maxWidth: '42ch', margin: '24px auto 0' }}>
          Keep this number while you&rsquo;re using Kabla. It helps you identify your handover during
          this session.
        </p>

        <p className="muted mt-16" style={{ fontSize: '13px', maxWidth: '40ch', margin: '16px auto 0' }}>
          This is not a patient account. It&rsquo;s generated on your device and is never sent anywhere.
        </p>

        <div className="mt-32">
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
