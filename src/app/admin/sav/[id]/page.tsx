import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageTitle, Muted, Button, DaBanner, Eyebrow, daFieldClass } from '@/src/components/ui'
import { CATEGORY_LABEL, STATUS_LABEL } from '../../../../lib/admin/supportLabels'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'
import {
  replyTicketAction,
  updateTicketStatusAction,
  openAdminSupportAttachmentAction,
  closeTicketAction,
  reopenTicketAction,
  nudgeCoachAction,
} from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; ok?: string }>
    | { error?: string; ok?: string }
}

export default async function AdminSavTicketPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, subject, status, category, created_at, coach_id, profiles:coach_id(email, full_name)')
    .eq('id', id)
    .maybeSingle()

  if (!ticket) notFound()

  await supabase
    .from('support_tickets')
    .update({ admin_last_read_at: new Date().toISOString() })
    .eq('id', id)

  const { data: messages } = await supabase
    .from('support_messages')
    .select('id, body, sender_role, created_at, sender_id, attachment_path, attachment_name')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const coach = ticket.profiles as unknown as { email?: string; full_name?: string } | null
  const isResolved = ticket.status === 'resolu'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <Link href="/admin/sav" className="text-sm font-semibold text-[color:var(--brand)] hover:underline">
        ← Inbox SAV
      </Link>

      <div className="mt-4">
        <PageTitle>{ticket.subject}</PageTitle>
        <Muted className="mt-1">
          <Link href={`/admin/coaches/${ticket.coach_id}`} className="font-semibold underline">
            {coach?.full_name || coach?.email || ticket.coach_id}
          </Link>{' '}
          · {CATEGORY_LABEL[ticket.category] || ticket.category} ·{' '}
          <span className="font-bold text-[var(--brand)]">{STATUS_LABEL[ticket.status] || ticket.status}</span>
        </Muted>
      </div>

      {q.error ? <DaBanner tone="danger" className="mt-4">{q.error}</DaBanner> : null}
      {q.ok === 'closed' ? <DaBanner tone="success" className="mt-4">Ticket fermé (résolu).</DaBanner> : null}
      {q.ok === 'reopened' ? <DaBanner tone="success" className="mt-4">Ticket rouvert.</DaBanner> : null}
      {q.ok === 'nudged' ? (
        <DaBanner tone="success" className="mt-4">Coach relancé — statut Attente coach.</DaBanner>
      ) : null}

      <section className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        <Eyebrow>Actions</Eyebrow>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isResolved ? (
            <>
              <form action={closeTicketAction}>
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Fermer
                </Button>
              </form>
              <form action={nudgeCoachAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <input
                  name="nudge_note"
                  placeholder="Note de relance (optionnel)"
                  className={`${daFieldClass} min-w-[12rem] py-2`}
                />
                <Button type="submit" size="sm">
                  Relancer le coach
                </Button>
              </form>
            </>
          ) : (
            <form action={reopenTicketAction}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <Button type="submit" size="sm">
                Rouvrir
              </Button>
            </form>
          )}
          <Button href={`/admin/sav?coach=${ticket.coach_id}`} variant="secondary" size="sm">
            Tickets de ce coach
          </Button>
        </div>

        <form action={updateTicketStatusAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Statut manuel
            <select name="status" defaultValue={ticket.status} className={`${daFieldClass} min-w-[10rem]`}>
              <option value="nouveau">Nouveau</option>
              <option value="en_cours">En cours</option>
              <option value="attente_coach">Attente coach</option>
              <option value="resolu">Résolu</option>
            </select>
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Mettre à jour
          </Button>
        </form>
      </section>

      <ul className="mt-8 grid gap-3">
        {(messages || []).map((m) => (
          <li
            key={m.id}
            className={
              m.sender_role === 'admin'
                ? 'rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] px-4 py-3'
                : 'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3'
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              {m.sender_role === 'admin' ? 'Admin' : 'Coach'} ·{' '}
              {new Date(m.created_at).toLocaleString('fr-FR')}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{m.body}</p>
            {m.attachment_path ? (
              <form action={openAdminSupportAttachmentAction} className="mt-2">
                <input type="hidden" name="path" value={m.attachment_path} />
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <button type="submit" className="text-xs font-bold text-[var(--brand)] underline">
                  {m.attachment_name || 'Pièce jointe'}
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {!messages?.length ? (
          <li className="text-sm text-[color:var(--muted)]">Aucun message encore.</li>
        ) : null}
      </ul>

      {isResolved ? (
        <DaBanner tone="warning" className="mt-6">
          Ticket résolu — rouvre-le pour répondre ou relancer.
        </DaBanner>
      ) : (
        <form
          action={replyTicketAction}
          className="mt-6 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
        >
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Répondre (in-app)
            <textarea
              name="body"
              rows={4}
              className={daFieldClass}
              placeholder="Réponse visible par le coach dans l’app…"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Pièce jointe
            <input
              name="attachment"
              type="file"
              accept="image/*,application/pdf,video/mp4,video/webm"
              className="text-sm font-normal text-[color:var(--muted)]"
            />
          </label>
          <Button type="submit" size="sm" className="justify-self-start">
            Envoyer
          </Button>
        </form>
      )}
    </main>
  )
}
