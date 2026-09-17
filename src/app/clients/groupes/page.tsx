import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { ClientsSubnav } from '../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { createManualGroupAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function ClientGroupsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; deleted?: string }>
    | { error?: string; deleted?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, name, type, chat_enabled, drive_enabled, created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const groupIds = (groups ?? []).map((g) => g.id)
  const memberCounts = new Map<string, number>()
  if (groupIds.length) {
    const { data: members } = await supabase
      .from('client_group_members')
      .select('group_id')
      .in('group_id', groupIds)
    for (const m of members ?? []) {
      memberCounts.set(m.group_id, (memberCounts.get(m.group_id) ?? 0) + 1)
    }
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Groupes" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Clients</PageTitle>
            <Muted className="mt-1">Groupes manuels · chat / Drive (pas d’assign programme)</Muted>
          </div>
          <ClientsSubnav />
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error === 'name' ? 'Nom requis.' : params.error}
          </div>
        ) : null}
        {params.deleted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Groupe supprimé.
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Ajouter un groupe manuel
          </h2>
          <form action={createManualGroupAction} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Nom *</span>
              <input
                name="name"
                required
                placeholder="Groupe matin"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 font-semibold">
                <input type="checkbox" name="chat_enabled" className="rounded" />
                Chat de groupe
              </label>
              <label className="inline-flex items-center gap-2 font-semibold">
                <input type="checkbox" name="drive_enabled" className="rounded" />
                Partage Drive
              </label>
            </div>
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold w-fit">Créer</Button>
          </form>
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            Groupes auto (par prestation) : après la tranche prestations / grants.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Liste</h2>
          </div>
          {!groups?.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucun groupe.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/clients/groupes/${g.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                  >
                    <div>
                      <p className="font-semibold text-[color:var(--brand)]">{g.name}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {g.type === 'auto' ? 'Auto' : 'Manuel'}
                        {g.chat_enabled ? ' · chat' : ''}
                        {g.drive_enabled ? ' · drive' : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                      {memberCounts.get(g.id) ?? 0} membre{(memberCounts.get(g.id) ?? 0) > 1 ? 's' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
