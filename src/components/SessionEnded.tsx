import { LogoMark, ShieldIcon } from './icons'

type Props = {
  onRestart: () => void
}

export function SessionEnded({ onRestart }: Props) {
  return (
    <div className="frame fade-in">
      <div className="card card-pad-lg center">
        <div style={{ display: 'inline-flex', margin: '0 auto 8px' }}>
          <LogoMark />
        </div>
        <h1 className="display mt-16" style={{ fontSize: '30px' }}>
          Session ended
        </h1>
        <p className="lead mt-16">Your handover session has ended.</p>

        <div
          className="privacy-inline"
          style={{ justifyContent: 'center', maxWidth: '38ch', margin: '24px auto 0' }}
        >
          <span style={{ color: 'var(--accent)', flex: 'none', marginTop: 1 }}>
            <ShieldIcon />
          </span>
          <span>Kabla has cleared the information from this session.</span>
        </div>

        <div className="mt-32">
          <button className="btn btn-primary btn-lg" onClick={onRestart}>
            Start a new handover
          </button>
        </div>
      </div>
    </div>
  )
}
