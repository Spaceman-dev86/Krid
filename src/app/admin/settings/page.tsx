import {
  PageTitle,
  Muted,
  Eyebrow,
  Button,
  DaBanner,
  daFieldClass,
} from '@/src/components/ui'
import { ShellThemeToggle } from '../../../components/design/ThemeToggle'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import {
  requestAdminEmailChangeAction,
  updateAdminFullNameAction,
  updateAdminPasswordAction,
} from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; ok?: string }>
    | { error?: string; ok?: string }
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const { user, profile } = await requirePlatformAdmin()
  const pendingEmail = (user as { new_email?: string | null }).new_email || null

  return (
    <main className="mx-auto max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <Eyebrow>Staff</Eyebrow>
        <PageTitle className="mt-2 text-2xl">Settings</PageTitle>
        <Muted className="mt-1">Compte admin · thème · sécurité</Muted>
      </div>

      {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}
      {q.ok === 'name' ? <DaBanner tone="success">Nom mis à jour.</DaBanner> : null}
      {q.ok === 'password' ? <DaBanner tone="success">Mot de passe mis à jour.</DaBanner> : null}
      {q.ok === 'email_pending' ? (
        <DaBanner tone="warning">
          Confirme le nouvel e-mail via le lien reçu dans ta boîte mail (ancien + nouveau selon config Auth).
        </DaBanner>
      ) : null}

      <div className="grid gap-6">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Thème</Eyebrow>
          <Muted className="mt-1 text-xs">Black / White — préférences par compte</Muted>
          <div className="mt-3 max-w-xs">
            <ShellThemeToggle variant="page" />
          </div>
        </section>

        <form
          action={updateAdminFullNameAction}
          className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
        >
          <Eyebrow>Nom</Eyebrow>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Nom complet
            <input
              name="full_name"
              required
              minLength={2}
              defaultValue={profile.full_name ?? ''}
              className={daFieldClass}
            />
          </label>
          <Button type="submit" size="sm" className="justify-self-start">
            Enregistrer
          </Button>
        </form>

        <form
          action={requestAdminEmailChangeAction}
          className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
        >
          <Eyebrow>E-mail</Eyebrow>
          <Muted className="text-xs">
            Actuel : <span className="font-medium text-[color:var(--fg)]">{profile.email ?? user.email}</span>
            {pendingEmail ? (
              <>
                {' '}
                · en attente : <span className="font-medium text-[var(--warning)]">{pendingEmail}</span>
              </>
            ) : null}
          </Muted>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Nouvel e-mail
            <input name="email" type="email" required className={daFieldClass} placeholder="nouveau@email.com" />
          </label>
          <Button type="submit" size="sm" className="justify-self-start">
            Demander le changement
          </Button>
        </form>

        <form
          action={updateAdminPasswordAction}
          className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
        >
          <Eyebrow>Mot de passe</Eyebrow>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Nouveau mot de passe
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className={daFieldClass}
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Confirmer
            <input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              className={daFieldClass}
              autoComplete="new-password"
            />
          </label>
          <Button type="submit" size="sm" className="justify-self-start">
            Mettre à jour
          </Button>
        </form>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Sécurité</Eyebrow>
          <Muted className="mt-2">
            V1 = toi seul (<code className="text-xs">platform_admin</code>). Pas d’inscription admin publique · pas
            d’impersonation.
          </Muted>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/admin/access" variant="secondary" size="sm">
              Voir Accès & essai
            </Button>
            <Button href="/home" variant="secondary" size="sm">
              Espace coach
            </Button>
          </div>
        </section>

        <form action="/auth/signout?next=/loginadmin" method="post">
          <Button type="submit" variant="secondary" className="w-full">
            Déconnexion
          </Button>
        </form>
      </div>
    </main>
  )
}
