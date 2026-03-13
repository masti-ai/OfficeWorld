import Phaser from 'phaser'
import { TILE_SIZE } from '../../constants'

/** Particle effect types tied to agent actions */
export type ParticleEffect =
  | 'typing_debris'
  | 'compile_sparkles'
  | 'merge_convergence'
  | 'error_sweat'
  | 'celebration_confetti'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: number
  size: number
  gravity: number
  alpha: number
  rotation: number
  rotationSpeed: number
}

interface ActiveEffect {
  worldX: number
  worldY: number
  particles: Particle[]
  graphics: Phaser.GameObjects.Graphics
  type: ParticleEffect
}

// Colors for each effect type
const TYPING_COLORS = [0xaaccff, 0x88aadd, 0x66ff99, 0xffcc44, 0xffffff]
const SPARKLE_COLORS = [0xffff00, 0x00ffaa, 0x88ffff, 0xffffff, 0xffdd44]
const MERGE_COLORS = [0x8844ff, 0x4488ff, 0x44ddff, 0xaa88ff, 0x6644dd]
const ERROR_COLORS = [0x44aaff, 0x88ccff, 0x66bbff]
const CONFETTI_COLORS = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8800, 0xff0088]

export class AgentParticleSystem {
  private scene: Phaser.Scene
  private effects: ActiveEffect[] = []
  private typingTimers = new Map<string, number>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Emit particles at a world pixel position */
  emit(worldX: number, worldY: number, type: ParticleEffect) {
    const gfx = this.scene.add.graphics()
    gfx.setDepth(50)

    const particles = this.createParticles(worldX, worldY, type)
    this.effects.push({ worldX, worldY, particles, graphics: gfx, type })
  }

  /** Emit at a tile position */
  emitAtTile(tileX: number, tileY: number, type: ParticleEffect) {
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2
    this.emit(wx, wy, type)
  }

  /** Periodic typing debris for working agents — call per-agent each frame */
  tickTyping(agentId: string, worldX: number, worldY: number, delta: number) {
    const timer = (this.typingTimers.get(agentId) ?? 0) + delta
    // Emit typing debris every 800-1600ms
    if (timer > 800 + Math.random() * 800) {
      this.typingTimers.set(agentId, 0)
      this.emit(worldX, worldY - 6, 'typing_debris')
    } else {
      this.typingTimers.set(agentId, timer)
    }
  }

  /** Stop tracking typing timer for an agent */
  stopTyping(agentId: string) {
    this.typingTimers.delete(agentId)
  }

  private createParticles(cx: number, cy: number, type: ParticleEffect): Particle[] {
    switch (type) {
      case 'typing_debris':
        return this.createTypingDebris(cx, cy)
      case 'compile_sparkles':
        return this.createCompileSparkles(cx, cy)
      case 'merge_convergence':
        return this.createMergeConvergence(cx, cy)
      case 'error_sweat':
        return this.createErrorSweat(cx, cy)
      case 'celebration_confetti':
        return this.createConfetti(cx, cy)
    }
  }

  private createTypingDebris(cx: number, cy: number): Particle[] {
    const count = 2 + Math.floor(Math.random() * 3)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 6,
        y: cy - 4,
        vx: (Math.random() - 0.5) * 30,
        vy: -15 - Math.random() * 25,
        life: 0,
        maxLife: 400 + Math.random() * 300,
        color: TYPING_COLORS[Math.floor(Math.random() * TYPING_COLORS.length)],
        size: 1 + Math.random(),
        gravity: 60,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      })
    }
    return particles
  }

  private createCompileSparkles(cx: number, cy: number): Particle[] {
    const count = 8 + Math.floor(Math.random() * 6)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 20 + Math.random() * 40
      particles.push({
        x: cx,
        y: cy - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 500 + Math.random() * 400,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        size: 1 + Math.random() * 1.5,
        gravity: 0,
        alpha: 1,
        rotation: 0,
        rotationSpeed: 0,
      })
    }
    return particles
  }

  private createMergeConvergence(cx: number, cy: number): Particle[] {
    const count = 10 + Math.floor(Math.random() * 6)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      const dist = 20 + Math.random() * 20
      // Start far away, velocity points inward (converge)
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy - 4 + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * (25 + Math.random() * 15),
        vy: -Math.sin(angle) * (25 + Math.random() * 15),
        life: 0,
        maxLife: 600 + Math.random() * 200,
        color: MERGE_COLORS[Math.floor(Math.random() * MERGE_COLORS.length)],
        size: 1.5 + Math.random(),
        gravity: 0,
        alpha: 1,
        rotation: angle,
        rotationSpeed: 3,
      })
    }
    return particles
  }

  private createErrorSweat(cx: number, cy: number): Particle[] {
    const particles: Particle[] = []
    // 2-4 sweat drops from the head area
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      particles.push({
        x: cx + side * (3 + Math.random() * 4),
        y: cy - 10 - Math.random() * 4,
        vx: side * (8 + Math.random() * 12),
        vy: -10 - Math.random() * 8,
        life: 0,
        maxLife: 600 + Math.random() * 300,
        color: ERROR_COLORS[Math.floor(Math.random() * ERROR_COLORS.length)],
        size: 1.5 + Math.random() * 0.5,
        gravity: 80,
        alpha: 1,
        rotation: 0,
        rotationSpeed: 0,
      })
    }
    return particles
  }

  private createConfetti(cx: number, cy: number): Particle[] {
    const count = 16 + Math.floor(Math.random() * 10)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 4,
        y: cy - 6,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 50,
        life: 0,
        maxLife: 800 + Math.random() * 600,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 1 + Math.random() * 2,
        gravity: 50,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
      })
    }
    return particles
  }

  update(delta: number) {
    const dt = delta / 1000

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]
      let alive = false

      effect.graphics.clear()

      for (const p of effect.particles) {
        p.life += delta
        if (p.life >= p.maxLife) continue

        alive = true
        const t = p.life / p.maxLife

        // Physics
        p.vy += p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rotation += p.rotationSpeed * dt

        // Merge convergence: slow down as they approach center
        if (effect.type === 'merge_convergence' && t > 0.5) {
          p.vx *= 0.95
          p.vy *= 0.95
        }

        // Fade out in last 30% of life
        p.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1

        // Draw particle
        this.drawParticle(effect.graphics, p, effect.type)
      }

      if (!alive) {
        effect.graphics.destroy()
        this.effects.splice(i, 1)
      }
    }
  }

  private drawParticle(gfx: Phaser.GameObjects.Graphics, p: Particle, type: ParticleEffect) {
    gfx.fillStyle(p.color, p.alpha)

    switch (type) {
      case 'typing_debris': {
        // Tiny rectangles (like key fragments)
        const s = p.size
        gfx.fillRect(p.x - s / 2, p.y - s / 2, s, s * 0.7)
        break
      }

      case 'compile_sparkles': {
        // Cross/star shape
        const s = p.size
        gfx.fillRect(p.x - s / 2, p.y - 0.5, s, 1)
        gfx.fillRect(p.x - 0.5, p.y - s / 2, 1, s)
        break
      }

      case 'merge_convergence': {
        // Small diamond/dot with trail
        const s = p.size
        gfx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
        // Trail
        gfx.fillStyle(p.color, p.alpha * 0.3)
        const trailX = p.x - p.vx * 0.05
        const trailY = p.y - p.vy * 0.05
        gfx.fillRect(trailX - s / 4, trailY - s / 4, s / 2, s / 2)
        break
      }

      case 'error_sweat': {
        // Teardrop shape: circle + triangle pointing down
        const s = p.size
        gfx.fillCircle(p.x, p.y, s)
        gfx.fillTriangle(
          p.x - s * 0.6, p.y,
          p.x + s * 0.6, p.y,
          p.x, p.y + s * 1.8,
        )
        break
      }

      case 'celebration_confetti': {
        // Small rectangles at various rotations
        const s = p.size
        const w = s * 1.5
        const h = s * 0.6
        // Approximate rotation with position offset
        const rx = Math.cos(p.rotation) * w / 2
        const ry = Math.sin(p.rotation) * h / 2
        gfx.fillRect(p.x - rx, p.y - ry, w, h)
        break
      }
    }
  }

  destroy() {
    for (const effect of this.effects) {
      effect.graphics.destroy()
    }
    this.effects = []
    this.typingTimers.clear()
  }
}
