import { SpecSectionView } from '../../../components/spec-workspace/SpecSectionView'
import { loadSpecSection } from '../../../lib/spec-workspace/loadSection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SpecHomePage() {
  const doc = await loadSpecSection('home')

  if (!doc) {
    return (
      <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-6 text-sm text-[var(--danger)]">
        <p className="font-extrabold">Impossible de charger la section Accueil.</p>
        <p className="mt-2">
          Vérifie que le fichier <code>plans/workspace/home.json</code> existe à la racine du projet.
        </p>
        <p className="mt-2 text-xs opacity-80">cwd: {process.cwd()}</p>
      </div>
    )
  }

  return <SpecSectionView doc={doc} />
}
