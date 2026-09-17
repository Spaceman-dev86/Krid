import { redirect } from 'next/navigation'

/** Création admin = pop-up infos générales sur la liste programmes. */
export default function AdminProgramsNewRedirect() {
  redirect('/admin/programs?create=1')
}
