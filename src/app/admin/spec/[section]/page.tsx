import { notFound } from 'next/navigation'

import { SpecSectionView } from '../../../../components/spec-workspace/SpecSectionView'
import { loadSpecSectionFile } from '../../../../lib/spec-workspace/loadSection'
import { isSpecSectionId } from '../../../../lib/spec-workspace/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Props = {
  params: Promise<{ section: string }>
}

export default async function SpecSectionPage({ params }: Props) {
  const { section } = await params
  if (!isSpecSectionId(section) || section === 'home') notFound()

  const loaded = await loadSpecSectionFile(section)

  if (!loaded) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-extrabold">Impossible de charger la section « {section} ».</p>
        <p className="mt-2">
          Vérifie <code>plans/workspace/{section}.json</code>.
        </p>
        <p className="mt-2 text-xs opacity-80">cwd: {process.cwd()}</p>
      </div>
    )
  }

  return <SpecSectionView doc={loaded.doc} fileMtimeMs={loaded.mtimeMs} />
}
