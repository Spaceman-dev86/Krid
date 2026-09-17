import Link from 'next/link'

import { PageTitle, Muted, DaBanner } from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import { STATUS_LABEL, CATEGORY_LABEL } from '../../../lib/admin/supportLabels'
import { listAdminUnreadTicketIds } from '../../../lib/admin/savUnread'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ status?: string; coach?: string; error?: string }>
    | { status?: string; coach?: string; error?: string }
}

export default async function AdminSavPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  let query = supabase
    .from('support_tickets')
    .select(
      'id, subject, status, category, created_at, coach_id, admin_last_read_at, profiles:coach_id(email, full_name)',
    )
    .order('updated_at', { ascending: false })
    .limit(100)

  if (q.status && q.status !== 'all') {
    query = query.eq('status', q.status)
  }
  if (q.coach) {
    query = query.eq('coach_id', q.coach)
  }

  const [{ data: tickets, error }, unreadIds] = await Promise.all([
    query,
    listAdminUnreadTicketIds(supabase),
  ])

  let coachFilterLabel: string | null = null
  if (q.coach) {
    const fromList = tickets?.find((t) => t.coach_id === q.coach)
    const profiles = fromList?.profiles as unknown as { email?: string; full_name?: string } | null
    if (profiles?.full_name || profiles?.email) {
      coachFilterLabel = profiles.full_name || profiles.email || null
    } else {
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', q.coach)
        .maybeSingle()
      coachFilterLabel = coachProfile?.full_name || coachProfile?.email || q.coach
    }
  }

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'nouveau', label: 'Nouveau' },
    { id: 'en_cours', label: 'En cours' },
    { id: 'attente_coach', label: 'Attente coach' },
    { id: 'resolu', label: 'Résolu' },
  ]

  function statusHref(statusId: string) {
    const params = new URLSearchParams()
    if (statusId !== 'all') params.set('status', statusId)
    if (q.coach) params.set('coach', q.coach)
    const qs = params.toString()
    return qs ? `/admin/sav?${qs}` : '/admin/sav'
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>SAV</PageTitle>
        <Muted className="mt-1">Tickets coaches · fermer / relancer / rouvrir · PJ.</Muted>
        {q.coach ? (
          <p className="mt-2 text-sm text-[color:var(--fg)]">
            Filtré coach : <strong>{coachFilterLabel}</strong>{' '}
            <Link
              href={q.status && q.status !== 'all' ? `/admin/sav?status=${q.status}` : '/admin/sav'}
              className="underline"
            >
              (retirer)
            </Link>
          </p>
        ) : null}
      </div>

      {q.error ? <DaBanner tone="danger" className="mb-4">{q.error}</DaBanner> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (q.status || 'all') === f.id
          return (
            <Link
              key={f.id}
              href={statusHref(f.id)}
              className={
                active
                  ? 'rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-[var(--brand-fg)]'
                  : 'rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
              }
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {error ? (
        <DaBanner tone="warning">
          Table SAV absente ou erreur : <code className="text-xs">{error.message}</code>
        </DaBanner>
      ) : !tickets?.length ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          Aucun ticket. Les coaches créent un ticket depuis Settings → Aide.
        </p>
      ) : (
        <ul className="grid gap-2">
          {tickets.map((t) => {
            const coach = t.profiles as unknown as { email?: string; full_name?: string } | null
            const unread = unreadIds.has(t.id)
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/sav/${t.id}`}
                  className={
                    unread
                      ? 'flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand)_40%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] px-4 py-3'
                      : 'flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[color-mix(in_srgb,var(--brand)_35%,var(--border))]'
                  }
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-[color:var(--fg)]">
                      {t.subject}
                      {unread ? (
                        <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-fg)]">
                          Non lu
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {coach?.full_name || coach?.email || t.coach_id} ·{' '}
                      {CATEGORY_LABEL[t.category] || t.category} ·{' '}
                      {new Date(t.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-[var(--brand)]">
                    {STATUS_LABEL[t.status] || t.status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
