import Phaser from 'phaser'
import { AgentState, RoomConfig, TileData } from '../../types'
import { TILE_SIZE } from '../../constants'
import { findPath } from '../world/Pathfinding'
import { CharacterSprite } from '../sprites/CharacterSprite'

export type SocialType = 'water_cooler' | 'hallway_greeting' | 'pair_programming' | 'meeting' | 'lunch_break'

interface SocialInteraction {
  id: string
  type: SocialType
  agents: string[]
  location: { x: number; y: number }
  startTime: number
  duration: number
  phase: 'gathering' | 'active' | 'dispersing'
  emoteTimer: number
}

// How often to check for new social opportunities (ms)
const SOCIAL_CHECK_INTERVAL = 5000
// Cooldown per agent after a social interaction ends (ms)
const AGENT_COOLDOWN = 20000

// Duration ranges per social type (ms)
const SOCIAL_DURATIONS: Record<SocialType, { min: number; max: number }> = {
  water_cooler: { min: 8000, max: 15000 },
  hallway_greeting: { min: 2000, max: 4000 },
  pair_programming: { min: 15000, max: 30000 },
  meeting: { min: 12000, max: 25000 },
  lunch_break: { min: 10000, max: 20000 },
}

// Max simultaneous social interactions
const MAX_ACTIVE_SOCIALS = 3

// Emote display interval during active interactions (ms)
const EMOTE_INTERVAL = 3000

export class SocialSystem {
  private scene: Phaser.Scene
  private activeSocials = new Map<string, SocialInteraction>()
  private agentCooldowns = new Map<string, number>()
  private checkTimer = 0
  private socialCounter = 0

  // References injected from ArcadeScene
  private agentStates: Map<string, AgentState>
  private characters: Map<string, CharacterSprite>
  private paths: Map<string, { x: number; y: number }[]>
  private pathIndices: Map<string, number>
  private grid: TileData[][]
  private rooms: RoomConfig[]

  // Chat bubble graphics
  private chatBubbles = new Map<string, Phaser.GameObjects.Container>()

  constructor(
    scene: Phaser.Scene,
    agentStates: Map<string, AgentState>,
    characters: Map<string, CharacterSprite>,
    paths: Map<string, { x: number; y: number }[]>,
    pathIndices: Map<string, number>,
    grid: TileData[][],
    rooms: RoomConfig[],
  ) {
    this.scene = scene
    this.agentStates = agentStates
    this.characters = characters
    this.paths = paths
    this.pathIndices = pathIndices
    this.grid = grid
    this.rooms = rooms
  }

  update(delta: number) {
    this.checkTimer += delta
    const now = Date.now()

    // Periodically try to start new social interactions
    if (this.checkTimer >= SOCIAL_CHECK_INTERVAL) {
      this.checkTimer = 0
      if (this.activeSocials.size < MAX_ACTIVE_SOCIALS) {
        this.tryStartSocial(now)
      }
    }

    // Update active interactions
    for (const [id, social] of this.activeSocials) {
      this.updateSocial(id, social, now, delta)
    }
  }

  /** Check if an agent is currently in a social interaction */
  isInSocial(agentId: string): boolean {
    for (const social of this.activeSocials.values()) {
      if (social.agents.includes(agentId)) return true
    }
    return false
  }

  private tryStartSocial(now: number) {
    // Pick a random social type to attempt
    const roll = Math.random()
    if (roll < 0.25) {
      this.tryWaterCoolerChat(now)
    } else if (roll < 0.45) {
      this.tryHallwayGreeting(now)
    } else if (roll < 0.65) {
      this.tryPairProgramming(now)
    } else if (roll < 0.85) {
      this.tryMeetingGathering(now)
    } else {
      this.tryLunchBreak(now)
    }
  }

  private getAvailableAgents(): AgentState[] {
    const now = Date.now()
    const available: AgentState[] = []
    for (const [id, state] of this.agentStates) {
      if (state.status === 'offline') continue
      if (state.status === 'walking') continue
      if (state.status === 'bathroom') continue
      if (this.isInSocial(id)) continue
      const cooldown = this.agentCooldowns.get(id)
      if (cooldown && now < cooldown) continue
      available.push(state)
    }
    return available
  }

  private tryWaterCoolerChat(now: number) {
    const available = this.getAvailableAgents().filter(a => a.status === 'working')
    if (available.length < 2) return

    // Pick 2-3 random agents
    const shuffled = available.sort(() => Math.random() - 0.5)
    const count = Math.min(shuffled.length, Math.random() < 0.5 ? 2 : 3)
    const agents = shuffled.slice(0, count)

    // Find water cooler position in hallway
    const hallway = this.rooms.find(r => r.id === 'hallway')
    const cooler = hallway?.furniture.find(f => f.type === 'water_cooler')
    if (!cooler) return

    // Gather positions near the water cooler
    const gatherSpots = [
      { x: cooler.x + 1, y: cooler.y },
      { x: cooler.x + 2, y: cooler.y },
      { x: cooler.x + 1, y: cooler.y + 1 },
    ]

    this.startSocial('water_cooler', agents, gatherSpots, now)
  }

  private tryHallwayGreeting(now: number) {
    // Find agents currently in or near the hallway
    const hallway = this.rooms.find(r => r.id === 'hallway')
    if (!hallway) return

    const hallwayAgents = this.getAvailableAgents().filter(a => {
      const roomId = this.grid[a.position.y]?.[a.position.x]?.roomId
      return roomId === 'hallway'
    })

    if (hallwayAgents.length < 2) {
      // Also check for walking agents passing through
      const walkingInHallway: AgentState[] = []
      for (const [id, state] of this.agentStates) {
        if (state.status !== 'walking') continue
        if (this.isInSocial(id)) continue
        const roomId = this.grid[state.position.y]?.[state.position.x]?.roomId
        if (roomId === 'hallway') walkingInHallway.push(state)
      }

      if (walkingInHallway.length >= 2) {
        // Brief greeting between passing agents - no pathfinding needed
        const pair = walkingInHallway.slice(0, 2)
        const mid = {
          x: Math.round((pair[0].position.x + pair[1].position.x) / 2),
          y: Math.round((pair[0].position.y + pair[1].position.y) / 2),
        }
        this.startGreeting(pair, mid, now)
        return
      }
      return
    }

    const pair = hallwayAgents.sort(() => Math.random() - 0.5).slice(0, 2)
    const mid = {
      x: Math.round((pair[0].position.x + pair[1].position.x) / 2),
      y: Math.round((pair[0].position.y + pair[1].position.y) / 2),
    }
    this.startGreeting(pair, mid, now)
  }

  private startGreeting(agents: AgentState[], location: { x: number; y: number }, now: number) {
    const socialId = `social_${this.socialCounter++}`
    const duration = SOCIAL_DURATIONS.hallway_greeting.min +
      Math.random() * (SOCIAL_DURATIONS.hallway_greeting.max - SOCIAL_DURATIONS.hallway_greeting.min)

    const social: SocialInteraction = {
      id: socialId,
      type: 'hallway_greeting',
      agents: agents.map(a => a.id),
      location,
      startTime: now,
      duration,
      phase: 'active', // Greetings skip gathering phase
      emoteTimer: 0,
    }
    this.activeSocials.set(socialId, social)

    // Show emotes immediately
    for (const agent of agents) {
      const char = this.characters.get(agent.id)
      char?.showEmote(Math.random() < 0.5 ? 'exclamation' : 'thought')
    }
    this.showChatBubble(socialId, location)
  }

  private tryPairProgramming(now: number) {
    // Find two working agents in the same department
    const departments = this.rooms.filter(r => r.type === 'department')
    for (const dept of departments) {
      const agents = this.getAvailableAgents().filter(a => {
        const roomId = this.grid[a.position.y]?.[a.position.x]?.roomId
        return roomId === dept.id && a.status === 'working'
      })
      if (agents.length < 2) continue

      const pair = agents.sort(() => Math.random() - 0.5).slice(0, 2)
      // Both go to the first agent's desk position
      const targetPos = pair[0].position
      const gatherSpots = [
        { x: targetPos.x, y: targetPos.y },
        { x: targetPos.x + 1, y: targetPos.y },
      ]

      this.startSocial('pair_programming', pair, gatherSpots, now)
      return
    }
  }

  private tryMeetingGathering(now: number) {
    const available = this.getAvailableAgents().filter(a => a.status === 'working')
    if (available.length < 3) return

    const meetingRoom = this.rooms.find(r => r.id === 'meeting_room')
    if (!meetingRoom) return

    // Pick 3-5 agents for a meeting
    const shuffled = available.sort(() => Math.random() - 0.5)
    const count = Math.min(shuffled.length, 3 + Math.floor(Math.random() * 3))
    const agents = shuffled.slice(0, count)

    // Chair positions around the meeting table
    const chairPositions = meetingRoom.furniture
      .filter(f => f.type === 'chair')
      .map(f => ({ x: f.x, y: f.y }))

    const gatherSpots = chairPositions.slice(0, agents.length)
    if (gatherSpots.length < agents.length) return

    this.startSocial('meeting', agents, gatherSpots, now)
  }

  private tryLunchBreak(now: number) {
    const available = this.getAvailableAgents().filter(a => a.status === 'working')
    if (available.length < 2) return

    const breakroom = this.rooms.find(r => r.id === 'breakroom')
    if (!breakroom) return

    // Pick 2-4 agents for lunch
    const shuffled = available.sort(() => Math.random() - 0.5)
    const count = Math.min(shuffled.length, 2 + Math.floor(Math.random() * 3))
    const agents = shuffled.slice(0, count)

    // Gather near the tables/chairs in breakroom
    const chairPositions = breakroom.furniture
      .filter(f => f.type === 'chair')
      .map(f => ({ x: f.x, y: f.y }))

    const gatherSpots = chairPositions.slice(0, agents.length)
    if (gatherSpots.length < agents.length) return

    this.startSocial('lunch_break', agents, gatherSpots, now)
  }

  private startSocial(
    type: SocialType,
    agents: AgentState[],
    gatherSpots: { x: number; y: number }[],
    now: number,
  ) {
    const socialId = `social_${this.socialCounter++}`
    const durations = SOCIAL_DURATIONS[type]
    const duration = durations.min + Math.random() * (durations.max - durations.min)

    const location = gatherSpots[0]

    const social: SocialInteraction = {
      id: socialId,
      type,
      agents: agents.map(a => a.id),
      location,
      startTime: now,
      duration,
      phase: 'gathering',
      emoteTimer: 0,
    }
    this.activeSocials.set(socialId, social)

    // Send each agent to their gather spot
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i]
      const spot = gatherSpots[i % gatherSpots.length]

      // Find a walkable tile near the spot
      const target = this.findNearestWalkable(spot.x, spot.y)
      if (!target) continue

      const path = findPath(agent.position, target, this.grid)
      if (path.length > 0) {
        this.paths.set(agent.id, path)
        this.pathIndices.set(agent.id, 0)
        agent.status = 'walking'
        agent.targetPosition = target
        this.characters.get(agent.id)?.updateStatus('walking')
      }
    }
  }

  private findNearestWalkable(x: number, y: number): { x: number; y: number } | null {
    // Check the target first, then spiral outward
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue // only check perimeter
          const nx = x + dx
          const ny = y + dy
          if (this.grid[ny]?.[nx]?.walkable) return { x: nx, y: ny }
        }
      }
    }
    // Also check center
    if (this.grid[y]?.[x]?.walkable) return { x, y }
    return null
  }

  private updateSocial(id: string, social: SocialInteraction, now: number, delta: number) {
    const elapsed = now - social.startTime

    switch (social.phase) {
      case 'gathering': {
        // Check if all agents have arrived (not walking anymore)
        const allArrived = social.agents.every(agentId => {
          const state = this.agentStates.get(agentId)
          return state && state.status !== 'walking'
        })

        if (allArrived || elapsed > 10000) {
          // Transition to active phase
          social.phase = 'active'
          social.startTime = now // Reset timer for active duration

          for (const agentId of social.agents) {
            const state = this.agentStates.get(agentId)
            const char = this.characters.get(agentId)
            if (!state || !char) continue

            if (social.type === 'pair_programming') {
              state.status = 'working'
              char.updateStatus('working')
            } else if (social.type === 'lunch_break') {
              state.status = 'eating'
              char.updateStatus('eating')
            } else {
              state.status = 'meeting'
              char.updateStatus('meeting')
            }
          }
          this.showChatBubble(id, social.location)
        }
        break
      }

      case 'active': {
        // Show periodic emotes
        social.emoteTimer += delta
        if (social.emoteTimer >= EMOTE_INTERVAL) {
          social.emoteTimer = 0
          this.showSocialEmotes(social)
        }

        // Check if duration has elapsed
        if (elapsed >= social.duration) {
          social.phase = 'dispersing'
          social.startTime = now
          this.removeChatBubble(id)

          // Clear emotes
          for (const agentId of social.agents) {
            const char = this.characters.get(agentId)
            if (char?.hasEmote()) char.clearEmote()
          }
        }
        break
      }

      case 'dispersing': {
        // Send agents back to their desks
        this.disperseAgents(social, now)
        this.activeSocials.delete(id)
        break
      }
    }
  }

  private showSocialEmotes(social: SocialInteraction) {
    // Pick one random agent to show an emote
    const agentId = social.agents[Math.floor(Math.random() * social.agents.length)]
    const char = this.characters.get(agentId)
    if (!char) return

    if (social.type === 'pair_programming') {
      char.showEmote(Math.random() < 0.7 ? 'thought' : 'exclamation')
    } else if (social.type === 'meeting') {
      const roll = Math.random()
      char.showEmote(roll < 0.4 ? 'thought' : roll < 0.8 ? 'exclamation' : 'sweat')
    } else {
      char.showEmote(Math.random() < 0.5 ? 'thought' : 'exclamation')
    }

    // Clear emote after a short delay
    this.scene.time.delayedCall(1500, () => {
      if (char.hasEmote()) char.clearEmote()
      // Restore the social animation
      const state = this.agentStates.get(agentId)
      if (state) {
        char.updateStatus(state.status)
      }
    })
  }

  private disperseAgents(social: SocialInteraction, now: number) {
    for (const agentId of social.agents) {
      const state = this.agentStates.get(agentId)
      if (!state) continue

      // Set cooldown
      this.agentCooldowns.set(agentId, now + AGENT_COOLDOWN)

      // Find the agent's home desk
      const homeRoom = this.rooms.find(r => {
        // Agents belong to department rooms based on their currentRoom
        return r.type === 'department' && r.deskPositions.length > 0 &&
          this.agentStates.get(agentId)?.currentRoom === r.id
      })

      if (homeRoom && homeRoom.deskPositions.length > 0) {
        const allAgentIds = Array.from(this.agentStates.keys())
        const agentIdx = allAgentIds.indexOf(agentId)
        const deskPos = homeRoom.deskPositions[agentIdx % homeRoom.deskPositions.length]
        const path = findPath(state.position, deskPos, this.grid)
        if (path.length > 0) {
          this.paths.set(agentId, path)
          this.pathIndices.set(agentId, 0)
          state.status = 'walking'
          state.targetPosition = deskPos
          this.characters.get(agentId)?.updateStatus('walking')
          continue
        }
      }

      // Fallback: just set back to working
      state.status = 'working'
      this.characters.get(agentId)?.updateStatus('working')
    }
  }

  private showChatBubble(socialId: string, location: { x: number; y: number }) {
    // Create a small pixel-art speech bubble near the interaction
    const pixelX = location.x * TILE_SIZE + TILE_SIZE / 2
    const pixelY = location.y * TILE_SIZE - 12

    const container = this.scene.add.container(pixelX, pixelY)
    container.setDepth(1000)

    // Bubble background
    const bg = this.scene.add.rectangle(0, 0, 16, 10, 0xffffff, 0.9)
    bg.setStrokeStyle(1, 0x333333)

    // Animated dots ("...")
    const dot1 = this.scene.add.circle(-4, 0, 1.5, 0x666666)
    const dot2 = this.scene.add.circle(0, 0, 1.5, 0x666666)
    const dot3 = this.scene.add.circle(4, 0, 1.5, 0x666666)

    // Small triangle pointer
    const pointer = this.scene.add.triangle(0, 7, -3, 0, 3, 0, 0, 5, 0xffffff, 0.9)

    container.add([bg, dot1, dot2, dot3, pointer])

    // Animate dots bouncing
    this.scene.tweens.add({
      targets: dot1,
      y: -2,
      duration: 400,
      yoyo: true,
      repeat: -1,
      delay: 0,
    })
    this.scene.tweens.add({
      targets: dot2,
      y: -2,
      duration: 400,
      yoyo: true,
      repeat: -1,
      delay: 150,
    })
    this.scene.tweens.add({
      targets: dot3,
      y: -2,
      duration: 400,
      yoyo: true,
      repeat: -1,
      delay: 300,
    })

    this.chatBubbles.set(socialId, container)
  }

  private removeChatBubble(socialId: string) {
    const bubble = this.chatBubbles.get(socialId)
    if (bubble) {
      this.scene.tweens.add({
        targets: bubble,
        alpha: 0,
        y: bubble.y - 8,
        duration: 300,
        onComplete: () => bubble.destroy(),
      })
      this.chatBubbles.delete(socialId)
    }
  }

  getActiveSocialCount(): number {
    return this.activeSocials.size
  }
}
