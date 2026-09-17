import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { hasPortalModule, requireClientPortal } from '../../../../lib/client-portal/context'
import { formatPriceCents, parseModules } from '../../../../lib/prestations/modules'
import { createClient } from '../../../../lib/supabase/server'
import { startCoachDmAction } from '../messages/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
}

export default async function ClientCoachPage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name, description, price_cents, pricing_type, modules')
    .eq('coach_id', ctx.coachId)
    .eq('showroom_visible', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return (
    <ClientPortalShell
      slug={ctx.slug}
      appName={ctx.appName}
      primaryColor={ctx.primaryColor}
      logoUrl={ctx.logoUrl}
    >
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          {ctx.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ctx.logoUrl}
              alt=""
              className="h-14 w-14 rounded-full border border-black/10 object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: ctx.primaryColor }}
            >
              {ctx.appName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
              Coach
            </h1>
            <p className="mt-1 text-sm text-black/55">Offres &amp; showroom · {ctx.appName}</p>
          </div>
        </div>

        <div className="grid gap-2">
          {hasPortalModule(ctx, 'messaging') ? (
            <>
              <form action={startCoachDmAction}>
                <input type="hidden" name="slug" value={ctx.slug} />
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: ctx.primaryColor }}
                >
                  Écrire au coach
                </button>
              </form>
              <Link
                href={`/c/${ctx.slug}/messages`}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold shadow-sm"
                style={{ color: ctx.primaryColor }}
              >
                Boîte Messages →
              </Link>
            </>
          ) : null}
          <Link
            href={`/c/${ctx.slug}/calendrier`}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold shadow-sm"
            style={{ color: ctx.primaryColor }}
          >
            RDV — demandes &amp; file →
          </Link>
          <Link
            href={`/c/${ctx.slug}/showroom`}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold shadow-sm"
            style={{ color: ctx.primaryColor }}
          >
            Voir le showroom public →
          </Link>
        </div>

        {!prestations?.length ? (
          <p className="text-sm text-black/45">Aucune offre publiée.</p>
        ) : (
          <ul className="grid gap-3">
            {prestations.map((p) => {
              const mods = parseModules(p.modules)
              return (
                <li key={p.id}>
                  <Link
                    href={`/c/${ctx.slug}/showroom/${p.id}`}
                    className="block rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-extrabold" style={{ color: ctx.primaryColor }}>
                        {p.name}
                      </p>
                      <p className="text-sm font-bold">{formatPriceCents(p.price_cents)}</p>
                    </div>
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-black/55">{p.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-black/40">
                      {p.pricing_type === 'renewable' ? 'Mensuel' : 'Unique'}
                      {mods.length ? ` · ${mods.join(', ')}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ClientPortalShell>
  )
}
