'use server'

import crypto from 'node:crypto'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../../lib/supabase/serviceRole'
import { sendProgramShareEmail } from '../../../../../lib/sendProgramShareEmail'

export type ShareProgramState = { error: string } | { success: true } | null

function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

function isValidEmail(email: string): boolean {
  const v = email.trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function shareProgramPreviewByEmail(
  _prev: ShareProgramState,
  formData: FormData
): Promise<ShareProgramState> {
  const programId = String(formData.get('programId') ?? '').trim()
  const to = String(formData.get('to') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()

  if (!programId) return { error: 'Programme introuvable.' }
  if (!isValidEmail(to)) return { error: 'Email invalide.' }
  if (message.length > 2000) return { error: 'Message trop long (max 2000 caractères).' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (profileData as { role: string | null } | null)?.role
  if (role !== 'admin') return { error: 'Action réservée aux administrateurs.' }

  const { data: program } = await supabase
    .from('programs')
    .select('id,title')
    .eq('id', programId)
    .maybeSingle()
  const typedProgram = program as { id: string; title: string | null } | null
  if (!typedProgram) return { error: 'Programme introuvable.' }

  const service = createServiceRoleClient()
  if (!service) return { error: 'Config manquante: SUPABASE_SERVICE_ROLE_KEY.' }

  const token = randomToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() // 14 days

  const { error: insertError } = await service
    .from('program_share_links')
    .insert({
      token,
      program_id: programId,
      created_by: user.id,
      recipient_email: to,
      message: message || null,
      expires_at: expiresAt,
    } as unknown as never)

  if (insertError) return { error: insertError.message ?? 'Impossible de créer le lien.' }

  const origin = String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (!origin) {
    return { error: 'NEXT_PUBLIC_SITE_URL manquant (ex: https://ton-site.com).' }
  }

  const shareUrl = `${origin.replace(/\/$/, '')}/preview/${token}`
  const send = await sendProgramShareEmail({
    to,
    programTitle: typedProgram.title ?? 'Programme',
    message,
    shareUrl,
  })
  if (!send.ok) return { error: send.error }

  return { success: true }
}

