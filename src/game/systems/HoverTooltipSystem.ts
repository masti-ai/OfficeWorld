import Phaser from 'phaser'
import { AgentState, RoomConfig, TileData } from '../../types'
import { TILE_SIZE, THEME } from '../../constants'
import { CharacterSprite } from '../sprites/CharacterSprite'

/** Lore / flavor text for furniture types */
const FURNITURE_LORE: Record<string, { label: string; desc: string }> = {
  desk: { label: 'Desk', desc: 'Standard-issue workstation' },
  monitor: { label: 'Monitor', desc: 'Glowing with endless diffs' },
  plant: { label: 'Potted Plant', desc: 'The only thing that never crashes' },
  toilet: { label: 'Toilet', desc: 'Critical infrastructure' },
  arcade_machine: { label: 'Arcade Cabinet', desc: 'INSERT COIN to continue' },
  vending_machine: { label: 'Vending Machine', desc: 'Caffeine delivery system' },
  table: { label: 'Table', desc: 'Good for lunch or a quick standup' },
  chair: { label: 'Chair', desc: 'Ergonomic-ish seating' },
  couch: { label: 'Couch', desc: 'For power naps between deploys' },
  ashtray: { label: 'Ashtray', desc: 'Slowly filling up...' },
  ping_pong: { label: 'Ping Pong Table', desc: 'Competitive stress relief' },
  whiteboard: { label: 'Whiteboard', desc: 'Covered in diagrams nobody erases' },
  bookshelf: { label: 'Bookshelf', desc: 'O\'Reilly books and old manuals' },
  coffee_machine: { label: 'Coffee Machine', desc: 'Fuel for the engine' },
  water_cooler: { label: 'Water Cooler', desc: 'Where gossip flows freely' },
  trash_can: { label: 'Trash Can', desc: 'Full of failed printouts' },
  projector_screen: { label: 'Projector Screen', desc: 'For all-hands and demos' },
  meeting_table: { label: 'Meeting Table', desc: 'Could have been an email' },
  server_rack: { label: 'Server Rack', desc: 'Humming quietly, running hot' },
  filing_cabinet: { label: 'Filing Cabinet', desc: 'Ancient records, never opened' },
  rug: { label: 'Rug', desc: 'Really ties the room together' },
  lamp: { label: 'Desk Lamp', desc: 'Warm glow for late nights' },
  coat_rack: { label: 'Coat Rack', desc: 'Holding jackets and forgotten scarves' },
  coffee_cup: { label: 'Coffee Cup', desc: 'Still warm... maybe' },
  desk_figurine: { label: 'Figurine', desc: 'A tiny guardian of the workspace' },
  desk_photo_frame: { label: 'Photo Frame', desc: 'A reminder of life outside the office' },
  desk_sticky_notes: { label: 'Sticky Notes', desc: 'TODO: remove this sticky note' },
  desk_energy_drink: { label: 'Energy Drink', desc: 'For those 3am deploy sessions' },
  desk_snack: { label: 'Snack Wrapper', desc: 'Evidence of deadline crunching' },
  desk_stress_ball: { label: 'Stress Ball', desc: 'Squeeze when the build fails' },
}

/** Room type descriptions */
const ROOM_PURPOSE: Record<string, string> = {
  department: 'Where the work happens',
  hallway: 'Connecting corridors',
  breakroom: 'Refuel and recharge',
  smoke_area: 'Fresh air and bad habits',
  bathroom: 'Essential facilities',
  play_area: 'Blow off some steam',
  meeting_room: 'Sync up and plan ahead',
  mayor_office: 'Town leadership HQ',
}

const TOOLTIP_PAD = 6
const TOOLTIP_MAX_WIDTH = 160
const LINE_HEIGHT = 11
const SHOW_DELAY = 120 // ms before tooltip appears

export class HoverTooltipSystem {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private bg: Phaser.GameObjects.Graphics
  private titleText: Phaser.GameObjects.Text
  private line1Text: Phaser.GameObjects.Text
  private line2Text: Phaser.GameObjects.Text
  private line3Text: Phaser.GameObjects.Text

  private grid: TileData[][]
  private rooms: RoomConfig[]
  private characters: Map<string, CharacterSprite>
  private agentStates: Map<string, AgentState>

  private currentKey = '' // cache key to avoid redraws
  private showTimer = 0
  private visible = false
  private tooltipW = 0
  private tooltipH = 0

  constructor(
    scene: Phaser.Scene,
    grid: TileData[][],
    rooms: RoomConfig[],
    characters: Map<string, CharacterSprite>,
    agentStates: Map<string, AgentState>,
  ) {
    this.scene = scene
    this.grid = grid
    this.rooms = rooms
    this.characters = characters
    this.agentStates = agentStates

    // Build tooltip container (UI layer, scroll-factor 0)
    this.bg = scene.add.graphics()

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '9px',
      fontFamily: THEME.fontFamily,
      stroke: '#000000',
      strokeThickness: 1,
      wordWrap: { width: TOOLTIP_MAX_WIDTH - TOOLTIP_PAD * 2 },
    }

    this.titleText = scene.add.text(TOOLTIP_PAD, TOOLTIP_PAD, '', {
      ...textStyle,
      fontSize: '10px',
      color: THEME.gold,
    })
    this.line1Text = scene.add.text(TOOLTIP_PAD, TOOLTIP_PAD + LINE_HEIGHT + 2, '', {
      ...textStyle,
      color: THEME.textPrimary,
    })
    this.line2Text = scene.add.text(TOOLTIP_PAD, TOOLTIP_PAD + (LINE_HEIGHT + 2) * 2, '', {
      ...textStyle,
      color: THEME.textSecondary,
    })
    this.line3Text = scene.add.text(TOOLTIP_PAD, TOOLTIP_PAD + (LINE_HEIGHT + 2) * 3, '', {
      ...textStyle,
      color: THEME.textMuted,
    })

    this.container = scene.add.container(0, 0, [
      this.bg,
      this.titleText,
      this.line1Text,
      this.line2Text,
      this.line3Text,
    ])
    this.container.setDepth(100)
    this.container.setScrollFactor(0)
    this.container.setVisible(false)
    this.container.setAlpha(0)
  }

  update(delta: number) {
    const pointer = this.scene.input.activePointer
    if (!pointer) {
      this.hide()
      return
    }

    const camera = this.scene.cameras.main

    // Convert screen pointer to world coords
    const worldX = pointer.x / camera.zoom + camera.scrollX
    const worldY = pointer.y / camera.zoom + camera.scrollY
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    // 1) Check if hovering an agent sprite
    const agentInfo = this.findAgentAt(worldX, worldY)
    if (agentInfo) {
      const key = `agent:${agentInfo.id}`
      if (key !== this.currentKey) {
        this.currentKey = key
        this.showTimer = 0
        this.visible = false
        this.container.setVisible(false)
        this.container.setAlpha(0)
      }
      this.showTimer += delta
      if (this.showTimer >= SHOW_DELAY && !this.visible) {
        this.showAgentTooltip(agentInfo)
        this.reveal()
      }
      this.positionTooltip(pointer.x, pointer.y)
      return
    }

    // 2) Check grid tile
    const tile = this.grid[tileY]?.[tileX]
    if (!tile || !tile.roomId) {
      this.hide()
      return
    }

    // 3) Furniture tile
    if (tile.furnitureType) {
      const key = `furn:${tileX},${tileY}`
      if (key !== this.currentKey) {
        this.currentKey = key
        this.showTimer = 0
        this.visible = false
        this.container.setVisible(false)
        this.container.setAlpha(0)
      }
      this.showTimer += delta
      if (this.showTimer >= SHOW_DELAY && !this.visible) {
        const room = this.rooms.find(r => r.id === tile.roomId)
        this.showFurnitureTooltip(tile.furnitureType, room)
        this.reveal()
      }
      this.positionTooltip(pointer.x, pointer.y)
      return
    }

    // 4) Room floor
    const key = `room:${tile.roomId}`
    if (key !== this.currentKey) {
      this.currentKey = key
      this.showTimer = 0
      this.visible = false
      this.container.setVisible(false)
      this.container.setAlpha(0)
    }
    this.showTimer += delta
    if (this.showTimer >= SHOW_DELAY && !this.visible) {
      const room = this.rooms.find(r => r.id === tile.roomId)
      if (room) {
        this.showRoomTooltip(room)
        this.reveal()
      }
    }
    this.positionTooltip(pointer.x, pointer.y)
  }

  private findAgentAt(worldX: number, worldY: number): AgentState | null {
    // Check each agent character — if pointer is within ~12px of their world position
    for (const [id, char] of this.characters) {
      const pos = char.getPosition()
      const dx = Math.abs(worldX - pos.x)
      const dy = Math.abs(worldY - pos.y)
      if (dx < 10 && dy < 14) {
        return this.agentStates.get(id) ?? null
      }
    }
    return null
  }

  private showAgentTooltip(agent: AgentState) {
    const displayName = agent.role === 'mayor' ? 'MAYOR' : `${agent.rig}/${agent.name}`
    this.titleText.setText(displayName)
    this.line1Text.setText(`role: ${agent.role}`)
    this.line1Text.setColor(THEME.textPrimary)

    const statusColor = agent.status === 'working' ? THEME.green
      : agent.status === 'offline' ? THEME.red
      : THEME.orange
    this.line2Text.setText(`status: ${agent.status}`)
    this.line2Text.setColor(statusColor)

    this.line3Text.setText(agent.task ? `task: ${agent.task}` : '')
    this.line3Text.setColor(THEME.textMuted)

    this.resizeBg()
  }

  private showFurnitureTooltip(furnitureType: string, room?: RoomConfig) {
    const lore = FURNITURE_LORE[furnitureType] ?? { label: furnitureType, desc: '' }
    this.titleText.setText(lore.label)
    this.line1Text.setText(lore.desc)
    this.line1Text.setColor(THEME.textSecondary)
    this.line2Text.setText(room ? `in ${room.name}` : '')
    this.line2Text.setColor(THEME.textMuted)
    this.line3Text.setText('')

    this.resizeBg()
  }

  private showRoomTooltip(room: RoomConfig) {
    this.titleText.setText(room.name)
    const purpose = ROOM_PURPOSE[room.type] ?? ''
    this.line1Text.setText(purpose)
    this.line1Text.setColor(THEME.textSecondary)
    this.line2Text.setText(`type: ${room.type.replace(/_/g, ' ')}`)
    this.line2Text.setColor(THEME.textMuted)
    this.line3Text.setText('')

    this.resizeBg()
  }

  private resizeBg() {
    // Compute required height from visible text lines
    let h = TOOLTIP_PAD
    const lines = [this.titleText, this.line1Text, this.line2Text, this.line3Text]
    let maxW = 0
    for (const line of lines) {
      if (line.text) {
        h += LINE_HEIGHT + 2
        maxW = Math.max(maxW, line.width)
      }
    }
    h += TOOLTIP_PAD - 2
    const w = Math.min(TOOLTIP_MAX_WIDTH, maxW + TOOLTIP_PAD * 2)

    this.tooltipW = w
    this.tooltipH = h

    this.bg.clear()
    // Dark background
    this.bg.fillStyle(0x0e1119, 0.92)
    this.bg.fillRoundedRect(0, 0, w, h, 3)
    // Purple border
    this.bg.lineStyle(1.5, 0x64477d, 1)
    this.bg.strokeRoundedRect(0, 0, w, h, 3)
    // Gold accent line at top
    this.bg.lineStyle(1, 0xffd700, 0.6)
    this.bg.lineBetween(3, 1, w - 3, 1)
  }

  private positionTooltip(screenX: number, screenY: number) {
    if (!this.visible) return

    const cam = this.scene.cameras.main
    // Offset so tooltip appears to the right and below the cursor
    let x = screenX + 14
    let y = screenY + 14

    // Keep on screen
    if (x + this.tooltipW > cam.width - 4) {
      x = screenX - this.tooltipW - 8
    }
    if (y + this.tooltipH > cam.height - 4) {
      y = screenY - this.tooltipH - 8
    }
    if (x < 4) x = 4
    if (y < 4) y = 4

    this.container.setPosition(x, y)
  }

  private reveal() {
    this.visible = true
    this.container.setVisible(true)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 120,
      ease: 'Power2',
    })
  }

  private hide() {
    if (!this.visible && !this.currentKey) return
    this.currentKey = ''
    this.showTimer = 0
    if (this.visible) {
      this.visible = false
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 80,
        ease: 'Power2',
        onComplete: () => {
          this.container.setVisible(false)
        },
      })
    }
  }
}
