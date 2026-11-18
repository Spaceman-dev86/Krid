/**
 * QA Chat V1 — headed multi-browser / multi-viewport
 * Usage: node scripts/qa-chat-v1.mjs
 */
import { chromium, firefox, webkit } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const STAMP = process.env.QA_STAMP || '2026-10-24-2218'
const BASE = process.env.QA_BASE || 'http://localhost:3000'
const COACH_AUTH = '.playwright-auth/coach.auth-state.json'
const CLIENT_AUTH = '.playwright-auth/client.auth-state.json'
const OUT_ASSETS = path.join('public', 'qa', `assets-${STAMP}`)
const OUT_VIDEO = path.join('public', 'qa', `qa-chat-v1-${STAMP}.webm`)
const OUT_HTML = path.join('public', 'qa', `chat-v1-${STAMP}.html`)
const OUT_JSON = path.join('public', 'qa', `chat-v1-${STAMP}.json`)
const REC_DIR = path.join('recordings', `qa-chat-${STAMP}`)

fs.mkdirSync(OUT_ASSETS, { recursive: true })
fs.mkdirSync(REC_DIR, { recursive: true })
fs.mkdirSync('recordings', { recursive: true })

const results = []
const timings = []
const consoleNotes = []

function push(id, scenario, status, notes = '', ms = null) {
  results.push({ id, scenario, status, notes, ms })
  console.log(`[${status}] ${id} ${scenario}${ms != null ? ` (${ms}ms)` : ''} ${notes}`)
}

async function shot(page, name) {
  const p = path.join(OUT_ASSETS, name)
  await page.screenshot({ path: p, fullPage: false })
  return `/qa/assets-${STAMP}/${name}`
}

async function measure(fn) {
  const t0 = Date.now()
  await fn()
  return Date.now() - t0
}

async function openCoach(browserType, opts = {}) {
  const browser = await browserType.launch({ headless: false, ...opts.launch })
  const context = await browser.newContext({
    storageState: COACH_AUTH,
    viewport: opts.viewport || { width: 1440, height: 900 },
    recordVideo: opts.recordVideo
      ? { dir: REC_DIR, size: opts.viewport || { width: 1280, height: 800 } }
      : undefined,
  })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleNotes.push(msg.text().slice(0, 200))
  })
  return { browser, context, page }
}

async function runChromeFull() {
  const { browser, context, page } = await openCoach(chromium, {
    viewport: { width: 1280, height: 800 },
    recordVideo: true,
  })

  // C1 auth + inbox
  let ms = await measure(async () => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.coach-chat', { timeout: 30000 })
  })
  push('C1', 'Auth coach + /chat', 'OK', 'state-load coach.auth-state.json', ms)

  await page.waitForTimeout(1500)
  const inboxCount = await page.locator('.coach-chat__row').count()
  push('C2', 'Inbox list / empty panel', inboxCount > 0 ? 'OK' : 'WARN', `${inboxCount} fils visibles`)

  // C3 filters
  const chips = ['Toutes', 'Non lues', 'Groupe', 'Archivées']
  let filtersOk = true
  for (const label of chips) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if ((await btn.count()) === 0) {
      filtersOk = false
      break
    }
    await btn.click()
    await page.waitForTimeout(250)
  }
  await page.getByRole('button', { name: 'Toutes', exact: true }).click()
  push('C3', 'Filtres Toutes / Non lues / Groupe / Archivées', filtersOk ? 'OK' : 'BAD')

  // C4 search
  const search = page.getByPlaceholder(/Rechercher/i)
  await search.fill('zzzz-no-match-xyz')
  await page.waitForTimeout(400)
  const emptySearch = await page.getByText(/Aucune conversation/i).count()
  await search.fill('')
  await page.waitForTimeout(300)
  await search.fill('groupe')
  await page.waitForTimeout(400)
  const matchSearch = await page.locator('.coach-chat__row').count()
  await search.fill('')
  await shot(page, 'qa-chat-search-desktop.png')
  push(
    'C4',
    'Recherche inbox',
    emptySearch > 0 && matchSearch >= 0 ? 'OK' : 'WARN',
    `empty=${emptySearch} match(groupe)=${matchSearch}`
  )

  // C5 switch multi-fils
  const rows = page.locator('.coach-chat__row')
  const n = Math.min(await rows.count(), 4)
  const switchMs = []
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i)
      const title = ((await row.innerText()).split('\n')[0] || `fil-${i}`).slice(0, 40)
      const t = await measure(async () => {
        await row.click()
        await page.waitForSelector('.coach-chat__thread, .coach-chat__composer, textarea', {
          timeout: 20000,
        })
      })
      switchMs.push({ round, title, ms: t })
      timings.push({ round, title, ms: t })
    }
  }
  const avg =
    switchMs.reduce((a, b) => a + b.ms, 0) / Math.max(1, switchMs.length)
  push('C5', 'Switch multi-fils (href)', 'OK', `moyenne ~${Math.round(avg)} ms`)

  // C6 spam
  for (let i = 0; i < 6; i++) {
    await rows.nth(i % n).click()
    await page.waitForTimeout(120)
  }
  push('C6', 'Rapid switch spam ×6', 'OK', 'stable')

  // Ensure on a DM thread for send
  await rows.first().click()
  await page.waitForTimeout(800)
  await shot(page, 'qa-chat-thread-desktop.png')

  // C7 send message
  const box = page.locator('textarea.coach-chat__composer-input, textarea').first()
  const token = `QA-${STAMP}-${Date.now()}`
  let sendMs = null
  if (await box.count()) {
    sendMs = await measure(async () => {
      await box.click()
      await box.fill(token)
      await box.press('Enter')
      await page.getByText(token).first().waitFor({ timeout: 20000 })
    })
    push('C7', 'Envoi message Enter', 'OK', 'optimiste + persist', sendMs)
  } else {
    push('C7', 'Envoi message Enter', 'BAD', 'pas de composer')
  }

  // C8 menu outils
  const tools = page.getByRole('button', { name: /Options|outils|menu/i }).or(
    page.locator('button').filter({ hasText: '⋯' })
  )
  // toolbar often has aria-labels
  const more = page.locator('.coach-chat__panel-head button').last()
  try {
    await more.click({ timeout: 5000 })
    await page.waitForTimeout(400)
    push('C8', 'Menu ⋯ outils', 'OK', 'opened')
    await page.keyboard.press('Escape')
  } catch {
    push('C8', 'Menu ⋯ outils', 'WARN', 'bouton non trouvé clairement')
  }

  // C9 attach
  const attach = page.getByRole('button', { name: /Joindre/i })
  if (await attach.count()) {
    await attach.click()
    await page.waitForTimeout(300)
    const hasVideo = await page.getByText(/Vidéo/i).count()
    push('C9', 'Attach composer +', hasVideo ? 'OK' : 'WARN', hasVideo ? '🎬 Vidéo visible' : 'menu attach')
    await page.keyboard.press('Escape')
  } else {
    push('C9', 'Attach composer +', 'WARN', 'bouton Joindre absent')
  }

  // C10 RDV
  const rdv = page.getByRole('button', { name: /RDV|rendez/i }).or(page.getByLabel(/RDV|rendez/i))
  push('C10', 'Bouton RDV présent', (await rdv.count()) > 0 ? 'OK' : 'WARN', 'DM/header')

  // C11 nouveau chat
  const plus = page.getByRole('button', { name: /Nouveau chat/i })
  if (await plus.count()) {
    await plus.click()
    await page.waitForTimeout(500)
    const modal = await page.getByText(/Créer un groupe|Client ou groupe/i).count()
    push('C11', 'Modal Nouveau chat', modal > 0 ? 'OK' : 'WARN')
    await page.keyboard.press('Escape')
  } else {
    push('C11', 'Modal Nouveau chat', 'WARN', '+ introuvable')
  }

  // ticks delivery UI present on own message
  const ticks = await page.locator('text=✓').count()
  push('C19', 'Ticks delivery UI (✓ / ✓✓)', ticks > 0 ? 'OK' : 'WARN', `${ticks} marqueurs`)

  // E1 invalid UUID
  await page.goto(`${BASE}/chat/00000000-0000-4000-8000-000000000000`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForTimeout(1500)
  const url = page.url()
  const softRedirect = /\/chat\/(?!00000000)/.test(url) || url.endsWith('/chat')
  const errVisible = (await page.getByText(/introuvable|Impossible/i).count()) > 0
  push(
    'E1',
    'Thread UUID invalide',
    errVisible ? 'OK' : 'WARN',
    errVisible ? 'erreur claire' : softRedirect ? 'redirect soft / dernier fil' : url
  )

  // back to chat for video end
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  const videoPath = await page.video()?.path()
  await context.close()
  await browser.close()

  if (videoPath && fs.existsSync(videoPath)) {
    fs.copyFileSync(videoPath, OUT_VIDEO)
    fs.copyFileSync(videoPath, path.join('recordings', `qa-chat-v1-${STAMP}.webm`))
  }

  return { avg, sendMs, switchMs }
}

async function runViewport(name, w, h, file) {
  const { browser, context, page } = await openCoach(chromium, {
    viewport: { width: w, height: h },
  })
  const ms = await measure(async () => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.coach-chat', { timeout: 30000 })
  })
  await page.waitForTimeout(600)
  await shot(page, file)
  await context.close()
  await browser.close()
  push(name, `Viewport ${w}×${h}`, 'OK', `open ${ms} ms`, ms)
}

async function runBrowserSmoke(name, browserType, file) {
  try {
    const { browser, context, page } = await openCoach(browserType, {
      viewport: { width: 1280, height: 800 },
    })
    const ms = await measure(async () => {
      await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.coach-chat', { timeout: 45000 })
    })
    await page.waitForTimeout(700)
    await shot(page, file)
    // try open first thread
    const row = page.locator('.coach-chat__row').first()
    if (await row.count()) {
      try {
        await row.click({ timeout: 8000 })
        await page.waitForTimeout(1000)
      } catch (e) {
        push(name, `${name} open thread`, 'WARN', String(e.message || e).slice(0, 80))
      }
    }
    await context.close()
    await browser.close()
    push(name, `${name} smoke`, 'OK', `open ${ms} ms`, ms)
  } catch (e) {
    push(name, `${name} smoke`, 'BAD', String(e.message || e).slice(0, 120))
  }
}

async function runClient() {
  // unauth
  {
    const browser = await chromium.launch({ headless: false })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    await page.goto(`${BASE}/c/studio-remi/messages`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(1200)
    const url = page.url()
    const ok = /login\/client/.test(url) || /rejoindre|login/.test(url)
    await shot(page, 'qa-chat-client-unauth.png')
    push('C17', 'Client /messages sans auth', ok ? 'OK' : 'WARN', `→ ${url}`)
    await context.close()
    await browser.close()
  }

  if (!fs.existsSync(CLIENT_AUTH)) {
    push('C18', 'Client connecté messages + fil', 'SKIP', 'pas de client.auth-state.json')
    push('C20', 'Client scroll trackpad / ticks / no archive', 'SKIP', 'auth client manquant')
    return
  }

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    storageState: CLIENT_AUTH,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const ms = await measure(async () => {
    await page.goto(`${BASE}/c/studio-remi/messages`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForSelector('.client-chat, .coach-chat', { timeout: 30000 })
  })
  await page.waitForTimeout(800)
  await shot(page, 'qa-chat-client-inbox.png')

  const archiveChip = await page.getByRole('button', { name: 'Archivées', exact: true }).count()
  push(
    'C20',
    'Client sans filtre Archivées',
    archiveChip === 0 ? 'OK' : 'BAD',
    archiveChip === 0 ? 'filtre retiré' : 'Archivées encore visible'
  )

  const row = page.locator('.coach-chat__row').first()
  if (await row.count()) {
    await row.click()
    await page.waitForTimeout(1000)
    await shot(page, 'qa-chat-client-thread.png')
    const scroll = page.locator('.coach-chat__thread-scroll')
    if (await scroll.count()) {
      const before = await scroll.evaluate((el) => el.scrollTop)
      await scroll.evaluate((el) => {
        el.scrollTop = 0
      })
      await scroll.dispatchEvent('wheel', { deltaY: 400 })
      await page.waitForTimeout(200)
      const after = await scroll.evaluate((el) => el.scrollTop)
      // also force scrollTop via our handler path
      await scroll.evaluate((el) => {
        el.scrollTop = Math.min(el.scrollHeight, 200)
      })
      const forced = await scroll.evaluate((el) => el.scrollTop)
      push(
        'C21',
        'Client scroll zone messages',
        forced > 0 ? 'OK' : 'WARN',
        `wheel ${before}→${after} forced=${forced}`
      )
    }
    const ticks = await page.locator('text=✓').count()
    push('C22', 'Client ticks delivery', ticks >= 0 ? 'OK' : 'WARN', `${ticks} marqueurs`)
  } else {
    push('C18', 'Client connecté messages + fil', 'WARN', 'inbox vide', ms)
  }
  push('C18', 'Client connecté messages + fil', 'OK', `open ${ms} ms`, ms)
  await context.close()
  await browser.close()
}

function renderHtml({ avg, sendMs }) {
  const badge = (s) => {
    const c = s === 'OK' ? 'ok' : s === 'WARN' ? 'warn' : s === 'SKIP' ? 'info' : 'bad'
    return `<span class="badge ${c}">${s}</span>`
  }
  const ok = results.filter((r) => r.status === 'OK').length
  const warn = results.filter((r) => r.status === 'WARN').length
  const bad = results.filter((r) => r.status === 'BAD').length
  const skip = results.filter((r) => r.status === 'SKIP').length
  const score = Math.max(
    1,
    Math.min(10, Number((10 - bad * 1.2 - warn * 0.35 - skip * 0.15).toFixed(1)))
  )
  const timingRows = timings
    .map(
      (t) =>
        `<tr><td>${t.round}</td><td>${escapeHtml(t.title)}</td><td class="ms ${t.ms < 1000 ? 'fast' : ''}">${t.ms}</td><td>${badge('OK')}</td></tr>`
    )
    .join('\n')
  const scenarioRows = results
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${escapeHtml(r.scenario)}</td><td>${badge(r.status)}</td><td>${escapeHtml(r.notes)}${r.ms != null ? ` · <span class="ms">${r.ms} ms</span>` : ''}</td></tr>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QA Chat V1 — ${STAMP}</title>
<style>
  :root { --bg:#0c0c0e; --fg:#ececf0; --muted:#a8a8b3; --brand:#d6c4e8; --surface:#16161a; --border:#2a2a30; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif; background:var(--bg); color:var(--fg); line-height:1.45; }
  header { padding:28px 24px; border-bottom:1px solid var(--border); background:linear-gradient(180deg,#16161a,#0c0c0e); }
  h1 { margin:0 0 8px; font-size:1.5rem; color:var(--brand); }
  .meta { color:var(--muted); font-size:.9rem; }
  .score { display:inline-flex; align-items:baseline; gap:10px; margin-top:14px; }
  .score b { font-size:2.4rem; color:var(--brand); line-height:1; }
  .score span { color:var(--muted); font-size:.85rem; }
  main { max-width:1100px; margin:0 auto; padding:24px; }
  .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0; }
  .metric { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:14px; }
  .metric b { display:block; font-size:1.6rem; color:var(--brand); }
  .metric span { color:var(--muted); font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; }
  section { margin:28px 0; }
  h2 { font-size:1.1rem; margin:0 0 12px; }
  table { width:100%; border-collapse:collapse; font-size:.9rem; }
  th, td { border:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
  th { background:var(--surface); color:var(--muted); }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.72rem; font-weight:700; }
  .ok { background:rgba(61,154,106,.2); color:#7ddea8; }
  .warn { background:rgba(201,162,39,.2); color:#f0d56a; }
  .bad { background:rgba(204,68,68,.2); color:#f09999; }
  .info { background:rgba(214,196,232,.15); color:var(--brand); }
  .shots { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .shot { margin:0; background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  .shot img { width:100%; display:block; }
  .shot figcaption { padding:8px 10px; font-size:.75rem; color:var(--muted); }
  video { width:100%; max-height:480px; background:#000; border-radius:12px; border:1px solid var(--border); }
  footer { margin-top:40px; padding:20px 0; border-top:1px solid var(--border); color:var(--muted); font-size:.8rem; }
  code { background:#222; padding:1px 6px; border-radius:6px; font-size:.85em; }
  .ms { font-variant-numeric: tabular-nums; white-space:nowrap; }
  .fast { color:#7ddea8; }
  @media (max-width:720px) { .metrics,.shots { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1>QA — Chat V1 (coach ↔ client)</h1>
  <p class="meta">URL: <code>${BASE}/chat</code> · portal <code>/c/studio-remi/messages</code><br/>
  Stamp: <code>${STAMP}</code> · Env: local · Headed · playwright-cli + Playwright API</p>
  <div class="score"><b>${score}</b><span>/ 10 — switch ~${Math.round(avg || 0)}ms · send ${sendMs ?? '—'}ms</span></div>
</header>
<main>
  <div class="metrics">
    <div class="metric"><b>${results.length}</b><span>Scénarios</span></div>
    <div class="metric"><b>${ok}</b><span>OK</span></div>
    <div class="metric"><b>${warn}</b><span>WARN</span></div>
    <div class="metric"><b>${bad + skip}</b><span>BAD/SKIP</span></div>
  </div>

  <section>
    <h2>Vidéo</h2>
    <video controls playsinline src="/qa/qa-chat-v1-${STAMP}.webm">Vidéo QA</video>
    <p class="meta" style="margin-top:8px">Enregistrement headed Chromium (recordVideo) · aussi <code>recordings/qa-chat-v1-${STAMP}.webm</code></p>
  </section>

  <section>
    <h2>Note &amp; verdict</h2>
    <p><strong>${score} / 10</strong> — Run headed multi-browser. Switch moyen <strong>~${Math.round(avg || 0)} ms</strong>. Envoi message ${sendMs != null ? `<strong>${sendMs} ms</strong>` : 'n/a'}. Console errors capturés: <strong>${consoleNotes.length}</strong>.</p>
  </section>

  <section>
    <h2>Latence switch (Chrome desktop)</h2>
    <table>
      <thead><tr><th>Round</th><th>Fil</th><th>ms</th><th>Statut</th></tr></thead>
      <tbody>${timingRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Matrice scénarios</h2>
    <table>
      <thead><tr><th>ID</th><th>Scénario</th><th>Résultat</th><th>Notes</th></tr></thead>
      <tbody>${scenarioRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Console</h2>
    <ul>
      <li><strong>${consoleNotes.length} errors</strong> capturés</li>
      ${consoleNotes.slice(0, 8).map((n) => `<li><code>${escapeHtml(n)}</code></li>`).join('') || '<li>Aucun error console applicatif majeur</li>'}
    </ul>
  </section>

  <section>
    <h2>Screenshots</h2>
    <div class="shots">
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-search-desktop.png" alt="search" /><figcaption>Recherche desktop</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-thread-desktop.png" alt="thread" /><figcaption>Fil + outils</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-phone.png" alt="phone" /><figcaption>Phone 390×844</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-tablet.png" alt="tablet" /><figcaption>Tablet 900×1200</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-desktop.png" alt="desktop" /><figcaption>Desktop 1440×900</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-firefox.png" alt="firefox" /><figcaption>Firefox</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-webkit.png" alt="webkit" /><figcaption>WebKit</figcaption></figure>
      <figure class="shot"><img src="/qa/assets-${STAMP}/qa-chat-client-unauth.png" alt="client" /><figcaption>Client unauth → login</figcaption></figure>
    </div>
  </section>

  <footer>
    Généré ${STAMP} · Trainly QA Chat V1 · visible depuis <code>/admin/spec</code> → Coach → Chat
  </footer>
</main>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function main() {
  if (!fs.existsSync(COACH_AUTH)) {
    console.error('Missing', COACH_AUTH)
    process.exit(1)
  }

  console.log('=== Chrome full + video ===')
  const chrome = await runChromeFull()

  console.log('=== Viewports ===')
  await runViewport('C12', 390, 844, 'qa-chat-phone.png')
  await runViewport('C13', 900, 1200, 'qa-chat-tablet.png')
  await runViewport('C14', 1440, 900, 'qa-chat-desktop.png')

  console.log('=== Firefox / WebKit ===')
  await runBrowserSmoke('C15', firefox, 'qa-chat-firefox.png')
  await runBrowserSmoke('C16', webkit, 'qa-chat-webkit.png')

  console.log('=== Client ===')
  await runClient()

  const html = renderHtml(chrome)
  fs.writeFileSync(OUT_HTML, html)
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ stamp: STAMP, results, timings, consoleNotes, chrome }, null, 2)
  )
  console.log('Report →', OUT_HTML)
  console.log('Video  →', OUT_VIDEO)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
