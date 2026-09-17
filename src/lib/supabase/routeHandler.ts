import { createServerClient } from '@supabase/ssr'
import type { NextResponse } from 'next/server'

import type { Database } from './database.types'

export function createRouteHandlerClient(request: Request, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
      auth: {
        flowType: 'pkce',
      },
    }
  )
}
