// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ask, forget } from '../../src/os/ai/siri'
import { parseEvent, parseWhen, parseReminder, parseDuration } from '../../src/os/ai/parse'
import { useOS } from '../../src/os/store'
import { search, searchPhotos } from '../../src/os/search'

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

describe('parse', () => {
  it('parses a natural-language event', () => {
    const e = parseEvent("Dinner with Sam next Friday at 6:30 at Culver's", Date.now(), [{ id: 'sam', names: ['Sam'] }])!
    expect(e.title).toBe('Dinner with Sam')
    expect(e.location).toBe("Culver's")
    const d = new Date(e.start)
    expect(WEEK[d.getDay()]).toBe('Friday')
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(30)
    expect(e.invitees).toContain('sam')
  })
  it('parses reminders and durations', () => {
    const r = parseReminder('remind me to bring the percussion bag tomorrow at 7am')
    expect(r.title).toBe('Bring the percussion bag')
    expect(new Date(r.due!).getHours()).toBe(7)
    expect(parseDuration('ten minutes')).toBe(600)
    expect(parseDuration('1 hour and a half')).toBe(5400)
    expect(parseWhen('in 2 hours')!.hasTime).toBe(true)
  })
})

describe('siri', () => {
  beforeEach(() => forget('t'))
  it('answers personal context from Messages', () => {
    const r = ask('Which day did Alex say the robotics meeting was?', 't')
    expect(r.text).toMatch(/Thursday/)
    expect(r.text).toMatch(/6:30/)
  })
  it('answers when is robotics', () => {
    const r = ask('When is robotics?', 't')
    expect(r.text).toMatch(/Thursday/)
  })
  it('creates calendar events', () => {
    const before = useOS.getState().events.length
    const r = ask('Add dinner with Sam next Friday at 6:30 at Rosa’s', 't')
    expect(r.intent).toBe('event')
    expect(useOS.getState().events.length).toBe(before + 1)
  })
  it('creates reminders', () => {
    const before = useOS.getState().reminders.length
    ask('Remind me to bring the percussion bag tomorrow', 't')
    expect(useOS.getState().reminders.length).toBe(before + 1)
  })
  it('uses onscreen message context', () => {
    useOS.setState({ siriOnscreen: { app: 'messages', entity: { type: 'conversation', convId: 'c-mom', name: 'Mom' } } })
    const before = useOS.getState().events.length
    const r = ask('Add this to my calendar', 't')
    expect(useOS.getState().events.length).toBe(before + 1)
    expect(r.text).toMatch(/Willow Creek/)
    useOS.setState({ siriOnscreen: { app: null } })
  })
  it('finds home camera clips', () => {
    const r = ask('Show me when a package was left at the front door', 't')
    expect(r.intent).toBe('home_camera')
    expect(r.text).toMatch(/Front Door/)
  })
  it('routes with constraints', () => {
    const r = ask("Take me to a coffee shop on the way home that doesn't add more than ten minutes", 't')
    expect(r.intent).toBe('navigate')
    expect(r.text).toMatch(/Brew Lab|Daily Bean/)
  })
  it('runs multi-step requests', () => {
    const r = ask('Turn off the living room lights and lock the front door', 't')
    expect(r.intent).toBe('multi')
    expect(useOS.getState().accessories.find((a) => a.id === 'h-fp-lock')!.locked).toBe(true)
  })
  it('controls settings', () => {
    ask('Make Liquid Glass more clear', 't')
    expect(useOS.getState().glassTint).toBeLessThan(0.3)
  })
  it('handles follow-ups', () => {
    ask('When is robotics?', 't')
    const before = useOS.getState().reminders.length
    const r = ask('Remind me an hour before', 't')
    expect(r.intent).toBe('reminder')
    expect(useOS.getState().reminders.length).toBe(before + 1)
  })
  it('drafts messages', () => {
    const r = ask('Text Dad that I’m heading home', 't')
    expect(r.intent).toBe('send_message')
    expect(r.cards?.[0]).toMatchObject({ type: 'draft', to: 'dad' })
  })
  it('knows facts and math', () => {
    expect(ask('What is stoichiometry?', 't').intent).toBe('knowledge')
    expect(ask('split 86.40 four ways', 't').text).toMatch(/21\.60/)
  })
  it('weather personal context', () => {
    const r = ask("What's the weather for robotics?", 't')
    expect(r.intent).toBe('weather')
    expect(r.text).toMatch(/Robotics/)
  })
  it('flight confirmation', () => {
    expect(ask("What's my confirmation code?", 't').text).toMatch(/7XKQ2P/)
  })
})

describe('search', () => {
  it('finds across apps with synonyms', () => {
    const hits = search('puppy beach')
    expect(hits.some((h) => h.type === 'photo')).toBe(true)
    const r = search('robotics')
    const types = new Set(r.map((h) => h.type))
    expect(types.size).toBeGreaterThan(3)
  })
  it('searches photos semantically', () => {
    expect(searchPhotos('Biscuit at the beach').map((p) => p.id)).toContain('p-biscuit-beach')
    expect(searchPhotos('5 stars').length).toBeGreaterThan(2)
    expect(searchPhotos('receipt')[0].id).toBe('p-receipt')
  })
  it('finds contacts by phone number', () => {
    expect(search('0103345')[0]?.title).toMatch(/Alex/)
  })
})
