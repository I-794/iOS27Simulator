import { test, expect, type Page } from '@playwright/test'
import { boot, os, launch } from './helpers'

const app = (page: Page, id: string) => page.locator(`.app-window.active[data-app="${id}"]`)

test('Messages: a friend asks for a reminder → one tap adds it to Reminders', async ({ page }) => {
  await boot(page)
  await launch(page, 'messages', 'conv/c-sam')
  const before = (await os(page, 's.reminders.length')) as number
  await app(page, 'messages').getByText('Add to Reminders').first().click()
  await expect.poll(() => os(page, 's.reminders.length')).toBe(before + 1)
  expect(await os(page, 's.reminders[s.reminders.length - 1].title')).toMatch(/percussion bag/i)
})

test('Messages: sending a message updates the conversation', async ({ page }) => {
  await boot(page)
  await launch(page, 'messages', 'conv/c-alex')
  const input = app(page, 'messages').getByRole('textbox', { name: 'Message' })
  await expect(input).toBeVisible()
  // let the conversation's push animation settle before typing
  await page.waitForFunction(() => !document.querySelector('.app-window.active .nav-page')?.getAnimations().some((x) => x.playState === 'running'))
  await input.fill('On my way to robotics!')
  await input.press('Enter')
  await expect.poll(() => os(page, 's.conversations.find((c) => c.id === "c-alex").messages.some((m) => m.from === "me" && m.text === "On my way to robotics!")')).toBe(true)
  await expect(app(page, 'messages').getByText('On my way to robotics!').first()).toBeVisible()
})

test('Photos: natural-language search and star ratings', async ({ page }) => {
  await boot(page)
  await launch(page, 'photos', 'search/Biscuit at the beach')
  await expect(app(page, 'photos').locator('.ph-search-results [data-pid="p-biscuit-beach"]')).toBeVisible()
  await expect(app(page, 'photos').getByText('🐾 Biscuit')).toBeVisible()
  await launch(page, 'photos', 'photo/p-pizza')
  await app(page, 'photos').getByRole('button', { name: 'Info' }).click()
  await app(page, 'photos').getByRole('radio', { name: '5 stars' }).click()
  await expect.poll(() => os(page, 's.photos.find((p) => p.id === "p-pizza").rating')).toBe(5)
})

test('Shortcuts: Describe a Shortcut generates an editable action chain', async ({ page }) => {
  await boot(page)
  await launch(page, 'shortcuts')
  const before = (await os(page, 's.shortcuts.length')) as number
  await app(page, 'shortcuts').getByText('Describe a Shortcut').first().click()
  const field = app(page, 'shortcuts').locator('textarea, input').filter({ hasNot: page.locator('[type=checkbox]') }).last()
  await field.fill("When I leave school, text Dad that I'm heading home and include my ETA")
  await field.press('Enter')
  await expect(app(page, 'shortcuts').getByText(/Travel Time|ETA/).first()).toBeVisible({ timeout: 8000 })
  await expect(app(page, 'shortcuts').getByText(/Dad/).first()).toBeVisible()
  expect((await os(page, 's.shortcuts.length')) as number).toBeGreaterThanOrEqual(before)
})

test('Settings: AirPods Custom EQ writes the audio EQ', async ({ page }) => {
  await boot(page)
  await launch(page, 'settings', 'airpods')
  await app(page, 'settings').getByText(/Bass Boost/).first().click()
  await expect.poll(() => os(page, 's.eq.low')).toBeGreaterThan(0)
})

test('Settings: Liquid Glass slider lives under Appearance and changes the whole UI', async ({ page }) => {
  await boot(page)
  await launch(page, 'settings', 'appearance/glass')
  await expect(app(page, 'settings').getByText('More Clear').first()).toBeVisible()
  await app(page, 'settings').getByText(/Clearest/).first().click()
  await expect.poll(() => os(page, 's.glassTint')).toBeLessThan(0.1)
  const v = await page.locator('.screen').evaluate((el) => getComputedStyle(el).getPropertyValue('--glass-tint').trim())
  expect(parseFloat(v)).toBeLessThan(0.1)
})

test('Clock: alarm volume is independent from the ringer', async ({ page }) => {
  await boot(page)
  await launch(page, 'clock', 'alarm')
  await expect(app(page, 'clock').getByText(/Alarm & Timer Volume/i).first()).toBeVisible()
  await os(page, 's.set({ alarmVolume: 0.2, ringerVolume: 0.9 })')
  expect(await os(page, 's.alarmVolume')).toBe(0.2)
  expect(await os(page, 's.ringerVolume')).toBe(0.9)
  await expect(app(page, 'clock').getByText(/20%/).first()).toBeVisible()
})

test('Calendar: natural-language quick add creates an event', async ({ page }) => {
  await boot(page)
  await launch(page, 'calendar', 'new')
  const before = (await os(page, 's.events.length')) as number
  const field = app(page, 'calendar').locator('input, textarea').first()
  await field.fill("Dinner with Sam next Friday at 6:30 at Culver's")
  await expect(app(page, 'calendar').getByText(/Culver/).first()).toBeVisible()
  await app(page, 'calendar').getByRole('button', { name: /^Add to / }).click()
  await expect.poll(() => os(page, 's.events.length')).toBe(before + 1)
  const ev = (await os(page, 's.events.find((e) => /Culver/.test(e.location ?? ""))')) as { title: string; start: number } | undefined
  expect(ev?.title).toMatch(/Dinner/)
  expect(new Date(ev!.start).getDay()).toBe(5)
  expect(new Date(ev!.start).getHours()).toBe(18)
})

test('Home: natural-language camera search finds the package delivery', async ({ page }) => {
  await boot(page)
  await launch(page, 'home', 'cameras')
  const search = app(page, 'home').getByPlaceholder('Search your camera recordings')
  await search.fill('Show me when a package was left at the front door')
  await search.press('Enter')
  await expect(app(page, 'home').getByText(/package/i).first()).toBeVisible()
})

test('Safari: Notify Me watches a product page and fires a notification', async ({ page }) => {
  await boot(page)
  await launch(page, 'safari', 'url/bolt.example/headphones-x2')
  await app(page, 'safari').getByRole('button', { name: 'Notify Me', exact: true }).first().click()
  const sheet = page.locator('.sheet').filter({ hasText: 'Notify me about' })
  await sheet.getByText('Price Drops').click()
  await sheet.getByRole('button', { name: 'Notify Me', exact: true }).click()
  await expect.poll(() => os(page, 's.safariWatches.length')).toBeGreaterThan(0)
  await os(page, 's.set({ safariWatches: s.safariWatches.map((w) => ({ ...w, created: Date.now() - 60000 })) })')
  await expect.poll(() => os(page, 's.notifications.some((n) => n.app === "safari")'), { timeout: 8000 }).toBe(true)
})

test('Mail: reservation email offers Add to Calendar', async ({ page }) => {
  await boot(page)
  await launch(page, 'mail', 'mail/mail-rosas')
  const before = (await os(page, 's.events.length')) as number
  await app(page, 'mail').getByText('Add to Calendar').first().click()
  await expect.poll(() => os(page, 's.events.length')).toBe(before + 1)
})

test('Music: playback reaches the Dynamic Island from the app', async ({ page }) => {
  await boot(page)
  await launch(page, 'music')
  await os(page, 's.playTrack("t4")')
  await page.keyboard.press('Alt+H')
  await expect(page.locator('.island.pres-compact')).toBeVisible()
})
