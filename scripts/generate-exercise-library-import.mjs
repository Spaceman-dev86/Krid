import fs from 'fs'
import path from 'path'

const inputPath = process.argv[2] || 'c:/Users/remis/Downloads/exercise_library_rows.sql'
const outputPath =
  process.argv[3] || path.join('supabase/migrations/slices/11a_exercise_library_trainly.sql')

const raw = fs.readFileSync(inputPath, 'utf8')
const valuesIdx = raw.indexOf('VALUES')
if (valuesIdx === -1) throw new Error('No VALUES in input')

const body = raw.slice(valuesIdx + 6).trim().replace(/;\s*$/, '')

function parseRows(s) {
  const rows = []
  let pos = 0
  while (pos < s.length) {
    const p = s.indexOf('(', pos)
    if (p === -1) break
    let depth = 0
    let inStr = false
    let start = p
    for (let j = p; j < s.length; j++) {
      const c = s[j]
      if (inStr) {
        if (c === "'" && s[j + 1] === "'") {
          j++
          continue
        }
        if (c === "'") inStr = false
      } else {
        if (c === "'") inStr = true
        else if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) {
            rows.push(s.slice(start, j + 1))
            pos = j + 1
            break
          }
        }
      }
    }
    if (pos <= p) break
  }
  return rows
}

function splitFields(tupleInner) {
  const inner = tupleInner.slice(1, -1)
  const fields = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (inStr) {
      if (c === "'" && inner[i + 1] === "'") {
        cur += "'"
        i++
      } else if (c === "'") {
        inStr = false
      } else {
        cur += c
      }
    } else {
      if (c === "'") {
        inStr = true
      } else if (c === ',' && !inStr) {
        fields.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
  }
  fields.push(cur.trim())
  return fields
}

function unquote(field) {
  if (field === 'null') return null
  if (field.startsWith("'") && field.endsWith("'")) {
    return field.slice(1, -1).replace(/''/g, "'")
  }
  return field
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

function normalizeMediaPath(pathValue) {
  if (!pathValue) return null
  let p = pathValue.trim().replace(/^\/+/, '')
  if (p.toLowerCase().startsWith('exercise-media/')) {
    p = p.slice('exercise-media/'.length)
  }
  // Old subfolders → flat bucket (files uploaded at root)
  const slash = p.lastIndexOf('/')
  if (slash !== -1) {
    p = p.slice(slash + 1)
  }
  return p
}

const rows = parseRows(body)
const parsed = rows.map((tuple) => {
  const f = splitFields(tuple)
  const [
    id,
    name,
    description,
    muscle_group,
    difficulty,
    video_url,
    common_mistakes,
    created_at,
    demo_media_path,
    replacement_exercise_id,
  ] = f.map(unquote)

  let desc = description || ''
  if (common_mistakes) {
    const cm = common_mistakes.trim()
    if (cm) {
      desc = desc ? `${desc.trim()}\n\n${cm}` : cm
    }
  }

  return {
    id,
    name,
    description: desc || null,
    muscle_group,
    difficulty,
    video_url,
    created_at,
    demo_media_path: normalizeMediaPath(demo_media_path),
    replacement_exercise_id,
  }
})

const header = `-- =============================================================================
-- TRANCHE 11a — Catalogue Trainly exercise_library (import ancien projet)
-- Prérequis : 10_programs
-- Bucket : exercise-media (fichiers à la racine du bucket)
-- Après Run : dis « 11a OK »
-- =============================================================================

BEGIN;

-- Pass 1 : insert sans replacement_exercise_id (FK self)
INSERT INTO public.exercise_library (
  id,
  coach_id,
  name,
  description,
  muscle_group,
  difficulty,
  video_url,
  demo_media_path,
  replacement_exercise_id,
  created_at,
  updated_at,
  deleted_at
)
VALUES
`

const valueLines = parsed.map((r) => {
  return `  (${sqlStr(r.id)}, NULL, ${sqlStr(r.name)}, ${sqlStr(r.description)}, ${sqlStr(r.muscle_group)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.video_url)}, ${sqlStr(r.demo_media_path)}, NULL, ${sqlStr(r.created_at)}::timestamptz, now(), NULL)`
})

const pass1 = `${header}${valueLines.join(',\n')}\nON CONFLICT (id) DO UPDATE SET\n  coach_id = EXCLUDED.coach_id,\n  name = EXCLUDED.name,\n  description = EXCLUDED.description,\n  muscle_group = EXCLUDED.muscle_group,\n  difficulty = EXCLUDED.difficulty,\n  video_url = EXCLUDED.video_url,\n  demo_media_path = EXCLUDED.demo_media_path,\n  updated_at = now();\n`

const replacements = parsed.filter((r) => r.replacement_exercise_id)
const pass2 =
  replacements.length === 0
    ? ''
    : `\n-- Pass 2 : replacement_exercise_id\n${replacements
        .map(
          (r) =>
            `UPDATE public.exercise_library SET replacement_exercise_id = '${r.replacement_exercise_id}'::uuid, updated_at = now() WHERE id = '${r.id}'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '${r.replacement_exercise_id}'::uuid);`
        )
        .join('\n')}\n`

const footer = `
INSERT INTO public.schema_migrations_trainly (id)
VALUES ('11a_exercise_library_trainly')
ON CONFLICT (id) DO NOTHING;

COMMIT;
`

fs.writeFileSync(outputPath, pass1 + pass2 + footer, 'utf8')
console.log(`Wrote ${parsed.length} exercises to ${outputPath}`)
