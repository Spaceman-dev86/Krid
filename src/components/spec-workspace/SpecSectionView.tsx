import { readFile } from 'fs/promises'
import path from 'path'

import { EditableBlock } from './EditableBlock'
import { CoachSpecWorkspace } from './CoachSpecWorkspace'
import { PageShellCard } from './PageShellCard'
import { RedirectsEditor } from './RedirectsEditor'
import { RouteTree } from './RouteTree'
import { SupabaseSchemaWorkspace } from './SupabaseSchemaWorkspace'
import { SQL_SLICES } from '../../lib/spec-workspace/sqlSlices'
import type { SpecSectionDoc, SpecTreeNode } from '../../lib/spec-workspace/types'
import { emptyBlock } from '../../lib/spec-workspace/types'

async function loadSqlSlices(): Promise<{ id: string; title: string; file: string; sql: string; runNow: boolean; summary: string }[]> {
  const out: { id: string; title: string; file: string; sql: string; runNow: boolean; summary: string }[] = []
  for (const slice of SQL_SLICES) {
    try {
      const sql = await readFile(path.join(process.cwd(), ...slice.file.split('/')), 'utf8')
      out.push({
        id: slice.id,
        title: slice.title,
        file: slice.file,
        sql,
        runNow: slice.runNow,
        summary: slice.summary,
      })
    } catch {
      out.push({
        id: slice.id,
        title: slice.title,
        file: slice.file,
        sql: `-- Fichier manquant: ${slice.file}`,
        runNow: slice.runNow,
        summary: slice.summary,
      })
    }
  }
  return out
}

function flattenNonShell(nodes: SpecTreeNode[]): SpecTreeNode[] {
  const out: SpecTreeNode[] = []
  for (const node of nodes) {
    if (node.kind === 'shell') continue
    out.push(node)
    if (node.children?.length) out.push(...flattenNonShell(node.children))
  }
  return out
}

function collectShells(nodes: SpecTreeNode[]): SpecTreeNode[] {
  const out: SpecTreeNode[] = []
  for (const node of nodes) {
    if (node.kind === 'shell') out.push(node)
    if (node.children?.length) out.push(...collectShells(node.children))
  }
  return out
}

function topLevelPlain(nodes: SpecTreeNode[]): SpecTreeNode[] {
  return nodes.filter((n) => n.kind !== 'shell')
}

export async function SpecSectionView({
  doc,
  fileMtimeMs,
}: {
  doc: SpecSectionDoc
  fileMtimeMs?: number
}) {
  const isNotesOnly = doc.tree.length === 0
  const useSchemaLayout = Boolean(doc.schemaLayout)
  const useFeatureMenus = Boolean(doc.featureMenuLayout) && !useSchemaLayout
  const useShellLayout = Boolean(doc.pageShellLayout) && !useFeatureMenus && !useSchemaLayout
  const shells = useShellLayout ? collectShells(doc.tree) : []
  const plainTop = useShellLayout ? topLevelPlain(doc.tree) : doc.tree
  const plainFlat = useShellLayout
    ? flattenNonShell(plainTop)
    : useFeatureMenus || useSchemaLayout
      ? []
      : flattenNonShell(doc.tree)

  if (useSchemaLayout) {
    const slices = await loadSqlSlices()
    return (
      <div className="-mx-2 md:-mx-4">
        <SupabaseSchemaWorkspace sqlSlices={slices} />
      </div>
    )
  }

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--brand)]">{doc.title}</h2>
        {doc.description ? <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">{doc.description}</p> : null}
        {useFeatureMenus ? (
          <p className="mt-3 max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--accent)]/50 px-3 py-2 text-xs text-[color:var(--muted)]">
            Chaque menu : <strong>À l’arrivée</strong> + <strong>Header</strong> (boutons de redirection + features
            imbriquées). Colonne ambre à droite = <strong>notes / questions</strong> (hors card).{' '}
            <strong>Pas d’auto-save</strong> — utilise le bouton <strong>Sauvegarder</strong> sticky en haut. Bouton{' '}
            <strong>▾/▸</strong> = replier. Bouton <strong>↑</strong> = retour à l’arbre.
          </p>
        ) : null}
        {useShellLayout ? (
          <p className="mt-3 max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--accent)]/50 px-3 py-2 text-xs text-[color:var(--muted)]">
            Mise en forme <strong>page shell</strong> : vue d’ensemble · header fixe · zone dynamique.
          </p>
        ) : null}
      </div>

      {!isNotesOnly && !useFeatureMenus ? <RouteTree nodes={doc.tree} /> : null}

      <div className="grid gap-8">
        {isNotesOnly ? (
          <>
            <EditableBlock
              sectionId={doc.id}
              blockId="notes"
              title="Bloc-notes"
              initial={doc.blocks.notes ?? emptyBlock()}
            />
            <RedirectsEditor
              sectionId={doc.id}
              blockId="notes"
              initial={(doc.blocks.notes ?? emptyBlock()).redirects ?? []}
            />
          </>
        ) : useFeatureMenus ? (
          <CoachSpecWorkspace
            key={fileMtimeMs ?? doc.id}
            sectionId={doc.id}
            tree={doc.tree}
            menus={doc.menus}
          />
        ) : (
          <>
            {shells.map((shell) => (
              <PageShellCard key={shell.id} sectionId={doc.id} node={shell} blocks={doc.blocks} />
            ))}
            {plainFlat.map((node) => (
              <div key={node.id} className="grid gap-2">
                <EditableBlock
                  sectionId={doc.id}
                  blockId={node.id}
                  title={node.label}
                  route={node.route}
                  initial={doc.blocks[node.id] ?? emptyBlock()}
                />
                <RedirectsEditor
                  sectionId={doc.id}
                  blockId={node.id}
                  initial={(doc.blocks[node.id] ?? emptyBlock()).redirects ?? []}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
