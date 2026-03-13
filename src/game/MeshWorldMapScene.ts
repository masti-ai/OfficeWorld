import Phaser from 'phaser'
import { CANVAS_WIDTH, CANVAS_HEIGHT, THEME } from '../constants'
import { ScreenTransition } from './transitions/ScreenTransition'

// --- Types ---

interface MeshTown {
  townId: string
  name: string
  rigs: string[]
  agentCount: number
  beadCount: number
  activePolecats: number
  agents: Array<{ name: string; role: string; online: boolean }>
}

interface TownNode {
  town: MeshTown
  x: number
  y: number
  sprite: Phaser.GameObjects.Container
  label: Phaser.GameObjects.Text
  card: Phaser.GameObjects.Container | null
  pulseTime: number
}

interface ConnectionLine {
  fromId: string
  toId: string
  graphics: Phaser.GameObjects.Graphics
  dashOffset: number
  pulseAlpha: number
  pulsing: boolean
}

interface CourierSprite {
  sprite: Phaser.GameObjects.Graphics
  fromId: string
  toId: string
  progress: number
  speed: number
}

// --- Constants ---

const TOWN_SPRITE_SIZE = 48
const NODE_SPACING_X = 200
const NODE_SPACING_Y = 160
const SELF_GLOW_COLOR = 0xffd700
const CONNECTION_COLOR = 0x53d8fb
const CONNECTION_PULSE_COLOR = 0xffaa00
const COURIER_COLOR = 0xff9800
const BG_COLOR = 0x060810
const GRID_COLOR = 0x0e0c1a
const CARD_BG = 0x0a0c14
const CARD_BORDER = 0x1a1630
const DASH_LENGTH = 8
const GAP_LENGTH = 6
const DASH_SPEED = 30
const COURIER_SPEED = 0.4

// Pixel art town building colors by theme
const TOWN_COLORS: Record<string, { roof: number; wall: number; window: number }> = {
  default: { roof: 0x8b4513, wall: 0xc4a882, window: 0x53d8fb },
  planogram: { roof: 0x3a7bd5, wall: 0xd4c4a0, window: 0xffd700 },
  alc_ai: { roof: 0x4caf50, wall: 0xb8c8a0, window: 0x53d8fb },
  arcade: { roof: 0x9c27b0, wall: 0xc0b0d0, window: 0xff9800 },
}

function getTownColor(rigs: string[]): { roof: number; wall: number; window: number } {
  for (const rig of rigs) {
    const key = rig.replace('villa_ai_', '').replace('villa_alc_ai', 'alc_ai').replace('gt_arcade', 'arcade')
    if (TOWN_COLORS[key]) return TOWN_COLORS[key]
  }
  return TOWN_COLORS.default
}

export class MeshWorldMapScene extends Phaser.Scene {
  private nodes = new Map<string, TownNode>()
  private connections: ConnectionLine[] = []
  private couriers: CourierSprite[] = []
  private selfTownId = ''
  private selfGlowGraphics!: Phaser.GameObjects.Graphics
  private bgGraphics!: Phaser.GameObjects.Graphics
  // connection drawing is done per-connection on individual Graphics objects
  private screenTransition!: ScreenTransition
  private wsListenerCleanup: (() => void) | null = null
  private pollTimer = 0
  private statusText!: Phaser.GameObjects.Text
  private starField: Array<{ x: number; y: number; size: number; alpha: number; speed: number }> = []
  private starGraphics!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'MeshWorldMapScene' })
  }

  create() {
    // Draw background
    this.bgGraphics = this.add.graphics()
    this.drawBackground()

    // Starfield layer
    this.starGraphics = this.add.graphics()
    this.initStarField()

    // Self-glow layer
    this.selfGlowGraphics = this.add.graphics()

    // Title
    this.add.text(CANVAS_WIDTH / 2, 20, 'MESH WORLD MAP', {
      fontSize: '14px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.gold,
      align: 'center',
    }).setOrigin(0.5, 0)

    // Status indicator
    this.statusText = this.add.text(CANVAS_WIDTH / 2, 40, 'Connecting to mesh...', {
      fontSize: '10px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textSecondary,
      align: 'center',
    }).setOrigin(0.5, 0)

    // Hint text
    this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16, 'Click town to spectate  |  [W] Return to arcade', {
      fontSize: '10px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textMuted,
      align: 'center',
    }).setOrigin(0.5, 1)

    // Screen transition
    this.screenTransition = new ScreenTransition(this)

    // Fetch initial mesh state
    this.fetchMeshState()

    // Listen for mesh WS events
    this.setupWsListener()

    // Keyboard: W to return to arcade
    this.input.keyboard?.on('keydown-W', () => {
      if (this.screenTransition.isActive) return
      this.screenTransition.playInOut({ type: 'pixel-dissolve', duration: 400 }, () => {
        this.scene.stop('MeshWorldMapScene')
        this.scene.start('ArcadeScene')
      })
    })

    // Keyboard: ESC to return
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.screenTransition.isActive) return
      this.scene.stop('MeshWorldMapScene')
      this.scene.start('ArcadeScene')
    })
  }

  update(_time: number, delta: number) {
    // Animate starfield
    this.animateStars(delta)

    // Animate connection dashes
    for (const conn of this.connections) {
      conn.dashOffset += DASH_SPEED * (delta / 1000)
      if (conn.dashOffset > DASH_LENGTH + GAP_LENGTH) {
        conn.dashOffset -= DASH_LENGTH + GAP_LENGTH
      }
      if (conn.pulsing) {
        conn.pulseAlpha = Math.max(0, conn.pulseAlpha - delta * 0.002)
        if (conn.pulseAlpha <= 0) conn.pulsing = false
      }
    }
    this.drawConnections()

    // Animate couriers
    for (let i = this.couriers.length - 1; i >= 0; i--) {
      const c = this.couriers[i]
      c.progress += COURIER_SPEED * (delta / 1000)
      if (c.progress >= 1) {
        c.sprite.destroy()
        this.couriers.splice(i, 1)
        continue
      }
      this.updateCourierPosition(c)
    }

    // Animate self glow
    this.drawSelfGlow()

    // Animate node pulses
    for (const node of this.nodes.values()) {
      node.pulseTime += delta
    }

    // Poll mesh state periodically
    this.pollTimer += delta
    if (this.pollTimer > 10000) {
      this.pollTimer = 0
      this.fetchMeshState()
    }
  }

  shutdown() {
    this.wsListenerCleanup?.()
    this.wsListenerCleanup = null
  }

  // --- Background & Stars ---

  private drawBackground() {
    this.bgGraphics.fillStyle(BG_COLOR)
    this.bgGraphics.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Subtle grid
    this.bgGraphics.lineStyle(1, GRID_COLOR, 0.15)
    for (let x = 0; x < CANVAS_WIDTH; x += 32) {
      this.bgGraphics.lineBetween(x, 0, x, CANVAS_HEIGHT)
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 32) {
      this.bgGraphics.lineBetween(0, y, CANVAS_WIDTH, y)
    }
  }

  private initStarField() {
    for (let i = 0; i < 60; i++) {
      this.starField.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() < 0.3 ? 2 : 1,
        alpha: 0.2 + Math.random() * 0.5,
        speed: 0.3 + Math.random() * 0.7,
      })
    }
  }

  private animateStars(_delta: number) {
    this.starGraphics.clear()
    for (const star of this.starField) {
      star.alpha += Math.sin(star.speed * this.time.now * 0.003) * 0.01
      star.alpha = Phaser.Math.Clamp(star.alpha, 0.1, 0.7)
      this.starGraphics.fillStyle(0xffffff, star.alpha)
      this.starGraphics.fillRect(star.x, star.y, star.size, star.size)
    }
  }

  // --- Mesh Data ---

  private async fetchMeshState() {
    try {
      const res = await fetch('/api/mesh/towns')
      const data = await res.json()
      if (!data.ok) return

      this.selfTownId = data.self?.townId || 'gt-local'
      const selfTown: MeshTown = {
        townId: this.selfTownId,
        name: data.self?.name || 'Gas Town',
        rigs: [],
        agentCount: 0,
        beadCount: 0,
        activePolecats: 0,
        agents: [],
      }

      // Fetch self status
      try {
        const statusRes = await fetch('/api/status/parsed')
        const statusData = await statusRes.json()
        if (statusData.ok) {
          selfTown.rigs = statusData.rigs || []
          selfTown.agents = (statusData.agents || []).map((a: { name: string; role: string; online: boolean }) => ({
            name: a.name,
            role: a.role,
            online: a.online,
          }))
          selfTown.agentCount = selfTown.agents.filter((a) => a.online).length
        }
      } catch { /* skip */ }

      const remoteTowns: MeshTown[] = (data.towns || []).map((t: MeshTown) => ({
        townId: t.townId,
        name: t.name,
        rigs: t.rigs || [],
        agentCount: t.agentCount || 0,
        beadCount: 0,
        activePolecats: 0,
        agents: [],
      }))

      this.rebuildNodes([selfTown, ...remoteTowns])
      this.rebuildConnections()

      const connCount = remoteTowns.length
      this.statusText.setText(
        connCount > 0
          ? `Connected: ${connCount} town${connCount !== 1 ? 's' : ''} on mesh`
          : 'No other towns on mesh'
      )
    } catch {
      this.statusText.setText('Mesh offline')
    }
  }

  // --- Node Management ---

  private rebuildNodes(towns: MeshTown[]) {
    const existingIds = new Set(this.nodes.keys())
    const newIds = new Set(towns.map((t) => t.townId))

    // Remove nodes for towns no longer present
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const node = this.nodes.get(id)!
        node.sprite.destroy()
        node.label.destroy()
        node.card?.destroy()
        this.nodes.delete(id)
      }
    }

    // Calculate positions in a circular/grid layout
    const positions = this.calculateNodePositions(towns)

    for (let i = 0; i < towns.length; i++) {
      const town = towns[i]
      const pos = positions[i]

      if (this.nodes.has(town.townId)) {
        // Update existing node
        const node = this.nodes.get(town.townId)!
        node.town = town
        this.updateNodeCard(node)
      } else {
        // Create new node
        const node = this.createTownNode(town, pos.x, pos.y)
        this.nodes.set(town.townId, node)
      }
    }
  }

  private calculateNodePositions(towns: MeshTown[]): Array<{ x: number; y: number }> {
    const cx = CANVAS_WIDTH / 2
    const cy = CANVAS_HEIGHT / 2

    if (towns.length === 1) {
      return [{ x: cx, y: cy }]
    }

    if (towns.length === 2) {
      return [
        { x: cx - NODE_SPACING_X / 2, y: cy },
        { x: cx + NODE_SPACING_X / 2, y: cy },
      ]
    }

    // Circular layout for 3+ towns, self in center if possible
    const positions: Array<{ x: number; y: number }> = []
    const selfIdx = towns.findIndex((t) => t.townId === this.selfTownId)

    if (selfIdx >= 0 && towns.length <= 7) {
      // Self in center, others in a ring
      const radius = Math.min(NODE_SPACING_X, NODE_SPACING_Y) * 1.2
      const others = towns.filter((_, i) => i !== selfIdx)
      positions.length = towns.length

      positions[selfIdx] = { x: cx, y: cy }

      for (let i = 0; i < others.length; i++) {
        const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2
        const idx = towns.indexOf(others[i])
        positions[idx] = {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        }
      }
    } else {
      // Grid layout for many towns
      const cols = Math.ceil(Math.sqrt(towns.length))
      const rows = Math.ceil(towns.length / cols)
      const startX = cx - ((cols - 1) * NODE_SPACING_X) / 2
      const startY = cy - ((rows - 1) * NODE_SPACING_Y) / 2

      for (let i = 0; i < towns.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        positions.push({
          x: startX + col * NODE_SPACING_X,
          y: startY + row * NODE_SPACING_Y,
        })
      }
    }

    return positions
  }

  private createTownNode(town: MeshTown, x: number, y: number): TownNode {
    const container = this.add.container(x, y)
    const isSelf = town.townId === this.selfTownId
    const colors = getTownColor(town.rigs)

    // Draw pixel art building
    const building = this.add.graphics()
    this.drawPixelBuilding(building, colors, isSelf)
    container.add(building)

    // Town name label
    const label = this.add.text(x, y + TOWN_SPRITE_SIZE / 2 + 8, town.name, {
      fontSize: '10px',
      fontFamily: "'ArkPixel', monospace",
      color: isSelf ? THEME.gold : THEME.textPrimary,
      align: 'center',
    }).setOrigin(0.5, 0)

    // Make clickable
    const hitArea = this.add.rectangle(0, 0, TOWN_SPRITE_SIZE + 16, TOWN_SPRITE_SIZE + 16)
    hitArea.setInteractive({ useHandCursor: true })
    container.add(hitArea)
    hitArea.setAlpha(0.001) // invisible but clickable

    hitArea.on('pointerdown', () => {
      this.onTownClick(town)
    })

    hitArea.on('pointerover', () => {
      this.showTownCard(town.townId)
    })

    hitArea.on('pointerout', () => {
      this.hideTownCard(town.townId)
    })

    // Create card (initially hidden)
    const card = this.createTownCard(town, x, y)

    return {
      town,
      x,
      y,
      sprite: container,
      label,
      card,
      pulseTime: 0,
    }
  }

  private drawPixelBuilding(g: Phaser.GameObjects.Graphics, colors: { roof: number; wall: number; window: number }, isSelf: boolean) {
    const s = TOWN_SPRITE_SIZE
    const hs = s / 2

    // Building base (wall)
    g.fillStyle(colors.wall)
    g.fillRect(-hs + 4, -hs + 12, s - 8, s - 16)

    // Roof (triangle-ish)
    g.fillStyle(colors.roof)
    g.fillRect(-hs + 2, -hs + 8, s - 4, 6)
    g.fillRect(-hs + 6, -hs + 4, s - 12, 6)
    g.fillRect(-hs + 10, -hs, s - 20, 6)

    // Windows (2x2 grid)
    g.fillStyle(colors.window)
    g.fillRect(-hs + 8, -hs + 16, 6, 6)
    g.fillRect(hs - 14, -hs + 16, 6, 6)
    g.fillRect(-hs + 8, -hs + 26, 6, 6)
    g.fillRect(hs - 14, -hs + 26, 6, 6)

    // Door
    g.fillStyle(colors.roof)
    g.fillRect(-3, -hs + 28, 6, 8)

    // Chimney
    g.fillStyle(colors.roof)
    g.fillRect(hs - 14, -hs - 2, 4, 8)

    // Antenna/flag for self town
    if (isSelf) {
      g.fillStyle(SELF_GLOW_COLOR)
      g.fillRect(-1, -hs - 6, 2, 10)
      g.fillRect(1, -hs - 6, 6, 3)
    }
  }

  // --- Town Cards (hover info) ---

  private createTownCard(town: MeshTown, x: number, y: number): Phaser.GameObjects.Container {
    const cardW = 160
    const cardH = 80
    const isSelf = town.townId === this.selfTownId
    const cardX = x + TOWN_SPRITE_SIZE / 2 + 12
    const cardY = y - cardH / 2

    // Clamp to screen
    const clampedX = Math.min(cardX, CANVAS_WIDTH - cardW - 8)
    const clampedY = Phaser.Math.Clamp(cardY, 8, CANVAS_HEIGHT - cardH - 8)

    const container = this.add.container(clampedX, clampedY)
    container.setVisible(false)
    container.setDepth(100)

    const bg = this.add.graphics()
    bg.fillStyle(CARD_BG, 0.95)
    bg.fillRect(0, 0, cardW, cardH)
    bg.lineStyle(1, isSelf ? SELF_GLOW_COLOR : CARD_BORDER)
    bg.strokeRect(0, 0, cardW, cardH)
    container.add(bg)

    const nameText = this.add.text(8, 6, town.name, {
      fontSize: '10px',
      fontFamily: "'ArkPixel', monospace",
      color: isSelf ? THEME.gold : THEME.textBright,
    })
    container.add(nameText)

    const idText = this.add.text(8, 20, `ID: ${town.townId}`, {
      fontSize: '8px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textMuted,
    })
    container.add(idText)

    const onlineCount = town.agents.filter((a) => a.online).length
    const agentText = this.add.text(8, 34, `Agents: ${onlineCount || town.agentCount}`, {
      fontSize: '9px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.green,
    })
    container.add(agentText)

    const rigText = this.add.text(8, 48, `Rigs: ${town.rigs.length > 0 ? town.rigs.join(', ') : 'n/a'}`, {
      fontSize: '8px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textSecondary,
      wordWrap: { width: cardW - 16 },
    })
    container.add(rigText)

    if (isSelf) {
      const selfBadge = this.add.text(cardW - 8, 6, 'YOU', {
        fontSize: '8px',
        fontFamily: "'ArkPixel', monospace",
        color: THEME.gold,
      }).setOrigin(1, 0)
      container.add(selfBadge)
    }

    return container
  }

  private updateNodeCard(node: TownNode) {
    // Destroy old card and recreate with updated data
    if (node.card) {
      node.card.destroy()
    }
    node.card = this.createTownCard(node.town, node.x, node.y)
  }

  private showTownCard(townId: string) {
    const node = this.nodes.get(townId)
    if (node?.card) node.card.setVisible(true)
  }

  private hideTownCard(townId: string) {
    const node = this.nodes.get(townId)
    if (node?.card) node.card.setVisible(false)
  }

  // --- Connections ---

  private rebuildConnections() {
    // Clear old connections
    for (const conn of this.connections) {
      conn.graphics.destroy()
    }
    this.connections = []

    // Connect all towns to self (star topology visualization)
    const selfNode = this.nodes.get(this.selfTownId)
    if (!selfNode) return

    for (const [id] of this.nodes) {
      if (id === this.selfTownId) continue

      const graphics = this.add.graphics()
      graphics.setDepth(1)

      this.connections.push({
        fromId: this.selfTownId,
        toId: id,
        graphics,
        dashOffset: Math.random() * (DASH_LENGTH + GAP_LENGTH),
        pulseAlpha: 0,
        pulsing: false,
      })
    }

    // Also connect remote towns to each other (full mesh visual)
    const remoteIds = Array.from(this.nodes.keys()).filter((id) => id !== this.selfTownId)
    for (let i = 0; i < remoteIds.length; i++) {
      for (let j = i + 1; j < remoteIds.length; j++) {
        const graphics = this.add.graphics()
        graphics.setDepth(0)

        this.connections.push({
          fromId: remoteIds[i],
          toId: remoteIds[j],
          graphics,
          dashOffset: Math.random() * (DASH_LENGTH + GAP_LENGTH),
          pulseAlpha: 0,
          pulsing: false,
        })
      }
    }
  }

  private drawConnections() {
    for (const conn of this.connections) {
      conn.graphics.clear()

      const fromNode = this.nodes.get(conn.fromId)
      const toNode = this.nodes.get(conn.toId)
      if (!fromNode || !toNode) continue

      const isSelfConn = conn.fromId === this.selfTownId || conn.toId === this.selfTownId

      // Draw animated dashed line
      const dx = toNode.x - fromNode.x
      const dy = toNode.y - fromNode.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue

      const nx = dx / dist
      const ny = dy / dist

      const baseAlpha = isSelfConn ? 0.6 : 0.2
      const color = conn.pulsing ? CONNECTION_PULSE_COLOR : CONNECTION_COLOR

      // Dashed line
      let pos = conn.dashOffset
      while (pos < dist) {
        const dashEnd = Math.min(pos + DASH_LENGTH, dist)
        const x1 = fromNode.x + nx * pos
        const y1 = fromNode.y + ny * pos
        const x2 = fromNode.x + nx * dashEnd
        const y2 = fromNode.y + ny * dashEnd

        const alpha = conn.pulsing
          ? baseAlpha + conn.pulseAlpha * 0.4
          : baseAlpha

        conn.graphics.lineStyle(isSelfConn ? 2 : 1, color, alpha)
        conn.graphics.lineBetween(x1, y1, x2, y2)

        pos = dashEnd + GAP_LENGTH
      }

      // Pulse glow overlay
      if (conn.pulsing && conn.pulseAlpha > 0) {
        conn.graphics.lineStyle(4, CONNECTION_PULSE_COLOR, conn.pulseAlpha * 0.3)
        conn.graphics.lineBetween(fromNode.x, fromNode.y, toNode.x, toNode.y)
      }
    }
  }

  private pulseConnection(fromId: string, toId: string) {
    for (const conn of this.connections) {
      if (
        (conn.fromId === fromId && conn.toId === toId) ||
        (conn.fromId === toId && conn.toId === fromId)
      ) {
        conn.pulsing = true
        conn.pulseAlpha = 1
      }
    }
  }

  // --- Self Glow ---

  private drawSelfGlow() {
    this.selfGlowGraphics.clear()
    const selfNode = this.nodes.get(this.selfTownId)
    if (!selfNode) return

    const t = this.time.now * 0.002
    const alpha = 0.15 + Math.sin(t) * 0.1
    const radius = TOWN_SPRITE_SIZE * 0.8 + Math.sin(t * 0.7) * 4

    this.selfGlowGraphics.fillStyle(SELF_GLOW_COLOR, alpha)
    this.selfGlowGraphics.fillCircle(selfNode.x, selfNode.y, radius)

    // Inner ring
    this.selfGlowGraphics.lineStyle(1, SELF_GLOW_COLOR, alpha * 1.5)
    this.selfGlowGraphics.strokeCircle(selfNode.x, selfNode.y, radius * 0.7)
  }

  // --- Couriers ---

  private spawnCourier(fromId: string, toId: string) {
    const fromNode = this.nodes.get(fromId)
    const toNode = this.nodes.get(toId)
    if (!fromNode || !toNode) return

    const sprite = this.add.graphics()
    sprite.setDepth(50)

    const courier: CourierSprite = {
      sprite,
      fromId,
      toId,
      progress: 0,
      speed: COURIER_SPEED,
    }

    this.couriers.push(courier)
    this.updateCourierPosition(courier)

    // Pulse the connection
    this.pulseConnection(fromId, toId)
  }

  private updateCourierPosition(courier: CourierSprite) {
    const fromNode = this.nodes.get(courier.fromId)
    const toNode = this.nodes.get(courier.toId)
    if (!fromNode || !toNode) return

    const t = courier.progress
    const x = fromNode.x + (toNode.x - fromNode.x) * t
    const y = fromNode.y + (toNode.y - fromNode.y) * t

    courier.sprite.clear()

    // Envelope shape (pixel art)
    courier.sprite.fillStyle(COURIER_COLOR)
    courier.sprite.fillRect(x - 5, y - 3, 10, 6)
    courier.sprite.fillStyle(0xffffff)
    courier.sprite.fillRect(x - 4, y - 2, 8, 4)
    // Flap
    courier.sprite.fillStyle(COURIER_COLOR)
    courier.sprite.fillTriangle(x - 4, y - 2, x + 4, y - 2, x, y + 1)

    // Trail
    const trailAlpha = 0.3
    for (let i = 1; i <= 3; i++) {
      const tt = Math.max(0, t - i * 0.03)
      const tx = fromNode.x + (toNode.x - fromNode.x) * tt
      const ty = fromNode.y + (toNode.y - fromNode.y) * tt
      courier.sprite.fillStyle(COURIER_COLOR, trailAlpha / i)
      courier.sprite.fillRect(tx - 2, ty - 1, 4, 2)
    }
  }

  // --- Town Click ---

  private onTownClick(town: MeshTown) {
    if (town.townId === this.selfTownId) {
      // Return to own arcade
      if (this.screenTransition.isActive) return
      this.screenTransition.playInOut({ type: 'iris', duration: 400 }, () => {
        this.scene.stop('MeshWorldMapScene')
        this.scene.start('ArcadeScene')
      })
    } else {
      // Show spectate info (read-only notice)
      this.showSpectateNotice(town)
    }
  }

  private showSpectateNotice(town: MeshTown) {
    // Create a temporary overlay notice
    const overlay = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    overlay.setDepth(200)

    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.8)
    bg.fillRect(-120, -50, 240, 100)
    bg.lineStyle(1, CONNECTION_COLOR)
    bg.strokeRect(-120, -50, 240, 100)
    overlay.add(bg)

    const title = this.add.text(0, -35, town.name, {
      fontSize: '12px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.cyan,
      align: 'center',
    }).setOrigin(0.5)
    overlay.add(title)

    const info = this.add.text(0, -15, `Agents: ${town.agentCount} | Rigs: ${town.rigs.length}`, {
      fontSize: '9px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textSecondary,
      align: 'center',
    }).setOrigin(0.5)
    overlay.add(info)

    const notice = this.add.text(0, 8, 'Spectate mode not yet available', {
      fontSize: '9px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.orange,
      align: 'center',
    }).setOrigin(0.5)
    overlay.add(notice)

    const hint = this.add.text(0, 30, 'Click anywhere to dismiss', {
      fontSize: '8px',
      fontFamily: "'ArkPixel', monospace",
      color: THEME.textMuted,
      align: 'center',
    }).setOrigin(0.5)
    overlay.add(hint)

    // Dismiss on click
    this.input.once('pointerdown', () => {
      overlay.destroy()
    })
  }

  // --- WebSocket Listener ---

  private setupWsListener() {
    let ws: WebSocket | null = null

    const connect = () => {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`)

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            this.handleWsMessage(msg)
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          setTimeout(connect, 5000)
        }
      } catch { /* skip */ }
    }

    connect()

    this.wsListenerCleanup = () => {
      ws?.close()
      ws = null
    }
  }

  private handleWsMessage(msg: { type: string; [key: string]: unknown }) {
    switch (msg.type) {
      case 'mesh-town-announce': {
        // New town joined mesh
        const town = msg.town as MeshTown
        if (town && !this.nodes.has(town.townId)) {
          this.fetchMeshState() // Refresh all
        }
        break
      }

      case 'mesh-town-disconnect': {
        const townId = msg.townId as string
        if (townId && this.nodes.has(townId)) {
          this.fetchMeshState() // Refresh all
        }
        break
      }

      case 'mesh-town-state': {
        const townId = msg.townId as string
        const node = this.nodes.get(townId)
        if (node) {
          if (typeof msg.agentCount === 'number') {
            node.town.agentCount = msg.agentCount as number
          }
          if (Array.isArray(msg.agents)) {
            node.town.agents = msg.agents as MeshTown['agents']
          }
          if (typeof msg.beadCount === 'number') {
            node.town.beadCount = msg.beadCount as number
          }
          if (typeof msg.activePolecats === 'number') {
            node.town.activePolecats = msg.activePolecats as number
          }
          this.updateNodeCard(node)
        }
        break
      }

      case 'mesh-mesh-message': {
        // Courier animation for messages between towns
        const from = msg.from as { town: string }
        const to = msg.to as { town: string }
        if (from?.town && to?.town) {
          this.spawnCourier(from.town, to.town)
        }
        break
      }

      case 'mesh-agent-visit': {
        // Agent traveling between towns
        const from = msg.from as { town: string }
        const to = msg.to as { town: string }
        if (from?.town && to?.town) {
          this.spawnCourier(from.town, to.town)
        }
        break
      }
    }
  }
}
