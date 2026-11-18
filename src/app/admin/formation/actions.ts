'use server'

import { redirect } from 'next/navigation'

/** @deprecated → /admin/documentation */
export async function createFormationItemAction() {
  redirect('/admin/documentation?folder=formation')
}

/** @deprecated */
export async function updateFormationItemAction() {
  redirect('/admin/documentation?folder=formation')
}

/** @deprecated */
export async function deleteFormationItemAction() {
  redirect('/admin/documentation?folder=formation')
}

/** @deprecated */
export async function setFormationPublishedAction() {
  redirect('/admin/documentation?folder=formation')
}

/** @deprecated */
export async function previewFormationItemAction() {
  redirect('/admin/documentation?folder=formation')
}
