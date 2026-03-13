import { useState, useRef, useEffect } from 'react'
import { THEME, ROOM_COLORS, TILE_SIZE } from '../../constants'
import { PixelPanel } from './PixelPanel'

export interface RoomPaletteItem {
  id: string
  name: string
  type: string
  icon: string
  color: number
  width: number
  height: number
}

export interface FurniturePaletteItem {
  id: string
  name: string
  type: string
  icon: string
  width: number
  height: number
}

export interface RoomPaletteProps {
  onRoomSelect?: (room: RoomPaletteItem) => void
  onFurnitureSelect?: (furniture: FurniturePaletteItem) => void
  selectedRoomId?: string | null
  selectedFurnitureId?: string | null
}

const ROOM_ITEMS: RoomPaletteItem[] = [
  { id: 'department', name: 'Department', type: 'department', icon: 'dept', color: ROOM_COLORS.planogram, width: 30, height: 25 },
  { id: 'mayor_office', name: "Mayor's Office", type: 'mayor_office', icon: 'mayor', color: ROOM_COLORS.mayor_office, width: 10, height: 15 },
  { id: 'hallway', name: 'Hallway', type: 'hallway', icon: 'hall', color: ROOM_COLORS.hallway, width: 10, height: 30 },
  { id: 'breakroom', name: 'Break Room', type: 'breakroom', icon: 'break', color: ROOM_COLORS.breakroom, width: 20, height: 20 },
  { id: 'meeting_room', name: 'Meeting Room', type: 'meeting_room', icon: 'meet', color: ROOM_COLORS.meeting_room, width: 18, height: 20 },
  { id: 'smoke_area', name: 'Smoke Area', type: 'smoke_area', icon: 'smoke', color: ROOM_COLORS.smoke_area, width: 16, height: 20 },
  { id: 'bathroom', name: 'Bathroom', type: 'bathroom', icon: 'wc', color: ROOM_COLORS.bathroom, width: 14, height: 20 },
  { id: 'play_area', name: 'Play Area', type: 'play_area', icon: 'play', color: ROOM_COLORS.play_area, width: 32, height: 20 },
]

const FURNITURE_ITEMS: FurniturePaletteItem[] = [
  { id: 'desk', name: 'Desk', type: 'desk', icon: 'desk', width: 3, height: 2 },
  { id: 'monitor', name: 'Monitor', type: 'monitor', icon: 'mon', width: 1, height: 1 },
  { id: 'chair', name: 'Chair', type: 'chair', icon: 'chr', width: 1, height: 1 },
  { id: 'table', name: 'Table', type: 'table', icon: 'tbl', width: 3, height: 2 },
  { id: 'couch', name: 'Couch', type: 'couch', icon: 'cch', width: 4, height: 2 },
  { id: 'plant', name: 'Plant', type: 'plant', icon: 'plt', width: 1, height: 1 },
  { id: 'bookshelf', name: 'Bookshelf', type: 'bookshelf', icon: 'bks', width: 2, height: 2 },
  { id: 'whiteboard', name: 'Whiteboard', type: 'whiteboard', icon: 'wb', width: 4, height: 2 },
  { id: 'filing_cabinet', name: 'Filing Cabinet', type: 'filing_cabinet', icon: 'fil', width: 1, height: 2 },
  { id: 'server_rack', name: 'Server Rack', type: 'server_rack', icon: 'srv', width: 1, height: 3 },
  { id: 'lamp', name: 'Lamp', type: 'lamp', icon: 'lmp', width: 1, height: 1 },
  { id: 'trash_can', name: 'Trash Can', type: 'trash_can', icon: 'trsh', width: 1, height: 1 },
  { id: 'coffee_machine', name: 'Coffee Machine', type: 'coffee_machine', icon: 'cof', width: 1, height: 1 },
  { id: 'water_cooler', name: 'Water Cooler', type: 'water_cooler', icon: 'wtr', width: 1, height: 1 },
  { id: 'vending_machine', name: 'Vending Machine', type: 'vending_machine', icon: 'vnd', width: 1, height: 2 },
  { id: 'arcade_machine', name: 'Arcade Machine', type: 'arcade_machine', icon: 'arc', width: 1, height: 2 },
  { id: 'toilet', name: 'Toilet', type: 'toilet', icon: 'wc', width: 1, height: 1 },
  { id: 'rug', name: 'Rug', type: 'rug', icon: 'rug', width: 6, height: 4 },
  { id: 'ping_pong', name: 'Ping Pong', type: 'ping_pong', icon: 'pp', width: 6, height: 4 },
  { id: 'meeting_table', name: 'Meeting Table', type: 'meeting_table', icon: 'mtbl', width: 8, height: 4 },
]

const THUMB_SIZE = 48
const SECTION_GAP = 8

type PaletteTab = 'rooms' | 'furniture'

export function RoomPalette({
  onRoomSelect,
  onFurnitureSelect,
  selectedRoomId,
  selectedFurnitureId,
}: RoomPaletteProps) {
  const [activeTab, setActiveTab] = useState<PaletteTab>('rooms')

  return (
    <PixelPanel
      title="Palette"
      width={200}
      style={{ height: '100%', flexShrink: 0 }}
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        marginBottom: SECTION_GAP,
      }}>
        <TabButton
          label="Rooms"
          active={activeTab === 'rooms'}
          onClick={() => setActiveTab('rooms')}
        />
        <TabButton
          label="Furniture"
          active={activeTab === 'furniture'}
          onClick={() => setActiveTab('furniture')}
        />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
      }}>
        {activeTab === 'rooms' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ROOM_ITEMS.map((room) => (
              <RoomThumb
                key={room.id}
                room={room}
                selected={selectedRoomId === room.id}
                onClick={() => onRoomSelect?.(room)}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FURNITURE_ITEMS.map((furn) => (
              <FurnitureThumb
                key={furn.id}
                item={furn}
                selected={selectedFurnitureId === furn.id}
                onClick={() => onFurnitureSelect?.(furn)}
              />
            ))}
          </div>
        )}
      </div>
    </PixelPanel>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        fontFamily: THEME.fontFamily,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        background: active ? THEME.borderAccent + '60' : hovered ? THEME.borderAccent + '30' : 'transparent',
        color: active ? THEME.gold : THEME.textSecondary,
        border: `2px solid ${active ? THEME.borderAccent : THEME.borderPanel}`,
        padding: '4px 6px',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {label}
    </button>
  )
}

function RoomThumb({ room, selected, onClick }: { room: RoomPaletteItem; selected: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawRoomThumbnail(ctx, room)
  }, [room])

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: THUMB_SIZE,
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <div style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        border: `2px solid ${selected ? THEME.gold : hovered ? THEME.borderAccent : THEME.borderPanel}`,
        background: selected ? THEME.gold + '18' : hovered ? THEME.borderAccent + '18' : THEME.bgDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          width={32}
          height={32}
          style={{
            imageRendering: 'pixelated',
            width: 32,
            height: 32,
          }}
        />
        {selected && (
          <div style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 6,
            height: 6,
            background: THEME.gold,
          }} />
        )}
      </div>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 8,
        color: selected ? THEME.gold : THEME.textSecondary,
        marginTop: 2,
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {room.name}
      </div>
    </div>
  )
}

function FurnitureThumb({ item, selected, onClick }: { item: FurniturePaletteItem; selected: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawFurnitureThumbnail(ctx, item)
  }, [item])

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: THUMB_SIZE,
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <div style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        border: `2px solid ${selected ? THEME.gold : hovered ? THEME.borderAccent : THEME.borderPanel}`,
        background: selected ? THEME.gold + '18' : hovered ? THEME.borderAccent + '18' : THEME.bgDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          width={32}
          height={32}
          style={{
            imageRendering: 'pixelated',
            width: 32,
            height: 32,
          }}
        />
        {selected && (
          <div style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 6,
            height: 6,
            background: THEME.gold,
          }} />
        )}
      </div>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 8,
        color: selected ? THEME.gold : THEME.textSecondary,
        marginTop: 2,
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.name}
      </div>
    </div>
  )
}

/** Draw a miniature pixel art room thumbnail on a 32x32 canvas */
function drawRoomThumbnail(ctx: CanvasRenderingContext2D, room: RoomPaletteItem) {
  ctx.clearRect(0, 0, 32, 32)
  ctx.imageSmoothingEnabled = false

  const r = (room.color >> 16) & 0xff
  const g = (room.color >> 8) & 0xff
  const b = room.color & 0xff

  // Floor fill
  for (let y = 4; y < 28; y++) {
    for (let x = 4; x < 28; x++) {
      const noise = ((x * 7 + y * 13) % 17) / 17
      const dr = Math.floor(noise * 12 - 6)
      ctx.fillStyle = `rgb(${clamp(r + dr)},${clamp(g + dr)},${clamp(b + dr)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  // Walls (darker border)
  ctx.fillStyle = `rgb(${clamp(r * 0.5)},${clamp(g * 0.5)},${clamp(b * 0.5)})`
  ctx.fillRect(3, 3, 26, 2)   // top wall
  ctx.fillRect(3, 27, 26, 2)  // bottom wall
  ctx.fillRect(3, 3, 2, 26)   // left wall
  ctx.fillRect(27, 3, 2, 26)  // right wall

  // Wall highlight
  ctx.fillStyle = `rgba(255,255,255,0.15)`
  ctx.fillRect(5, 5, 22, 1)

  // Room type icon (tiny pixel art)
  drawRoomIcon(ctx, room.type)
}

function drawRoomIcon(ctx: CanvasRenderingContext2D, type: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  switch (type) {
    case 'department':
      // Tiny desk + monitor
      ctx.fillRect(10, 16, 12, 4)
      ctx.fillStyle = '#4488cc'
      ctx.fillRect(14, 12, 4, 4)
      ctx.fillStyle = '#1e3a5e'
      ctx.fillRect(15, 13, 2, 2)
      break
    case 'mayor_office':
      // Crown
      ctx.fillStyle = '#ffd700'
      ctx.fillRect(12, 12, 8, 2)
      ctx.fillRect(11, 14, 10, 4)
      ctx.fillRect(12, 10, 2, 2)
      ctx.fillRect(15, 9, 2, 3)
      ctx.fillRect(18, 10, 2, 2)
      break
    case 'hallway':
      // Arrow
      ctx.fillStyle = '#999'
      ctx.fillRect(14, 10, 4, 12)
      ctx.fillRect(12, 12, 8, 2)
      break
    case 'breakroom':
      // Coffee cup
      ctx.fillStyle = '#eee'
      ctx.fillRect(12, 12, 8, 8)
      ctx.fillStyle = '#ddd'
      ctx.fillRect(13, 13, 6, 6)
      ctx.fillStyle = '#6b3a1a'
      ctx.fillRect(14, 14, 4, 4)
      ctx.fillStyle = '#eee'
      ctx.fillRect(20, 14, 2, 4)
      break
    case 'meeting_room':
      // Table
      ctx.fillStyle = '#8b6f47'
      ctx.fillRect(10, 14, 12, 6)
      ctx.fillStyle = '#5a5a7a'
      ctx.fillRect(9, 12, 3, 3)
      ctx.fillRect(20, 12, 3, 3)
      ctx.fillRect(9, 19, 3, 3)
      ctx.fillRect(20, 19, 3, 3)
      break
    case 'smoke_area':
      // Cigarette
      ctx.fillStyle = '#eee'
      ctx.fillRect(10, 15, 10, 3)
      ctx.fillStyle = '#ff6633'
      ctx.fillRect(20, 15, 2, 3)
      ctx.fillStyle = 'rgba(180,180,180,0.5)'
      ctx.fillRect(21, 13, 1, 3)
      ctx.fillRect(22, 11, 1, 3)
      break
    case 'bathroom':
      // Toilet
      ctx.fillStyle = '#eee'
      ctx.fillRect(13, 11, 6, 4)
      ctx.fillRect(12, 15, 8, 6)
      ctx.fillStyle = '#b8d8f0'
      ctx.fillRect(14, 16, 4, 3)
      break
    case 'play_area':
      // Arcade machine
      ctx.fillStyle = '#1a1a4a'
      ctx.fillRect(12, 10, 8, 14)
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(13, 11, 6, 2)
      ctx.fillStyle = '#001a00'
      ctx.fillRect(14, 14, 4, 4)
      ctx.fillStyle = '#00ff88'
      ctx.fillRect(15, 15, 2, 2)
      break
  }
}

/** Draw a miniature pixel art furniture thumbnail on a 32x32 canvas */
function drawFurnitureThumbnail(ctx: CanvasRenderingContext2D, item: FurniturePaletteItem) {
  ctx.clearRect(0, 0, 32, 32)
  ctx.imageSmoothingEnabled = false

  // Background grid hint
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 32, 32)
  for (let y = 0; y < 32; y += 8) {
    for (let x = 0; x < 32; x += 8) {
      if ((x + y) % 16 === 0) {
        ctx.fillStyle = '#1e1e34'
        ctx.fillRect(x, y, 8, 8)
      }
    }
  }

  // Center the furniture drawing
  const scale = Math.min(24 / (item.width * TILE_SIZE), 24 / (item.height * TILE_SIZE))
  const drawW = Math.floor(item.width * TILE_SIZE * scale)
  const drawH = Math.floor(item.height * TILE_SIZE * scale)
  const ox = Math.floor((32 - drawW) / 2)
  const oy = Math.floor((32 - drawH) / 2)

  // Draw simplified furniture icons
  switch (item.type) {
    case 'desk':
      ctx.fillStyle = '#8b6f47'
      ctx.fillRect(ox, oy + 2, drawW, drawH - 4)
      ctx.fillStyle = '#6a5030'
      ctx.fillRect(ox, oy + drawH - 4, drawW, 4)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(ox, oy + 2, drawW, 1)
      break
    case 'monitor':
      ctx.fillStyle = '#1a1a2a'
      ctx.fillRect(ox + 2, oy + 2, drawW - 4, drawH - 6)
      ctx.fillStyle = '#1e3a5e'
      ctx.fillRect(ox + 3, oy + 3, drawW - 6, drawH - 8)
      ctx.fillStyle = '#4488cc'
      ctx.fillRect(ox + 4, oy + 4, 6, 1)
      ctx.fillRect(ox + 4, oy + 6, 4, 1)
      ctx.fillStyle = '#333'
      ctx.fillRect(ox + drawW / 2 - 2, oy + drawH - 4, 4, 4)
      break
    case 'chair':
      ctx.fillStyle = '#5a5a7a'
      ctx.fillRect(ox + 3, oy + 8, drawW - 6, drawH - 10)
      ctx.fillStyle = '#4a4a6a'
      ctx.fillRect(ox + 3, oy + 2, drawW - 6, 7)
      break
    case 'table':
      ctx.fillStyle = '#a08460'
      ctx.fillRect(ox, oy + 2, drawW, drawH - 4)
      ctx.fillStyle = '#7a5f37'
      ctx.fillRect(ox, oy + drawH - 3, drawW, 3)
      break
    case 'couch':
      ctx.fillStyle = '#7a3a5a'
      ctx.fillRect(ox + 2, oy + 4, drawW - 4, drawH - 6)
      ctx.fillStyle = '#8a4a6a'
      ctx.fillRect(ox + 3, oy + 5, drawW - 6, drawH - 8)
      ctx.fillStyle = '#6a2a4a'
      ctx.fillRect(ox, oy + 3, 3, drawH - 4)
      ctx.fillRect(ox + drawW - 3, oy + 3, 3, drawH - 4)
      break
    case 'plant':
      ctx.fillStyle = '#8b4513'
      ctx.fillRect(ox + 6, oy + 18, 12, 8)
      ctx.fillStyle = '#228b22'
      ctx.fillRect(ox + 4, oy + 4, 16, 14)
      ctx.fillStyle = '#32cd32'
      ctx.fillRect(ox + 6, oy + 2, 12, 10)
      break
    case 'bookshelf':
      ctx.fillStyle = '#5a3a20'
      ctx.fillRect(ox, oy, drawW, drawH)
      for (let s = 0; s < 3; s++) {
        const bookColors = ['#8b2252', '#225588', '#228b22', '#cd8500']
        let bx = ox + 1
        for (let bi = 0; bi < 4 && bx < ox + drawW - 2; bi++) {
          ctx.fillStyle = bookColors[bi]
          ctx.fillRect(bx, oy + 1 + s * 9, 3, 8)
          bx += 4
        }
        ctx.fillStyle = '#6b4a30'
        ctx.fillRect(ox, oy + 9 + s * 9, drawW, 1)
      }
      break
    case 'whiteboard':
      ctx.fillStyle = '#888'
      ctx.fillRect(ox, oy + 2, drawW, drawH - 4)
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(ox + 1, oy + 3, drawW - 2, drawH - 6)
      ctx.fillStyle = '#333'
      ctx.fillRect(ox + 3, oy + 6, 8, 1)
      ctx.fillStyle = '#2255cc'
      ctx.fillRect(ox + 3, oy + 9, 6, 1)
      break
    case 'filing_cabinet':
      ctx.fillStyle = '#8a8a8a'
      ctx.fillRect(ox + 2, oy, drawW - 4, drawH)
      ctx.fillStyle = '#999'
      ctx.fillRect(ox + 3, oy + 2, drawW - 6, 10)
      ctx.fillRect(ox + 3, oy + 14, drawW - 6, 10)
      ctx.fillStyle = '#777'
      ctx.fillRect(ox + drawW / 2 - 2, oy + 6, 4, 2)
      ctx.fillRect(ox + drawW / 2 - 2, oy + 18, 4, 2)
      break
    case 'server_rack':
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(ox + 2, oy, drawW - 4, drawH)
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(ox + 4, oy + 3, 1, 1)
      ctx.fillRect(ox + 4, oy + 8, 1, 1)
      ctx.fillRect(ox + 4, oy + 13, 1, 1)
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(ox + 6, oy + 3, 1, 1)
      break
    case 'lamp':
      ctx.fillStyle = '#c8a84e'
      ctx.fillRect(ox + 6, oy + 2, 12, 8)
      ctx.fillStyle = '#555'
      ctx.fillRect(ox + 11, oy + 10, 2, 12)
      ctx.fillStyle = '#3a3a3a'
      ctx.fillRect(ox + 8, oy + 22, 8, 4)
      break
    case 'trash_can':
      ctx.fillStyle = '#555'
      ctx.fillRect(ox + 4, oy + 6, 16, 16)
      ctx.fillStyle = '#666'
      ctx.fillRect(ox + 5, oy + 7, 14, 14)
      ctx.fillStyle = '#5a5a5a'
      ctx.fillRect(ox + 3, oy + 4, 18, 3)
      break
    case 'coffee_machine':
      ctx.fillStyle = '#333'
      ctx.fillRect(ox + 4, oy + 4, 16, 16)
      ctx.fillStyle = '#556'
      ctx.fillRect(ox + 6, oy + 2, 12, 6)
      ctx.fillStyle = '#eee'
      ctx.fillRect(ox + 8, oy + 16, 8, 6)
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(ox + 18, oy + 8, 2, 2)
      break
    case 'water_cooler':
      ctx.fillStyle = '#a0c0e0'
      ctx.fillRect(ox + 6, oy + 2, 12, 10)
      ctx.fillStyle = '#ddd'
      ctx.fillRect(ox + 4, oy + 12, 16, 12)
      ctx.fillStyle = '#4488ff'
      ctx.fillRect(ox + 8, oy + 16, 4, 4)
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(ox + 14, oy + 16, 4, 4)
      break
    case 'vending_machine':
      ctx.fillStyle = '#2a3a6a'
      ctx.fillRect(ox + 2, oy, drawW - 4, drawH)
      ctx.fillStyle = '#354a7a'
      ctx.fillRect(ox + 3, oy + 1, drawW - 6, drawH - 4)
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(ox + 4, oy + 3, drawW - 8, 4)
      ctx.fillStyle = '#44ff44'
      ctx.fillRect(ox + 4, oy + 8, drawW - 8, 4)
      ctx.fillStyle = '#4444ff'
      ctx.fillRect(ox + 4, oy + 13, drawW - 8, 4)
      break
    case 'arcade_machine':
      ctx.fillStyle = '#1a1a4a'
      ctx.fillRect(ox + 2, oy, drawW - 4, drawH)
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(ox + 3, oy + 1, drawW - 6, 4)
      ctx.fillStyle = '#001a00'
      ctx.fillRect(ox + 4, oy + 6, drawW - 8, 10)
      ctx.fillStyle = '#00ff88'
      ctx.fillRect(ox + 6, oy + 8, 4, 4)
      break
    case 'toilet':
      ctx.fillStyle = '#e0e0e0'
      ctx.fillRect(ox + 6, oy + 2, 12, 8)
      ctx.fillStyle = '#eee'
      ctx.fillRect(ox + 4, oy + 10, 16, 12)
      ctx.fillStyle = '#b8d8f0'
      ctx.fillRect(ox + 6, oy + 13, 12, 6)
      break
    case 'rug':
      for (let y = oy + 2; y < oy + drawH - 2; y++) {
        for (let x = ox + 2; x < ox + drawW - 2; x++) {
          const isBorder = x < ox + 4 || x >= ox + drawW - 4 || y < oy + 4 || y >= oy + drawH - 4
          const noise = ((x * 7 + y * 13) % 11) / 11
          if (isBorder) {
            ctx.fillStyle = `rgb(${clamp(100 + noise * 15)},${clamp(40 + noise * 10)},${clamp(40 + noise * 10)})`
          } else {
            ctx.fillStyle = `rgb(${clamp(120 + noise * 10)},${clamp(60 + noise * 8)},${clamp(60 + noise * 8)})`
          }
          ctx.fillRect(x, y, 1, 1)
        }
      }
      break
    case 'ping_pong':
      ctx.fillStyle = '#1a5a2a'
      ctx.fillRect(ox + 1, oy + 2, drawW - 2, drawH - 4)
      ctx.fillStyle = '#2a7a3a'
      ctx.fillRect(ox + 2, oy + 3, drawW - 4, drawH - 6)
      ctx.fillStyle = '#fff'
      ctx.fillRect(ox + drawW / 2 - 1, oy + 2, 2, drawH - 4)
      break
    case 'meeting_table':
      ctx.fillStyle = '#6b4a30'
      ctx.fillRect(ox + 1, oy + 2, drawW - 2, drawH - 4)
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(ox + 2, oy + 3, drawW - 4, 1)
      break
    default:
      ctx.fillStyle = THEME.textMuted
      ctx.fillRect(ox + 4, oy + 4, drawW - 8, drawH - 8)
      break
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
