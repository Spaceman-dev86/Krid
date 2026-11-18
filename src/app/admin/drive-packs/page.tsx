import { redirect } from 'next/navigation'

/** Legacy — biblio Drive Trainly unifiée dans Documentation (Contenu KRID). */
export default function AdminDrivePacksRedirectPage() {
  redirect('/admin/documentation?folder=contenu-krid')
}
