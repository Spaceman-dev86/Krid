import {
  downloadTrainlyLibraryFileAction,
  duplicateTrainlyLibraryFileAction,
  openTrainlyLibraryFileAction,
} from '@/src/app/drive/trainly-actions'
import { Button, Eyebrow, Muted } from '@/src/components/ui'
import { formatBytes } from '@/src/lib/drive/drive'

export type TrainlyLibraryPack = {
  id: string
  title: string
  description: string | null
  allow_duplicate: boolean | null
  allow_download: boolean | null
  original_name: string | null
  size_bytes: number | null
}

export function TrainlyDriveSection({ packs }: { packs: TrainlyLibraryPack[] }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
      <div className="mb-4">
        <Eyebrow>Bibliothèque plateforme</Eyebrow>
        <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[var(--brand)]">Trainly</h2>
        <Muted className="mt-1 text-xs">
          Docs hors quota · récupération / téléchargement selon droits admin
        </Muted>
      </div>

      {!packs.length ? (
        <p className="text-sm text-[color:var(--muted)]">Aucun document publié pour le moment.</p>
      ) : (
        <ul className="grid gap-2">
          {packs.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--fg)]">{p.title}</p>
                {p.description ? (
                  <p className="text-xs text-[color:var(--muted)]">{p.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                  PDF · {formatBytes(p.size_bytes)}
                  {p.original_name ? ` · ${p.original_name}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={openTrainlyLibraryFileAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Ouvrir
                  </Button>
                </form>
                {p.allow_download ? (
                  <form action={downloadTrainlyLibraryFileAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Télécharger
                    </Button>
                  </form>
                ) : null}
                {p.allow_duplicate ? (
                  <form action={duplicateTrainlyLibraryFileAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" size="sm">
                      Récupérer
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
