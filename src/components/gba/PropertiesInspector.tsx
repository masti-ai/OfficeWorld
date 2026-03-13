import { useState } from 'react'
import { THEME, FLOOR_STYLES } from '../../constants'
import { RoomConfig, FurnitureItem } from '../../types'
import { PixelPanel } from './PixelPanel'

export interface PropertiesInspectorProps {
  selectedRoom?: RoomConfig | null
  onFloorStyleChange?: (roomId: string, style: 'wood' | 'carpet' | 'tile' | 'concrete' | 'grass') => void
  onWallColorChange?: (roomId: string, color: number) => void
  onFurnitureRemove?: (roomId: string, furnitureIndex: number) => void
  onRoomRename?: (roomId: string, name: string) => void
}

const FLOOR_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: 'wood', label: 'Wood', color: '#8b6f47' },
  { id: 'carpet', label: 'Carpet', color: '#6a5a8a' },
  { id: 'tile', label: 'Tile', color: '#90a8b0' },
  { id: 'concrete', label: 'Concrete', color: '#808078' },
  { id: 'grass', label: 'Grass', color: '#4a8a4a' },
]

const WALL_COLORS: { label: string; value: number }[] = [
  { label: 'Beige', value: 0xc4b090 },
  { label: 'Sage', value: 0x90b898 },
  { label: 'Lavender', value: 0xb0a0c0 },
  { label: 'Wood', value: 0xa08060 },
  { label: 'Gray', value: 0x9a9080 },
  { label: 'Cream', value: 0xc8b880 },
  { label: 'Blue', value: 0x90a8b0 },
  { label: 'Warm', value: 0xb89878 },
]

const FURNITURE_ICONS: Record<string, string> = {
  desk: 'D',
  monitor: 'M',
  plant: 'P',
  chair: 'C',
  table: 'T',
  couch: 'S',
  bookshelf: 'B',
  whiteboard: 'W',
  filing_cabinet: 'F',
  server_rack: 'R',
  lamp: 'L',
  trash_can: 'X',
  coffee_machine: 'K',
  water_cooler: 'H',
  vending_machine: 'V',
  arcade_machine: 'A',
  toilet: 'Q',
  rug: 'U',
  ping_pong: 'G',
  meeting_table: 'E',
  projector_screen: 'J',
  ashtray: 'Y',
}

export function PropertiesInspector({
  selectedRoom,
  onFloorStyleChange,
  onWallColorChange,
  onFurnitureRemove,
  onRoomRename,
}: PropertiesInspectorProps) {
  return (
    <PixelPanel
      title="Inspector"
      width={200}
      style={{ height: '100%', flexShrink: 0 }}
    >
      {selectedRoom ? (
        <RoomProperties
          room={selectedRoom}
          onFloorStyleChange={onFloorStyleChange}
          onWallColorChange={onWallColorChange}
          onFurnitureRemove={onFurnitureRemove}
          onRoomRename={onRoomRename}
        />
      ) : (
        <EmptyState />
      )}
    </PixelPanel>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 8,
      padding: 16,
    }}>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 20,
        color: THEME.textMuted,
      }}>
        {'{ }'}
      </div>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 10,
        color: THEME.textMuted,
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        Select a room to inspect its properties
      </div>
    </div>
  )
}

function RoomProperties({
  room,
  onFloorStyleChange,
  onWallColorChange,
  onFurnitureRemove,
  onRoomRename,
}: {
  room: RoomConfig
  onFloorStyleChange?: PropertiesInspectorProps['onFloorStyleChange']
  onWallColorChange?: PropertiesInspectorProps['onWallColorChange']
  onFurnitureRemove?: PropertiesInspectorProps['onFurnitureRemove']
  onRoomRename?: PropertiesInspectorProps['onRoomRename']
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(room.name)

  const floorStyle = room.floorStyle || FLOOR_STYLES[room.id] || 'carpet'
  const furnitureCounts = countFurniture(room.furniture)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto',
      minHeight: 0,
      flex: 1,
    }}>
      {/* Room name */}
      <Section label="Name">
        {editingName ? (
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={() => {
              setEditingName(false)
              if (nameValue !== room.name) onRoomRename?.(room.id, nameValue)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingName(false)
                if (nameValue !== room.name) onRoomRename?.(room.id, nameValue)
              }
              if (e.key === 'Escape') {
                setEditingName(false)
                setNameValue(room.name)
              }
            }}
            autoFocus
            style={{
              fontFamily: THEME.fontFamily,
              fontSize: 11,
              color: THEME.textBright,
              background: THEME.bgDark,
              border: `1px solid ${THEME.borderAccent}`,
              padding: '2px 4px',
              width: '100%',
              outline: 'none',
            }}
          />
        ) : (
          <div
            onClick={() => { setNameValue(room.name); setEditingName(true) }}
            style={{
              fontFamily: THEME.fontFamily,
              fontSize: 11,
              color: THEME.textBright,
              cursor: 'pointer',
              padding: '2px 4px',
              border: `1px solid transparent`,
            }}
          >
            {room.name}
            <span style={{ color: THEME.textMuted, fontSize: 9, marginLeft: 4 }}>edit</span>
          </div>
        )}
      </Section>

      {/* Room type + dimensions */}
      <Section label="Info">
        <InfoRow label="Type" value={room.type} />
        <InfoRow label="Size" value={`${room.width}x${room.height}`} />
        <InfoRow label="Position" value={`${room.x}, ${room.y}`} />
        <InfoRow label="Desks" value={`${room.deskPositions.length}`} />
      </Section>

      {/* Floor style */}
      <Section label="Floor">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {FLOOR_OPTIONS.map((opt) => (
            <FloorChip
              key={opt.id}
              label={opt.label}
              color={opt.color}
              active={floorStyle === opt.id}
              onClick={() => onFloorStyleChange?.(room.id, opt.id as any)}
            />
          ))}
        </div>
      </Section>

      {/* Wall color */}
      <Section label="Wall Color">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {WALL_COLORS.map((wc) => {
            const r = (wc.value >> 16) & 0xff
            const g = (wc.value >> 8) & 0xff
            const b = wc.value & 0xff
            const active = wc.value === room.color
            return (
              <ColorSwatch
                key={wc.label}
                color={`rgb(${r},${g},${b})`}
                label={wc.label}
                active={active}
                onClick={() => onWallColorChange?.(room.id, wc.value)}
              />
            )
          })}
        </div>
      </Section>

      {/* Furniture list */}
      <Section label={`Furniture (${room.furniture.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {furnitureCounts.map(({ type, count }) => (
            <FurnitureRow
              key={type}
              type={type}
              count={count}
              onRemove={() => {
                const idx = room.furniture.findIndex((f) => f.type === type)
                if (idx >= 0) onFurnitureRemove?.(room.id, idx)
              }}
            />
          ))}
          {room.furniture.length === 0 && (
            <div style={{
              fontFamily: THEME.fontFamily,
              fontSize: 9,
              color: THEME.textMuted,
              fontStyle: 'italic',
            }}>
              No furniture placed
            </div>
          )}
        </div>
      </Section>

      {/* Decorations */}
      {room.decorations && room.decorations.length > 0 && (
        <Section label={`Decor (${room.decorations.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {room.decorations.map((dec, i) => (
              <span key={i} style={{
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                color: THEME.textSecondary,
                background: THEME.bgDark,
                padding: '1px 4px',
                border: `1px solid ${THEME.borderPanel}`,
              }}>
                {dec.type}{dec.label ? `: ${dec.label}` : ''}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 9,
        fontWeight: 'bold',
        color: THEME.goldDim,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 3,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: THEME.fontFamily,
      fontSize: 10,
      lineHeight: 1.6,
    }}>
      <span style={{ color: THEME.textSecondary }}>{label}</span>
      <span style={{ color: THEME.textPrimary }}>{value}</span>
    </div>
  )
}

function FloorChip({ label, color, active, onClick }: {
  label: string; color: string; active: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: THEME.fontFamily,
        fontSize: 9,
        color: active ? THEME.textBright : THEME.textSecondary,
        background: active ? THEME.borderAccent + '40' : hovered ? THEME.borderAccent + '20' : 'transparent',
        border: `1px solid ${active ? THEME.borderAccent : THEME.borderPanel}`,
        padding: '2px 5px',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <span style={{
        width: 8,
        height: 8,
        background: color,
        display: 'inline-block',
        border: `1px solid ${active ? THEME.textBright : THEME.borderPanel}`,
      }} />
      {label}
    </button>
  )
}

function ColorSwatch({ color, label, active, onClick }: {
  color: string; label: string; active: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        width: 18,
        height: 18,
        background: color,
        border: `2px solid ${active ? THEME.gold : hovered ? THEME.borderAccent : THEME.borderPanel}`,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          inset: 2,
          border: `1px solid ${THEME.bgDark}`,
        }} />
      )}
    </div>
  )
}

function FurnitureRow({ type, count, onRemove }: {
  type: string; count: number; onRemove: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const icon = FURNITURE_ICONS[type] || '?'
  const displayName = type.replace(/_/g, ' ')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: THEME.fontFamily,
        fontSize: 10,
        padding: '1px 2px',
        background: hovered ? THEME.borderAccent + '15' : 'transparent',
      }}
    >
      <span style={{
        width: 14,
        height: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: THEME.bgDark,
        border: `1px solid ${THEME.borderPanel}`,
        color: THEME.textSecondary,
        fontSize: 8,
        fontWeight: 'bold',
      }}>
        {icon}
      </span>
      <span style={{ color: THEME.textPrimary, flex: 1 }}>{displayName}</span>
      <span style={{ color: THEME.textMuted, fontSize: 9 }}>x{count}</span>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            fontFamily: THEME.fontFamily,
            fontSize: 8,
            color: THEME.red,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
          }}
        >
          -
        </button>
      )}
    </div>
  )
}

function countFurniture(furniture: FurnitureItem[]): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const f of furniture) {
    counts.set(f.type, (counts.get(f.type) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}
