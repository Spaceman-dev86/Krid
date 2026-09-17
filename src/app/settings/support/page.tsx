import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  Button,
  PageTitle,
  Muted,
  Eyebrow,
  DaBanner,
  daFieldClass,
} from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { SettingsSubnav } from '../../../components/coach/SettingsSubnav'
import { CATEGORY_LABEL, STATUS_LABEL } from '../../../lib/admin/supportLabels'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import {
  createSupportTicketAction,
  openSupportAttachmentAction,
  replySupportTicketAsCoachAction,
} from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; created?: string; ticket?: string }>
    | { error?: string; created?: string; ticket?: string }
}

export default async function CoachSupportPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('id, subject, status, category, created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const focusId = q.ticket || q.created || null
  if (focusId) {
    await supabase
      .from('support_tickets')
      .update({ coach_last_read_at: new Date().toISOString() })
      .eq('id', focusId)
      .eq('coach_id', user.id)
  }

  const { data: messages } = focusId
    ? await supabase
        .from('support_messages')
        .select('id, body, sender_role, created_at, attachment_path, attachment_name')
        .eq('ticket_id', focusId)
        .order('created_at', { ascending: true })
    : { data: null }

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Aide / SAV"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Paramètres</Eyebrow>
            <PageTitle className="mt-2 text-2xl">Aide / feedback</PageTitle>
            <Muted className="mt-1">Réponses admin in-app · pièces jointes</Muted>
          </div>
          <SettingsSubnav savUnread={shell.savUnread} />
        </div>

        {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}
        {q.created ? <DaBanner tone="success">Ticket créé.</DaBanner> : null}
        {error ? (
          <DaBanner tone="warning">
            SAV pas encore dispo en base — tranche <code>33</code> / <code>35</code>.
          </DaBanner>
        ) : null}

        <form
          action={createSupportTicketAction}
          className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
        >
          <Eyebrow>Nouveau ticket</Eyebrow>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Sujet
            <input name="subject" required minLength={3} className={daFieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Catégorie
            <select name="category" defaultValue="autre" className={daFieldClass}>
              <option value="bug">Bug</option>
              <option value="billing">Facturation</option>
              <option value="compte">Compte</option>
              <option value="produit">Produit</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Message
            <textarea name="body" rows={4} className={daFieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Pièce jointe (optionnel)
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

        <section className="grid gap-2">
          <Eyebrow>Mes tickets</Eyebrow>
          {!tickets?.length ? (
            <Muted>Aucun ticket pour l’instant.</Muted>
          ) : (
            <ul className="grid gap-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/settings/support?ticket=${t.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-da-sm transition hover:bg-[var(--accent)]"
                  >
                    <div>
                      <p className="font-bold text-[var(--brand)]">{t.subject}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {CATEGORY_LABEL[t.category] || t.category} ·{' '}
                        {new Date(t.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)] ring-1 ring-[var(--border)]">
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {focusId ? (
          <section className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
            <Eyebrow>Fil du ticket</Eyebrow>
            <ul className="grid gap-2">
              {(messages || []).map((m) => (
                <li
                  key={m.id}
                  className={
                    m.sender_role === 'admin'
                      ? 'rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] px-3 py-2 text-sm'
                      : 'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm'
                  }
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                    {m.sender_role === 'admin' ? 'Admin Trainly' : 'Toi'} ·{' '}
                    {new Date(m.created_at).toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[color:var(--fg)]">{m.body}</p>
                  {m.attachment_path ? (
                    <form action={openSupportAttachmentAction} className="mt-2">
                      <input type="hidden" name="path" value={m.attachment_path} />
                      <Button type="submit" variant="link" size="sm">
                        {m.attachment_name || 'Pièce jointe'}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            <form action={replySupportTicketAsCoachAction} className="grid gap-2">
              <input type="hidden" name="ticket_id" value={focusId} />
              <textarea name="body" rows={3} placeholder="Répondre…" className={daFieldClass} />
              <input
                name="attachment"
                type="file"
                accept="image/*,application/pdf,video/mp4,video/webm"
                className="text-sm text-[color:var(--muted)]"
              />
              <Button type="submit" size="sm" className="justify-self-start">
                Répondre
              </Button>
            </form>
          </section>
        ) : null}
      </div>
    </CoachAppShell>
  )
}
