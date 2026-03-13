import Phaser from 'phaser'
import { AgentState, RoomConfig, TileData, GameSaveState } from '../types'
import { BREAK_TIMING, POLECAT_SPAWN_INTERVAL } from '../constants'
import { WorldBuilder } from './world/WorldBuilder'
import { CameraController } from './CameraController'
import { CharacterSprite } from './sprites/CharacterSprite'
import { generateSpritesheet, traitsFromName } from './sprites/SpriteGenerator'
import { findPath } from './world/Pathfinding'
import { BeadSystem } from './systems/BeadSystem'
import { PolecatSystem } from './systems/PolecatSystem'
import { AgentParticleSystem, ParticleEffect } from './systems/AgentParticleSystem'
import { DayNightSystem } from './systems/DayNightSystem'
import { WeatherSystem } from './systems/WeatherSystem'
import { SocialSystem } from './systems/SocialSystem'
import { ThoughtBubbleSystem, BubbleIcon } from './systems/ThoughtBubbleSystem'
import { ActivityAnimationSystem } from './systems/ActivityAnimationSystem'
import { generateLayout, generateAgents, buildRigNameMap, ApiAgent } from './world/DynamicRoomGenerator'
import { ScreenTransition, TransitionConfig } from './transitions/ScreenTransition'
import { FocusSystem } from './systems/FocusSystem'
import { JuiceSystem, JuiceEvent } from './systems/JuiceSystem'
import { TaskOverlaySystem } from './systems/TaskOverlaySystem'
import { HoverTooltipSystem } from './systems/HoverTooltipSystem'
import { updateAmbient } from '../audio/AmbientAudio'
import { DailyRoutineSystem } from './systems/DailyRoutineSystem'
import { InteractiveEnvironmentSystem } from './systems/InteractiveEnvironmentSystem'
import { EnvironmentalParticleSystem } from './systems/EnvironmentalParticleSystem'
import { AmbientLifeSystem } from './systems/AmbientLifeSystem'

// Fallback agents when API is unavailable
const FALLBACK_AGENTS: AgentState[] = [
  { id: 'planogram-witness', name: 'witness', role: 'witness', rig: 'planogram', status: 'working', activity: 'typing', position: { x: 5, y: 7 }, currentRoom: 'planogram' },
  { id: 'planogram-refinery', name: 'refinery', role: 'refinery', rig: 'planogram', status: 'working', activity: 'bash', position: { x: 5, y: 12 }, currentRoom: 'planogram' },
  { id: 'planogram-manager', name: 'manager', role: 'worker', rig: 'planogram', status: 'working', activity: 'reading', position: { x: 16, y: 7 }, currentRoom: 'planogram' },
  { id: 'alc_ai-witness', name: 'witness', role: 'witness', rig: 'alc_ai', status: 'working', activity: 'typing', position: { x: 47, y: 7 }, currentRoom: 'alc_ai' },
  { id: 'alc_ai-refinery', name: 'refinery', role: 'refinery', rig: 'alc_ai', status: 'working', activity: 'bash', position: { x: 47, y: 12 }, currentRoom: 'alc_ai' },
  { id: 'arcade_dept-witness', name: 'witness', role: 'witness', rig: 'arcade_dept', status: 'working', activity: 'typing', position: { x: 77, y: 7 }, currentRoom: 'arcade_dept' },
  { id: 'mayor-MAYOR', name: 'MAYOR', role: 'mayor', rig: 'mayor', status: 'working', activity: 'typing', position: { x: 35, y: 7 }, currentRoom: 'mayor_office' },
  { id: 'deacon-deacon', name: 'deacon', role: 'deacon', rig: 'deacon', status: 'idle', activity: 'waiting', position: { x: 35, y: 28 }, currentRoom: 'hallway' },
]

export class ArcadeScene extends Phaser.Scene {
  private cameraController!: CameraController
  private characters = new Map<string, CharacterSprite>()
  private agentStates = new Map<string, AgentState>()
  private paths = new Map<string, { x: number; y: number }[]>()
  private pathIndices = new Map<string, number>()
  private grid: TileData[][] = []
  private moveTimer = 0
  private pollTimer = 0
  private breakTimers = new Map<string, number>()
  private selectedAgent: string | null = null
  private beadSystem!: BeadSystem
  private polecatSystem!: PolecatSystem
  private particleSystem!: AgentParticleSystem
  private actionEventTimer = 0
  private activityCycleTimer = 0
  private dayNightSystem!: DayNightSystem
  private weatherSystem!: WeatherSystem
  private socialSystem!: SocialSystem
  private thoughtBubbleSystem!: ThoughtBubbleSystem
  private activitySystem!: ActivityAnimationSystem
  private rooms: RoomConfig[] = []
  private allAgents: AgentState[] = []
  private rigNameMap = new Map<string, string>()
  private screenTransition!: ScreenTransition
  private focusSystem!: FocusSystem
  private juiceSystem!: JuiceSystem
  private taskOverlaySystem!: TaskOverlaySystem
  private hookPollTimer = 0
  private hoverTooltipSystem!: HoverTooltipSystem
  private dailyRoutineSystem!: DailyRoutineSystem
  private interactiveEnvSystem!: InteractiveEnvironmentSystem
  private envParticleSystem!: EnvironmentalParticleSystem
  private ambientLifeSystem!: AmbientLifeSystem

  constructor() {
    super({ key: 'ArcadeScene' })
  }

  create() {
    // Fetch rig data synchronously via XMLHttpRequest so Phaser scene systems
    // are still active when we build the world (async create() breaks Phaser)
    let rigs: string[] = []
    let apiAgents: ApiAgent[] = []
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', '/api/status/parsed', false) // synchronous
      xhr.send()
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        rigs = data.rigs ?? []
        apiAgents = data.agents ?? []
      }
    } catch {
      // API unavailable — use defaults
    }

    // Generate dynamic layout
    const layout = generateLayout(rigs)
    this.rooms = layout.rooms
    this.rigNameMap = buildRigNameMap(rigs.length > 0 ? rigs : ['villa_ai_planogram', 'villa_alc_ai', 'gt_arcade'])

    // Build the world
    const builder = new WorldBuilder(this)
    const { grid } = builder.buildWorld(layout.rooms, layout.doorways, layout.worldWidth, layout.worldHeight)
    this.grid = grid

    this.cameraController = new CameraController(this, layout.worldWidth, layout.worldHeight, layout.rooms)

    // Initialize systems
    this.beadSystem = new BeadSystem(this)
    this.polecatSystem = new PolecatSystem(this, grid)
    this.particleSystem = new AgentParticleSystem(this)
    this.dayNightSystem = new DayNightSystem(this, layout.worldWidth, layout.worldHeight, layout.rooms)
    this.weatherSystem = new WeatherSystem(this, layout.worldWidth, layout.worldHeight, layout.rooms)
    this.thoughtBubbleSystem = new ThoughtBubbleSystem(this)
    this.activitySystem = new ActivityAnimationSystem(this)
    // SocialSystem initialized after agents are created (needs agentStates populated)

    // Generate agents from API data or use fallback
    if (apiAgents.length > 0) {
      this.allAgents = generateAgents(apiAgents, layout.rooms, this.rigNameMap)
    } else {
      this.allAgents = FALLBACK_AGENTS
    }

    for (const agent of this.allAgents) {
      this.agentStates.set(agent.id, { ...agent })
      this.createCharacter(agent)
      // Register thought bubble on the character container
      const char = this.characters.get(agent.id)
      if (char) {
        this.thoughtBubbleSystem.register(agent.id, char.container)
      }

      this.breakTimers.set(
        agent.id,
        Date.now() + BREAK_TIMING.minWorkTime + Math.random() * (BREAK_TIMING.maxWorkTime - BREAK_TIMING.minWorkTime),
      )
    }

    this.socialSystem = new SocialSystem(
      this,
      this.agentStates,
      this.characters,
      this.paths,
      this.pathIndices,
      this.grid,
      this.rooms,
    )

    this.dailyRoutineSystem = new DailyRoutineSystem(
      this,
      this.agentStates,
      this.characters,
      this.paths,
      this.pathIndices,
      this.grid,
      this.rooms,
      this.thoughtBubbleSystem,
    )

    this.interactiveEnvSystem = new InteractiveEnvironmentSystem(
      this,
      this.agentStates,
      this.characters,
      this.rooms,
    )

    this.envParticleSystem = new EnvironmentalParticleSystem(
      this,
      this.rooms,
      layout.doorways,
    )

    this.ambientLifeSystem = new AmbientLifeSystem(this, this.rooms, layout.worldWidth, layout.worldHeight)

    this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      for (const [id, char] of this.characters) {
        if (char.container === gameObject || char.container.list.includes(gameObject)) {
          this.selectAgent(id)
          return
        }
      }
    })

    this.screenTransition = new ScreenTransition(this)
    this.focusSystem = new FocusSystem(this, this.characters, this.agentStates, this.cameraController)
    this.juiceSystem = new JuiceSystem(this)
    this.taskOverlaySystem = new TaskOverlaySystem(this, this.characters)
    this.taskOverlaySystem.setAgentStates(this.agentStates)

    this.hoverTooltipSystem = new HoverTooltipSystem(this, this.grid, this.rooms, this.characters, this.agentStates)

    // Apply CRT post-processing shader to the main camera
    if (this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.setPostPipeline('CRTPostFX')
    }

    this.pollBridge()
    this.pollAgentHooks()
  }

  private createCharacter(agent: AgentState) {
    const textureKey = `char_${agent.id}`
    const traits = traitsFromName(agent.name, agent.rig)
    generateSpritesheet(this, textureKey, traits)

    const displayName = agent.role === 'mayor' ? 'MAYOR' : `${agent.rig}/${agent.name}`
    const char = new CharacterSprite(this, agent.id, displayName, textureKey, agent.position.x, agent.position.y)
    char.updateStatus(agent.status)

    char.container.on('pointerdown', () => {
      this.selectAgent(agent.id)
    })

    this.characters.set(agent.id, char)
  }

  private selectAgent(id: string) {
    if (this.selectedAgent) {
      this.characters.get(this.selectedAgent)?.deselect()
    }

    if (this.selectedAgent === id) {
      this.selectedAgent = null
      this.cameraController.followTarget(null)
      this.focusSystem.unfocus()
      this.events.emit('agent-selected', null)
      this.game.events.emit('agent-selected', null)
    } else {
      this.selectedAgent = id
      const char = this.characters.get(id)
      char?.select()
      if (char) {
        this.cameraController.followTarget(char.getPosition())
      }
      this.focusSystem.focus(id)
      const state = this.agentStates.get(id)
      this.events.emit('agent-selected', id)
      this.game.events.emit('agent-selected', id, state ?? null)
    }
  }

  update(_time: number, delta: number) {
    this.cameraController.update()
    this.moveTimer += delta
    this.pollTimer += delta

    if (this.moveTimer >= 150) {
      this.moveTimer = 0
      this.updateAgentMovement()
    }

    if (this.pollTimer >= 3000) {
      this.pollTimer = 0
      this.pollBridge()
    }

    this.updateBreaks()
    this.beadSystem.update(delta)
    this.polecatSystem.update(delta)
    this.particleSystem.update(delta)
    this.activitySystem.update(delta)
    this.dayNightSystem.update(delta)
    this.weatherSystem.update(delta, this.dayNightSystem.getPhase())
    updateAmbient(delta, this.weatherSystem.getWeather(), this.dayNightSystem.getPhase())
    this.socialSystem.update(delta)
    this.dailyRoutineSystem.update(delta, this.dayNightSystem.getGameHour())
    this.interactiveEnvSystem.update(delta, this.dayNightSystem.getPhase())
    this.envParticleSystem.update(delta, this.dayNightSystem.getPhase(), this.agentStates, this.characters)
    this.ambientLifeSystem.update(delta, this.dayNightSystem.getPhase())
    this.thoughtBubbleSystem.update(delta, this.agentStates)

    // Agents at work/smoking/eating may spawn beads + typing particles
    for (const [id, state] of this.agentStates) {
      if (state.status === 'working' || state.status === 'smoking' || state.status === 'eating') {
        const roomId = this.grid[state.position.y]?.[state.position.x]?.roomId ?? ''
        this.beadSystem.trySpawnBead(state.position.x, state.position.y, roomId, this.grid)
      }

      // Typing debris for working agents
      if (state.status === 'working') {
        const char = this.characters.get(id)
        if (char) {
          const pos = char.getPosition()
          this.particleSystem.tickTyping(id, pos.x, pos.y, delta)
        }
      } else {
        this.particleSystem.stopTyping(id)
      }

      // Activity animation overlays
      const char = this.characters.get(id)
      if (char) {
        const pos = char.getPosition()
        if (state.status === 'working' && state.activity !== 'none') {
          this.activitySystem.setActivity(id, state.activity, pos.x, pos.y)
        } else {
          this.activitySystem.setActivity(id, 'none', pos.x, pos.y)
        }
        this.activitySystem.updatePosition(id, pos.x, pos.y)
      }
    }

    // Periodically cycle activities for working agents (simulates tool switching)
    this.activityCycleTimer += delta
    if (this.activityCycleTimer >= 8000 + Math.random() * 12000) {
      this.activityCycleTimer = 0
      this.cycleRandomActivity()
    }

    // Random action events (compile, merge, error, confetti)
    this.actionEventTimer += delta
    if (this.actionEventTimer >= 4000 + Math.random() * 6000) {
      this.actionEventTimer = 0
      this.triggerRandomActionEvent()
    }

    if (this.selectedAgent) {
      const char = this.characters.get(this.selectedAgent)
      if (char) {
        this.cameraController.followTarget(char.getPosition())
      }
    }

    this.screenTransition.update(delta)
    this.focusSystem.update(delta)
    this.juiceSystem.update(delta)
    this.taskOverlaySystem.update(delta)
    this.hoverTooltipSystem.update(delta)

    // Poll agent hooks periodically (every 10s)
    this.hookPollTimer += delta
    if (this.hookPollTimer >= 10000) {
      this.hookPollTimer = 0
      this.pollAgentHooks()
    }

    // Emit bead count for UI
    this.game.events.emit('bead-count', this.beadSystem.getBeadCount())
    this.game.events.emit('polecat-count', this.polecatSystem.getActiveCount())
  }

  private updateAgentMovement() {
    for (const [id, state] of this.agentStates) {
      if (state.status === 'offline') continue

      const path = this.paths.get(id)
      if (!path || path.length === 0) continue

      const idx = this.pathIndices.get(id) ?? 0
      if (idx >= path.length) {
        this.paths.delete(id)
        this.pathIndices.delete(id)
        const char = this.characters.get(id)
        char?.setDirection(0, 0)

        if (state.targetPosition) {
          const targetRoom = this.grid[state.targetPosition.y]?.[state.targetPosition.x]?.roomId
          if (targetRoom === 'breakroom') state.status = 'eating'
          else if (targetRoom === 'smoke_area') state.status = 'smoking'
          else if (targetRoom === 'bathroom') state.status = 'bathroom'
          else if (targetRoom === 'play_area') state.status = 'playing'
          else if (targetRoom === 'meeting_room') state.status = 'meeting'
          else state.status = 'working'
          char?.updateStatus(state.status)
          state.targetPosition = undefined

          // Juice: squash-stretch on arrival (landing effect)
          if (char) {
            this.juiceSystem.squashStretch(char.container, { squash: 0.8, stretch: 1.15, duration: 180 })
          }
        }
        continue
      }

      const next = path[idx]
      const prev = idx > 0 ? path[idx - 1] : state.position
      const dx = next.x - prev.x
      const dy = next.y - prev.y

      state.position = { x: next.x, y: next.y }
      const char = this.characters.get(id)
      char?.setTilePosition(next.x, next.y)
      char?.setDirection(dx, dy)
      this.pathIndices.set(id, idx + 1)
    }
  }

  private updateBreaks() {
    const now = Date.now()

    for (const [id, state] of this.agentStates) {
      if (state.status === 'offline') continue
      if (this.socialSystem.isInSocial(id)) continue
      if (this.dailyRoutineSystem.isInRoutine(id)) continue

      const breakTime = this.breakTimers.get(id)
      if (!breakTime || now < breakTime) continue

      if (state.status === 'working') {
        const destinations = ['breakroom', 'smoke_area', 'bathroom', 'play_area', 'meeting_room']
        const destRoomId = destinations[Math.floor(Math.random() * destinations.length)]
        const room = this.rooms.find((r) => r.id === destRoomId)
        if (room) {
          const targetX = room.x + 3 + Math.floor(Math.random() * Math.max(1, room.width - 6))
          const targetY = room.y + 3 + Math.floor(Math.random() * Math.max(1, room.height - 6))

          if (this.grid[targetY]?.[targetX]?.walkable) {
            const path = findPath(state.position, { x: targetX, y: targetY }, this.grid)
            if (path.length > 0) {
              this.paths.set(id, path)
              this.pathIndices.set(id, 0)
              state.status = 'walking'
              state.targetPosition = { x: targetX, y: targetY }
              this.characters.get(id)?.updateStatus('walking')

              let breakDuration = BREAK_TIMING.breakDuration
              if (destRoomId === 'smoke_area') breakDuration = BREAK_TIMING.smokeDuration
              if (destRoomId === 'bathroom') breakDuration = BREAK_TIMING.bathroomDuration
              this.breakTimers.set(id, now + breakDuration + path.length * 150)
            }
          }
        }
      } else if (['eating', 'smoking', 'bathroom', 'playing', 'meeting'].includes(state.status)) {
        const deskRoom = this.rooms.find((r) => r.id === state.currentRoom)
        if (deskRoom && deskRoom.deskPositions.length > 0) {
          const agentIdx = this.allAgents.findIndex((a) => a.id === id)
          const deskPos = deskRoom.deskPositions[agentIdx % deskRoom.deskPositions.length]
          if (deskPos) {
            const path = findPath(state.position, deskPos, this.grid)
            if (path.length > 0) {
              this.paths.set(id, path)
              this.pathIndices.set(id, 0)
              state.status = 'walking'
              state.targetPosition = deskPos
              this.characters.get(id)?.updateStatus('walking')
            }
          }
        }
        this.breakTimers.set(
          id,
          now + BREAK_TIMING.minWorkTime + Math.random() * (BREAK_TIMING.maxWorkTime - BREAK_TIMING.minWorkTime),
        )
      }
    }
  }

  private async pollBridge() {
    try {
      const res = await fetch('/api/status/parsed')
      if (!res.ok) return
      const data = await res.json()
      const agents: ApiAgent[] = data.agents ?? []

      for (const agent of agents) {
        this.updateAgentFromBridge(agent.name, agent.rig, agent.online, agent.type)
      }
    } catch {
      // Bridge not available
    }
  }

  private async pollAgentHooks() {
    try {
      const res = await fetch('/api/agent-hooks')
      if (!res.ok) return
      const data = await res.json()
      const hooks: Array<{ agent: string; rig: string; beadId: string; title: string; status: string }> = data.hooks ?? []

      // Clear existing hook beads
      for (const [, state] of this.agentStates) {
        state.hookBead = undefined
      }

      // Apply hook data to matching agents
      for (const hook of hooks) {
        const internalRig = this.rigNameMap.get(hook.rig) ?? hook.rig.replace(/^(villa_|gt_)/, '')

        for (const [id, state] of this.agentStates) {
          const matchesName = state.name.toLowerCase() === hook.agent.toLowerCase()
          const matchesRig = state.rig === internalRig || state.rig === hook.rig

          if (matchesName && matchesRig) {
            state.hookBead = {
              id: hook.beadId,
              title: hook.title || hook.beadId,
              status: hook.status || 'hooked',
            }
            this.taskOverlaySystem.setHookBead(id, state.hookBead)
            break
          }
        }
      }

      // Remove overlays for agents that no longer have hooks
      for (const [id, state] of this.agentStates) {
        if (!state.hookBead) {
          this.taskOverlaySystem.setHookBead(id, null)
        }
      }
    } catch {
      // API unavailable
    }
  }

  private updateAgentFromBridge(name: string, apiRig: string, isOnline: boolean, agentType: string) {
    // Map API rig name to internal room ID
    const internalRig = this.rigNameMap.get(apiRig) ?? apiRig.replace(/^(villa_|gt_)/, '')

    for (const [id, state] of this.agentStates) {
      const matchesName = state.name.toLowerCase() === name.toLowerCase()
      const matchesRig =
        state.rig === internalRig ||
        (agentType === 'mayor' && state.role === 'mayor') ||
        (agentType === 'deacon' && state.role === 'deacon')

      if (matchesName && matchesRig) {
        const newStatus = isOnline
          ? (state.status === 'offline' ? 'working' : state.status)
          : 'offline'

        if (newStatus !== state.status && state.status !== 'walking') {
          state.status = newStatus as AgentState['status']
          const char = this.characters.get(id)
          if (char) {
            char.updateStatus(state.status)
            char.container.setAlpha(state.status === 'offline' ? 0.4 : 1)
            // Juice: squash-stretch on status change
            this.juiceSystem.squashStretch(char.container, { squash: 0.85, stretch: 1.1, duration: 150 })
            this.juiceSystem.fire('status_change')
          }
        }
        break
      }
    }
  }

  private triggerRandomActionEvent() {
    // Pick a random working agent
    const workingAgents: string[] = []
    for (const [id, state] of this.agentStates) {
      if (state.status === 'working') workingAgents.push(id)
    }
    if (workingAgents.length === 0) return

    const agentId = workingAgents[Math.floor(Math.random() * workingAgents.length)]
    const char = this.characters.get(agentId)
    if (!char) return

    const pos = char.getPosition()

    // Weighted random: compile most common, confetti rarest
    const roll = Math.random()
    let effect: ParticleEffect
    if (roll < 0.35) {
      effect = 'compile_sparkles'
    } else if (roll < 0.60) {
      effect = 'error_sweat'
    } else if (roll < 0.80) {
      effect = 'merge_convergence'
    } else {
      effect = 'celebration_confetti'
    }

    this.particleSystem.emit(pos.x, pos.y, effect)

    // Flash matching thought bubble icon
    let bubbleIcon: BubbleIcon | null = null
    if (effect === 'compile_sparkles') bubbleIcon = 'lightbulb'
    else if (effect === 'celebration_confetti') bubbleIcon = 'music'
    if (bubbleIcon) {
      this.thoughtBubbleSystem.flashIcon(agentId, bubbleIcon)
    }

    // Fire juice effects matching the action
    const juiceMap: Record<string, JuiceEvent> = {
      compile_sparkles: 'compile',
      error_sweat: 'error',
      merge_convergence: 'merge',
      celebration_confetti: 'celebration',
    }
    const juiceEvent = juiceMap[effect]
    if (juiceEvent) {
      this.juiceSystem.fire(juiceEvent, pos.x, pos.y)
      // Squash-stretch the acting agent's sprite
      if (char) {
        this.juiceSystem.squashStretch(char.container)
      }
    }
  }

  private cycleRandomActivity() {
    const workingAgents: string[] = []
    for (const [id, state] of this.agentStates) {
      if (state.status === 'working') workingAgents.push(id)
    }
    if (workingAgents.length === 0) return

    const agentId = workingAgents[Math.floor(Math.random() * workingAgents.length)]
    const state = this.agentStates.get(agentId)
    if (!state) return

    // Weighted: typing and bash most common, permission-needed rarest
    const roll = Math.random()
    if (roll < 0.35) state.activity = 'typing'
    else if (roll < 0.60) state.activity = 'bash'
    else if (roll < 0.78) state.activity = 'reading'
    else if (roll < 0.90) state.activity = 'waiting'
    else state.activity = 'permission-needed'

    // Update character sprite animation to match activity
    const char = this.characters.get(agentId)
    if (char) {
      if (state.activity === 'reading') {
        char.playReading()
      } else if (state.activity === 'typing' || state.activity === 'bash') {
        char.updateStatus('working')
      }
    }
  }

  getAgentState(id: string): AgentState | undefined {
    return this.agentStates.get(id)
  }

  /** Play a screen transition effect. */
  playTransition(config: TransitionConfig): Promise<void> {
    return this.screenTransition.play(config)
  }

  /** Play a full in-out transition with a midpoint callback (e.g., for scene changes). */
  playTransitionInOut(config: TransitionConfig, onMidpoint?: () => void): Promise<void> {
    return this.screenTransition.playInOut(config, onMidpoint)
  }

  get isTransitioning(): boolean {
    return this.screenTransition.isActive
  }

  getFullState(): GameSaveState {
    const agents: GameSaveState['agents'] = []
    for (const [id, state] of this.agentStates) {
      agents.push({
        id,
        position: { ...state.position },
        status: state.status,
        activity: state.activity,
        currentRoom: state.currentRoom,
      })
    }
    return {
      version: 1,
      timestamp: Date.now(),
      agents,
      rooms: this.rooms.map(r => ({ ...r, furniture: [...r.furniture], deskPositions: [...r.deskPositions] })),
      preferences: {},
    }
  }

  loadState(saved: GameSaveState): void {
    if (!saved || saved.version !== 1) return

    for (const agentData of saved.agents) {
      const state = this.agentStates.get(agentData.id)
      if (!state) continue

      state.position = { ...agentData.position }
      state.status = agentData.status
      state.activity = agentData.activity
      state.currentRoom = agentData.currentRoom

      // Clear any active paths so agent stays at restored position
      this.paths.delete(agentData.id)
      this.pathIndices.delete(agentData.id)

      const char = this.characters.get(agentData.id)
      if (char) {
        char.setTilePosition(agentData.position.x, agentData.position.y)
        char.updateStatus(agentData.status)
        char.container.setAlpha(agentData.status === 'offline' ? 0.4 : 1)
      }
    }
  }
}
