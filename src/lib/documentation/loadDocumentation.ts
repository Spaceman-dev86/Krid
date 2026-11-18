import { chatDb } from '@/src/lib/chat/chat'
import type { DocFolder, DocItem } from '@/src/lib/documentation/types'

type LoadOpts = {
  publishedOnly?: boolean
}

export async function loadDocumentationCatalog(
  supabase: unknown,
  opts: LoadOpts = {},
): Promise<{
  folders: DocFolder[]
  itemsByFolderId: Record<string, DocItem[]>
  error: string | null
}> {
  const db = chatDb(supabase)
  const publishedOnly = opts.publishedOnly === true

  let itemsQuery = db
    .from('documentation_items')
    .select(
      'id, folder_id, title, description, media_type, allow_duplicate, published, size_bytes, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(publishedOnly ? 200 : 500)

  if (publishedOnly) itemsQuery = itemsQuery.eq('published', true)

  const [{ data: folderRows, error: folderError }, { data: itemRows, error: itemError }] =
    await Promise.all([
      db
        .from('documentation_folders')
        .select('id, slug, title, description, sort_order, is_system')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true }),
      itemsQuery,
    ])

  const itemsByFolderId: Record<string, DocItem[]> = {}
  const draftCountByFolder: Record<string, number> = {}

  for (const row of itemRows ?? []) {
    const list = itemsByFolderId[row.folder_id] ?? []
    list.push({
      id: row.id,
      folderId: row.folder_id,
      title: row.title,
      description: row.description,
      mediaType: (row.media_type as DocItem['mediaType']) || 'pdf',
      allowDuplicate: row.allow_duplicate !== false,
      published: row.published,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
    })
    itemsByFolderId[row.folder_id] = list
    if (row.published === false) {
      draftCountByFolder[row.folder_id] = (draftCountByFolder[row.folder_id] ?? 0) + 1
    }
  }

  // Admin : itemCount = publiés (aligné coach) ; brouillons à part.
  // Coach (publishedOnly) : tous les items chargés sont publiés.
  const folders: DocFolder[] = (folderRows ?? []).map(
    (f: {
      id: string
      slug: string
      title: string
      description: string | null
      sort_order: number
      is_system: boolean
    }) => {
      const all = itemsByFolderId[f.id] ?? []
      const drafts = publishedOnly ? 0 : (draftCountByFolder[f.id] ?? 0)
      const published = publishedOnly ? all.length : all.length - drafts
      return {
        id: f.id,
        slug: f.slug,
        title: f.title,
        description: f.description,
        sortOrder: f.sort_order,
        isSystem: f.is_system,
        itemCount: published,
        draftCount: drafts,
      }
    },
  )

  return {
    folders,
    itemsByFolderId,
    error: folderError?.message || itemError?.message || null,
  }
}
