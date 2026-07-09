/**
 * Importe le plan Top Body / « Remise en forme » depuis `src/data/remiseEnFormeMaisonPlan.ts`
 * en **remplaçant entièrement** la structure du programme (supprime toutes les `program_weeks`).
 *
 * Variables d’environnement : NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage :
 *   npx tsx scripts/seed-remise-en-forme-maison.ts <PROGRAM_UUID> --replace-all [--dry-run]
 *
 * Sans `--replace-all`, le script refuse de s’exécuter (écrasement dangereux).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  CALENDAR_WEEK_TO_TEMPLATE_INDEX,
  CARDIO_HINT_BY_CALENDAR_WEEK,
  REMISE_EN_FORME_MAISON_PROGRAM_META,
  TOP_BODY_PLAN_KEY_ALIASES,
  WEEK_TEMPLATES,
  type PlanCircuit,
  type PlanSlot,
} from '../src/data/remiseEnFormeMaisonPlan'

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type LibRow = { id: string; name: string | null; difficulty: string | null }

function resolveExerciseId(
  key: string,
  aliases: Record<string, readonly string[]>,
  library: LibRow[]
): string | null {
  const list = aliases[key] ?? [key.replace(/_/g, ' ')]
  const nn = (s: string) => norm(s)

  for (const row of library) {
    const n = nn(row.name ?? '')
    if (!n) continue
    if (n === nn(key.replace(/_/g, ' '))) return row.id
  }

  let best: { id: string; score: number } | null = null
  for (const row of library) {
    const n = nn(row.name ?? '')
    if (!n) continue
    for (const a of list) {
      const an = nn(a)
      if (!an) continue
      if (n.includes(an) || an.includes(n)) {
        const score = Math.min(n.length, an.length)
        if (!best || score > best.score) best = { id: row.id, score }
      }
    }
  }
  return best?.id ?? null
}

async function fetchAllExerciseLibrary(supabase: SupabaseClient): Promise<LibRow[]> {
  const page = 1000
  let from = 0
  const out: LibRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id,name,difficulty')
      .order('name', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`exercise_library: ${error.message}`)
    const rows = (data ?? []) as LibRow[]
    out.push(...rows)
    if (rows.length < page) break
    from += page
  }
  return out
}

async function appendBlockToSession(
  supabase: SupabaseClient,
  sessionId: string,
  blockId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('append_session_item_block', {
    p_session_id: sessionId,
    p_session_block_id: blockId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function insertCircuit(
  supabase: SupabaseClient,
  sessionId: string,
  circuitIndex: number,
  circuit: PlanCircuit,
  resolve: (k: string) => string | null,
  missing: Set<string>
) {
  const circuitTitle = `Circuit ${circuitIndex + 1}`
  const circuitNotes =
    'Enchaîner les 3 exercices (~10 min / tour). PDF : circuits 1 et 2 × 2 tours, circuit 3 × 1 tour — adapter selon ton niveau.'

  const { data: blockRow, error: bErr } = await supabase
    .from('session_blocks')
    .insert({
      program_session_id: sessionId,
      position: circuitIndex,
      type: 'strength',
      title: circuitTitle,
      notes: circuitNotes,
    })
    .select('id')
    .maybeSingle()

  if (bErr || !blockRow?.id) {
    throw new Error(`session_blocks insert: ${bErr?.message ?? 'no id'}`)
  }

  const blockId = String(blockRow.id)
  const append = await appendBlockToSession(supabase, sessionId, blockId)
  if (!append.ok) {
    throw new Error(`append_session_item_block: ${append.error ?? 'unknown'}`)
  }

  let pos = 0
  for (const slot of circuit) {
    const exId = resolve(slot.key)
    if (!exId) {
      missing.add(slot.key)
      pos += 1
      continue
    }
    const notes = [slot.notes, slot.sets != null ? `Séries: ${slot.sets}` : null, slot.reps != null ? `Reps: ${slot.reps}` : null]
      .filter(Boolean)
      .join(' · ')

    const { error: beErr } = await supabase.from('block_exercises').insert({
      session_block_id: blockId,
      position: pos,
      exercise_id: exId,
      exercise_name: null,
      notes: notes || null,
    })
    if (beErr) throw new Error(`block_exercises: ${beErr.message}`)
    pos += 1
  }
}

async function main() {
  const programId = process.argv[2]?.trim()
  const dryRun = process.argv.includes('--dry-run')
  const replaceAll = process.argv.includes('--replace-all')

  if (!programId || programId.startsWith('--')) {
    console.error('Usage: npx tsx scripts/seed-remise-en-forme-maison.ts <PROGRAM_UUID> --replace-all [--dry-run]')
    console.error('Sans --replace-all, ce script ne fait rien (sécurité). Édite le programme à la main dans le Program Builder si tu veux un import progressif.')
    process.exit(1)
  }

  if (!replaceAll) {
    console.error('Refus : ajoute --replace-all pour confirmer la suppression de toutes les semaines du programme.')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: program, error: pErr } = await supabase
    .from('programs')
    .select('id,title,coach_id,is_published')
    .eq('id', programId)
    .maybeSingle()

  if (pErr || !program) {
    console.error('Programme introuvable:', pErr?.message)
    process.exit(1)
  }

  const typed = program as { id: string; title: string | null; coach_id: string; is_published: boolean }
  if (typed.is_published) {
    console.error('Refus : programme publié (is_published = true). Duplique-le en brouillon avant import.')
    process.exit(1)
  }

  const library = await fetchAllExerciseLibrary(supabase)
  if (library.length === 0) {
    console.error('exercise_library vide.')
    process.exit(1)
  }

  const missing = new Set<string>()
  const resolve = (k: string) => {
    const id = resolveExerciseId(k, TOP_BODY_PLAN_KEY_ALIASES, library)
    if (!id) missing.add(k)
    return id
  }

  for (let w = 0; w < 12; w += 1) {
    const tpl = WEEK_TEMPLATES[CALENDAR_WEEK_TO_TEMPLATE_INDEX[w]!]!
    for (const sess of tpl.sessions) {
      for (const cir of sess.circuits) {
        for (const sl of cir) resolve(sl.key)
      }
    }
  }

  if (missing.size) {
    console.warn('Exercices non résolus (complète TOP_BODY_PLAN_KEY_ALIASES ou les noms en base) :')
    console.warn([...missing].sort().join(', '))
  }

  if (dryRun) {
    console.log('[dry-run] OK —', library.length, 'exercices ;', missing.size, 'clés manquantes.')
    process.exit(missing.size ? 2 : 0)
  }

  const { error: delWeeksErr } = await supabase.from('program_weeks').delete().eq('program_id', programId)
  if (delWeeksErr) {
    console.error('Suppression program_weeks:', delWeeksErr.message)
    process.exit(1)
  }

  const { error: metaErr } = await supabase
    .from('programs')
    .update({
      title: REMISE_EN_FORME_MAISON_PROGRAM_META.title,
      description: REMISE_EN_FORME_MAISON_PROGRAM_META.description,
      goal: REMISE_EN_FORME_MAISON_PROGRAM_META.goal,
      level: REMISE_EN_FORME_MAISON_PROGRAM_META.level,
      duration: REMISE_EN_FORME_MAISON_PROGRAM_META.duration,
    })
    .eq('id', programId)

  if (metaErr) {
    console.error('Mise à jour meta programme:', metaErr.message)
    process.exit(1)
  }

  for (let calendarWeek = 1; calendarWeek <= 12; calendarWeek += 1) {
    const tplIdx = CALENDAR_WEEK_TO_TEMPLATE_INDEX[calendarWeek - 1]!
    const tpl = WEEK_TEMPLATES[tplIdx]!

    const { data: weekRow, error: wInsErr } = await supabase
      .from('program_weeks')
      .insert({
        program_id: programId,
        title: `Semaine ${calendarWeek}`,
        week_order: calendarWeek,
      })
      .select('id')
      .maybeSingle()

    if (wInsErr || !weekRow?.id) throw new Error(`program_weeks: ${wInsErr?.message ?? 'no id'}`)
    const weekId = String(weekRow.id)

    const cardio = CARDIO_HINT_BY_CALENDAR_WEEK[calendarWeek - 1] ?? ''

    let sessionOrder = 0
    for (const sess of tpl.sessions) {
      const title = `Semaine ${calendarWeek} — ${sess.day} — ${sess.focus}`
      const description = [
        cardio,
        '',
        'Structure type Top Body Challenge : 3 circuits de 3 exercices ; enchaînement rapide, 1–2 min entre circuits.',
      ].join('\n')

      const { data: sessRow, error: sErr } = await supabase
        .from('sessions')
        .insert({
          week_id: weekId,
          title,
          description,
          session_order: sessionOrder,
        })
        .select('id')
        .maybeSingle()

      if (sErr || !sessRow?.id) throw new Error(`sessions: ${sErr?.message ?? 'no id'}`)
      const sessionId = String(sessRow.id)
      sessionOrder += 1

      for (let ci = 0; ci < sess.circuits.length; ci += 1) {
        await insertCircuit(supabase, sessionId, ci, sess.circuits[ci]!, resolve, missing)
      }
    }
  }

  console.log('Import terminé pour', programId, '—', missing.size ? `Attention: ${missing.size} clés non résolues (slots vides).` : 'Toutes les clés résolues.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
