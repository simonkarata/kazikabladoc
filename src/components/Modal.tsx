import { useEffect } from 'react'

type Props = {
  title: string
  children: React.ReactNode
  actions: React.ReactNode
  onClose: () => void
}

export function Modal({ title, children, actions, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {children}
        <div className="btn-row">{actions}</div>
      </div>
    </div>
  )
}
