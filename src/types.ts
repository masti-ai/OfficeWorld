import { HAT_STYLES, HAIR_STYLES, FACE_STYLES } from './constants'

export type AgentActivity = 'typing' | 'reading' | 'bash' | 'waiting' | 'permission-needed' | 'none'

export interface AgentHookBead {
  id: string
  title: string
  status: string
}

export interface AgentState {
  id: string
  name: string
  role: string
  rig: string
  status: 'working' | 'idle' | 'walking' | 'smoking' | 'eating' | 'bathroom' | 'playing' | 'meeting' | 'offline'
  activity: AgentActivity
  position: { x: number; y: number }
  targetPosition?: { x: number; y: number }
  currentRoom: string
  task?: string
  hookBead?: AgentHookBead
}

export interface RoomConfig {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  type: 'department' | 'hallway' | 'breakroom' | 'smoke_area' | 'bathroom' | 'play_area' | 'meeting_room' | 'mayor_office' | 'polecat_yard'
  color: number
  floorStyle?: 'wood' | 'carpet' | 'tile' | 'concrete' | 'grass'
  furniture: FurnitureItem[]
  deskPositions: { x: number; y: number }[]
  decorations?: DecorationItem[]
}

export interface Doorway {
  x: number
  y: number
  roomA: string
  roomB: string
}

export interface FurnitureItem {
  type:
    | 'desk'
    | 'monitor'
    | 'plant'
    | 'toilet'
    | 'arcade_machine'
    | 'vending_machine'
    | 'table'
    | 'chair'
    | 'couch'
    | 'ashtray'
    | 'ping_pong'
    | 'whiteboard'
    | 'bookshelf'
    | 'coffee_machine'
    | 'water_cooler'
    | 'trash_can'
    | 'projector_screen'
    | 'meeting_table'
    | 'server_rack'
    | 'filing_cabinet'
    | 'rug'
    | 'lamp'
    | 'coat_rack'
    | 'coffee_cup'
    | 'desk_figurine'
    | 'desk_photo_frame'
    | 'desk_sticky_notes'
    | 'desk_energy_drink'
    | 'desk_snack'
    | 'desk_stress_ball'
    | 'led_strip'
    | 'pc_tower'
    | 'headphone_stand'
    | 'desk_lamp'
    | 'cable_management'
    | 'gaming_chair'
    | 'dual_monitor'
    | 'triple_monitor'
  x: number
  y: number
  width: number
  height: number
}

export interface DecorationItem {
  type: 'poster' | 'clock' | 'window' | 'sign' | 'painting' | 'board' | 'wall_shelf' | 'string_lights' | 'ceiling_light' | 'neon_sign'
  x: number
  y: number
  label?: string
  color?: string
}

export interface AgentVisualTraits {
  skinTone: number
  hairColor: number
  hairStyle: number
  outfitColor: number
  hatStyle?: typeof HAT_STYLES[number]
  faceStyle?: typeof FACE_STYLES[number]
  accessoryColor?: number
}

export interface CharacterCustomization {
  hatStyle: typeof HAT_STYLES[number]
  hairStyle: typeof HAIR_STYLES[number]
  faceStyle: typeof FACE_STYLES[number]
  skinTone: number
  hairColor: number
  outfitColor: number
  accessoryColor: number
}

export interface TileData {
  walkable: boolean
  roomId: string | null
  furnitureType: string | null
}

export interface Bead {
  id: string
  x: number
  y: number
  roomId: string
  age: number
  type: 'cigarette_butt' | 'coffee_cup' | 'paper'
}

export type PolecatLifecycle = 'idle' | 'slung' | 'working' | 'done' | 'blocked'
export type PolecatIdleActivity = 'roaming' | 'smoking' | 'coffee' | 'hoops' | 'napping' | 'chatting'

export interface PolecatState {
  id: string
  name: string
  position: { x: number; y: number }
  status: PolecatLifecycle
  idleActivity: PolecatIdleActivity
  assignedDesk: { x: number; y: number } | null
  yardSpot: { x: number; y: number }
  path: { x: number; y: number }[]
  pathIndex: number
  stateTimer: number
  activityTimer: number
  celebratePhase: number // 0=push-back, 1=fist-pump, 2=walk-to-yard, 3=high-five
  blockedPaceDir: number // 1 or -1 for pacing direction
}

export interface GameSaveState {
  version: number
  timestamp: number
  agents: Array<{
    id: string
    position: { x: number; y: number }
    status: AgentState['status']
    activity: AgentActivity
    currentRoom: string
  }>
  rooms: RoomConfig[]
  preferences: Record<string, unknown>
}
