import { campfire } from './campfire'
import { city } from './city'
import { desk } from './desk'
import { ocean } from './ocean'
import { space } from './space'
import type { Scene } from './types'

export type { Scene, SceneCtx } from './types'

/** The scenes in the order they rotate. */
export const SCENES: readonly Scene[] = [city, ocean, campfire, space, desk]

export function sceneAt(index: number): Scene {
  const n = SCENES.length
  return SCENES[((index % n) + n) % n]!
}
