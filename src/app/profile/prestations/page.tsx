import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { ProfileChromeActions } from '../../../components/coach/ProfileChromeActions'
import { ProfileSubnav } from '../../../components/coach/ProfileSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { formatPriceCents, parseModules, PRESTATION_MODULES } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { createPrestationAction } from '../../payments/actions'
import { selectFieldClass, selectFieldStyle } from '../../../lib/ui/selectField'

export const dynamic = 'force-dynamic'

function statusLabel(s: string) {
  if (s === 'draft') return 'Brouillon'
  if (s === 'active') return 'Active'
  if (s === 'archived') return 'Archivée'
  return s
}

export default async function ProfilePrestationsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; archived?: string }>
    | { error?: string; archived?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const slug = shell.branding?.slug?.trim()

  const { data: prestations, error } = await supabase
    .from('prestations')
    .select('id, name, pricing_type, price_cents, modules, status, showroom_visible, created_at')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Prestations" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Profil public</PageTitle>
            <Muted className="mt-1">Catalogue d’offres · visible showroom</Muted>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ProfileChromeActions />
            <ProfileSubnav />
          </div>
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error === 'name'
              ? 'Nom requis.'
              : params.error === 'price'
                ? 'Prix invalide.'
                : params.error}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error.message}
          </div>
        ) : null}

        {slug ? (
          <p className="text-sm text-[color:var(--muted)]">
            Showroom :{' '}
            <Link href={`/c/${slug}/showroom`} className="font-semibold text-[color:var(--brand)] underline">
              /c/{slug}/showroom
            </Link>
          </p>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Nouvelle prestation
          </h2>
          <form action={createPrestationAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="return_to" value="/profile/prestations" />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Nom *</span>
              <input name="name" required className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Description</span>
              <textarea name="description" rows={2} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Prix (€)</span>
              <input
                name="price_euros"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Tarification</span>
              <select name="pricing_type" className={selectFieldClass} style={selectFieldStyle}>
                <option value="unique">Unique</option>
                <option value="renewable">Renouvelable</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Statut</span>
              <select
                name="status"
                defaultValue="active"
                className={selectFieldClass}
                style={selectFieldStyle}
              >
                <option value="draft">Brouillon</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 self-end text-sm font-semibold">
              <input type="checkbox" name="showroom_visible" defaultChecked className="rounded" />
              Visible showroom
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold">Modules</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {PRESTATION_MODULES.map((m) => (
                  <label key={m.id} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`module_${m.id}`} className="rounded" />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Créer</Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Liste</h2>
          </div>
          {!prestations?.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucune prestation.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {prestations.map((p) => {
                const mods = parseModules(p.modules)
                return (
                  <li key={p.id}>
                    <Link
                      href={`/payments/${p.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--brand)]">{p.name}</p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {formatPriceCents(p.price_cents)} · {p.pricing_type}
                          {mods.length ? ` · ${mods.join(', ')}` : ''}
                          {p.showroom_visible ? ' · showroom' : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                        {statusLabel(p.status)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
