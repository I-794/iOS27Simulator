import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('http://127.0.0.1:5173/'); await page.evaluate(() => localStorage.clear()); await page.reload()
await page.waitForTimeout(500); await page.keyboard.press('Enter'); await page.waitForTimeout(800)
const samples = await page.evaluate(async () => {
  const btn = document.querySelector('[aria-label="Calendar"]')
  btn.click()
  const out = []
  const t0 = performance.now()
  while (performance.now() - t0 < 700) {
    await new Promise((r) => requestAnimationFrame(r))
    const w = document.querySelector('.app-window[data-app="calendar"]')
    if (w) out.push(Math.round(performance.now() - t0) + 'ms ' + Math.round(w.getBoundingClientRect().width) + 'x' + Math.round(w.getBoundingClientRect().height))
  }
  return out.filter((_, i) => i % 4 === 0)
})
console.log(samples.join('\n'))
await browser.close()
