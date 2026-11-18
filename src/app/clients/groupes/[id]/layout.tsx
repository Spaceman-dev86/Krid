import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { ClientsSubnav } from '../../../../components/coach/ClientsSubnav'
import { CoachQueryFlash } from '../../../../components/coach/CoachQueryFlash'
import { GroupFicheNav } from '../../../../components/coach/GroupFicheNav'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { createClient } from '../../../../lib/supabase/server'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }> | { id: string }
}

export default async function GroupFicheLayout({ children, params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const [groupRes, memberCountRes] = await Promise.all([
    supabase
      .from('client_groups')
      .select('id, name, description, type, prestation_id')
      .eq('id', id)
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('client_group_members')
      .select('client_id', { count: 'exact', head: true })
      .eq('group_id', id),
  ])

  const group = groupRes.data
  if (!group) notFound()
  if (group.type !== 'manual' && group.type !== 'linked') notFound()

  const isLinked = group.type === 'linked'
  const memberCount = memberCountRes.count ?? 0

  let prestaLabel: string | null = null
  if (isLinked && group.prestation_id) {
    const { data: presta } = await supabase
      .from('prestations')
      .select('name')
      .eq('id', group.prestation_id)
      .maybeSingle()
    prestaLabel = presta?.name ?? null
  }

  const metaParts = [
    isLinked ? 'Groupe lié' : 'Groupe libre',
    isLinked && prestaLabel ? prestaLabel : null,
    `${memberCount} membre${memberCount > 1 ? 's' : ''}`,
  ].filter(Boolean)

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <PageTitle className="text-2xl">{group.name}</PageTitle>
          <Link
            href="/clients/groupes"
            className="mt-1.5 inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
          >
            ← Groupes
          </Link>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{metaParts.join(' · ')}</p>
          {group.description?.trim() ? (
            <p className="mt-1 max-w-xl text-sm text-[color:var(--fg)] whitespace-pre-wrap">
              {group.description.trim()}
            </p>
            ) : null}
          </div>
          <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
            <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
              <ClientsSubnav />
            </div>
          </div>
        </header>

      <GroupFicheNav groupId={group.id} />

      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            created: { tone: 'success', message: 'Groupe créé' },
            saved: { tone: 'success', message: 'Enregistré' },
            sent: { tone: 'success', message: 'Bilan envoyé' },
            pushed: { tone: 'success', message: 'Contenu envoyé aux membres' },
          }}
        />
      </Suspense>

      {children}
    </div>
  )
}
