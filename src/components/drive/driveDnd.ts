export const DRIVE_DND_MIME = 'application/x-trainly-drive'

export type DriveDndPayload = {
  kind: 'file' | 'folder'
  id: string
}

export function encodeDriveDnd(payload: DriveDndPayload): string {
  return JSON.stringify(payload)
}

export function decodeDriveDnd(raw: string | undefined | null): DriveDndPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DriveDndPayload
    if ((parsed.kind === 'file' || parsed.kind === 'folder') && typeof parsed.id === 'string' && parsed.id) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

export function readDriveDnd(dt: DataTransfer): DriveDndPayload | null {
  return decodeDriveDnd(dt.getData(DRIVE_DND_MIME) || dt.getData('text/plain'))
}

/** Empêche cycle : ne pas drop un dossier sur lui-même ni un descendant (client-side via moveTargets tree). */
export function wouldCreateFolderCycle(
  draggedFolderId: string,
  targetFolderId: string | null,
  moveTargets: { id: string; parent_id: string | null }[],
): boolean {
  if (!targetFolderId) return false
  if (draggedFolderId === targetFolderId) return true
  const parentOf = new Map(moveTargets.map((t) => [t.id, t.parent_id]))
  let cur: string | null = targetFolderId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    if (cur === draggedFolderId) return true
    guard.add(cur)
    cur = parentOf.get(cur) ?? null
  }
  return false
}
