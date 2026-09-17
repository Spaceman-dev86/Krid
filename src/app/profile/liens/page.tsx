import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CopyCreatedLinkEffect } from '../../../components/coach/CopyCreatedLinkEffect'
import { CreateTrackedLinkForm } from '../../../components/coach/CreateTrackedLinkForm'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { LinkLeadsCollapse } from '../../../components/coach/LinkLeadsCollapse'
import { ProfileChromeActions } from '../../../components/coach/ProfileChromeActions'
import { ProfileSubnav } from '../../../components/coach/ProfileSubnav'
import { TrackedLinkShareBlock } from '../../../components/coach/TrackedLinkShareBlock'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { buildTrackedUrl, channelLabel } from '../../../lib/tracking/trackedLinks'
import { createClient } from '../../../lib/supabase/server'
import {
  archiveTrackedLinkAction,
  ensureDefaultTrackedLinkAction,
  toggleCaptureLeadsAction,
} from './actions'

export const dynamic = 'force-dynamic'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function leadContact(row: {
  channel: string
  handle: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
}) {
  if (row.channel === 'ig' || row.channel === 'other') return row.handle?.trim() || '—'
  if (row.channel === 'wa') return row.phone?.trim() || '—'
  const n = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return n || '—'
}

type LeadRow = {
  id: string
  link_id: string
  channel: string
  handle: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  created_at: string
}

export default async function ProfileLiensPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; created?: string; archived?: string; saved?: string }>
    | { error?: string; created?: string; archived?: string; saved?: string }
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
  const slug = shell.branding?.slug?.trim()

  try {
    await ensureDefaultTrackedLinkAction()
  } catch {
    /* table absente tant que 30 pas run */
  }

  const [{ data: links, error: linksError }, { data: prestations }] = await Promise.all([
    supabase
      .from('coach_tracked_links')
      .select(
        'id, code, label, channel, target_kind, prestation_id, capture_leads, is_default, share_message, status, created_at'
      )
      .eq('coach_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('prestations')
      .select('id, name')
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('name'),
  ])

  const tableMissing =
    linksError &&
    /relation|does not exist|coach_tracked_links|share_message|column/i.test(linksError.message)

  const linkIds = (links ?? []).map((l) => l.id)
  const clickCounts = new Map<string, number>()
  const signupCounts = new Map<string, number>()
  const paidCounts = new Map<string, number>()
  const leadsByLink = new Map<string, LeadRow[]>()

  if (linkIds.length && !tableMissing) {
    const [{ data: clicks }, { data: signups }, { data: paid }, { data: leads }] = await Promise.all([
      supabase.from('coach_tracked_link_clicks').select('link_id').in('link_id', linkIds),
      supabase
        .from('clients')
        .select('tracked_link_id')
        .eq('coach_id', user.id)
        .in('tracked_link_id', linkIds)
        .is('deleted_at', null),
      supabase
        .from('payment_ledger')
        .select('tracked_link_id')
        .eq('coach_id', user.id)
        .eq('status', 'paid')
        .in('tracked_link_id', linkIds),
      supabase
        .from('coach_tracked_leads')
        .select('id, link_id, channel, handle, phone, first_name, last_name, created_at')
        .eq('coach_id', user.id)
        .in('link_id', linkIds)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    for (const row of clicks ?? []) {
      clickCounts.set(row.link_id, (clickCounts.get(row.link_id) ?? 0) + 1)
    }
    for (const row of signups ?? []) {
      if (!row.tracked_link_id) continue
      signupCounts.set(row.tracked_link_id, (signupCounts.get(row.tracked_link_id) ?? 0) + 1)
    }
    for (const row of paid ?? []) {
      if (!row.tracked_link_id) continue
      paidCounts.set(row.tracked_link_id, (paidCounts.get(row.tracked_link_id) ?? 0) + 1)
    }
    for (const row of leads ?? []) {
      const list = leadsByLink.get(row.link_id) ?? []
      list.push(row)
      leadsByLink.set(row.link_id, list)
    }
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const prestaName = new Map((prestations ?? []).map((p) => [p.id, p.name]))

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Liens" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Profil public</PageTitle>
            <Muted className="mt-1">Campagnes trackées et leads</Muted>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ProfileChromeActions />
            <ProfileSubnav />
          </div>
        </div>

        {tableMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Schéma incomplet — exécute <code className="font-mono">30_tracked_links.sql</code> puis{' '}
            <code className="font-mono">30b_tracked_link_share.sql</code> et recharge.
            {linksError?.message ? (
              <span className="mt-1 block text-xs opacity-80">{linksError.message}</span>
            ) : null}
          </div>
        ) : null}

        {!slug ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Définis un slug showroom sur le Dashboard pour générer des URLs.
          </div>
        ) : null}

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        ) : null}
        {params.created && slug ? (
          <CopyCreatedLinkEffect
            code={params.created}
            url={buildTrackedUrl({ origin, slug, code: params.created })}
          />
        ) : params.created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Lien créé · <strong className="font-mono">{params.created}</strong>
          </div>
        ) : null}
        {params.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Texte enregistré.
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Nouveau lien
          </h2>
          <CreateTrackedLinkForm
            prestations={(prestations ?? []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Liens actifs
            </h2>
            <span className="text-[11px] font-medium text-[color:var(--muted)]">{links?.length ?? 0}</span>
          </div>

          {!links?.length ? (
            <p className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">Aucun lien actif.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {links.map((link) => {
                const url =
                  slug != null
                    ? buildTrackedUrl({
                        origin,
                        slug,
                        code: link.code,
                        targetKind: link.target_kind === 'prestation' ? 'prestation' : 'showroom',
                        prestationId: link.prestation_id,
                      })
                    : null
                const targetLabel =
                  link.target_kind === 'prestation'
                    ? prestaName.get(link.prestation_id ?? '') ?? 'Presta'
                    : 'Showroom'
                const clicks = clickCounts.get(link.id) ?? 0
                const signups = signupCounts.get(link.id) ?? 0
                const paid = paidCounts.get(link.id) ?? 0
                const leads = leadsByLink.get(link.id) ?? []

                return (
                  <li key={link.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="truncate text-sm font-bold text-[color:var(--brand)]">{link.label}</h3>
                          {link.is_default ? (
                            <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                              Défaut
                            </span>
                          ) : null}
                          <span className="text-[11px] text-[color:var(--muted)]">
                            {channelLabel(link.channel)} · {targetLabel}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--muted)]">
                          <span className="font-mono text-[color:var(--muted)]">{link.code}</span>
                          <span className="text-[color:var(--muted)]">·</span>
                          <Stat n={clicks} one="clic" many="clics" />
                          <span className="text-[color:var(--muted)]">·</span>
                          <Stat n={signups} one="compte" many="comptes" />
                          <span className="text-[color:var(--muted)]">·</span>
                          <Stat n={paid} one="payé" many="payés" />
                          {link.capture_leads ? (
                            <>
                              <span className="text-[color:var(--muted)]">·</span>
                              <Stat n={leads.length} one="lead" many="leads" />
                            </>
                          ) : (
                            <>
                              <span className="text-[color:var(--muted)]">·</span>
                              <span className="text-[color:var(--muted)]">leads off</span>
                            </>
                          )}
                        </div>

                        {url ? (
                          <TrackedLinkShareBlock
                            linkId={link.id}
                            url={url}
                            shareMessage={link.share_message ?? null}
                          />
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <form action={toggleCaptureLeadsAction}>
                          <input type="hidden" name="link_id" value={link.id} />
                          <input type="hidden" name="next" value={link.capture_leads ? '0' : '1'} />
                          <button
                            type="submit"
                            className={
                              link.capture_leads
                                ? 'rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100'
                                : 'rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)]'
                            }
                            title={
                              link.capture_leads
                                ? 'Désactiver la capture de leads'
                                : 'Activer la capture de leads'
                            }
                          >
                            {link.capture_leads ? 'Leads on' : 'Leads off'}
                          </button>
                        </form>
                        {!link.is_default ? (
                          <form action={archiveTrackedLinkAction}>
                            <input type="hidden" name="link_id" value={link.id} />
                            <button
                              type="submit"
                              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--muted)]"
                            >
                              Archiver
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <LinkLeadsCollapse
                      captureOn={link.capture_leads}
                      leads={leads.map((lead) => ({
                        id: lead.id,
                        channel: lead.channel,
                        handle: lead.handle,
                        phone: lead.phone,
                        first_name: lead.first_name,
                        last_name: lead.last_name,
                        created_at: lead.created_at,
                        contact: leadContact(lead),
                        whenLabel: formatWhen(lead.created_at),
                      }))}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span>
      <span className="font-semibold tabular-nums text-[color:var(--muted)]">{n}</span> {n > 1 ? many : one}
    </span>
  )
}
