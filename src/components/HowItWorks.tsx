import { ArrowLeft } from './icons'

type Props = {
  onBack: () => void
  onStart: () => void
}

export function HowItWorks({ onBack, onStart }: Props) {
  return (
    <div className="frame fade-in">
      <button className="btn btn-ghost" onClick={onBack} style={{ alignSelf: 'flex-start', padding: '8px 12px' }}>
        <ArrowLeft /> Back
      </button>

      <div className="card card-pad-lg mt-16 prose">
        <p className="eyebrow">How it works</p>
        <h2 style={{ marginTop: 8 }}>Four questions, one clear story</h2>
        <p>
          Kabla asks four simple questions and turns your answers into a one-page note you can show a
          healthcare professional. It keeps your <strong>concern</strong> separate from your{' '}
          <strong>experience</strong>&mdash;and it never diagnoses.
        </p>

        <ol className="steps">
          <li>
            <strong>What did you search?</strong>
            <span>What you looked up online before coming here.</span>
          </li>
          <li>
            <strong>What did it say?</strong>
            <span>What the search, website, or AI told you.</span>
          </li>
          <li>
            <strong>What do you fear it is?</strong>
            <span>Your worry&mdash;kept as your concern, not a diagnosis.</span>
          </li>
          <li>
            <strong>What do you actually feel?</strong>
            <span>What you are truly experiencing, in your own words.</span>
          </li>
        </ol>

        <div className="highlight-card">
          <div className="sijui-line">If you ask for a diagnosis, Kabla says &ldquo;Sijui.&rdquo;</div>
          <p>That decision belongs to a healthcare professional. Kabla only helps you tell your story.</p>
        </div>

        <div className="mt-24">
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Prepare my handover
          </button>
        </div>
      </div>
    </div>
  )
}
