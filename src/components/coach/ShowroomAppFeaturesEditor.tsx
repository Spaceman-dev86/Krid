'use client'

import { useRef, useState } from 'react'

import { daFieldClass } from '@/src/components/ui'

type Props = {
  initial: string[]
  brandColor?: string | null
  onChange?: (features: string[]) => void
}

/** Liste de points forts (✓) pour la card app showroom. */
export function ShowroomAppFeaturesEditor({ initial, brandColor, onChange }: Props) {
  const [items, setItems] = useState(initial)
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const brand = brandColor?.trim() || 'var(--brand)'

  function emit(next: string[]) {
    onChange?.(next)
    const form = rootRef.current?.closest('form')
    setTimeout(() => {
      form?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  function commit(next: string[]) {
    setItems(next)
    emit(next)
  }

  function add(raw: string) {
    const value = raw.trim().slice(0, 80)
    if (!value) return
    if (items.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    if (items.length >= 8) return
    commit([...items, value])
    setDraft('')
  }

  function removeAt(index: number) {
    commit(items.filter((_, i) => i !== index))
  }

  return (
    <div ref={rootRef} className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent)]/25 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[color:var(--fg)]">
          Points forts (✓)
        </span>
        <span className="text-[10px] text-[color:var(--muted)]">{items.length}/8</span>
      </div>

      {items.length ? (
        <ul className="grid gap-0">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className={`flex items-center gap-2 ${
                i > 0 ? 'border-t border-[var(--border)]' : ''
              } py-1.5`}
            >
              <span className="shrink-0 text-sm font-bold" style={{ color: brand }} aria-hidden>
                ✓
              </span>
              <span className="min-w-0 flex-1 text-sm text-[color:var(--fg)]">{item}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="shrink-0 text-[11px] font-semibold text-[color:var(--muted)] hover:text-[var(--danger)]"
                aria-label={`Retirer ${item}`}
              >
                ×
              </button>
              <input type="hidden" name="app_showroom_features" value={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[color:var(--muted)]">
          Ex. Accès illimité aux programmes · Suivi de progression…
        </p>
      )}

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 80))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder="Ajouter un point · Entrée"
          className={daFieldClass}
          disabled={items.length >= 8}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim() || items.length >= 8}
          className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-sm font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}
