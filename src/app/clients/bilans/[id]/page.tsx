import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BilanRequestedSchema } from '@/src/components/bilans/BilanRequestedSchema'
import { DeleteBilanButton } from '@/src/components/bilans/DeleteBilanButton'
import { RelanceBilanButton } from '@/src/components/bilans/RelanceBilanButton'
import { ClientsSubnav } from '../../../../components/coach/ClientsSubnav'
import { IconCaret, PageTitle } from '@/src/components/ui'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import {
  getInstance,
  listInstancesForBatch,
  listSiblingInstancesForClient,
  siblingNav,
  statusLabel,
} from '../../../../lib/bilans/bilans'
import {
  canDeleteBilan,
  canRelaunchBilan,
  clientBilanPath,
} from '../../../../lib/bilans/relance'
import { clientDisplayName, chatDb } from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../lib/supabase/serviceRole'
import { appUrl } from '../../../../lib/urls'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ from?: string }> | { from?: string }
}

function navChipClass(disabled?: boolean) {
  return `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] ${
    disabled ? 'opacity-35' : 'hover:ring-1 hover:ring-[var(--border)]'
  }`
}

/**
 * Deux flux (query `from`) :
 * - défaut / sans from = flux Liste → fiche client → détail **avec réponses**
 * - `?from=hub` = flux navbar Bilans → statut / demandé (pas les réponses)
 */
export default async function BilanInstancePage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const fromHub = q.from === 'hub'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  let instance = await getInstance(supabase, id)
  if (!instance || instance.coach_id !== user.id) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Bilan introuvable'))
  }

  if (instance.status === 'submitted' && !instance.coach_read_at) {
    const db = chatDb(supabase)
    const now = new Date().toISOString()
    await db
      .from('bilan_instances')
      .update({ coach_read_at: now })
      .eq('id', id)
      .eq('coach_id', user.id)
    await db
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .eq('type', 'bilan_submitted')
      .is('read_at', null)
      .contains('payload', { instance_id: id })
    instance = { ...instance, coach_read_at: now }
  }

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
    instance = { ...instance, status: 'no_response' }
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('id', instance.client_id)
    .maybeSingle()

  const clientLabel = client
    ? clientDisplayName({
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
      })
    : 'Client'

  const siblings = fromHub
    ? []
    : await listSiblingInstancesForClient(supabase, user.id, instance.client_id)
  const { prevId, nextId } = siblingNav(siblings, instance.id)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()
  const bilanUrl = branding?.slug
    ? appUrl(clientBilanPath(branding.slug, instance.id))
    : ''

  let groupLabel: string | null = null
  let batchPeers: Awaited<ReturnType<typeof listInstancesForBatch>> = []
  if (instance.batch_id && instance.source_group_id) {
    const { data: g } = await supabase
      .from('client_groups')
      .select('name')
      .eq('id', instance.source_group_id)
      .maybeSingle()
    groupLabel = g?.name ?? 'Groupe'
    try {
      batchPeers = (await listInstancesForBatch(supabase, user.id, instance.batch_id)).filter(
        (p) => p.id !== instance.id
      )
    } catch {
      batchPeers = []
    }
  }

  const peerClientIds = [...new Set(batchPeers.map((p) => p.client_id))]
  const { data: peerClients } =
    peerClientIds.length > 0
      ? await supabase
          .from('clients')
          .select('id, first_name, last_name, email')
          .in('id', peerClientIds)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }> }

  const peerName = new Map(
    (peerClients ?? []).map((c) => [
      c.id,
      clientDisplayName({ first_name: c.first_name, last_name: c.last_name, email: c.email }),
    ])
  )

  const schema = instance.schema_snapshot
  const payload = instance.payload
  const relaunchable = canRelaunchBilan(instance.status)
  const deletable = canDeleteBilan(instance.status)
  const isSubmitted = instance.status === 'submitted'

  const dueMs = new Date(instance.due_at).getTime() - Date.now()
  const daysLeft = Math.ceil(dueMs / (24 * 60 * 60 * 1000))

  const backHref = fromHub ? '/clients/bilans' : `/clients/${instance.client_id}/bilan`
  const returnAfterDelete = backHref

  const photoUrls =
    !fromHub && isSubmitted
      ? await Promise.all(
          (payload.photos ?? []).map(async (p) => ({
            ...p,
            url: await createSignedDownloadUrlForBilan(p.path),
          }))
        )
      : []

  return (
    <>
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {!fromHub ? (
                prevId ? (
                  <Link
                    href={`/clients/bilans/${prevId}`}
                    className={navChipClass()}
                    title="Bilan plus récent"
                    aria-label="Bilan plus récent"
                  >
                    <IconCaret dir="left" className="text-[color:var(--fg)]" />
                  </Link>
                ) : (
                  <span className={navChipClass(true)} aria-hidden>
                    <IconCaret dir="left" />
                  </span>
                )
              ) : null}
              <PageTitle className="min-w-0 flex-1 truncate text-2xl">{instance.title}</PageTitle>
              {!fromHub ? (
                nextId ? (
                  <Link
                    href={`/clients/bilans/${nextId}`}
                    className={navChipClass()}
                    title="Bilan plus ancien"
                    aria-label="Bilan plus ancien"
                  >
                    <IconCaret dir="right" className="text-[color:var(--fg)]" />
                  </Link>
                ) : (
                  <span className={navChipClass(true)} aria-hidden>
                    <IconCaret dir="right" />
                  </span>
                )
              ) : null}
            </div>
            <Link
              href={backHref}
              className="mt-1.5 inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
            >
              ← Bilans
            </Link>
          </div>
          <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
            <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
              <ClientsSubnav />
            </div>
          </div>
        </header>

        {/* ——— Flux hub : statut + demandé (pas les réponses) ——— */}
        {fromHub ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                    {statusLabel(instance.status)}
                  </span>
                  {isSubmitted ? (
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      {instance.coach_read_at ? 'Lu' : 'Non lu'}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    Demandé
                  </p>
                  <BilanRequestedSchema schema={schema} />
                </div>
                <p className="mt-4 text-sm text-[color:var(--muted)]">
                  Apparition {new Date(instance.appears_at).toLocaleDateString('fr-FR')}
                  {' · '}
                  Deadline {new Date(instance.due_at).toLocaleDateString('fr-FR')}
                  {instance.submitted_at
                    ? ` · Rempli le ${new Date(instance.submitted_at).toLocaleDateString('fr-FR')}`
                    : null}
                </p>
                {groupLabel ? (
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    Envoi groupe · {groupLabel}
                    {instance.batch_id ? (
                      <>
                        {' · '}
                        <Link
                          href={`/clients/bilans/batch/${instance.batch_id}`}
                          className="font-semibold text-[color:var(--brand)] hover:underline"
                        >
                          Voir le lot
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <Link
                  href={`/clients/${instance.client_id}/bilan`}
                  className="mt-3 inline-flex text-sm font-bold text-[color:var(--brand)] hover:underline"
                >
                  Fiche client →
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {relaunchable ? (
                  <RelanceBilanButton
                    clientId={instance.client_id}
                    instanceId={instance.id}
                    bilanTitle={instance.title}
                    bilanUrl={bilanUrl}
                  />
                ) : null}
                {deletable ? (
                  <DeleteBilanButton instanceId={instance.id} returnTo={returnAfterDelete} />
                ) : null}
              </div>
            </div>
            {relaunchable ? (
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm text-[color:var(--muted)]">
                En attente du client — relance possible ici.
              </p>
            ) : null}
            {instance.status === 'no_response' ? (
              <p className="mt-4 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
                Deadline dépassée — sans réponse.
              </p>
            ) : null}
          </section>
        ) : (
          <>
            {/* ——— Flux fiche client : détail + réponses ——— */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                      {statusLabel(instance.status)}
                    </span>
                    {isSubmitted ? (
                      <span className="text-xs font-semibold text-[color:var(--muted)]">
                        {instance.coach_read_at ? 'Lu' : 'Non lu'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--fg)]">{clientLabel}</p>
                  <dl className="mt-3 grid gap-1.5 text-xs text-[color:var(--muted)] sm:grid-cols-2">
                    <div>
                      <dt className="font-bold uppercase tracking-wide">Apparition</dt>
                      <dd className="mt-0.5 text-[color:var(--fg)]">
                        {new Date(instance.appears_at).toLocaleString('fr-FR')}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wide">Deadline</dt>
                      <dd className="mt-0.5 text-[color:var(--fg)]">
                        {new Date(instance.due_at).toLocaleString('fr-FR')}
                        {relaunchable && daysLeft >= 0
                          ? ` · ${daysLeft} j restant${daysLeft > 1 ? 's' : ''}`
                          : relaunchable
                            ? ' · dépassée'
                            : ''}
                      </dd>
                    </div>
                    {instance.submitted_at ? (
                      <div>
                        <dt className="font-bold uppercase tracking-wide">Rempli le</dt>
                        <dd className="mt-0.5 text-[color:var(--fg)]">
                          {new Date(instance.submitted_at).toLocaleString('fr-FR')}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="font-bold uppercase tracking-wide">Ouverture client</dt>
                      <dd className="mt-0.5 text-[color:var(--fg)]">
                        {instance.client_opened_at
                          ? new Date(instance.client_opened_at).toLocaleString('fr-FR')
                          : 'Pas encore ouvert'}
                      </dd>
                    </div>
                  </dl>
                  {groupLabel && instance.batch_id ? (
                    <p className="mt-2 text-xs text-[color:var(--muted)]">
                      Envoi groupe ·{' '}
                      <Link
                        href={`/clients/bilans/batch/${instance.batch_id}`}
                        className="font-semibold text-[color:var(--brand)] hover:underline"
                      >
                        {groupLabel}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {relaunchable ? (
                    <RelanceBilanButton
                      clientId={instance.client_id}
                      instanceId={instance.id}
                      bilanTitle={instance.title}
                      bilanUrl={bilanUrl}
                    />
                  ) : null}
                  {deletable ? (
                    <DeleteBilanButton instanceId={instance.id} returnTo={returnAfterDelete} />
                  ) : null}
                </div>
              </div>
            </section>

            {relaunchable ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm text-[color:var(--muted)]">
                En attente du client.
              </p>
            ) : null}

            {instance.status === 'no_response' ? (
              <p className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
                Deadline dépassée — sans réponse.
              </p>
            ) : null}

            {isSubmitted ? (
              <>
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    Réponses
                  </h2>
                  {schema.questions.length ? (
                    <ul className="mt-3 grid gap-3">
                      {schema.questions.map((question) => (
                        <li key={question.id}>
                          <p className="text-xs font-bold text-[color:var(--muted)]">
                            {question.label}
                          </p>
                          <p className="mt-0.5 text-sm text-[color:var(--fg)]">
                            {payload.questions?.[question.id]?.trim() || '—'}
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
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      Mensurations
                    </h2>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {schema.measurements.map((m) => (
                        <li key={m.id} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm">
                          <span className="font-semibold text-[color:var(--fg)]">{m.label}</span>
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
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      Photos
                    </h2>
                    {!photoUrls.length ? (
                      <p className="mt-2 text-sm text-[color:var(--muted)]">Aucune photo.</p>
                    ) : (
                      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                        {photoUrls.map((p, i) => (
                          <li
                            key={p.path + i}
                            className="overflow-hidden rounded-xl border border-[var(--border)]"
                          >
                            {p.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.url}
                                alt={p.label || 'Photo'}
                                className="aspect-square w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-square items-center justify-center text-xs text-[color:var(--muted)]">
                                Indisponible
                              </div>
                            )}
                            {p.label ? (
                              <p className="px-2 py-1 text-xs font-semibold">{p.label}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}
              </>
            ) : (
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                  Demandé
                </p>
                <BilanRequestedSchema schema={schema} />
              </section>
            )}

            {instance.batch_id && instance.source_group_id && batchPeers.length ? (
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                  Autres du groupe · {groupLabel}
                </h2>
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {batchPeers.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <Link
                        href={`/clients/bilans/${p.id}`}
                        className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--brand)] hover:underline"
                      >
                        {peerName.get(p.client_id) || 'Client'}
                      </Link>
                      <span className="shrink-0 text-[11px] font-bold text-[color:var(--muted)]">
                        {statusLabel(p.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {siblings.length > 1 ? (
              <nav className="flex flex-wrap gap-2" aria-label="Bilans du client">
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    href={`/clients/bilans/${s.id}`}
                    className={
                      s.id === instance.id
                        ? 'rounded-lg bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand-fg)]'
                        : 'rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]'
                    }
                  >
                    {new Date(s.appears_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {s.status === 'submitted' ? ' ✓' : ''}
                  </Link>
                ))}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

async function createSignedDownloadUrlForBilan(storagePath: string): Promise<string | null> {
  const admin = createServiceRoleClient()
  if (!admin) return null
  const { data, error } = await admin.storage.from('bilans').createSignedUrl(storagePath, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}
