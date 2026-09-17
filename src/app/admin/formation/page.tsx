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
import { FORMATION_MEDIA_LABEL } from '../../../lib/admin/trainlyMedia'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import { formatBytes } from '../../../lib/drive/drive'
import {
  createFormationItemAction,
  deleteFormationItemAction,
  updateFormationItemAction,
  setFormationPublishedAction,
  previewFormationItemAction,
} from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; ok?: string; filter?: string }>
    | { error?: string; ok?: string; filter?: string }
}

export default async function AdminFormationPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const filter = q.filter === 'published' || q.filter === 'draft' ? q.filter : 'all'
  const { supabase } = await requirePlatformAdmin()

  let query = supabase
    .from('trainly_formation_items')
    .select('id, title, description, media_type, published, original_name, size_bytes, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter === 'published') query = query.eq('published', true)
  if (filter === 'draft') query = query.eq('published', false)

  const { data: items, error } = await query
  const publishedCount = items?.filter((i) => i.published).length ?? 0

  const okMsg =
    q.ok === 'created'
      ? 'Contenu ajouté.'
      : q.ok === 'updated'
        ? 'Contenu mis à jour.'
        : q.ok === 'deleted'
          ? 'Contenu supprimé.'
          : q.ok === 'published'
            ? 'Publié — visible sur /formation coach.'
            : q.ok === 'unpublished'
              ? 'Dépublié — plus visible côté coach.'
              : null

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'published', label: 'Publiés' },
    { id: 'draft', label: 'Brouillons' },
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Formation</PageTitle>
        <Muted className="mt-1">PDF · vidéo · image · lecture seule côté coach</Muted>
      </div>

      {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}
      {okMsg ? <DaBanner tone="success" className="mt-3">{okMsg}</DaBanner> : null}

      {error ? (
        <DaBanner tone="warning" className="mt-3">
          Table absente : <code className="text-xs">{error.message}</code>
          <p className="mt-2 text-xs">Exécute <code>35_trainly_library_formation_sav.sql</code>.</p>
        </DaBanner>
      ) : null}

      <form
        action={createFormationItemAction}
        className="mt-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
      >
        <Eyebrow>Nouveau contenu</Eyebrow>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Titre
          <input name="title" required minLength={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Description
          <textarea name="description" rows={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Fichier (PDF / image / vidéo)
          <FilePickField
            name="file"
            accept="application/pdf,.pdf,image/*,video/mp4,video/webm,video/quicktime"
            required
            label="Choisir un fichier depuis mon ordinateur"
            hint="PDF, image ou vidéo · max 200 Mo"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--fg)]">
          <input name="publish_now" type="checkbox" className="accent-[var(--brand)]" />
          Publier maintenant
        </label>
        <Button type="submit" size="sm" className="justify-self-start">
          Ajouter
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>
          Contenus ({items?.length ?? 0}
          {filter === 'all' && items?.length ? ` · ${publishedCount} publiés` : ''})
        </Eyebrow>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <Link
                key={f.id}
                href={f.id === 'all' ? '/admin/formation' : `/admin/formation?filter=${f.id}`}
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
        {!items?.length && !error ? (
          <Muted>Aucun contenu {filter === 'all' ? '' : 'dans ce filtre'}.</Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {(items ?? []).map((item) => {
              const mediaLabel =
                FORMATION_MEDIA_LABEL[item.media_type as 'pdf' | 'video' | 'image'] || item.media_type
              return (
                <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-[color:var(--fg)]">{item.title}</p>
                        <span
                          className={
                            item.published
                              ? 'shrink-0 rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]'
                              : 'shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                          }
                        >
                          {item.published ? 'Publié' : 'Brouillon'}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-[color:var(--muted)]">
                        {mediaLabel} · {formatBytes(item.size_bytes)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <form action={previewFormationItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Preview
                        </Button>
                      </form>
                      {item.published ? (
                        <form action={setFormationPublishedAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="published" value="0" />
                          <ConfirmSubmitButton
                            variant="secondary"
                            confirmMessage="Repasser ce contenu en brouillon ? Il disparaîtra de /formation côté coaches."
                          >
                            Brouillon
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <form action={setFormationPublishedAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="published" value="1" />
                          <Button type="submit" size="sm">
                            Publier
                          </Button>
                        </form>
                      )}
                      <form action={deleteFormationItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmSubmitButton
                          variant="danger"
                          confirmMessage="Supprimer définitivement ce contenu et le fichier Storage ?"
                        >
                          Suppr.
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>

                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[var(--brand)]">
                      Modifier titre / description
                    </summary>
                    <form
                      action={updateFormationItemAction}
                      className="mt-2 grid gap-2 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="published" value={item.published ? 'on' : ''} />
                      <input name="title" defaultValue={item.title} required className={daFieldClass} />
                      <textarea
                        name="description"
                        defaultValue={item.description ?? ''}
                        rows={2}
                        className={daFieldClass}
                        placeholder="Description"
                      />
                      <Muted className="text-[11px]">
                        Enregistre le titre et la description — pas le statut (utilise Publier / Brouillon).
                      </Muted>
                      <Button type="submit" size="sm" className="justify-self-start">
                        Enregistrer
                      </Button>
                    </form>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Muted className="mt-6 text-xs">
        Côté coach :{' '}
        <Link href="/formation" className="font-semibold text-[var(--brand)] underline">
          /formation
        </Link>{' '}
        · viewer in-app · pas de duplication Drive.
      </Muted>
    </main>
  )
}
