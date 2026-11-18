import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/src/components/ui'
import { InviteLinkBox } from '../../../components/coach/InviteLinkBox'
import { RequestClientInfosPanel } from '../../../components/coach/RequestClientInfosPanel'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { getLatestSubmittedBilanMeasurements } from '../../../lib/bilans/latestMeasurements'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { createClientInviteAction } from '../invite-actions'
import { archiveClientAction, unarchiveClientAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ token?: string; invited?: string; unlinked?: string }>
    | { token?: string; invited?: string; unlinked?: string }
}

function sexLabel(sex: string | null | undefined) {
  if (sex === 'F') return 'Femme'
  if (sex === 'M') return 'Homme'
  if (sex === 'X') return 'Autre'
  return '—'
}

function statusLabel(status: string) {
  if (status === 'active') return 'Actif'
  if (status === 'archived') return 'Archivé'
  return 'Invité'
}

function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1
  return age >= 0 && age < 130 ? age : null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[color:var(--fg)]">{value || '—'}</p>
    </div>
  )
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
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

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) notFound()

  // Répare invited/active dérivés du compte (sans toucher archived)
  if (client.status !== 'archived') {
    const expected = client.user_id ? 'active' : 'invited'
    if (client.status !== expected) {
      await supabase
        .from('clients')
        .update({ status: expected, updated_at: new Date().toISOString() })
        .eq('id', client.id)
        .eq('coach_id', user.id)
      client.status = expected
    }
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  const origin = `${proto}://${host}`
  const inviteUrl = !client.user_id && q.token ? `${origin}/invite/${q.token}` : null
  const showroomSlug = shell.branding?.slug ?? null
  const profilInfosUrl = showroomSlug ? `${origin}/c/${showroomSlug}/profil/infos` : null
  const isArchived = client.status === 'archived'

  let latestBilan: Awaited<ReturnType<typeof getLatestSubmittedBilanMeasurements>> = null
  try {
    latestBilan = await getLatestSubmittedBilanMeasurements(supabase, {
      coachId: user.id,
      clientId: client.id,
    })
  } catch {
    latestBilan = null
  }

  return (
    <>
      {!client.user_id ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Accès app
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Première connexion : génère un lien (30&nbsp;j) pour que ce client crée son mot de passe
            et rejoigne ta fiche.
          </p>

          {inviteUrl ? (
            <div className="mt-4">
              <InviteLinkBox url={inviteUrl} />
            </div>
          ) : null}

          <form action={createClientInviteAction} className="mt-4">
            <input type="hidden" name="client_id" value={client.id} />
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">
              Générer un lien d’invitation
            </Button>
          </form>

          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Autre entrée
            </p>
            {showroomSlug ? (
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Il peut aussi passer par ton showroom{' '}
                <Link
                  href={`/c/${showroomSlug}/showroom`}
                  className="font-semibold text-[color:var(--brand)] hover:underline"
                >
                  /c/{showroomSlug}/showroom
                </Link>
                .
              </p>
            ) : (
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Renseigne un slug branding sur /home pour activer le showroom.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Infos</h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Modifiables uniquement par le client (profil app).
            </p>
          </div>
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)]">
            {statusLabel(client.status)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Email" value={client.email} />
          <InfoRow label="Téléphone" value={client.phone ?? ''} />
          <InfoRow label="Prénom" value={client.first_name ?? ''} />
          <InfoRow label="Nom" value={client.last_name ?? ''} />
          <InfoRow label="Sexe" value={sexLabel(client.sex)} />
          <InfoRow
            label="Naissance"
            value={
              client.birth_date ? new Date(client.birth_date).toLocaleDateString('fr-FR') : ''
            }
          />
          <InfoRow
            label="Âge"
            value={
              ageFromBirthDate(client.birth_date) != null
                ? `${ageFromBirthDate(client.birth_date)} ans`
                : ''
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Dernières mensurations
          </h2>
          {latestBilan ? (
            <Link
              href={`/clients/bilans/${latestBilan.instanceId}`}
              className="text-xs font-semibold text-[color:var(--brand)] underline"
            >
              Voir le bilan
            </Link>
          ) : null}
        </div>
        {!latestBilan ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Aucun bilan soumis pour l’instant.
            {(client.weight_kg != null || client.height_cm != null) && (
              <span className="mt-2 block text-[color:var(--fg)]">
                {client.weight_kg != null ? `${client.weight_kg} kg` : null}
                {client.weight_kg != null && client.height_cm != null ? ' · ' : null}
                {client.height_cm != null ? `${client.height_cm} cm` : null}
                <span className="text-[color:var(--muted)]"> (fiche)</span>
              </span>
            )}
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              {latestBilan.title} ·{' '}
              {new Date(latestBilan.submittedAt).toLocaleDateString('fr-FR')}
            </p>
            {latestBilan.schema.measurements.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {latestBilan.schema.measurements.map((m) => (
                  <li key={m.id} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">{m.label}</span>
                    <span className="ml-2 text-[color:var(--muted)]">
                      {latestBilan.payload.measurements?.[m.id]?.trim() || '—'} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Ce bilan n’avait pas de bloc mensurations.
                {(client.weight_kg != null || client.height_cm != null) && (
                  <span className="mt-1 block text-[color:var(--fg)]">
                    Fiche :{' '}
                    {client.weight_kg != null ? `${client.weight_kg} kg` : null}
                    {client.weight_kg != null && client.height_cm != null ? ' · ' : null}
                    {client.height_cm != null ? `${client.height_cm} cm` : null}
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Demander des infos
        </h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Coche les infos voulues (ou précise dans Autre) — ça ouvre le chat avec un message prêt.
          Les réponses arrivent en conversation ; le client garde la main sur son profil.
        </p>
        <div className="mt-3">
          <RequestClientInfosPanel clientId={client.id} profilInfosUrl={profilInfosUrl} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Statut
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Invité / Actif suit le compte app. Seul l’archivage est une action coach.
            </p>
          </div>
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)]">
            {statusLabel(client.status)}
          </span>
        </div>
        {isArchived ? (
          <form action={unarchiveClientAction} className="mt-4">
            <input type="hidden" name="id" value={client.id} />
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">
              Désarchiver
            </Button>
          </form>
        ) : (
          <form action={archiveClientAction} className="mt-4">
            <input type="hidden" name="id" value={client.id} />
            <button
              type="submit"
              className="rounded-lg border border-[var(--danger-border)] px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-bg)]"
            >
              Archiver le client
            </button>
          </form>
        )}
      </section>
    </>
  )
}
