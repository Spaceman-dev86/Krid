'use client'

import { useMemo, useRef, useState } from 'react'

import { daFieldClass } from '@/src/components/ui'
import { mergeShowroomTags } from '@/src/lib/prestations/showroomPresentation'

type Props = {
  /** Tags custom (hors programme). */
  initialCustomTags: string[]
  programTags?: string[]
  initialHiddenProgramTags?: string[]
  /** Combien de tags afficher sur la carte (0–6). */
  initialCardCount?: number
  brandColor?: string | null
  onChange?: (opts: {
    customTags: string[]
    hiddenProgramTags: string[]
    cardCount: number
    cardTags: string[]
    allTags: string[]
  }) => void
}

function clampCardCount(n: number) {
  if (!Number.isFinite(n)) return 3
  return Math.max(0, Math.min(6, Math.round(n)))
}

/** Une seule sélection de tags + nombre affiché sur la carte. */
export function PrestationShowroomTagsEditor({
  initialCustomTags,
  programTags = [],
  initialHiddenProgramTags = [],
  initialCardCount = 3,
  brandColor,
  onChange,
}: Props) {
  const [customTags, setCustomTags] = useState(initialCustomTags)
  const [hiddenProgram, setHiddenProgram] = useState(() => {
    if (initialHiddenProgramTags.includes('*')) {
      return new Set(programTags.map((t) => t.toLowerCase()))
    }
    return new Set(initialHiddenProgramTags.map((t) => t.toLowerCase()))
  })
  const [cardCount, setCardCount] = useState(() => clampCardCount(initialCardCount))
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const brand = brandColor?.trim() || 'var(--brand)'
  const brandTint =
    typeof brand === 'string' && brand.startsWith('#') ? `${brand}22` : 'var(--accent)'
  const brandText = brand.startsWith('#') ? brand : undefined

  const hiddenList = useMemo(
    () => programTags.filter((t) => hiddenProgram.has(t.toLowerCase())),
    [programTags, hiddenProgram],
  )

  const allTags = useMemo(
    () =>
      mergeShowroomTags({
        customTags,
        programTags,
        hiddenProgramTags: hiddenList,
      }),
    [customTags, programTags, hiddenList],
  )

  const cardTags = allTags.slice(0, cardCount)

  function bumpForm() {
    const form = rootRef.current?.closest('form')
    setTimeout(() => {
      form?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  function emit(
    nextCustom: string[],
    nextHidden: Set<string>,
    nextCount: number,
  ) {
    const hidden = programTags.filter((t) => nextHidden.has(t.toLowerCase()))
    const merged = mergeShowroomTags({
      customTags: nextCustom,
      programTags,
      hiddenProgramTags: hidden,
    })
    const count = clampCardCount(nextCount)
    onChange?.({
      customTags: nextCustom,
      hiddenProgramTags: hidden,
      cardCount: count,
      cardTags: merged.slice(0, count),
      allTags: merged,
    })
    bumpForm()
  }

  function toggleProgramTag(tag: string, visible: boolean) {
    const key = tag.toLowerCase()
    const next = new Set(hiddenProgram)
    if (visible) next.delete(key)
    else next.add(key)
    setHiddenProgram(next)
    emit(customTags, next, cardCount)
  }

  function addCustom(raw: string) {
    const value = raw.trim().slice(0, 32)
    if (!value) return
    if (customTags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    if (customTags.length >= 8) return
    const next = [...customTags, value]
    setCustomTags(next)
    setDraft('')
    emit(next, hiddenProgram, cardCount)
  }

  function removeCustom(index: number) {
    const next = customTags.filter((_, i) => i !== index)
    setCustomTags(next)
    emit(next, hiddenProgram, cardCount)
  }

  function updateCardCount(raw: number) {
    const next = clampCardCount(raw)
    setCardCount(next)
    emit(customTags, hiddenProgram, next)
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--accent)]/25 p-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[color:var(--fg)]">Tags</span>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--muted)]">
          Sur la carte
          <input
            type="number"
            min={0}
            max={6}
            value={cardCount}
            onChange={(e) => updateCardCount(Number(e.target.value))}
            className="w-12 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-center text-[12px] font-bold text-[color:var(--fg)]"
          />
        </label>
      </div>

      {programTags.length ? (
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">
            Programme · coche = inclus
          </span>
          <div className="flex flex-wrap gap-1">
            {programTags.map((tag) => {
              const visible = !hiddenProgram.has(tag.toLowerCase())
              return (
                <label
                  key={tag}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                    visible ? '' : 'opacity-45 line-through'
                  }`}
                  style={
                    visible
                      ? { background: brandTint, color: brandText }
                      : { background: 'var(--accent)', color: 'var(--muted)' }
                  }
                >
                  <input
                    type="checkbox"
                    name="program_tag_visible"
                    value={tag}
                    checked={visible}
                    onChange={(e) => toggleProgramTag(tag, e.target.checked)}
                    className="rounded"
                  />
                  {tag}
                </label>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1">
        <span className="text-[11px] font-semibold text-[color:var(--muted)]">
          Tags custom
          <span className="ml-1 font-normal">· Entrée pour ajouter</span>
        </span>
        {customTags.length ? (
          <div className="flex flex-wrap gap-1">
            {customTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: brandTint, color: brandText }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeCustom(i)}
                  className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] opacity-70 hover:opacity-100"
                  aria-label={`Retirer ${tag}`}
                >
                  ×
                </button>
                <input type="hidden" name="showroom_popup_tags" value={tag} />
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 32))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                e.stopPropagation()
                addCustom(draft)
              }
            }}
            placeholder="Nouveau tag"
            className={daFieldClass}
            disabled={customTags.length >= 8}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => addCustom(draft)}
            disabled={!draft.trim() || customTags.length >= 8}
            className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-sm font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Carte = les N premiers de la sélection globale */}
      {cardTags.map((tag) => (
        <input key={`carte-${tag}`} type="hidden" name="showroom_tags" value={tag} />
      ))}

      {allTags.length ? (
        <p className="text-[10px] leading-snug text-[color:var(--muted)]">
          Carte ({cardTags.length}) :{' '}
          <span className="font-semibold text-[color:var(--fg)]">
            {cardTags.length ? cardTags.join(' · ') : 'aucun'}
          </span>
          {allTags.length > cardTags.length ? (
            <>
              {' '}
              · popup +{allTags.length - cardTags.length}
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-[10px] text-[color:var(--muted)]">
          Coche des tags programme ou ajoute un tag custom.
        </p>
      )}
    </div>
  )
}
