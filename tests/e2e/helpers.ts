import { expect, type Page } from '@playwright/test'

export async function boot(page: Page, opts: { unlock?: boolean } = {}) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('.screen')).toBeVisible()
  await page.waitForFunction(() => !!(window as unknown as { __os?: unknown }).__os)
  if (opts.unlock !== false) {
    await page.keyboard.press('Enter')
    await expect(page.locator('.home')).toBeVisible()
  }
  return errors
}

export const os = (page: Page, js: string) => page.evaluate(`(() => { const s = window.__os.getState(); return (${js}) })()`)

export async function launch(page: Page, app: string, route?: string) {
  await page.evaluate(([a, r]) => (window as unknown as { __os: { getState: () => { launch: (a: string, o?: object) => void } } }).__os.getState().launch(a, r ? { route: r } : undefined), [app, route] as const)
  await expect(page.locator(`.app-window[data-app="${app}"]`)).toBeVisible()
}
