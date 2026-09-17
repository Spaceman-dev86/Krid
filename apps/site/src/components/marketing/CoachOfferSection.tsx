import { createClient } from '../../lib/supabase/server'
import CoachOfferSectionClient, { type CoachOfferIconPair, type CoachOfferIcons } from './CoachOfferSectionClient'

function readPublicUrl(data: unknown): string | null {
  return (data as { publicUrl?: string } | null)?.publicUrl ?? null
}

function iconPair(
  supabase: Awaited<ReturnType<typeof createClient>>,
  defaultName: string,
  hoverName?: string
): CoachOfferIconPair {
  const hoverFile = hoverName ?? `${defaultName}2`
  return {
    default: readPublicUrl(
      supabase.storage.from('home_page').getPublicUrl(`1-accueil/${defaultName}.png`).data
    ),
    hover: readPublicUrl(
      supabase.storage.from('home_page').getPublicUrl(`1-accueil/${hoverFile}.png`).data
    ),
  }
}

export default async function CoachOfferSection() {
  const supabase = await createClient()

  const icons: CoachOfferIcons = {
    runner: iconPair(supabase, 'offer-coureur'),
    bike: iconPair(supabase, 'pull-up-bar_1', 'pull-up-bar_2'),
    dumbbell: iconPair(supabase, 'run','run_2'),
  }

  return <CoachOfferSectionClient icons={icons} />
}
