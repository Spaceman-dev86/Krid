import Link from 'next/link'

import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../lib/client-portal/context'
import {
  countUnopenedForClient,
  listInstancesForClient,
  statusLabel,
} from '../../../../../lib/bilans/bilans'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function ClientBilansPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  let instances: Awaited<ReturnType<typeof listInstancesForClient>> = []
  let unopened = 0
  let loadError: string | null = null
  try {
    instances = await listInstancesForClient(supabase, ctx.client.id)
    unopened = await countUnopenedForClient(supabase, ctx.client.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

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
          <Link href={`/c/${ctx.slug}/profil`} className="text-sm font-semibold" style={{ color: ctx.primaryColor }}>
            ← Profil
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Bilans
          </h1>
          <p className="mt-1 text-sm text-black/55">À remplir · soumis · verrouillés</p>
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}

        {!instances.length && !loadError ? (
          <p className="text-sm text-black/45">Aucun bilan pour l’instant.</p>
        ) : (
          <ul className="grid gap-2">
            {instances.map((inst) => (
              <li key={inst.id}>
                <Link
                  href={`/c/${ctx.slug}/profil/bilans/${inst.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a1220]">
                      {!inst.client_opened_at ? '• ' : ''}
                      {inst.title}
                    </p>
                    <p className="text-xs text-black/40">
                      Avant le {new Date(inst.due_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold">
                    {statusLabel(inst.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClientPortalShell>
  )
}
