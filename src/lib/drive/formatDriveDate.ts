/** Date courte FR pour listes Drive / Documentation. */
export function formatDriveDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export type DriveMediaKind = 'folder' | 'pdf' | 'image' | 'video' | 'other'

export function driveMediaKind(mime: string | null | undefined, name?: string): DriveMediaKind {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.includes('pdf') || (name || '').toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'other'
}

export function driveMediaLabel(kind: DriveMediaKind): string {
  if (kind === 'folder') return 'Dossier'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'image') return 'Image'
  if (kind === 'video') return 'Vidéo'
  return 'Fichier'
}
