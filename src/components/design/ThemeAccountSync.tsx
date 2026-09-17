'use client'

import { useEffect } from 'react'

import { createClient } from '../../lib/supabase/client'
import {
  bindThemeUser,
  clearThemeUser,
  readGuestTheme,
  applyTheme,
} from '../../lib/design/theme'

/** Keeps theme preference scoped to the signed-in account. */
export function ThemeAccountSync() {
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    function sync(userId: string | undefined) {
      if (cancelled) return
      if (userId) {
        bindThemeUser(userId)
        return
      }
      clearThemeUser()
      applyTheme(readGuestTheme())
    }

    void supabase.auth.getSession().then(({ data }) => {
      sync(data.session?.user?.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sync(session?.user?.id)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return null
}
