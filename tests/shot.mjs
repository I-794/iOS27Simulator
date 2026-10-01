// Usage: node tests/shot.mjs <name> [steps-json] ; steps: [{"click":"sel"},{"key":"Alt+H"},{"wait":500},{"eval":"js"},{"type":["sel","text"]}]
import { chromium } from '@playwright/test'
const [,, name = 'boot', stepsArg = '[]', w = '1280', h = '900'] = process.argv
const out = process.env.SHOT_DIR ?? '/tmp/claude-0/-home-user-iOS27Simulator/de4844ce-2e69-598e-9c60-3533045e3e1f/scratchpad/shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
if (!process.env.KEEP) await page.evaluate(() => localStorage.clear())
if (!process.env.KEEP) await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
for (const s of JSON.parse(stepsArg)) {
  if (s.click) await page.click(s.click, { timeout: 4000 }).catch((e) => errors.push('click fail ' + s.click + ' ' + e.message.split('\n')[0]))
  if (s.key) await page.keyboard.press(s.key)
  if (s.wait) await page.waitForTimeout(s.wait)
  if (s.eval) await page.evaluate(s.eval).catch((e) => errors.push('eval fail ' + e.message))
  if (s.type) { await page.click(s.type[0]).catch(() => {}); await page.keyboard.type(s.type[1], { delay: 10 }) }
  if (s.shot) await page.locator('.screen').screenshot({ path: `${out}/${s.shot}.png` })
}
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/${name}.png` })
console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no console errors')
await browser.close()
