import ProgramEditorV2Page from './program-editor-v2-page'
import ProgramBuilderPage from './legacy-program-builder-page'

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function shouldUseLegacyBuilder(searchParams: Record<string, string | string[] | undefined>) {
  const legacy = firstParam(searchParams.legacy) ?? firstParam(searchParams.showLegacy)
  const legacyLower = String(legacy ?? '').trim().toLowerCase()
  if (legacyLower === '1' || legacyLower === 'true') return true

  const blocks = firstParam(searchParams.blocks)
  const blocksLower = String(blocks ?? '').trim().toLowerCase()
  if (blocksLower === '1' || blocksLower === 'true') return true
  if (firstParam(searchParams.openBlock)) return true

  return false
}

/** Programme builder: V2 by default; V1 via ?legacy=1 (ou ?blocks=1 pour l’éditeur blocs embarqué) */
export default async function ProgramEditorPage({ params, searchParams }: PageProps) {
  const rawSearchParams = await searchParams
  if (shouldUseLegacyBuilder(rawSearchParams)) {
    return ProgramBuilderPage({ params, searchParams })
  }
  return ProgramEditorV2Page({ params })
}
