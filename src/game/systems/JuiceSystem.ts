import Phaser from 'phaser'

/**
 * Juice system: screen shake, squash-stretch, impact frames, camera punch.
 * All effects are non-destructive and layer on top of existing visuals.
 */

// --- Screen Shake ---

interface ShakeConfig {
  intensity: number // pixels of max displacement
  duration: number  // ms
  decay?: boolean   // ease out (default true)
}

const SHAKE_PRESETS: Record<string, ShakeConfig> = {
  light:    { intensity: 1.5, duration: 150 },
  medium:   { intensity: 3,   duration: 250 },
  heavy:    { intensity: 5,   duration: 400 },
  error:    { intensity: 2,   duration: 200 },
}

// --- Impact Frame ---

interface ImpactFrameState {
  remaining: number // ms left
  graphics: Phaser.GameObjects.Graphics | null
}

// --- Camera Punch ---

interface PunchState {
  dx: number
  dy: number
  remaining: number
  duration: number
}

// --- Squash-Stretch ---

/** Any object with setScale (Container, Sprite, etc.) */
interface Scalable {
  setScale(x: number, y?: number): void
}

interface SquashStretchState {
  target: Scalable
  elapsed: number
  duration: number
  squashX: number
  squashY: number
  stretchX: number
  stretchY: number
}

export type JuiceEvent =
  | 'compile'
  | 'error'
  | 'merge'
  | 'celebration'
  | 'collision'
  | 'explosion'
  | 'spawn'
  | 'status_change'

export class JuiceSystem {
  private scene: Phaser.Scene
  private camera: Phaser.Cameras.Scene2D.Camera

  // Shake state
  private shakeRemaining = 0
  private shakeDuration = 0
  private shakeIntensity = 0
  private shakeDecay = true

  // Impact frame overlay
  private impact: ImpactFrameState = { remaining: 0, graphics: null }

  // Camera punch (directional kick that returns)
  private punch: PunchState | null = null
  private punchOffsetX = 0
  private punchOffsetY = 0

  // Active squash-stretch effects
  private squashEffects: SquashStretchState[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.camera = scene.cameras.main
  }

  // ── Public API ───────────────────────────────────────────

  /** Fire a juice event — picks appropriate effects automatically */
  fire(event: JuiceEvent, _worldX?: number, _worldY?: number) {
    switch (event) {
      case 'compile':
        this.shake('light')
        break
      case 'error':
        this.shake('error')
        this.flashImpact(60, 0xff2244, 0.12)
        break
      case 'merge':
        this.shake('medium')
        this.cameraPunch(0, -3, 200)
        this.flashImpact(80, 0x8844ff, 0.15)
        break
      case 'celebration':
        this.shake('medium')
        this.flashImpact(100, 0xffff00, 0.1)
        break
      case 'collision':
        this.shake('light')
        this.flashImpact(50, 0xffffff, 0.25)
        break
      case 'explosion':
        this.shake('heavy')
        this.cameraPunch(0, -5, 300)
        this.flashImpact(120, 0xff8800, 0.2)
        break
      case 'spawn':
        this.shake('light')
        break
      case 'status_change':
        // Subtle shake only
        this.shakeCustom(1, 100, true)
        break
    }
  }

  /** Apply squash-stretch to a game object (e.g., a sprite or container) */
  squashStretch(
    target: Scalable,
    opts?: { squash?: number; stretch?: number; duration?: number },
  ) {
    const squash = opts?.squash ?? 0.75
    const stretch = opts?.stretch ?? 1.2
    const duration = opts?.duration ?? 200

    this.squashEffects.push({
      target,
      elapsed: 0,
      duration,
      squashX: 1 / squash,  // wider when squashed
      squashY: squash,
      stretchX: 1 / stretch, // narrower when stretched
      stretchY: stretch,
    })
  }

  /** Named shake presets */
  shake(preset: keyof typeof SHAKE_PRESETS) {
    const cfg = SHAKE_PRESETS[preset]
    this.shakeCustom(cfg.intensity, cfg.duration, cfg.decay ?? true)
  }

  /** Custom shake parameters */
  shakeCustom(intensity: number, duration: number, decay: boolean) {
    // Don't override a stronger shake
    if (this.shakeRemaining > 0 && this.shakeIntensity > intensity) return
    this.shakeIntensity = intensity
    this.shakeDuration = duration
    this.shakeRemaining = duration
    this.shakeDecay = decay
  }

  /** Full-screen impact flash (white/color overlay that fades fast) */
  flashImpact(durationMs: number, color = 0xffffff, alpha = 0.25) {
    if (this.impact.graphics) {
      this.impact.graphics.destroy()
    }
    const gfx = this.scene.add.graphics()
    gfx.setDepth(200)
    gfx.setScrollFactor(0) // screen-space
    gfx.fillStyle(color, alpha)
    gfx.fillRect(0, 0, this.camera.width, this.camera.height)

    this.impact = { remaining: durationMs, graphics: gfx }
  }

  /** Directional camera kick that rubber-bands back */
  cameraPunch(dx: number, dy: number, duration: number) {
    this.punch = { dx, dy, remaining: duration, duration }
  }

  // ── Update Loop ──────────────────────────────────────────

  update(delta: number) {
    this.updateShake(delta)
    this.updateImpact(delta)
    this.updatePunch(delta)
    this.updateSquashStretch(delta)
  }

  private updateShake(delta: number) {
    if (this.shakeRemaining <= 0) return

    this.shakeRemaining -= delta
    const t = this.shakeDecay
      ? Math.max(0, this.shakeRemaining / this.shakeDuration)
      : 1
    const intensity = this.shakeIntensity * t

    const ox = (Math.random() - 0.5) * 2 * intensity
    const oy = (Math.random() - 0.5) * 2 * intensity

    this.camera.scrollX += ox
    this.camera.scrollY += oy

    if (this.shakeRemaining <= 0) {
      this.shakeRemaining = 0
    }
  }

  private updateImpact(delta: number) {
    if (this.impact.remaining <= 0 || !this.impact.graphics) return

    this.impact.remaining -= delta
    const t = Math.max(0, this.impact.remaining / 100) // fade over ~100ms
    this.impact.graphics.setAlpha(t)

    if (this.impact.remaining <= 0) {
      this.impact.graphics.destroy()
      this.impact.graphics = null
      this.impact.remaining = 0
    }
  }

  private updatePunch(delta: number) {
    if (!this.punch) return

    this.punch.remaining -= delta
    if (this.punch.remaining <= 0) {
      // Undo offset
      this.camera.scrollX -= this.punchOffsetX
      this.camera.scrollY -= this.punchOffsetY
      this.punchOffsetX = 0
      this.punchOffsetY = 0
      this.punch = null
      return
    }

    // Ease out: strong kick at start, rubber-band back
    const t = this.punch.remaining / this.punch.duration
    const ease = t * t // quadratic ease-out (starts strong, decays)
    const newOx = this.punch.dx * ease
    const newOy = this.punch.dy * ease

    // Apply delta offset
    this.camera.scrollX += newOx - this.punchOffsetX
    this.camera.scrollY += newOy - this.punchOffsetY
    this.punchOffsetX = newOx
    this.punchOffsetY = newOy
  }

  private updateSquashStretch(delta: number) {
    for (let i = this.squashEffects.length - 1; i >= 0; i--) {
      const ss = this.squashEffects[i]
      ss.elapsed += delta

      const totalDuration = ss.duration
      const third = totalDuration / 3

      let scaleX = 1
      let scaleY = 1

      if (ss.elapsed < third) {
        // Phase 1: squash
        const t = ss.elapsed / third
        const ease = Math.sin(t * Math.PI / 2) // ease-in
        scaleX = 1 + (ss.squashX - 1) * ease
        scaleY = 1 + (ss.squashY - 1) * ease
      } else if (ss.elapsed < third * 2) {
        // Phase 2: stretch (overshoot)
        const t = (ss.elapsed - third) / third
        const ease = Math.sin(t * Math.PI / 2)
        scaleX = ss.squashX + (ss.stretchX - ss.squashX) * ease
        scaleY = ss.squashY + (ss.stretchY - ss.squashY) * ease
      } else if (ss.elapsed < totalDuration) {
        // Phase 3: recover to normal
        const t = (ss.elapsed - third * 2) / third
        const ease = Math.sin(t * Math.PI / 2)
        scaleX = ss.stretchX + (1 - ss.stretchX) * ease
        scaleY = ss.stretchY + (1 - ss.stretchY) * ease
      } else {
        // Done — restore scale
        scaleX = 1
        scaleY = 1
        this.squashEffects.splice(i, 1)
      }

      ss.target.setScale(scaleX, scaleY)
    }
  }

  destroy() {
    if (this.impact.graphics) {
      this.impact.graphics.destroy()
      this.impact.graphics = null
    }
    // Restore punch offset
    if (this.punch) {
      this.camera.scrollX -= this.punchOffsetX
      this.camera.scrollY -= this.punchOffsetY
      this.punch = null
    }
    this.squashEffects = []
  }
}
