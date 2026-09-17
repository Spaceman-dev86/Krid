import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Body = {
  label?: string
  key?: string
  short_label?: string
  value_mode?: string
  list_options?: string[]
}

function slugKey(label: string, keyRaw: string) {
  const fromLabel = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return (keyRaw.trim() || fromLabel || 'unit').slice(0, 40)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!isPlatformAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  const label = String(body.label ?? '').trim()
  if (!label) {
    return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
  }

  const valueModeRaw = String(body.value_mode ?? 'number').trim()
  const value_mode =
    valueModeRaw === 'time' || valueModeRaw === 'text' || valueModeRaw === 'list'
      ? valueModeRaw
      : 'number'

  let list_options: string[] | null = null
  if (value_mode === 'list') {
    const opts = Array.isArray(body.list_options)
      ? body.list_options.map((x) => String(x).trim()).filter(Boolean)
      : []
    if (opts.length < 2) {
      return NextResponse.json(
        { error: 'Une liste nécessite au moins 2 options' },
        { status: 400 },
      )
    }
    list_options = [...new Set(opts)].slice(0, 50)
  }

  const key = slugKey(label, String(body.key ?? ''))
  const shortRaw = String(body.short_label ?? '').trim()
  if (!shortRaw) {
    return NextResponse.json(
      { error: 'Symbole / unité requis (ex. m, kg)' },
      { status: 400 },
    )
  }
  const short_label = shortRaw.slice(0, 12)
  const dimension =
    value_mode === 'time' ? 'time' : value_mode === 'text' || value_mode === 'list' ? 'other' : 'count'

  const { data, error } = await supabase
    .from('units' as never)
    .insert({
      coach_id: null,
      key,
      label,
      short_label,
      dimension,
      value_mode,
      list_options,
    } as never)
    .select('id, key, label, short_label, value_mode, list_options, dimension')
    .maybeSingle()

  if (error || !data) {
    // Fallback si migration 51/52 pas encore appliquée
    if (
      (value_mode === 'list' && /list_options|value_mode|check/i.test(error?.message ?? '')) ||
      /short_label/i.test(error?.message ?? '')
    ) {
      return NextResponse.json(
        {
          error:
            'Applique les migrations 51_units_list_mode.sql et 52_units_short_label_run_feedback.sql puis réessaie.',
        },
        { status: 400 },
      )
    }
    const msg = /unique|duplicate/i.test(error?.message ?? '')
      ? 'Cette unité existe déjà (clé unique).'
      : error?.message ?? 'Création impossible'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const row = data as {
    id: string
    key: string
    label: string
    short_label: string | null
    value_mode: string | null
    list_options: unknown
    dimension: string | null
  }

  return NextResponse.json({
    unit: {
      id: row.id,
      key: row.key,
      label: row.label,
      short_label: row.short_label,
      value_mode: row.value_mode,
      dimension: row.dimension,
      list_options: Array.isArray(row.list_options) ? (row.list_options as string[]) : null,
    },
  })
}
