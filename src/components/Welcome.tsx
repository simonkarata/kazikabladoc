import { LogoMark } from './icons'

type Props = {
  onStart: () => void
  onHowItWorks: () => void
}

export function Welcome({ onStart, onHowItWorks }: Props) {
  return (
    <div className="frame fade-in">
      <div className="welcome-hero">
        <div className="welcome-logo">
          <LogoMark />
          <span className="word">KABLA</span>
        </div>

        <div className="welcome-tagline">Before the diagnosis, get the story right.</div>

        <h1 className="welcome-hero-title">
          Don&rsquo;t hand the nurse a verdict.
          <br />
          <span className="accent">Hand them your story.</span>
        </h1>

        <p className="welcome-desc">
          Kabla helps you organize what you searched, what you were told, what you&rsquo;re worried
          about, and what you&rsquo;re actually experiencing&mdash;before you speak with a healthcare
          professional.
        </p>

        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Prepare my handover
          </button>
          <button className="link-btn" onClick={onHowItWorks}>
            How it works
          </button>
        </div>

        <div className="welcome-trust trust-row">
          <span className="chip">
            <span className="tick" /> AI-assisted
          </span>
          <span className="chip">
            <span className="tick" /> No diagnosis
          </span>
          <span className="chip">
            <span className="tick" /> Patient reviewed
          </span>
        </div>

        <p className="welcome-note">
          Designed for the moment between searching online and speaking to a healthcare professional.
        </p>
      </div>
    </div>
  )
}
