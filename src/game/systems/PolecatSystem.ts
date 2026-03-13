import Phaser from 'phaser'
import { PolecatState, PolecatLifecycle, PolecatIdleActivity, TileData } from '../../types'
import {
  TILE_SIZE,
  POLECAT_IDLE_MIN,
  POLECAT_IDLE_MAX,
  POLECAT_ACTIVITY_DURATION,
  POLECAT_WORK_MIN,
  POLECAT_WORK_MAX,
  POLECAT_BLOCKED_DURATION,
  POLECAT_BLOCKED_CHANCE,
  POLECAT_SLUNG_SPEED_MULT,
  POLECAT_PACE_INTERVAL,
  POLECAT_NAMES,
} from '../../constants'
import { findPath } from '../world/Pathfinding'
import { ROOMS } from '../world/RoomDefinitions'

// Yard walkable spots for idle roaming
const YARD_ROOM = ROOMS.find((r) => r.id === 'polecat_yard')!

// Department desk positions for hot-desking
const DEPT_DESKS = ROOMS
  .filter((r) => r.type === 'department' && r.id !== 'mayor_office')
  .flatMap((r) => r.deskPositions)

// Idle activity visual labels
const ACTIVITY_ICONS: Record<PolecatIdleActivity, string> = {
  roaming: '',
  smoking: '\u{1F6AC}',
  coffee: '\u2615',
  hoops: '\u{1F3C0}',
  napping: '\u{1F4A4}',
  chatting: '\u{1F4AC}',
}

const IDLE_ACTIVITIES: PolecatIdleActivity[] = ['smoking', 'coffee', 'hoops', 'napping', 'chatting']

/**
 * Polecat lifecycle state machine:
 * IDLE (roam yard) -> SLUNG (rush to hot-desk) -> WORKING (typing) -> DONE (celebrate, return) -> IDLE
 *                                               -> BLOCKED (pace, question) -> WORKING
 */
export class PolecatSystem {
  private scene: Phaser.Scene
  private polecats = new Map<string, PolecatState>()
  private sprites = new Map<string, Phaser.GameObjects.Container>()
  private overlays = new Map<string, Phaser.GameObjects.Container>()
  private grid: TileData[][]

  constructor(scene: Phaser.Scene, grid: TileData[][]) {
    this.scene = scene
    this.grid = grid
    this.spawnAllPolecats()
  }

  /** Create all polecat entities at startup */
  private spawnAllPolecats() {
    for (let i = 0; i < POLECAT_NAMES.length; i++) {
      const name = POLECAT_NAMES[i]
      const id = `polecat_${name}`

      // Assign yard home spots spread across the yard
      const yardSpot = {
        x: YARD_ROOM.x + 3 + (i * 5) % (YARD_ROOM.width - 6),
        y: YARD_ROOM.y + 4 + Math.floor(i / 4) * 4,
      }

      const polecat: PolecatState = {
        id,
        name,
        position: { ...yardSpot },
        status: 'idle',
        idleActivity: 'roaming',
        assignedDesk: null,
        yardSpot,
        path: [],
        pathIndex: 0,
        stateTimer: randRange(POLECAT_IDLE_MIN, POLECAT_IDLE_MAX),
        activityTimer: randRange(3000, 6000),
        celebratePhase: 0,
        blockedPaceDir: 1,
      }

      this.polecats.set(id, polecat)

      const container = this.createPolecatSprite(name)
      container.x = yardSpot.x * TILE_SIZE + TILE_SIZE / 2
      container.y = yardSpot.y * TILE_SIZE + TILE_SIZE / 2
      container.setDepth(10)
      this.sprites.set(id, container)

      // Create overlay container for status bubbles
      const overlay = this.scene.add.container(container.x, container.y - 20)
      overlay.setDepth(15)
      this.overlays.set(id, overlay)
    }
  }

  private createPolecatSprite(name: string): Phaser.GameObjects.Container {
    const gfx = this.scene.add.graphics()

    // Deterministic color from name hash
    const hash = hashStr(name)
    const skinIdx = hash % 5
    const skins = [0xfce4c0, 0xf5d0a9, 0xe8b88a, 0xd4956b, 0xb07050]
    const skin = skins[skinIdx]

    // Hard hat (yellow, polecat trademark)
    gfx.fillStyle(0xffcc00)
    gfx.fillRect(-5, -11, 10, 3)
    gfx.fillStyle(0xddaa00)
    gfx.fillRect(-6, -9, 12, 2)

    // Head
    gfx.fillStyle(skin)
    gfx.fillRect(-4, -8, 8, 6)

    // Eyes
    gfx.fillStyle(0x222222)
    gfx.fillRect(-3, -6, 2, 2)
    gfx.fillRect(1, -6, 2, 2)
    gfx.fillStyle(0xffffff)
    gfx.fillRect(-3, -6, 1, 1)
    gfx.fillRect(1, -6, 1, 1)

    // Overalls (purple for arcade rig)
    gfx.fillStyle(0x6a4c93)
    gfx.fillRect(-4, -2, 8, 8)
    gfx.fillStyle(0x553d7a)
    gfx.fillRect(-4, -2, 1, 8)
    gfx.fillRect(-4, 4, 8, 2)

    // Legs
    gfx.fillStyle(0x2a2a4a)
    gfx.fillRect(-3, 6, 2, 4)
    gfx.fillRect(1, 6, 2, 4)

    // Shoes
    gfx.fillStyle(0x1a1a2a)
    gfx.fillRect(-4, 9, 3, 2)
    gfx.fillRect(1, 9, 3, 2)

    // Name label
    const label = this.scene.add.text(0, 13, name, {
      fontSize: '6px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      stroke: '#000',
      strokeThickness: 2,
    })
    label.setOrigin(0.5, 0)

    // Status dot
    const dot = this.scene.add.circle(8, -12, 3, 0x888888)
    dot.setStrokeStyle(1, 0x000000)

    const container = this.scene.add.container(0, 0, [gfx, label, dot])
    container.setSize(16, 24)
    container.setInteractive()
    return container
  }

  update(delta: number) {
    for (const [id, polecat] of this.polecats) {
      const sprite = this.sprites.get(id)
      const overlay = this.overlays.get(id)
      if (!sprite || !overlay) continue

      // Keep overlay positioned above sprite
      overlay.x = sprite.x
      overlay.y = sprite.y - 20

      switch (polecat.status) {
        case 'idle':
          this.updateIdle(polecat, sprite, overlay, delta)
          break
        case 'slung':
          this.updateSlung(polecat, sprite, overlay, delta)
          break
        case 'working':
          this.updateWorking(polecat, sprite, overlay, delta)
          break
        case 'done':
          this.updateDone(polecat, sprite, overlay, delta)
          break
        case 'blocked':
          this.updateBlocked(polecat, sprite, overlay, delta)
          break
      }

      // Update status dot color
      this.updateStatusDot(sprite, polecat.status)
    }
  }

  // === STATE UPDATES ===

  private updateIdle(polecat: PolecatState, sprite: Phaser.GameObjects.Container, overlay: Phaser.GameObjects.Container, delta: number) {
    polecat.stateTimer -= delta
    polecat.activityTimer -= delta

    // Time to get slung (assigned work)
    if (polecat.stateTimer <= 0) {
      this.transitionTo(polecat, 'slung')
      return
    }

    // Switch idle activities periodically
    if (polecat.activityTimer <= 0) {
      if (polecat.idleActivity === 'roaming') {
        // Pick a random activity
        polecat.idleActivity = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)]
        polecat.activityTimer = POLECAT_ACTIVITY_DURATION
        this.updateOverlay(overlay, ACTIVITY_ICONS[polecat.idleActivity])
      } else {
        // Go back to roaming
        polecat.idleActivity = 'roaming'
        polecat.activityTimer = randRange(3000, 6000)
        this.clearOverlay(overlay)
        // Pick a random walkable spot in the yard
        this.pickYardWanderTarget(polecat)
      }
    }

    // Move along path if roaming
    if (polecat.idleActivity === 'roaming' && polecat.path.length > 0) {
      this.moveAlongPath(polecat, sprite, delta, 1.0)
      if (polecat.pathIndex >= polecat.path.length) {
        polecat.path = []
        polecat.pathIndex = 0
      }
    }
  }

  private updateSlung(polecat: PolecatState, sprite: Phaser.GameObjects.Container, overlay: Phaser.GameObjects.Container, delta: number) {
    // Show "!" bubble and rush to desk
    if (polecat.path.length === 0) {
      // Assign a hot-desk
      const desk = DEPT_DESKS[Math.floor(Math.random() * DEPT_DESKS.length)]
      if (!desk) {
        this.transitionTo(polecat, 'idle')
        return
      }
      polecat.assignedDesk = { ...desk }
      const path = findPath(polecat.position, desk, this.grid)
      if (path.length === 0) {
        this.transitionTo(polecat, 'idle')
        return
      }
      polecat.path = path
      polecat.pathIndex = 0
      this.updateOverlay(overlay, '!')
    }

    // Move at rush speed
    this.moveAlongPath(polecat, sprite, delta, POLECAT_SLUNG_SPEED_MULT)

    if (polecat.pathIndex >= polecat.path.length) {
      // Arrived at desk
      polecat.path = []
      polecat.pathIndex = 0
      this.transitionTo(polecat, 'working')
    }
  }

  private updateWorking(polecat: PolecatState, _sprite: Phaser.GameObjects.Container, overlay: Phaser.GameObjects.Container, delta: number) {
    polecat.stateTimer -= delta
    polecat.activityTimer -= delta

    // Cycle work indicators
    if (polecat.activityTimer <= 0) {
      polecat.activityTimer = randRange(2000, 4000)
      const workIcons = ['\u{1F4BB}', '\u{1F4A6}', '\u{1F9CA}', '\u{1F914}', '\u26A1']
      this.updateOverlay(overlay, workIcons[Math.floor(Math.random() * workIcons.length)])
    }

    if (polecat.stateTimer <= 0) {
      polecat.path = []
      polecat.pathIndex = 0
      this.transitionTo(polecat, 'done')
    }
  }

  private updateDone(polecat: PolecatState, sprite: Phaser.GameObjects.Container, overlay: Phaser.GameObjects.Container, delta: number) {
    switch (polecat.celebratePhase) {
      case 0: {
        // Push back from desk - small movement
        this.updateOverlay(overlay, '\u2705')
        polecat.celebratePhase = 1
        polecat.stateTimer = 1500

        // Small push-back tween
        this.scene.tweens.add({
          targets: sprite,
          y: sprite.y + 8,
          duration: 400,
          yoyo: true,
          ease: 'Back.easeOut',
        })
        break
      }
      case 1: {
        // Fist pump / celebration
        polecat.stateTimer -= delta
        if (polecat.stateTimer <= 0) {
          this.updateOverlay(overlay, '\u{1F44A}')

          // Bounce effect
          this.scene.tweens.add({
            targets: sprite,
            y: sprite.y - 6,
            duration: 200,
            yoyo: true,
            repeat: 2,
            ease: 'Bounce',
          })

          polecat.celebratePhase = 2
          polecat.stateTimer = 1500
        }
        break
      }
      case 2: {
        // Walk back to yard
        polecat.stateTimer -= delta
        if (polecat.stateTimer <= 0) {
          if (polecat.path.length === 0) {
            const path = findPath(polecat.position, polecat.yardSpot, this.grid)
            if (path.length > 0) {
              polecat.path = path
              polecat.pathIndex = 0
            }
            this.clearOverlay(overlay)
          }

          if (polecat.path.length > 0) {
            this.moveAlongPath(polecat, sprite, delta, 1.2)
            if (polecat.pathIndex >= polecat.path.length) {
              polecat.celebratePhase = 3
              polecat.stateTimer = 1000
            }
          } else {
            // Can't pathfind, just transition
            polecat.celebratePhase = 3
            polecat.stateTimer = 1000
          }
        }
        break
      }
      case 3: {
        // High-five check - look for nearby polecats in yard
        polecat.stateTimer -= delta
        if (polecat.stateTimer <= 0) {
          // Check for nearby idle polecats
          for (const [otherId, other] of this.polecats) {
            if (otherId === polecat.id) continue
            if (other.status !== 'idle') continue
            const dx = Math.abs(other.position.x - polecat.position.x)
            const dy = Math.abs(other.position.y - polecat.position.y)
            if (dx + dy < 6) {
              // High-five! Show on both
              this.updateOverlay(this.overlays.get(polecat.id)!, '\u{1F91A}')
              this.updateOverlay(this.overlays.get(otherId)!, '\u{1F91A}')
              // Clear after a moment
              this.scene.time.delayedCall(1200, () => {
                this.clearOverlay(this.overlays.get(polecat.id)!)
                this.clearOverlay(this.overlays.get(otherId)!)
              })
              break
            }
          }
          this.transitionTo(polecat, 'idle')
        }
        break
      }
    }
  }

  private updateBlocked(polecat: PolecatState, sprite: Phaser.GameObjects.Container, overlay: Phaser.GameObjects.Container, delta: number) {
    polecat.stateTimer -= delta
    polecat.activityTimer -= delta

    // Pace back and forth
    if (polecat.activityTimer <= 0) {
      polecat.activityTimer = POLECAT_PACE_INTERVAL
      polecat.blockedPaceDir *= -1

      // Toggle overlay between ? and knock
      const icons = ['?', '\u{1F6AA}', '?', '\u{1F614}']
      const idx = Math.floor(Math.random() * icons.length)
      this.updateOverlay(overlay, icons[idx])

      // Pace movement
      const paceX = polecat.position.x + polecat.blockedPaceDir * 2
      if (this.grid[polecat.position.y]?.[paceX]?.walkable) {
        const path = findPath(polecat.position, { x: paceX, y: polecat.position.y }, this.grid)
        if (path.length > 0) {
          polecat.path = path
          polecat.pathIndex = 0
        }
      }
    }

    // Move along pace path
    if (polecat.path.length > 0) {
      this.moveAlongPath(polecat, sprite, delta, 0.6)
      if (polecat.pathIndex >= polecat.path.length) {
        polecat.path = []
        polecat.pathIndex = 0
      }
    }

    // Unblock and return to working
    if (polecat.stateTimer <= 0) {
      polecat.path = []
      polecat.pathIndex = 0

      // Walk back to desk
      if (polecat.assignedDesk) {
        const path = findPath(polecat.position, polecat.assignedDesk, this.grid)
        if (path.length > 0) {
          polecat.path = path
          polecat.pathIndex = 0
        }
      }

      this.transitionTo(polecat, 'working')
    }
  }

  // === TRANSITIONS ===

  private transitionTo(polecat: PolecatState, newStatus: PolecatLifecycle) {
    polecat.status = newStatus
    const overlay = this.overlays.get(polecat.id)
    if (overlay) this.clearOverlay(overlay)

    switch (newStatus) {
      case 'idle':
        polecat.stateTimer = randRange(POLECAT_IDLE_MIN, POLECAT_IDLE_MAX)
        polecat.activityTimer = randRange(2000, 5000)
        polecat.idleActivity = 'roaming'
        polecat.assignedDesk = null
        polecat.celebratePhase = 0
        polecat.path = []
        polecat.pathIndex = 0
        break
      case 'slung':
        polecat.path = []
        polecat.pathIndex = 0
        break
      case 'working': {
        polecat.stateTimer = randRange(POLECAT_WORK_MIN, POLECAT_WORK_MAX)
        polecat.activityTimer = 1000

        // Chance to become blocked during work
        if (Math.random() < POLECAT_BLOCKED_CHANCE) {
          // Will become blocked partway through
          const blockAt = polecat.stateTimer * (0.3 + Math.random() * 0.4)
          this.scene.time.delayedCall(blockAt, () => {
            if (polecat.status === 'working') {
              this.transitionTo(polecat, 'blocked')
            }
          })
        }
        break
      }
      case 'done':
        polecat.celebratePhase = 0
        polecat.stateTimer = 0
        break
      case 'blocked':
        polecat.stateTimer = POLECAT_BLOCKED_DURATION
        polecat.activityTimer = 500
        polecat.blockedPaceDir = 1
        if (overlay) this.updateOverlay(overlay, '?')
        break
    }
  }

  // === HELPERS ===

  private moveAlongPath(polecat: PolecatState, sprite: Phaser.GameObjects.Container, delta: number, speedMult: number) {
    if (polecat.pathIndex >= polecat.path.length) return

    const target = polecat.path[polecat.pathIndex]
    const tx = target.x * TILE_SIZE + TILE_SIZE / 2
    const ty = target.y * TILE_SIZE + TILE_SIZE / 2
    const dx = tx - sprite.x
    const dy = ty - sprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = (TILE_SIZE * delta * speedMult) / 150

    if (dist < speed) {
      sprite.x = tx
      sprite.y = ty
      polecat.position = { ...target }
      polecat.pathIndex++
    } else {
      sprite.x += (dx / dist) * speed
      sprite.y += (dy / dist) * speed
    }
  }

  private pickYardWanderTarget(polecat: PolecatState) {
    const tx = YARD_ROOM.x + 3 + Math.floor(Math.random() * (YARD_ROOM.width - 6))
    const ty = YARD_ROOM.y + 3 + Math.floor(Math.random() * (YARD_ROOM.height - 6))

    if (this.grid[ty]?.[tx]?.walkable) {
      const path = findPath(polecat.position, { x: tx, y: ty }, this.grid)
      if (path.length > 0 && path.length < 20) {
        polecat.path = path
        polecat.pathIndex = 0
      }
    }
  }

  private updateOverlay(overlay: Phaser.GameObjects.Container, icon: string) {
    this.clearOverlay(overlay)

    // Bubble background
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x1a1520, 0.85)
    bg.fillRoundedRect(-10, -8, 20, 16, 4)
    bg.lineStyle(1, 0x64477d)
    bg.strokeRoundedRect(-10, -8, 20, 16, 4)

    // Bubble tail
    bg.fillStyle(0x1a1520, 0.85)
    bg.fillTriangle(-2, 8, 2, 8, 0, 12)

    const text = this.scene.add.text(0, 0, icon, {
      fontSize: '10px',
      fontFamily: 'monospace',
    })
    text.setOrigin(0.5, 0.5)

    overlay.add([bg, text])
  }

  private clearOverlay(overlay: Phaser.GameObjects.Container) {
    overlay.removeAll(true)
  }

  private updateStatusDot(sprite: Phaser.GameObjects.Container, status: PolecatLifecycle) {
    const dot = sprite.list[2] as Phaser.GameObjects.Arc
    if (!dot) return

    const colors: Record<PolecatLifecycle, number> = {
      idle: 0x888888,
      slung: 0xffaa00,
      working: 0x00ff88,
      done: 0x44ffaa,
      blocked: 0xff4444,
    }
    dot.setFillStyle(colors[status])
  }

  getActiveCount(): number {
    let count = 0
    for (const p of this.polecats.values()) {
      if (p.status !== 'idle') count++
    }
    return count
  }

  getPolecatStates(): Map<string, PolecatState> {
    return this.polecats
  }
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function hashStr(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
