import { useRef, useEffect, useState, useCallback } from 'react'
import Phaser from 'phaser'
import { ArcadeScene } from '../game/ArcadeScene'
import { TownEditorScene } from '../game/editor/TownEditorScene'
import { MeshWorldMapScene } from '../game/MeshWorldMapScene'
import { CRTPostFX } from '../game/shaders/CRTPostFX'
import { StatusHUD } from './StatusHUD'
import { BottomPanels } from './BottomPanels'
import { TerminalPanel } from './TerminalPanel'
import { SessionViewer } from './SessionViewer'
import { AgentDeskView } from './AgentDeskView'
import { BootSequence } from './BootSequence'
import { NotificationToast, notify } from './NotificationToast'
import { SettingsPanel, matchesBinding, type Preferences } from './SettingsPanel'
import { CharacterCustomizationPanel } from './CharacterCustomizationPanel'
import { ActivityLogPanel } from './ActivityLogPanel'
import { InspectorPanel } from './InspectorPanel'
import { GiteaActivityPanel } from './GiteaActivityPanel'
import { SaveLoadPanel, useAutoSave } from './SaveLoadPanel'
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, THEME } from '../constants'
import { AgentState } from '../types'

export function App() {
  const gameRef = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Phaser.Game | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [sessionViewerOpen, setSessionViewerOpen] = useState(false)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>('')
  const [deskViewOpen, setDeskViewOpen] = useState(false)
  const [deskAgent, setDeskAgent] = useState<{ name: string; rig: string; role: string } | null>(null)
  const [activeRig, setActiveRig] = useState('planogram')
  const [beadCount, setBeadCount] = useState(0)
  const [polecatCount, setPolecatCount] = useState(0)
  const [booted, setBooted] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [worldMapMode, setWorldMapMode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [customizeAgent, setCustomizeAgent] = useState<{ id: string; name: string; rig: string } | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorAgent, setInspectorAgent] = useState<{ name: string; rig: string; role: string } | null>(null)
  const [giteaActivityOpen, setGiteaActivityOpen] = useState(false)
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const editModeRef = useRef(editMode)
  const gameStateRef = useRef(game)
  const keybindingsRef = useRef<Record<string, string[]>>({
    terminal: ['`'],
    mayor: ['m'],
    settings: ['s'],
    customize: ['c'],
    activityLog: ['l'],
    close: ['Escape'],
  })
  const worldMapRef = useRef(worldMapMode)
  editModeRef.current = editMode
  worldMapRef.current = worldMapMode
  gameStateRef.current = game

  const toggleEditMode = useCallback(() => {
    const g = gameStateRef.current
    if (!g) return
    if (editModeRef.current) {
      // Switch from editor back to play
      const editor = g.scene.getScene('TownEditorScene') as TownEditorScene
      const rooms = editor?.getRooms?.()
      g.scene.stop('TownEditorScene')
      g.scene.start('ArcadeScene', rooms ? { customRooms: rooms } : undefined)
      setEditMode(false)
    } else {
      // Switch from play to editor
      const arcade = g.scene.getScene('ArcadeScene') as ArcadeScene
      if (arcade?.isTransitioning) return
      g.scene.stop('ArcadeScene')
      g.scene.start('TownEditorScene')
      setEditMode(true)
    }
  }, [])

  const toggleWorldMap = useCallback(() => {
    const g = gameStateRef.current
    if (!g) return
    if (worldMapRef.current) {
      g.scene.stop('MeshWorldMapScene')
      g.scene.start('ArcadeScene')
      setWorldMapMode(false)
    } else {
      if (editModeRef.current) return
      const arcade = g.scene.getScene('ArcadeScene') as ArcadeScene
      if (arcade?.isTransitioning) return
      g.scene.stop('ArcadeScene')
      g.scene.start('MeshWorldMapScene')
      setWorldMapMode(true)
    }
  }, [])

  // Keyboard shortcuts (dynamic via keybindings)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const kb = keybindingsRef.current

      if (kb.terminal && matchesBinding(e, kb.terminal)) {
        e.preventDefault()
        setTerminalOpen((prev) => !prev)
      }
      if (kb.mayor && matchesBinding(e, kb.mayor)) {
        e.preventDefault()
        openMayorSession()
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        toggleEditMode()
      }
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        toggleWorldMap()
      }
      if (kb.settings && matchesBinding(e, kb.settings)) {
        e.preventDefault()
        setSettingsOpen((prev) => !prev)
      }
      if (kb.customize && matchesBinding(e, kb.customize)) {
        e.preventDefault()
        setCustomizeOpen((prev) => !prev)
      }
      if (kb.activityLog && matchesBinding(e, kb.activityLog)) {
        e.preventDefault()
        setActivityLogOpen((prev) => !prev)
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        setGiteaActivityOpen((prev) => !prev)
      }
      if (e.key === 'F5' || (e.key === 'S' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        setSaveLoadOpen((prev) => !prev)
      }
      if (e.key === 'Escape' || (kb.close && matchesBinding(e, kb.close))) {
        setSettingsOpen(false)
        setCustomizeOpen(false)
        setSessionViewerOpen(false)
        setDeskViewOpen(false)
        setActivityLogOpen(false)
        setInspectorOpen(false)
        setGiteaActivityOpen(false)
        setSaveLoadOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleEditMode, toggleWorldMap])

  const handlePreferencesChange = useCallback((prefs: Preferences) => {
    keybindingsRef.current = prefs.keybindings
  }, [])

  function openMayorSession() {
    setSessionName('hq-mayor')
    setSessionTitle("Mayor's Session")
    setSessionViewerOpen(true)
  }

  function openAgentSession(agentState: AgentState | { rig: string; role: string; name: string }) {
    setDeskAgent({ name: agentState.name, rig: agentState.rig, role: agentState.role })
    setDeskViewOpen(true)
    setInspectorAgent({ name: agentState.name, rig: agentState.rig, role: agentState.role })
    setInspectorOpen(true)
  }

  useEffect(() => {
    if (!gameRef.current || game) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.WEBGL,
      parent: gameRef.current,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      pixelArt: true,
      backgroundColor: THEME.bgCanvas,
      scene: [ArcadeScene, TownEditorScene, MeshWorldMapScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
    }

    const g = new Phaser.Game(config)

    // Register CRT post-processing pipeline once renderer is ready
    g.events.once('ready', () => {
      const renderer = g.renderer as Phaser.Renderer.WebGL.WebGLRenderer
      if (renderer.pipelines) {
        renderer.pipelines.addPostPipeline('CRTPostFX', CRTPostFX)
      }
    })

    setGame(g)

    g.events.on('agent-selected', (agentId: string | null, agentState: AgentState | null) => {
      setSelectedAgent(agentId)
      if (agentState) {
        setCustomizeAgent({ id: agentState.id, name: agentState.name, rig: agentState.rig })
        openAgentSession(agentState)
      }
    })

    g.events.on('bead-count', (count: number) => {
      setBeadCount((prev) => {
        if (count > prev && prev > 0) {
          notify('alert', 'New beads detected', `${count - prev} bead${count - prev > 1 ? 's' : ''} appeared`)
        }
        return count
      })
    })
    g.events.on('polecat-count', (count: number) => {
      setPolecatCount((prev) => {
        if (count > prev) {
          notify('agent', 'Polecat dispatched', `${count} active polecat${count !== 1 ? 's' : ''}`)
        }
        return count
      })
    })

    return () => {
      g.destroy(true)
    }
  }, [])

  const handleRigSelect = useCallback((rigId: string) => {
    setActiveRig(rigId)
    if (!game) return
    const scene = game.scene.getScene('ArcadeScene') as ArcadeScene
    if (!scene || scene.isTransitioning) return

    const positions: Record<string, { x: number; y: number }> = {
      planogram: { x: 15 * TILE_SIZE, y: 12 * TILE_SIZE },
      alc_ai: { x: 55 * TILE_SIZE, y: 12 * TILE_SIZE },
      arcade: { x: 82 * TILE_SIZE, y: 12 * TILE_SIZE },
    }
    const pos = positions[rigId]
    if (pos) {
      // Pick a random GBA-style transition for rig switches
      const types = ['circle-wipe', 'diamond-wipe', 'pixel-dissolve', 'iris', 'slide'] as const
      const type = types[Math.floor(Math.random() * types.length)]
      scene.playTransitionInOut({ type, duration: 400 }, () => {
        scene.cameras.main.centerOn(pos.x, pos.y)
      })
    }
  }, [game])

  const closeTerminal = useCallback(() => setTerminalOpen(false), [])
  const closeSession = useCallback(() => setSessionViewerOpen(false), [])
  const closeDeskView = useCallback(() => setDeskViewOpen(false), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const closeCustomize = useCallback(() => setCustomizeOpen(false), [])
  const closeActivityLog = useCallback(() => setActivityLogOpen(false), [])
  const closeGiteaActivity = useCallback(() => setGiteaActivityOpen(false), [])
  const toggleTerminal = useCallback(() => setTerminalOpen((prev) => !prev), [])
  const toggleSettings = useCallback(() => setSettingsOpen((prev) => !prev), [])
  const toggleActivityLog = useCallback(() => setActivityLogOpen((prev) => !prev), [])
  const toggleGiteaActivity = useCallback(() => setGiteaActivityOpen((prev) => !prev), [])

  useAutoSave(game)

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    notify('system', 'System online', 'Gas Town Arcade initialized')
  }, [])

  // WebSocket-driven notifications
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout>
    function connect() {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`)
        ws.onopen = () => {
          notify('system', 'Connected', 'WebSocket link established')
        }
        ws.onclose = () => {
          retryTimer = setTimeout(connect, 3000)
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'gt-mail') {
              const count = parseInt((msg.data || '').match(/(\d+) unread/)?.[1] ?? '0', 10)
              if (count > 0) notify('mail', 'New mail', `${count} unread message${count !== 1 ? 's' : ''}`)
            } else if (msg.type === 'gt-notify') {
              notify(msg.category || 'system', msg.title || 'Notification', msg.message)
            } else if (msg.type === 'agent-status') {
              notify('agent', `${msg.name || 'Agent'} ${msg.status || 'updated'}`, msg.task)
            }
          } catch { /* ignore */ }
        }
      } catch { /* ws not available */ }
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: THEME.bgBody,
      overflow: 'hidden',
      fontFamily: THEME.fontFamily,
    }}>
      {!booted && <BootSequence onComplete={handleBootComplete} />}

      {/* Top status bar */}
      <StatusHUD
        selectedAgent={selectedAgent}
        beadCount={beadCount}
        polecatCount={polecatCount}
        gameRef={game}
      />

      {/* Game canvas area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        padding: '4px 0',
        position: 'relative',
      }}>
        <div
          ref={gameRef}
          style={{
            maxWidth: 1280,
            maxHeight: 720,
            width: '100%',
            height: '100%',
            border: `4px solid ${editMode ? '#88ccff' : worldMapMode ? '#53d8fb' : THEME.borderAccent}`,
            boxShadow: editMode
              ? '0 0 24px rgba(136, 204, 255, 0.4)'
              : worldMapMode
              ? '0 0 24px rgba(83, 216, 251, 0.3)'
              : '0 0 24px rgba(100, 71, 125, 0.3)',
          }}
        />
        {worldMapMode && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 12,
            background: 'rgba(20, 40, 60, 0.9)',
            border: '2px solid #53d8fb',
            padding: '4px 10px',
            fontFamily: "'ArkPixel', monospace",
            fontSize: '10px',
            color: '#53d8fb',
            letterSpacing: '1px',
            pointerEvents: 'none',
          }}>
            WORLD MAP [W]
          </div>
        )}
        {editMode && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 12,
            background: 'rgba(34, 60, 80, 0.9)',
            border: '2px solid #88ccff',
            padding: '4px 10px',
            fontFamily: "'ArkPixel', monospace",
            fontSize: '10px',
            color: '#88ccff',
            letterSpacing: '1px',
            pointerEvents: 'none',
          }}>
            EDIT MODE [E]
          </div>
        )}
      </div>

      {/* Bottom 3-panel UI */}
      <BottomPanels
        activeRig={activeRig}
        onRigSelect={handleRigSelect}
        onMayorChat={openMayorSession}
        onAgentClick={(agent) => openAgentSession(agent)}
        onTerminalToggle={toggleTerminal}
        onSettingsToggle={toggleSettings}
        onActivityLogToggle={toggleActivityLog}
        onGiteaActivityToggle={toggleGiteaActivity}
        selectedAgent={selectedAgent}
        beadCount={beadCount}
        polecatCount={polecatCount}
      />

      {/* Notification toasts */}
      <NotificationToast />

      {/* Overlays */}
      <SettingsPanel
        visible={settingsOpen}
        onClose={closeSettings}
        onPreferencesChange={handlePreferencesChange}
      />
      <CharacterCustomizationPanel
        visible={customizeOpen}
        onClose={closeCustomize}
        agentId={customizeAgent?.id ?? selectedAgent}
        agentName={customizeAgent?.name ?? selectedAgent ?? 'Agent'}
        agentRig={customizeAgent?.rig}
      />
      <ActivityLogPanel visible={activityLogOpen} onClose={closeActivityLog} />
      <GiteaActivityPanel visible={giteaActivityOpen} onClose={closeGiteaActivity} />
      <SaveLoadPanel visible={saveLoadOpen} onClose={() => setSaveLoadOpen(false)} game={game} />
      <TerminalPanel visible={terminalOpen} onClose={closeTerminal} />
      <SessionViewer
        visible={sessionViewerOpen}
        onClose={closeSession}
        sessionName={sessionName}
        title={sessionTitle}
      />
      {deskAgent && (
        <AgentDeskView
          visible={deskViewOpen}
          onClose={closeDeskView}
          agentName={deskAgent.name}
          agentRig={deskAgent.rig}
          agentRole={deskAgent.role}
        />
      )}
      {inspectorAgent && (
        <InspectorPanel
          visible={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          agentName={inspectorAgent.name}
          agentRig={inspectorAgent.rig}
          agentRole={inspectorAgent.role}
        />
      )}
    </div>
  )
}
