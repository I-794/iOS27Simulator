import { memo, type CSSProperties } from 'react'
import { Scene } from '../../art/Scene'
import type { Photo } from '../../os/types'
import { cssFilter, edits, type PhEdits } from './look'
import { EXTRA_SCENES, ExtraScene } from './extraScenes'

/** Renders a library item with its non-destructive edits applied. */
export const PhotoView = memo(function PhotoView({ photo, grain, className, style, override, fit = 'cover' }: { photo: Photo; grain?: boolean; className?: string; style?: CSSProperties; override?: Partial<PhEdits>; fit?: 'cover' | 'contain' }) {
  const e = { ...edits(photo), ...(override ?? {}) }
  const zoom = (e.crop ?? 1) * (e.capture?.zoom ?? 1) * (e.reframe?.tilt ? 1 + Math.abs(e.reframe.tilt) * 0.035 : 1)
  const mirror = e.capture?.mirror
  const transform = [zoom !== 1 ? `scale(${zoom})` : '', mirror ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined
  if (EXTRA_SCENES[photo.scene]) return <ExtraScene scene={photo.scene} className={className} filter={cssFilter(e)} extended={e.extended} style={{ width: '100%', height: '100%', transform, ...style }} />
  return (
    <Scene
      scene={photo.scene}
      fit={fit}
      removed={e.cleanedUp}
      extended={e.extended}
      reframe={e.reframe}
      filter={cssFilter(e)}
      grain={grain}
      className={className}
      title={photo.description || photo.scene}
      style={{ width: '100%', height: '100%', transform, ...style }}
    />
  )
})
