'use client'

import { useMemo, useState } from 'react'

import { CopyCodeButton } from './CopyCodeButton'
import { CopyEmailsListButton } from './CopyEmailsListButton'
import { channelLabel } from '../../lib/tracking/trackedLinks'
import { daSelectClass } from '@/src/components/ui'

export type GlobalProspect = {
  id: string
  contact: string
  email: string | null
  phone: string | null
  handle: string | null
  channel: string
  campaignId: string
  campaignLabel: string
  prestationId: string | null
  prestationName: string | null
  whenLabel: string
  birthdate: string | null
  note: string | null
}

export function LiensProspectsPanel({ prospects }: { prospects: GlobalProspect[] }) {
  const [q, setQ] = useState('')
  const [campaignId, setCampaignId] = useState('all')
  const [prestaId, setPrestaId] = useState('all')

  const campaigns = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of prospects) {
      if (!map.has(p.campaignId)) map.set(p.campaignId, p.campaignLabel)
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [prospects])

  const prestations = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of prospects) {
      if (p.prestationId && p.prestationName) map.set(p.prestationId, p.prestationName)
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [prospects])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return prospects.filter((p) => {
      if (campaignId !== 'all' && p.campaignId !== campaignId) return false
      if (prestaId === 'none' && p.prestationId) return false
      if (prestaId !== 'all' && prestaId !== 'none' && p.prestationId !== prestaId) return false
      if (!needle) return true
      const blob = [
        p.contact,
        p.email,
        p.phone,
        p.handle,
        p.campaignLabel,
        p.prestationName,
        channelLabel(p.channel),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(needle)
    })
  }, [prospects, q, campaignId, prestaId])

  const emailsInView = filtered.map((p) => p.email).filter(Boolean) as string[]

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Prospects
              <span className="ml-2 font-semibold normal-case tracking-normal text-[color:var(--muted)]">
                {filtered.length}
                {filtered.length !== prospects.length ? ` / ${prospects.length}` : ''}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              Filtre par campagne ou presta — copie les emails de la vue.
            </p>
          </div>
          {prospects.length ? (
            <CopyEmailsListButton
              emails={emailsInView}
              label="Copier les emails"
              emptyLabel="Aucun email dans cette vue"
            />
          ) : null}
        </div>

        {prospects.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="grid min-w-[9rem] flex-1 gap-0.5 text-[11px] sm:max-w-[14rem]">
              <span className="font-semibold text-[color:var(--muted)]">Campagne</span>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className={`${daSelectClass} !py-1.5 text-sm`}
              >
                <option value="all">Toutes</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-[9rem] flex-1 gap-0.5 text-[11px] sm:max-w-[14rem]">
              <span className="font-semibold text-[color:var(--muted)]">Prestation</span>
              <select
                value={prestaId}
                onChange={(e) => setPrestaId(e.target.value)}
                className={`${daSelectClass} !py-1.5 text-sm`}
              >
                <option value="all">Toutes</option>
                <option value="none">Sans presta</option>
                {prestations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-[9rem] flex-1 gap-0.5 text-[11px] sm:max-w-[14rem]">
              <span className="font-semibold text-[color:var(--muted)]">Recherche</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, email…"
                className="rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 py-1.5 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted)]"
              />
            </label>
          </div>
        ) : null}
      </div>

      {!prospects.length ? (
        <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
          Aucun prospect pour l’instant. Partage un lien campagne — les « Je suis intéressé »
          apparaissent ici.
        </p>
      ) : !filtered.length ? (
        <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
          Aucun prospect pour ces filtres
          {q.trim() ? ` · « ${q.trim()} »` : ''}.
        </p>
      ) : (
        <ul className="max-h-[22.5rem] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex min-h-[4.5rem] flex-wrap items-start justify-between gap-3 px-5 py-3.5 hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[color:var(--fg)]">{p.contact}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-semibold text-[color:var(--muted)]">
                    {channelLabel(p.channel)}
                  </span>
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[color:var(--muted)]">
                    {p.campaignLabel}
                  </span>
                  {p.prestationName ? (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,var(--accent))] px-2 py-0.5 font-medium text-[color:var(--fg)]">
                      {p.prestationName}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-[color:var(--muted)]">
                  {[
                    p.email,
                    p.phone,
                    p.handle ? `@${p.handle.replace(/^@/, '')}` : null,
                    p.whenLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {p.note?.trim() ? (
                  <p className="mt-1 line-clamp-2 text-[11px] italic text-[color:var(--fg)]">
                    « {p.note.trim()} »
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {p.email ? <CopyCodeButton code={p.email} label="Email" /> : null}
                {p.phone ? <CopyCodeButton code={p.phone} label="Tél." /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
