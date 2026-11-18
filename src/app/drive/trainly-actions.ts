'use server'

import { redirect } from 'next/navigation'

/** @deprecated Surface Trainly Drive → /documentation */
export async function openTrainlyPackAction() {
  redirect('/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function downloadTrainlyPackAction() {
  redirect('/documentation?folder=contenu-krid')
}

/** @deprecated */
export async function duplicateTrainlyPackAction() {
  redirect('/documentation?folder=contenu-krid')
}
