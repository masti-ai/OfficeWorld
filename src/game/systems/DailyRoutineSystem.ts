import Phaser from 'phaser'
import { AgentState, RoomConfig, TileData } from '../../types'
import { CharacterSprite } from '../sprites/CharacterSprite'
import { findPath } from '../world/Pathfinding'
import { ThoughtBubbleSystem, BubbleIcon } from './ThoughtBubbleSystem'

/**
 * Daily routine system: ties agent behavior to day/night cycle phases.
 *
 *   Morning coffee  (6:00 – 8:30)  → agents walk to breakroom, coffee bubble
 *   Lunch break     (11:30 – 13:00) → agents walk to breakroom, eating status
 *   Evening wind-down (16:30 – 18:00) → agents visit hallway/play area, relax
 *
 * Each agent can only do one routine per time window (tracked via cooldowns).
 * Routines are staggered randomly so agents don't all move at once.
 */

type RoutineType = 'morning_coffee' | 'lunch' | 'evening_winddown'

interface RoutineWindow {
  type: RoutineType
  startHour: number
  endHour: number
  chance: number // per-check probability an eligible agent starts this routine
  destinations: string[] // room IDs to walk to
  duration: number // ms to stay at destination
  statusOverride: AgentState['status']
  bubbleIcon: BubbleIcon
}

const ROUTINE_WINDOWS: RoutineWindow[] = [
  {
    type: 'morning_coffee',
    startHour: 6,
    endHour: 8.5,
    chance: 0.15,
    destinations: ['breakroom'],
    duration: 12000,
    statusOverride: 'eating',
    bubbleIcon: 'coffee',
  },
  {
    type: 'lunch',
    startHour: 11.5,
    endHour: 13,
    chance: 0.2,
    destinations: ['breakroom'],
    duration: 18000,
    statusOverride: 'eating',
    bubbleIcon: 'coffee',
  },
  {
    type: 'evening_winddown',
    startHour: 16.5,
    endHour: 18,
    chance: 0.12,
    destinations: ['hallway', 'play_area'],
    duration: 14000,
    statusOverride: 'playing',
    bubbleIcon: 'music',
  },
]

// How often to check for new routine triggers (ms)
const CHECK_INTERVAL = 3000

// Max agents doing a routine at the same time
const MAX_CONCURRENT_ROUTINES = 4

interface ActiveRoutine {
  agentId: string
  type: RoutineType
  startTime: number
  duration: number
  phase: 'walking' | 'active'
  returnRoom: string
  returnDesk: { x: number; y: number } | null
}

export class DailyRoutineSystem {
  private agentStates: Map<string, AgentState>
  private characters: Map<string, CharacterSprite>
  private paths: Map<string, { x: number; y: number }[]>
  private pathIndices: Map<string, number>
  private grid: TileData[][]
  private rooms: RoomConfig[]
  private thoughtBubbles: ThoughtBubbleSystem

  private activeRoutines = new Map<string, ActiveRoutine>()
  // Track which routines each agent has done today (reset when day rolls over)
  private completedToday = new Map<string, Set<RoutineType>>()
  private lastGameDay = -1
  private checkTimer = 0
  private currentHour = 12

  constructor(
    _scene: Phaser.Scene,
    agentStates: Map<string, AgentState>,
    characters: Map<string, CharacterSprite>,
    paths: Map<string, { x: number; y: number }[]>,
    pathIndices: Map<string, number>,
    grid: TileData[][],
    rooms: RoomConfig[],
    thoughtBubbles: ThoughtBubbleSystem,
  ) {
    this.agentStates = agentStates
    this.characters = characters
    this.paths = paths
    this.pathIndices = pathIndices
    this.grid = grid
    this.rooms = rooms
    this.thoughtBubbles = thoughtBubbles
  }

  /** Call from ArcadeScene.update with current game hour from DayNightSystem */
  update(delta: number, gameHour: number) {
    this.currentHour = gameHour

    // Reset daily tracking when a new day starts (hour crosses midnight)
    const gameDay = Math.floor(gameHour / 24)
    if (gameDay !== this.lastGameDay) {
      this.lastGameDay = gameDay
      this.completedToday.clear()
    }

    // Check for new routine triggers
    this.checkTimer += delta
    if (this.checkTimer >= CHECK_INTERVAL) {
      this.checkTimer = 0
      this.tryTriggerRoutines()
    }

    // Update active routines
    const now = Date.now()
    for (const [agentId, routine] of this.activeRoutines) {
      this.updateRoutine(agentId, routine, now)
    }
  }

  /** Check if an agent is in a daily routine */
  isInRoutine(agentId: string): boolean {
    return this.activeRoutines.has(agentId)
  }

  private tryTriggerRoutines() {
    if (this.activeRoutines.size >= MAX_CONCURRENT_ROUTINES) return

    for (const window of ROUTINE_WINDOWS) {
      if (this.currentHour < window.startHour || this.currentHour >= window.endHour) continue
      this.tryTriggerWindow(window)
    }
  }

  private tryTriggerWindow(window: RoutineWindow) {
    for (const [id, state] of this.agentStates) {
      if (this.activeRoutines.size >= MAX_CONCURRENT_ROUTINES) return
      if (state.status !== 'working') continue
      if (this.activeRoutines.has(id)) continue

      // Check if already done this routine today
      const done = this.completedToday.get(id)
      if (done?.has(window.type)) continue

      // Random chance per check
      if (Math.random() > window.chance) continue

      this.startRoutine(id, state, window)
    }
  }

  private startRoutine(agentId: string, state: AgentState, window: RoutineWindow) {
    // Pick a random destination room
    const destRoomId = window.destinations[Math.floor(Math.random() * window.destinations.length)]
    const room = this.rooms.find(r => r.id === destRoomId)
    if (!room) return

    // Find a walkable spot in the room
    const targetX = room.x + 3 + Math.floor(Math.random() * Math.max(1, room.width - 6))
    const targetY = room.y + 3 + Math.floor(Math.random() * Math.max(1, room.height - 6))
    if (!this.grid[targetY]?.[targetX]?.walkable) return

    const path = findPath(state.position, { x: targetX, y: targetY }, this.grid)
    if (path.length === 0) return

    // Remember where agent came from
    const returnDesk = this.findAgentDesk(agentId, state)

    const routine: ActiveRoutine = {
      agentId,
      type: window.type,
      startTime: Date.now(),
      duration: window.duration + Math.random() * 5000,
      phase: 'walking',
      returnRoom: state.currentRoom,
      returnDesk,
    }

    this.activeRoutines.set(agentId, routine)

    // Start pathfinding
    this.paths.set(agentId, path)
    this.pathIndices.set(agentId, 0)
    state.status = 'walking'
    state.targetPosition = { x: targetX, y: targetY }
    this.characters.get(agentId)?.updateStatus('walking')

    // Flash thought bubble to show intent
    this.thoughtBubbles.flashIcon(agentId, window.bubbleIcon, 2500)

    // Mark as completed for today
    if (!this.completedToday.has(agentId)) {
      this.completedToday.set(agentId, new Set())
    }
    this.completedToday.get(agentId)!.add(window.type)
  }

  private updateRoutine(agentId: string, routine: ActiveRoutine, now: number) {
    const state = this.agentStates.get(agentId)
    if (!state) {
      this.activeRoutines.delete(agentId)
      return
    }

    if (routine.phase === 'walking') {
      // Check if agent has arrived (no longer walking)
      if (state.status !== 'walking') {
        routine.phase = 'active'
        routine.startTime = now

        // Apply the routine's status
        const window = ROUTINE_WINDOWS.find(w => w.type === routine.type)!
        state.status = window.statusOverride
        this.characters.get(agentId)?.updateStatus(state.status)

        // Show bubble icon while in routine
        this.thoughtBubbles.flashIcon(agentId, window.bubbleIcon, routine.duration)
      }
      // Timeout: if walking too long, cancel
      if (now - routine.startTime > 15000) {
        this.endRoutine(agentId, routine)
      }
      return
    }

    // Active phase: check if duration elapsed
    if (now - routine.startTime >= routine.duration) {
      this.endRoutine(agentId, routine)
    }
  }

  private endRoutine(agentId: string, routine: ActiveRoutine) {
    const state = this.agentStates.get(agentId)
    this.activeRoutines.delete(agentId)
    if (!state) return

    // Send agent back to desk
    if (routine.returnDesk) {
      const path = findPath(state.position, routine.returnDesk, this.grid)
      if (path.length > 0) {
        this.paths.set(agentId, path)
        this.pathIndices.set(agentId, 0)
        state.status = 'walking'
        state.targetPosition = routine.returnDesk
        this.characters.get(agentId)?.updateStatus('walking')
        return
      }
    }

    // Fallback: just go back to working
    state.status = 'working'
    this.characters.get(agentId)?.updateStatus('working')
  }

  private findAgentDesk(agentId: string, state: AgentState): { x: number; y: number } | null {
    const deskRoom = this.rooms.find(r => r.id === state.currentRoom)
    if (!deskRoom || deskRoom.deskPositions.length === 0) return null

    const allAgentIds = Array.from(this.agentStates.keys())
    const agentIdx = allAgentIds.indexOf(agentId)
    return deskRoom.deskPositions[agentIdx % deskRoom.deskPositions.length] ?? null
  }

  getActiveRoutineCount(): number {
    return this.activeRoutines.size
  }

  /** Get the current routine type for an agent, or null */
  getRoutineType(agentId: string): RoutineType | null {
    return this.activeRoutines.get(agentId)?.type ?? null
  }

  destroy() {
    this.activeRoutines.clear()
    this.completedToday.clear()
  }
}
