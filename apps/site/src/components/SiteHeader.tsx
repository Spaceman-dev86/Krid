'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { appUrl } from '@/lib/urls'

const tryFreeButtonClass =
  'inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-5 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] transition hover:opacity-95'

export default function SiteHeader() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      const el = menuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    if (!open) return
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const navLinks = (
    <>
      <Link href="/mon-app" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
        Mon app
      </Link>
      <Link href="/programs" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
        Programmes
      </Link>
      <Link href="/simulation" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
        Simulation
      </Link>
      <Link href="/contact" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
        Contact
      </Link>
    </>
  )

  return (
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-black/5 bg-white/90 backdrop-blur">
      <div
        ref={menuRef}
        className="mx-auto flex h-16 w-full max-w-none items-center justify-between gap-3 px-6 py-3 sm:px-8 lg:px-12"
      >
        <Link href="/" className="text-base font-extrabold tracking-tight text-[#341c44]">
          Trainly
        </Link>

        <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>

        <div className="flex items-center gap-2">
          <a href={appUrl('/login')} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5] sm:inline-flex">
            Connexion
          </a>
          <a href={appUrl('/login?mode=signup')} className={tryFreeButtonClass}>
            Essai gratuit
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-lg">{open ? '×' : '☰'}</span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-black/5 bg-white px-6 py-3 md:hidden">
          <nav className="flex flex-col gap-1">{navLinks}</nav>
          <a href={appUrl('/login')} className="mt-2 block rounded-full px-3 py-2 text-sm font-semibold text-black/80">
            Connexion
          </a>
        </div>
      ) : null}
    </header>
  )
}
