import { promises as fs } from 'fs'
import path from 'path'

import { workspaceJsonPath } from './paths'
import type { SpecSectionDoc, SpecSectionId } from './types'

export type SpecSectionLoad = {
  doc: SpecSectionDoc
  mtimeMs: number
  filePath: string
}

async function tryLoad(filePath: string): Promise<SpecSectionLoad | null> {
  try {
    const [raw, stat] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)])
    return {
      doc: JSON.parse(raw) as SpecSectionDoc,
      mtimeMs: Math.trunc(stat.mtimeMs),
      filePath,
    }
  } catch {
    return null
  }
}

export async function loadSpecSectionFile(sectionId: SpecSectionId): Promise<SpecSectionLoad | null> {
  const candidates = [
    workspaceJsonPath(sectionId),
    path.resolve(process.cwd(), 'plans', 'workspace', `${sectionId}.json`),
    path.resolve(process.cwd(), '..', 'plans', 'workspace', `${sectionId}.json`),
  ]

  let lastError: unknown = null
  for (const filePath of candidates) {
    try {
      const loaded = await tryLoad(filePath)
      if (loaded) return loaded
    } catch (err) {
      lastError = err
    }
  }

  console.error(`[spec-workspace] Failed to load section "${sectionId}"`, {
    cwd: process.cwd(),
    candidates,
    lastError,
  })
  return null
}

export async function loadSpecSection(sectionId: SpecSectionId): Promise<SpecSectionDoc | null> {
  const loaded = await loadSpecSectionFile(sectionId)
  return loaded?.doc ?? null
}
