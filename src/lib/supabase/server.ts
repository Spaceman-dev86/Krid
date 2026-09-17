import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Server Components cannot set cookies — middleware refreshes the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored in RSC; session refresh happens in middleware / route handlers.
          }
        },
      },
      auth: {
        flowType: 'pkce',
      },
    }
  )
}
