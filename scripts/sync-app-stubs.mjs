/**
 * Génère les stubs root `app/**` qui réexportent `src/app/**`.
 * Next.js route depuis `app/` (prioritaire) ; le code vit dans `src/app/`.
 *
 * Les route groups `(name)` sont aplatis dans `app/` (sinon conflit avec
 * d’anciens stubs plats : /(auth)/login vs /login).
 *
 * Usage: node scripts/sync-app-stubs.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_APP = path.join(ROOT, 'src', 'app')
const OUT_APP = path.join(ROOT, 'app')

const NAMES = new Set([
  'page.tsx',
  'layout.tsx',
  'loading.tsx',
  'route.ts',
  'route.tsx',
  'not-found.tsx',
  'error.tsx',
  'template.tsx',
  'default.tsx',
])

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, files)
    else if (NAMES.has(ent.name)) files.push(full)
  }
  return files
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

/** (auth)/login/page.tsx → login/page.tsx */
function stripRouteGroups(relPosix) {
  return relPosix
    .split('/')
    .filter((seg) => !(seg.startsWith('(') && seg.endsWith(')')))
    .join('/')
}

const sources = walk(SRC_APP)
let written = 0
const claimed = new Map() // flattened out path → src rel

for (const srcFile of sources) {
  const rel = toPosix(path.relative(SRC_APP, srcFile))
  const flatRel = stripRouteGroups(rel)
  if (!flatRel) continue

  const prev = claimed.get(flatRel)
  if (prev) {
    console.warn(`skip duplicate URL path: ${flatRel} (keep ${prev}, skip ${rel})`)
    continue
  }
  claimed.set(flatRel, rel)

  const outFile = path.join(OUT_APP, flatRel)
  const aliasTarget = `@/src/app/${rel.replace(/\.(tsx|ts)$/, '')}`

  let exportLine
  if (
    srcFile.endsWith('page.tsx') ||
    srcFile.endsWith('layout.tsx') ||
    srcFile.endsWith('loading.tsx') ||
    srcFile.endsWith('template.tsx') ||
    srcFile.endsWith('default.tsx') ||
    srcFile.endsWith('not-found.tsx') ||
    srcFile.endsWith('error.tsx')
  ) {
    const src = fs.readFileSync(srcFile, 'utf8')
    if (
      /\bexport\s+async\s+function\s+generateMetadata\b|\bexport\s+function\s+generateMetadata\b|\bexport\s+\{\s*[^}]*generateMetadata/.test(
        src
      )
    ) {
      exportLine = `export { default, generateMetadata } from '${aliasTarget}'\n`
    } else {
      exportLine = `export { default } from '${aliasTarget}'\n`
    }
  } else {
    const src = fs.readFileSync(srcFile, 'utf8')
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].filter((m) =>
      new RegExp(
        `\\bexport\\s+async\\s+function\\s+${m}\\b|\\bexport\\s+function\\s+${m}\\b|\\bexport\\s+const\\s+${m}\\b`
      ).test(src)
    )
    exportLine = methods.length
      ? `export { ${methods.join(', ')} } from '${aliasTarget}'\n`
      : `export * from '${aliasTarget}'\n`
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  const existing = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null
  if (
    existing &&
    !/from\s+['"]@\/src\/app\//.test(existing) &&
    !/from\s+['"](\.\.\/)+src\/app\//.test(existing) &&
    existing.split('\n').filter(Boolean).length > 3
  ) {
    console.warn('skip (not a stub):', toPosix(path.relative(ROOT, outFile)))
    continue
  }
  if (existing === exportLine) continue
  fs.writeFileSync(outFile, exportLine)
  written++
  console.log('wrote', toPosix(path.relative(ROOT, outFile)), '←', rel)
}

// Nettoie d’éventuels dossiers de route groups sous app/
for (const ent of fs.readdirSync(OUT_APP, { withFileTypes: true })) {
  if (ent.isDirectory() && ent.name.startsWith('(') && ent.name.endsWith(')')) {
    const doomed = path.join(OUT_APP, ent.name)
    fs.rmSync(doomed, { recursive: true, force: true })
    console.log('removed route-group stubs:', ent.name)
  }
}

console.log(`Done. ${written} stub(s) updated.`)
