'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SPEC_SECTIONS } from '../../lib/spec-workspace/types'

export function SpecShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin/spec'
  const [dirtyCount, setDirtyCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const dirtyIds = new Set<string>()
    const onDirty = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) dirtyIds.add(id)
      setDirtyCount(dirtyIds.size)
      setSaveStatus('idle')
    }
    const onClean = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) dirtyIds.delete(id)
      setDirtyCount(dirtyIds.size)
    }
    window.addEventListener('spec-mark-dirty', onDirty)
    window.addEventListener('spec-mark-clean', onClean)
    return () => {
      window.removeEventListener('spec-mark-dirty', onDirty)
      window.removeEventListener('spec-mark-clean', onClean)
    }
  }, [])

  const saveAll = useCallback(() => {
    setSaveStatus('saving')
    startTransition(async () => {
      try {
        window.dispatchEvent(new Event('spec-flush-save'))
        // Editors save async; give them a beat then show saved if nothing reported error via status
        await new Promise((r) => setTimeout(r, 400))
        setSaveStatus('saved')
        window.setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch {
        setSaveStatus('error')
      }
    })
  }, [])

  const saveLabel =
    saveStatus === 'saving' || pending
      ? 'Enregistrement…'
      : saveStatus === 'saved'
        ? 'Enregistré'
        : saveStatus === 'error'
          ? 'Erreur'
          : dirtyCount > 0
            ? `Sauvegarder (${dirtyCount})`
            : 'Sauvegarder'

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[color:var(--fg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <Link
            href="/admin"
            className="shrink-0 text-sm font-semibold text-[color:var(--muted)] hover:text-[var(--brand)]"
          >
            ← Admin
          </Link>
          <div className="hidden h-5 w-px bg-[var(--border)] sm:block" aria-hidden />
          <h1 className="shrink-0 text-sm font-extrabold tracking-tight text-[var(--brand)]">Spec Trainly</h1>
          <nav className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:justify-end" aria-label="Sections spec">
            {SPEC_SECTIONS.map((section) => {
              const active =
                section.id === 'home'
                  ? pathname === '/admin/spec'
                  : pathname === section.href || pathname.startsWith(`${section.href}/`)
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={
                    active
                      ? 'rounded-full on-brand px-3 py-1.5 text-xs font-semibold'
                      : 'rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:opacity-90'
                  }
                >
                  {section.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--brand)] text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6">
            <p className="text-xs font-medium text-white/90">
              {dirtyCount > 0
                ? `${dirtyCount} zone${dirtyCount > 1 ? 's' : ''} modifiée${dirtyCount > 1 ? 's' : ''} — pas d’auto-save`
                : 'Aucune modification en attente — pas d’auto-save'}
            </p>
            <button
              type="button"
              onClick={saveAll}
              disabled={pending || (dirtyCount === 0 && saveStatus !== 'error')}
              className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-[var(--brand)] shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </header>
      <div
        className={
          pathname?.includes('/admin/spec/supabase')
            ? 'mx-auto max-w-[1600px] px-3 py-6 md:px-5 md:py-8'
            : 'mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10'
        }
      >
        {children}
      </div>
    </div>
  )
}

/** Call from editors when local content changes / is persisted. */
export function markSpecDirty(id: string) {
  window.dispatchEvent(new CustomEvent('spec-mark-dirty', { detail: id }))
}

export function markSpecClean(id: string) {
  window.dispatchEvent(new CustomEvent('spec-mark-clean', { detail: id }))
}
