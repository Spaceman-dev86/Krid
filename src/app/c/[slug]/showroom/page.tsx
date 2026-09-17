import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ShowroomTrackedRef } from '../../../../components/showroom/ShowroomTrackedRef'
import { formatPriceCents, parseModules } from '../../../../lib/prestations/modules'
import { withRef } from '../../../../lib/tracking/trackedLinks'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ error?: string; ref?: string }>
    | { error?: string; ref?: string }
}

export default async function CoachShowroomPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const refCode = typeof q.ref === 'string' && q.ref.trim() ? q.ref.trim() : null
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

  const { data: publicProfile } = await supabase
    .from('coach_public_profile')
    .select('public_name, tagline, bio, photo_url, cover_url')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  let canEnterPortal = false
  if (user) {
    const { data: linked } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('coach_id', branding.coach_id)
      .is('deleted_at', null)
      .maybeSingle()
    canEnterPortal = Boolean(linked)
  }

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name, description, price_cents, pricing_type, modules')
    .eq('coach_id', branding.coach_id)
    .eq('showroom_visible', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const brand = branding.primary_color?.trim() || '#341c44'
  const appName = branding.app_name?.trim() || 'Trainly'
  const displayName = publicProfile?.public_name?.trim() || appName
  const tagline = publicProfile?.tagline?.trim() || null
  const bio = publicProfile?.bio?.trim() || null
  const photoUrl = publicProfile?.photo_url?.trim() || null
  const coverUrl = publicProfile?.cover_url?.trim() || null

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
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Showroom</p>
              <p className="text-sm font-bold text-black/70">{appName}</p>
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
              href={`/login/client?redirectTo=${encodeURIComponent(withRef(`/c/${slug}/showroom`, refCode))}`}
              className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-sm font-bold text-black/70"
            >
              Connexion
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 md:px-6">
        {q.error === 'not_your_coach' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Ce compte n’est pas rattaché à ce coach. Demande une invitation ou choisis une offre.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-black/10 shadow-sm">
          <div className="relative min-h-[220px] sm:min-h-[260px]">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: brand }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
            <div className="relative flex h-full min-h-[220px] flex-col justify-end px-5 pb-5 pt-16 sm:min-h-[260px]">
              <div className="flex flex-wrap items-end gap-4">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white text-2xl font-bold text-white shadow-md"
                    style={{ background: brand }}
                  >
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1 pb-1 text-white">
                  <h1 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">{displayName}</h1>
                  {tagline ? <p className="mt-1 text-sm text-white/85 drop-shadow-sm">{tagline}</p> : null}
                </div>
              </div>
              {bio ? (
                <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {bio}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/45">Offres</h2>
          <p className="mt-1 text-sm text-black/55">
            Paiement simulé sur chaque fiche — codes promo / accès sur le checkout.
          </p>
        </div>

        {!prestations?.length ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white px-5 py-10 text-center text-sm text-black/45">
            Aucune offre publiée pour le moment.
          </div>
        ) : (
          <ul className="grid gap-4">
            {prestations.map((p) => {
              const mods = parseModules(p.modules)
              return (
                <li key={p.id}>
                  <Link
                    href={withRef(`/c/${slug}/showroom/${p.id}`, refCode)}
                    className="block rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-extrabold" style={{ color: brand }}>
                        {p.name}
                      </h2>
                      <p className="text-sm font-bold text-black/70">{formatPriceCents(p.price_cents)}</p>
                    </div>
                    {p.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-black/55">{p.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-black/40">
                      {p.pricing_type === 'renewable' ? 'Mensuel' : 'Paiement unique'}
                      {mods.length ? ` · ${mods.join(', ')}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-center text-xs text-black/35">
          Propulsé par Trainly ·{' '}
          <Link href="/" className="underline">
            Accueil
          </Link>
        </p>
      </div>
    </main>
  )
}
