'use client'

import {
  formatSecondsToMmSs,
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
      <div className="flex h-10 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--brand)]">
        {children}
      </div>
    </div>
  )
}

const inputInShell =
  'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-[color:var(--fg)] outline-none'

const btnCol =
  'flex w-9 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]'

const btn =
  'flex flex-1 items-center justify-center text-[13px] font-bold leading-none text-[color:var(--fg)] hover:bg-[var(--accent)]'

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
          const sec = parseMmSsToSeconds(value)
          if (sec == null) {
            if (!value.trim()) return
            onChange('00:00')
            return
          }
          onChange(formatSecondsToMmSs(sec))
        }}
        placeholder="mm:ss"
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
