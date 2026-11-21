import type { Mood } from '../character'
import type { TimeOfDay } from '../sky'

export type SceneCtx = { tod: TimeOfDay; mood: Mood }

export type Scene = {
  id: string
  name: string
  /** What the picture shows, for a reader that cannot see it. */
  alt: (ctx: SceneCtx) => string
  build: (ctx: SceneCtx) => string
}
