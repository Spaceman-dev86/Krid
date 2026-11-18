'use client'

import { useMemo, useRef, useState } from 'react'

import { daFieldClass } from '@/src/components/ui'
import { mergeShowroomTags } from '@/src/lib/prestations/showroomPresentation'

type Props = {
  initialTags: string[]
  programTags?: string[]
  /** Tags programme actuellement masqués. */
  initialHiddenProgramTags?: string[]
  brandColor?: string | null
  compact?: boolean
  /** Titre de la section pastilles custom. */
  title?: string
  /** name des inputs hidden (showroom_tags | showroom_popup_tags). */
  fieldName?: string
  /** Afficher les bascules tags programme (popup). */
  showProgramTags?: boolean
  onChange?: (opts: { customTags: string[]; hiddenProgramTags: string[] }) => void
}

/** Pastilles custom + bascules unitaires des tags programme (optionnel). */
export function ShowroomPastillesEditor({
  initialTags,
  programTags = [],
  initialHiddenProgramTags = [],
  brandColor,
  compact = false,
  title = 'Pastilles custom',
  fieldName = 'showroom_tags',
  showProgramTags = true,
  onChange,
}: Props) {
  const [tags, setTags] = useState(initialTags)
  const [hiddenProgram, setHiddenProgram] = useState(() => {
    if (initialHiddenProgramTags.includes('*')) {
      return new Set(programTags.map((t) => t.toLowerCase()))
    }
    return new Set(initialHiddenProgramTags.map((t) => t.toLowerCase()))
  })
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const brand = brandColor?.trim() || 'var(--brand)'
  const brandTint =
    typeof brand === 'string' && brand.startsWith('#') ? `${brand}22` : 'var(--accent)'
  const brandText = brand.startsWith('#') ? brand : undefined

  function emit(nextTags: string[], nextHidden: Set<string>) {
    onChange?.({
      customTags: nextTags,
      hiddenProgramTags: programTags.filter((t) => nextHidden.has(t.toLowerCase())),
    })
    const form = rootRef.current?.closest('form')
    setTimeout(() => {
      form?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  function commitTags(next: string[]) {
    setTags(next)
    emit(next, hiddenProgram)
  }

  function toggleProgramTag(tag: string, visible: boolean) {
    const key = tag.toLowerCase()
    const next = new Set(hiddenProgram)
    if (visible) next.delete(key)
    else next.add(key)
    setHiddenProgram(next)
    emit(tags, next)
  }

  function addTag(raw: string) {
    const value = raw.trim().slice(0, 32)
    if (!value) return
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    if (tags.length >= 8) return
    commitTags([...tags, value])
    setDraft('')
  }

  function removeAt(index: number) {
    commitTags(tags.filter((_, i) => i !== index))
  }

  const hiddenList = useMemo(
    () => programTags.filter((t) => hiddenProgram.has(t.toLowerCase())),
    [programTags, hiddenProgram],
  )

  const preview = mergeShowroomTags({
    customTags: tags,
    programTags,
    hiddenProgramTags: hiddenList,
  })

  const showPrograms = showProgramTags && programTags.length > 0

  return (
    <div ref={rootRef} className={`grid ${compact ? 'gap-2' : 'gap-3'}`}>
      {showPrograms ? (
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-[color:var(--fg)]">
            Tags programme
            <span className="ml-1 font-normal text-[color:var(--muted)]">· coche = visible</span>
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[color:var(--fg)]">{title}</span>
          <span className="text-[10px] text-[color:var(--muted)]">{tags.length}/8</span>
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: brandTint, color: brandText }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] opacity-70 hover:opacity-100"
                  aria-label={`Retirer ${tag}`}
                >
                  ×
                </button>
                <input type="hidden" name={fieldName} value={tag} />
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 32))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(draft)
              }
            }}
            placeholder="Ajouter · Entrée"
            className={daFieldClass}
            disabled={tags.length >= 8}
          />
          <button
            type="button"
            onClick={() => addTag(draft)}
            disabled={!draft.trim() || tags.length >= 8}
            className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-sm font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {preview.length && !compact && showPrograms ? (
        <p className="text-[11px] text-[color:var(--muted)]">
          Affichées popup :{' '}
          <span className="font-semibold text-[color:var(--fg)]">{preview.join(' · ')}</span>
        </p>
      ) : null}
    </div>
  )
}
