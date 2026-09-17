'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { DaIntStepper, DaTimeStepper } from '@/src/components/admin/DaTimeStepper'
import { Button, daSelectClass } from '@/src/components/ui'
import {
  formatSecondsToMmSs,
  parseMmSsToSeconds,
} from '@/src/components/program-editor-v2/utils/prescriptionHelpers'
import {
  BLOCK_TIMER_KIND_LABEL,
  BLOCK_TIMER_KINDS,
  defaultAlertSeconds,
  defaultTimerConfig,
  type BlockTimerConfig,
  type BlockTimerKind,
} from '@/src/lib/blocks/timerConfig'

type Props = {
  open: boolean
  initial: BlockTimerConfig | null
  onClose: () => void
  onSave: (config: BlockTimerConfig | null) => void
}

function TimeField({
  label,
  seconds,
  onChangeSeconds,
}: {
  label: string
  seconds: number
  onChangeSeconds: (s: number) => void
}) {
  return (
    <DaTimeStepper
      name={`timer_${label}`}
      label={label}
      value={formatSecondsToMmSs(seconds)}
      stepSeconds={15}
      onChange={(mmss) => {
        const sec = parseMmSsToSeconds(mmss)
        onChangeSeconds(sec == null ? 0 : sec)
      }}
    />
  )
}

function AlertSection({
  alertEverySeconds,
  onChange,
}: {
  alertEverySeconds: number | null | undefined
  onChange: (next: number | null) => void
}) {
  const enabled = alertEverySeconds != null && alertEverySeconds > 0

  return (
    <div className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]">
      <label className="inline-flex items-center gap-2 text-sm text-[color:var(--fg)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            onChange(e.target.checked ? defaultAlertSeconds() : null)
          }}
          className="accent-[var(--brand)]"
        />
        <span className="font-semibold">Alerte</span>
        <span className="text-[11px] text-[color:var(--muted)]">ex. toutes les 3 min</span>
      </label>
      {enabled ? (
        <TimeField
          label="Toutes les"
          seconds={alertEverySeconds!}
          onChangeSeconds={(s) => onChange(s > 0 ? s : defaultAlertSeconds())}
        />
      ) : null}
    </div>
  )
}

export function BlockTimerDialog({ open, initial, onClose, onSave }: Props) {
  const [kind, setKind] = useState<BlockTimerKind>(initial?.kind ?? 'countdown')
  const [config, setConfig] = useState<BlockTimerConfig>(initial ?? defaultTimerConfig('countdown'))
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const next = initial ?? defaultTimerConfig('countdown')
    setKind(next.kind)
    setConfig(next)
  }, [open, initial])

  if (!open || !mounted) return null

  function changeKind(next: BlockTimerKind) {
    setKind(next)
    setConfig(defaultTimerConfig(next))
  }

  function patch<K extends BlockTimerKind>(
    k: K,
    nextPatch: Partial<Extract<BlockTimerConfig, { kind: K }>>,
  ) {
    setConfig((prev) => {
      if (prev.kind !== k) return prev
      return { ...prev, ...nextPatch } as BlockTimerConfig
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-timer-title"
      >
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 id="block-timer-title" className="text-sm font-bold text-[color:var(--fg)]">
              Minuteur du bloc
            </h2>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
              Config structurée pour le chrono client
            </p>
          </div>

          <div className="grid gap-4 p-4">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Type</span>
              <select
                value={kind}
                onChange={(e) => changeKind(e.target.value as BlockTimerKind)}
                className={daSelectClass}
              >
                {BLOCK_TIMER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {BLOCK_TIMER_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            {config.kind === 'countdown' ? (
              <div className="grid gap-3">
                <TimeField
                  label="Durée"
                  seconds={config.duration_seconds}
                  onChangeSeconds={(duration_seconds) =>
                    patch('countdown', { duration_seconds })
                  }
                />
                <AlertSection
                  alertEverySeconds={config.alert_every_seconds}
                  onChange={(alert_every_seconds) =>
                    patch('countdown', { alert_every_seconds })
                  }
                />
              </div>
            ) : null}

            {config.kind === 'stopwatch' ? (
              <div className="grid gap-3">
                <p className="rounded-[var(--radius-md)] bg-[var(--page-bg)] px-3 py-3 text-center text-[12px] text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                  Chronomètre libre — compte en avant, sans durée fixe.
                </p>
                <AlertSection
                  alertEverySeconds={config.alert_every_seconds}
                  onChange={(alert_every_seconds) =>
                    patch('stopwatch', { alert_every_seconds })
                  }
                />
              </div>
            ) : null}

            {config.kind === 'circuit' ? (
              <div className="grid gap-3">
                <DaIntStepper
                  label="For"
                  value={String(config.rounds)}
                  min={1}
                  onChange={(raw) => {
                    const n = Number.parseInt(raw || '1', 10)
                    patch('circuit', { rounds: Number.isFinite(n) && n >= 1 ? n : 1 })
                  }}
                />
                <TimeField
                  label="Work"
                  seconds={config.work_seconds}
                  onChangeSeconds={(work_seconds) => patch('circuit', { work_seconds })}
                />
                <TimeField
                  label="Rest"
                  seconds={config.rest_seconds}
                  onChangeSeconds={(rest_seconds) => patch('circuit', { rest_seconds })}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onSave(null)
                  onClose()
                }}
              >
                Effacer
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSave(config)
                  onClose()
                }}
              >
                Valider
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
