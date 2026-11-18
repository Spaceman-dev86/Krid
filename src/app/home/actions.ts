'use server'

import { redirect } from 'next/navigation'

import { coachBrandingBucket } from '../../lib/coachBrandingStorage'
import { revalidateCoachBranding } from '../../lib/coach/revalidateCoachBranding'
import { uploadCoachLogoImage, uploadCoachPwaIconImage } from '../../lib/uploadCoachLogo'
import { safeInternalPath } from '../../lib/navigation/safeReturnTo'
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

export type BrandingSaveResult = { ok: true } | { ok: false; error: string }

async function persistCoachBranding(formData: FormData): Promise<BrandingSaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Non connecté' }

  const appName = clean(formData.get('app_name'))
  const slugInput = clean(formData.get('slug'))
  const slug = slugify(slugInput || appName || 'mon-app')
  const primaryColor = clean(formData.get('primary_color'))
  const secondaryColor = clean(formData.get('secondary_color'))
  const themeModeRaw = clean(formData.get('theme_mode'))
  const bgStyleRaw = clean(formData.get('bg_style'))
  const themeMode = themeModeRaw === 'light' ? 'light' : 'dark'
  const bgStyle = bgStyleRaw === 'solid' ? 'solid' : 'carbon'
  const clearLogo = formData.get('clear_logo') === 'on'
  const logoFile = formData.get('logo')

  if (!slug) return { ok: false, error: 'Slug invalide' }

  const hasContactFields = formData.has('contact_instagram')
  const contactInstagram = hasContactFields
    ? clean(formData.get('contact_instagram'))?.replace(/^@+/, '') ?? null
    : undefined
  const contactWhatsapp = hasContactFields
    ? clean(formData.get('contact_whatsapp'))?.replace(/\D/g, '') || null
    : undefined
  const contactFacebook = hasContactFields ? clean(formData.get('contact_facebook')) : undefined

  const { data: existing } = await supabase
    .from('coach_branding')
    .select(
      'slug, logo_url, pwa_icon_url, app_showroom_title, app_showroom_pitch, app_showroom_features, contact_instagram, contact_whatsapp, contact_facebook'
    )
    .eq('coach_id', user.id)
    .maybeSingle()

  let logoUrl: string | null = existing?.logo_url ?? null

  if (clearLogo) {
    logoUrl = null
  }

  if (isUploadedImage(logoFile)) {
    const uploaded = await uploadCoachLogoImage(user.id, logoFile as File)
    if (!uploaded.ok) return { ok: false, error: uploaded.error }
    logoUrl = uploaded.imageUrl
  }

  const existingExtra = existing as {
    contact_instagram?: string | null
    contact_whatsapp?: string | null
    contact_facebook?: string | null
    app_showroom_features?: unknown
  } | null

  const { error } = await supabase.from('coach_branding').upsert(
    {
      coach_id: user.id,
      slug,
      app_name: appName,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      theme_mode: themeMode,
      bg_style: bgStyle,
      logo_url: logoUrl,
      // ne pas écraser l’icône PWA ni la présentation showroom (éditée sur /profile)
      pwa_icon_url: existing?.pwa_icon_url ?? null,
      app_showroom_title: existing?.app_showroom_title ?? null,
      app_showroom_pitch: existing?.app_showroom_pitch ?? null,
      app_showroom_features: existingExtra?.app_showroom_features ?? [],
      contact_instagram:
        contactInstagram !== undefined
          ? contactInstagram
          : (existingExtra?.contact_instagram ?? null),
      contact_whatsapp:
        contactWhatsapp !== undefined
          ? contactWhatsapp
          : (existingExtra?.contact_whatsapp ?? null),
      contact_facebook:
        contactFacebook !== undefined
          ? contactFacebook
          : (existingExtra?.contact_facebook ?? null),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'coach_id' },
  )

  if (error) return { ok: false, error: error.message }

  revalidateCoachBranding(slug, { prevSlug: existing?.slug })
  return { ok: true }
}

export async function saveCoachBrandingAction(formData: FormData) {
  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/mon-app')
  const result = await persistCoachBranding(formData)
  if (!result.ok) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(
        result.error === 'Slug invalide' ? 'slug' : result.error,
      )}`,
    )
  }
  redirect(`${returnTo}?saved=1`)
}

/** Autosave DA Mon app (pas de redirect). */
export async function autosaveCoachBrandingAction(
  formData: FormData,
): Promise<BrandingSaveResult> {
  return persistCoachBranding(formData)
}

export async function clearCoachLogoAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/mon-app')

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()

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

  revalidateCoachBranding(existing?.slug)
  redirect(`${returnTo}?saved=1`)
}

/** Upload logo seul (auto-save depuis le champ fichier). */
export async function saveCoachLogoAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/mon-app')
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
    .select('slug, app_name, primary_color, pwa_icon_url, secondary_color, theme_mode, bg_style')
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
      secondary_color: existing?.secondary_color ?? null,
      theme_mode: existing?.theme_mode ?? 'dark',
      bg_style: existing?.bg_style ?? 'carbon',
      pwa_icon_url: existing?.pwa_icon_url ?? null,
      logo_url: uploaded.imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  )

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidateCoachBranding(slug)
  redirect(`${returnTo}?saved=1`)
}

export async function clearCoachPwaIconAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/mon-app')

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('coach_branding')
    .update({ pwa_icon_url: null, updated_at: new Date().toISOString() })
    .eq('coach_id', user.id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  const service = createServiceRoleClient()
  if (service) {
    await service.storage.from(coachBrandingBucket()).remove([
      `${user.id}/pwa-icon.jpg`,
      `${user.id}/pwa-icon.png`,
      `${user.id}/pwa-icon.webp`,
      `${user.id}/pwa-icon.gif`,
    ])
  }

  revalidateCoachBranding(existing?.slug)
  redirect(`${returnTo}?saved=1`)
}

/** Upload icône PWA (écran d’accueil) — distinct du logo showroom. */
export async function saveCoachPwaIconAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/mon-app')
  const iconFile = formData.get('pwa_icon')

  if (!isUploadedImage(iconFile)) {
    redirect(`${returnTo}?error=${encodeURIComponent('Choisis une image.')}`)
  }

  const uploaded = await uploadCoachPwaIconImage(user.id, iconFile as File)
  if (!uploaded.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(uploaded.error)}`)
  }

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('slug, app_name, primary_color, logo_url, secondary_color, theme_mode, bg_style')
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
      secondary_color: existing?.secondary_color ?? null,
      theme_mode: existing?.theme_mode ?? 'dark',
      bg_style: existing?.bg_style ?? 'carbon',
      logo_url: existing?.logo_url ?? null,
      pwa_icon_url: uploaded.imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  )

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidateCoachBranding(slug)
  redirect(`${returnTo}?saved=1`)
}
