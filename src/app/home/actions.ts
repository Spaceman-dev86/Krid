'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { coachBrandingBucket } from '../../lib/coachBrandingStorage'
import { uploadCoachLogoImage } from '../../lib/uploadCoachLogo'
import { createClient } from '../../lib/supabase/server'
import { createServiceRoleClient } from '../../lib/supabase/serviceRole'

function slugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

function isUploadedImage(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== 'object') return false
  const f = value as { size?: unknown; arrayBuffer?: unknown; name?: unknown; type?: unknown }
  return (
    typeof f.size === 'number' &&
    f.size > 0 &&
    typeof f.arrayBuffer === 'function' &&
    (typeof f.name !== 'string' || f.name.length > 0)
  )
}

export async function saveCoachBrandingAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/mon-app'
  const appName = clean(formData.get('app_name'))
  const slugInput = clean(formData.get('slug'))
  const slug = slugify(slugInput || appName || 'mon-app')
  const primaryColor = clean(formData.get('primary_color'))
  const clearLogo = formData.get('clear_logo') === 'on'
  const logoFile = formData.get('logo')

  if (!slug) {
    redirect(`${returnTo}?error=slug`)
  }

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('logo_url')
    .eq('coach_id', user.id)
    .maybeSingle()

  let logoUrl: string | null = existing?.logo_url ?? null

  if (clearLogo) {
    logoUrl = null
  }

  if (isUploadedImage(logoFile)) {
    const uploaded = await uploadCoachLogoImage(user.id, logoFile as File)
    if (!uploaded.ok) {
      redirect(`${returnTo}?error=${encodeURIComponent(uploaded.error)}`)
    }
    logoUrl = uploaded.imageUrl
  }

  const { error } = await supabase.from('coach_branding').upsert(
    {
      coach_id: user.id,
      slug,
      app_name: appName,
      primary_color: primaryColor,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  )

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/home')
  revalidatePath('/profile/mon-app')
  revalidatePath('/profile')
  redirect(`${returnTo}?saved=1`)
}

export async function clearCoachLogoAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/mon-app'

  const { error } = await supabase
    .from('coach_branding')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('coach_id', user.id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  const service = createServiceRoleClient()
  if (service) {
    await service.storage.from(coachBrandingBucket()).remove([
      `${user.id}/logo.jpg`,
      `${user.id}/logo.png`,
      `${user.id}/logo.webp`,
      `${user.id}/logo.gif`,
    ])
  }

  revalidatePath('/home')
  revalidatePath('/profile/mon-app')
  revalidatePath('/profile')
  redirect(`${returnTo}?saved=1`)
}

/** Upload logo seul (auto-save depuis le champ fichier). */
export async function saveCoachLogoAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/mon-app'
  const logoFile = formData.get('logo')

  if (!isUploadedImage(logoFile)) {
    redirect(`${returnTo}?error=${encodeURIComponent('Choisis une image.')}`)
  }

  const uploaded = await uploadCoachLogoImage(user.id, logoFile as File)
  if (!uploaded.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(uploaded.error)}`)
  }

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('slug, app_name, primary_color')
    .eq('coach_id', user.id)
    .maybeSingle()

  const slug = existing?.slug?.trim() || slugify(existing?.app_name || 'mon-app')
  if (!slug) {
    redirect(`${returnTo}?error=slug`)
  }

  const { error } = await supabase.from('coach_branding').upsert(
    {
      coach_id: user.id,
      slug,
      app_name: existing?.app_name ?? null,
      primary_color: existing?.primary_color ?? null,
      logo_url: uploaded.imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  )

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/home')
  revalidatePath('/profile/mon-app')
  revalidatePath('/profile')
  redirect(`${returnTo}?saved=1`)
}
