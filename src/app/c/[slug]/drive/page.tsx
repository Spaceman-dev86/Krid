import Link from 'next/link'
import { Suspense } from 'react'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { PortalDriveLink, PortalDrivePending } from '../../../../components/client-portal/PortalDrivePending'
import {
  portalShellProps,
  requireClientPortal,
  requirePortalModule,
} from '../../../../lib/client-portal/context'
import {
  createSignedDownloadUrl,
  formatBytes,
  isPreviewableMime,
  loadClientDriveTree,
} from '../../../../lib/drive/drive'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?: Promise<{ folder?: string }> | { folder?: string }
}

export default async function ClientDrivePage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const sp = await Promise.resolve(searchParams ?? {})
  const folderParam = (sp.folder ?? '').trim() || null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)
  requirePortalModule(ctx, 'drive')

  let tree: Awaited<ReturnType<typeof loadClientDriveTree>> | null = null
  let loadError: string | null = null
  try {
    tree = await loadClientDriveTree(supabase, ctx.client.id, folderParam)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  const filesWithUrls = tree
    ? await Promise.all(
        tree.files.map(async (f) => ({
          ...f,
          url: await createSignedDownloadUrl(supabase, f.storage_path),
        })),
      )
    : []

  const base = `/c/${ctx.slug}/drive`

  return (
    <ClientPortalShell {...portalShellProps(ctx)}>
      <Suspense fallback={null}>
        <PortalDrivePending>
          <div className="grid gap-5">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
                Docs
              </h1>
              <p className="mt-1 text-sm text-black/55">Fichiers partagés par ton coach · lecture seule</p>
            </div>

            {tree ? (
              <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold text-black/45">
                {tree.breadcrumb.map((b, i) => (
                  <span key={`${b.id}-${i}`} className="flex items-center gap-1">
                    {i > 0 ? <span>/</span> : null}
                    {b.id ? (
                      <PortalDriveLink
                        href={`${base}?folder=${b.id}`}
                        className="hover:underline"
                        style={{ color: ctx.primaryColor }}
                      >
                        {b.name}
                      </PortalDriveLink>
                    ) : (
                      <PortalDriveLink href={base} className="hover:underline" style={{ color: ctx.primaryColor }}>
                        {b.name}
                      </PortalDriveLink>
                    )}
                  </span>
                ))}
                {tree.folderName ? (
                  <span className="flex items-center gap-1">
                    <span>/</span>
                    <span className="text-[#1a1220]">{tree.folderName}</span>
                  </span>
                ) : null}
              </nav>
            ) : null}

            {tree?.folderId ? (
              <PortalDriveLink
                href={tree.parentId ? `${base}?folder=${tree.parentId}` : base}
                className="inline-flex w-fit text-sm font-semibold hover:underline"
                style={{ color: ctx.primaryColor }}
              >
                ← Retour
              </PortalDriveLink>
            ) : null}

            {loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {loadError}
              </div>
            ) : null}

            {tree && !tree.folders.length && !filesWithUrls.length && !loadError ? (
              <p className="text-sm text-black/45">
                {tree.folderId ? 'Ce dossier est vide.' : 'Aucun document partagé pour l’instant.'}
              </p>
            ) : null}

            {tree?.folders.length ? (
              <section className="grid gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/40">Dossiers</h2>
                <ul className="grid gap-2">
                  {tree.folders.map((f) => (
                    <li key={f.id}>
                      <PortalDriveLink
                        href={`${base}?folder=${f.id}`}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
                      >
                        <span className="truncate font-semibold text-[#1a1220]">📁 {f.name}</span>
                        <span className="text-xs font-bold" style={{ color: ctx.primaryColor }}>
                          Ouvrir →
                        </span>
                      </PortalDriveLink>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {filesWithUrls.length ? (
              <section className="grid gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/40">Fichiers</h2>
                <ul className="grid gap-2">
                  {filesWithUrls.map((f) => {
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
              </section>
            ) : null}

            <Link href={`/c/${ctx.slug}/home`} className="text-center text-sm font-semibold" style={{ color: ctx.primaryColor }}>
              ← Accueil
            </Link>
          </div>
        </PortalDrivePending>
      </Suspense>
    </ClientPortalShell>
  )
}
