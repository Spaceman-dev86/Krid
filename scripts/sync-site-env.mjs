import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const rootEnvPath = path.join(root, '.env.local')
const siteEnvPath = path.join(root, 'apps', 'site', '.env.local')

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[line.slice(0, i).trim()] = v
  }
  return out
}

const rootEnv = parseEnv(fs.readFileSync(rootEnvPath, 'utf8'))
const url = rootEnv.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = rootEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
if (!url || !anon) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in root .env.local')
  process.exit(1)
}

const body = [
  '# @trainly/site — local env (synced from repo root .env.local)',
  'NEXT_PUBLIC_APP_URL=http://localhost:3000',
  'NEXT_PUBLIC_SITE_URL=http://localhost:3001',
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
  '',
].join('\n')

fs.writeFileSync(siteEnvPath, body)
console.log('Updated apps/site/.env.local')
