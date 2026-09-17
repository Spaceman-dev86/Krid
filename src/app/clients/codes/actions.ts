'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

function clean(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}

function randomCode(prefix: string, len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let body = ''
  for (let i = 0; i < len; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}${body}`
}

function parseAmountCents(raw: string | null) {
  if (!raw) return null
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function durationToExpires(duration: string | null): Date | null {
  if (!duration || duration === 'none') return null
  const now = Date.now()
  const map: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  const ms = map[duration]
  if (!ms) return null
  return new Date(now + ms)
}

export async function createAccessCodeAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const prestationId = clean(formData.get('prestation_id'))
  const amountRaw = clean(formData.get('amount_euros'))
  const amountCents = parseAmountCents(amountRaw)

  if (!prestationId) redirect('/clients/codes?error=' + encodeURIComponent('Prestation requise'))
  if (amountCents == null) {
    redirect('/clients/codes?error=' + encodeURIComponent('Montant invalide'))
  }

  const { data: presta } = await supabase
    .from('prestations')
    .select('id, status')
    .eq('id', prestationId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta || presta.status === 'archived') {
    redirect('/clients/codes?error=' + encodeURIComponent('Prestation introuvable'))
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  let code = randomCode('A')
  let lastError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('coach_codes').insert({
      coach_id: user.id,
      type: 'access',
      code,
      prestation_id: prestationId,
      amount_cents: amountCents,
      max_uses: 1,
      expires_at: expiresAt,
      audience: 'public',
      status: 'active',
    } as never)

    if (!error) {
      revalidatePath('/clients/codes')
      redirect(`/clients/codes?created=${encodeURIComponent(code)}`)
    }
    lastError = error.message
    if (/unique|duplicate/i.test(error.message)) {
      code = randomCode('A')
      continue
    }
    break
  }

  redirect('/clients/codes?error=' + encodeURIComponent(lastError ?? 'Création impossible'))
}

export async function createPromoCodeAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const customCode = clean(formData.get('code'))
  const percentRaw = clean(formData.get('percent_off'))
  const percent = percentRaw ? Number(percentRaw) : NaN
  const duration = clean(formData.get('duration'))
  const maxUsesRaw = clean(formData.get('max_uses'))
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null
  const audience = clean(formData.get('audience')) ?? 'public'
  const audienceClientId = clean(formData.get('audience_client_id'))
  const audienceGroupId = clean(formData.get('audience_group_id'))
  const audiencePrestationId = clean(formData.get('audience_prestation_id'))

  const prestationIds = formData
    .getAll('prestation_ids')
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)

  if (!Number.isFinite(percent) || percent < 5 || percent > 100 || percent % 5 !== 0) {
    redirect('/clients/codes?error=' + encodeURIComponent('Remise : 5 à 100 % par pas de 5'))
  }
  if (!prestationIds.length) {
    redirect('/clients/codes?error=' + encodeURIComponent('Choisis au moins une prestation'))
  }

  const expiresAt = durationToExpires(duration)
  if (!expiresAt && (maxUses == null || !Number.isFinite(maxUses) || maxUses < 1)) {
    redirect(
      '/clients/codes?error=' +
        encodeURIComponent('Indique une durée et/ou un max d’utilisations')
    )
  }

  if (!['public', 'client', 'group', 'presta_clients'].includes(audience)) {
    redirect('/clients/codes?error=' + encodeURIComponent('Audience invalide'))
  }
  if (audience === 'client' && !audienceClientId) {
    redirect('/clients/codes?error=' + encodeURIComponent('Choisis un client'))
  }
  if (audience === 'group' && !audienceGroupId) {
    redirect('/clients/codes?error=' + encodeURIComponent('Choisis un groupe'))
  }
  if (audience === 'presta_clients' && !audiencePrestationId) {
    redirect('/clients/codes?error=' + encodeURIComponent('Choisis une prestation audience'))
  }

  const { data: owned } = await supabase
    .from('prestations')
    .select('id')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .in('id', prestationIds)

  if ((owned ?? []).length !== prestationIds.length) {
    redirect('/clients/codes?error=' + encodeURIComponent('Prestation invalide'))
  }

  const code = (customCode ?? randomCode('P')).toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) {
    redirect(
      '/clients/codes?error=' +
        encodeURIComponent('Code : 3–24 caractères (A–Z, 0–9, tiret)')
    )
  }

  const { error } = await supabase.from('coach_codes').insert({
    coach_id: user.id,
    type: 'promo',
    code,
    percent_off: percent,
    prestation_ids: prestationIds,
    audience,
    audience_client_id: audience === 'client' ? audienceClientId : null,
    audience_group_id: audience === 'group' ? audienceGroupId : null,
    audience_prestation_id: audience === 'presta_clients' ? audiencePrestationId : null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    max_uses: maxUses != null && Number.isFinite(maxUses) && maxUses >= 1 ? Math.floor(maxUses) : null,
    status: 'active',
  } as never)

  if (error) {
    const msg = /unique|duplicate/i.test(error.message)
      ? 'Ce code existe déjà.'
      : error.message
    redirect('/clients/codes?error=' + encodeURIComponent(msg))
  }

  revalidatePath('/clients/codes')
  redirect(`/clients/codes?created=${encodeURIComponent(code)}`)
}

export async function revokeCodeAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const codeId = clean(formData.get('code_id'))
  if (!codeId) redirect('/clients/codes')

  const { error } = await supabase
    .from('coach_codes')
    .update({ status: 'revoked' } as never)
    .eq('id', codeId)
    .eq('coach_id', user.id)

  if (error) redirect('/clients/codes?error=' + encodeURIComponent(error.message))

  revalidatePath('/clients/codes')
  redirect('/clients/codes?revoked=1')
}
