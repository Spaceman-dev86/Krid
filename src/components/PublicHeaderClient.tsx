'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '../lib/supabase/client'

const tryFreeButtonClass =
  'inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-5 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] transition hover:opacity-95 disabled:opacity-60'

export default function PublicHeaderClient() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const headerVariant = process.env.NEXT_PUBLIC_HEADER_VARIANT
  const [pending, setPending] = useState(false)
  const [role, setRole] = useState<'admin' | 'coach' | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!mounted) return

      if (!user) {
        setRole(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const r = (profile as unknown as { role?: string | null } | null)?.role
      setRole(r === 'admin' || r === 'coach' ? r : null)
    }

    loadRole()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadRole()
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

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
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }

    if (!open) return

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  async function onSignOut() {
    if (pending) return
    setPending(true)
    try {
      await supabase.auth.signOut()
      router.replace('/')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

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

      {role === 'coach' ? (
        <Link href="/dashboard" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
          Dashboard
        </Link>
      ) : null}

      {role === 'admin' ? (
        <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
          Admin
        </Link>
      ) : null}
    </>
  )

  const mobileMenuLinks = (
    <>
      <Link
        href="/mon-app"
        className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
        onClick={() => setOpen(false)}
      >
        Mon app
      </Link>
      <Link
        href="/programs"
        className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
        onClick={() => setOpen(false)}
      >
        Programmes
      </Link>
      <Link
        href="/simulation"
        className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
        onClick={() => setOpen(false)}
      >
        Simulation
      </Link>
      <Link
        href="/contact"
        className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
        onClick={() => setOpen(false)}
      >
        Contact
      </Link>

      {role === 'coach' ? (
        <Link
          href="/dashboard"
          className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
          onClick={() => setOpen(false)}
        >
          Dashboard
        </Link>
      ) : null}

      {role === 'admin' ? (
        <Link
          href="/admin"
          className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
          onClick={() => setOpen(false)}
        >
          Admin
        </Link>
      ) : null}
    </>
  )

  const urlVariant = (searchParams?.get('header') ?? '').trim().toLowerCase()
  const forceClassic = urlVariant === 'classic' || headerVariant === 'classic'
  const isPromoGenVariant = !forceClassic

  const isNutritionOpaqueHeaderPage = (() => {
    const p = pathname.split('?')[0] ?? ''
    return (
      p === '/dashboard/nutrition' ||
      p.startsWith('/dashboard/nutrition/recipes') ||
      p === '/dashboard/exercises' ||
      p.startsWith('/dashboard/exercises/') ||
      p === '/dashboard/calendar'
    )
  })()

  return (
    <header
      className={[
        // Keep above page-level sticky headers so nav shadow isn't clipped.
        'fixed left-0 right-0 top-0 z-[60] h-16',
        isNutritionOpaqueHeaderPage ? 'bg-[#E8E8E8]' : 'bg-transparent',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto flex h-full w-full max-w-none items-center justify-between gap-3 px-6 py-3 sm:px-8 lg:px-12',
          isPromoGenVariant ? 'md:justify-between' : '',
        ].join(' ')}
        ref={menuRef}
      >
        <Link href="/" className="text-base font-extrabold tracking-tight text-[#341c44]">
          Trainly
        </Link>

        {isPromoGenVariant ? (
          <nav className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-lg ring-1 ring-black/10">
              {navLinks}
            </div>
          </nav>
        ) : (
          <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>
        )}

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5] md:hidden"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            title={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {open ? '✕' : '☰'}
          </button>

          {role ? (
            <button
              type="button"
              onClick={onSignOut}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="hidden h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95 disabled:opacity-60 md:inline-flex"
              disabled={pending}
            >
              Déconnexion
            </button>
          ) : (
            <Link href="/login" className={`${tryFreeButtonClass} hidden md:inline-flex`}>
              Essaye gratuit
            </Link>
          )}

          {open ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
              <div className="grid gap-2 p-2">
                {mobileMenuLinks}

                {role ? (
                  <button
                    type="button"
                    onClick={onSignOut}
                    disabled={pending}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95 disabled:opacity-60"
                  >
                    Déconnexion
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className={`${tryFreeButtonClass} mt-1 w-full px-5 py-3`}
                    onClick={() => setOpen(false)}
                  >
                    Essaye gratuit
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
