import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, Muted, PageTitle } from '@/src/components/ui'
import { CoachBlockDetailView } from '../../../components/exercises/CoachBlockDetailView'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { getCoachBlock } from '../../../lib/blocks/library'
import { loadCoachBlockPreview } from '../../../lib/blocks/loadCoachBlockPreview'
import { createClient } from '../../../lib/supabase/server'
import { forkKridBlockToDraftAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

/** Détail catalogue Krid (bloc) — aperçu exos/média/timer + CTA Ajouter. */
export default async function KridBlockDetailPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const block = await getCoachBlock(supabase, id)
  if (!block) {
    redirect('/exercises/blocks/catalogue?error=' + encodeURIComponent('Bloc introuvable'))
  }

  if (block.coach_id === user.id) {
    redirect(
      block.status === 'draft'
        ? `/exercises/blocks/brouillon/${id}`
        : `/exercises/blocks/mine/${id}`,
    )
  }

  if (block.coach_id != null) {
    redirect('/exercises/blocks/catalogue?error=' + encodeURIComponent('Accès refusé'))
  }

  if (block.status !== 'published') {
    redirect('/exercises/blocks/catalogue?error=' + encodeURIComponent('Bloc non publié'))
  }

  const { preview, error: previewError } = await loadCoachBlockPreview(supabase, id)

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/exercises/blocks/catalogue"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Catalogue Krid
          </Link>
        </p>
        <PageTitle className="mt-2">{block.name}</PageTitle>
        <Muted className="mt-1">
          Déjà utilisable dans ton builder. Ajoute une copie seulement si tu veux le personnaliser.
        </Muted>
      </div>

      {previewError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{previewError}</p>
      ) : null}

      {preview ? <CoachBlockDetailView preview={preview} /> : null}

      <form action={forkKridBlockToDraftAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={block.id} />
        <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">
          Ajouter à ma biblio
        </Button>
      </form>
      <p className="-mt-3 text-xs text-[color:var(--muted)]">
        Copie dans tes brouillons (l’original Krid reste intact). Publie ensuite pour la ranger dans
        Ma biblio.
      </p>
    </div>
  )
}
