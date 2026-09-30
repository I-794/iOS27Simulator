import type { Track } from './types'
import { TRACKS, PODCASTS } from './data/media'
import { useOS } from './store'

type NP = ReturnType<typeof useOS.getState>['nowPlaying']

/** What is playing right now as a Track-shaped object: a song, or a podcast episode. */
export function nowPlayingTrack(np: NP = useOS.getState().nowPlaying): Track {
  if (np.kind === 'podcast' && np.episodeId) {
    for (const show of PODCASTS) {
      const ep = show.episodes.find((e) => e.id === np.episodeId)
      if (ep) return { id: ep.id, title: ep.title, artist: show.title, album: show.title, duration: ep.duration, bpm: 0, key: 'C', hue: show.hue }
    }
  }
  return TRACKS.find((t) => t.id === np.trackId) ?? TRACKS[0]
}
