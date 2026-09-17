import path from 'path'

import type { SpecSectionId } from './types'

export function workspaceJsonPath(sectionId: SpecSectionId) {
  return path.join(process.cwd(), 'plans', 'workspace', `${sectionId}.json`)
}

export function workspaceImagesDir(sectionId: SpecSectionId) {
  return path.join(process.cwd(), 'public', 'plans', 'workspace', sectionId)
}

export function publicImageUrl(sectionId: SpecSectionId, filename: string) {
  return `/plans/workspace/${sectionId}/${filename}`
}
