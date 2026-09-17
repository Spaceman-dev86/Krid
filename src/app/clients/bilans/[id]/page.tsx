import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { ClientsSubnav } from '../../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import {
  getInstance,
  previousInstanceForClient,
  statusLabel,
} from '../../../../lib/bilans/bilans'
import { clientDisplayName, chatDb } from '../../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../lib/supabase/serviceRole'
import { markInstanceReadAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function BilanInstancePage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const instance = await getInstance(supabase, id)
  if (!instance || instance.coach_id !== user.id) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Bilan introuvable'))
  }

  // Marque lu si soumis et pas encore lu
  if (instance.status === 'submitted' && !instance.coach_read_at) {
    const db = chatDb(supabase)
    await db
      .from('bilan_instances')
      .update({ coach_read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', user.id)
  }

  // Lock lazy
  if (
    (instance.status === 'waiting' || instance.status === 'in_progress') &&
    new Date(instance.due_at).getTime() < Date.now()
  ) {
    const db = chatDb(supabase)
    await db
      .from('bilan_instances')
      .update({ status: 'no_response', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', user.id)
      .in('status', ['waiting', 'in_progress'])
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('id', instance.client_id)
    .maybeSingle()

  const prevId = await previousInstanceForClient(
    supabase,
    instance.client_id,
    instance.created_at,
    instance.id
  )

  const schema = instance.schema_snapshot
  const payload = instance.payload

  const photoUrls = await Promise.all(
    (payload.photos ?? []).map(async (p) => ({
      ...p,
      url: await createSignedDownloadUrlForBilan(p.path),
    }))
  )

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title={instance.title} savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/clients/bilans" className="text-sm font-semibold text-[color:var(--brand)]">
              ← Bilans
            </Link>
            <PageTitle className="mt-2 text-2xl">{instance.title}</PageTitle>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {client
                ? clientDisplayName({
                    first_name: client.first_name,
                    last_name: client.last_name,
                    email: client.email,
                  })
                : 'Client'}{' '}
              · {statusLabel(instance.status)} · deadline{' '}
              {new Date(instance.due_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {prevId ? (
              <Link
                href={`/clients/bilans/${prevId}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[color:var(--brand)]"
              >
                ← Bilan précédent
              </Link>
            ) : null}
            <ClientsSubnav />
          </div>
        </div>

        {instance.status === 'submitted' && !instance.coach_read_at ? (
          <form action={markInstanceReadAction}>
            <input type="hidden" name="instance_id" value={instance.id} />
            <button type="submit" className="text-xs font-semibold text-[color:var(--brand)] underline">
              Marquer comme lu
            </button>
          </form>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">Résumé</h2>
          {schema.questions.length ? (
            <ul className="mt-3 grid gap-3">
              {schema.questions.map((q) => (
                <li key={q.id}>
                  <p className="text-xs font-bold text-[color:var(--muted)]">{q.label}</p>
                  <p className="mt-0.5 text-sm text-[color:var(--fg)]">
                    {payload.questions?.[q.id]?.trim() || '—'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--muted)]">Pas de questions.</p>
          )}
        </section>

        {schema.measurements.length ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">Mensurations</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {schema.measurements.map((m) => (
                <li key={m.id} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="ml-2 text-[color:var(--muted)]">
                    {payload.measurements?.[m.id]?.trim() || '—'} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {schema.photos ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">Photos</h2>
            {!photoUrls.length ? (
              <p className="mt-2 text-sm text-[color:var(--muted)]">Aucune photo.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {photoUrls.map((p, i) => (
                  <li key={p.path + i} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={p.label || 'Photo'} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-xs text-[color:var(--muted)]">
                        Indisponible
                      </div>
                    )}
                    {p.label ? <p className="px-2 py-1 text-xs font-semibold">{p.label}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </CoachAppShell>
  )
}

async function createSignedDownloadUrlForBilan(storagePath: string): Promise<string | null> {
  const admin = createServiceRoleClient()
  if (!admin) return null
  const { data, error } = await admin.storage.from('bilans').createSignedUrl(storagePath, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}
