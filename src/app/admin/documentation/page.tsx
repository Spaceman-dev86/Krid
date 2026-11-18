import { AdminDocumentationExplorer } from '@/src/components/documentation/AdminDocumentationExplorer'
import { DaBanner, Muted, PageTitle } from '@/src/components/ui'
import { loadDocumentationCatalog } from '@/src/lib/documentation/loadDocumentation'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; ok?: string; folder?: string }>
    | { error?: string; ok?: string; folder?: string }
}

export default async function AdminDocumentationPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()
  const { folders, itemsByFolderId, error: loadError } = await loadDocumentationCatalog(supabase)

  const okMsg =
    q.ok === 'created'
      ? 'Contenu ajouté.'
      : q.ok === 'updated'
        ? 'Contenu mis à jour.'
        : q.ok === 'deleted'
          ? 'Contenu supprimé.'
          : q.ok === 'published'
            ? 'Publié — visible côté coach.'
            : q.ok === 'unpublished'
              ? 'Dépublié — plus visible côté coach.'
              : q.ok === 'folder_created'
                ? 'Dossier créé.'
                : q.ok === 'folder_deleted'
                  ? 'Dossier supprimé.'
                  : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Documentation</PageTitle>
        <Muted className="mt-1">
          Dossiers plateforme · Formation & Contenu KRID · PDF / vidéo / image · récupérable par item
        </Muted>
      </div>

      {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}
      {okMsg ? <DaBanner tone="success" className="mt-3">{okMsg}</DaBanner> : null}
      {loadError ? (
        <DaBanner tone="warning" className="mt-3">
          Tables absentes : <code className="text-xs">{loadError}</code>
          <p className="mt-2 text-xs">
            Exécute <code>61_documentation_folders.sql</code>.
          </p>
        </DaBanner>
      ) : null}

      <div className="mt-4">
        <AdminDocumentationExplorer
          folders={folders}
          itemsByFolderId={itemsByFolderId}
          initialFolderSlug={q.folder ?? null}
        />
      </div>
    </main>
  )
}
