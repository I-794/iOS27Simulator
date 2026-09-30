import type { ShortcutAction } from '../../os/types'
import { makeAction } from './actions'

export interface GalleryItem { name: string; desc: string; color: string; icon: string; trigger?: string; build: () => ShortcutAction[] }

export const GALLERY: { title: string; items: GalleryItem[] }[] = [
  {
    title: 'Apple Intelligence',
    items: [
      { name: 'Summarize Screen', desc: 'Summarizes whatever is on screen with Apple Intelligence.', color: '#bf5af2', icon: 'sparkles', build: () => [makeAction('screen', { content: 'Text' }), makeAction('summarize', { text: '[Screen Content]' }), makeAction('showResult', { text: '[Summary]' })] },
      { name: 'Ask About Screen', desc: 'Asks Private Cloud Compute a question about what you’re looking at.', color: '#5e5ce6', icon: 'sparkles', build: () => [makeAction('screen'), makeAction('ask', { prompt: 'What do you want to know?' }), makeAction('model', { prompt: '[Provided Input] — using [Screen Content]' }), makeAction('showResult', { text: '[Response]' })] },
      { name: 'Log Screenshot to Notes', desc: 'Every Safari screenshot is summarized into your notes.', color: '#af52de', icon: 'camera', trigger: 'Screenshot taken in Safari', build: () => [makeAction('screen'), makeAction('summarize', { text: '[Screen Content]' }), makeAction('note', { text: '[Summary]', note: 'Robotics Build Log' })] },
    ],
  },
  {
    title: 'Starter Shortcuts',
    items: [
      { name: 'Text Last Image', desc: 'Sends your most recent screenshot to a friend.', color: '#34c759', icon: 'message', build: () => [makeAction('screenshot'), makeAction('message', { text: '[Screenshot]', to: 'Alex' })] },
      { name: 'Running Late', desc: 'Lets the Drumline group know your ETA.', color: '#ff2d55', icon: 'drum', build: () => [makeAction('eta', { to: 'Lincoln High School' }), makeAction('text', { text: 'Running late — ETA [Travel Time]' }), makeAction('message', { text: '[Text]', to: 'Drumline 🥁 (Group)' })] },
      { name: 'Pomodoro', desc: 'Study Focus on, 25-minute timer, calm music.', color: '#ff9500', icon: 'timer', build: () => [makeAction('focus', { focus: 'Study', state: 'On', until: '1 hour' }), makeAction('timer', { duration: '25 minutes' }), makeAction('music', { playlist: 'Study Focus' })] },
      { name: 'Count Streak', desc: 'Uses the new Data Store to count how many days you practiced.', color: '#30b0c7', icon: 'drop', build: () => [makeAction('dataGet', { key: 'practice-days' }), makeAction('text', { text: 'Practiced again! Last value: [Stored Data]' }), makeAction('dataSave', { value: '[Text]', key: 'practice-days' }), makeAction('showResult', { text: '[Text]' })] },
    ],
  },
  {
    title: 'Home & Focus',
    items: [
      { name: 'Good Night', desc: 'Sleep Focus, lock up, and lights off.', color: '#5856d6', icon: 'moon', build: () => [makeAction('focus', { focus: 'Sleep', state: 'On', until: 'Tomorrow morning' }), makeAction('scene', { scene: 'Good Night' }), makeAction('lock', { state: 'Lock' })] },
      { name: 'Rain Check', desc: 'Reminds you to grab an umbrella when rain is coming.', color: '#0a84ff', icon: 'umbrella', trigger: 'Time of Day: 6:30 AM, Daily', build: () => {
        const w = makeAction('weather', { when: 'Today' })
        const iff = makeAction('if', { input: 'Weather', cond: 'contains', value: 'Rain' })
        iff.children = [makeAction('reminder', { title: 'Bring an umbrella', when: 'in 1 hour' })]
        iff.elseIf = [{ condition: 'Weather contains Sunny', actions: [makeAction('notification', { text: 'Sunny today — sunglasses!' })] }]
        iff.otherwise = []
        return [w, iff]
      } },
      { name: 'Arrive Home', desc: 'Porch light on and front door unlocked when you get home.', color: '#34c759', icon: 'home', trigger: 'Arrive at Home', build: () => [makeAction('scene', { scene: 'Arrive Home' }), makeAction('lock', { state: 'Unlock' })] },
    ],
  },
]
