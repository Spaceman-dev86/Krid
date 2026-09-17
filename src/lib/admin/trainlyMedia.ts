/** Shared helpers for Trainly admin media uploads. */

export function storageSafeName(original: string): string {
  const trimmed = original.trim() || 'file'
  const dot = trimmed.lastIndexOf('.')
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  const ext = dot > 0 ? trimmed.slice(dot) : ''
  const asciiBase =
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120) || 'file'
  const asciiExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 20)
  return `${asciiBase}${asciiExt}`
}

export function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    !!value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    'name' in value &&
    'size' in value &&
    typeof (value as File).arrayBuffer === 'function'
  )
}

export function detectFormationMediaType(
  mime: string,
  fileName: string
): 'pdf' | 'video' | 'image' | null {
  if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return null
}

export const FORMATION_MEDIA_LABEL: Record<'pdf' | 'video' | 'image', string> = {
  pdf: 'PDF',
  video: 'Vidéo',
  image: 'Image',
}

