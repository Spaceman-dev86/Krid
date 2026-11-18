'use client'

import { DocFolderCard } from '@/src/components/documentation/DocFolderCard'

/** Démo figée pour /admin/design — hover = peek feuilles. */
export function DocFolderDesignDemo() {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
      <DocFolderCard
        title="Formation"
        subtitle="Guides, vidéos et supports de formation Trainly"
        count={2}
        tone="system"
        onOpen={() => {}}
      />
      <DocFolderCard
        title="Exemple"
        subtitle="Hover pour le mouvement léger des feuilles"
        count={0}
        draftCount={1}
        onOpen={() => {}}
      />
    </div>
  )
}
