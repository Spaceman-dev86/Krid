'use client'

import { useState } from 'react'

import { createClient } from '../../lib/supabase/client'

export function ClientPortalSignOutButton({
  slug,
  label = 'Déconnexion',
}: {
  slug: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)

  async function onSignOut() {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      // continue — server signout fallback via navigation
    }
    window.location.href = `/auth/signout?next=${encodeURIComponent(`/login/client?redirectTo=/c/${slug}/home`)}`
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onSignOut}
      className="text-sm font-semibold text-red-600 underline disabled:opacity-60"
    >
      {loading ? 'Déconnexion…' : label}
    </button>
  )
}
