import { redirect } from 'next/navigation'

/** Legacy — Formation admin unifiée dans Documentation. */
export default function AdminFormationRedirectPage() {
  redirect('/admin/documentation?folder=formation')
}
