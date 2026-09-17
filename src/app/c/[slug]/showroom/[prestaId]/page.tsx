import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ShowroomTrackedRef } from '../../../../../components/showroom/ShowroomTrackedRef'
import { hasPasswordSet } from '../../../../../lib/auth/password'
import { formatPriceCents, parseModules, PRESTATION_MODULES } from '../../../../../lib/prestations/modules'
import { withRef } from '../../../../../lib/tracking/trackedLinks'
import { createClient } from '../../../../../lib/supabase/server'
import { simulateShowroomPaymentAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; prestaId: string }> | { slug: string; prestaId: string }
  searchParams?:
    | Promise<{ paid?: string; error?: string; ref?: string }>
    | { paid?: string; error?: string; ref?: string }
}

function currentPeriodYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodYm(ym: string) {
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

export default async function ShowroomPrestationPage({ params, searchParams }: Props) {
  const { slug, prestaId } = await Promise.resolve(params)
  const sp = await Promise.resolve(searchParams ?? {})
  const refCode = typeof sp.ref === 'string' && sp.ref.trim() ? sp.ref.trim() : null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug, app_name, logo_url, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) notFound()

  const { data: prestation } = await supabase
    .from('prestations')
    .select('id, name, description, price_cents, pricing_type, modules, status, showroom_visible')
    .eq('id', prestaId)
    .eq('coach_id', branding.coach_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prestation || prestation.status !== 'active' || !prestation.showroom_visible) {
    notFound()
  }

  let canEnterPortal = false
  let alreadyPaid = false
  let hasActiveGrant = false
  const pricingType = prestation.pricing_type === 'renewable' ? 'renewable' : 'unique'
  const periodYm = pricingType === 'renewable' ? currentPeriodYm() : null

  if (user) {
    const { data: linked } = await supabase
      .from('clients')
      .select('id, first_name, last_name, sex, birth_date')
      .eq('user_id', user.id)
      .eq('coach_id', branding.coach_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (linked) {
      const passwordOk = await hasPasswordSet(supabase, user)
      const profileOk = Boolean(
        linked.first_name?.trim() &&
          linked.last_name?.trim() &&
          linked.sex?.trim() &&
          linked.birth_date
      )
      canEnterPortal = passwordOk && profileOk

      if (canEnterPortal) {
        let paidQuery = supabase
          .from('payment_ledger')
          .select('id')
          .eq('coach_id', branding.coach_id)
          .eq('client_id', linked.id)
          .eq('prestation_id', prestaId)
          .eq('status', 'paid')
          .limit(1)

        if (periodYm) paidQuery = paidQuery.eq('period_ym', periodYm)
        else paidQuery = paidQuery.is('period_ym', null)

        const { data: paidRow } = await paidQuery.maybeSingle()
        alreadyPaid = Boolean(paidRow)

        const { data: grant } = await supabase
          .from('client_grants')
          .select('id')
          .eq('coach_id', branding.coach_id)
          .eq('client_id', linked.id)
          .eq('prestation_id', prestaId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        hasActiveGrant = Boolean(grant)
      }
    }
  }

  const brand = branding.primary_color?.trim() || '#341c44'
  const appName = branding.app_name?.trim() || 'Trainly'
  const mods = parseModules(prestation.modules)
  const modLabels = PRESTATION_MODULES.filter((m) => mods.includes(m.id)).map((m) => m.label)
  const rejoindreHref = withRef(
    `/c/${slug}/rejoindre?presta=${encodeURIComponent(prestaId)}`,
    refCode
  )
  const justPaid = sp.paid === '1'
  const errorMsg = typeof sp.error === 'string' && sp.error.trim() ? sp.error.trim() : null
  const canCheckout = canEnterPortal && !alreadyPaid

  return (
    <main className="min-h-screen bg-[#f6f4f8] text-[#1a1220]">
      <ShowroomTrackedRef coachId={branding.coach_id} refCode={refCode} brand={brand} />
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 md:px-6">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: brand }}
              >
                {appName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
                <Link href={withRef(`/c/${slug}/showroom`, refCode)} className="hover:underline">
                  Showroom
                </Link>
              </p>
              <h1 className="text-xl font-extrabold" style={{ color: brand }}>
                {appName}
              </h1>
            </div>
          </div>
          {canEnterPortal ? (
            <Link
              href={`/c/${slug}/home`}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-white"
              style={{ background: brand }}
            >
              Entrer dans l’app
            </Link>
          ) : (
            <Link
              href={rejoindreHref}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-white"
              style={{ background: brand }}
            >
              Me connecter
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 md:px-6">
        <Link
          href={withRef(`/c/${slug}/showroom`, refCode)}
          className="text-sm font-semibold text-black/45 hover:underline"
        >
          ← Toutes les offres
        </Link>

        {justPaid ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Paiement enregistré (simulation). L’accès à l’offre est activé.
            <p className="mt-2 text-xs text-emerald-800/80">
              Sur iPhone : « Installer l’app » affiche les étapes Safari (Partager → Écran
              d’accueil). « Ouvrir mon espace » reste dans le navigateur.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/c/${slug}/install`}
                className="inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ background: brand }}
              >
                Installer l’app
              </Link>
              <Link
                href={`/c/${slug}/home`}
                className="inline-flex rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
              >
                Ouvrir mon espace
              </Link>
            </div>
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        ) : null}

        <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-2xl font-extrabold" style={{ color: brand }}>
              {prestation.name}
            </h2>
            <p className="text-lg font-bold text-black/80">{formatPriceCents(prestation.price_cents)}</p>
          </div>
          <p className="mt-2 text-sm text-black/50">
            {pricingType === 'renewable' ? 'Tarification mensuelle' : 'Paiement unique'}
          </p>
          {prestation.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-black/65">
              {prestation.description}
            </p>
          ) : null}

          {modLabels.length ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Inclus</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {modLabels.map((label) => (
                  <li
                    key={label}
                    className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 rounded-xl border border-black/10 bg-[#f6f4f8] px-4 py-4 text-sm text-black/60">
            {!canEnterPortal ? (
              <>
                <p className="font-semibold text-[#341c44]">Comment démarrer ?</p>
                <p className="mt-1">
                  Connecte-toi ou crée un compte pour rejoindre {appName}, puis paie cette offre
                  (simulation pour l’instant).
                </p>
                <div className="mt-4">
                  <Link
                    href={rejoindreHref}
                    className="inline-flex rounded-lg px-4 py-2.5 text-sm font-bold text-white"
                    style={{ background: brand }}
                  >
                    Me connecter
                  </Link>
                </div>
              </>
            ) : alreadyPaid || justPaid ? (
              <>
                <p className="font-semibold text-[#341c44]">
                  {justPaid ? 'Offre activée' : 'Déjà acquise'}
                </p>
                <p className="mt-1">
                  {pricingType === 'renewable' && periodYm
                    ? `Paiement enregistré pour ${formatPeriodYm(periodYm)}.`
                    : 'Tu as déjà accès à cette offre.'}
                  {hasActiveGrant ? ' L’accès est actif dans ton espace.' : null}
                </p>
                <div className="mt-4">
                  <Link
                    href={`/c/${slug}/home`}
                    className="inline-flex rounded-lg px-4 py-2.5 text-sm font-bold text-white"
                    style={{ background: brand }}
                  >
                    Ouvrir mon espace
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-[#341c44]">Payer cette offre</p>
                <p className="mt-1">
                  Simulation (pas de Stripe) : enregistre un paiement Payé en compta et active
                  l’accès, comme un vrai checkout.
                </p>
                {pricingType === 'renewable' && periodYm ? (
                  <p className="mt-2 text-xs text-black/45">
                    Période couverte : {formatPeriodYm(periodYm)}
                  </p>
                ) : null}

                <form action={simulateShowroomPaymentAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="prestation_id" value={prestaId} />

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Code d’accès (cash)
                    </span>
                    <input
                      type="text"
                      name="access_code"
                      placeholder="Optionnel — active l’offre"
                      autoComplete="off"
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Code promo
                    </span>
                    <input
                      type="text"
                      name="promo_code"
                      placeholder="Optionnel — remise %"
                      autoComplete="off"
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <span className="text-[11px] text-black/40">
                      Cumul possible : accès + promo sur la même offre.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: brand }}
                    disabled={!canCheckout}
                  >
                    Payer / activer (simulation)
                  </button>
                </form>
              </>
            )}
          </div>
        </article>
      </div>
    </main>
  )
}
