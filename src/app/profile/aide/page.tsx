import { redirect } from 'next/navigation'

type Props = {
  searchParams?:
    | Promise<{ error?: string; created?: string; ticket?: string }>
    | { error?: string; created?: string; ticket?: string }
}

/** Legacy route → Settings SAV */
export default async function CoachAideRedirectPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const params = new URLSearchParams()
  if (q.error) params.set('error', q.error)
  if (q.created) params.set('created', q.created)
  if (q.ticket) params.set('ticket', q.ticket)
  const qs = params.toString()
  redirect(qs ? `/settings/support?${qs}` : '/settings/support')
}
