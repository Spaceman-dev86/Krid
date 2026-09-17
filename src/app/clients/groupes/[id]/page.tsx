import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button, PageTitle } from '@/src/components/ui'
import { ClientsSubnav } from '../../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../../lib/supabase/server'
import {
  addGroupMemberAction,
  deleteGroupAction,
  removeGroupMemberAction,
  updateGroupAction,
} from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; created?: string }>
    | { error?: string; saved?: string; created?: string }
}

function clientLabel(c: {
  first_name: string | null
  last_name: string | null
  email: string
}) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

export default async function ClientGroupDetailPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: group } = await supabase
    .from('client_groups')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!group) notFound()

  const isManual = group.type === 'manual'

  const { data: memberRows } = await supabase
    .from('client_group_members')
    .select('client_id')
    .eq('group_id', id)

  const memberIds = (memberRows ?? []).map((m) => m.client_id)

  const { data: members } = memberIds.length
    ? await supabase
        .from('clients')
        .select('id, email, first_name, last_name, status')
        .in('id', memberIds)
        .is('deleted_at', null)
    : { data: [] as { id: string; email: string; first_name: string | null; last_name: string | null; status: string }[] }

  const { data: allClients } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const memberSet = new Set(memberIds)
  const candidates = (allClients ?? []).filter((c) => !memberSet.has(c.id))

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Groupe" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/clients/groupes" className="text-xs font-semibold text-[color-mix(in_srgb,var(--brand)_70%,transparent)] hover:underline">
              ← Groupes
            </Link>
            <PageTitle className="mt-2 text-2xl">{group.name}</PageTitle>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {isManual ? 'Manuel' : 'Auto'} · pas d’assign programme via groupe
            </p>
          </div>
          <ClientsSubnav />
        </div>

        {q.created || q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {q.created ? 'Groupe créé.' : 'Enregistré.'}
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {q.error === 'name'
              ? 'Nom requis.'
              : q.error === 'readonly'
                ? 'Groupe auto : lecture seule (membres gérés par prestation).'
                : q.error}
          </div>
        ) : null}

        {isManual ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
            <form action={updateGroupAction} className="grid gap-3">
              <input type="hidden" name="id" value={group.id} />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Nom</span>
                <input
                  name="name"
                  defaultValue={group.name}
                  required
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                />
              </label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    name="chat_enabled"
                    defaultChecked={group.chat_enabled}
                    className="rounded"
                  />
                  Chat de groupe
                </label>
                <label className="inline-flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    name="drive_enabled"
                    defaultChecked={group.drive_enabled}
                    className="rounded"
                  />
                  Partage Drive
                </label>
              </div>
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold w-fit">Enregistrer</Button>
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Membres</h2>
          {!members?.length ? (
            <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun membre.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-[color:var(--brand)]">{clientLabel(m)}</p>
                    <p className="text-xs text-[color:var(--muted)]">{m.email}</p>
                  </div>
                  {isManual ? (
                    <form action={removeGroupMemberAction}>
                      <input type="hidden" name="group_id" value={group.id} />
                      <input type="hidden" name="client_id" value={m.id} />
                      <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">
                        Retirer
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isManual ? (
            <form action={addGroupMemberAction} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="group_id" value={group.id} />
              <label className="grid min-w-[200px] flex-1 gap-1 text-sm">
                <span className="font-semibold">Ajouter</span>
                <select name="client_id" required className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <option value="">Choisir…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {clientLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={!candidates.length} className="!rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40">Ajouter</Button>
            </form>
          ) : null}
        </section>

        {isManual ? (
          <form action={deleteGroupAction}>
            <input type="hidden" name="id" value={group.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Supprimer le groupe
            </button>
          </form>
        ) : null}
      </div>
    </CoachAppShell>
  )
}
