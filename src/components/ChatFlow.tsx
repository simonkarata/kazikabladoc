import { useEffect, useRef, useState } from 'react'
import type { Handover, QuestionType } from '../types'
import { getAIProvider } from '../services/ai'
import type { UnsafeCategory } from '../services/safety'

// A calm, conversational flow. Kabla asks; the patient replies inline. It still
// captures exactly the FOUR core answers — searched, said, fear, actuallyFeel —
// but conversationally, and it does NOT presume the patient searched elsewhere:
// it asks first. Kabla never searches for them and never shows medical results.

const NO_SEARCH = "I didn't search online."
const NO_SEARCH_SAID = "I didn't look anything up, so there was nothing I was told."

type Step = 'gate' | 'searched' | 'said' | 'fear' | 'feel' | 'done'

type ContentStep = Exclude<Step, 'gate' | 'done'>

const SCRIPT: Record<
  ContentStep,
  { ask: string; field: QuestionType; placeholder: string; note?: string; suggestions?: string[] }
> = {
  searched: {
    ask: 'What did you search for? Type it just like you looked it up.',
    field: 'searched',
    placeholder: 'e.g. "fever headache malaria"',
    suggestions: ['fever and headache', 'stomach pain', 'coughing at night', 'dizziness'],
  },
  said: {
    ask: 'And what did it tell you? Just the part that stood out.',
    field: 'said',
    placeholder: 'e.g. "It mentioned malaria and typhoid"',
  },
  fear: {
    ask: 'What are you worried it might be?',
    field: 'fear',
    placeholder: 'e.g. "I think I have malaria"',
    note: 'This is your concern, not a diagnosis.',
  },
  feel: {
    ask: 'Now set the worry aside for a moment — what are you actually feeling?',
    field: 'actuallyFeel',
    placeholder: "e.g. \"I've felt hot since yesterday, my head hurts…\"",
    note: "Use your own words. Don't worry about medical terms.",
  },
}

const GATE_ASK =
  "Before you came here, did you look up how you're feeling online — on Google, a website, or an AI assistant?"
const GREETING =
  "Hi, I'm Kabla. I'll ask a few short questions, then turn your answers into a note you can show the healthcare professional. There are no wrong answers."
const CLOSING = "Thank you — that's everything I need. Let's check your story together before you share it."

type Msg = { id: number; role: 'kabla' | 'patient' | 'sijui'; text: string; category?: UnsafeCategory }

const ai = getAIProvider()

function nextAfter(step: Step): Step {
  switch (step) {
    case 'searched':
      return 'said'
    case 'said':
      return 'fear'
    case 'fear':
      return 'feel'
    case 'feel':
      return 'done'
    default:
      return 'done'
  }
}

function coreDone(h: Handover): number {
  return [h.searched, h.said, h.fear, h.actuallyFeel].filter((v) => v && v.trim()).length
}

type Props = {
  handover: Handover
  onCommit: (key: QuestionType, value: string) => void
  onDone: () => void
  onBack: () => void
}

export function ChatFlow({ handover, onCommit, onDone, onBack }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [step, setStep] = useState<Step>('gate')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const idRef = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const nextId = () => ++idRef.current
  const push = (role: Msg['role'], text: string, category?: UnsafeCategory) =>
    setMessages((m) => [...m, { id: nextId(), role, text, category }])

  const askStep = (s: Step) => {
    if (s === 'done') {
      push('kabla', CLOSING)
    } else if (s === 'gate') {
      push('kabla', GATE_ASK)
    } else {
      const cfg = SCRIPT[s]
      push('kabla', cfg.note ? `${cfg.ask}\n${cfg.note}` : cfg.ask)
    }
  }

  // Seed / reconstruct the conversation from whatever is already answered, so a
  // refresh mid-session lands back in the right place (no chat log is stored).
  useEffect(() => {
    const seed: Msg[] = []
    let id = 0
    const add = (role: Msg['role'], text: string) => seed.push({ id: ++id, role, text })
    add('kabla', GREETING)

    const searched = handover.searched?.trim()
    const said = handover.said?.trim()
    const fear = handover.fear?.trim()
    const feel = handover.actuallyFeel?.trim()

    let start: Step = 'gate'
    if (!searched) {
      start = 'gate'
      add('kabla', GATE_ASK)
    } else {
      const didNotSearch = searched === NO_SEARCH
      add('kabla', GATE_ASK)
      add('patient', didNotSearch ? "No, I didn't" : 'Yes, I searched')
      if (!didNotSearch) {
        add('kabla', SCRIPT.searched.ask)
        add('patient', searched)
        if (!said) {
          start = 'said'
          add('kabla', SCRIPT.said.ask)
        } else {
          add('kabla', SCRIPT.said.ask)
          add('patient', said)
          start = nextFilled()
        }
      } else {
        start = nextFilled()
      }
    }

    function nextFilled(): Step {
      if (!fear) {
        add('kabla', withNote('fear'))
        return 'fear'
      }
      add('kabla', withNote('fear'))
      add('patient', fear)
      if (!feel) {
        add('kabla', withNote('feel'))
        return 'feel'
      }
      add('kabla', withNote('feel'))
      add('patient', feel)
      add('kabla', CLOSING)
      return 'done'
    }
    function withNote(s: ContentStep) {
      const c = SCRIPT[s]
      return c.note ? `${c.ask}\n${c.note}` : c.ask
    }

    idRef.current = id
    setMessages(seed)
    setStep(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus())

  // Advance to the next step, emitting Kabla's next message.
  const advance = (from: Step) => {
    const to = nextAfter(from)
    setStep(to)
    askStep(to)
    if (to !== 'done') focusInput()
  }

  const commitContent = async (raw: string) => {
    const cfg = SCRIPT[step as ContentStep]
    // Safety FIRST — before accepting or organizing the answer.
    const classification = await ai.classifyMessage(raw)
    if (!classification.safe) {
      const category: UnsafeCategory =
        classification.category === 'treatment_request' ? 'treatment' : 'diagnosis'
      push('sijui', '', category)
      // Re-ask the same question, warmly.
      push('kabla', `Let's get back to what you know. ${cfg.note ? cfg.ask + '\n' + cfg.note : cfg.ask}`)
      focusInput()
      return
    }
    const cleaned = await ai.extractAnswer(raw, cfg.field)
    onCommit(cfg.field, cleaned || raw.trim())
    advance(step)
  }

  const handleSend = async (textArg?: string) => {
    const text = (textArg ?? input).trim()
    if (!text || busy || step === 'done') return
    setInput('')
    push('patient', text)
    setBusy(true)
    try {
      if (step === 'gate') {
        // Interpret free text as yes/no; classify in case it's a medical ask.
        const cls = await ai.classifyMessage(text)
        if (!cls.safe) {
          push('sijui', '', cls.category === 'treatment_request' ? 'treatment' : 'diagnosis')
          push('kabla', `No problem. ${GATE_ASK}`)
          return
        }
        if (/\b(no|nope|nah|didn'?t|did not|haven'?t|never)\b/i.test(text)) {
          answeredNoSearch()
        } else {
          // Treat as "yes" — move into the search questions.
          setStep('searched')
          askStep('searched')
          focusInput()
        }
      } else {
        await commitContent(text)
      }
    } catch {
      // If the AI layer fails entirely, keep the patient's words and move on.
      if (step !== 'gate') {
        const cfg = SCRIPT[step as ContentStep]
        onCommit(cfg.field, text)
        advance(step)
      }
    } finally {
      setBusy(false)
    }
  }

  const answeredNoSearch = () => {
    onCommit('searched', NO_SEARCH)
    onCommit('said', NO_SEARCH_SAID)
    setStep('fear')
    askStep('fear')
    focusInput()
  }

  const handleGate = (value: 'yes' | 'no') => {
    if (busy) return
    push('patient', value === 'yes' ? 'Yes, I searched' : "No, I didn't")
    if (value === 'no') {
      answeredNoSearch()
    } else {
      setStep('searched')
      askStep('searched')
      focusInput()
    }
  }

  const addSuggestion = (s: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${s}` : s))
    focusInput()
  }

  const contentCfg = step !== 'gate' && step !== 'done' ? SCRIPT[step as ContentStep] : null
  const filled = coreDone(handover)

  return (
    <div className="frame chat-frame">
      <div className="chat-head">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>
          Back
        </button>
        <div className="chat-progress" aria-label={`${filled} of 4 answered`}>
          Preparing your handover · <span>{filled}/4</span>
        </div>
      </div>

      <div className="chat-scroll">
        {messages.map((m) =>
          m.role === 'sijui' ? (
            <SijuiBubble key={m.id} category={m.category ?? 'diagnosis'} />
          ) : (
            <div key={m.id} className={`bubble-row ${m.role}`}>
              <div className={`bubble ${m.role}`}>{m.text}</div>
            </div>
          ),
        )}
        {busy && (
          <div className="bubble-row kabla">
            <div className="bubble kabla typing" aria-label="Kabla is typing">
              <span /> <span /> <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-composer no-print">
        {step === 'gate' && !busy && (
          <div className="quick-row">
            <button className="quick-reply" onClick={() => handleGate('yes')}>
              Yes, I searched
            </button>
            <button className="quick-reply" onClick={() => handleGate('no')}>
              No, I didn&rsquo;t
            </button>
          </div>
        )}

        {contentCfg && (
          <div className="quick-row">
            {contentCfg.suggestions?.map((s) => (
              <button key={s} className="quick-reply subtle" onClick={() => addSuggestion(s)}>
                + {s}
              </button>
            ))}
            <button className="quick-reply subtle" onClick={() => handleSend("I'm not sure.")}>
              I&rsquo;m not sure
            </button>
          </div>
        )}

        {step === 'done' ? (
          <button className="btn btn-primary btn-block btn-lg" onClick={onDone}>
            Review my answers
          </button>
        ) : (
          <div className="composer-row">
            <textarea
              ref={inputRef}
              className="composer-input"
              rows={1}
              autoFocus
              value={input}
              placeholder={step === 'gate' ? 'Type your reply…' : contentCfg?.placeholder}
              maxLength={2000}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              className="composer-send"
              aria-label="Send"
              onClick={() => handleSend()}
              disabled={busy || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SijuiBubble({ category }: { category: UnsafeCategory }) {
  const line =
    category === 'treatment'
      ? "I can't recommend treatment or medicine. That's for a healthcare professional to decide."
      : "I can't determine your diagnosis. That's for a healthcare professional to decide."
  return (
    <div className="bubble-row kabla">
      <div className="bubble sijui-bubble">
        <div className="sijui-bubble-badge">The safest answer</div>
        <div className="sijui-bubble-word">Sijui.</div>
        <p>{line}</p>
        <p className="soft">I can help you describe what you&rsquo;ve actually experienced.</p>
      </div>
    </div>
  )
}
