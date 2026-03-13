import Phaser from 'phaser'
import { AgentState } from '../../types'

/** Which icon to show in the thought bubble */
export type BubbleIcon = 'gear' | 'lightbulb' | 'coffee' | 'zzz' | 'music' | 'none'

interface AgentBubble {
  container: Phaser.GameObjects.Container
  graphics: Phaser.GameObjects.Graphics
  currentIcon: BubbleIcon
  targetIcon: BubbleIcon
  alpha: number
  bobOffset: number
  bobTimer: number
  /** Time spent in idle — triggers zzz after threshold */
  idleTime: number
  /** Temporary override icon (e.g. lightbulb on compile) with remaining ms */
  overrideIcon: BubbleIcon | null
  overrideTimer: number
}

const IDLE_ZZZ_THRESHOLD = 8000 // ms idle before zzz appears
const OVERRIDE_DURATION = 3000 // ms for temporary icons (lightbulb, music)
const FADE_SPEED = 3 // alpha per second
const BOB_SPEED = 2.5 // radians per second
const BOB_AMPLITUDE = 2 // pixels
const BUBBLE_Y_OFFSET = -22 // above the sprite

export class ThoughtBubbleSystem {
  private scene: Phaser.Scene
  private bubbles = new Map<string, AgentBubble>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Register an agent to track. Call after creating CharacterSprite. */
  register(agentId: string, parentContainer: Phaser.GameObjects.Container) {
    const graphics = this.scene.add.graphics()
    const container = this.scene.add.container(0, BUBBLE_Y_OFFSET, [graphics])
    container.setAlpha(0)
    parentContainer.add(container)

    this.bubbles.set(agentId, {
      container,
      graphics,
      currentIcon: 'none',
      targetIcon: 'none',
      alpha: 0,
      bobOffset: 0,
      bobTimer: Math.random() * Math.PI * 2, // random start phase
      idleTime: 0,
      overrideIcon: null,
      overrideTimer: 0,
    })
  }

  /** Trigger a temporary icon (e.g. lightbulb on compile, music on celebration) */
  flashIcon(agentId: string, icon: BubbleIcon, durationMs = OVERRIDE_DURATION) {
    const bubble = this.bubbles.get(agentId)
    if (!bubble) return
    bubble.overrideIcon = icon
    bubble.overrideTimer = durationMs
  }

  /** Determine what icon an agent should show based on status */
  private resolveIcon(agentId: string, status: AgentState['status']): BubbleIcon {
    const bubble = this.bubbles.get(agentId)
    if (!bubble) return 'none'

    // Temporary overrides take priority
    if (bubble.overrideIcon) return bubble.overrideIcon

    switch (status) {
      case 'working':
        return 'gear'
      case 'idle':
        return bubble.idleTime > IDLE_ZZZ_THRESHOLD ? 'zzz' : 'none'
      case 'eating':
      case 'bathroom':
        return 'coffee'
      case 'playing':
        return 'music'
      case 'smoking':
        return 'none' // smoke particles handle this
      case 'meeting':
        return 'gear'
      case 'walking':
      case 'offline':
      default:
        return 'none'
    }
  }

  update(delta: number, agentStates: Map<string, AgentState>) {
    const dt = delta / 1000

    for (const [agentId, bubble] of this.bubbles) {
      const state = agentStates.get(agentId)
      if (!state) continue

      // Track idle time
      if (state.status === 'idle') {
        bubble.idleTime += delta
      } else {
        bubble.idleTime = 0
      }

      // Tick override timer
      if (bubble.overrideTimer > 0) {
        bubble.overrideTimer -= delta
        if (bubble.overrideTimer <= 0) {
          bubble.overrideIcon = null
          bubble.overrideTimer = 0
        }
      }

      // Resolve target icon
      bubble.targetIcon = this.resolveIcon(agentId, state.status)

      // Fade in/out
      if (bubble.targetIcon !== 'none') {
        bubble.alpha = Math.min(1, bubble.alpha + FADE_SPEED * dt)
      } else {
        bubble.alpha = Math.max(0, bubble.alpha - FADE_SPEED * dt)
      }

      // If faded out and icon changed, switch icon
      if (bubble.alpha <= 0 && bubble.currentIcon !== bubble.targetIcon) {
        bubble.currentIcon = bubble.targetIcon
      }
      // If fading in to new icon, switch immediately
      if (bubble.targetIcon !== 'none' && bubble.currentIcon !== bubble.targetIcon) {
        bubble.currentIcon = bubble.targetIcon
        this.redrawIcon(bubble)
      }

      bubble.container.setAlpha(bubble.alpha)

      // Bob animation
      if (bubble.alpha > 0) {
        bubble.bobTimer += BOB_SPEED * dt
        bubble.bobOffset = Math.sin(bubble.bobTimer) * BOB_AMPLITUDE
        bubble.container.y = BUBBLE_Y_OFFSET + bubble.bobOffset
      }
    }
  }

  private redrawIcon(bubble: AgentBubble) {
    const gfx = bubble.graphics
    gfx.clear()

    if (bubble.currentIcon === 'none') return

    // Draw thought bubble background
    this.drawBubbleBg(gfx)

    // Draw icon
    switch (bubble.currentIcon) {
      case 'gear':
        this.drawGear(gfx)
        break
      case 'lightbulb':
        this.drawLightbulb(gfx)
        break
      case 'coffee':
        this.drawCoffee(gfx)
        break
      case 'zzz':
        this.drawZzz(gfx)
        break
      case 'music':
        this.drawMusic(gfx)
        break
    }
  }

  /** Small rounded thought bubble with trailing dots */
  private drawBubbleBg(gfx: Phaser.GameObjects.Graphics) {
    // Main bubble
    gfx.fillStyle(0xffffff, 0.9)
    gfx.fillRoundedRect(-7, -7, 14, 14, 3)
    gfx.lineStyle(1, 0x888888, 0.6)
    gfx.strokeRoundedRect(-7, -7, 14, 14, 3)

    // Trail dots (thought bubble style)
    gfx.fillStyle(0xffffff, 0.7)
    gfx.fillCircle(2, 9, 2)
    gfx.fillStyle(0xffffff, 0.5)
    gfx.fillCircle(4, 12, 1.2)
  }

  /** Gear/cog icon — agent is thinking/working */
  private drawGear(gfx: Phaser.GameObjects.Graphics) {
    // Center gear body
    gfx.fillStyle(0x666666)
    gfx.fillCircle(0, 0, 3)
    gfx.fillStyle(0x999999)
    gfx.fillCircle(0, 0, 1.5)

    // Gear teeth (8 positions around the circle)
    gfx.fillStyle(0x666666)
    const teeth = 6
    for (let i = 0; i < teeth; i++) {
      const angle = (Math.PI * 2 * i) / teeth
      const tx = Math.cos(angle) * 4
      const ty = Math.sin(angle) * 4
      gfx.fillRect(tx - 1, ty - 1, 2, 2)
    }
  }

  /** Lightbulb icon — idea/compile success */
  private drawLightbulb(gfx: Phaser.GameObjects.Graphics) {
    // Bulb
    gfx.fillStyle(0xffdd44)
    gfx.fillCircle(0, -1, 3)

    // Glow
    gfx.fillStyle(0xffee88, 0.4)
    gfx.fillCircle(0, -1, 4.5)

    // Base/screw
    gfx.fillStyle(0xaaaaaa)
    gfx.fillRect(-1.5, 2, 3, 2)
    gfx.fillStyle(0x888888)
    gfx.fillRect(-1, 4, 2, 1)

    // Filament highlight
    gfx.fillStyle(0xffffff, 0.8)
    gfx.fillRect(-0.5, -2.5, 1, 2)
  }

  /** Coffee cup icon — on break */
  private drawCoffee(gfx: Phaser.GameObjects.Graphics) {
    // Cup body
    gfx.fillStyle(0xeeeeee)
    gfx.fillRect(-3, -1, 6, 5)
    gfx.fillStyle(0xdddddd)
    gfx.fillRect(-3, -1, 6, 1)

    // Handle
    gfx.lineStyle(1.5, 0xcccccc)
    gfx.strokeCircle(4, 1.5, 2)

    // Coffee liquid
    gfx.fillStyle(0x8b5a2b)
    gfx.fillRect(-2, 0, 4, 3)

    // Steam wisps
    gfx.fillStyle(0xcccccc, 0.6)
    gfx.fillRect(-1, -3, 1, 1.5)
    gfx.fillRect(1, -4, 1, 1.5)
  }

  /** Zzz icon — idle/sleeping */
  private drawZzz(gfx: Phaser.GameObjects.Graphics) {
    // Three Z's at different sizes, stacked
    gfx.fillStyle(0x6666cc)

    // Large Z
    gfx.fillRect(-3, -4, 5, 1)
    gfx.fillRect(-1, -3, 1, 1)
    gfx.fillRect(-3, -2, 5, 1)

    // Medium Z
    gfx.fillRect(0, 0, 3, 1)
    gfx.fillRect(1, 1, 1, 1)
    gfx.fillRect(0, 2, 3, 1)

    // Small z
    gfx.fillStyle(0x8888dd, 0.7)
    gfx.fillRect(2, 3, 2, 1)
    gfx.fillRect(3, 4, 1, 1)
  }

  /** Music notes icon — happy/playing */
  private drawMusic(gfx: Phaser.GameObjects.Graphics) {
    // Note 1
    gfx.fillStyle(0x44aa88)
    gfx.fillCircle(-2, 2, 2)
    gfx.fillRect(-0.5, -4, 1.5, 6)

    // Note 2
    gfx.fillStyle(0x44aa88)
    gfx.fillCircle(3, 1, 2)
    gfx.fillRect(4.5, -5, 1.5, 6)

    // Beam connecting notes
    gfx.fillStyle(0x44aa88)
    gfx.fillRect(-0.5, -5, 6.5, 1.5)
  }

  /** Remove an agent's bubble */
  unregister(agentId: string) {
    const bubble = this.bubbles.get(agentId)
    if (bubble) {
      bubble.container.destroy()
      this.bubbles.delete(agentId)
    }
  }

  destroy() {
    for (const bubble of this.bubbles.values()) {
      bubble.container.destroy()
    }
    this.bubbles.clear()
  }
}
