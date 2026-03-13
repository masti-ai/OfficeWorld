import { RoomConfig, AgentState, Doorway, FurnitureItem } from '../../types'
import { ROOM_COLORS } from '../../constants'
import {
  createDepartmentRoom,
  createMayorOffice,
  createHallwayRoom,
  createBreakroom,
  createMeetingRoom,
  createSmokeArea,
  createBathroom,
  createPlayArea,
} from './RoomTemplates'

export interface ApiAgent {
  name: string
  role: string
  rig: string
  online: boolean
  model: string
  type: 'mayor' | 'deacon' | 'witness' | 'refinery' | 'crew' | 'polecat'
}

export interface LayoutResult {
  rooms: RoomConfig[]
  doorways: Doorway[]
  worldWidth: number
  worldHeight: number
}

// Known rig display info
const RIG_DISPLAY: Record<string, { roomId: string; name: string; color: number }> = {
  villa_ai_planogram: { roomId: 'planogram', name: 'Planogram Dept', color: ROOM_COLORS.planogram },
  villa_alc_ai: { roomId: 'alc_ai', name: 'ALC AI Dept', color: ROOM_COLORS.alc_ai },
  gt_arcade: { roomId: 'arcade_dept', name: 'Arcade Dept', color: ROOM_COLORS.arcade },
}

// Colors for rigs not in the known list
const EXTRA_COLORS = [0xb0a0c0, 0xa0c0b0, 0xc0b0a0, 0xa0a0c0, 0xc0a0a0, 0xa0c0c0, 0xb0b0a0, 0xb0c0b0]

const DEFAULT_RIGS = ['villa_ai_planogram', 'villa_alc_ai', 'gt_arcade']

const DEPT_WIDTH = 30
const HALLWAY_HEIGHT = 8
const DEPT_HEIGHT = 25
const SHARED_HEIGHT = 20

function getRigDisplay(rigName: string, index: number): { roomId: string; name: string; color: number } {
  if (RIG_DISPLAY[rigName]) return RIG_DISPLAY[rigName]
  const shortName = rigName.replace(/^(villa_|gt_)/, '')
  return {
    roomId: shortName,
    name: shortName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' Dept',
    color: EXTRA_COLORS[index % EXTRA_COLORS.length],
  }
}

/** Build a rig name mapping (API name -> internal room ID) */
export function buildRigNameMap(rigs: string[]): Map<string, string> {
  const map = new Map<string, string>()
  rigs.forEach((rig, i) => {
    const info = getRigDisplay(rig, i)
    map.set(rig, info.roomId)
  })
  return map
}

/** Generate the full campus layout from a list of rig names */
export function generateLayout(rigs: string[]): LayoutResult {
  if (rigs.length === 0) rigs = DEFAULT_RIGS

  const rooms: RoomConfig[] = []
  const doorways: Doorway[] = []

  // --- Top row: departments + mayor office ---
  let topX = 0

  // First department
  const firstInfo = getRigDisplay(rigs[0], 0)
  rooms.push(createDepartmentRoom(firstInfo.roomId, firstInfo.name, topX, 0, firstInfo.color))
  topX += DEPT_WIDTH

  // Mayor's office (centered between first and remaining depts)
  rooms.push(createMayorOffice(topX, 0))
  topX += 12 // mayor office width

  // Remaining departments
  for (let i = 1; i < rigs.length; i++) {
    const info = getRigDisplay(rigs[i], i)
    rooms.push(createDepartmentRoom(info.roomId, info.name, topX, 0, info.color))
    topX += DEPT_WIDTH
  }

  // Minimum width to fit shared rooms
  const totalWidth = Math.max(topX, 88)

  // --- Hallway (horizontal spine) ---
  const hallwayY = DEPT_HEIGHT
  rooms.push(createHallwayRoom(0, hallwayY, totalWidth, HALLWAY_HEIGHT))

  // --- Bottom row: shared rooms ---
  const sharedY = hallwayY + HALLWAY_HEIGHT
  const minWidths = [20, 18, 16, 14]
  const minTotal = minWidths.reduce((a, b) => a + b, 0)
  const scale = totalWidth > minTotal + 20 ? totalWidth / (minTotal + 20) : 1

  let sharedX = 0
  const bw = Math.floor(minWidths[0] * scale)
  rooms.push(createBreakroom(sharedX, sharedY, bw))
  sharedX += bw

  const mw = Math.floor(minWidths[1] * scale)
  rooms.push(createMeetingRoom(sharedX, sharedY, mw))
  sharedX += mw

  const sw = Math.floor(minWidths[2] * scale)
  rooms.push(createSmokeArea(sharedX, sharedY, sw))
  sharedX += sw

  const btw = Math.floor(minWidths[3] * scale)
  rooms.push(createBathroom(sharedX, sharedY, btw))
  sharedX += btw

  // Play area fills the remainder
  rooms.push(createPlayArea(sharedX, sharedY, Math.max(totalWidth - sharedX, 20)))

  // --- Doorways ---
  // Connect departments and mayor to hallway
  for (const room of rooms) {
    if (room.type === 'department' || room.type === 'mayor_office') {
      doorways.push({
        x: room.x + Math.floor(room.width / 2),
        y: hallwayY,
        roomA: room.id,
        roomB: 'hallway',
      })
    }
  }

  // Connect shared rooms to hallway
  const sharedTypes = ['breakroom', 'smoke_area', 'bathroom', 'play_area', 'meeting_room']
  const sharedRooms = rooms.filter((r) => sharedTypes.includes(r.type))
  for (const room of sharedRooms) {
    doorways.push({
      x: room.x + Math.floor(room.width / 2),
      y: sharedY,
      roomA: 'hallway',
      roomB: room.id,
    })
  }

  // Connect adjacent shared rooms
  const orderedShared = rooms.filter((r) => sharedTypes.includes(r.type)).sort((a, b) => a.x - b.x)
  for (let i = 0; i < orderedShared.length - 1; i++) {
    const b = orderedShared[i + 1]
    doorways.push({
      x: b.x,
      y: sharedY + Math.floor(SHARED_HEIGHT / 2),
      roomA: orderedShared[i].id,
      roomB: b.id,
    })
  }

  const worldWidth = totalWidth + 4
  const worldHeight = sharedY + SHARED_HEIGHT + 4

  return { rooms, doorways, worldWidth, worldHeight }
}

/** Personal desk item types for world-view placement */
const PERSONAL_ITEM_TYPES: FurnitureItem['type'][] = [
  'desk_figurine', 'desk_photo_frame', 'desk_sticky_notes',
  'desk_energy_drink', 'desk_snack', 'desk_stress_ball', 'coffee_cup',
]

/** Simple string hash for deterministic per-agent randomization */
function nameHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Place 1-3 randomized personal items near an agent's desk position */
function placePersonalItems(
  agentName: string,
  deskX: number,
  deskY: number,
  room: RoomConfig,
): void {
  const h = nameHash(agentName)
  const itemCount = 1 + (h % 3) // 1-3 items per agent

  // Candidate offsets relative to the desk position (adjacent tiles)
  const offsets = [
    { dx: -1, dy: 0 },
    { dx: 2, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
  ]

  const placed = new Set<string>()
  for (let i = 0; i < itemCount && i < offsets.length; i++) {
    const off = offsets[(h >> (3 + i * 4)) % offsets.length]
    const ix = deskX + off.dx
    const iy = deskY + off.dy

    const posKey = `${ix},${iy}`
    if (placed.has(posKey)) continue

    // Check within room bounds
    if (ix < room.x + 1 || ix >= room.x + room.width - 1) continue
    if (iy < room.y + 2 || iy >= room.y + room.height - 1) continue

    // Check no existing furniture at this position
    const occupied = room.furniture.some(
      (f) => ix >= f.x && ix < f.x + f.width && iy >= f.y && iy < f.y + f.height,
    )
    if (occupied) continue

    const itemType = PERSONAL_ITEM_TYPES[(h >> (6 + i * 5)) % PERSONAL_ITEM_TYPES.length]
    room.furniture.push({ type: itemType, x: ix, y: iy, width: 1, height: 1 })
    placed.add(posKey)
  }
}

/** Generate AgentState[] from parsed API agents and generated rooms */
export function generateAgents(apiAgents: ApiAgent[], rooms: RoomConfig[], rigNameMap: Map<string, string>): AgentState[] {
  const agents: AgentState[] = []
  const deskCounters = new Map<string, number>()

  for (const agent of apiAgents) {
    let roomId: string
    let rigInternal: string

    if (agent.type === 'mayor') {
      roomId = 'mayor_office'
      rigInternal = 'mayor'
    } else if (agent.type === 'deacon') {
      roomId = 'hallway'
      rigInternal = 'deacon'
    } else {
      roomId = rigNameMap.get(agent.rig) ?? agent.rig.replace(/^(villa_|gt_)/, '')
      rigInternal = roomId
    }

    const room = rooms.find((r) => r.id === roomId)
    if (!room) continue

    const deskIdx = deskCounters.get(roomId) ?? 0
    deskCounters.set(roomId, deskIdx + 1)

    let position: { x: number; y: number }
    if (room.deskPositions.length > 0) {
      position = { ...room.deskPositions[deskIdx % room.deskPositions.length] }
    } else {
      position = {
        x: room.x + 3 + Math.floor(Math.random() * Math.max(1, room.width - 6)),
        y: room.y + 3 + Math.floor(Math.random() * Math.max(1, room.height - 6)),
      }
    }

    // Place personal desk items near this agent's desk
    if (room.type === 'department' || room.type === 'mayor_office') {
      placePersonalItems(agent.name, position.x, position.y, room)
    }

    const role =
      agent.type === 'crew' || agent.type === 'polecat'
        ? 'worker'
        : agent.type

    // Assign initial activity based on agent type
    const activities = ['typing', 'bash', 'reading'] as const
    const activityIdx = agents.length % activities.length
    const activity = agent.online ? activities[activityIdx] : 'none' as const

    agents.push({
      id: `${rigInternal}-${agent.name}`,
      name: agent.name,
      role,
      rig: rigInternal,
      status: agent.online ? 'working' : 'idle',
      activity,
      position,
      currentRoom: roomId,
    })
  }

  return agents
}
