const MAX_COVER_EDGE = 1600
const TARGET_MAX_BYTES = 900_000

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Impossible de lire cette image.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

/**
 * Redimensionne et compresse une couverture pour rester sous la limite Server Action (~1 Mo).
 * Les GIF animés sont conservés tels quels.
 */
export async function compressProgramCoverImage(file: File): Promise<File> {
  if (file.type === 'image/gif') {
    return file
  }

  if (file.size <= TARGET_MAX_BYTES && file.type === 'image/jpeg') {
    return file
  }

  const img = await loadImageElement(file)
  const scale = Math.min(1, MAX_COVER_EDGE / img.naturalWidth, MAX_COVER_EDGE / img.naturalHeight)
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.drawImage(img, 0, 0, width, height)

  let quality = 0.88
  let blob: Blob | null = null

  while (quality >= 0.55) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!blob) break
    if (blob.size <= TARGET_MAX_BYTES) break
    quality -= 0.08
  }

  if (!blob) return file

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'couverture'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
