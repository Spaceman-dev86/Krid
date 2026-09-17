import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import { RejoindreClient } from './RejoindreClient'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ presta?: string; mode?: string; next?: string }>
    | { presta?: string; mode?: string; next?: string }
}

export default async function RejoindrePage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug, app_name, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) notFound()

  const brand = branding.primary_color?.trim() || '#341c44'
  const appName = branding.app_name?.trim() || 'Trainly'
  const prestaId = q.presta?.trim() || null
  const nextRaw = q.next?.trim() || null
  const nextPath =
    nextRaw && nextRaw.startsWith(`/c/${slug}/`) && !nextRaw.startsWith('//') ? nextRaw : null

  return (
    <main className="min-h-screen bg-[#f6f4f8] px-4 py-10 text-[#1a1220]">
      <Suspense fallback={<p className="text-center text-sm text-black/50">Chargement…</p>}>
        <RejoindreClient
          slug={slug}
          coachId={branding.coach_id}
          prestaId={prestaId}
          nextPath={nextPath}
          brand={brand}
          appName={appName}
        />
      </Suspense>
    </main>
  )
}
