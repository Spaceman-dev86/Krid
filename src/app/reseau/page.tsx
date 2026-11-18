import { redirect } from 'next/navigation'

import { CoachAppShell } from '@/src/components/coach/CoachAppShell'
import { Eyebrow, Muted, PageTitle } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { loadCoachShellContext } from '@/src/lib/coach/loadCoachShellContext'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

const OPEN_QUESTIONS = [
  {
    id: 'audience',
    title: 'Qui peut voir / publier ?',
    items: [
      'Tous les coachs KRID entre eux, ou seulement sur invitation / groupes ?',
      'Les comptes en essai peuvent-ils publier, ou seulement lire / récupérer ?',
      'Visibilité par défaut : public réseau · amis · lien privé ?',
    ],
  },
  {
    id: 'payload',
    title: 'Que peut-on partager ?',
    items: [
      'Programmes complets · séances · blocs · exercices — lesquels en V1 ?',
      'Deep-copy dans la biblio du destinataire (recommandé) ou lien live vers l’original ?',
      'Les Rx / notes / médias (démos) voyagent-ils avec la copie ?',
      'Peut-on partager un pack (plusieurs items) d’un coup ?',
    ],
  },
  {
    id: 'rights',
    title: 'Droits après récupération',
    items: [
      'Le receveur peut-il modifier librement sa copie ?',
      'Peut-il re-partager dans le réseau ?',
      'Crédit / attribution obligatoire du coach source ?',
      'Le propriétaire peut-il retirer un partage déjà récupéré (copies déjà prises) ?',
    ],
  },
  {
    id: 'ux',
    title: 'Parcours & UI',
    items: [
      'Feed type découverte, bibliothèque filtrable, ou les deux ?',
      'Recherche : titre · sport · tags · auteur ?',
      'Actions : Aperçu · Récupérer · Demander accès · Message à l’auteur ?',
      'Où vit le CTA « Partager » : fiche programme / séance / bloc / exo ?',
    ],
  },
  {
    id: 'moderation',
    title: 'Modération & confiance',
    items: [
      'Libre dès V1, ou validation admin pour les premiers partages ?',
      'Signalement + retrait — qui traite (admin KRID) ?',
      'Limites anti-spam (quota partages / jour) ?',
    ],
  },
  {
    id: 'scope',
    title: 'Périmètre V1',
    items: [
      'MVP minimal : partage par lien + récupération, sans feed social ?',
      'Notifications in-app / e-mail quand quelqu’un récupère ton contenu ?',
      'Hors scope V1 : commentaires, likes, classements ?',
    ],
  },
] as const

export default async function ReseauPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Réseau"
      savUnread={shell.savUnread}
      chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      <main className="mx-auto w-full min-w-0 max-w-3xl px-3 py-5 md:px-6 md:py-8">
        <Eyebrow>Coach · à cadrer</Eyebrow>
        <PageTitle className="mt-2 text-2xl md:text-3xl">Réseau</PageTitle>
        <Muted className="mt-2 max-w-2xl text-[13px] md:text-sm">
          Espace d’échange entre coachs (programmes, séances, blocs, exos). Onglet créé —{' '}
          <strong className="text-[color:var(--fg)]">pas encore de produit</strong> : on répond à ces
          questions avant de coder.
        </Muted>

        <ol className="mt-8 grid list-none gap-4 p-0">
          {OPEN_QUESTIONS.map((block, i) => (
            <li
              key={block.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                {String(i + 1).padStart(2, '0')} · {block.title}
              </p>
              <ul className="mt-3 grid gap-2">
                {block.items.map((q) => (
                  <li
                    key={q}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5 text-[13px] leading-snug text-[color:var(--fg)]"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </main>
    </CoachAppShell>
  )
}
