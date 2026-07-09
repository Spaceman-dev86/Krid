'use client'

import Link from 'next/link'
import { memo, useEffect, useRef, useState } from 'react'

import { IconBack } from '../ui/icons'
import PersistenceStatusBar from './PersistenceStatusBar'
import ProgramEditorDeleteControl from './ProgramEditorDeleteControl'
import ProgramEditorFlushLink from './ui/ProgramEditorFlushLink'
import {
  useProgramEditorChromeOverflow,
  type ChromeActionId,
} from './useProgramEditorChromeOverflow'

const DELETE_FORM_ID = 'delete-program-form-v2-mobile'

type Props = {
  programId: string
  basePath: string
  backHref: string
  isAdmin: boolean
  isPublished: boolean
  copied: boolean
  onCopyLink: () => void
  onShareEmail: () => void
  onPublish: () => void
  onEditCover: () => void
}

function actionButtonClass(extra = '') {
  return [
    'inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 hover:opacity-90',
    extra,
  ].join(' ')
}

function ProgramEditorChromeMobileActionsInner({
  programId,
  basePath,
  backHref,
  isAdmin,
  isPublished,
  copied,
  onCopyLink,
  onShareEmail,
  onPublish,
  onEditCover,
}: Props) {
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const { barOrder, overflow, showHamburger } = useProgramEditorChromeOverflow(actionsRef, {
    isAdmin,
    isPublished,
    enabled: true,
  })

  useEffect(() => {
    if (!showHamburger && menuOpen) setMenuOpen(false)
  }, [menuOpen, showHamburger])

  useEffect(() => {
    if (!menuOpen) return
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
  }, [menuOpen])

  const renderAction = (id: ChromeActionId, inMenu: boolean) => {
    const closeMenu = () => setMenuOpen(false)

    if (id === 'persistence') {
      return (
        <div key={`${id}-${inMenu ? 'menu' : 'bar'}`} className={inMenu ? 'px-1' : 'min-w-0 shrink'}>
          <PersistenceStatusBar variant={inMenu ? 'menu' : 'inline'} />
        </div>
      )
    }

    if (id === 'commander') {
      return (
        <Link
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          href="/contact"
          className={
            inMenu
              ? 'flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-[#341c44] transition hover:bg-[#f3f3f3]'
              : actionButtonClass('px-4')
          }
          onClick={inMenu ? closeMenu : undefined}
        >
          Commander mon APP
        </Link>
      )
    }

    if (id === 'preview') {
      return (
        <ProgramEditorFlushLink
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          href={`${basePath}/${programId}/preview`}
          className={
            inMenu
              ? 'flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-[#341c44] transition hover:bg-[#f3f3f3]'
              : actionButtonClass('px-3 sm:px-4')
          }
          onNavigate={inMenu ? closeMenu : undefined}
        >
          Voir le rendu
        </ProgramEditorFlushLink>
      )
    }

    if (id === 'send') {
      return (
        <button
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          type="button"
          className={
            inMenu
              ? 'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#341c44] transition hover:bg-[#f3f3f3]'
              : actionButtonClass('px-4')
          }
          aria-label="Envoyer le programme"
          title="Envoyer le lien d’aperçu par email"
          onClick={() => {
            onShareEmail()
            if (inMenu) closeMenu()
          }}
        >
          Envoyer
        </button>
      )
    }

    if (id === 'publish') {
      return (
        <button
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          type="button"
          className={
            inMenu
              ? 'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#341c44] transition hover:bg-[#f3f3f3]'
              : actionButtonClass('px-4')
          }
          onClick={() => {
            onPublish()
            if (inMenu) closeMenu()
          }}
        >
          Publier
        </button>
      )
    }

    if (id === 'editCover') {
      return (
        <button
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          type="button"
          className={
            inMenu
              ? 'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#341c44] transition hover:bg-[#f3f3f3]'
              : actionButtonClass('px-4')
          }
          onClick={() => {
            onEditCover()
            if (inMenu) closeMenu()
          }}
        >
          Édite photo
        </button>
      )
    }

    if (id === 'delete') {
      return (
        <ProgramEditorDeleteControl
          key={`${id}-${inMenu ? 'menu' : 'bar'}`}
          programId={programId}
          formId={DELETE_FORM_ID}
          variant={inMenu ? 'menu' : 'icon'}
          onMenuAction={inMenu ? closeMenu : undefined}
        />
      )
    }

    return null
  }

  return (
    <div ref={actionsRef} className="relative flex min-w-0 flex-1 items-center justify-end gap-2">
      {barOrder.map((id) => renderAction(id, false))}

      <Link
        href={backHref}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900"
        aria-label="Retour"
        title="Retour"
      >
        <IconBack className="h-5 w-5" />
      </Link>

      {showHamburger ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={[
              'inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition',
              menuOpen
                ? 'bg-[var(--brand)] text-white shadow-sm ring-2 ring-[var(--brand)]/30'
                : 'bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]',
            ].join(' ')}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            title={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            <span className="text-base leading-none" aria-hidden>
              {menuOpen ? '✕' : '☰'}
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl shadow-black/15 ring-1 ring-black/5">
              <div className="border-b border-black/6 bg-[#fafafa] px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-black/45">Menu</div>
                <div className="mt-0.5 text-sm font-extrabold text-[var(--brand)]">Program Builder</div>
              </div>

              <div className="p-2">
                <ul className="grid gap-0.5">
                  {overflow.map((id) => (
                    <li key={id}>{renderAction(id, true)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default memo(ProgramEditorChromeMobileActionsInner)
