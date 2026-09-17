/** Crop / compress image in the browser (no deps). */

export type CropViewState = {
  /** Image offset in view coords (px) — top-left of image relative to crop frame */
  offsetX: number
  offsetY: number
  /** Scale of natural image inside the frame */
  scale: number
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Impossible de charger l’image.'))
    // blob:/data: : pas de CORS. https : anonymous pour pouvoir exporter en canvas.
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous'
    img.src = src
  })
}

/** Télécharge une URL distante en blob: local (évite fond blanc / CORS au recadrage). */
export async function toEditableObjectUrl(src: string): Promise<string> {
  if (src.startsWith('blob:') || src.startsWith('data:')) return src

  async function blobFrom(url: string) {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error('Impossible de télécharger l’image.')
    return res.blob()
  }

  try {
    const blob = await blobFrom(src)
    return URL.createObjectURL(blob)
  } catch {
    // Fallback serveur si CORS bloque le fetch navigateur
    const proxy = `/api/proxy-image?url=${encodeURIComponent(src)}`
    const blob = await blobFrom(proxy)
    return URL.createObjectURL(blob)
  }
}

/** Scale so the image always covers the crop frame. */
export function coverScale(imgW: number, imgH: number, frameW: number, frameH: number) {
  return Math.max(frameW / imgW, frameH / imgH)
}

export function clampOffsets(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const drawW = imgW * scale
  const drawH = imgH * scale
  const minX = frameW - drawW
  const minY = frameH - drawH
  return {
    offsetX: Math.min(0, Math.max(minX, offsetX)),
    offsetY: Math.min(0, Math.max(minY, offsetY)),
  }
}

export async function exportCroppedJpeg(opts: {
  source: string
  frameW: number
  frameH: number
  offsetX: number
  offsetY: number
  scale: number
  /** Output pixel width (height derived from frame aspect) */
  outputWidth: number
  quality?: number
}): Promise<Blob> {
  const img = await loadImage(opts.source)
  const aspect = opts.frameH / opts.frameW
  const outW = Math.round(opts.outputWidth)
  const outH = Math.round(outW * aspect)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible.')

  const sx = -opts.offsetX / opts.scale
  const sy = -opts.offsetY / opts.scale
  const sw = opts.frameW / opts.scale
  const sh = opts.frameH / opts.scale

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

  const quality = opts.quality ?? 0.85
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  )
  if (!blob) throw new Error('Export image impossible.')
  return blob
}
