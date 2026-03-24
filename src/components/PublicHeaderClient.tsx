'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '../lib/supabase/client'

export default function PublicHeaderClient() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const supabase = useMemo(() => createClient(), [])
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

      const r = profile?.role
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

  async function onLoginClick() {
    if (pending) return
    setPending(true)
    try {
      const { data } = await supabase.auth.getUser()
      const user = data.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const role = profile?.role
      if (role === 'admin') {
        router.push('/admin')
        return
      }

      router.push('/dashboard')
    } finally {
      setPending(false)
    }
  }

  async function onSignOut() {
    if (pending) return
    setPending(true)
    try {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-6 py-3 sm:px-8 lg:px-12" ref={menuRef}>
        <Link href="/" className="text-base font-extrabold tracking-tight text-[#341c44]">
          Trainly
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/mon-app" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
            Mon app
          </Link>
          <Link href="/mon-site" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
            Mon site
          </Link>
          <Link href="/programs" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
            Programmes
          </Link>
          <Link href="/blog" className="rounded-full px-3 py-2 text-sm font-semibold text-black/80 hover:bg-[#f5f5f5]">
            Blog
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
        </nav>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            title={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {open ? '✕' : '☰'}
          </button>

          <button
            type="button"
            onClick={role ? onSignOut : onLoginClick}
            title={role ? 'Déconnexion' : 'Connexion'}
            aria-label={role ? 'Déconnexion' : 'Connexion'}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5] md:inline-flex"
            disabled={pending}
          >
            ⎋
          </button>

          {open ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
              <div className="grid gap-2 p-2">
                <Link
                  href="/mon-app"
                  className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
                  onClick={() => setOpen(false)}
                >
                  Mon app
                </Link>
                <Link
                  href="/mon-site"
                  className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
                  onClick={() => setOpen(false)}
                >
                  Mon site
                </Link>
                <Link
                  href="/programs"
                  className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
                  onClick={() => setOpen(false)}
                >
                  Programmes
                </Link>
                <Link
                  href="/blog"
                  className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm font-semibold text-[#341c44]"
                  onClick={() => setOpen(false)}
                >
                  Blog
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

                <button
                  type="button"
                  onClick={role ? onSignOut : onLoginClick}
                  disabled={pending}
                  className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#341c44] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                >
                  {role ? 'Déconnexion' : 'Connexion'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
