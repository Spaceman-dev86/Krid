import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal, requirePortalModule } from '../../../../lib/client-portal/context'
import {
  createSignedDownloadUrl,
  formatBytes,
  isPreviewableMime,
  listSharedFilesForClient,
} from '../../../../lib/drive/drive'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
}

export default async function ClientDrivePage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)
  requirePortalModule(ctx, 'drive')

  let files: Awaited<ReturnType<typeof listSharedFilesForClient>> = []
  let loadError: string | null = null
  try {
    files = await listSharedFilesForClient(supabase, ctx.client.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  // Accès déjà filtré par listSharedFilesForClient → signed URL via service role
  const withUrls = await Promise.all(
    files.map(async (f) => ({
      ...f,
      url: await createSignedDownloadUrl(supabase, f.storage_path),
    }))
  )

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Docs
          </h1>
          <p className="mt-1 text-sm text-black/55">Fichiers partagés par ton coach · lecture seule</p>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {loadError}
          </div>
        ) : null}

        {!withUrls.length && !loadError ? (
          <p className="text-sm text-black/45">Aucun document partagé pour l’instant.</p>
        ) : (
          <ul className="grid gap-2">
            {withUrls.map((f) => {
              const canPreview = isPreviewableMime(f.mime_type, f.name)
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a1220]">{f.name}</p>
                    <p className="text-xs text-black/40">{formatBytes(f.size_bytes)}</p>
                  </div>
                  {f.url ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {canPreview ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                          style={{ backgroundColor: ctx.primaryColor }}
                        >
                          Ouvrir
                        </a>
                      ) : null}
                      <a
                        href={f.url}
                        download={f.name}
                        className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-[#1a1220]"
                      >
                        Télécharger
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-black/35">Indisponible</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Link
          href={`/c/${ctx.slug}/home`}
          className="text-center text-sm font-semibold"
          style={{ color: ctx.primaryColor }}
        >
          ← Accueil
        </Link>
      </div>
    </ClientPortalShell>
  )
}
