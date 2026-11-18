'use server'

import { redirect } from 'next/navigation'

/** @deprecated → /admin/documentation (Contenu KRID) */
export async function createDrivePackAction() {
  redirect('/admin/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function updateDrivePackAction() {
  redirect('/admin/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function deleteDrivePackAction() {
  redirect('/admin/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function setDrivePackPublishedAction() {
  redirect('/admin/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function previewDrivePackAction() {
  redirect('/admin/documentation?folder=contenu-krid')
}
