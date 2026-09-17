import Link from 'next/link'

import {
  PageTitle,
  Muted,
  Eyebrow,
  Button,
  DaBanner,
  daFieldClass,
  FilePickField,
  ConfirmSubmitButton,
} from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import { formatBytes } from '../../../lib/drive/drive'
import {
  createDriveLibraryPackAction,
  deleteDriveLibraryPackAction,
  updateDriveLibraryPackAction,
  setDriveLibraryPublishedAction,
  previewDriveLibraryPackAction,
} from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; ok?: string; filter?: string }>
    | { error?: string; ok?: string; filter?: string }
}

export default async function AdminDrivePacksPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const filter = q.filter === 'published' || q.filter === 'draft' ? q.filter : 'all'
  const { supabase } = await requirePlatformAdmin()

  let query = supabase
    .from('trainly_drive_library')
    .select(
      'id, title, description, published, allow_duplicate, allow_download, original_name, size_bytes, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter === 'published') query = query.eq('published', true)
  if (filter === 'draft') query = query.eq('published', false)

  const { data: packs, error } = await query
  const publishedCount = packs?.filter((p) => p.published).length ?? 0

  const okMsg =
    q.ok === 'created'
      ? 'PDF ajouté.'
      : q.ok === 'updated'
        ? 'Pack mis à jour.'
        : q.ok === 'deleted'
          ? 'Pack supprimé.'
          : q.ok === 'published'
            ? 'Publié — visible dans le Drive coach.'
            : q.ok === 'unpublished'
              ? 'Dépublié — plus de nouvelle récupération coach.'
              : null

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'published', label: 'Publiés' },
    { id: 'draft', label: 'Brouillons' },
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Drive & PDF</PageTitle>
        <Muted className="mt-1">
          Biblio Trainly · hors quota coach jusqu’à récupération · PDF only V1
        </Muted>
      </div>

      {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}
      {okMsg ? <DaBanner tone="success" className="mt-3">{okMsg}</DaBanner> : null}

      {error ? (
        <DaBanner tone="warning" className="mt-3">
          Table / colonnes absentes : <code className="text-xs">{error.message}</code>
          <p className="mt-2 text-xs">Exécute <code>35_trainly_library_formation_sav.sql</code>.</p>
        </DaBanner>
      ) : null}

      <form
        action={createDriveLibraryPackAction}
        className="mt-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
      >
        <Eyebrow>Nouveau PDF</Eyebrow>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Titre
          <input name="title" required minLength={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Description
          <textarea name="description" rows={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Fichier PDF
          <FilePickField
            name="file"
            accept="application/pdf,.pdf"
            required
            label="Choisir un PDF depuis mon ordinateur"
            hint="PDF uniquement · max 50 Mo"
          />
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-[color:var(--fg)]">
          <label className="inline-flex items-center gap-2 font-semibold">
            <input name="allow_duplicate" type="checkbox" defaultChecked className="accent-[var(--brand)]" />
            Duplicable (récupérer)
          </label>
          <label className="inline-flex items-center gap-2 font-semibold">
            <input name="allow_download" type="checkbox" defaultChecked className="accent-[var(--brand)]" />
            Téléchargeable
          </label>
          <label className="inline-flex items-center gap-2 font-semibold">
            <input name="publish_now" type="checkbox" className="accent-[var(--brand)]" />
            Publier maintenant
          </label>
        </div>
        <Button type="submit" size="sm" className="justify-self-start">
          Ajouter
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>
          Packs ({packs?.length ?? 0}
          {filter === 'all' && packs?.length ? ` · ${publishedCount} publiés` : ''})
        </Eyebrow>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <Link
                key={f.id}
                href={f.id === 'all' ? '/admin/drive-packs' : `/admin/drive-packs?filter=${f.id}`}
                className={
                  active
                    ? 'rounded-full bg-[var(--brand)] px-3 py-1 text-[11px] font-bold text-[var(--brand-fg)]'
                    : 'rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                }
              >
                {f.label}
              </Link>
            )
          })}
        </div>
      </div>

      <section className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        {!packs?.length && !error ? (
          <Muted>Aucun pack {filter === 'all' ? 'pour l’instant' : 'dans ce filtre'}.</Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {(packs ?? []).map((p) => (
              <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[color:var(--fg)]">{p.title}</p>
                      <span
                        className={
                          p.published
                            ? 'shrink-0 rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]'
                            : 'shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                        }
                      >
                        {p.published ? 'Publié' : 'Brouillon'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[color:var(--muted)]">
                      PDF · {formatBytes(p.size_bytes)}
                      {p.allow_duplicate === false ? ' · no dup' : ''}
                      {p.allow_download === false ? ' · no DL' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <form action={previewDriveLibraryPackAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Preview
                      </Button>
                    </form>
                    {p.published ? (
                      <form action={setDriveLibraryPublishedAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="published" value="0" />
                        <ConfirmSubmitButton
                          variant="secondary"
                          confirmMessage="Repasser ce PDF en brouillon ? Il disparaîtra de la section Trainly des coaches (les copies déjà récupérées restent)."
                        >
                          Brouillon
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <form action={setDriveLibraryPublishedAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="published" value="1" />
                        <Button type="submit" size="sm">
                          Publier
                        </Button>
                      </form>
                    )}
                    <form action={deleteDriveLibraryPackAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmSubmitButton
                        variant="danger"
                        confirmMessage="Supprimer définitivement ce PDF et le fichier Storage ?"
                      >
                        Suppr.
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-[var(--brand)]">
                    Modifier titre / description / droits
                  </summary>
                  <form
                    action={updateDriveLibraryPackAction}
                    className="mt-2 grid gap-2 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="published" value={p.published ? 'on' : ''} />
                    <input name="title" defaultValue={p.title} required className={daFieldClass} />
                    <textarea
                      name="description"
                      defaultValue={p.description ?? ''}
                      rows={2}
                      className={daFieldClass}
                      placeholder="Description"
                    />
                    <div className="flex flex-wrap gap-3 text-xs font-semibold text-[color:var(--fg)]">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          name="allow_duplicate"
                          type="checkbox"
                          defaultChecked={p.allow_duplicate !== false}
                          className="accent-[var(--brand)]"
                        />
                        Duplicable
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          name="allow_download"
                          type="checkbox"
                          defaultChecked={p.allow_download !== false}
                          className="accent-[var(--brand)]"
                        />
                        Téléchargeable
                      </label>
                    </div>
                    <Muted className="text-[11px]">
                      Enregistre le titre, la description et les droits — pas le statut publié (utilise Publier /
                      Brouillon).
                    </Muted>
                    <Button type="submit" size="sm" className="justify-self-start">
                      Enregistrer
                    </Button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Muted className="mt-6 text-xs">
        Côté coach :{' '}
        <Link href="/drive" className="font-semibold text-[var(--brand)] underline">
          /drive
        </Link>{' '}
        → section Trainly. Dépublication = plus de nouvelle récup ; copies déjà dans le Drive coach inchangées.
      </Muted>
    </main>
  )
}
