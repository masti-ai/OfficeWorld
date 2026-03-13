import Phaser from 'phaser'

export type TransitionType = 'circle-wipe' | 'diamond-wipe' | 'pixel-dissolve' | 'iris' | 'slide'
export type SlideDirection = 'left' | 'right' | 'up' | 'down'

export interface TransitionConfig {
  type: TransitionType
  duration?: number
  color?: number
  direction?: SlideDirection
  pixelSize?: number
  onComplete?: () => void
}

const DEFAULT_DURATION = 600
const DEFAULT_COLOR = 0x000000
const DEFAULT_PIXEL_SIZE = 8

/**
 * GBA-style screen transitions for scene changes.
 * Creates full-screen overlay effects using Phaser Graphics.
 *
 * Usage:
 *   const transition = new ScreenTransition(scene)
 *   transition.play({ type: 'circle-wipe', duration: 500 })
 *   // or with midpoint callback:
 *   transition.playInOut({ type: 'iris' }, () => { changeScene() })
 */
export class ScreenTransition {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private progress = 0
  private config: Required<TransitionConfig> | null = null
  private active = false
  private fadingIn = true // true = screen being covered, false = screen being revealed
  private dissolveOrder: number[] = []
  private midpointCallback: (() => void) | null = null
  private inOutMode = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(9999)
    this.graphics.setScrollFactor(0)
    this.graphics.setVisible(false)
  }

  get isActive(): boolean {
    return this.active
  }

  /** Play a single transition (cover or reveal). */
  play(config: TransitionConfig, fadeIn = true): Promise<void> {
    return new Promise((resolve) => {
      this.config = {
        type: config.type,
        duration: config.duration ?? DEFAULT_DURATION,
        color: config.color ?? DEFAULT_COLOR,
        direction: config.direction ?? 'left',
        pixelSize: config.pixelSize ?? DEFAULT_PIXEL_SIZE,
        onComplete: () => {
          config.onComplete?.()
          resolve()
        },
      }
      this.fadingIn = fadeIn
      this.progress = 0
      this.active = true
      this.graphics.setVisible(true)

      if (config.type === 'pixel-dissolve') {
        this.buildDissolveOrder()
      }
    })
  }

  /**
   * Play a full in-out transition: cover screen, run callback at midpoint, then reveal.
   * Classic GBA scene-change pattern.
   */
  playInOut(config: TransitionConfig, onMidpoint?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.inOutMode = true
      this.midpointCallback = onMidpoint ?? null

      this.config = {
        type: config.type,
        duration: config.duration ?? DEFAULT_DURATION,
        color: config.color ?? DEFAULT_COLOR,
        direction: config.direction ?? 'left',
        pixelSize: config.pixelSize ?? DEFAULT_PIXEL_SIZE,
        onComplete: () => {
          config.onComplete?.()
          resolve()
        },
      }
      this.fadingIn = true
      this.progress = 0
      this.active = true
      this.graphics.setVisible(true)

      if (config.type === 'pixel-dissolve') {
        this.buildDissolveOrder()
      }
    })
  }

  update(delta: number) {
    if (!this.active || !this.config) return

    this.progress += delta / this.config.duration
    if (this.progress >= 1) {
      this.progress = 1
      this.render()

      if (this.inOutMode && this.fadingIn) {
        // Midpoint: screen fully covered
        this.midpointCallback?.()
        this.midpointCallback = null
        this.fadingIn = false
        this.progress = 0

        if (this.config.type === 'pixel-dissolve') {
          this.buildDissolveOrder()
        }
        return
      }

      // Transition complete
      this.active = false
      this.inOutMode = false
      this.graphics.setVisible(false)
      this.config.onComplete()
      return
    }

    this.render()
  }

  private render() {
    if (!this.config) return

    const cam = this.scene.cameras.main
    const w = cam.width
    const h = cam.height

    this.graphics.clear()

    // Effective progress: fadingIn goes 0->1 (covering), fadingOut goes 1->0 (revealing)
    const t = this.fadingIn ? this.progress : 1 - this.progress

    switch (this.config.type) {
      case 'circle-wipe':
        this.renderCircleWipe(w, h, t)
        break
      case 'diamond-wipe':
        this.renderDiamondWipe(w, h, t)
        break
      case 'pixel-dissolve':
        this.renderPixelDissolve(w, h, t)
        break
      case 'iris':
        this.renderIris(w, h, t)
        break
      case 'slide':
        this.renderSlide(w, h, t)
        break
    }
  }

  /**
   * Circle wipe: a circle shrinks from full screen to center (covering),
   * or expands from center to full screen (revealing).
   * The covered area is filled with the transition color.
   */
  private renderCircleWipe(w: number, h: number, t: number) {
    const cx = w / 2
    const cy = h / 2
    const maxRadius = Math.sqrt(cx * cx + cy * cy)
    // At t=0 radius is max (nothing covered), at t=1 radius is 0 (fully covered)
    const radius = maxRadius * (1 - this.easeInOut(t))

    // Fill entire screen, then cut out a circle
    this.graphics.fillStyle(this.config!.color, 1)
    this.graphics.fillRect(0, 0, w, h)

    if (radius > 0) {
      // Use blendMode to cut out the circle
      this.graphics.fillStyle(this.config!.color, 0)
      // We can't truly cut out with Graphics alone, so we'll draw the coverage differently:
      // Draw the color as a ring/frame around the clear circle using a stencil approach.
      // Since Phaser Graphics doesn't support subtractive fills, we'll draw the border manually.
      this.graphics.clear()
      this.drawCircleMask(w, h, cx, cy, radius)
    }
  }

  /**
   * Draw a filled rect with a circular hole by approximating with polygon strips.
   * GBA-style: we quantize the radius to pixel boundaries for that chunky look.
   */
  private drawCircleMask(w: number, h: number, cx: number, cy: number, radius: number) {
    const color = this.config!.color
    const pixelSize = 4 // GBA-chunky pixel quantization
    const qRadius = Math.round(radius / pixelSize) * pixelSize

    this.graphics.fillStyle(color, 1)

    // Draw horizontal strips that avoid the circle
    for (let y = 0; y < h; y += pixelSize) {
      const dy = Math.abs(y + pixelSize / 2 - cy)
      if (dy >= qRadius) {
        // Entire row is outside circle — fill fully
        this.graphics.fillRect(0, y, w, pixelSize)
      } else {
        // Partial row — compute the horizontal extent of the circle at this y
        const dx = Math.sqrt(qRadius * qRadius - dy * dy)
        const left = Math.round((cx - dx) / pixelSize) * pixelSize
        const right = Math.round((cx + dx) / pixelSize) * pixelSize

        if (left > 0) this.graphics.fillRect(0, y, left, pixelSize)
        if (right < w) this.graphics.fillRect(right, y, w - right, pixelSize)
      }
    }
  }

  /**
   * Diamond wipe: a diamond shape expands/contracts from center.
   */
  private renderDiamondWipe(w: number, h: number, t: number) {
    const cx = w / 2
    const cy = h / 2
    const maxSize = Math.max(w, h)
    const size = maxSize * (1 - this.easeInOut(t))
    const pixelSize = 4

    this.graphics.fillStyle(this.config!.color, 1)

    // Draw strips outside the diamond (|x-cx|/size + |y-cy|/size > 1)
    for (let y = 0; y < h; y += pixelSize) {
      const dy = Math.abs(y + pixelSize / 2 - cy)
      const remainX = size > 0 ? size * (1 - dy / size) : 0

      if (remainX <= 0 || size <= 0) {
        this.graphics.fillRect(0, y, w, pixelSize)
      } else {
        const left = Math.round((cx - remainX) / pixelSize) * pixelSize
        const right = Math.round((cx + remainX) / pixelSize) * pixelSize

        if (left > 0) this.graphics.fillRect(0, y, left, pixelSize)
        if (right < w) this.graphics.fillRect(right, y, w - right, pixelSize)
      }
    }
  }

  /**
   * Pixel dissolve: random pixel-sized blocks appear/disappear.
   * Pre-computed random order for consistency.
   */
  private renderPixelDissolve(w: number, h: number, t: number) {
    const ps = this.config!.pixelSize
    const cols = Math.ceil(w / ps)
    const rows = Math.ceil(h / ps)
    const total = cols * rows
    const filledCount = Math.floor(total * this.easeInOut(t))

    this.graphics.fillStyle(this.config!.color, 1)

    for (let i = 0; i < filledCount && i < this.dissolveOrder.length; i++) {
      const idx = this.dissolveOrder[i]
      const col = idx % cols
      const row = Math.floor(idx / cols)
      this.graphics.fillRect(col * ps, row * ps, ps, ps)
    }
  }

  /**
   * Iris: similar to circle wipe but uses a tighter easing for the classic
   * "camera iris" feel (fast start, slow close at center).
   */
  private renderIris(w: number, h: number, t: number) {
    const cx = w / 2
    const cy = h / 2
    const maxRadius = Math.sqrt(cx * cx + cy * cy)
    // Iris uses a different easing: fast open/close with a pause near the edges
    const eased = this.easeIris(t)
    const radius = maxRadius * (1 - eased)

    this.graphics.fillStyle(this.config!.color, 1)

    if (radius <= 0) {
      this.graphics.fillRect(0, 0, w, h)
      return
    }

    // Iris has a slightly sharper edge than circle wipe (2px quantization)
    const pixelSize = 2
    const qRadius = Math.round(radius / pixelSize) * pixelSize

    for (let y = 0; y < h; y += pixelSize) {
      const dy = Math.abs(y + pixelSize / 2 - cy)
      if (dy >= qRadius) {
        this.graphics.fillRect(0, y, w, pixelSize)
      } else {
        const dx = Math.sqrt(qRadius * qRadius - dy * dy)
        const left = Math.round((cx - dx) / pixelSize) * pixelSize
        const right = Math.round((cx + dx) / pixelSize) * pixelSize

        if (left > 0) this.graphics.fillRect(0, y, left, pixelSize)
        if (right < w) this.graphics.fillRect(right, y, w - right, pixelSize)
      }
    }
  }

  /**
   * Slide: the color slides in from a direction, covering/revealing the screen.
   */
  private renderSlide(w: number, h: number, t: number) {
    const eased = this.easeInOut(t)
    this.graphics.fillStyle(this.config!.color, 1)

    switch (this.config!.direction) {
      case 'left':
        this.graphics.fillRect(0, 0, w * eased, h)
        break
      case 'right':
        this.graphics.fillRect(w * (1 - eased), 0, w * eased, h)
        break
      case 'up':
        this.graphics.fillRect(0, 0, w, h * eased)
        break
      case 'down':
        this.graphics.fillRect(0, h * (1 - eased), w, h * eased)
        break
    }
  }

  private buildDissolveOrder() {
    const cam = this.scene.cameras.main
    const ps = this.config!.pixelSize
    const cols = Math.ceil(cam.width / ps)
    const rows = Math.ceil(cam.height / ps)
    const total = cols * rows

    // Fisher-Yates shuffle for random dissolve order
    this.dissolveOrder = Array.from({ length: total }, (_, i) => i)
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = this.dissolveOrder[i]
      this.dissolveOrder[i] = this.dissolveOrder[j]
      this.dissolveOrder[j] = tmp
    }
  }

  private easeInOut(t: number): number {
    // Smooth step for GBA-like feel
    return t * t * (3 - 2 * t)
  }

  private easeIris(t: number): number {
    // Faster at edges, slower near center (iris lens feel)
    if (t < 0.5) {
      return 2 * t * t
    }
    return 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  destroy() {
    this.graphics.destroy()
  }
}
