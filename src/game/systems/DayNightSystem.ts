import Phaser from 'phaser'
import { RoomConfig } from '../../types'
import { TILE_SIZE } from '../../constants'

/**
 * Day/night cycle phases:
 *   dawn (6:00-8:00)    → warm pink/orange sunrise
 *   day  (8:00-16:00)   → neutral bright
 *   golden (16:00-18:00) → warm golden tones
 *   dusk (18:00-20:00)  → deep orange/purple
 *   night (20:00-6:00)  → dark blue with stars + window glow
 *
 * One full cycle = 10 minutes real time (configurable).
 */

export type TimePhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night'

interface PhaseConfig {
  start: number // fractional hour [0..24)
  end: number
  tint: { r: number; g: number; b: number; a: number }
}

const PHASES: PhaseConfig[] = [
  { start: 6,  end: 8,  tint: { r: 60, g: 50, b: 120, a: 0.12 } },  // dawn (cool purple)
  { start: 8,  end: 16, tint: { r: 40, g: 50, b: 100, a: 0.06 } },  // day (subtle cool)
  { start: 16, end: 18, tint: { r: 80, g: 60, b: 140, a: 0.14 } },  // golden → twilight
  { start: 18, end: 20, tint: { r: 60, g: 40, b: 120, a: 0.20 } },  // dusk (deep purple)
  { start: 20, end: 30, tint: { r: 15, g: 20, b: 60,  a: 0.35 } },  // night (deep dark blue)
]

const PHASE_NAMES: TimePhase[] = ['dawn', 'day', 'golden', 'dusk', 'night']

const CYCLE_DURATION_MS = 10 * 60 * 1000 // 10 minutes = 24 game hours

interface Star {
  x: number
  y: number
  size: number
  twinkleOffset: number
  twinkleSpeed: number
  brightness: number
}

interface WindowGlow {
  x: number
  y: number
  roomId: string
}

export class DayNightSystem {
  private scene: Phaser.Scene
  private overlay!: Phaser.GameObjects.Graphics
  private starGraphics!: Phaser.GameObjects.Graphics
  private windowGlowGraphics!: Phaser.GameObjects.Graphics
  private elapsed = 0
  private stars: Star[] = []
  private windowGlows: WindowGlow[] = []
  private worldWidth: number
  private worldHeight: number
  private currentPhase: TimePhase = 'day'

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    rooms: RoomConfig[],
  ) {
    this.scene = scene
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    // Start at a random time so it's not always dawn on load
    this.elapsed = Math.random() * CYCLE_DURATION_MS

    // Create overlay graphics (drawn on top of everything)
    this.starGraphics = scene.add.graphics()
    this.starGraphics.setDepth(998)

    this.windowGlowGraphics = scene.add.graphics()
    this.windowGlowGraphics.setDepth(999)

    this.overlay = scene.add.graphics()
    this.overlay.setDepth(1000)

    this.generateStars()
    this.collectWindowPositions(rooms)
  }

  private generateStars() {
    const pixelW = this.worldWidth * TILE_SIZE
    const pixelH = this.worldHeight * TILE_SIZE
    const count = Math.floor((pixelW * pixelH) / 4000) // ~density based on world size

    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * pixelW,
        y: Math.random() * pixelH,
        size: Math.random() < 0.3 ? 2 : 1,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 2.5,
        brightness: 0.4 + Math.random() * 0.6,
      })
    }
  }

  private collectWindowPositions(rooms: RoomConfig[]) {
    for (const room of rooms) {
      if (!room.decorations) continue
      for (const deco of room.decorations) {
        if (deco.type === 'window') {
          this.windowGlows.push({
            x: deco.x,
            y: deco.y,
            roomId: room.id,
          })
        }
      }
    }
  }

  /** Returns the current game hour [0..24) */
  getGameHour(): number {
    const fraction = (this.elapsed % CYCLE_DURATION_MS) / CYCLE_DURATION_MS
    return fraction * 24
  }

  getPhase(): TimePhase {
    return this.currentPhase
  }

  /** Returns a display time string like "14:30" */
  getTimeString(): string {
    const hour = this.getGameHour()
    const h = Math.floor(hour)
    const m = Math.floor((hour - h) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  update(delta: number) {
    this.elapsed += delta

    const hour = this.getGameHour()
    const phaseIndex = this.getPhaseIndex(hour)
    this.currentPhase = PHASE_NAMES[phaseIndex]

    const tint = this.interpolateTint(hour)

    this.drawOverlay(tint)
    this.drawStars(hour)
    this.drawWindowGlows(hour)

    // Emit time events for UI
    this.scene.game.events.emit('game-time', {
      hour,
      phase: this.currentPhase,
      timeString: this.getTimeString(),
    })
  }

  private getPhaseIndex(hour: number): number {
    // Normalize night wrap: night is 20-6 but stored as 20-30
    const h = hour < 6 ? hour + 24 : hour
    for (let i = 0; i < PHASES.length; i++) {
      if (h >= PHASES[i].start && h < PHASES[i].end) return i
    }
    return 4 // night fallback
  }

  private interpolateTint(hour: number): { r: number; g: number; b: number; a: number } {
    const h = hour < 6 ? hour + 24 : hour
    const phaseIdx = this.getPhaseIndex(hour)
    const phase = PHASES[phaseIdx]
    const nextPhase = PHASES[(phaseIdx + 1) % PHASES.length]

    // Position within current phase [0..1]
    const phaseLen = phase.end - phase.start
    const t = (h - phase.start) / phaseLen

    // Smooth transition: ease in/out at phase boundaries
    // Blend toward next phase in the last 20% of current phase
    const blendZone = 0.8
    if (t > blendZone) {
      const blendT = (t - blendZone) / (1 - blendZone)
      const smooth = blendT * blendT * (3 - 2 * blendT) // smoothstep
      return {
        r: phase.tint.r + (nextPhase.tint.r - phase.tint.r) * smooth,
        g: phase.tint.g + (nextPhase.tint.g - phase.tint.g) * smooth,
        b: phase.tint.b + (nextPhase.tint.b - phase.tint.b) * smooth,
        a: phase.tint.a + (nextPhase.tint.a - phase.tint.a) * smooth,
      }
    }

    return { ...phase.tint }
  }

  private drawOverlay(tint: { r: number; g: number; b: number; a: number }) {
    const g = this.overlay
    g.clear()

    const w = this.worldWidth * TILE_SIZE
    const h = this.worldHeight * TILE_SIZE

    // Color tint overlay
    const color = Phaser.Display.Color.GetColor(
      Math.round(tint.r),
      Math.round(tint.g),
      Math.round(tint.b),
    )
    g.fillStyle(color, tint.a)
    g.fillRect(0, 0, w, h)
  }

  private drawStars(hour: number) {
    const g = this.starGraphics
    g.clear()

    // Stars only visible during night and partially during dusk/dawn
    let starAlpha = 0
    if (hour >= 20 || hour < 4) {
      starAlpha = 1
    } else if (hour >= 4 && hour < 6) {
      // Fade out during late night -> dawn
      starAlpha = 1 - (hour - 4) / 2
    } else if (hour >= 18 && hour < 20) {
      // Fade in during dusk -> night
      starAlpha = (hour - 18) / 2
    }

    if (starAlpha <= 0) return

    const time = this.elapsed / 1000

    for (const star of this.stars) {
      // Twinkle: sinusoidal brightness oscillation
      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset)
      const brightness = star.brightness * (0.5 + 0.5 * twinkle)
      const alpha = brightness * starAlpha

      if (alpha < 0.05) continue

      // Star color: mostly white, some slightly blue or yellow
      const colorVariant = Math.sin(star.twinkleOffset * 3)
      const r = Math.round(220 + colorVariant * 20)
      const gb = Math.round(220 + colorVariant * 35)
      const color = Phaser.Display.Color.GetColor(
        Math.min(255, r + 35),
        Math.min(255, gb),
        Math.min(255, gb + 15),
      )

      g.fillStyle(color, alpha)
      g.fillRect(star.x, star.y, star.size, star.size)

      // Bright stars get a cross glint
      if (brightness > 0.8 && star.size >= 2 && twinkle > 0.6) {
        g.fillStyle(color, alpha * 0.4)
        g.fillRect(star.x - 1, star.y, star.size + 2, star.size)
        g.fillRect(star.x, star.y - 1, star.size, star.size + 2)
      }
    }
  }

  private drawWindowGlows(hour: number) {
    const g = this.windowGlowGraphics
    g.clear()

    // Window glow only during night/dusk
    let glowAlpha = 0
    if (hour >= 20 || hour < 5) {
      glowAlpha = 0.7
    } else if (hour >= 5 && hour < 7) {
      // Fade out at dawn
      glowAlpha = 0.7 * (1 - (hour - 5) / 2)
    } else if (hour >= 18 && hour < 20) {
      // Fade in at dusk
      glowAlpha = 0.7 * ((hour - 18) / 2)
    }

    if (glowAlpha <= 0) return

    const T = TILE_SIZE

    for (const win of this.windowGlows) {
      const px = win.x * T
      const py = win.y * T

      // Cool blue/purple glow on the window itself
      g.fillStyle(0x6688cc, glowAlpha * 0.5)
      g.fillRect(px + 2, py + 2, T - 4, T - 4)

      // Soft glow halo around window
      g.fillStyle(0x5566aa, glowAlpha * 0.12)
      g.fillRect(px - 2, py - 2, T + 4, T + 4)

      // Light spill onto floor below window
      const spillY = py + T + 4 // just below the window row (accounting for top wall)
      const spillW = T * 2
      const spillH = T * 3
      const spillX = px - T / 2

      // Trapezoidal spill approximation using rectangles
      for (let row = 0; row < spillH; row++) {
        const t = row / spillH
        const rowAlpha = glowAlpha * 0.08 * (1 - t)
        if (rowAlpha < 0.01) break
        const widthExpand = t * T * 0.5
        g.fillStyle(0x6680bb, rowAlpha)
        g.fillRect(
          spillX - widthExpand,
          spillY + row,
          spillW + widthExpand * 2,
          1,
        )
      }
    }
  }

  destroy() {
    this.overlay.destroy()
    this.starGraphics.destroy()
    this.windowGlowGraphics.destroy()
  }
}
