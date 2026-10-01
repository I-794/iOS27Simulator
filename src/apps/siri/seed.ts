/* Seeds a few past Siri conversations the first time the app opens so the history
 * list shows how conversations continue across sessions. Text-only, no side effects. */
import { useOS, uid } from '../../os/store'
import type { SiriConversation } from '../../os/types'
import { at } from '../../os/time'
import { useSiriLocal } from './local'

export function seedDemo() {
  const st = useOS.getState()
  useSiriLocal.getState().set({ seeded: true })
  if (st.siriConversations.some((c) => c.turns.length > 0)) return
  const mk = (title: string, ts: number, turns: [role: 'user' | 'siri', text: string, extra?: Partial<SiriConversation['turns'][number]>][], pinned = false): SiriConversation => ({
    id: uid('siri'),
    title,
    updated: ts + turns.length * 40_000,
    pinned,
    turns: turns.map(([role, text, extra], i) => ({ id: uid('turn'), role, text, ts: ts + i * 40_000, ...extra })),
  })
  const demo: SiriConversation[] = [
    mk('Robotics regional prep', at(-1, 20, 12), [
      ['user', 'When is the robotics regional qualifier?'],
      ['siri', 'The Robotics Regional Qualifier is in 5 weeks at the State Fair Expo Hall, from 8:00 AM to 5:00 PM.', { cards: [{ type: 'event', eventId: 'e-regional' }], followUps: ['Remind me to order bumper fabric', 'What’s the weather for robotics?'] }],
      ['user', 'What still needs to be done on the intake?'],
      ['siri', 'From your Robotics Build Log: replace the polycord belts and test with 3 game pieces. The new side plates are already printed.', { cards: [{ type: 'note', noteId: 'n-buildlog' }] }],
    ], true),
    mk('Chem test study plan', at(-3, 19, 40), [
      ['user', 'Help me plan studying for my chem test'],
      ['siri', 'Your Chemistry Unit 3 Test is Friday at 10 AM. Based on your study guide, focus on mole ratios and limiting reagents. You still need to practice limiting reagent problems, and you have a study group with Priya on Friday afternoon.', { cards: [{ type: 'event', eventId: 'e-chem' }, { type: 'note', noteId: 'n-chem' }] }],
    ]),
    mk('Weekend weather', at(-9, 8, 5), [
      ['user', 'What’s the weather this weekend?'],
      ['siri', 'It’s mostly sunny in Maple Grove this weekend, with highs in the mid 60s.', { cards: [{ type: 'weather' }] }],
    ]),
  ]
  st.set({ siriConversations: [...st.siriConversations.filter((c) => c.turns.length > 0), ...demo] })
}
