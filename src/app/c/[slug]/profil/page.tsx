import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { countUnopenedForClient } from '../../../../lib/bilans/bilans'
import { requireClientPortal } from '../../../../lib/client-portal/context'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
}

export default async function ClientProfilPage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  let unopened = 0
  try {
    unopened = await countUnopenedForClient(supabase, ctx.client.id)
  } catch {
    unopened = 0
  }

  const name =
    [ctx.client.first_name, ctx.client.last_name].filter(Boolean).join(' ').trim() || ctx.client.email

  const links = [
    {
      href: `/c/${ctx.slug}/profil/infos`,
      title: 'Mes infos',
      subtitle: 'Compte · téléphone · naissance',
    },
    {
      href: `/c/${ctx.slug}/profil/prestations`,
      title: 'Mes prestations',
      subtitle: 'Accès · paiements · facture',
    },
    {
      href: `/c/${ctx.slug}/profil/bilans`,
      title: 'Bilans',
      subtitle: 'À remplir · historique',
      badge: unopened,
    },
  ]

  return (
    <ClientPortalShell
      slug={ctx.slug}
      appName={ctx.appName}
      primaryColor={ctx.primaryColor}
      logoUrl={ctx.logoUrl}
      profilBadgeCount={unopened}
    >
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Profil
          </h1>
          <p className="mt-1 text-sm text-black/55">{name}</p>
          <p className="text-xs text-black/40">{ctx.client.email}</p>
        </div>

        <ul className="grid gap-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="flex items-center gap-2 font-bold" style={{ color: ctx.primaryColor }}>
                    {link.title}
                    {link.badge && link.badge > 0 ? (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {link.badge}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-black/45">{link.subtitle}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: ctx.primaryColor }}>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-center text-xs text-black/40">
          Sur téléphone, tu resteras connecté. Si tu dois réinstaller l’app, demande le lien à ton coach.
        </p>
      </div>
    </ClientPortalShell>
  )
}
