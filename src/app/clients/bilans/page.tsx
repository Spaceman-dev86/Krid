import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { BilanTemplateForm } from '../../../components/bilans/BilanTemplateForm'
import { ClientsSubnav } from '../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import {
  listInstancesForCoach,
  listTemplates,
  statusLabel,
} from '../../../lib/bilans/bilans'
import { clientDisplayName } from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { createTemplateAction, deleteTemplateAction, sendBilanAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        tab?: string
        error?: string
        created?: string
        saved?: string
        deleted?: string
        sent?: string
      }>
    | {
        tab?: string
        error?: string
        created?: string
        saved?: string
        deleted?: string
        sent?: string
      }
}

export default async function ClientsBilansPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const tab = q.tab === 'templates' || q.tab === 'nouveau' || q.tab === 'envoyer' ? q.tab : 'tous'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let templates: Awaited<ReturnType<typeof listTemplates>> = []
  let instances: Awaited<ReturnType<typeof listInstancesForCoach>> = []
  let loadError: string | null = null
  try {
    templates = await listTemplates(supabase, user.id)
    instances = await listInstancesForCoach(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, name')
    .eq('coach_id', user.id)
    .order('name', { ascending: true })

  const clientName = new Map(
    (clients ?? []).map((c) => [
      c.id,
      clientDisplayName({ first_name: c.first_name, last_name: c.last_name, email: c.email }),
    ])
  )

  const readyTemplates = templates.filter((t) => t.status === 'ready')

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Bilans" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Bilans</PageTitle>
            <Muted className="mt-1">Templates · envoi · réponses client</Muted>
          </div>
          <ClientsSubnav />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['tous', 'Tous'],
              ['templates', 'Templates'],
              ['nouveau', 'Créer'],
              ['envoyer', 'Envoyer'],
            ] as const
          ).map(([id, label]) => (
            <Link
              key={id}
              href={id === 'tous' ? '/clients/bilans' : `/clients/bilans?tab=${id}`}
              className={
                tab === id
                  ? 'rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-bold text-[var(--brand-fg)]'
                  : 'rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)]'
              }
            >
              {label}
            </Link>
          ))}
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}
        {q.created || q.saved || q.deleted || q.sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {q.sent
              ? 'Bilan(s) envoyé(s).'
              : q.created
                ? 'Template créé.'
                : q.saved
                  ? 'Enregistré.'
                  : 'Template supprimé.'}
          </div>
        ) : null}

        {tab === 'nouveau' ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-4 text-lg font-extrabold text-[color:var(--brand)]">Nouveau template</h2>
            <BilanTemplateForm action={createTemplateAction} submitLabel="Créer le template" />
          </section>
        ) : null}

        {tab === 'envoyer' ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
            <h2 className="mb-4 text-lg font-extrabold text-[color:var(--brand)]">Envoyer un bilan</h2>
            {!readyTemplates.length ? (
              <p className="text-sm text-[color:var(--muted)]">
                Aucun template.{' '}
                <Link href="/clients/bilans?tab=nouveau" className="font-semibold text-[color:var(--brand)] underline">
                  Créer
                </Link>
              </p>
            ) : (
              <form action={sendBilanAction} className="grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Modèle</span>
                  <select name="template_id" required className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <option value="">Choisir…</option>
                    {readyTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Date d’apparition</span>
                  <input
                    type="datetime-local"
                    name="appears_at"
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                  <span className="text-xs text-[color:var(--muted)]">Vide = maintenant · deadline = +14 jours</span>
                </label>
                <div className="grid gap-2">
                  <p className="text-sm font-semibold">Clients</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    {(clients ?? []).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="client_id" value={c.id} />
                        {clientName.get(c.id)}
                      </label>
                    ))}
                  </div>
                </div>
                {(groups ?? []).length ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold">Groupes</p>
                    <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      {(groups ?? []).map((g) => (
                        <label key={g.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="group_id" value={g.id} />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Récurrence (optionnel)</span>
                  <select name="day_of_month" defaultValue="" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <option value="">Une seule fois</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Chaque mois le {d}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[color:var(--muted)]">
                    La 1ʳᵉ instance part maintenant ; les suivantes seront générées plus tard (cron).
                  </span>
                </label>
                <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Envoyer</Button>
              </form>
            )}
          </section>
        ) : null}

        {tab === 'templates' ? (
          <section className="grid gap-2">
            {!templates.length ? (
              <p className="text-sm text-[color:var(--muted)]">Aucun template.</p>
            ) : (
              <ul className="grid gap-2">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[color:var(--fg)]">{t.title}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {[
                          t.schema.photos ? 'Photos' : null,
                          t.schema.measurements.length ? `${t.schema.measurements.length} mens.` : null,
                          t.schema.questions.length ? `${t.schema.questions.length} q.` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Vide'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/clients/bilans/templates/${t.id}`}
                        className="text-xs font-bold text-[color:var(--brand)] hover:underline"
                      >
                        Modifier
                      </Link>
                      <form action={deleteTemplateAction}>
                        <input type="hidden" name="template_id" value={t.id} />
                        <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'tous' ? (
          <section className="grid gap-2">
            {!instances.length ? (
              <p className="text-sm text-[color:var(--muted)]">Aucune instance envoyée.</p>
            ) : (
              <ul className="grid gap-2">
                {instances.map((inst) => (
                  <li key={inst.id}>
                    <Link
                      href={`/clients/bilans/${inst.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[color-mix(in_srgb,var(--brand)_35%,transparent)]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--fg)]">{inst.title}</p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {clientName.get(inst.client_id) || 'Client'} ·{' '}
                          {new Date(inst.appears_at).toLocaleDateString('fr-FR')}
                          {!inst.coach_read_at && inst.status === 'submitted' ? ' · Non lu' : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                        {statusLabel(inst.status)}
                      </span>
                    </Link>
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
