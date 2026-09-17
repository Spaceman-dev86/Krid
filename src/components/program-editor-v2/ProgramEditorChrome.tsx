'use client'

import Link from 'next/link'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { IconBack } from '../ui/icons'
import { useProgramMeta } from '../../store/program-editor'
import { EDITOR_BUILDER_HEADER_CLASS } from './ui/editorSectionTitle'
import { EDITOR_CHROME_MOBILE_MAX_PX } from './useProgramEditorChromeOverflow'
import PersistenceStatusBar from './PersistenceStatusBar'
import ProgramEditorDeleteControl from './ProgramEditorDeleteControl'
import ProgramEditorChromeMobileActions from './ProgramEditorChromeMobileActions'
import ProgramEditCoverDialog from './ProgramEditCoverDialog'
import ProgramPublishDialog from './ProgramPublishDialog'
import ProgramEditorFlushLink from './ui/ProgramEditorFlushLink'
import ProgramShareEmailDialog from './ProgramShareEmailDialog'

type Props = {
  programId: string
  basePath?: string
  backHref?: string
}

function useMobileChromeHeader() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${EDITOR_CHROME_MOBILE_MAX_PX}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${EDITOR_CHROME_MOBILE_MAX_PX}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function ProgramEditorChromeInner({
  programId,
  basePath = '/dashboard/programs',
  backHref = '/dashboard',
}: Props) {
  const program = useProgramMeta()
  const title = String(program?.title ?? '').trim() || 'Programme'
  const isMobileHeader = useMobileChromeHeader()
  const [menuOpen, setMenuOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [editCoverOpen, setEditCoverOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isAdmin = basePath.startsWith('/admin')
  const isPublished = Boolean(program?.isPublished)

  const publicProgramHref = `/programme/${programId}`

  const copyPublicLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + publicProgramHref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [publicProgramHref])

  useEffect(() => {
    if (!menuOpen || isMobileHeader) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      const el = menuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isMobileHeader, menuOpen])

  return (
    <>
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-4 py-2 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur min-[868px]:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 shrink">
          <div className={`truncate ${EDITOR_BUILDER_HEADER_CLASS}`}>Program Builder</div>
        </div>

        {isMobileHeader ? (
          <ProgramEditorChromeMobileActions
            programId={programId}
            basePath={basePath}
            backHref={backHref}
            isAdmin={isAdmin}
            isPublished={isPublished}
            copied={copied}
            onCopyLink={copyPublicLink}
            onShareEmail={() => setShareOpen(true)}
            onPublish={() => setPublishOpen(true)}
            onEditCover={() => setEditCoverOpen(true)}
          />
        ) : (
          <div className="relative flex min-w-0 flex-wrap items-center justify-end gap-2" ref={menuRef}>
            <div className="hidden min-w-0 sm:block">
              <PersistenceStatusBar />
            </div>
            <ProgramEditorFlushLink
              href={`${basePath}/${programId}/preview`}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-3 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 sm:px-4"
            >
              <span className="max-[480px]:sr-only">Voir le rendu</span>
              <span className="hidden max-[480px]:inline" aria-hidden>
                Aperçu
              </span>
            </ProgramEditorFlushLink>

            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="hidden h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 hover:opacity-90 min-[624px]:inline-flex"
                  aria-label="Envoyer le programme"
                  title="Envoyer le lien d’aperçu par email"
                >
                  Envoyer
                </button>

                {!isPublished ? (
                  <button
                    type="button"
                    onClick={() => setPublishOpen(true)}
                    className="hidden h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 hover:opacity-90 min-[624px]:inline-flex"
                  >
                    Publier
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditCoverOpen(true)}
                    className="hidden h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 hover:opacity-90 min-[624px]:inline-flex"
                  >
                    Édite photo
                  </button>
                )}
              </>
            ) : null}

            {!isAdmin ? (
              <Link
                href="/contact"
                className="hidden h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 hover:opacity-90 min-[624px]:inline-flex"
              >
                Commander mon APP
              </Link>
            ) : null}

            <div className="hidden min-[624px]:block">
              <ProgramEditorDeleteControl programId={programId} />
            </div>

            <Link
              href={backHref}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900"
              aria-label="Retour"
              title="Retour"
            >
              <IconBack className="h-5 w-5" />
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-[color:var(--brand)] ring-1 ring-[var(--border)] hover:bg-[color-mix(in_srgb,var(--brand)_5%,var(--surface))]"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              title={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {menuOpen ? '✕' : '☰'}
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)]">
                <div className="grid gap-2 p-2">
                  <div className="px-3 py-2 max-[623px]:block min-[624px]:hidden">
                    <PersistenceStatusBar />
                  </div>
                  {!isAdmin ? (
                    <Link
                      href="/contact"
                      className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)] max-[623px]:block min-[624px]:hidden"
                      onClick={() => setMenuOpen(false)}
                    >
                      Commander mon APP
                    </Link>
                  ) : null}
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-left text-sm font-semibold text-[color:var(--brand)] max-[623px]:block min-[624px]:hidden"
                        onClick={() => {
                          setShareOpen(true)
                          setMenuOpen(false)
                        }}
                      >
                        Envoyer le programme
                      </button>
                      {!isPublished ? (
                        <button
                          type="button"
                          className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-left text-sm font-semibold text-[color:var(--brand)] max-[623px]:block min-[624px]:hidden"
                          onClick={() => {
                            setPublishOpen(true)
                            setMenuOpen(false)
                          }}
                        >
                          Publier
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-left text-sm font-semibold text-[color:var(--brand)] max-[623px]:block min-[624px]:hidden"
                          onClick={() => {
                            setEditCoverOpen(true)
                            setMenuOpen(false)
                          }}
                        >
                          Édite photo
                        </button>
                      )}
                    </>
                  ) : null}
                  <div className="max-[623px]:block min-[624px]:hidden">
                    <ProgramEditorDeleteControl programId={programId} />
                  </div>
                  <div className="my-1 border-t border-[var(--border)]" aria-hidden />
                  <Link
                    href="/"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Acceuil
                  </Link>
                  <Link
                    href="/mon-app"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mon app
                  </Link>
                  <Link
                    href="/mon-site"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mon site
                  </Link>
                  <Link
                    href="/programs"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Programmes
                  </Link>
                  <Link
                    href="/simulation"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Simulation
                  </Link>
                  <Link
                    href="/contact"
                    className="rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,var(--surface))] px-4 py-3 text-sm font-semibold text-[color:var(--brand)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Contact
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {publishOpen ? (
        <ProgramPublishDialog
          open
          programId={programId}
          programTitle={title}
          basePath={basePath}
          onClose={() => setPublishOpen(false)}
        />
      ) : null}

      {editCoverOpen ? (
        <ProgramEditCoverDialog
          open
          programId={programId}
          programTitle={title}
          currentImageUrl={program?.imageUrl ?? null}
          onClose={() => setEditCoverOpen(false)}
        />
      ) : null}
      </header>

      {isAdmin ? (
        <ProgramShareEmailDialog
          open={shareOpen}
          programId={programId}
          programTitle={title}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  )
}

export default memo(ProgramEditorChromeInner)
