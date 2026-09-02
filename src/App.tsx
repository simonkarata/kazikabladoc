import { useEffect, useState } from 'react'
import type { Handover as HandoverData, QuestionType } from './types'
import { emptyHandover } from './types'
import {
  clearSession,
  generateSessionNumber,
  loadSession,
  saveSession,
} from './services/session'
import { checkAIHealth, getAIProvider } from './services/ai'
import type { AIHealth } from './services/ai'
import { LogoMark } from './components/icons'
import { Modal } from './components/Modal'
import { Welcome } from './components/Welcome'
import { HowItWorks } from './components/HowItWorks'
import { Disclosure } from './components/Disclosure'
import { SessionNumber } from './components/SessionNumber'
import { ChatFlow } from './components/ChatFlow'
import { Review } from './components/Review'
import { Handover } from './components/Handover'
import { NurseMode } from './components/NurseMode'
import { SessionEnded } from './components/SessionEnded'
import { Privacy } from './components/Privacy'

type Screen =
  | 'welcome'
  | 'howItWorks'
  | 'disclosure'
  | 'session'
  | 'questions'
  | 'review'
  | 'handover'
  | 'nurse'
  | 'privacy'
  | 'ended'

// Screens that represent an active handover in progress (End session applies).
const ACTIVE_SCREENS: Screen[] = ['session', 'questions', 'review', 'handover']
// Screens whose state is worth restoring after a refresh.
const RESTORABLE: Screen[] = ['session', 'questions', 'review', 'handover', 'nurse']

const DEMO: Omit<HandoverData, 'sessionNumber' | 'reviewed'> = {
  searched: 'fever headache malaria',
  said: 'It mentioned malaria and typhoid and I got scared.',
  fear: 'I think I have malaria.',
  actuallyFeel: "I've felt hot since yesterday, my head hurts, and I've vomited twice.",
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [returnTo, setReturnTo] = useState<Screen>('welcome')
  const [handover, setHandover] = useState<HandoverData | null>(null)
  const [endConfirm, setEndConfirm] = useState(false)
  const [restored, setRestored] = useState(false)
  const [aiHealth, setAiHealth] = useState<AIHealth | null>(null)

  // ---- Restore an in-progress session after a refresh (device-local only) ----
  useEffect(() => {
    const saved = loadSession()
    if (saved && saved.handover && RESTORABLE.includes(saved.screen as Screen)) {
      setHandover(saved.handover)
      setScreen(saved.screen as Screen)
    }
    setRestored(true)
  }, [])

  // Best-effort check of whether the live Claude backend is reachable, so the
  // UI can honestly show connection state. The app works either way.
  useEffect(() => {
    let alive = true
    checkAIHealth().then((h) => {
      if (alive) setAiHealth(h)
    })
    return () => {
      alive = false
    }
  }, [])

  // ---- Persist the active session to sessionStorage (never a server/db) ----
  useEffect(() => {
    if (!restored) return
    if (handover && RESTORABLE.includes(screen)) {
      saveSession({ screen, handover })
    }
  }, [screen, handover, restored])

  // Scroll to top on major screen changes for a calm, predictable flow.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [screen])

  // If we land on the handover missing a summary (e.g. a refreshed/restored
  // session), generate both summaries lazily. Derived from the patient's own
  // answers — never a diagnosis.
  useEffect(() => {
    if (screen !== 'handover' || !handover) return
    if (handover.summary && handover.patientSummary) return
    let alive = true
    const ai = getAIProvider()
    Promise.all([
      handover.summary ? Promise.resolve(handover.summary) : ai.summarizeHandover(handover),
      handover.patientSummary ? Promise.resolve(handover.patientSummary) : ai.summarizeForPatient(handover),
    ]).then(([summary, patientSummary]) => {
      if (alive) setHandover((h) => (h ? { ...h, summary, patientSummary } : h))
    })
    return () => {
      alive = false
    }
  }, [screen, handover])

  const startHandover = () => {
    setHandover(emptyHandover(generateSessionNumber()))
    setScreen('disclosure')
  }

  const commitAnswer = (key: QuestionType, value: string) => {
    setHandover((h) => (h ? { ...h, [key]: value } : h))
  }

  const confirmEnd = () => {
    clearSession()
    setHandover(null)
    setEndConfirm(false)
    setScreen('ended')
  }

  const restart = () => {
    clearSession()
    setHandover(null)
    setScreen('welcome')
  }

  const openOverlay = (target: 'privacy' | 'howItWorks') => {
    setReturnTo(screen)
    setScreen(target)
  }

  const loadDemo = () => {
    const base = handover ?? emptyHandover(generateSessionNumber())
    setHandover({ ...base, ...DEMO, reviewed: false })
    setScreen('review')
  }

  const isActive = ACTIVE_SCREENS.includes(screen)

  // ---- Nurse mode is a full-bleed presentation surface (no app chrome) ----
  if (screen === 'nurse' && handover) {
    return <NurseMode handover={handover} onExit={() => setScreen('handover')} />
  }

  return (
    <div className="app-shell">
      {screen !== 'welcome' && (
        <header className="topbar no-print">
          <div className="topbar-inner">
            <button
              className="brand"
              onClick={() => (isActive ? undefined : setScreen('welcome'))}
              aria-label="Kabla home"
            >
              <LogoMark />
              <span className="brand-word">KABLA</span>
            </button>
            <div className="topbar-spacer" />
            {screen !== 'privacy' && (
              <button className="topbar-link" onClick={() => openOverlay('privacy')}>
                Privacy
              </button>
            )}
            {isActive && (
              <button className="topbar-link danger" onClick={() => setEndConfirm(true)}>
                End session
              </button>
            )}
          </div>
        </header>
      )}

      <main className="app-main">
        {screen === 'welcome' && (
          <Welcome onStart={startHandover} onHowItWorks={() => openOverlay('howItWorks')} />
        )}

        {screen === 'howItWorks' && (
          <HowItWorks onBack={() => setScreen(returnTo)} onStart={startHandover} />
        )}

        {screen === 'disclosure' && <Disclosure onContinue={() => setScreen('session')} />}

        {screen === 'session' && handover && (
          <SessionNumber sessionNumber={handover.sessionNumber} onStart={() => setScreen('questions')} />
        )}

        {screen === 'questions' && handover && (
          <ChatFlow
            handover={handover}
            onCommit={commitAnswer}
            onDone={() => setScreen('review')}
            onBack={() => setScreen('session')}
          />
        )}

        {screen === 'review' && handover && (
          <Review
            handover={handover}
            onEdit={commitAnswer}
            onCreate={(finalized) => {
              setHandover(finalized)
              setScreen('handover')
            }}
            onBack={() => setScreen('questions')}
          />
        )}

        {screen === 'handover' && handover && (
          <Handover
            handover={handover}
            onShowNurse={() => setScreen('nurse')}
            onEdit={() => setScreen('review')}
          />
        )}

        {screen === 'privacy' && <Privacy onBack={() => setScreen(returnTo)} />}

        {screen === 'ended' && <SessionEnded onRestart={restart} />}
      </main>

      {screen !== 'nurse' && (
        <footer className="app-footer no-print">
          <span>Kabla does not diagnose.</span>
          <span className="dot">•</span>
          <button onClick={() => openOverlay('privacy')}>Your information stays on this device</button>
          {aiHealth && (
            <>
              <span className="dot">•</span>
              <span
                className="ai-status"
                title={
                  aiHealth.provider === 'claude'
                    ? `Answers are organized by Claude (${aiHealth.model}). Safety checks run before the model.`
                    : 'Running in safe mode — Claude is not connected. Your answers are kept exactly as written.'
                }
              >
                <span className={`ai-dot${aiHealth.provider === 'claude' ? ' live' : ''}`} />
                {aiHealth.provider === 'claude' ? 'Claude connected' : 'Safe mode'}
              </span>
            </>
          )}
          {!isActive && screen !== 'ended' && (
            <>
              <span className="dot">•</span>
              <button onClick={loadDemo} title="Fill in the demo scenario">
                Demo
              </button>
            </>
          )}
        </footer>
      )}

      {endConfirm && (
        <Modal
          title="End this handover?"
          onClose={() => setEndConfirm(false)}
          actions={
            <>
              <button className="btn btn-danger" onClick={confirmEnd}>
                End session
              </button>
              <button className="btn btn-secondary" onClick={() => setEndConfirm(false)}>
                Keep working
              </button>
            </>
          }
        >
          <p>Your session information will be cleared from Kabla.</p>
        </Modal>
      )}
    </div>
  )
}
