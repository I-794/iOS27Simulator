import { useEffect, useState } from 'react'
import { TRACKS, ARTISTS, PLAYLISTS } from '../../os/data/media'
import { useOS, playbackPosition } from '../../os/store'
import type { Track } from '../../os/types'

export interface Album {
  name: string
  artist: string
  hue: number
  tracks: Track[]
  year: number
  genre: string
  description: string
}

const GENRES: Record<string, string> = {
  'Luma Coast': 'Indie Pop',
  'The Midnight Ferns': 'Dream Pop',
  'Kai Marlowe': 'Synthpop',
  'Aria Vale': 'Ambient',
  'Static Bloom': 'Electronic',
  'Lincoln Drumline': 'Marching',
}

const YEARS: Record<string, number> = { 'Salt & Static': 2026, 'Low Orbit': 2025, 'Circuit Hearts': 2026, Glasshouse: 2024, 'Weather Systems': 2026, 'Fall Cadences': 2026 }

const BLURBS: Record<string, string> = {
  'Salt & Static': 'Luma Coast’s third record trades lo-fi haze for widescreen shimmer — songs about coastlines, late buses and the static between radio stations.',
  'Low Orbit': 'Recorded over one winter in a converted greenhouse, Low Orbit drifts between lullaby and liftoff.',
  'Circuit Hearts': 'Kai Marlowe pairs glossy synth hooks with live drums, capturing the rush of a city at 2 AM.',
  Glasshouse: 'Sparse piano, close-miked vocals and the sound of rain on glass — an album for slowing down.',
  'Weather Systems': 'Static Bloom chase storms across ten high-voltage tracks built for the loudest part of the night.',
  'Fall Cadences': 'Lincoln High School’s drumline, recorded live at the first home game of the season.',
}

export const ALBUMS: Album[] = (() => {
  const map = new Map<string, Album>()
  for (const t of TRACKS) {
    let a = map.get(t.album)
    if (!a) {
      a = { name: t.album, artist: t.artist, hue: t.hue, tracks: [], year: YEARS[t.album] ?? 2026, genre: GENRES[t.artist] ?? 'Pop', description: BLURBS[t.album] ?? '' }
      map.set(t.album, a)
    }
    a.tracks.push(t)
  }
  return [...map.values()]
})()

export const albumByName = (n: string) => ALBUMS.find((a) => a.name === n)
export const trackById = (id: string) => TRACKS.find((t) => t.id === id)
export const artistByName = (n: string) => ARTISTS.find((a) => a.name === n)
export const albumsBy = (artist: string) => ALBUMS.filter((a) => a.artist === artist)
export const tracksBy = (artist: string) => TRACKS.filter((t) => t.artist === artist)
export { TRACKS, ARTISTS, PLAYLISTS }

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.floor(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const totalMinutes = (ts: Track[]) => Math.round(ts.reduce((a, t) => a + t.duration, 0) / 60)

/** Smooth playback position (rAF while playing). */
export function usePosition(active = true): number {
  const np = useOS((s) => s.nowPlaying)
  const [, force] = useState(0)
  useEffect(() => {
    if (!np.playing || !active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 90) {
        last = t
        force((n) => n + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [np.playing, active])
  return playbackPosition(np)
}

export const CREDITS: Record<string, { role: string; names: string }[]> = {
  default: [
    { role: 'Performed by', names: '' },
    { role: 'Produced by', names: 'Noor Castellanos, Theo Brandt' },
    { role: 'Written by', names: 'Rin Adeyemi, Theo Brandt' },
    { role: 'Mixing Engineer', names: 'Sol Park' },
    { role: 'Mastering Engineer', names: 'Ivy Harlan' },
  ],
}

export function playList(ids: string[], startId?: string, source?: string, shuffle = false) {
  const st = useOS.getState()
  let queue = [...ids]
  if (shuffle) {
    queue = queue.sort(() => Math.random() - 0.5)
  }
  const first = startId ?? queue[0]
  if (startId && shuffle) queue = [startId, ...queue.filter((x) => x !== startId)]
  st.playTrack(first, queue, source)
  if (shuffle !== st.nowPlaying.shuffle) useOS.setState({ nowPlaying: { ...useOS.getState().nowPlaying, shuffle } })
}

export const STATIONS = [
  { id: 'st-pulse', name: 'Pulse Radio', subtitle: 'Live · New music, every hour', hue: 350, tracks: ['t4', 't6', 't2', 't7', 't11'] },
  { id: 'st-chill', name: 'Chill Station', subtitle: 'Mellow sounds for focus', hue: 160, tracks: ['t5', 't9', 't12', 't3', 't10'] },
  { id: 'st-luma', name: 'Luma Coast Radio', subtitle: 'Station based on Luma Coast', hue: 198, tracks: ['t1', 't12', 't2', 't3', 't11'] },
  { id: 'st-drum', name: 'Drumline Hits', subtitle: 'Cadences & percussion', hue: 0, tracks: ['t8', 't6', 't4', 't7'] },
]

export const GENRE_TILES = [
  { name: 'Indie Pop', hue: 198, q: 'Luma Coast' },
  { name: 'Dream Pop', hue: 262, q: 'Midnight Ferns' },
  { name: 'Electronic', hue: 48, q: 'Static Bloom' },
  { name: 'Synthpop', hue: 330, q: 'Kai Marlowe' },
  { name: 'Ambient', hue: 160, q: 'Aria Vale' },
  { name: 'Marching Band', hue: 0, q: 'Drumline' },
  { name: 'Focus', hue: 150, q: 'Study' },
  { name: 'Workout', hue: 20, q: 'Northbound' },
]
