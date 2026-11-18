import { chatDb } from '../chat/chat'
import {
  buildBreadcrumbFromTree,
  getFolder,
  listFiles,
  listFolders,
  type DriveFileRow,
  type DriveFolderOption,
  type DriveFolderRow,
  type DriveShareInfo,
} from './drive'

export type CoachDrivePageData = {
  folder: DriveFolderRow | null
  folders: DriveFolderRow[]
  files: DriveFileRow[]
  moveTargets: DriveFolderOption[]
  sharesByFile: Record<string, DriveShareInfo[]>
  sharesByFolder: Record<string, DriveShareInfo[]>
  fileCountsByFolder: Record<string, number>
  sizeBytesByFolder: Record<string, number>
  fileNamesByFolder: Record<string, { id: string; name: string }[]>
  searchFolders: DriveFolderRow[]
  searchFiles: DriveFileRow[]
  breadcrumb: { id: string | null; name: string }[]
  clients: { id: string; label: string }[]
  groups: { id: string; label: string }[]
}

function logDrive(t0: number, label: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[drive-load] ${label} +${Date.now() - t0}ms`)
  }
}

/**
 * Chemin critique uniquement : dossier courant + enfants + arbre léger (DnD/breadcrumb).
 * Clients / shares : chargés côté client après paint (voir loadDriveAuxAction).
 */
export async function loadCoachDrivePageData(
  supabase: unknown,
  coachId: string,
  folderId: string | null,
  _searchNeedle: string,
): Promise<CoachDrivePageData> {
  const t0 = Date.now()
  const db = chatDb(supabase)

  const folderP = folderId ? getFolder(supabase, folderId) : Promise.resolve(null)
  const treeP = db
    .from('drive_folders')
    .select('id, parent_id, name')
    .eq('coach_id', coachId)
    .is('deleted_at', null)

  const [folder, folders, files, treeRes] = await Promise.all([
    folderP,
    listFolders(supabase, coachId, folderId),
    listFiles(supabase, coachId, folderId),
    treeP,
  ])
  logDrive(t0, 'core folders/files/tree')

  if (folderId && (!folder || folder.coach_id !== coachId)) {
    throw new Error('Dossier introuvable')
  }
  if (treeRes.error) throw new Error(treeRes.error.message)

  const tree = (treeRes.data ?? []) as { id: string; parent_id: string | null; name: string }[]
  /** Labels courts = name seul (pas de path O(n²) à chaque hop). */
  const moveTargets: DriveFolderOption[] = tree.map((r) => ({
    id: r.id,
    name: r.name,
    parent_id: r.parent_id,
    label: r.name,
  }))

  // Stats badges : différées côté client (loadDriveAux) — paint listings sans attendre.
  const breadcrumb = folderId
    ? buildBreadcrumbFromTree(folderId, tree)
    : [{ id: null, name: 'Drive' }]

  logDrive(t0, 'TOTAL')

  return {
    folder,
    folders,
    files,
    moveTargets,
    sharesByFile: {},
    sharesByFolder: {},
    fileCountsByFolder: {},
    sizeBytesByFolder: {},
    fileNamesByFolder: {},
    searchFolders: [],
    searchFiles: [],
    breadcrumb,
    clients: [],
    groups: [],
  }
}
