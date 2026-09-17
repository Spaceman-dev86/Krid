'use server'

import { createServiceRoleClient } from '../../../../lib/supabase/serviceRole'

type ProvisionInput = {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

type ProvisionResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; code?: 'already_exists' | 'config' }

async function findAuthUserByEmail(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  email: string
) {
  const normalized = email.trim().toLowerCase()
  // GoTrue admin: filter by email
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) return null

  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    cache: 'no-store',
  })

  if (res.ok) {
    const body = (await res.json()) as { users?: Array<{ id: string; email?: string }> } | { id?: string }
    if ('users' in body && Array.isArray(body.users)) {
      return body.users.find((u) => u.email?.toLowerCase() === normalized) ?? body.users[0] ?? null
    }
    if ('id' in body && body.id) return body as { id: string; email?: string }
  }

  // Fallback pagination (petits projets)
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

/**
 * Crée un compte client déjà confirmé (pas d’email de confirmation),
 * ou confirme + met à jour le mdp si le compte existe déjà non confirmé.
 */
export async function provisionConfirmedClientUser(input: ProvisionInput): Promise<ProvisionResult> {
  const admin = createServiceRoleClient()
  if (!admin) {
    return {
      ok: false,
      code: 'config',
      error: 'Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY).',
    }
  }

  const email = input.email.trim().toLowerCase()
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: 'client',
      password_set: true,
      full_name: fullName || undefined,
    },
  })

  if (!createError && created.user) {
    const now = new Date().toISOString()
    await admin
      .from('profiles')
      .update({
        role: 'client',
        email,
        password_set_at: now,
        full_name: fullName || null,
        updated_at: now,
      } as never)
      .eq('id', created.user.id)
    return { ok: true, userId: created.user.id }
  }

  const msg = createError?.message ?? 'Création impossible'
  if (!/already|registered|exists|duplicate/i.test(msg)) {
    return { ok: false, error: msg }
  }

  const existing = await findAuthUserByEmail(admin, email)
  if (!existing?.id) {
    return { ok: false, code: 'already_exists', error: 'Un compte existe déjà pour cet email.' }
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password: input.password,
    user_metadata: {
      role: 'client',
      password_set: true,
      full_name: fullName || undefined,
    },
  })

  if (updateError) {
    return { ok: false, code: 'already_exists', error: updateError.message }
  }

  const now = new Date().toISOString()
  await admin
    .from('profiles')
    .update({
      role: 'client',
      email,
      password_set_at: now,
      full_name: fullName || null,
      updated_at: now,
    } as never)
    .eq('id', existing.id)

  return { ok: true, userId: existing.id }
}

/** Confirme un compte bloqué sur « Email not confirmed » (même email + mdp saisis). */
export async function confirmClientEmailForLogin(input: {
  email: string
  password: string
}): Promise<ProvisionResult> {
  return provisionConfirmedClientUser({
    email: input.email,
    password: input.password,
  })
}

function ageToBirthDate(age: number): string {
  const year = new Date().getFullYear() - age
  return `${year}-01-01`
}

function friendlyLinkError(raw: string): string {
  const msg = raw.trim()
  if (msg === 'coach_not_found') {
    return 'Coach introuvable pour ce lien. Vérifie l’URL /c/… ou le compte coach.'
  }
  if (msg === 'not_authenticated') return 'Session expirée — reconnecte-toi.'
  if (msg === 'coach_cannot_be_client') return 'Un compte coach ne peut pas s’inscrire comme client.'
  if (msg === 'client_linked_to_other_user') {
    return 'Cet email est déjà lié à un autre compte pour ce coach.'
  }
  if (msg === 'profile_email_missing') return 'Email manquant sur le profil — réessaie.'
  return msg
}

/**
 * Lie le user connecté au coach du slug (fiche `clients` + rôle client).
 * Service role : ne dépend pas du check RPC `profiles.role = coach`
 * (qui renvoie `coach_not_found` si le rôle coach est incohérent alors que le branding existe).
 */
export async function linkAuthenticatedUserToCoach(input: {
  slug: string
  firstName?: string
  lastName?: string
  sex?: string
  age?: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { createClient } = await import('../../../../lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: friendlyLinkError('not_authenticated') }

  const admin = createServiceRoleClient()
  if (!admin) {
    return {
      ok: false,
      error: 'Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY).',
    }
  }

  const slug = input.slug.trim()
  const { data: branding, error: brandingError } = await admin
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()

  if (brandingError) return { ok: false, error: brandingError.message }
  if (!branding?.coach_id) {
    return { ok: false, error: 'Lien coach invalide (showroom introuvable).' }
  }

  const coachId = branding.coach_id
  if (user.id === coachId) {
    return { ok: false, error: friendlyLinkError('coach_cannot_be_client') }
  }

  const { data: coachProfile } = await admin
    .from('profiles')
    .select('id, role, deleted_at')
    .eq('id', coachId)
    .maybeSingle()

  if (!coachProfile || coachProfile.deleted_at) {
    return { ok: false, error: friendlyLinkError('coach_not_found') }
  }

  // Si le branding existe mais le rôle a dérivé, on ré-aligne pour les checks futurs.
  if (!['coach', 'admin', 'platform_admin'].includes(String(coachProfile.role ?? ''))) {
    await admin
      .from('profiles')
      .update({ role: 'coach', updated_at: new Date().toISOString() } as never)
      .eq('id', coachId)
  }

  const firstName = (input.firstName ?? '').trim()
  const lastName = (input.lastName ?? '').trim()
  const sex = (input.sex ?? '').trim()
  const sexNorm = sex === 'Autre' ? 'X' : sex || null
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const birthDate =
    input.age != null && Number.isFinite(input.age) && input.age >= 10 && input.age <= 100
      ? ageToBirthDate(input.age)
      : null

  let email = (user.email ?? '').trim().toLowerCase()
  if (!email) {
    const { data: prof } = await admin.from('profiles').select('email').eq('id', user.id).maybeSingle()
    email = String(prof?.email ?? '')
      .trim()
      .toLowerCase()
  }
  if (!email) return { ok: false, error: friendlyLinkError('profile_email_missing') }

  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('clients')
    .select('id, user_id')
    .eq('coach_id', coachId)
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    if (existing.user_id && existing.user_id !== user.id) {
      return { ok: false, error: friendlyLinkError('client_linked_to_other_user') }
    }
    const { error: updErr } = await admin
      .from('clients')
      .update({
        user_id: user.id,
        status: 'active',
        first_name: firstName || null,
        last_name: lastName || null,
        sex: sexNorm,
        birth_date: birthDate,
        updated_at: now,
      } as never)
      .eq('id', existing.id)
    if (updErr) return { ok: false, error: updErr.message }
  } else {
    const { error: insErr } = await admin.from('clients').insert({
      coach_id: coachId,
      user_id: user.id,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      sex: sexNorm,
      birth_date: birthDate,
      status: 'active',
      created_at: now,
      updated_at: now,
    } as never)
    if (insErr) return { ok: false, error: insErr.message }
  }

  // Ne jamais écraser un profil coach / admin (même si la session est ambiguë).
  const { data: selfProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const selfRole = String(selfProfile?.role ?? '')
  if (['coach', 'admin', 'platform_admin'].includes(selfRole)) {
    return { ok: false, error: friendlyLinkError('coach_cannot_be_client') }
  }

  const { data: selfBranding } = await admin
    .from('coach_branding')
    .select('coach_id')
    .eq('coach_id', user.id)
    .maybeSingle()
  if (selfBranding) {
    return { ok: false, error: friendlyLinkError('coach_cannot_be_client') }
  }

  await admin
    .from('profiles')
    .update({
      role: 'client',
      email,
      full_name: fullName || null,
      password_set_at: now,
      updated_at: now,
    } as never)
    .eq('id', user.id)
    .neq('role', 'coach')
    .neq('role', 'admin')
    .neq('role', 'platform_admin')

  const { attributeClientTrackedLink } = await import('../../../../lib/tracking/recordShowroomRef')
  await attributeClientTrackedLink({ coachId, clientUserId: user.id })

  return { ok: true }
}

/**
 * Après login/signup showroom : écrit prénom/nom/sexe/âge sur `clients` (CRM coach)
 * + `full_name` sur `profiles` (affichage).
 */
export async function syncClientSignupProfile(input: {
  slug: string
  coachId: string
  firstName: string
  lastName: string
  sex: string
  age: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void input.coachId
  return linkAuthenticatedUserToCoach({
    slug: input.slug,
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex,
    age: input.age,
  })
}
