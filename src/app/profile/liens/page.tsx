import { Suspense } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CopyCreatedLinkEffect } from '../../../components/coach/CopyCreatedLinkEffect'
import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { CreateTrackedLinkDialog } from '../../../components/coach/CreateTrackedLinkDialog'
import { LiensCampaignCard } from '../../../components/coach/LiensCampaignCard'
import { LiensProspectsPanel } from '../../../components/coach/LiensProspectsPanel'
import { ProfileHubHeader } from '../../../components/coach/ProfileHubHeader'
import { ShowroomMonthStatsStrip } from '../../../components/coach/ShowroomMonthStatsStrip'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { loadShowroomMonthStats } from '../../../lib/tracking/loadShowroomMonthStats'
import { buildTrackedUrl } from '../../../lib/tracking/trackedLinks'
import { createClient } from '../../../lib/supabase/server'
import {
  archiveTrackedLinkAction,
  ensureDefaultTrackedLinkAction,
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
  email?: string | null
}) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (row.email?.trim()) return row.email.trim()
  if (row.channel === 'ig' || row.channel === 'other') return row.handle?.trim() || '—'
  if (row.channel === 'wa') return row.phone?.trim() || '—'
  return '—'
}

type LeadRow = {
  id: string
  link_id: string
  channel: string
  handle: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  birthdate: string | null
  note: string | null
  prestation_id: string | null
  created_at: string
}

export default async function ProfileLiensPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{
        error?: string
        created?: string
        archived?: string
        saved?: string
        contacts?: string
        nouveau?: string
      }>
    | {
        error?: string
        created?: string
        archived?: string
        saved?: string
        contacts?: string
        nouveau?: string
      }
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

  const [{ data: links, error: linksError }, { data: prestations }, { data: promos }, monthStats] =
    await Promise.all([
      supabase
        .from('coach_tracked_links')
        .select(
          'id, code, label, channel, target_kind, prestation_id, promo_code_id, capture_leads, is_default, share_message, status, created_at',
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
      supabase
        .from('coach_codes')
        .select('id, code, percent_off, prestation_ids, status, type')
        .eq('coach_id', user.id)
        .eq('type', 'promo')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      loadShowroomMonthStats(supabase, user.id),
    ])

  const tableMissing =
    linksError &&
    /relation|does not exist|coach_tracked_links|share_message|promo_code_id|column/i.test(
      linksError.message,
    )

  const linkIds = (links ?? []).map((l) => l.id)
  const clickCounts = new Map<string, number>()
  const interestCounts = new Map<string, number>()
  const paidCounts = new Map<string, number>()
  const leadsByLink = new Map<string, LeadRow[]>()

  if (linkIds.length && !tableMissing) {
    const [{ data: clicks }, { data: paid }, { data: leadIds }, { data: leads }] =
      await Promise.all([
        supabase.from('coach_tracked_link_clicks').select('link_id').in('link_id', linkIds),
        supabase
          .from('payment_ledger')
          .select('tracked_link_id')
          .eq('coach_id', user.id)
          .eq('status', 'paid')
          .in('tracked_link_id', linkIds),
        supabase
          .from('coach_tracked_leads')
          .select('link_id')
          .eq('coach_id', user.id)
          .in('link_id', linkIds),
        supabase
          .from('coach_tracked_leads')
          .select(
            'id, link_id, channel, handle, phone, first_name, last_name, email, birthdate, note, prestation_id, created_at',
          )
          .eq('coach_id', user.id)
          .in('link_id', linkIds)
          .order('created_at', { ascending: false })
          .limit(100),
      ])
    for (const row of clicks ?? []) {
      clickCounts.set(row.link_id, (clickCounts.get(row.link_id) ?? 0) + 1)
    }
    for (const row of paid ?? []) {
      if (!row.tracked_link_id) continue
      paidCounts.set(row.tracked_link_id, (paidCounts.get(row.tracked_link_id) ?? 0) + 1)
    }
    for (const row of leadIds ?? []) {
      interestCounts.set(row.link_id, (interestCounts.get(row.link_id) ?? 0) + 1)
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
  const promoById = new Map(
    (promos ?? []).map((p) => [
      p.id,
      { code: p.code, percent_off: p.percent_off as number | null },
    ]),
  )
  const openCreate = params.nouveau === '1'
  const prestaOptions = (prestations ?? []).map((p) => ({ id: p.id, name: p.name }))
  const promoOptions = (promos ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    percent_off: p.percent_off as number | null,
    prestation_ids: (p.prestation_ids ?? []) as string[],
  }))

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            archived: { tone: 'success', message: 'Lien archivé' },
            created: { tone: 'success', message: 'Campagne créée — URL copiée si possible' },
            saved: { tone: 'success', message: 'Texte enregistré' },
            contacts: { tone: 'success', message: 'Contacts enregistrés' },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ProfileHubHeader
          title="Liens"
          subtitle="Tes campagnes : où tu diffuses, où le prospect atterrit, et les leads dans Prospects."
          actions={
            <CreateTrackedLinkDialog
              prestations={prestaOptions}
              promos={promoOptions}
              defaultOpen={openCreate}
            />
          }
          showChromeActions={false}
        />

        <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-da-sm sm:grid-cols-3">
          {[
            { n: '1', t: 'Tu partages le lien', d: 'Story, bio, ads…' },
            { n: '2', t: 'Le prospect agit', d: 'Infos ou paiement sur ta fiche' },
            { n: '3', t: 'Tu récupères', d: 'Lead dans Prospects, ou client payé' },
          ].map((step) => (
            <div key={step.n} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-xs font-extrabold text-[color:var(--brand)]">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-bold text-[color:var(--fg)]">{step.t}</p>
                <p className="text-xs text-[color:var(--muted)]">{step.d}</p>
              </div>
            </div>
          ))}
        </div>

        {!tableMissing ? <ShowroomMonthStatsStrip stats={monthStats} /> : null}

        {tableMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Schéma incomplet — exécute les tranches SQL Liens (30…) puis{' '}
            <code className="font-mono">94_tracked_link_promo</code> et recharge.
            {linksError?.message ? (
              <span className="mt-1 block text-xs opacity-80">{linksError.message}</span>
            ) : null}
          </div>
        ) : null}

        {!slug ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Définis un slug showroom sur Mon app pour générer tes URLs.
          </div>
        ) : null}

        {params.created && slug ? (
          <CopyCreatedLinkEffect
            code={params.created}
            url={buildTrackedUrl({ origin, slug, code: params.created })}
          />
        ) : null}

        <LiensProspectsPanel
          prospects={(links ?? [])
            .flatMap((link) =>
              (leadsByLink.get(link.id) ?? []).map((lead) => ({
                lead,
                campaignId: link.id,
                campaignLabel: link.label,
              })),
            )
            .sort((a, b) => (a.lead.created_at < b.lead.created_at ? 1 : -1))
            .map(({ lead, campaignId, campaignLabel }) => ({
              id: lead.id,
              contact: leadContact(lead),
              email: lead.email,
              phone: lead.phone,
              handle: lead.handle,
              channel: lead.channel,
              campaignId,
              campaignLabel,
              prestationId: lead.prestation_id,
              prestationName: lead.prestation_id
                ? prestaName.get(lead.prestation_id) ?? 'Presta'
                : null,
              whenLabel: formatWhen(lead.created_at),
              birthdate: lead.birthdate,
              note: lead.note,
            }))}
        />

        <section className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Campagnes
              <span className="ml-2 font-semibold normal-case tracking-normal text-[color:var(--muted)]">
                {links?.length ?? 0}
              </span>
            </h2>
            <p className="text-xs text-[color:var(--muted)]">
              Promo à attacher ?{' '}
              <Link href="/profile/codes" className="font-semibold text-[color:var(--brand)] underline">
                Créer dans Codes
              </Link>
            </p>
          </div>

          {!links?.length ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-sm text-[color:var(--muted)] shadow-da-sm">
              Aucune campagne active. Crée-en une pour suivre tes stories et ads.
            </p>
          ) : (
            (links ?? []).map((link) => {
              const row = link as typeof link & { promo_code_id?: string | null }
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
              const promoMeta = row.promo_code_id ? promoById.get(row.promo_code_id) : undefined

              return (
                <LiensCampaignCard
                  key={link.id}
                  label={link.label}
                  code={link.code}
                  targetLabel={targetLabel}
                  promoLabel={
                    promoMeta
                      ? `${promoMeta.code}${promoMeta.percent_off != null ? ` −${promoMeta.percent_off}%` : ''}`
                      : null
                  }
                  isDefault={link.is_default}
                  clicks={clickCounts.get(link.id) ?? 0}
                  interests={interestCounts.get(link.id) ?? 0}
                  paid={paidCounts.get(link.id) ?? 0}
                  url={url}
                  shareMessage={link.share_message ?? null}
                  linkId={link.id}
                  archiveAction={
                    !link.is_default ? (
                      <form action={archiveTrackedLinkAction}>
                        <input type="hidden" name="link_id" value={link.id} />
                        <button
                          type="submit"
                          className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)]"
                        >
                          Archiver
                        </button>
                      </form>
                    ) : null
                  }
                />
              )
            })
          )}
        </section>
      </div>
    </>
  )
}
