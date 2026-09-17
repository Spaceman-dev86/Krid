'use client'

import { EditableBlock } from './EditableBlock'
import { RedirectsEditor } from './RedirectsEditor'
import type { SpecBlock, SpecTreeNode } from '../../lib/spec-workspace/types'
import { emptyBlock, headerBlockId } from '../../lib/spec-workspace/types'

type Props = {
  sectionId: string
  node: SpecTreeNode
  blocks: Record<string, SpecBlock>
}

function KindBadge({ kind }: { kind?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    shell: { label: 'Page shell', className: 'bg-[var(--brand)] text-white' },
    tab: { label: 'Zone dynamique', className: 'bg-orange-100 text-orange-800' },
    detail: { label: 'Fiche détail', className: 'bg-sky-100 text-sky-800' },
    fullscreen: { label: 'Plein écran', className: 'bg-violet-100 text-violet-800' },
    plain: { label: 'Page', className: 'bg-[var(--accent)] text-[var(--brand)]' },
  }
  const conf = map[kind ?? 'plain'] ?? map.plain
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${conf.className}`}>
      {conf.label}
    </span>
  )
}

export function PageShellCard({ sectionId, node, blocks }: Props) {
  const tabs = (node.children ?? []).filter((c) => (c.kind ?? 'tab') === 'tab')
  const otherChildren = (node.children ?? []).filter((c) => (c.kind ?? 'tab') !== 'tab')
  const overview = blocks[node.id] ?? emptyBlock()
  const header = blocks[headerBlockId(node.id)] ?? emptyBlock()

  return (
    <article
      id={node.id}
      className="scroll-mt-28 overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--brand)]/20 bg-white shadow-sm"
    >
      <header className="border-b border-[var(--border)] bg-[var(--brand)]/5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind="shell" />
          <h3 className="text-xl font-extrabold tracking-tight text-[var(--brand)]">{node.label}</h3>
        </div>
        {node.route ? <code className="mt-1 block text-xs text-[color:var(--muted)]">{node.route}</code> : null}
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Structure type photo : titre fixe · header d’interaction (ne bouge pas) · zone dynamique selon l’onglet.
        </p>
      </header>

      <div className="grid gap-0 divide-y divide-[var(--border)]">
        {/* 1. Vue d'ensemble */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-[11px] font-extrabold text-white">
              1
            </span>
            <h4 className="text-sm font-extrabold text-[color:var(--fg)]">Vue d’ensemble</h4>
            <span className="text-xs text-[color:var(--muted)]">— ce que je vois en arrivant</span>
          </div>
          <EditableBlock
            sectionId={sectionId}
            blockId={node.id}
            title="À l’arrivée"
            route={node.route}
            initial={overview}
            embedded
          />
          <RedirectsEditor sectionId={sectionId} blockId={node.id} initial={overview.redirects ?? []} />
        </div>

        {/* 2. Header fixe */}
        <div className="bg-[var(--accent)]/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
              2
            </span>
            <h4 className="text-sm font-extrabold text-[color:var(--fg)]">Header d’interaction (fixe)</h4>
            <span className="text-xs text-[color:var(--muted)]">— onglets · filtres · CTA (reste visible)</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-dashed border-orange-300 bg-white/80 px-3 py-2 text-[11px] font-semibold text-orange-800">
            <span className="rounded-md bg-orange-100 px-2 py-1">Onglets</span>
            <span className="rounded-md bg-orange-100 px-2 py-1">Filtres</span>
            <span className="rounded-md bg-orange-100 px-2 py-1">Recherche</span>
            <span className="rounded-md bg-orange-500 px-2 py-1 text-white">CTA (ex. Créer…)</span>
          </div>
          <EditableBlock
            sectionId={sectionId}
            blockId={headerBlockId(node.id)}
            title="Contenu du header fixe"
            initial={header}
            embedded
          />
          <RedirectsEditor
            sectionId={sectionId}
            blockId={headerBlockId(node.id)}
            initial={header.redirects ?? []}
          />
        </div>

        {/* 3. Zone dynamique */}
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
              3
            </span>
            <h4 className="text-sm font-extrabold text-[color:var(--fg)]">Zone dynamique</h4>
            <span className="text-xs text-[color:var(--muted)]">— change selon l’onglet (header inchangé)</span>
          </div>

          {tabs.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">Aucun onglet défini.</p>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
                {tabs.map((tab, i) => (
                  <a
                    key={tab.id}
                    href={`#${tab.id}`}
                    className={
                      i === 0
                        ? 'rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white'
                        : 'rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--brand)]'
                    }
                  >
                    {tab.label}
                  </a>
                ))}
              </div>
              {tabs.map((tab) => (
                <div key={tab.id} id={tab.id} className="scroll-mt-28">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <KindBadge kind="tab" />
                    {tab.route ? <code className="text-[11px] text-[color:var(--muted)]">{tab.route}</code> : null}
                  </div>
                  <EditableBlock
                    sectionId={sectionId}
                    blockId={tab.id}
                    title={tab.label}
                    route={tab.route}
                    initial={blocks[tab.id] ?? emptyBlock()}
                    embedded
                  />
                  <RedirectsEditor
                    sectionId={sectionId}
                    blockId={tab.id}
                    initial={(blocks[tab.id] ?? emptyBlock()).redirects ?? []}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {otherChildren.length > 0 ? (
          <div className="bg-[var(--bg)] p-5">
            <h4 className="mb-3 text-sm font-extrabold">Autres (hors onglets liste)</h4>
            <div className="grid gap-4">
              {otherChildren.map((child) => (
                <div key={child.id} id={child.id} className="scroll-mt-28">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <KindBadge kind={child.kind} />
                    {child.route ? <code className="text-[11px] text-[color:var(--muted)]">{child.route}</code> : null}
                  </div>
                  <EditableBlock
                    sectionId={sectionId}
                    blockId={child.id}
                    title={child.label}
                    route={child.route}
                    initial={blocks[child.id] ?? emptyBlock()}
                    embedded
                  />
                  <RedirectsEditor
                    sectionId={sectionId}
                    blockId={child.id}
                    initial={(blocks[child.id] ?? emptyBlock()).redirects ?? []}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
