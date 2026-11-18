/**
 * Test live coach ↔ client on the SAME thread (headed Chrome + Edge).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const COACH_AUTH = '.playwright-auth/coach.auth-state.json'
const CLIENT_AUTH = '.playwright-auth/client.auth-state.json'
const STAMP = process.env.QA_STAMP || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12)
const OUT = path.join('public', 'qa', `assets-link-${STAMP}`)
fs.mkdirSync(OUT, { recursive: true })

const log = []
function note(status, msg, extra = '') {
  const line = `[${status}] ${msg}${extra ? ' — ' + extra : ''}`
  log.push(line)
  console.log(line)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
}

async function main() {
  if (!fs.existsSync(COACH_AUTH)) throw new Error('missing coach auth')
  if (!fs.existsSync(CLIENT_AUTH)) throw new Error('missing client auth')

  const coachBrowser = await chromium.launch({ headless: false, channel: 'chrome' })
  const coachCtx = await coachBrowser.newContext({
    storageState: COACH_AUTH,
    viewport: { width: 1280, height: 800 },
  })
  const coach = await coachCtx.newPage()

  const clientBrowser = await chromium.launch({ headless: false, channel: 'msedge' })
  const clientCtx = await clientBrowser.newContext({
    storageState: CLIENT_AUTH,
    viewport: { width: 390, height: 844 },
  })
  const client = await clientCtx.newPage()

  await client.goto(`${BASE}/c/studio-remi/messages`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await client.waitForSelector('a.coach-chat__row', { timeout: 30000 })
  note('OK', 'Client inbox')

  const links = await client.$$eval('a.coach-chat__row', (as) =>
    as.map((a) => ({ href: a.getAttribute('href'), t: a.innerText || '' }))
  )
  const dm = links.find((l) => !/Groupe\s*·/i.test(l.t)) || links[0]
  if (!dm?.href) throw new Error('no DM link')
  const threadId = dm.href.split('/').pop()
  note('OK', 'Thread DM', `${threadId} | ${dm.t.split('\n')[0]}`)

  await Promise.all([
    client.waitForURL(new RegExp(threadId), { timeout: 20000 }),
    client.click(`a.coach-chat__row[href$="${threadId}"]`),
  ])
  await client.waitForTimeout(1000)
  await shot(client, 'client-thread.png')

  await coach.goto(`${BASE}/chat/${threadId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await coach.waitForSelector('textarea', { timeout: 30000 })
  note('OK', 'Coach même thread', threadId)
  await shot(coach, 'coach-thread.png')

  const coachBox = coach.locator('textarea').first()
  const clientBox = client.locator('textarea').first()

  const token = `C2C-${Date.now()}`
  const t0 = Date.now()
  await coachBox.fill(`Coach→Client ${token}`)
  await coachBox.press('Enter')
  try {
    await client.getByText(token).first().waitFor({ timeout: 20000 })
    note('OK', 'Realtime Coach→Client', `${Date.now() - t0} ms`)
  } catch {
    await client.reload({ waitUntil: 'domcontentloaded' })
    await client.waitForTimeout(2000)
    const ok = (await client.getByText(token).count()) > 0
    note(ok ? 'WARN' : 'BAD', 'Coach→Client', ok ? `après refresh ${Date.now() - t0}ms` : 'non reçu')
  }
  await shot(client, 'client-got-coach.png')

  const token2 = `C2K-${Date.now()}`
  const t1 = Date.now()
  await clientBox.fill(`Client→Coach ${token2}`)
  await clientBox.press('Enter')
  try {
    await coach.getByText(token2).first().waitFor({ timeout: 20000 })
    note('OK', 'Realtime Client→Coach', `${Date.now() - t1} ms`)
  } catch {
    await coach.reload({ waitUntil: 'domcontentloaded' })
    await coach.waitForTimeout(2000)
    const ok = (await coach.getByText(token2).count()) > 0
    note(ok ? 'WARN' : 'BAD', 'Client→Coach', ok ? `après refresh ${Date.now() - t1}ms` : 'non reçu')
  }
  await shot(coach, 'coach-got-client.png')

  await client.bringToFront()
  await client.waitForTimeout(2500)
  await coach.bringToFront()
  await coach.waitForTimeout(1500)
  const lu = await coach.locator('[aria-label="Lu"]').count()
  const recu = await coach.locator('[aria-label="Reçu"]').count()
  note('OK', 'Ticks coach', `Lu=${lu} Reçu=${recu}`)
  await shot(coach, 'coach-ticks.png')

  await client.goto(`${BASE}/c/studio-remi/messages`)
  await client.waitForTimeout(800)
  const arch = await client.getByRole('button', { name: 'Archivées', exact: true }).count()
  note(arch === 0 ? 'OK' : 'BAD', 'Pas de filtre Archivées', `count=${arch}`)

  await coachCtx.close()
  await coachBrowser.close()
  await clientCtx.close()
  await clientBrowser.close()

  const summary = [`# Chat link QA ${STAMP}`, ...log, '', `Assets: /qa/assets-link-${STAMP}/`].join('\n')
  fs.writeFileSync(path.join('public', 'qa', `chat-link-${STAMP}.txt`), summary)
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>QA Chat link ${STAMP}</title></head>
<body style="font-family:system-ui;background:#0c0c0e;color:#eee;padding:24px">
<h1>QA Chat coach ↔ client</h1>
<pre style="background:#16161a;padding:16px;border-radius:12px;white-space:pre-wrap">${summary.replace(/</g, '&lt;')}</pre>
<p>
  <a href="/qa/assets-link-${STAMP}/client-got-coach.png" style="color:#d6c4e8">client reçu</a> ·
  <a href="/qa/assets-link-${STAMP}/coach-got-client.png" style="color:#d6c4e8">coach reçu</a> ·
  <a href="/qa/assets-link-${STAMP}/coach-ticks.png" style="color:#d6c4e8">ticks</a>
</p>
</body></html>`
  fs.writeFileSync(path.join('public', 'qa', `chat-link-${STAMP}.html`), html)
  console.log('\n' + summary)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
