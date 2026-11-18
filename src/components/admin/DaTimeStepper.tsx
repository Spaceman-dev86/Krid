'use client'

import {
  formatSecondsToMmSs,
  parseFlexibleTimeToSeconds,
  parseMmSsToSeconds,
} from '@/src/components/program-editor-v2/utils/prescriptionHelpers'

type ShellProps = {
  label: string
  onRemove?: () => void
  children: React.ReactNode
}

/** Conteneur unique : +/- dans la même bordure que l’input. */
function StepperShell({ label, onRemove, children }: ShellProps) {
  return (
    <div className="grid gap-1.5">
      {label || onRemove ? (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
          ) : (
            <span />
          )}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] font-semibold text-red-500 hover:underline"
            >
              Retirer
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="box-border flex h-10 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] focus-within:border-[var(--brand)] max-[1099px]:h-14">
        {children}
      </div>
    </div>
  )
}

const inputInShell =
  'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-[color:var(--fg)] outline-none'

const btnCol =
  'flex w-9 shrink-0 flex-col self-stretch border-l border-[var(--border)] bg-transparent max-[1099px]:w-12'

const btn =
  'flex min-h-0 flex-1 items-center justify-center text-[13px] font-bold leading-none text-[color:var(--fg)] hover:bg-[var(--accent)] max-[1099px]:text-[17px]'

type TimeProps = {
  name: string
  label: string
  value: string
  onChange: (next: string) => void
  stepSeconds?: number
  onRemove?: () => void
}

export function DaTimeStepper({
  name,
  label,
  value,
  onChange,
  stepSeconds = 15,
  onRemove,
}: TimeProps) {
  function step(delta: number) {
    const cur = parseMmSsToSeconds(value) ?? 0
    onChange(formatSecondsToMmSs(Math.max(0, cur + delta * stepSeconds)))
  }

  return (
    <StepperShell label={label} onRemove={onRemove}>
      <input
        name={name}
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
        placeholder="mm:ss ou 20 → 20:00"
        inputMode="text"
        className={inputInShell}
      />
      <div className={btnCol}>
        <button type="button" aria-label="+15 secondes" className={btn} onClick={() => step(+1)}>
          +
        </button>
        <button
          type="button"
          aria-label="−15 secondes"
          className={`${btn} border-t border-[var(--border)]`}
          onClick={() => step(-1)}
        >
          −
        </button>
      </div>
    </StepperShell>
  )
}

type IntProps = {
  name?: string
  label: string
  value: string
  onChange: (next: string) => void
  min?: number
  onRemove?: () => void
}

export function DaIntStepper({ name, label, value, onChange, min = 0, onRemove }: IntProps) {
  function step(delta: number) {
    const n = Number.parseInt(value || '0', 10)
    const base = Number.isFinite(n) ? n : 0
    onChange(String(Math.max(min, base + delta)))
  }

  return (
    <StepperShell label={label} onRemove={onRemove}>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        className={`${inputInShell} appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <div className={btnCol}>
        <button type="button" className={btn} onClick={() => step(+1)}>
          +
        </button>
        <button type="button" className={`${btn} border-t border-[var(--border)]`} onClick={() => step(-1)}>
          −
        </button>
      </div>
    </StepperShell>
  )
}
