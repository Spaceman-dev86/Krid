import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { ClientFicheFlashFromUrl } from '../../../components/coach/ClientFicheFlashFromUrl'
import { ClientFicheNav } from '../../../components/coach/ClientFicheNav'
import { ClientsSubnav } from '../../../components/coach/ClientsSubnav'
import { CoachRdvEntryButton } from '../../../components/coach/calendar/CoachRdvEntryButton'
import { ClientMessageDialog } from '@/src/components/chat/ClientMessageDialog'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { clientDisplayName } from '../../../lib/chat/chat'
import { createClient } from '../../../lib/supabase/server'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }> | { id: string }
}

export default async function ClientFicheLayout({ children, params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) notFound()

  const title = clientDisplayName({
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
  })

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <PageTitle className="text-2xl">{title}</PageTitle>
          <Link
            href="/clients"
            className="mt-1.5 inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
          >
            ← Clients
          </Link>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Fiche client</p>
        </div>
        <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
          <ClientMessageDialog clientId={client.id} clientLabel={title} />
          <CoachRdvEntryButton
            clients={[{ id: client.id, label: title }]}
            defaultAudience={`client:${client.id}`}
            returnTo={`/clients/${client.id}`}
            nameMap={new Map([[client.id, title]])}
          />
          <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
            <ClientsSubnav />
          </div>
        </div>
      </header>

      <ClientFicheNav clientId={client.id} />

      <Suspense fallback={null}>
        <ClientFicheFlashFromUrl />
      </Suspense>

      {children}
    </div>
  )
}
