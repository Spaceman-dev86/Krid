import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button, PageTitle } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { PaymentsSubnav } from '../../../components/coach/PaymentsSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { formatPriceCents, parseModules, PRESTATION_MODULES } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { archivePrestationAction, updatePrestationAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; created?: string }>
    | { error?: string; saved?: string; created?: string }
}

export default async function PrestationDetailPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: p } = await supabase
    .from('prestations')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!p) notFound()

  const modules = parseModules(p.modules)

  const { data: programTemplates } = await supabase
    .from('programs')
    .select('id, title, is_template')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  const { data: nutritionTemplates } = await supabase
    .from('nutrition_plans')
    .select('id, title')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  const { data: driveFolders } = await supabase
    .from('drive_folders')
    .select('id, name, parent_id')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Prestation" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/payments/prestations"
              className="text-xs font-semibold text-[color-mix(in_srgb,var(--brand)_70%,transparent)] hover:underline"
            >
              ← Prestations
            </Link>
            <PageTitle className="mt-2 text-2xl">{p.name}</PageTitle>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{formatPriceCents(p.price_cents)}</p>
          </div>
          <PaymentsSubnav />
        </div>

        {q.created || q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {q.created ? 'Prestation créée.' : 'Enregistrée.'}
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <form action={updatePrestationAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={p.id} />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Nom *</span>
              <input name="name" required defaultValue={p.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Description</span>
              <textarea
                name="description"
                rows={2}
                defaultValue={p.description ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Prix (€)</span>
              <input
                name="price_euros"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(p.price_cents / 100).toFixed(2)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Tarification</span>
              <select name="pricing_type" defaultValue={p.pricing_type} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <option value="unique">Unique</option>
                <option value="renewable">Renouvelable</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Statut</span>
              <select name="status" defaultValue={p.status} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <option value="draft">Brouillon</option>
                <option value="active">Active</option>
                <option value="archived">Archivée</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 self-end text-sm font-semibold">
              <input type="checkbox" name="showroom_visible" defaultChecked={p.showroom_visible} className="rounded" />
              Visible showroom
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold">Modules</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {PRESTATION_MODULES.map((m) => (
                  <label key={m.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`module_${m.id}`}
                      defaultChecked={modules.includes(m.id)}
                      className="rounded"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Programme lié (template)</span>
              <select
                name="program_template_id"
                defaultValue={p.program_template_id ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <option value="">Aucun</option>
                {(programTemplates ?? []).map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.title?.trim() || 'Sans titre'}
                    {prog.is_template ? ' · template' : ''}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[color:var(--muted)]">
                Au Payé → plan fitness <strong>En attente</strong> (le client démarre).{' '}
                <Link href="/programs" className="font-semibold underline">
                  Programme
                </Link>
              </span>
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Nutrition liée (template)</span>
              <select
                name="nutrition_template_id"
                defaultValue={p.nutrition_template_id ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <option value="">Aucun</option>
                {(nutritionTemplates ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title?.trim() || 'Sans titre'}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[color:var(--muted)]">
                Au Payé → plan nutrition <strong>En attente</strong>.{' '}
                <Link href="/nutrition" className="font-semibold underline">
                  Nutrition
                </Link>
              </span>
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Dossier Drive lié</span>
              <select
                name="drive_folder_id"
                defaultValue={p.drive_folder_id ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <option value="">Aucun</option>
                {(driveFolders ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[color:var(--muted)]">
                Au Payé → dossier partagé au client. Nécessite la tranche SQL 24. {' '}
                <Link href="/drive" className="font-semibold underline">
                  Drive
                </Link>
              </span>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Enregistrer</Button>
            </div>
          </form>
        </section>

        <form action={archivePrestationAction}>
          <input type="hidden" name="id" value={p.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Archiver
          </button>
        </form>
      </div>
    </CoachAppShell>
  )
}
