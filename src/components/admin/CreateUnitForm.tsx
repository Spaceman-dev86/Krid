'use client'

import { useState } from 'react'

import { Button, IconMinus, IconPlus, daFieldClass, daSelectClass } from '@/src/components/ui'

export type CreatedCatalogUnit = {
  id: string
  key: string
  label: string
  short_label?: string | null
  value_mode: 'number' | 'time' | 'text' | 'list' | string | null
  list_options?: string[] | null
  dimension?: string | null
}

type ValueMode = 'number' | 'time' | 'text' | 'list'

type Props = {
  /** Affiche le bouton Annuler (popup). */
  showCancel?: boolean
  submitLabel?: string
  onCancel?: () => void
  onCreated: (unit: CreatedCatalogUnit) => void
}

export function CreateUnitForm({
  showCancel = false,
  submitLabel = 'Créer',
  onCancel,
  onCreated,
}: Props) {
  const [label, setLabel] = useState('')
  const [symbol, setSymbol] = useState('')
  const [valueMode, setValueMode] = useState<ValueMode>('number')
  const [listOptions, setListOptions] = useState<string[]>([''])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setMode(next: ValueMode) {
    setValueMode(next)
    if (next === 'list' && listOptions.length === 0) setListOptions([''])
    if (next !== 'list') setListOptions([''])
  }

  function updateOption(index: number, value: string) {
    setListOptions((prev) => prev.map((x, i) => (i === index ? value : x)))
  }

  function addOption() {
    setListOptions((prev) => [...prev, ''])
  }

  function removeOption(index: number) {
    setListOptions((prev) => {
      if (prev.length <= 1) return ['']
      return prev.filter((_, i) => i !== index)
    })
  }

  async function submit() {
    const trimmedLabel = label.trim()
    const trimmedSymbol = symbol.trim()
    if (!trimmedLabel) {
      setError('Libellé requis')
      return
    }
    if (!trimmedSymbol) {
      setError('Symbole / unité requis (ex. m, kg)')
      return
    }

    const options =
      valueMode === 'list'
        ? [...new Set(listOptions.map((x) => x.trim()).filter(Boolean))]
        : undefined
    if (valueMode === 'list' && (!options || options.length < 2)) {
      setError('Une liste nécessite au moins 2 options')
      return
    }

    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: trimmedLabel,
          short_label: trimmedSymbol.slice(0, 12),
          value_mode: valueMode,
          list_options: options,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        unit?: CreatedCatalogUnit
      }
      if (!res.ok || !json.unit) {
        setError(json.error || 'Création impossible')
        return
      }
      onCreated(json.unit)
      setLabel('')
      setSymbol('')
      setValueMode('number')
      setListOptions([''])
    } catch {
      setError('Erreur réseau')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">Libellé *</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${daFieldClass} w-full min-w-0`}
            placeholder="Distance, Charge…"
            autoFocus
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">Symbole *</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.slice(0, 12))}
            className={`${daFieldClass} w-full min-w-0`}
            placeholder="m, kg…"
            maxLength={12}
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">Saisie *</span>
          <select
            value={valueMode}
            onChange={(e) => setMode(e.target.value as ValueMode)}
            className={`${daSelectClass} w-full min-w-0`}
          >
            <option value="number">Numérique</option>
            <option value="time">Temps</option>
            <option value="list">Liste</option>
            <option value="text">Texte</option>
          </select>
        </label>
      </div>

      {valueMode === 'list' ? (
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">Options *</span>
          <div className="grid gap-1">
            {listOptions.map((opt, index) => (
              <div key={`opt-${index}`} className="flex items-center gap-1.5">
                <input
                  value={opt}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className={`${daFieldClass} min-w-0 flex-1`}
                  placeholder={`Option ${index + 1}`}
                />
                {listOptions.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                    aria-label="Retirer l’option"
                    onClick={() => removeOption(index)}
                  >
                    <IconMinus size={14} />
                  </button>
                ) : (
                  <span className="inline-block h-9 w-9 shrink-0" aria-hidden />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
          >
            <IconPlus size={12} />
            Option
          </button>
        </div>
      ) : null}

      {error ? <p className="text-[12px] font-semibold text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {showCancel && onCancel ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={() => void submit()} disabled={pending}>
          {pending ? 'Création…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
