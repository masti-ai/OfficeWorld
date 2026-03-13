import Phaser from 'phaser'
import { RoomConfig, FurnitureItem, DecorationItem } from '../../types'
import { TILE_SIZE } from '../../constants'
import { TimePhase } from './DayNightSystem'

/**
 * Ambient life system: continuous subtle animations that make the office feel alive.
 *
 * - Coffee steam: rising wisps from coffee machines and cups
 * - Plant sway: gentle leaf oscillation on potted plants
 * - Clock hands: rotating minute/hour hands on wall clocks
 * - Monitor flicker: subtle brightness variation on idle monitors
 * - Ceiling fan: rotating fan blades in breakroom/meeting rooms
 * - Paper flutter: gentle rustling of papers on desks
 * - Fly sprite: a small fly buzzing around the office
 */

// --- Steam particles ---

interface SteamParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

interface SteamSource {
  worldX: number
  worldY: number
  timer: number
  particles: SteamParticle[]
}

// --- Plant sway state ---

interface PlantSway {
  item: FurnitureItem
  phase: number
  speed: number
}

// --- Clock state ---

interface ClockAnim {
  deco: DecorationItem
  roomX: number
  roomY: number
  minuteAngle: number
  hourAngle: number
}

// --- Monitor flicker state ---

interface MonitorFlicker {
  item: FurnitureItem
  flickerAlpha: number
  nextFlicker: number
}

// --- Ceiling fan state ---

interface CeilingFan {
  worldX: number
  worldY: number
  angle: number
  speed: number
}

// --- Paper flutter state ---

interface PaperFlutter {
  worldX: number
  worldY: number
  phase: number
  speed: number
  amplitude: number
}

// --- Fly state ---

interface FlySprite {
  x: number
  y: number
  targetX: number
  targetY: number
  restTimer: number
  buzzing: boolean
  wingPhase: number
}

export class AmbientLifeSystem {
  private rooms: RoomConfig[]
  private overlay: Phaser.GameObjects.Graphics

  private steamSources: SteamSource[] = []
  private plants: PlantSway[] = []
  private clocks: ClockAnim[] = []
  private flickerMonitors: MonitorFlicker[] = []
  private fans: CeilingFan[] = []
  private flutterPapers: PaperFlutter[] = []
  private flies: FlySprite[] = []

  constructor(scene: Phaser.Scene, rooms: RoomConfig[], _worldWidth: number, _worldHeight: number) {
    this.rooms = rooms

    this.overlay = scene.add.graphics()
    this.overlay.setDepth(11)

    this.initSteamSources()
    this.initPlants()
    this.initClocks()
    this.initMonitorFlickers()
    this.initCeilingFans()
    this.initPaperFlutters()
    this.initFlies()
  }

  // --- Initialization ---

  private initSteamSources() {
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type === 'coffee_machine' || item.type === 'coffee_cup') {
          this.steamSources.push({
            worldX: item.x * TILE_SIZE + (item.width * TILE_SIZE) / 2,
            worldY: item.y * TILE_SIZE,
            timer: Math.random() * 1000,
            particles: [],
          })
        }
      }
    }
  }

  private initPlants() {
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type === 'plant') {
          this.plants.push({
            item,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0008 + Math.random() * 0.0004,
          })
        }
      }
    }
  }

  private initClocks() {
    for (const room of this.rooms) {
      if (!room.decorations) continue
      for (const deco of room.decorations) {
        if (deco.type === 'clock') {
          this.clocks.push({
            deco,
            roomX: room.x,
            roomY: room.y,
            minuteAngle: Math.random() * Math.PI * 2,
            hourAngle: Math.random() * Math.PI * 2,
          })
        }
      }
    }
  }

  private initMonitorFlickers() {
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type === 'monitor' || item.type === 'dual_monitor' || item.type === 'triple_monitor') {
          this.flickerMonitors.push({
            item,
            flickerAlpha: 0,
            nextFlicker: 2000 + Math.random() * 8000,
          })
        }
      }
    }
  }

  private initCeilingFans() {
    // Place ceiling fans in breakroom and meeting rooms
    for (const room of this.rooms) {
      if (room.type === 'breakroom' || room.type === 'meeting_room') {
        const cx = (room.x + room.width / 2) * TILE_SIZE
        const cy = (room.y + room.height / 2 - 2) * TILE_SIZE
        this.fans.push({
          worldX: cx,
          worldY: cy,
          angle: Math.random() * Math.PI * 2,
          speed: 0.0015 + Math.random() * 0.0005,
        })
      }
    }
  }

  private initPaperFlutters() {
    // Scatter paper flutter effects on desks in department rooms
    for (const room of this.rooms) {
      if (room.type !== 'department' && room.id !== 'mayor_office') continue
      for (const item of room.furniture) {
        if (item.type === 'desk' && Math.random() < 0.4) {
          this.flutterPapers.push({
            worldX: item.x * TILE_SIZE + Math.random() * item.width * TILE_SIZE,
            worldY: item.y * TILE_SIZE + 2,
            phase: Math.random() * Math.PI * 2,
            speed: 0.001 + Math.random() * 0.001,
            amplitude: 0.3 + Math.random() * 0.4,
          })
        }
      }
    }
  }

  private initFlies() {
    // 1-2 flies buzzing around the office
    const flyCount = 1 + (Math.random() < 0.4 ? 1 : 0)
    for (let i = 0; i < flyCount; i++) {
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)]
      const x = (room.x + room.width / 2) * TILE_SIZE
      const y = (room.y + room.height / 2) * TILE_SIZE
      this.flies.push({
        x,
        y,
        targetX: x + (Math.random() - 0.5) * 60,
        targetY: y + (Math.random() - 0.5) * 40,
        restTimer: 0,
        buzzing: true,
        wingPhase: Math.random() * Math.PI * 2,
      })
    }
  }

  // --- Update ---

  update(delta: number, _timePhase: TimePhase) {
    this.overlay.clear()

    this.updateSteam(delta)
    this.updatePlants(delta)
    this.updateClocks(delta)
    this.updateMonitorFlickers(delta)
    this.updateCeilingFans(delta)
    this.updatePaperFlutters(delta)
    this.updateFlies(delta)
  }

  // --- Coffee Steam ---

  private updateSteam(delta: number) {
    const gfx = this.overlay

    for (const src of this.steamSources) {
      src.timer += delta

      // Spawn new steam particle every ~400ms
      if (src.timer > 400) {
        src.timer = 0
        if (src.particles.length < 6) {
          src.particles.push({
            x: src.worldX + (Math.random() - 0.5) * 4,
            y: src.worldY,
            vx: (Math.random() - 0.5) * 0.008,
            vy: -0.015 - Math.random() * 0.008,
            life: 0,
            maxLife: 800 + Math.random() * 600,
            size: 1 + Math.random(),
          })
        }
      }

      // Update and draw particles
      for (let i = src.particles.length - 1; i >= 0; i--) {
        const p = src.particles[i]
        p.life += delta
        if (p.life >= p.maxLife) {
          src.particles.splice(i, 1)
          continue
        }

        p.x += p.vx * delta
        p.y += p.vy * delta
        // Gentle drift
        p.vx += (Math.random() - 0.5) * 0.0001 * delta

        const t = p.life / p.maxLife
        const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
        const size = p.size * (1 + t * 0.5)

        gfx.fillStyle(0xdddde8, alpha * 0.35)
        gfx.fillRect(p.x - size / 2, p.y - size / 2, size, size)
      }
    }
  }

  // --- Plant Sway ---

  private updatePlants(delta: number) {
    const gfx = this.overlay

    for (const plant of this.plants) {
      plant.phase += plant.speed * delta
      const sway = Math.sin(plant.phase) * 1.2

      const px = plant.item.x * TILE_SIZE
      const py = plant.item.y * TILE_SIZE

      // Draw swaying leaf highlights to simulate movement
      const leafAlpha = 0.2 + Math.abs(Math.sin(plant.phase)) * 0.15

      // Top leaves shift with sway
      gfx.fillStyle(0x44aa44, leafAlpha)
      gfx.fillRect(px + 4 + sway, py + 1, 3, 2)
      gfx.fillRect(px + 7 + sway * 0.7, py + 2, 2, 2)

      // Secondary leaf layer (opposite phase)
      gfx.fillStyle(0x338833, leafAlpha * 0.7)
      gfx.fillRect(px + 2 - sway * 0.5, py + 3, 2, 2)
    }
  }

  // --- Clock Hands ---

  private updateClocks(delta: number) {
    const gfx = this.overlay

    for (const clock of this.clocks) {
      // Minute hand advances steadily, hour hand much slower
      clock.minuteAngle += delta * 0.001
      clock.hourAngle += delta * 0.0001

      const dx = clock.deco.x * TILE_SIZE
      const dy = clock.deco.y * TILE_SIZE

      const cx = dx + 8
      const cy = dy + 7

      // Clear area with face background
      gfx.fillStyle(0xeeeeee, 0.9)
      gfx.fillRect(dx + 4, dy + 3, 8, 8)

      // Minute hand
      const mLen = 3.5
      const mx = cx + Math.sin(clock.minuteAngle) * mLen
      const my = cy - Math.cos(clock.minuteAngle) * mLen
      gfx.fillStyle(0x333333, 0.85)
      // Draw line as series of pixels
      this.drawPixelLine(gfx, cx, cy, mx, my, 0x333333, 0.85)

      // Hour hand (shorter)
      const hLen = 2.2
      const hx = cx + Math.sin(clock.hourAngle) * hLen
      const hy = cy - Math.cos(clock.hourAngle) * hLen
      this.drawPixelLine(gfx, cx, cy, hx, hy, 0x333333, 0.85)

      // Center dot
      gfx.fillStyle(0xcc0000, 0.9)
      gfx.fillRect(cx, cy, 1, 1)

      // Hour markers (12, 3, 6, 9)
      gfx.fillStyle(0x555555, 0.6)
      gfx.fillRect(cx, dy + 3, 1, 1)     // 12
      gfx.fillRect(cx, dy + 10, 1, 1)    // 6
      gfx.fillRect(dx + 4, cy, 1, 1)     // 9
      gfx.fillRect(dx + 11, cy, 1, 1)    // 3
    }
  }

  private drawPixelLine(
    gfx: Phaser.GameObjects.Graphics,
    x0: number, y0: number,
    x1: number, y1: number,
    color: number, alpha: number,
  ) {
    const dx = x1 - x0
    const dy = y1 - y0
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
    const sx = dx / steps
    const sy = dy / steps

    gfx.fillStyle(color, alpha)
    for (let i = 0; i <= steps; i++) {
      gfx.fillRect(Math.round(x0 + sx * i), Math.round(y0 + sy * i), 1, 1)
    }
  }

  // --- Monitor Flicker ---

  private updateMonitorFlickers(delta: number) {
    const gfx = this.overlay

    for (const mon of this.flickerMonitors) {
      mon.nextFlicker -= delta

      if (mon.nextFlicker <= 0) {
        // Trigger a brief flicker
        mon.flickerAlpha = 0.12 + Math.random() * 0.1
        mon.nextFlicker = 3000 + Math.random() * 10000
      }

      // Decay flicker
      if (mon.flickerAlpha > 0) {
        mon.flickerAlpha -= delta * 0.0008
        if (mon.flickerAlpha < 0) mon.flickerAlpha = 0

        const mx = mon.item.x * TILE_SIZE + 2
        const my = mon.item.y * TILE_SIZE + 2
        const mw = mon.item.width * TILE_SIZE - 4
        const mh = mon.item.height * TILE_SIZE - 6

        // White flash overlay
        gfx.fillStyle(0xffffff, mon.flickerAlpha)
        gfx.fillRect(mx, my, mw, mh)

        // Occasional horizontal scan line during flicker
        if (mon.flickerAlpha > 0.08) {
          const scanY = my + Math.floor(Math.random() * mh)
          gfx.fillStyle(0xffffff, mon.flickerAlpha * 0.5)
          gfx.fillRect(mx, scanY, mw, 1)
        }
      }
    }
  }

  // --- Ceiling Fan ---

  private updateCeilingFans(delta: number) {
    const gfx = this.overlay

    for (const fan of this.fans) {
      fan.angle += fan.speed * delta

      const cx = fan.worldX
      const cy = fan.worldY

      // Draw fan center hub
      gfx.fillStyle(0x888888, 0.5)
      gfx.fillRect(cx - 1, cy - 1, 3, 3)

      // Draw 4 blades
      const bladeLen = 10
      for (let b = 0; b < 4; b++) {
        const angle = fan.angle + (b * Math.PI) / 2
        const tipX = cx + Math.cos(angle) * bladeLen
        const tipY = cy + Math.sin(angle) * bladeLen

        // Blade as a tapered line
        const midX = cx + Math.cos(angle) * bladeLen * 0.5
        const midY = cy + Math.sin(angle) * bladeLen * 0.5

        // Blade body (wider near center)
        const perpX = -Math.sin(angle)
        const perpY = Math.cos(angle)

        gfx.fillStyle(0x999999, 0.3)
        // Near hub (wider)
        gfx.fillRect(midX + perpX * -1, midY + perpY * -1, 3, 2)
        // Mid section
        gfx.fillRect(midX, midY, 2, 1)
        // Tip
        gfx.fillStyle(0x888888, 0.2)
        gfx.fillRect(Math.round(tipX), Math.round(tipY), 1, 1)
      }

      // Shadow on floor below (very subtle)
      gfx.fillStyle(0x000000, 0.04)
      gfx.fillEllipse(cx, cy + 20, 22, 6)
    }
  }

  // --- Paper Flutter ---

  private updatePaperFlutters(delta: number) {
    const gfx = this.overlay

    for (const paper of this.flutterPapers) {
      paper.phase += paper.speed * delta
      const flutter = Math.sin(paper.phase) * paper.amplitude

      // Tiny paper corner lifting effect
      const alpha = 0.15 + Math.abs(flutter) * 0.2

      gfx.fillStyle(0xf5f0e0, alpha)
      gfx.fillRect(paper.worldX + flutter, paper.worldY, 3, 2)

      // Shadow underneath shifts with flutter
      gfx.fillStyle(0x000000, alpha * 0.3)
      gfx.fillRect(paper.worldX + flutter + 0.5, paper.worldY + 2, 3, 1)
    }
  }

  // --- Fly Sprite ---

  private updateFlies(delta: number) {
    const gfx = this.overlay

    for (const fly of this.flies) {
      fly.wingPhase += delta * 0.03

      if (!fly.buzzing) {
        // Resting on a surface
        fly.restTimer -= delta
        if (fly.restTimer <= 0) {
          fly.buzzing = true
          this.pickFlyTarget(fly)
        }
      } else {
        // Move toward target
        const dx = fly.targetX - fly.x
        const dy = fly.targetY - fly.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 2) {
          // Arrived — rest for a bit
          fly.buzzing = false
          fly.restTimer = 1500 + Math.random() * 4000
        } else {
          const speed = 0.04
          fly.x += (dx / dist) * speed * delta
          fly.y += (dy / dist) * speed * delta
          // Erratic jitter
          fly.x += (Math.random() - 0.5) * 0.3
          fly.y += (Math.random() - 0.5) * 0.3
        }
      }

      // Draw fly body (1px dark dot)
      gfx.fillStyle(0x222222, 0.7)
      gfx.fillRect(Math.round(fly.x), Math.round(fly.y), 1, 1)

      // Wings (flicker when buzzing)
      if (fly.buzzing) {
        const wingOffset = Math.sin(fly.wingPhase) * 0.8
        gfx.fillStyle(0xaaaacc, 0.3 + Math.abs(wingOffset) * 0.2)
        gfx.fillRect(Math.round(fly.x - 1), Math.round(fly.y - wingOffset), 1, 1)
        gfx.fillRect(Math.round(fly.x + 1), Math.round(fly.y + wingOffset), 1, 1)
      }
    }
  }

  private pickFlyTarget(fly: FlySprite) {
    // Pick a random target within the world bounds, biased toward nearby rooms
    const room = this.rooms[Math.floor(Math.random() * this.rooms.length)]
    fly.targetX = (room.x + 2 + Math.random() * (room.width - 4)) * TILE_SIZE
    fly.targetY = (room.y + 2 + Math.random() * (room.height - 4)) * TILE_SIZE
  }

  destroy() {
    this.overlay.destroy()
    this.steamSources = []
    this.plants = []
    this.clocks = []
    this.flickerMonitors = []
    this.fans = []
    this.flutterPapers = []
    this.flies = []
  }
}
