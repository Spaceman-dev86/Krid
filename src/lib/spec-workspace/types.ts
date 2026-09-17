export type SpecRedirect = {
  id: string
  label: string
  from?: string
  to: string
  note?: string
}

export type SpecNodeKind = 'shell' | 'tab' | 'detail' | 'fullscreen' | 'plain' | 'menu' | 'feature'

export type SpecTreeNode = {
  id: string
  label: string
  route?: string
  kind?: SpecNodeKind
  children?: SpecTreeNode[]
}

export type SpecBlock = {
  bodyHtml: string
  images: string[]
  redirects?: SpecRedirect[]
  /** Notes / questions (colonne droite, hors card) */
  critiqueHtml?: string
}

/** Fonctionnalité récursive (header + sous-fonctions à l'infini) */
export type SpecFeature = {
  id: string
  label: string
  route: string
  bodyHtml: string
  images: string[]
  children: SpecFeature[]
  /** Notes / questions (colonne droite, hors card) */
  critiqueHtml?: string
}

/** Une entrée de sidebar coach : à l'arrivée + arbre de features */
export type SpecMenuPage = {
  arrival: SpecBlock
  features: SpecFeature[]
}

export type SpecSectionDoc = {
  id: string
  title: string
  description?: string
  tree: SpecTreeNode[]
  blocks: Record<string, SpecBlock>
  /** Admin/clients legacy shell layout */
  pageShellLayout?: boolean
  /** Coach sidebar : À l'arrivée + header features récursives */
  featureMenuLayout?: boolean
  /** Schéma ERD (Supabase) — mise en forme dédiée, pas menus features */
  schemaLayout?: boolean
  menus?: Record<string, SpecMenuPage>
}

export const SPEC_SECTIONS = [
  { id: 'home', label: 'Accueil', href: '/admin/spec' },
  { id: 'admin', label: 'Admin', href: '/admin/spec/admin' },
  { id: 'coach', label: 'Coach', href: '/admin/spec/coach' },
  { id: 'clients', label: 'Clients', href: '/admin/spec/clients' },
  { id: 'supabase', label: 'Supabase', href: '/admin/spec/supabase' },
  { id: 'auth', label: 'Auth', href: '/admin/spec/auth' },
  { id: 'gating', label: 'Gating', href: '/admin/spec/gating' },
  { id: 'roadmap', label: 'Roadmap', href: '/admin/spec/roadmap' },
  { id: 'integrations', label: 'Intégrations', href: '/admin/spec/integrations' },
] as const

export type SpecSectionId = (typeof SPEC_SECTIONS)[number]['id']

export const SPEC_SECTION_IDS: SpecSectionId[] = SPEC_SECTIONS.map((s) => s.id)

export function isSpecSectionId(value: string): value is SpecSectionId {
  return (SPEC_SECTION_IDS as string[]).includes(value)
}

export function headerBlockId(shellId: string) {
  return `${shellId}__header`
}

export function emptyBlock(): SpecBlock {
  return { bodyHtml: '<p></p>', images: [], redirects: [], critiqueHtml: '' }
}

export function emptyFeature(): SpecFeature {
  return {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'Nouvelle fonctionnalité',
    route: '',
    bodyHtml: '<p></p>',
    images: [],
    children: [],
    critiqueHtml: '',
  }
}

export function emptyMenuPage(): SpecMenuPage {
  return {
    arrival: emptyBlock(),
    features: [],
  }
}
