import Phaser from 'phaser'
import { RoomConfig } from '../../types'
import { TILE_SIZE, ROOM_COLORS, FLOOR_STYLES } from '../../constants'
import {
  CommandStack,
  PlaceRoomCommand,
  MoveRoomCommand,
  ResizeRoomCommand,
  DeleteRoomCommand,
  ChangeFloorCommand,
  ChangeWallColorCommand,
} from './CommandStack'
import { generateLayout } from '../world/DynamicRoomGenerator'

const GRID_COLOR = 0x445566
const GRID_ALPHA = 0.15
const SNAP_HIGHLIGHT = 0x88ccff
const ROOM_SELECTED_TINT = 0xaaddff
const HANDLE_SIZE = 8
const HANDLE_COLOR = 0xffffff
const HANDLE_HOVER = 0xffdd44
const MIN_ROOM_W = 6
const MIN_ROOM_H = 6
type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'

interface RoomSprite {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  border: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  handles: Phaser.GameObjects.Rectangle[]
}

const ROOM_PALETTE: { type: RoomConfig['type']; name: string; defaultW: number; defaultH: number }[] = [
  { type: 'department', name: 'Office', defaultW: 30, defaultH: 25 },
  { type: 'breakroom', name: 'Break Room', defaultW: 20, defaultH: 20 },
  { type: 'meeting_room', name: 'Meeting', defaultW: 20, defaultH: 20 },
  { type: 'smoke_area', name: 'Smoke Area', defaultW: 16, defaultH: 20 },
  { type: 'bathroom', name: 'Bathroom', defaultW: 14, defaultH: 20 },
  { type: 'play_area', name: 'Play Area', defaultW: 26, defaultH: 20 },
  { type: 'mayor_office', name: "Mayor's Office", defaultW: 12, defaultH: 25 },
  { type: 'hallway', name: 'Hallway', defaultW: 40, defaultH: 8 },
]

export class TownEditorScene extends Phaser.Scene {
  private rooms: RoomConfig[] = []
  private commandStack!: CommandStack
  private gridGraphics!: Phaser.GameObjects.Graphics
  private roomSprites = new Map<string, RoomSprite>()
  private selectedRoomId: string | null = null
  private dragMode: DragMode = 'none'
  private dragStartTile = { x: 0, y: 0 }
  private dragRoomStart = { x: 0, y: 0, w: 0, h: 0 }
  private worldWidth = 120
  private worldHeight = 80
  private gridVisible = true
  private snapCursor!: Phaser.GameObjects.Rectangle
  private placingTemplate: typeof ROOM_PALETTE[number] | null = null
  private placingGhost: Phaser.GameObjects.Rectangle | null = null
  private nextRoomId = 1
  constructor() {
    super({ key: 'TownEditorScene' })
  }

  init(data?: { rooms?: RoomConfig[] }) {
    if (data?.rooms && data.rooms.length > 0) {
      this.rooms = data.rooms.map((r) => ({
        ...r,
        furniture: [...r.furniture],
        deskPositions: [...r.deskPositions],
      }))
    } else {
      const layout = generateLayout([])
      this.rooms = layout.rooms
      this.worldWidth = layout.worldWidth
      this.worldHeight = layout.worldHeight
    }
    // Set nextRoomId based on existing rooms
    this.nextRoomId = this.rooms.length + 1
  }

  create() {
    this.commandStack = new CommandStack(() => this.onLayoutChanged())

    // Dark background
    this.add.rectangle(
      0, 0,
      this.worldWidth * TILE_SIZE,
      this.worldHeight * TILE_SIZE,
      0x040408,
    ).setOrigin(0, 0)

    // Grid overlay
    this.gridGraphics = this.add.graphics()
    this.drawGrid()

    // Snap cursor
    this.snapCursor = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, SNAP_HIGHLIGHT, 0.3)
      .setOrigin(0, 0).setVisible(false)

    // Render existing rooms
    for (const room of this.rooms) {
      this.createRoomSprite(room)
    }

    // Camera setup
    this.cameras.main.setBounds(0, 0, this.worldWidth * TILE_SIZE, this.worldHeight * TILE_SIZE)
    this.cameras.main.setZoom(1)
    // Center on world
    this.cameras.main.centerOn(
      (this.worldWidth * TILE_SIZE) / 2,
      (this.worldHeight * TILE_SIZE) / 2,
    )

    // Input handlers
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p))
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p))

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-Z', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey) this.commandStack.redo()
        else this.commandStack.undo()
      }
    })
    this.input.keyboard!.on('keydown-Y', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) this.commandStack.redo()
    })
    this.input.keyboard!.on('keydown-DELETE', () => this.deleteSelectedRoom())
    this.input.keyboard!.on('keydown-BACKSPACE', () => this.deleteSelectedRoom())
    this.input.keyboard!.on('keydown-G', () => this.toggleGrid())
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.placingTemplate) {
        this.cancelPlacement()
      } else {
        this.selectRoom(null)
      }
    })

    // Camera pan with middle mouse / right click drag
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown() || (p.rightButtonDown() && this.dragMode === 'none')) {
        this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom
        this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom
      }
    })

    // Zoom with scroll wheel
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _gos: any, _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.25, 3)
      this.cameras.main.setZoom(newZoom)
    })

    // Emit ready event for React UI
    this.game.events.emit('editor-ready', {
      palette: ROOM_PALETTE,
      canUndo: false,
      canRedo: false,
    })
  }

  // --- Room sprite management ---

  private createRoomSprite(room: RoomConfig): RoomSprite {
    const T = TILE_SIZE
    const px = room.x * T
    const py = room.y * T
    const pw = room.width * T
    const ph = room.height * T

    const bg = this.add.rectangle(0, 0, pw, ph, room.color, 0.6).setOrigin(0, 0)
    const border = this.add.rectangle(0, 0, pw, ph).setOrigin(0, 0)
    border.setStrokeStyle(2, 0xffffff, 0.5)
    border.setFillStyle()

    const label = this.add.text(pw / 2, ph / 2, room.name, {
      fontSize: '10px',
      fontFamily: "'ArkPixel', monospace",
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5)

    // Resize handles (4 corners)
    const handles: Phaser.GameObjects.Rectangle[] = []
    const handlePositions = [
      { x: 0, y: 0 },                    // NW
      { x: pw - HANDLE_SIZE, y: 0 },     // NE
      { x: 0, y: ph - HANDLE_SIZE },     // SW
      { x: pw - HANDLE_SIZE, y: ph - HANDLE_SIZE }, // SE
    ]
    for (const hp of handlePositions) {
      const h = this.add.rectangle(hp.x, hp.y, HANDLE_SIZE, HANDLE_SIZE, HANDLE_COLOR, 0.8)
        .setOrigin(0, 0)
        .setVisible(false)
      handles.push(h)
    }

    const container = this.add.container(px, py, [bg, border, label, ...handles])
    container.setSize(pw, ph)
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, pw, ph), Phaser.Geom.Rectangle.Contains)

    const sprite: RoomSprite = { container, bg, border, label, handles }
    this.roomSprites.set(room.id, sprite)
    return sprite
  }

  private updateRoomSprite(room: RoomConfig) {
    const sprite = this.roomSprites.get(room.id)
    if (!sprite) return

    const T = TILE_SIZE
    const pw = room.width * T
    const ph = room.height * T

    sprite.container.setPosition(room.x * T, room.y * T)
    sprite.container.setSize(pw, ph)
    sprite.bg.setSize(pw, ph).setFillStyle(room.color, 0.6)
    sprite.border.setSize(pw, ph)
    sprite.label.setPosition(pw / 2, ph / 2).setText(room.name)

    // Update handle positions
    const handlePositions = [
      { x: 0, y: 0 },
      { x: pw - HANDLE_SIZE, y: 0 },
      { x: 0, y: ph - HANDLE_SIZE },
      { x: pw - HANDLE_SIZE, y: ph - HANDLE_SIZE },
    ]
    sprite.handles.forEach((h, i) => h.setPosition(handlePositions[i].x, handlePositions[i].y))

    // Update interactivity
    sprite.container.removeInteractive()
    sprite.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, pw, ph),
      Phaser.Geom.Rectangle.Contains,
    )
  }

  private removeRoomSprite(roomId: string) {
    const sprite = this.roomSprites.get(roomId)
    if (sprite) {
      sprite.container.destroy()
      this.roomSprites.delete(roomId)
    }
  }

  // --- Selection ---

  private selectRoom(roomId: string | null) {
    // Deselect previous
    if (this.selectedRoomId) {
      const prev = this.roomSprites.get(this.selectedRoomId)
      if (prev) {
        prev.border.setStrokeStyle(2, 0xffffff, 0.5)
        prev.handles.forEach((h) => h.setVisible(false))
      }
    }

    this.selectedRoomId = roomId

    if (roomId) {
      const sprite = this.roomSprites.get(roomId)
      if (sprite) {
        sprite.border.setStrokeStyle(3, ROOM_SELECTED_TINT, 1)
        sprite.handles.forEach((h) => h.setVisible(true))
      }
    }

    const room = roomId ? this.rooms.find((r) => r.id === roomId) ?? null : null
    this.game.events.emit('editor-selection', room)
  }

  // --- Input handling ---

  private worldXY(pointer: Phaser.Input.Pointer): { wx: number; wy: number; tx: number; ty: number } {
    const cam = this.cameras.main
    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y)
    const tx = Math.floor(worldPoint.x / TILE_SIZE)
    const ty = Math.floor(worldPoint.y / TILE_SIZE)
    return { wx: worldPoint.x, wy: worldPoint.y, tx, ty }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    const { wx, wy, tx, ty } = this.worldXY(pointer)

    // Update snap cursor
    if (tx >= 0 && tx < this.worldWidth && ty >= 0 && ty < this.worldHeight) {
      this.snapCursor.setPosition(tx * TILE_SIZE, ty * TILE_SIZE).setVisible(true)
    } else {
      this.snapCursor.setVisible(false)
    }

    // Placement ghost
    if (this.placingTemplate && this.placingGhost) {
      this.placingGhost.setPosition(tx * TILE_SIZE, ty * TILE_SIZE)
    }

    // Drag handling
    if (this.dragMode !== 'none' && pointer.leftButtonDown() && this.selectedRoomId) {
      const room = this.rooms.find((r) => r.id === this.selectedRoomId)
      if (!room) return

      const dtx = tx - this.dragStartTile.x
      const dty = ty - this.dragStartTile.y

      if (this.dragMode === 'move') {
        room.x = this.dragRoomStart.x + dtx
        room.y = this.dragRoomStart.y + dty
        this.updateRoomSprite(room)
      } else {
        this.handleResizeDrag(room, dtx, dty)
      }
    }

    // Handle hover effect
    if (this.selectedRoomId && this.dragMode === 'none') {
      const sprite = this.roomSprites.get(this.selectedRoomId)
      if (sprite) {
        const localX = wx - sprite.container.x
        const localY = wy - sprite.container.y
        for (let i = 0; i < sprite.handles.length; i++) {
          const h = sprite.handles[i]
          const hx = h.x
          const hy = h.y
          const inside = localX >= hx && localX <= hx + HANDLE_SIZE && localY >= hy && localY <= hy + HANDLE_SIZE
          h.setFillStyle(inside ? HANDLE_HOVER : HANDLE_COLOR, 0.8)
        }
      }
    }
  }

  private handleResizeDrag(room: RoomConfig, dtx: number, dty: number) {
    const { x: sx, y: sy, w: sw, h: sh } = this.dragRoomStart

    switch (this.dragMode) {
      case 'resize-nw': {
        const nx = Math.min(sx + dtx, sx + sw - MIN_ROOM_W)
        const ny = Math.min(sy + dty, sy + sh - MIN_ROOM_H)
        room.x = nx; room.y = ny
        room.width = sx + sw - nx; room.height = sy + sh - ny
        break
      }
      case 'resize-ne': {
        const ny = Math.min(sy + dty, sy + sh - MIN_ROOM_H)
        room.y = ny
        room.width = Math.max(MIN_ROOM_W, sw + dtx)
        room.height = sy + sh - ny
        break
      }
      case 'resize-sw': {
        const nx = Math.min(sx + dtx, sx + sw - MIN_ROOM_W)
        room.x = nx
        room.width = sx + sw - nx
        room.height = Math.max(MIN_ROOM_H, sh + dty)
        break
      }
      case 'resize-se': {
        room.width = Math.max(MIN_ROOM_W, sw + dtx)
        room.height = Math.max(MIN_ROOM_H, sh + dty)
        break
      }
    }

    this.updateRoomSprite(room)
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!pointer.leftButtonDown()) return
    const { wx, wy, tx, ty } = this.worldXY(pointer)

    // Placement mode
    if (this.placingTemplate) {
      this.placeRoom(tx, ty)
      return
    }

    // Check if clicking a resize handle on selected room
    if (this.selectedRoomId) {
      const handleDir = this.hitTestHandles(wx, wy)
      if (handleDir) {
        const room = this.rooms.find((r) => r.id === this.selectedRoomId)!
        this.dragMode = handleDir
        this.dragStartTile = { x: tx, y: ty }
        this.dragRoomStart = { x: room.x, y: room.y, w: room.width, h: room.height }
        return
      }
    }

    // Check if clicking on a room
    const clickedRoom = this.hitTestRoom(wx, wy)
    if (clickedRoom) {
      this.selectRoom(clickedRoom.id)
      const room = clickedRoom
      this.dragMode = 'move'
      this.dragStartTile = { x: tx, y: ty }
      this.dragRoomStart = { x: room.x, y: room.y, w: room.width, h: room.height }
    } else {
      this.selectRoom(null)
    }
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer) {
    if (this.dragMode !== 'none' && this.selectedRoomId) {
      const room = this.rooms.find((r) => r.id === this.selectedRoomId)
      if (room) {
        const { x: ox, y: oy, w: ow, h: oh } = this.dragRoomStart
        if (this.dragMode === 'move') {
          if (room.x !== ox || room.y !== oy) {
            // Revert position, then execute command
            const newX = room.x, newY = room.y
            room.x = ox; room.y = oy
            this.commandStack.execute(new MoveRoomCommand(this.rooms, room.id, ox, oy, newX, newY))
          }
        } else {
          if (room.x !== ox || room.y !== oy || room.width !== ow || room.height !== oh) {
            const newX = room.x, newY = room.y, newW = room.width, newH = room.height
            room.x = ox; room.y = oy; room.width = ow; room.height = oh
            this.commandStack.execute(
              new ResizeRoomCommand(this.rooms, room.id, ox, oy, ow, oh, newX, newY, newW, newH),
            )
          }
        }
      }
    }
    this.dragMode = 'none'
  }

  private hitTestHandles(wx: number, wy: number): DragMode | null {
    if (!this.selectedRoomId) return null
    const sprite = this.roomSprites.get(this.selectedRoomId)
    if (!sprite) return null

    const localX = wx - sprite.container.x
    const localY = wy - sprite.container.y

    const modes: DragMode[] = ['resize-nw', 'resize-ne', 'resize-sw', 'resize-se']
    for (let i = 0; i < sprite.handles.length; i++) {
      const h = sprite.handles[i]
      if (localX >= h.x && localX <= h.x + HANDLE_SIZE && localY >= h.y && localY <= h.y + HANDLE_SIZE) {
        return modes[i]
      }
    }
    return null
  }

  private hitTestRoom(wx: number, wy: number): RoomConfig | null {
    // Iterate in reverse (top-most room first)
    for (let i = this.rooms.length - 1; i >= 0; i--) {
      const room = this.rooms[i]
      const px = room.x * TILE_SIZE
      const py = room.y * TILE_SIZE
      const pw = room.width * TILE_SIZE
      const ph = room.height * TILE_SIZE
      if (wx >= px && wx <= px + pw && wy >= py && wy <= py + ph) {
        return room
      }
    }
    return null
  }

  // --- Grid ---

  private drawGrid() {
    this.gridGraphics.clear()
    if (!this.gridVisible) return

    this.gridGraphics.lineStyle(1, GRID_COLOR, GRID_ALPHA)
    const T = TILE_SIZE
    const w = this.worldWidth * T
    const h = this.worldHeight * T

    for (let x = 0; x <= this.worldWidth; x++) {
      this.gridGraphics.moveTo(x * T, 0)
      this.gridGraphics.lineTo(x * T, h)
    }
    for (let y = 0; y <= this.worldHeight; y++) {
      this.gridGraphics.moveTo(0, y * T)
      this.gridGraphics.lineTo(w, y * T)
    }
    this.gridGraphics.strokePath()
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible
    this.drawGrid()
    this.game.events.emit('editor-grid-toggled', this.gridVisible)
  }

  // --- Room placement ---

  startPlacement(templateIndex: number) {
    this.cancelPlacement()
    this.placingTemplate = ROOM_PALETTE[templateIndex]
    if (!this.placingTemplate) return

    this.placingGhost = this.add.rectangle(
      0, 0,
      this.placingTemplate.defaultW * TILE_SIZE,
      this.placingTemplate.defaultH * TILE_SIZE,
      0x44aaff, 0.3,
    ).setOrigin(0, 0)

    this.selectRoom(null)
    this.game.events.emit('editor-placing', this.placingTemplate)
  }

  private cancelPlacement() {
    if (this.placingGhost) {
      this.placingGhost.destroy()
      this.placingGhost = null
    }
    this.placingTemplate = null
    this.game.events.emit('editor-placing', null)
  }

  private placeRoom(tx: number, ty: number) {
    if (!this.placingTemplate) return

    const id = `custom_${this.nextRoomId++}`
    const room: RoomConfig = {
      id,
      name: this.placingTemplate.name,
      x: tx,
      y: ty,
      width: this.placingTemplate.defaultW,
      height: this.placingTemplate.defaultH,
      type: this.placingTemplate.type,
      color: ROOM_COLORS[this.placingTemplate.type] ?? 0x9a9080,
      floorStyle: FLOOR_STYLES[this.placingTemplate.type] ?? 'tile',
      furniture: [],
      deskPositions: [],
    }

    this.commandStack.execute(new PlaceRoomCommand(this.rooms, room))
    this.cancelPlacement()
    this.selectRoom(id)
  }

  // --- Room deletion ---

  deleteSelectedRoom() {
    if (!this.selectedRoomId) return
    this.commandStack.execute(new DeleteRoomCommand(this.rooms, this.selectedRoomId))
    this.selectRoom(null)
  }

  // --- Undo/Redo ---

  undo() { this.commandStack.undo() }
  redo() { this.commandStack.redo() }

  // --- Layout change callback ---

  private onLayoutChanged() {
    // Sync room sprites with rooms array
    const currentIds = new Set(this.rooms.map((r) => r.id))
    // Remove sprites for deleted rooms
    for (const [id] of this.roomSprites) {
      if (!currentIds.has(id)) this.removeRoomSprite(id)
    }
    // Add/update sprites for current rooms
    for (const room of this.rooms) {
      if (this.roomSprites.has(room.id)) {
        this.updateRoomSprite(room)
      } else {
        this.createRoomSprite(room)
      }
    }

    // Re-select to refresh handles
    if (this.selectedRoomId && currentIds.has(this.selectedRoomId)) {
      this.selectRoom(this.selectedRoomId)
    } else if (this.selectedRoomId) {
      this.selectRoom(null)
    }

    this.game.events.emit('editor-layout-changed', {
      rooms: this.rooms,
      canUndo: this.commandStack.canUndo,
      canRedo: this.commandStack.canRedo,
    })
  }

  // --- Scene switching ---

  switchToPlay() {
    this.scene.start('ArcadeScene')
  }

  getRooms(): RoomConfig[] {
    return this.rooms.map((r) => ({ ...r, furniture: [...r.furniture], deskPositions: [...r.deskPositions] }))
  }

  // --- Floor/wall customization ---

  changeFloor(style: 'wood' | 'carpet' | 'tile' | 'concrete' | 'grass') {
    if (!this.selectedRoomId) return
    this.commandStack.execute(new ChangeFloorCommand(this.rooms, this.selectedRoomId, style))
  }

  changeWallColor(color: number) {
    if (!this.selectedRoomId) return
    this.commandStack.execute(new ChangeWallColorCommand(this.rooms, this.selectedRoomId, color))
  }
}
