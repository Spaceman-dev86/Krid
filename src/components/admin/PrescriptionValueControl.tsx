'use client'

import {
  formatSecondsToMmSs,
  parseFlexibleTimeToSeconds,
  parseMmSsToSeconds,
} from '@/src/components/program-editor-v2/utils/prescriptionHelpers'

const shell =
  'box-border flex h-9 w-full min-w-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] focus-within:border-[var(--brand)] max-[1099px]:h-12'

const stepBtn =
  'flex min-h-0 flex-1 items-center justify-center text-[9px] font-semibold leading-none text-[color:var(--muted)] transition hover:bg-[var(--accent)] hover:text-[color:var(--fg)] max-[1099px]:text-[15px]'

export type PrescriptionValueMode = 'hybrid' | 'time' | 'text'

/**
 * Style ancien program builder :
 * - hybrid : texte OU chiffre libre + steppers +/- (si non numérique → repart de 0)
 * - time   : mm:ss + steppers ±15s
 * - text   : texte seul (tempo, note…)
 */
export function PrescriptionValueControl({
  mode = 'hybrid',
  value,
  onChange,
  placeholder,
  step = 1,
  timeStepSec = 15,
}: {
  mode?: PrescriptionValueMode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  step?: number
  timeStepSec?: number
}) {
  const showSteppers = mode === 'hybrid' || mode === 'time'
  const ph =
    placeholder ??
    (mode === 'time' ? 'mm:ss' : mode === 'text' ? '1-2-3 · max' : '0')

  return (
    <div className={shell}>
      {mode === 'time' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const sec = parseFlexibleTimeToSeconds(value)
            if (sec == null) {
              if (!value.trim()) return
              onChange('00:00')
              return
            }
            onChange(formatSecondsToMmSs(sec))
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const sec = parseFlexibleTimeToSeconds(value)
            if (sec == null) {
              if (value.trim()) onChange('00:00')
            } else {
              onChange(formatSecondsToMmSs(sec))
            }
            ;(e.currentTarget as HTMLInputElement).blur()
          }}
          placeholder={ph}
          className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm tabular-nums text-[color:var(--fg)] outline-none max-[767px]:text-center"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-[color:var(--fg)] outline-none max-[767px]:text-center"
          placeholder={ph}
        />
      )}

      {showSteppers ? (
        <div className="flex h-full w-5 shrink-0 flex-col self-stretch border-l border-[var(--border)] bg-transparent max-[1099px]:w-11">
          <button
            type="button"
            className={stepBtn}
            aria-label="Augmenter"
            onClick={() => {
              if (mode === 'time') {
                const cur = parseMmSsToSeconds(value) ?? 0
                onChange(formatSecondsToMmSs(Math.max(0, cur + timeStepSec)))
                return
              }
              // hybrid : comme l’ancien builder — texte non numérique → 0 puis ±
              const n = value.trim() === '' ? 0 : Number(value)
              const base = Number.isFinite(n) ? n : 0
              onChange(String(Math.max(0, Math.floor(base) + step)))
            }}
          >
            +
          </button>
          <button
            type="button"
            className={`${stepBtn} border-t border-[var(--border)]`}
            aria-label="Diminuer"
            onClick={() => {
              if (mode === 'time') {
                const cur = parseMmSsToSeconds(value) ?? 0
                onChange(formatSecondsToMmSs(Math.max(0, cur - timeStepSec)))
                return
              }
              const n = value.trim() === '' ? 0 : Number(value)
              const base = Number.isFinite(n) ? n : 0
              onChange(String(Math.max(0, Math.floor(base) - step)))
            }}
          >
            −
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Liste (RPE, zones…) : options fournies par l’unité. */
export function PrescriptionListSelect({
  value,
  onChange,
  options,
  ariaLabel = 'Choix',
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  ariaLabel?: string
}) {
  const selected = options.includes(value) ? value : ''
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className={`${shell} appearance-none px-2 text-sm text-[color:var(--fg)] outline-none max-[767px]:text-center`}
      aria-label={ariaLabel}
    >
      <option value="">—</option>
      {options.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  )
}

/** @deprecated alias — préférer PrescriptionListSelect */
export function PrescriptionRpeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <PrescriptionListSelect
      value={value}
      onChange={onChange}
      options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']}
      ariaLabel="RPE"
    />
  )
}
