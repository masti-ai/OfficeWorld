import Phaser from 'phaser'
import { TILE_SIZE } from '../../constants'
import { RoomConfig, AgentState, Doorway } from '../../types'
import { TimePhase } from './DayNightSystem'

/**
 * Environmental particle effects:
 *   - Dust motes floating in sunbeams (day/golden hours near windows)
 *   - Footstep dust puffs when agents walk
 *   - Door draft wisps near doorways
 *   - Electrical sparks near monitors/server racks
 *   - Fireflies drifting at night (outdoor areas)
 */

interface EnvParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: number
  alpha: number
  baseAlpha: number
}

// --- Sunbeam dust motes ---

interface SunbeamZone {
  x: number
  y: number
  width: number
  height: number
}

// --- Firefly ---

interface Firefly {
  x: number
  y: number
  vx: number
  vy: number
  glowPhase: number
  glowSpeed: number
  life: number
  maxLife: number
}

// --- Spark ---

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: number
}

const SUNBEAM_MOTE_COUNT = 24
const FIREFLY_COUNT = 18
const DRAFT_PARTICLE_COUNT = 3 // per doorway per burst
const SPARK_COLORS = [0xffff44, 0xffffaa, 0xff8800, 0xffffff]
const FIREFLY_COLORS = [0xaaff44, 0xccff66, 0xeeff88, 0xddffaa]
const DUST_PUFF_COLORS = [0xccbb99, 0xbbaa88, 0xddccaa]
const DRAFT_COLORS = [0xccccdd, 0xbbbbcc, 0xaaaabb]

export class EnvironmentalParticleSystem {
  private scene: Phaser.Scene
  private gfx!: Phaser.GameObjects.Graphics

  // Sunbeam dust motes
  private sunbeamZones: SunbeamZone[] = []
  private sunbeamMotes: EnvParticle[] = []

  // Footstep puffs (ephemeral)
  private footstepPuffs: EnvParticle[] = []
  private lastPositions = new Map<string, { x: number; y: number }>()

  // Door draft particles
  private doorways: Doorway[] = []
  private draftParticles: EnvParticle[] = []
  private draftTimer = 0

  // Electrical sparks
  private sparkSources: { x: number; y: number }[] = []
  private sparks: Spark[] = []
  private sparkTimer = 0

  // Fireflies
  private fireflies: Firefly[] = []
  private outdoorZones: { x: number; y: number; width: number; height: number }[] = []

  private elapsed = 0

  constructor(
    scene: Phaser.Scene,
    rooms: RoomConfig[],
    doorways: Doorway[],
  ) {
    this.scene = scene
    this.doorways = doorways

    this.gfx = scene.add.graphics()
    this.gfx.setDepth(48) // above ground effects, below agent particles

    this.collectSunbeamZones(rooms)
    this.collectSparkSources(rooms)
    this.collectOutdoorZones(rooms)
    this.initSunbeamMotes()
    this.initFireflies()
  }

  // --- Initialization ---

  private collectSunbeamZones(rooms: RoomConfig[]) {
    for (const room of rooms) {
      if (!room.decorations) continue
      for (const deco of room.decorations) {
        if (deco.type === 'window') {
          // Sunbeam extends diagonally from window into the room
          const wx = (room.x + deco.x) * TILE_SIZE
          const wy = (room.y + deco.y) * TILE_SIZE
          this.sunbeamZones.push({
            x: wx,
            y: wy,
            width: 4 * TILE_SIZE, // beam width
            height: 6 * TILE_SIZE, // beam depth into room
          })
        }
      }
    }
    // If no windows found, create some default zones in department rooms
    if (this.sunbeamZones.length === 0) {
      for (const room of rooms) {
        if (room.type === 'department' || room.type === 'mayor_office') {
          this.sunbeamZones.push({
            x: (room.x + 2) * TILE_SIZE,
            y: (room.y + 1) * TILE_SIZE,
            width: 4 * TILE_SIZE,
            height: 5 * TILE_SIZE,
          })
        }
      }
    }
  }

  private collectSparkSources(rooms: RoomConfig[]) {
    for (const room of rooms) {
      for (const f of room.furniture) {
        if (f.type === 'server_rack' || f.type === 'monitor' || f.type === 'pc_tower') {
          this.sparkSources.push({
            x: (room.x + f.x) * TILE_SIZE + (f.width * TILE_SIZE) / 2,
            y: (room.y + f.y) * TILE_SIZE + (f.height * TILE_SIZE) / 2,
          })
        }
      }
    }
  }

  private collectOutdoorZones(rooms: RoomConfig[]) {
    for (const room of rooms) {
      if (room.type === 'smoke_area' || room.id === 'smoke_area') {
        this.outdoorZones.push({
          x: room.x * TILE_SIZE,
          y: room.y * TILE_SIZE,
          width: room.width * TILE_SIZE,
          height: room.height * TILE_SIZE,
        })
      }
    }
    // If no smoke area, use hallway edges
    if (this.outdoorZones.length === 0) {
      for (const room of rooms) {
        if (room.type === 'hallway') {
          this.outdoorZones.push({
            x: room.x * TILE_SIZE,
            y: room.y * TILE_SIZE,
            width: room.width * TILE_SIZE,
            height: room.height * TILE_SIZE,
          })
        }
      }
    }
  }

  private initSunbeamMotes() {
    for (let i = 0; i < SUNBEAM_MOTE_COUNT; i++) {
      this.sunbeamMotes.push(this.createSunbeamMote())
    }
  }

  private createSunbeamMote(): EnvParticle {
    // Pick a random sunbeam zone
    if (this.sunbeamZones.length === 0) {
      return this.createDefaultMote()
    }
    const zone = this.sunbeamZones[Math.floor(Math.random() * this.sunbeamZones.length)]
    const baseAlpha = 0.15 + Math.random() * 0.25
    return {
      x: zone.x + Math.random() * zone.width,
      y: zone.y + Math.random() * zone.height,
      vx: (Math.random() - 0.5) * 3,
      vy: -0.5 + Math.random() * 1.5, // gentle upward drift
      life: Math.random() * 4000, // stagger start
      maxLife: 4000 + Math.random() * 3000,
      size: 1,
      color: 0xffffee,
      alpha: baseAlpha,
      baseAlpha,
    }
  }

  private createDefaultMote(): EnvParticle {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 1,
      color: 0xffffee, alpha: 0, baseAlpha: 0,
    }
  }

  private initFireflies() {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      this.fireflies.push(this.createFirefly())
    }
  }

  private createFirefly(): Firefly {
    const zone = this.outdoorZones.length > 0
      ? this.outdoorZones[Math.floor(Math.random() * this.outdoorZones.length)]
      : { x: 0, y: 0, width: 200, height: 200 }
    return {
      x: zone.x + Math.random() * zone.width,
      y: zone.y + Math.random() * zone.height,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 6,
      glowPhase: Math.random() * Math.PI * 2,
      glowSpeed: 1.5 + Math.random() * 2,
      life: Math.random() * 8000,
      maxLife: 8000 + Math.random() * 6000,
    }
  }

  // --- Footstep puff emission (called from main scene) ---

  emitFootstepPuff(worldX: number, worldY: number) {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const baseAlpha = 0.2 + Math.random() * 0.15
      this.footstepPuffs.push({
        x: worldX + (Math.random() - 0.5) * 4,
        y: worldY + 2 + Math.random() * 2, // at feet level
        vx: (Math.random() - 0.5) * 10,
        vy: -3 - Math.random() * 5,
        life: 0,
        maxLife: 300 + Math.random() * 200,
        size: 1 + Math.random(),
        color: DUST_PUFF_COLORS[Math.floor(Math.random() * DUST_PUFF_COLORS.length)],
        alpha: baseAlpha,
        baseAlpha,
      })
    }
  }

  // --- Update ---

  update(
    delta: number,
    phase: TimePhase,
    agentStates: Map<string, AgentState>,
    characters: Map<string, { getPosition(): { x: number; y: number } }>,
  ) {
    this.elapsed += delta
    const dt = delta / 1000

    const cam = this.scene.cameras.main
    const vl = cam.scrollX - 30
    const vr = cam.scrollX + cam.width / cam.zoom + 30
    const vt = cam.scrollY - 30
    const vb = cam.scrollY + cam.height / cam.zoom + 30

    this.gfx.clear()

    // Sunbeam motes: only during day/dawn/golden
    if (phase === 'day' || phase === 'dawn' || phase === 'golden') {
      const sunAlpha = phase === 'golden' ? 1.2 : phase === 'dawn' ? 0.6 : 0.8
      this.updateSunbeamMotes(dt, sunAlpha, vl, vr, vt, vb)
    }

    // Footstep puffs from walking agents
    this.detectFootsteps(agentStates, characters)
    this.updateFootstepPuffs(dt, vl, vr, vt, vb)

    // Door drafts
    this.draftTimer += delta
    if (this.draftTimer >= 2000 + Math.random() * 1500) {
      this.draftTimer = 0
      this.emitDraftParticles()
    }
    this.updateDraftParticles(dt, vl, vr, vt, vb)

    // Electrical sparks
    this.sparkTimer += delta
    if (this.sparkTimer >= 3000 + Math.random() * 5000) {
      this.sparkTimer = 0
      this.emitSparks()
    }
    this.updateSparks(dt, vl, vr, vt, vb)

    // Fireflies at night
    if (phase === 'night' || phase === 'dusk') {
      const fireflyAlpha = phase === 'night' ? 1.0 : 0.4
      this.updateFireflies(dt, fireflyAlpha, vl, vr, vt, vb)
    }
  }

  // --- Sunbeam motes ---

  private updateSunbeamMotes(
    dt: number, intensityMul: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.gfx
    const time = this.elapsed / 1000

    for (let i = 0; i < this.sunbeamMotes.length; i++) {
      const m = this.sunbeamMotes[i]
      m.life += dt * 1000

      if (m.life >= m.maxLife) {
        this.sunbeamMotes[i] = this.createSunbeamMote()
        continue
      }

      // Gentle drifting with slight wave
      m.x += (m.vx + Math.sin(time * 0.7 + i) * 1.5) * dt
      m.y += (m.vy + Math.cos(time * 0.5 + i * 0.3) * 0.8) * dt

      if (m.x < vl || m.x > vr || m.y < vt || m.y > vb) continue

      // Fade in/out
      const t = m.life / m.maxLife
      let alpha = m.baseAlpha * intensityMul
      if (t < 0.15) alpha *= t / 0.15
      else if (t > 0.85) alpha *= (1 - t) / 0.15

      // Twinkle effect
      alpha *= 0.6 + 0.4 * Math.sin(time * 3 + i * 1.7)

      g.fillStyle(m.color, Math.min(1, alpha))
      g.fillRect(Math.floor(m.x), Math.floor(m.y), m.size, m.size)
    }
  }

  // --- Footstep puffs ---

  private detectFootsteps(
    agentStates: Map<string, AgentState>,
    characters: Map<string, { getPosition(): { x: number; y: number } }>,
  ) {
    for (const [id, state] of agentStates) {
      if (state.status !== 'walking') {
        this.lastPositions.delete(id)
        continue
      }

      const char = characters.get(id)
      if (!char) continue
      const pos = char.getPosition()

      const last = this.lastPositions.get(id)
      if (last) {
        const dx = pos.x - last.x
        const dy = pos.y - last.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Emit puff every ~12px of movement
        if (dist > 12) {
          this.emitFootstepPuff(pos.x, pos.y + 6) // at feet
          this.lastPositions.set(id, { x: pos.x, y: pos.y })
        }
      } else {
        this.lastPositions.set(id, { x: pos.x, y: pos.y })
      }
    }
  }

  private updateFootstepPuffs(
    dt: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.gfx

    for (let i = this.footstepPuffs.length - 1; i >= 0; i--) {
      const p = this.footstepPuffs[i]
      p.life += dt * 1000
      if (p.life >= p.maxLife) {
        this.footstepPuffs.splice(i, 1)
        continue
      }

      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy -= 8 * dt // slight upward deceleration (gravity pulling back)

      if (p.x < vl || p.x > vr || p.y < vt || p.y > vb) continue

      const t = p.life / p.maxLife
      const alpha = p.baseAlpha * (1 - t) // linear fade out
      const size = p.size + t * 1.5 // expand as they dissipate

      g.fillStyle(p.color, alpha)
      g.fillCircle(Math.floor(p.x), Math.floor(p.y), size)
    }
  }

  // --- Door drafts ---

  private emitDraftParticles() {
    if (this.doorways.length === 0) return
    // Pick a random doorway
    const door = this.doorways[Math.floor(Math.random() * this.doorways.length)]
    const cx = door.x * TILE_SIZE + TILE_SIZE / 2
    const cy = door.y * TILE_SIZE + TILE_SIZE / 2

    for (let i = 0; i < DRAFT_PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 6 + Math.random() * 10
      const baseAlpha = 0.08 + Math.random() * 0.1
      this.draftParticles.push({
        x: cx + (Math.random() - 0.5) * TILE_SIZE,
        y: cy + (Math.random() - 0.5) * TILE_SIZE,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // slight upward bias
        life: 0,
        maxLife: 1200 + Math.random() * 800,
        size: 1,
        color: DRAFT_COLORS[Math.floor(Math.random() * DRAFT_COLORS.length)],
        alpha: baseAlpha,
        baseAlpha,
      })
    }
  }

  private updateDraftParticles(
    dt: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.gfx

    for (let i = this.draftParticles.length - 1; i >= 0; i--) {
      const p = this.draftParticles[i]
      p.life += dt * 1000
      if (p.life >= p.maxLife) {
        this.draftParticles.splice(i, 1)
        continue
      }

      // Slow down over time
      p.vx *= 0.995
      p.vy *= 0.995
      p.x += p.vx * dt
      p.y += p.vy * dt

      if (p.x < vl || p.x > vr || p.y < vt || p.y > vb) continue

      const t = p.life / p.maxLife
      let alpha = p.baseAlpha
      if (t < 0.1) alpha *= t / 0.1
      else if (t > 0.7) alpha *= (1 - t) / 0.3

      // Wispy trail: draw two offset dots
      g.fillStyle(p.color, alpha)
      g.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1)
      g.fillStyle(p.color, alpha * 0.5)
      g.fillRect(Math.floor(p.x - p.vx * 0.05), Math.floor(p.y - p.vy * 0.05), 1, 1)
    }
  }

  // --- Electrical sparks ---

  private emitSparks() {
    if (this.sparkSources.length === 0) return
    // Pick a random source
    const src = this.sparkSources[Math.floor(Math.random() * this.sparkSources.length)]
    const count = 2 + Math.floor(Math.random() * 3)

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI // mostly upward
      const speed = 20 + Math.random() * 30
      this.sparks.push({
        x: src.x + (Math.random() - 0.5) * 6,
        y: src.y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 200 + Math.random() * 200,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      })
    }
  }

  private updateSparks(
    dt: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.gfx

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life += dt * 1000
      if (s.life >= s.maxLife) {
        this.sparks.splice(i, 1)
        continue
      }

      s.vy += 60 * dt // gravity on sparks
      s.x += s.vx * dt
      s.y += s.vy * dt

      if (s.x < vl || s.x > vr || s.y < vt || s.y > vb) continue

      const t = s.life / s.maxLife
      const alpha = t < 0.1 ? t / 0.1 : (1 - t)

      // Bright core
      g.fillStyle(s.color, alpha)
      g.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1)
      // Glow halo
      g.fillStyle(0xffff88, alpha * 0.3)
      g.fillRect(Math.floor(s.x) - 1, Math.floor(s.y) - 1, 3, 3)
    }
  }

  // --- Fireflies ---

  private updateFireflies(
    dt: number, intensityMul: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.gfx

    for (let i = 0; i < this.fireflies.length; i++) {
      const ff = this.fireflies[i]
      ff.life += dt * 1000

      if (ff.life >= ff.maxLife) {
        this.fireflies[i] = this.createFirefly()
        continue
      }

      // Gentle wandering with direction changes
      ff.vx += (Math.random() - 0.5) * 4 * dt
      ff.vy += (Math.random() - 0.5) * 3 * dt
      // Clamp speed
      const speed = Math.sqrt(ff.vx * ff.vx + ff.vy * ff.vy)
      if (speed > 12) {
        ff.vx = (ff.vx / speed) * 12
        ff.vy = (ff.vy / speed) * 12
      }

      ff.x += ff.vx * dt
      ff.y += ff.vy * dt
      ff.glowPhase += ff.glowSpeed * dt

      if (ff.x < vl || ff.x > vr || ff.y < vt || ff.y > vb) continue

      // Pulsing glow
      const glow = Math.max(0, Math.sin(ff.glowPhase))
      const alpha = glow * 0.7 * intensityMul

      if (alpha < 0.02) continue

      const color = FIREFLY_COLORS[i % FIREFLY_COLORS.length]

      // Outer glow
      g.fillStyle(color, alpha * 0.15)
      g.fillCircle(Math.floor(ff.x), Math.floor(ff.y), 3)
      // Inner bright core
      g.fillStyle(color, alpha)
      g.fillRect(Math.floor(ff.x), Math.floor(ff.y), 1, 1)
      // Bright center pixel
      g.fillStyle(0xffffff, alpha * 0.8)
      g.fillRect(Math.floor(ff.x), Math.floor(ff.y), 1, 1)
    }
  }

  destroy() {
    this.gfx.destroy()
    this.sunbeamMotes = []
    this.footstepPuffs = []
    this.draftParticles = []
    this.sparks = []
    this.fireflies = []
  }
}
