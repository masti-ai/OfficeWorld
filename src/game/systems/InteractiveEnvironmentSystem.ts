import Phaser from 'phaser'
import { AgentState, RoomConfig, FurnitureItem } from '../../types'
import { TILE_SIZE } from '../../constants'
import { TimePhase } from './DayNightSystem'

/**
 * Interactive environment system: furniture reacts to agent proximity and activity.
 *
 * - Chairs slide when agents sit at desks
 * - Papers scatter when agents walk fast (multiple path steps)
 * - Whiteboards accumulate scribbles when agents are in meetings
 * - Monitor screens change content based on agent activity/status
 * - Coffee cups accumulate on desks over time
 * - Desk lamps toggle glow with day/night cycle
 */

interface ChairSlide {
  sprite: Phaser.GameObjects.Graphics
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  progress: number // 0..1
  returning: boolean
}

interface PaperParticle {
  sprite: Phaser.GameObjects.Graphics
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  life: number
  maxLife: number
}

interface WhiteboardState {
  item: FurnitureItem
  scribbleCount: number
  overlay: Phaser.GameObjects.Graphics
  lastScribbleTime: number
}

interface MonitorOverlay {
  item: FurnitureItem
  overlay: Phaser.GameObjects.Graphics
  currentMode: 'code' | 'error' | 'idle' | 'success' | 'loading'
  timer: number
  frame: number
}

interface CoffeeCupAccum {
  roomId: string
  x: number
  y: number
  sprite: Phaser.GameObjects.Graphics
  spawnTime: number
}

interface LampGlow {
  item: FurnitureItem
  overlay: Phaser.GameObjects.Graphics
  glowAlpha: number
  targetAlpha: number
}

export class InteractiveEnvironmentSystem {
  private scene: Phaser.Scene
  private agentStates: Map<string, AgentState>
  private characters: Map<string, { getPosition(): { x: number; y: number } }>
  private rooms: RoomConfig[]

  private chairSlides: ChairSlide[] = []
  private papers: PaperParticle[] = []
  private whiteboards: WhiteboardState[] = []
  private monitors: MonitorOverlay[] = []
  private coffeeCups: CoffeeCupAccum[] = []
  private lamps: LampGlow[] = []

  // Track agent previous positions for speed detection
  private prevPositions = new Map<string, { x: number; y: number }>()
  private prevStatuses = new Map<string, string>()

  // Timers
  private coffeeTimer = 0
  private monitorTimer = 0

  constructor(
    scene: Phaser.Scene,
    agentStates: Map<string, AgentState>,
    characters: Map<string, { getPosition(): { x: number; y: number } }>,
    rooms: RoomConfig[],
  ) {
    this.scene = scene
    this.agentStates = agentStates
    this.characters = characters
    this.rooms = rooms

    this.initWhiteboards()
    this.initMonitors()
    this.initLamps()
  }

  private initWhiteboards() {
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type === 'whiteboard') {
          const overlay = this.scene.add.graphics()
          overlay.setDepth(8)
          this.whiteboards.push({
            item,
            scribbleCount: 0,
            overlay,
            lastScribbleTime: 0,
          })
        }
      }
    }
  }

  private initMonitors() {
    for (const room of this.rooms) {
      if (room.type !== 'department' && room.id !== 'mayor_office') continue
      for (const item of room.furniture) {
        if (item.type === 'monitor') {
          const overlay = this.scene.add.graphics()
          overlay.setDepth(9)
          this.monitors.push({
            item,
            overlay,
            currentMode: 'code',
            timer: 0,
            frame: 0,
          })
        }
      }
    }
  }

  private initLamps() {
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type === 'lamp') {
          const overlay = this.scene.add.graphics()
          overlay.setDepth(7)
          this.lamps.push({
            item,
            overlay,
            glowAlpha: 0.05,
            targetAlpha: 0.05,
          })
        }
      }
    }
  }

  update(delta: number, timePhase: TimePhase) {
    this.updateChairSlides(delta)
    this.updatePapers(delta)
    this.updateAgentInteractions(delta)
    this.updateWhiteboards(delta)
    this.updateMonitors(delta)
    this.updateCoffeeCups(delta)
    this.updateLamps(delta, timePhase)
  }

  private updateAgentInteractions(_delta: number) {
    for (const [id, state] of this.agentStates) {
      const prev = this.prevPositions.get(id)
      const prevStatus = this.prevStatuses.get(id)

      // Chair slide: agent just stopped walking and arrived at desk
      if (prevStatus === 'walking' && state.status === 'working') {
        this.triggerChairSlide(state.position.x, state.position.y)
      }

      // Paper scatter: agent is walking (moving between tiles)
      if (state.status === 'walking' && prev) {
        const dx = state.position.x - prev.x
        const dy = state.position.y - prev.y
        if (dx !== 0 || dy !== 0) {
          // ~20% chance per step to scatter a paper
          if (Math.random() < 0.2) {
            const char = this.characters.get(id)
            if (char) {
              const pos = char.getPosition()
              this.spawnPaper(pos.x, pos.y, dx, dy)
            }
          }
        }
      }

      this.prevPositions.set(id, { ...state.position })
      this.prevStatuses.set(id, state.status)
    }
  }

  // --- Chair Slides ---

  private triggerChairSlide(tileX: number, tileY: number) {
    // Find chairs adjacent to the arrival tile
    for (const room of this.rooms) {
      for (const item of room.furniture) {
        if (item.type !== 'chair') continue
        const dist = Math.abs(item.x - tileX) + Math.abs(item.y - tileY)
        if (dist > 2) continue

        // Direction: push chair away from agent
        const pushX = (item.x - tileX) * 0.3
        const pushY = (item.y - tileY) * 0.3
        if (pushX === 0 && pushY === 0) continue

        const sprite = this.scene.add.graphics()
        sprite.setDepth(6)

        this.chairSlides.push({
          sprite,
          startX: item.x * TILE_SIZE,
          startY: item.y * TILE_SIZE,
          offsetX: pushX * TILE_SIZE,
          offsetY: pushY * TILE_SIZE,
          progress: 0,
          returning: false,
        })
      }
    }
  }

  private updateChairSlides(delta: number) {
    for (let i = this.chairSlides.length - 1; i >= 0; i--) {
      const slide = this.chairSlides[i]
      const speed = 0.003

      if (!slide.returning) {
        slide.progress += delta * speed
        if (slide.progress >= 1) {
          slide.progress = 1
          slide.returning = true
        }
      } else {
        slide.progress -= delta * speed * 0.5 // return slower
        if (slide.progress <= 0) {
          slide.sprite.destroy()
          this.chairSlides.splice(i, 1)
          continue
        }
      }

      // Draw a small chair shadow/highlight at offset position
      const gfx = slide.sprite
      gfx.clear()
      const ox = slide.startX + slide.offsetX * slide.progress
      const oy = slide.startY + slide.offsetY * slide.progress
      const alpha = 0.3 * (slide.returning ? slide.progress : 1)

      // Subtle shadow showing chair movement
      gfx.fillStyle(0x000000, alpha * 0.4)
      gfx.fillRect(ox + 2, oy + TILE_SIZE - 2, TILE_SIZE - 4, 2)

      // Chair slide highlight
      gfx.fillStyle(0x8888aa, alpha)
      gfx.fillRect(ox + 3, oy + 4, TILE_SIZE - 6, TILE_SIZE - 6)
      gfx.fillStyle(0x6666888, alpha * 0.7)
      gfx.fillRect(ox + 3, oy + 2, TILE_SIZE - 6, 4)
    }
  }

  // --- Paper Scatter ---

  private spawnPaper(worldX: number, worldY: number, dx: number, dy: number) {
    if (this.papers.length > 30) return // cap

    const sprite = this.scene.add.graphics()
    sprite.setDepth(5)

    const spread = 0.8
    this.papers.push({
      sprite,
      x: worldX + (Math.random() - 0.5) * 8,
      y: worldY + 8,
      vx: -dx * 0.5 + (Math.random() - 0.5) * spread,
      vy: -dy * 0.5 + (Math.random() - 0.5) * spread + 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      life: 0,
      maxLife: 2000 + Math.random() * 1000,
    })
  }

  private updatePapers(delta: number) {
    for (let i = this.papers.length - 1; i >= 0; i--) {
      const p = this.papers[i]
      p.life += delta
      if (p.life >= p.maxLife) {
        p.sprite.destroy()
        this.papers.splice(i, 1)
        continue
      }

      // Physics: drift and settle
      p.x += p.vx * delta * 0.02
      p.y += p.vy * delta * 0.02
      p.vx *= 0.98
      p.vy *= 0.98
      p.rotation += p.rotSpeed

      const fadeIn = Math.min(1, p.life / 200)
      const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 500) / 500)
      const alpha = fadeIn * fadeOut * 0.7

      const gfx = p.sprite
      gfx.clear()

      // Tiny paper rectangle
      gfx.fillStyle(0xf0ece0, alpha)
      const sin = Math.sin(p.rotation) * 2
      const cos = Math.cos(p.rotation) * 3
      gfx.fillRect(p.x + sin, p.y + cos, 4, 3)
      // Paper fold line
      gfx.fillStyle(0xd0ccc0, alpha * 0.8)
      gfx.fillRect(p.x + sin + 1, p.y + cos + 1, 2, 1)
    }
  }

  // --- Whiteboard Scribbles ---

  private updateWhiteboards(delta: number) {
    // Check if any agents are in meeting_room
    let meetingCount = 0
    for (const [, state] of this.agentStates) {
      if (state.status === 'meeting') meetingCount++
    }

    for (const wb of this.whiteboards) {
      // Add scribbles when meetings are happening (max 12 scribbles)
      if (meetingCount > 0 && wb.scribbleCount < 12) {
        wb.lastScribbleTime += delta
        if (wb.lastScribbleTime > 3000) { // new scribble every 3s
          wb.lastScribbleTime = 0
          wb.scribbleCount++
          this.drawWhiteboardScribbles(wb)
        }
      }

      // Slowly fade scribbles when no meeting (reset)
      if (meetingCount === 0 && wb.scribbleCount > 0) {
        wb.lastScribbleTime += delta
        if (wb.lastScribbleTime > 15000) { // clear after 15s no meeting
          wb.scribbleCount = 0
          wb.overlay.clear()
          wb.lastScribbleTime = 0
        }
      }
    }
  }

  private drawWhiteboardScribbles(wb: WhiteboardState) {
    const gfx = wb.overlay
    gfx.clear()

    const bx = wb.item.x * TILE_SIZE
    const by = wb.item.y * TILE_SIZE
    const bw = wb.item.width * TILE_SIZE
    const bh = wb.item.height * TILE_SIZE

    const colors = [0x2255cc, 0xcc2255, 0x22aa55, 0x333333, 0xff6600]

    for (let i = 0; i < wb.scribbleCount; i++) {
      const seed = i * 7 + 3
      const color = colors[i % colors.length]
      const sx = bx + 3 + ((seed * 13) % (bw - 8))
      const sy = by + 3 + ((seed * 7) % (bh - 8))
      const sw = 3 + (seed % 6)

      gfx.fillStyle(color, 0.6)
      gfx.fillRect(sx, sy, sw, 1)

      // Some scribbles are boxes/circles
      if (i % 3 === 0) {
        gfx.lineStyle(1, color, 0.5)
        gfx.strokeRect(sx, sy, sw, sw * 0.6)
      }
      // Some are arrows
      if (i % 4 === 1 && i > 2) {
        gfx.fillStyle(color, 0.5)
        gfx.fillRect(sx + sw, sy, 3, 1)
        gfx.fillRect(sx + sw + 2, sy - 1, 1, 1)
        gfx.fillRect(sx + sw + 2, sy + 1, 1, 1)
      }
    }
  }

  // --- Monitor Screen Content ---

  private updateMonitors(delta: number) {
    this.monitorTimer += delta
    if (this.monitorTimer < 2000) return // update every 2s
    this.monitorTimer = 0

    // Find nearest agent for each monitor and set mode based on activity
    for (const mon of this.monitors) {
      let nearestDist = Infinity
      let nearestState: AgentState | null = null

      for (const [, state] of this.agentStates) {
        if (state.status === 'offline') continue
        const dx = state.position.x - mon.item.x
        const dy = state.position.y - mon.item.y
        const dist = dx * dx + dy * dy
        if (dist < nearestDist) {
          nearestDist = dist
          nearestState = state
        }
      }

      let newMode: MonitorOverlay['currentMode'] = 'idle'
      if (nearestState && nearestDist <= 9) { // within 3 tiles
        if (nearestState.status === 'working') {
          if (nearestState.activity === 'bash') newMode = 'code'
          else if (nearestState.activity === 'typing') newMode = 'code'
          else if (nearestState.activity === 'reading') newMode = 'loading'
          else if (nearestState.activity === 'permission-needed') newMode = 'error'
          else newMode = 'code'
        } else if (nearestState.status === 'offline') {
          newMode = 'idle'
        }
      }

      if (newMode !== mon.currentMode) {
        mon.currentMode = newMode
        mon.frame = 0
      }
      mon.timer += delta
      mon.frame++

      this.drawMonitorContent(mon)
    }
  }

  private drawMonitorContent(mon: MonitorOverlay) {
    const gfx = mon.overlay
    gfx.clear()

    const mx = mon.item.x * TILE_SIZE + 2
    const my = mon.item.y * TILE_SIZE + 2
    const mw = TILE_SIZE - 4
    const mh = TILE_SIZE - 7

    // Screen background tint based on mode
    const bgColors: Record<string, number> = {
      code: 0x0d1a2e,
      error: 0x2e0d0d,
      idle: 0x0a0a15,
      success: 0x0d2e1a,
      loading: 0x1a1a2e,
    }

    gfx.fillStyle(bgColors[mon.currentMode] ?? 0x0a0a15, 0.85)
    gfx.fillRect(mx, my, mw, mh)

    const frame = mon.frame % 20

    switch (mon.currentMode) {
      case 'code': {
        // Scrolling code lines with syntax colors
        const lineColors = [0x66cc88, 0xcc8844, 0x4488cc, 0x88aacc, 0xddaa44]
        for (let l = 0; l < 4; l++) {
          const lw = 3 + ((frame + l * 3) % 6)
          const ly = my + 1 + l * 2
          gfx.fillStyle(lineColors[(l + frame) % lineColors.length], 0.7)
          gfx.fillRect(mx + 1 + ((l * 2) % 3), ly, lw, 1)
        }
        // Cursor
        if (frame % 4 < 2) {
          gfx.fillStyle(0xffffff, 0.9)
          gfx.fillRect(mx + 8, my + 7, 1, 1)
        }
        break
      }
      case 'error': {
        // Red error screen with X
        gfx.fillStyle(0xff4444, 0.4 + (frame % 6 < 3 ? 0.2 : 0))
        gfx.fillRect(mx + 2, my + 1, mw - 4, 3)
        // X mark
        gfx.fillStyle(0xff6666, 0.8)
        gfx.fillRect(mx + 4, my + 4, 1, 1)
        gfx.fillRect(mx + 6, my + 4, 1, 1)
        gfx.fillRect(mx + 5, my + 5, 1, 1)
        gfx.fillRect(mx + 4, my + 6, 1, 1)
        gfx.fillRect(mx + 6, my + 6, 1, 1)
        // Error text line
        gfx.fillStyle(0xff8888, 0.6)
        gfx.fillRect(mx + 1, my + 8, 8, 1)
        break
      }
      case 'idle': {
        // Screensaver: floating pixel
        const px = mx + 2 + (frame % (mw - 4))
        const py = my + 1 + ((frame * 3) % (mh - 2))
        gfx.fillStyle(0x334466, 0.5)
        gfx.fillRect(px, py, 2, 2)
        // Dim glow
        gfx.fillStyle(0x223344, 0.2)
        gfx.fillRect(mx, my, mw, mh)
        break
      }
      case 'success': {
        // Green checkmark
        gfx.fillStyle(0x44ff88, 0.7)
        gfx.fillRect(mx + 3, my + 5, 1, 1)
        gfx.fillRect(mx + 4, my + 6, 1, 1)
        gfx.fillRect(mx + 5, my + 5, 1, 1)
        gfx.fillRect(mx + 6, my + 4, 1, 1)
        gfx.fillRect(mx + 7, my + 3, 1, 1)
        // "PASS" text
        gfx.fillStyle(0x44ff88, 0.5)
        gfx.fillRect(mx + 2, my + 1, 7, 1)
        break
      }
      case 'loading': {
        // Spinning loader
        const dotCount = 4
        for (let d = 0; d < dotCount; d++) {
          const angle = (frame * 0.3 + d * (Math.PI * 2 / dotCount))
          const dx = Math.cos(angle) * 3
          const dy = Math.sin(angle) * 2
          const brightness = d === (frame % dotCount) ? 0.9 : 0.3
          gfx.fillStyle(0x8888ff, brightness)
          gfx.fillRect(mx + mw / 2 + dx, my + mh / 2 + dy, 1, 1)
        }
        break
      }
    }

    // Scanline effect
    for (let sy = 0; sy < mh; sy += 2) {
      gfx.fillStyle(0x000000, 0.06)
      gfx.fillRect(mx, my + sy, mw, 1)
    }
  }

  // --- Coffee Cup Accumulation ---

  private updateCoffeeCups(delta: number) {
    this.coffeeTimer += delta
    if (this.coffeeTimer < 20000) return // check every 20s
    this.coffeeTimer = 0

    // Count working agents - more workers = more coffee
    let workingCount = 0
    for (const [, state] of this.agentStates) {
      if (state.status === 'working') workingCount++
    }

    // Spawn a cup near a random working agent's desk (max 8 total)
    if (workingCount > 0 && this.coffeeCups.length < 8 && Math.random() < 0.4) {
      // Pick a random desk in a department room
      const deptRooms = this.rooms.filter(r => r.type === 'department')
      if (deptRooms.length > 0) {
        const room = deptRooms[Math.floor(Math.random() * deptRooms.length)]
        if (room.deskPositions.length > 0) {
          const deskPos = room.deskPositions[Math.floor(Math.random() * room.deskPositions.length)]
          // Place cup offset from desk position
          const cupX = deskPos.x * TILE_SIZE + (Math.random() - 0.5) * 10
          const cupY = (deskPos.y - 2) * TILE_SIZE + (Math.random() - 0.5) * 6

          const sprite = this.scene.add.graphics()
          sprite.setDepth(8)

          this.coffeeCups.push({
            roomId: room.id,
            x: cupX,
            y: cupY,
            sprite,
            spawnTime: Date.now(),
          })

          this.drawCoffeeCup(sprite, cupX, cupY)
        }
      }
    }

    // Remove old cups (after 2 minutes)
    const now = Date.now()
    for (let i = this.coffeeCups.length - 1; i >= 0; i--) {
      if (now - this.coffeeCups[i].spawnTime > 120000) {
        this.coffeeCups[i].sprite.destroy()
        this.coffeeCups.splice(i, 1)
      }
    }
  }

  private drawCoffeeCup(gfx: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Tiny coffee cup (3x4 pixels)
    gfx.fillStyle(0xf0f0f0, 0.8)
    gfx.fillRect(x, y, 3, 4)
    // Coffee inside
    gfx.fillStyle(0x4a2a1a, 0.8)
    gfx.fillRect(x, y, 3, 1)
    // Handle
    gfx.fillStyle(0xdddddd, 0.7)
    gfx.fillRect(x + 3, y + 1, 1, 2)
    // Tiny steam wisp
    gfx.fillStyle(0xccccdd, 0.3)
    gfx.fillRect(x + 1, y - 1, 1, 1)
  }

  // --- Lamp Glow ---

  private updateLamps(delta: number, phase: TimePhase) {
    const isNight = phase === 'night' || phase === 'dusk'
    const isDawn = phase === 'dawn'

    for (const lamp of this.lamps) {
      // Target glow: bright at night, dim during day
      lamp.targetAlpha = isNight ? 0.35 : isDawn ? 0.15 : 0.03

      // Smooth interpolation
      lamp.glowAlpha += (lamp.targetAlpha - lamp.glowAlpha) * delta * 0.002
      lamp.glowAlpha = Math.max(0, Math.min(0.5, lamp.glowAlpha))

      const gfx = lamp.overlay
      gfx.clear()

      if (lamp.glowAlpha < 0.02) continue

      const lx = lamp.item.x * TILE_SIZE
      const ly = lamp.item.y * TILE_SIZE

      // Warm light cone below lamp
      gfx.fillStyle(0xffe8a0, lamp.glowAlpha)
      gfx.fillRect(lx - 8, ly + TILE_SIZE - 2, TILE_SIZE + 16, TILE_SIZE + 8)

      // Brighter center
      gfx.fillStyle(0xfff0c0, lamp.glowAlpha * 1.5)
      gfx.fillRect(lx, ly + TILE_SIZE, TILE_SIZE, TILE_SIZE / 2)

      // Subtle flicker
      if (isNight && Math.random() < 0.02) {
        gfx.fillStyle(0xffe0a0, lamp.glowAlpha * 0.5)
        gfx.fillRect(lx - 4, ly + TILE_SIZE - 4, TILE_SIZE + 8, TILE_SIZE + 12)
      }
    }
  }

  destroy() {
    for (const slide of this.chairSlides) slide.sprite.destroy()
    for (const paper of this.papers) paper.sprite.destroy()
    for (const wb of this.whiteboards) wb.overlay.destroy()
    for (const mon of this.monitors) mon.overlay.destroy()
    for (const cup of this.coffeeCups) cup.sprite.destroy()
    for (const lamp of this.lamps) lamp.overlay.destroy()
    this.chairSlides = []
    this.papers = []
    this.whiteboards = []
    this.monitors = []
    this.coffeeCups = []
    this.lamps = []
  }
}
