'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/src/components/ui'

export type ProfileFormSaveResult = { ok: true } | { ok: false; error: string }

type Props = {
  formId: string
  saveAction: (fd: FormData) => Promise<ProfileFormSaveResult>
  /** Retourne un message d’erreur pour bloquer le save, sinon null. */
  validate?: (fd: FormData) => string | null
  debounceMs?: number
  savedMs?: number
  buttonLabel?: string
}

/**
 * Enregistrer + autosave silencieux.
 * Message « Enregistré » uniquement après clic sur le bouton (3s), pas de label « auto ».
 */
export function ProfileFormSaveBar({
  formId,
  saveAction,
  validate,
  debounceMs = 900,
  savedMs = 3000,
  buttonLabel = 'Enregistrer',
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seqRef = useRef(0)
  const skipNextRef = useRef(true)
  const saveActionRef = useRef(saveAction)
  const validateRef = useRef(validate)
  saveActionRef.current = saveAction
  validateRef.current = validate

  function runSave(announce: boolean) {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const fd = new FormData(form)
    const blocked = validateRef.current?.(fd) ?? null
    if (blocked) {
      if (announce) {
        setStatus('error')
        setError(blocked)
      }
      return
    }

    const seq = ++seqRef.current
    if (announce) {
      setStatus('pending')
      setError(null)
    }
    startTransition(async () => {
      const res = await saveActionRef.current(fd)
      if (seq !== seqRef.current) return
      if (!res.ok) {
        setStatus('error')
        setError(res.error)
        return
      }
      if (announce) {
        setStatus('saved')
        setError(null)
        router.refresh()
        if (hideRef.current) clearTimeout(hideRef.current)
        hideRef.current = setTimeout(() => {
          setStatus((s) => (s === 'saved' ? 'idle' : s))
        }, savedMs)
      }
    })
  }

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return

    const schedule = () => {
      if (skipNextRef.current) {
        skipNextRef.current = false
        return
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => runSave(false), debounceMs)
    }

    const onSubmit = (e: Event) => {
      e.preventDefault()
      if (timerRef.current) clearTimeout(timerRef.current)
      runSave(true)
    }

    form.addEventListener('input', schedule)
    form.addEventListener('change', schedule)
    form.addEventListener('submit', onSubmit)
    return () => {
      form.removeEventListener('input', schedule)
      form.removeEventListener('change', schedule)
      form.removeEventListener('submit', onSubmit)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (hideRef.current) clearTimeout(hideRef.current)
    }
    // runSave closes over formId/savedMs/startTransition — rebind when those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, debounceMs, savedMs])

  const busy = status === 'pending' || pending
  const hint =
    status === 'error'
      ? error || 'Erreur'
      : status === 'saved'
        ? 'Enregistré'
        : busy
          ? 'Enregistrement…'
          : null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="submit"
        disabled={busy && status === 'pending'}
        className="!rounded-lg !px-4 !py-2 text-sm font-bold"
      >
        {buttonLabel}
      </Button>
      {hint ? (
        <p
          className={`text-[11px] font-semibold ${
            status === 'error'
              ? 'text-[var(--danger)]'
              : status === 'saved'
                ? 'text-[color:var(--brand)]'
                : 'text-[color:var(--muted)]'
          }`}
          aria-live="polite"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
