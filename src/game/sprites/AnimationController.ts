import Phaser from 'phaser'
import { SHEET_COLS } from './SpriteGenerator'

const ANIM_ROWS = {
  idle: 0,
  'walk-down': 1,
  'walk-up': 2,
  'walk-left': 3,
  'walk-right': 4,
  'walk-down-left': 5,
  'walk-down-right': 6,
  'walk-up-left': 7,
  'walk-up-right': 8,
  action: 9,
  smoke: 10,
  play: 11,
  typing: 12,
  drinking: 13,
  chatting: 14,
  stretching: 15,
  reading: 16,
  'emote-thought': 17,
  'emote-exclamation': 18,
  'emote-sweat': 19,
} as const

export type AnimationName = keyof typeof ANIM_ROWS

export function registerAnimations(scene: Phaser.Scene, agentId: string, textureKey: string) {
  const anims = scene.anims

  for (const [name, row] of Object.entries(ANIM_ROWS)) {
    const animKey = `${agentId}_${name}`
    if (anims.exists(animKey)) continue

    const startFrame = row * SHEET_COLS
    const endFrame = startFrame + SHEET_COLS - 1
    const isWalk = name.startsWith('walk-')
    const isIdle = name === 'idle'
    const isEmote = name.startsWith('emote-')

    let frameRate: number
    if (isWalk) frameRate = 10
    else if (isIdle) frameRate = 3
    else if (name === 'play') frameRate = 8
    else if (name === 'typing') frameRate = 12
    else if (name === 'chatting') frameRate = 6
    else if (name === 'stretching') frameRate = 4
    else if (name === 'reading') frameRate = 3
    else if (isEmote) frameRate = 4
    else frameRate = 5

    anims.create({
      key: animKey,
      frames: anims.generateFrameNumbers(textureKey, {
        start: startFrame,
        end: endFrame,
      }),
      frameRate,
      repeat: -1,
    })
  }
}

export function getAnimKey(agentId: string, name: AnimationName): string {
  return `${agentId}_${name}`
}

export function directionToAnim(dx: number, dy: number): AnimationName {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Diagonal detection: both axes have significant movement
  if (absDx > 0.3 && absDy > 0.3) {
    if (dy > 0 && dx < 0) return 'walk-down-left'
    if (dy > 0 && dx > 0) return 'walk-down-right'
    if (dy < 0 && dx < 0) return 'walk-up-left'
    if (dy < 0 && dx > 0) return 'walk-up-right'
  }

  // Cardinal directions
  if (absDx > absDy) {
    return dx < 0 ? 'walk-left' : 'walk-right'
  }
  if (dy !== 0) {
    return dy < 0 ? 'walk-up' : 'walk-down'
  }
  return 'idle'
}
