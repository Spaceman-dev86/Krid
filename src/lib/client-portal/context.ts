import { redirect } from 'next/navigation'

import { hasPasswordSet } from '../auth/password'
import type { createClient } from '../supabase/server'
import { createServiceRoleClient } from '../supabase/serviceRole'
import { tryClaimClientForCoach, tryClaimClientRowsByEmail } from './claimClient'
import { clientNeedsOnboarding } from './onboarding'
import { pickClientCoachIdForAuthUser, pickClientForAuthUser } from './pickClientForAuth'
import { parseModules, type PrestationModuleId } from '../prestations/modules'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type ClientPortalContext = {
  slug: string
  appName: string
  primaryColor: string
  logoUrl: string | null
  coachId: string
  /** Modules unionnés des grants actifs. */
  modules: string[]
  client: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    status: string
    onboarding_completed_at: string | null
  }
}

export function hasPortalModule(ctx: ClientPortalContext, moduleId: PrestationModuleId | string) {
  return ctx.modules.includes(moduleId)
}

/** Redirige vers Accueil si le module n’est pas dans un grant actif. */
export function requirePortalModule(ctx: ClientPortalContext, moduleId: PrestationModuleId | string) {
  if (!hasPortalModule(ctx, moduleId)) {
    redirect(`/c/${ctx.slug}/home?module=locked`)
  }
}

/** Résout /c/[slug]/home pour un user client lié. */
export async function resolveClientPortalHome(
  supabase: Supabase,
  userId: string
): Promise<string | null> {
  let client = await pickClientCoachIdForAuthUser(supabase, userId)

  if (!client) {
    await tryClaimClientRowsByEmail(supabase)
    client = await pickClientCoachIdForAuthUser(supabase, userId)
  }

  if (!client) return null

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', client.coach_id)
    .maybeSingle()

  if (!branding?.slug) {
    const admin = createServiceRoleClient()
    if (admin) {
      const { data } = await admin
        .from('coach_branding')
        .select('slug')
        .eq('coach_id', client.coach_id)
        .maybeSingle()
      return data?.slug ? `/c/${data.slug}/home` : null
    }
    return null
  }

  return `/c/${branding.slug}/home`
}

export async function requireClientPortal(
  supabase: Supabase,
  slug: string,
  userId: string | undefined,
  opts?: { skipOnboardingGate?: boolean; skipPasswordGate?: boolean }
): Promise<ClientPortalContext> {
  if (!userId) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(`/c/${slug}/home`)}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug, app_name, primary_color, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role === 'coach' || profile?.role === 'admin' || profile?.role === 'platform_admin') {
    redirect(`/login/client?error=coach_session&redirectTo=${encodeURIComponent(`/c/${slug}/home`)}`)
  }

  let client = await pickClientForAuthUser(supabase, userId, branding.coach_id)

  if (!client) {
    const claimed = await tryClaimClientForCoach(supabase, branding.coach_id)
    if (claimed) {
      client = await pickClientForAuthUser(supabase, userId, branding.coach_id)
    }
  }

  if (!client) {
    await tryClaimClientRowsByEmail(supabase)
    client = await pickClientForAuthUser(supabase, userId, branding.coach_id)
  }

  if (!client) {
    redirect(`/c/${slug}/showroom?error=not_your_coach`)
  }

  const { data: grants } = await supabase
    .from('client_grants')
    .select('modules')
    .eq('client_id', client.id)
    .eq('coach_id', branding.coach_id)
    .eq('status', 'active')

  const modules = Array.from(
    new Set((grants ?? []).flatMap((g) => parseModules(g.modules)))
  )

  const ctx = buildPortalContext(branding, client, modules)

  // Avant onboarding : forcer le set-password après 1er accès sans mdp
  if (!opts?.skipPasswordGate) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && !(await hasPasswordSet(supabase, user))) {
      const next = encodeURIComponent(`/c/${slug}/home`)
      redirect(`/auth/update-password?mode=set&next=${next}`)
    }
  }

  if (!opts?.skipOnboardingGate) {
    const needs = await clientNeedsOnboarding(supabase, {
      coachId: branding.coach_id,
      clientId: client.id,
      onboardingCompletedAt: client.onboarding_completed_at ?? null,
    })
    if (needs) {
      redirect(`/c/${slug}/onboarding`)
    }
  }

  return ctx
}

function buildPortalContext(
  branding: {
    coach_id: string
    slug: string
    app_name: string | null
    primary_color: string | null
    logo_url?: string | null
  },
  client: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    status: string
    onboarding_completed_at?: string | null
  },
  modules: string[]
): ClientPortalContext {
  return {
    slug: branding.slug,
    appName: branding.app_name?.trim() || 'Mon coach',
    primaryColor: branding.primary_color?.trim() || '#341c44',
    logoUrl: branding.logo_url?.trim() || null,
    coachId: branding.coach_id,
    modules,
    client: {
      id: client.id,
      email: client.email,
      first_name: client.first_name,
      last_name: client.last_name,
      phone: client.phone,
      status: client.status,
      onboarding_completed_at: client.onboarding_completed_at ?? null,
    },
  }
}
