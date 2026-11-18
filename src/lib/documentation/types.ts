export type DocMediaType = 'pdf' | 'video' | 'image'

export type DocFolder = {
  id: string
  slug: string
  title: string
  description: string | null
  sortOrder: number
  isSystem: boolean
  /** Documents visibles coach (= publiés si catalogue filtré). */
  itemCount: number
  /** Brouillons admin (0 côté coach). */
  draftCount: number
}

export type DocItem = {
  id: string
  folderId: string
  title: string
  description: string | null
  mediaType: DocMediaType
  allowDuplicate: boolean
  published?: boolean
  sizeBytes: number | null
  createdAt: string
  storageBucket?: 'trainly-formation' | 'trainly-library'
}
