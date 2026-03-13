import Phaser from 'phaser'
import { TILE_SIZE } from '../../constants'
import { RoomConfig } from '../../types'
import { TimePhase } from './DayNightSystem'

/**
 * Weather system with GBA-style pixel art particles:
 *   - Rain: angled streaks with puddle ripples on ground
 *   - Snow: gentle falling flakes with ground accumulation
 *   - Fog: drifting translucent layers
 *   - Clear: ambient dust motes
 *   - Thunder: lightning flash + camera shake (rain only)
 */

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog'

interface RainDrop {
  x: number
  y: number
  speed: number
  length: number
  alpha: number
}

interface SnowFlake {
  x: number
  y: number
  speed: number
  size: number
  drift: number
  driftOffset: number
  alpha: number
}

interface FogLayer {
  x: number
  y: number
  width: number
  height: number
  speed: number
  alpha: number
  baseAlpha: number
}

interface DustMote {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  alpha: number
}

interface PuddleRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
}

interface SnowPile {
  x: number
  y: number
  width: number
  height: number
}

const WEATHER_TRANSITION_MS = 3000
const RAIN_COUNT = 180
const SNOW_COUNT = 120
const FOG_LAYER_COUNT = 8
const DUST_COUNT = 30
const MAX_PUDDLE_RIPPLES = 20
const MAX_SNOW_PILES = 40
const THUNDER_CHANCE = 0.008 // per-frame chance during rain
const THUNDER_FLASH_MS = 120
const THUNDER_SHAKE_MS = 300
const THUNDER_SHAKE_INTENSITY = 3

export class WeatherSystem {
  private scene: Phaser.Scene
  private weatherGfx!: Phaser.GameObjects.Graphics
  private groundGfx!: Phaser.GameObjects.Graphics
  private flashOverlay!: Phaser.GameObjects.Graphics
  private pixelW: number
  private pixelH: number

  private currentWeather: WeatherType = 'clear'
  private targetWeather: WeatherType = 'clear'
  private intensity = 0 // 0..1 blend toward target
  private transitionTimer = 0

  // Particle pools
  private rainDrops: RainDrop[] = []
  private snowFlakes: SnowFlake[] = []
  private fogLayers: FogLayer[] = []
  private dustMotes: DustMote[] = []
  private puddleRipples: PuddleRipple[] = []
  private snowPiles: SnowPile[] = []

  // Thunder state
  private thunderFlashTimer = 0
  private thunderShakeTimer = 0
  private isShaking = false

  // Weather cycle
  private weatherTimer = 0
  private weatherDuration = 0

  // Ground tile cache (walkable ground positions for puddles/snow)
  private groundPositions: { x: number; y: number }[] = []

  private elapsed = 0

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    rooms: RoomConfig[],
  ) {
    this.scene = scene
    this.pixelW = worldWidth * TILE_SIZE
    this.pixelH = worldHeight * TILE_SIZE

    // Ground effects layer (below overlay)
    this.groundGfx = scene.add.graphics()
    this.groundGfx.setDepth(45)

    // Weather particles layer
    this.weatherGfx = scene.add.graphics()
    this.weatherGfx.setDepth(997) // just below stars

    // Thunder flash overlay
    this.flashOverlay = scene.add.graphics()
    this.flashOverlay.setDepth(1001) // above day/night overlay

    this.collectGroundPositions(rooms)
    this.initPools()
    this.scheduleNextWeather()
  }

  private collectGroundPositions(rooms: RoomConfig[]) {
    // Collect outdoor walkable positions (smoke_area, hallway edges)
    // For simplicity, sample positions from outdoor-ish rooms
    const outdoorTypes = ['smoke_area', 'hallway']
    for (const room of rooms) {
      if (outdoorTypes.includes(room.type) || outdoorTypes.includes(room.id)) {
        for (let y = room.y + 1; y < room.y + room.height - 1; y += 3) {
          for (let x = room.x + 1; x < room.x + room.width - 1; x += 3) {
            this.groundPositions.push({ x: x * TILE_SIZE, y: y * TILE_SIZE })
          }
        }
      }
    }
    // Also add some random world positions for outdoor feel
    for (let i = 0; i < 20; i++) {
      this.groundPositions.push({
        x: Math.random() * this.pixelW,
        y: Math.random() * this.pixelH,
      })
    }
  }

  private initPools() {
    // Rain drops
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainDrops.push(this.createRainDrop())
    }
    // Snow flakes
    for (let i = 0; i < SNOW_COUNT; i++) {
      this.snowFlakes.push(this.createSnowFlake())
    }
    // Fog layers
    for (let i = 0; i < FOG_LAYER_COUNT; i++) {
      this.fogLayers.push(this.createFogLayer(i))
    }
    // Dust motes
    for (let i = 0; i < DUST_COUNT; i++) {
      this.dustMotes.push(this.createDustMote())
    }
  }

  private createRainDrop(): RainDrop {
    return {
      x: Math.random() * this.pixelW,
      y: Math.random() * this.pixelH,
      speed: 200 + Math.random() * 150,
      length: 3 + Math.random() * 4,
      alpha: 0.3 + Math.random() * 0.4,
    }
  }

  private createSnowFlake(): SnowFlake {
    return {
      x: Math.random() * this.pixelW,
      y: Math.random() * this.pixelH,
      speed: 15 + Math.random() * 25,
      size: 1 + Math.floor(Math.random() * 2),
      drift: 0.5 + Math.random() * 1.5,
      driftOffset: Math.random() * Math.PI * 2,
      alpha: 0.5 + Math.random() * 0.5,
    }
  }

  private createFogLayer(index: number): FogLayer {
    const baseAlpha = 0.04 + Math.random() * 0.06
    return {
      x: (index / FOG_LAYER_COUNT) * this.pixelW - this.pixelW * 0.2,
      y: this.pixelH * 0.2 + Math.random() * this.pixelH * 0.6,
      width: 60 + Math.random() * 120,
      height: 20 + Math.random() * 40,
      speed: 8 + Math.random() * 15,
      alpha: baseAlpha,
      baseAlpha,
    }
  }

  private createDustMote(): DustMote {
    return {
      x: Math.random() * this.pixelW,
      y: Math.random() * this.pixelH,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 4,
      life: 0,
      maxLife: 3000 + Math.random() * 4000,
      size: 1,
      alpha: 0.15 + Math.random() * 0.2,
    }
  }

  private scheduleNextWeather() {
    // Random weather duration: 30-90 seconds
    this.weatherDuration = 30000 + Math.random() * 60000
    this.weatherTimer = 0
  }

  /** Set weather immediately or transition smoothly */
  setWeather(type: WeatherType) {
    if (type === this.targetWeather) return
    this.targetWeather = type
    this.transitionTimer = 0
    if (this.currentWeather === 'clear' && type === 'clear') {
      this.intensity = 1
    }
  }

  getWeather(): WeatherType {
    return this.currentWeather
  }

  update(delta: number, phase: TimePhase) {
    this.elapsed += delta
    const dt = delta / 1000

    // Auto weather cycling
    this.weatherTimer += delta
    if (this.weatherTimer >= this.weatherDuration) {
      this.cycleWeather(phase)
      this.scheduleNextWeather()
    }

    // Transition blending
    if (this.currentWeather !== this.targetWeather) {
      this.transitionTimer += delta
      this.intensity = Math.min(1, this.transitionTimer / WEATHER_TRANSITION_MS)
      if (this.intensity >= 1) {
        this.currentWeather = this.targetWeather
        this.intensity = 1
      }
    }

    // Get camera viewport for culling
    const cam = this.scene.cameras.main
    const viewLeft = cam.scrollX - 50
    const viewRight = cam.scrollX + cam.width / cam.zoom + 50
    const viewTop = cam.scrollY - 50
    const viewBottom = cam.scrollY + cam.height / cam.zoom + 50

    this.weatherGfx.clear()
    this.groundGfx.clear()
    this.flashOverlay.clear()

    const activeWeather = this.intensity >= 1 ? this.currentWeather : this.targetWeather
    const alpha = this.intensity >= 1 ? 1 : this.intensity

    switch (activeWeather) {
      case 'rain':
        this.updateRain(dt, alpha, viewLeft, viewRight, viewTop, viewBottom)
        this.updatePuddleRipples(dt, alpha)
        this.updateThunder(delta)
        break
      case 'snow':
        this.updateSnow(dt, alpha, viewLeft, viewRight, viewTop, viewBottom)
        this.updateSnowAccumulation(dt, alpha)
        break
      case 'fog':
        this.updateFog(dt, alpha, viewLeft, viewRight, viewTop, viewBottom)
        break
      case 'clear':
        this.updateDust(dt, alpha, viewLeft, viewRight, viewTop, viewBottom)
        break
    }

    // Fade out old weather during transition
    if (this.currentWeather !== this.targetWeather && this.currentWeather !== 'clear') {
      const fadeAlpha = 1 - this.intensity
      switch (this.currentWeather) {
        case 'rain':
          this.updateRain(dt, fadeAlpha * 0.5, viewLeft, viewRight, viewTop, viewBottom)
          break
        case 'snow':
          this.updateSnow(dt, fadeAlpha * 0.5, viewLeft, viewRight, viewTop, viewBottom)
          break
        case 'fog':
          this.updateFog(dt, fadeAlpha * 0.5, viewLeft, viewRight, viewTop, viewBottom)
          break
      }
    }

    this.updateCameraShake(delta)

    // Emit weather state for UI
    this.scene.game.events.emit('weather', {
      type: activeWeather,
      intensity: alpha,
    })
  }

  private cycleWeather(phase: TimePhase) {
    // Weather probabilities based on time of day
    const roll = Math.random()
    if (phase === 'night' || phase === 'dusk') {
      // More likely rain/fog at night
      if (roll < 0.3) this.setWeather('rain')
      else if (roll < 0.5) this.setWeather('fog')
      else if (roll < 0.6) this.setWeather('snow')
      else this.setWeather('clear')
    } else if (phase === 'dawn') {
      // Fog common at dawn
      if (roll < 0.35) this.setWeather('fog')
      else if (roll < 0.5) this.setWeather('rain')
      else this.setWeather('clear')
    } else {
      // Day: mostly clear
      if (roll < 0.15) this.setWeather('rain')
      else if (roll < 0.25) this.setWeather('fog')
      else if (roll < 0.3) this.setWeather('snow')
      else this.setWeather('clear')
    }
  }

  // --- RAIN ---

  private updateRain(
    dt: number, alpha: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.weatherGfx
    const windAngle = 0.15 // slight diagonal

    for (const drop of this.rainDrops) {
      drop.y += drop.speed * dt
      drop.x += drop.speed * windAngle * dt

      // Wrap around
      if (drop.y > this.pixelH) {
        drop.y = -drop.length
        drop.x = Math.random() * this.pixelW
        // Spawn puddle ripple where rain hits
        this.spawnPuddleRipple(drop.x, this.pixelH - Math.random() * 20)
      }
      if (drop.x > this.pixelW) {
        drop.x = 0
      }

      // Viewport culling
      if (drop.x < vl || drop.x > vr || drop.y < vt || drop.y > vb) continue

      // Draw angled rain streak (GBA style: 1px wide lines)
      const endX = drop.x + drop.length * windAngle
      const endY = drop.y + drop.length
      g.lineStyle(1, 0x8899cc, drop.alpha * alpha)
      g.lineBetween(drop.x, drop.y, endX, endY)
    }
  }

  private spawnPuddleRipple(x: number, y: number) {
    if (this.puddleRipples.length >= MAX_PUDDLE_RIPPLES) {
      // Recycle oldest
      this.puddleRipples.shift()
    }
    // Only spawn near ground positions sometimes
    if (Math.random() > 0.08) return

    const nearest = this.findNearestGround(x, y)
    if (!nearest) return

    this.puddleRipples.push({
      x: nearest.x + (Math.random() - 0.5) * TILE_SIZE,
      y: nearest.y + (Math.random() - 0.5) * TILE_SIZE,
      radius: 0,
      maxRadius: 3 + Math.random() * 4,
      alpha: 0.5 + Math.random() * 0.3,
    })
  }

  private findNearestGround(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null
    let bestDist = Infinity
    for (const gp of this.groundPositions) {
      const dx = gp.x - x
      const dy = gp.y - y
      const d = dx * dx + dy * dy
      if (d < bestDist) {
        bestDist = d
        best = gp
      }
    }
    return bestDist < (TILE_SIZE * 10) * (TILE_SIZE * 10) ? best : null
  }

  private updatePuddleRipples(dt: number, alpha: number) {
    const g = this.groundGfx

    for (let i = this.puddleRipples.length - 1; i >= 0; i--) {
      const ripple = this.puddleRipples[i]
      ripple.radius += dt * 12
      const t = ripple.radius / ripple.maxRadius
      ripple.alpha = (1 - t) * 0.4

      if (ripple.radius >= ripple.maxRadius) {
        this.puddleRipples.splice(i, 1)
        continue
      }

      // Draw concentric pixel circles (GBA style)
      const r = Math.floor(ripple.radius)
      g.lineStyle(1, 0x6688aa, ripple.alpha * alpha)
      // Simple pixel circle approximation
      if (r > 0) {
        g.strokeRect(ripple.x - r, ripple.y - Math.floor(r * 0.5), r * 2, r)
      }
    }
  }

  // --- THUNDER ---

  private updateThunder(delta: number) {
    if (this.currentWeather !== 'rain' && this.targetWeather !== 'rain') return

    // Random thunder chance
    if (this.thunderFlashTimer <= 0 && this.thunderShakeTimer <= 0) {
      if (Math.random() < THUNDER_CHANCE) {
        this.thunderFlashTimer = THUNDER_FLASH_MS
        this.thunderShakeTimer = THUNDER_SHAKE_MS
        this.startCameraShake()
      }
    }

    // Flash overlay
    if (this.thunderFlashTimer > 0) {
      this.thunderFlashTimer -= delta
      const flashAlpha = Math.max(0, this.thunderFlashTimer / THUNDER_FLASH_MS) * 0.6
      this.flashOverlay.fillStyle(0xffffff, flashAlpha)
      this.flashOverlay.fillRect(0, 0, this.pixelW, this.pixelH)
    }
  }

  private startCameraShake() {
    if (this.isShaking) return
    this.isShaking = true
  }

  private updateCameraShake(delta: number) {
    if (!this.isShaking) return

    this.thunderShakeTimer -= delta
    if (this.thunderShakeTimer <= 0) {
      this.isShaking = false
      return
    }

    const cam = this.scene.cameras.main
    const progress = this.thunderShakeTimer / THUNDER_SHAKE_MS
    const shakeAmount = THUNDER_SHAKE_INTENSITY * progress
    cam.scrollX += (Math.random() - 0.5) * shakeAmount * 2
    cam.scrollY += (Math.random() - 0.5) * shakeAmount * 2
  }

  // --- SNOW ---

  private updateSnow(
    dt: number, alpha: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.weatherGfx
    const time = this.elapsed / 1000

    for (const flake of this.snowFlakes) {
      flake.y += flake.speed * dt
      flake.x += Math.sin(time * flake.drift + flake.driftOffset) * flake.drift * dt * 8

      // Wrap around
      if (flake.y > this.pixelH) {
        flake.y = -flake.size
        flake.x = Math.random() * this.pixelW
        this.addSnowAccumulation(flake.x, this.pixelH - 4)
      }
      if (flake.x < 0) flake.x = this.pixelW
      if (flake.x > this.pixelW) flake.x = 0

      // Viewport culling
      if (flake.x < vl || flake.x > vr || flake.y < vt || flake.y > vb) continue

      // Draw pixel snowflake
      g.fillStyle(0xffffff, flake.alpha * alpha)
      g.fillRect(Math.floor(flake.x), Math.floor(flake.y), flake.size, flake.size)

      // Larger flakes get a cross pattern
      if (flake.size >= 2) {
        g.fillStyle(0xeeeeff, flake.alpha * alpha * 0.6)
        g.fillRect(Math.floor(flake.x) - 1, Math.floor(flake.y), flake.size + 2, flake.size)
        g.fillRect(Math.floor(flake.x), Math.floor(flake.y) - 1, flake.size, flake.size + 2)
      }
    }
  }

  private addSnowAccumulation(x: number, y: number) {
    if (this.snowPiles.length >= MAX_SNOW_PILES) return
    if (Math.random() > 0.02) return // sparse accumulation

    const nearest = this.findNearestGround(x, y)
    if (!nearest) return

    this.snowPiles.push({
      x: nearest.x + (Math.random() - 0.5) * TILE_SIZE,
      y: nearest.y,
      width: 2 + Math.floor(Math.random() * 4),
      height: 1 + Math.floor(Math.random() * 2),
    })
  }

  private updateSnowAccumulation(_dt: number, alpha: number) {
    const g = this.groundGfx

    for (const pile of this.snowPiles) {
      // Small white pixel mounds
      g.fillStyle(0xeeeeff, 0.7 * alpha)
      g.fillRect(
        Math.floor(pile.x),
        Math.floor(pile.y),
        pile.width,
        pile.height,
      )
      // Highlight on top edge
      g.fillStyle(0xffffff, 0.4 * alpha)
      g.fillRect(
        Math.floor(pile.x) + 1,
        Math.floor(pile.y),
        Math.max(1, pile.width - 2),
        1,
      )
    }
  }

  // --- FOG ---

  private updateFog(
    dt: number, alpha: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.weatherGfx

    for (const layer of this.fogLayers) {
      layer.x += layer.speed * dt

      // Wrap around
      if (layer.x > this.pixelW + layer.width) {
        layer.x = -layer.width
        layer.y = this.pixelH * 0.15 + Math.random() * this.pixelH * 0.7
      }

      // Viewport culling
      if (layer.x + layer.width < vl || layer.x > vr ||
          layer.y + layer.height < vt || layer.y > vb) continue

      // Draw fog as overlapping translucent rectangles (GBA style)
      const a = layer.baseAlpha * alpha
      // Core fog band
      g.fillStyle(0xccccdd, a)
      g.fillRect(
        Math.floor(layer.x),
        Math.floor(layer.y),
        layer.width,
        layer.height,
      )
      // Soft edges: lighter rectangles above and below
      g.fillStyle(0xccccdd, a * 0.5)
      g.fillRect(
        Math.floor(layer.x) + 4,
        Math.floor(layer.y) - 4,
        layer.width - 8,
        4,
      )
      g.fillRect(
        Math.floor(layer.x) + 4,
        Math.floor(layer.y) + layer.height,
        layer.width - 8,
        4,
      )
      // Even lighter wider spread
      g.fillStyle(0xccccdd, a * 0.25)
      g.fillRect(
        Math.floor(layer.x) + 8,
        Math.floor(layer.y) - 8,
        Math.max(1, layer.width - 16),
        4,
      )
    }
  }

  // --- CLEAR (dust motes) ---

  private updateDust(
    dt: number, alpha: number,
    vl: number, vr: number, vt: number, vb: number,
  ) {
    const g = this.weatherGfx

    for (const mote of this.dustMotes) {
      mote.life += dt * 1000
      if (mote.life >= mote.maxLife) {
        // Reset
        mote.x = Math.random() * this.pixelW
        mote.y = Math.random() * this.pixelH
        mote.vx = (Math.random() - 0.5) * 6
        mote.vy = (Math.random() - 0.5) * 4
        mote.life = 0
        mote.maxLife = 3000 + Math.random() * 4000
      }

      mote.x += mote.vx * dt
      mote.y += mote.vy * dt

      // Viewport culling
      if (mote.x < vl || mote.x > vr || mote.y < vt || mote.y > vb) continue

      // Fade in/out
      const t = mote.life / mote.maxLife
      let fadeAlpha = mote.alpha
      if (t < 0.2) fadeAlpha *= t / 0.2
      else if (t > 0.8) fadeAlpha *= (1 - t) / 0.2

      g.fillStyle(0xffffee, fadeAlpha * alpha)
      g.fillRect(Math.floor(mote.x), Math.floor(mote.y), mote.size, mote.size)
    }
  }

  /** Clear snow accumulation (e.g. on weather change) */
  clearAccumulation() {
    this.snowPiles = []
    this.puddleRipples = []
  }

  destroy() {
    this.weatherGfx.destroy()
    this.groundGfx.destroy()
    this.flashOverlay.destroy()
  }
}
