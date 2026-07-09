'use client'

import { memo, useEffect, useRef, useState, type DragEvent } from 'react'

import { validateProgramCoverFile } from '../../lib/validateProgramCoverFile'

type Props = {
  inputId: string
  currentImageUrl?: string | null
  onFileChange: (file: File | null) => void
  onValidationError: (message: string | null) => void
}

function ProgramCoverImagePickerInner({
  inputId,
  currentImageUrl,
  onFileChange,
  onValidationError,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function applyFile(file: File | null) {
    onValidationError(null)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)

    if (!file) {
      setPreviewUrl(null)
      setSelectedFile(null)
      onFileChange(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const validation = validateProgramCoverFile(file)
    if (!validation.ok) {
      onValidationError(validation.error)
      setPreviewUrl(null)
      setSelectedFile(null)
      onFileChange(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const nextPreview = URL.createObjectURL(file)
    setPreviewUrl(nextPreview)
    setSelectedFile(file)
    onFileChange(file)
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0] ?? null
    applyFile(file)
  }

  const displayUrl = previewUrl ?? (selectedFile ? null : String(currentImageUrl ?? '').trim() || null)

  return (
    <div className="mt-4">
      <label
        htmlFor={inputId}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition',
          isDragOver
            ? 'border-[var(--brand)] bg-[var(--accent)]/40'
            : 'border-gray-200 bg-gray-50 hover:border-[var(--brand)] hover:bg-[var(--accent)]/30',
        ].join(' ')}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
        ) : (
          <div className="text-sm font-semibold text-gray-600">
            {isDragOver ? 'Dépose la photo ici' : 'Clique ou glisse une image ici'}
          </div>
        )}
        <span className="text-xs text-gray-500">JPG, PNG, WebP ou GIF · max 5 Mo · optimisée automatiquement</span>
      </label>
      <input
        ref={fileInputRef}
        id={inputId}
        name="coverImage"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

export default memo(ProgramCoverImagePickerInner)
