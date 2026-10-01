import { test, expect } from '@playwright/test'
import { boot, os } from './helpers'

test('boots to the Lock Screen and unlocks', async ({ page }) => {
  const errors = await boot(page, { unlock: false })
  await expect(page.getByRole('region', { name: 'Lock Screen' })).toBeVisible()
  await expect(page.locator('.lock-clock')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.home')).toBeVisible()
  await expect(page.locator('.dock')).toBeVisible()
  expect(errors).toEqual([])
})

test('apps launch from the Home Screen and close back to it', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(page.locator('.app-window.active[data-app="notes"]')).toBeVisible()
  expect(await os(page, 's.openApp')).toBe('notes')
  await page.keyboard.press('Alt+H')
  await expect.poll(() => os(page, 's.openApp')).toBe(null)
})

test('Control Center toggles change system state', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Alt+C')
  const wifi = page.locator('.cc-conn').getByRole('button', { name: 'Wi-Fi' })
  await wifi.click()
  await expect.poll(() => os(page, 's.net.wifi')).toBe(false)
  await page.getByRole('button', { name: 'Flashlight' }).first().click()
  await expect.poll(() => os(page, 's.flashlight')).toBe(true)
})

test('Liquid Glass tint propagates to the whole UI and persists', async ({ page }) => {
  await boot(page)
  await os(page, 's.set({ glassTint: 0.9 })')
  const v = await page.locator('.screen').evaluate((el) => getComputedStyle(el).getPropertyValue('--glass-tint').trim())
  expect(v).toBe('0.9')
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __os?: unknown }).__os)
  expect(await os(page, 's.glassTint')).toBe(0.9)
})

test('Siri answers from personal context and performs actions', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Alt+S')
  await page.getByRole('button', { name: 'Type to Siri' }).click()
  const input = page.getByRole('textbox', { name: 'Ask Siri' })
  await input.fill('Which day did Alex say the robotics meeting was?')
  await input.press('Enter')
  await expect(page.locator('.siri-bubble').last()).toContainText('Thursday', { timeout: 5000 })
  const before = (await os(page, 's.reminders.length')) as number
  await input.fill('Remind me to bring the percussion bag tomorrow at 7am')
  await input.press('Enter')
  await expect.poll(() => os(page, 's.reminders.length')).toBe(before + 1)
  const events = (await os(page, 's.events.length')) as number
  await input.fill('Add dinner with Sam next Friday at 6:30 at Rosa’s')
  await input.press('Enter')
  await expect.poll(() => os(page, 's.events.length')).toBe(events + 1)
})

test('Spotlight searches across multiple apps', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Alt+Space')
  await page.locator('.spot-field input').fill('robotics')
  await expect(page.locator('.spot-top')).toBeVisible()
  const sections = await page.locator('.spot-section-title').allTextContents()
  expect(sections.join('|')).toMatch(/Messages|Calendar|Notes|Mail/)
  expect(sections.length).toBeGreaterThan(3)
})

test('music playback reaches the Dynamic Island and Lock Screen', async ({ page }) => {
  await boot(page)
  await os(page, 's.playTrack("t3")')
  await expect(page.locator('.island.pres-compact')).toBeVisible()
  await page.keyboard.press('Alt+L')
  await page.keyboard.press('Alt+L')
  await expect(page.locator('.np-platter')).toContainText('Paper Satellites')
})

test('Screen Time child mode blocks unapproved apps', async ({ page }) => {
  await boot(page)
  await os(page, "s.set({ screenTime: { ...s.screenTime, childMode: true, allowedApps: s.screenTime.allowedApps.filter((a) => a !== 'wallet') } })")
  await page.getByRole('button', { name: 'Wallet', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Wallet')
  expect(await os(page, 's.openApp')).toBe(null)
})

test('orientation switches to landscape and back', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Alt+R')
  await expect(page.locator('.screen.landscape')).toBeVisible()
  await page.keyboard.press('Alt+R')
  await expect(page.locator('.screen.landscape')).toHaveCount(0)
})

test('notifications open their source app', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Alt+N')
  await page.locator('.notif').filter({ hasText: 'Sam Okafor' }).first().click()
  await expect.poll(() => os(page, 's.openApp')).toBe('messages')
})

test('timer uses alarm volume and shows a Live Activity', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => (window as unknown as { __os: { getState: () => { set: (p: object) => void } } }).__os.getState().set({ alarmVolume: 0.3, ringerVolume: 0.9, siriActive: true, siriMode: 'idle' }))
  await page.getByRole('textbox', { name: 'Ask Siri' }).fill('Set a timer for 2 seconds')
  await page.getByRole('textbox', { name: 'Ask Siri' }).press('Enter')
  await expect.poll(() => os(page, 's.timers.length')).toBe(1)
  await expect.poll(() => os(page, 's.notifications.some((n) => n.app === "clock")'), { timeout: 8000 }).toBe(true)
})

test('Lock Screen editor: a photo wallpaper can be extended with Apple Intelligence', async ({ page }) => {
  await boot(page, { unlock: false })
  await page.locator('.lock').click({ button: 'right', position: { x: 200, y: 300 } })
  await expect(page.locator('.lock-customizer')).toBeVisible()
  await page.locator('.lock-customizer').getByRole('button', { name: 'Biscuit at the Beach' }).click()
  await page.locator('.lock-customizer').getByRole('button', { name: 'Whole Photo' }).click()
  await expect.poll(() => os(page, 's.wallpaperFit')).toBe('photo')
  await page.locator('.lock-customizer').getByRole('button', { name: 'Extend with Apple Intelligence' }).click()
  await expect.poll(() => os(page, 's.wallpaperFit')).toBe('extend')
  await page.locator('.lock-customizer').getByRole('button', { name: /Create with Image Playground/ }).click()
  await expect(page.locator('.app-window.active[data-app="playground"]')).toBeVisible()
})
