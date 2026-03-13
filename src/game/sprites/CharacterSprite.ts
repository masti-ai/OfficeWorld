import Phaser from 'phaser'
import { AgentState } from '../../types'
import { TILE_SIZE } from '../../constants'
import { FRAME_W, FRAME_H } from './SpriteGenerator'
import { registerAnimations, getAnimKey, directionToAnim, AnimationName } from './AnimationController'

// Display scale — how much bigger sprites appear vs their raw pixel size
const DISPLAY_SCALE = 1.5
const DISPLAY_W = Math.round(FRAME_W * DISPLAY_SCALE)
const DISPLAY_H = Math.round(FRAME_H * DISPLAY_SCALE)

const STATUS_COLORS: Record<string, number> = {
  working: 0x00ff88,
  idle: 0x888888,
  walking: 0xffaa00,
  smoking: 0xff4444,
  eating: 0x44aaff,
  bathroom: 0xcccccc,
  playing: 0xff44ff,
  meeting: 0x44ffaa,
  offline: 0x333333,
}

const STATUS_LABELS: Record<string, string> = {
  working: 'working',
  idle: 'idle',
  walking: '...',
  smoking: 'smoking',
  eating: 'eating',
  bathroom: 'away',
  playing: 'playing',
  meeting: 'meeting',
  offline: 'offline',
}

export class CharacterSprite {
  container: Phaser.GameObjects.Container
  private sprite: Phaser.GameObjects.Sprite
  private nameLabel: Phaser.GameObjects.Text
  private statusDot: Phaser.GameObjects.Arc
  private statusBg: Phaser.GameObjects.Rectangle
  private statusText: Phaser.GameObjects.Text
  private selected = false
  private selectionGlow: Phaser.GameObjects.Rectangle
  private agentId: string
  private currentAnim: AnimationName = 'idle'
  private wobbleTween: Phaser.Tweens.Tween | null = null
  private emoteOverlay: AnimationName | null = null
  private scene: Phaser.Scene

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    textureKey: string,
    tileX: number,
    tileY: number,
  ) {
    this.agentId = agentId
    this.scene = scene

    registerAnimations(scene, agentId, textureKey)

    this.sprite = scene.add.sprite(0, 0, textureKey, 0)
    this.sprite.setDisplaySize(DISPLAY_W, DISPLAY_H)

    // Name tag background (warm plaque style)
    const nameWidth = Math.max(name.length * 6 + 12, 40)
    this.statusBg = scene.add.rectangle(0, DISPLAY_H / 2 + 10, nameWidth, 14, 0x1a1520, 0.85)
    this.statusBg.setStrokeStyle(1, 0x64477d)

    // Name label
    this.nameLabel = scene.add.text(0, DISPLAY_H / 2 + 5, name, {
      fontSize: '10px',
      color: '#ffd700',
      fontFamily: "'ArkPixel', monospace",
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.nameLabel.setOrigin(0.5, 0)

    // Status text (below name)
    this.statusText = scene.add.text(0, DISPLAY_H / 2 + 18, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      fontFamily: "'ArkPixel', monospace",
      stroke: '#000000',
      strokeThickness: 1,
    })
    this.statusText.setOrigin(0.5, 0)

    // Status dot (larger, with glow)
    this.statusDot = scene.add.circle(DISPLAY_W / 2 + 6, -DISPLAY_H / 2 - 2, 5, STATUS_COLORS.idle)
    this.statusDot.setStrokeStyle(1.5, 0x000000)

    // Selection glow effect
    this.selectionGlow = scene.add.rectangle(0, 0, DISPLAY_W + 10, DISPLAY_H + 10)
    this.selectionGlow.setStrokeStyle(2, 0xffff00, 0.8)
    this.selectionGlow.setFillStyle(0xffff00, 0.1)
    this.selectionGlow.setVisible(false)

    this.container = scene.add.container(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      [this.selectionGlow, this.sprite, this.statusBg, this.nameLabel, this.statusText, this.statusDot],
    )
    // Y-sort depth: characters lower on screen appear in front
    this.container.setDepth(tileY + 5)

    // Larger hit area for easier clicking
    this.container.setSize(DISPLAY_W + 8, DISPLAY_H + 8)
    this.container.setInteractive()

    this.playAnim('idle')
    this.startIdleWobble()
  }

  private startIdleWobble() {
    if (this.wobbleTween) return
    this.wobbleTween = this.scene.tweens.add({
      targets: this.sprite,
      y: { from: 0, to: -1.5 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private stopIdleWobble() {
    if (this.wobbleTween) {
      this.wobbleTween.stop()
      this.wobbleTween = null
      this.sprite.y = 0
    }
  }

  select() {
    this.selected = true
    this.selectionGlow.setVisible(true)
  }

  deselect() {
    this.selected = false
    this.selectionGlow.setVisible(false)
  }

  isSelected(): boolean {
    return this.selected
  }

  updateStatus(status: AgentState['status']) {
    this.statusDot.setFillStyle(STATUS_COLORS[status] ?? STATUS_COLORS.idle)
    this.statusText.setText(STATUS_LABELS[status] ?? '')

    this.emoteOverlay = null
    if (status === 'working') {
      this.playAnim('typing')
      this.startIdleWobble()
    } else if (status === 'eating') {
      this.playAnim('drinking')
      this.startIdleWobble()
    } else if (status === 'smoking') {
      this.playAnim('smoke')
      this.startIdleWobble()
    } else if (status === 'playing') {
      this.playAnim('play')
      this.stopIdleWobble()
    } else if (status === 'meeting') {
      this.playAnim('chatting')
      this.startIdleWobble()
    } else if (status === 'walking') {
      this.stopIdleWobble()
    } else {
      this.playAnim('idle')
      this.startIdleWobble()
    }
  }

  setDirection(dx: number, dy: number) {
    if (dx === 0 && dy === 0) {
      this.playAnim('idle')
      this.startIdleWobble()
    } else {
      this.playAnim(directionToAnim(dx, dy))
      this.stopIdleWobble()
    }
  }

  setTilePosition(tileX: number, tileY: number) {
    this.container.x = tileX * TILE_SIZE + TILE_SIZE / 2
    this.container.y = tileY * TILE_SIZE + TILE_SIZE / 2
    // Y-sort depth update
    this.container.setDepth(tileY + 5)
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y }
  }

  private playAnim(name: AnimationName) {
    if (name === this.currentAnim) return
    this.currentAnim = name
    const key = getAnimKey(this.agentId, name)
    this.sprite.play(key)
  }

  playReading() {
    this.playAnim('reading')
    this.startIdleWobble()
  }

  showEmote(type: 'thought' | 'exclamation' | 'sweat') {
    const emoteAnim: AnimationName =
      type === 'thought' ? 'emote-thought' :
      type === 'exclamation' ? 'emote-exclamation' :
      'emote-sweat'
    this.emoteOverlay = emoteAnim
    this.playAnim(emoteAnim)
  }

  hasEmote(): boolean {
    return this.emoteOverlay !== null
  }

  clearEmote() {
    this.emoteOverlay = null
    this.playAnim('idle')
    this.startIdleWobble()
  }

  destroy() {
    this.stopIdleWobble()
    this.container.destroy()
  }
}
