'use server'

import { promises as fs } from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../lib/supabase/server'
import { loadSpecSection } from '../../../lib/spec-workspace/loadSection'
import { publicImageUrl, workspaceImagesDir, workspaceJsonPath } from '../../../lib/spec-workspace/paths'
import {
  emptyBlock,
  emptyMenuPage,
  isSpecSectionId,
  type SpecFeature,
  type SpecMenuPage,
  type SpecRedirect,
  type SpecSectionId,
  type SpecTreeNode,
} from '../../../lib/spec-workspace/types'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  if (role !== 'admin') throw new Error('Accès admin requis')
  return user
}

function revalidateSection(sectionId: SpecSectionId) {
  if (sectionId === 'home') {
    revalidatePath('/admin/spec')
  } else {
    revalidatePath(`/admin/spec/${sectionId}`)
  }
}

export async function saveSpecBlock(
  sectionId: string,
  blockId: string,
  bodyHtml: string,
  critiqueHtml?: string
) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const existing = doc.blocks[blockId] ?? emptyBlock()
  doc.blocks[blockId] = {
    ...existing,
    bodyHtml,
    ...(critiqueHtml !== undefined ? { critiqueHtml } : {}),
  }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function saveSpecRedirects(sectionId: string, blockId: string, redirects: SpecRedirect[]) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const existing = doc.blocks[blockId] ?? emptyBlock()
  doc.blocks[blockId] = { ...existing, redirects }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function saveSpecMenuArrival(
  sectionId: string,
  menuId: string,
  bodyHtml: string,
  critiqueHtml?: string
) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const menu = doc.menus?.[menuId] ?? emptyMenuPage()
  menu.arrival = {
    ...menu.arrival,
    bodyHtml,
    ...(critiqueHtml !== undefined ? { critiqueHtml } : {}),
  }
  doc.menus = { ...(doc.menus ?? {}), [menuId]: menu }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function saveSpecMenuFeatures(sectionId: string, menuId: string, features: SpecFeature[]) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const menu = doc.menus?.[menuId] ?? emptyMenuPage()
  menu.features = features
  doc.menus = { ...(doc.menus ?? {}), [menuId]: menu }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

function updateTreeNodeRoute(nodes: SpecTreeNode[], nodeId: string, route: string): boolean {
  for (const node of nodes) {
    if (node.id === nodeId) {
      node.route = route
      return true
    }
    if (node.children?.length && updateTreeNodeRoute(node.children, nodeId, route)) {
      return true
    }
  }
  return false
}

export async function saveSpecTreeOrder(sectionId: string, orderedMenuIds: string[]) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const byId = new Map(doc.tree.map((n) => [n.id, n]))
  const next: SpecTreeNode[] = []
  for (const id of orderedMenuIds) {
    const node = byId.get(id)
    if (node) {
      next.push(node)
      byId.delete(id)
    }
  }
  for (const node of byId.values()) next.push(node)
  doc.tree = next

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

/** Remplace l’arbre top-level et merge des pages menu (promotion feature → menu, etc.). */
export async function saveSpecTreeAndMenuPages(
  sectionId: string,
  tree: SpecTreeNode[],
  menuPages: Record<string, SpecMenuPage>,
  opts?: { pruneMenusNotInTree?: boolean }
) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  doc.tree = tree.map((n) => ({
    id: n.id,
    label: n.label,
    route: n.route,
    kind: n.kind ?? 'menu',
  }))

  doc.menus = { ...(doc.menus ?? {}) }
  for (const [menuId, page] of Object.entries(menuPages)) {
    doc.menus[menuId] = page
  }

  if (opts?.pruneMenusNotInTree) {
    const keep = new Set(tree.map((n) => n.id))
    doc.menus = Object.fromEntries(Object.entries(doc.menus).filter(([id]) => keep.has(id)))
  }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function saveSpecMenusFeaturesBatch(
  sectionId: string,
  updates: Record<string, SpecFeature[]>
) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  doc.menus = { ...(doc.menus ?? {}) }
  for (const [menuId, features] of Object.entries(updates)) {
    const menu = doc.menus[menuId] ?? emptyMenuPage()
    menu.features = features
    doc.menus[menuId] = menu
  }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function saveSpecTreeNodeRoute(sectionId: string, nodeId: string, route: string) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const ok = updateTreeNodeRoute(doc.tree, nodeId, route.trim())
  if (!ok) throw new Error('Nœud introuvable dans l’arbre')

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const }
}

export async function uploadSpecMenuArrivalImage(sectionId: string, menuId: string, formData: FormData) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('Fichier manquant')

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) throw new Error('Format non supporté (png, jpg, webp, gif)')

  const maxBytes = 8 * 1024 * 1024
  if (file.size > maxBytes) throw new Error('Image trop lourde (max 8 Mo)')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg'

  const filename = `menu-${menuId}-arrival-${Date.now()}.${ext}`
  const dir = workspaceImagesDir(sectionId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))

  const url = publicImageUrl(sectionId, filename)
  const menu = doc.menus?.[menuId] ?? emptyMenuPage()
  menu.arrival = {
    ...menu.arrival,
    images: [...(menu.arrival.images ?? []), url],
  }
  doc.menus = { ...(doc.menus ?? {}), [menuId]: menu }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const, url }
}

export async function uploadSpecImage(sectionId: string, blockId: string, formData: FormData) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Fichier manquant')
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    throw new Error('Format non supporté (png, jpg, webp, gif)')
  }

  const maxBytes = 8 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error('Image trop lourde (max 8 Mo)')
  }

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg'

  const filename = `${blockId}-${Date.now()}.${ext}`
  const dir = workspaceImagesDir(sectionId)
  await fs.mkdir(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(dir, filename), buffer)

  const url = publicImageUrl(sectionId, filename)
  const existing = doc.blocks[blockId] ?? emptyBlock()
  doc.blocks[blockId] = {
    ...existing,
    images: [...existing.images, url],
  }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  revalidateSection(sectionId)
  return { ok: true as const, url }
}

export async function removeSpecImage(sectionId: string, blockId: string, imageUrl: string) {
  await assertAdmin()
  if (!isSpecSectionId(sectionId)) throw new Error('Section invalide')

  const doc = await loadSpecSection(sectionId)
  if (!doc) throw new Error('Section introuvable')

  const existing = doc.blocks[blockId]
  if (!existing) throw new Error('Bloc introuvable')

  doc.blocks[blockId] = {
    ...existing,
    images: existing.images.filter((u) => u !== imageUrl),
  }

  await fs.writeFile(workspaceJsonPath(sectionId), JSON.stringify(doc, null, 2) + '\n', 'utf8')

  if (imageUrl.startsWith(`/plans/workspace/${sectionId}/`)) {
    const filename = imageUrl.split('/').pop()
    if (filename) {
      try {
        await fs.unlink(path.join(workspaceImagesDir(sectionId), filename))
      } catch {
        // ignore
      }
    }
  }

  revalidateSection(sectionId)
  return { ok: true as const }
}
