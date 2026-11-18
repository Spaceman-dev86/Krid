import Link from 'next/link'

import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { portalShellProps, requireClientPortal } from '../../../../../lib/client-portal/context'
import { selectFieldClass, selectFieldStyle } from '../../../../../lib/ui/selectField'
import { createClient } from '../../../../../lib/supabase/server'
import { updateClientProfilAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?: Promise<{ saved?: string; error?: string }> | { saved?: string; error?: string }
}

export default async function ClientProfilInfosPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: clientExtra } = await supabase
    .from('clients')
    .select('sex, birth_date, weight_kg, height_cm')
    .eq('id', ctx.client.id)
    .maybeSingle()

  return (
    <ClientPortalShell {...portalShellProps(ctx)}>
      <div className="grid gap-5">
        <div>
          <Link
            href={`/c/${ctx.slug}/profil`}
            className="text-sm font-semibold"
            style={{ color: ctx.primaryColor }}
          >
            ← Profil
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Mes infos
          </h1>
          <p className="mt-1 text-sm text-black/55">Compte</p>
        </div>

        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Enregistré.
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <form action={updateClientProfilAction} className="grid gap-3">
            <input type="hidden" name="slug" value={ctx.slug} />
            <input type="hidden" name="client_id" value={ctx.client.id} />
            <input type="hidden" name="return_to" value={`/c/${ctx.slug}/profil/infos`} />
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Email</span>
              <input
                value={ctx.client.email}
                disabled
                className="rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-black/50"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Prénom</span>
              <input
                name="first_name"
                defaultValue={ctx.client.first_name ?? ''}
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Nom</span>
              <input
                name="last_name"
                defaultValue={ctx.client.last_name ?? ''}
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Téléphone</span>
              <input
                name="phone"
                defaultValue={ctx.client.phone ?? ''}
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Sexe</span>
              <select
                name="sex"
                defaultValue={clientExtra?.sex ?? ''}
                className={selectFieldClass}
                style={selectFieldStyle}
              >
                <option value="">—</option>
                <option value="F">Femme</option>
                <option value="M">Homme</option>
                <option value="X">Autre</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Date de naissance</span>
              <input
                type="date"
                name="birth_date"
                defaultValue={clientExtra?.birth_date ?? ''}
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ background: ctx.primaryColor }}
            >
              Enregistrer
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-black/70">Physique</p>
          {clientExtra?.weight_kg != null || clientExtra?.height_cm != null ? (
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {clientExtra?.weight_kg != null ? (
                <li className="rounded-lg bg-black/[0.04] px-3 py-2">
                  <span className="font-semibold">Poids</span>
                  <span className="ml-2 text-black/55">{clientExtra.weight_kg} kg</span>
                </li>
              ) : null}
              {clientExtra?.height_cm != null ? (
                <li className="rounded-lg bg-black/[0.04] px-3 py-2">
                  <span className="font-semibold">Taille</span>
                  <span className="ml-2 text-black/55">{clientExtra.height_cm} cm</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-black/50">Pas encore renseigné.</p>
          )}
          <p className="mt-3 text-xs text-black/45">
            Mis à jour automatiquement quand tu soumets un bilan avec poids / taille. Les autres
            mensurations restent dans l’historique des bilans.
          </p>
          <Link
            href={`/c/${ctx.slug}/profil/bilans`}
            className="mt-2 inline-block text-xs font-semibold underline"
            style={{ color: ctx.primaryColor }}
          >
            Voir mes bilans
          </Link>
        </section>
      </div>
    </ClientPortalShell>
  )
}
