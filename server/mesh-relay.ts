import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

// --- Types ---

interface TownAnnounce {
  type: 'town-announce'
  townId: string
  name: string
  rigs: string[]
  agentCount: number
}

interface AgentVisit {
  type: 'agent-visit'
  from: { town: string; agent: string }
  to: { town: string }
  duration: number
}

interface MeshMessage {
  type: 'mesh-message'
  from: { town: string; agent: string }
  to: { town: string; agent: string }
  subject: string
}

interface TownState {
  type: 'town-state'
  townId: string
  agents: Array<{ name: string; role: string; online: boolean }>
  beadCount: number
  activePolecats: number
}

interface PortalState {
  type: 'portal-state'
  townId: string
  portalId: string
  connected: boolean
  targetTown: string
}

interface Heartbeat {
  type: 'heartbeat'
}

interface TownDisconnect {
  type: 'town-disconnect'
  townId: string
  reason: string
}

type MeshProtocol =
  | TownAnnounce
  | AgentVisit
  | MeshMessage
  | TownState
  | PortalState
  | Heartbeat
  | TownDisconnect

// --- Connected town tracking ---

interface ConnectedTown {
  townId: string
  name: string
  rigs: string[]
  agentCount: number
  ws: WebSocket
  lastHeartbeat: number
  state?: Omit<TownState, 'type'>
}

const PORT = Number(process.env.MESH_RELAY_PORT) || 3210
const HEARTBEAT_INTERVAL_MS = 10_000
const HEARTBEAT_TIMEOUT_MS = 30_000

const towns = new Map<string, ConnectedTown>()
const wsByTown = new WeakMap<WebSocket, string>()

// --- Helpers ---

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function broadcastToAll(data: Record<string, unknown>, exclude?: WebSocket): void {
  const msg = JSON.stringify(data)
  for (const town of towns.values()) {
    if (town.ws !== exclude && town.ws.readyState === WebSocket.OPEN) {
      town.ws.send(msg)
    }
  }
}

function broadcastToTown(townId: string, data: Record<string, unknown>): boolean {
  const town = towns.get(townId)
  if (!town || town.ws.readyState !== WebSocket.OPEN) return false
  send(town.ws, data)
  return true
}

function getTownList(): Array<{ townId: string; name: string; rigs: string[]; agentCount: number }> {
  return Array.from(towns.values()).map((t) => ({
    townId: t.townId,
    name: t.name,
    rigs: t.rigs,
    agentCount: t.agentCount,
  }))
}

function removeTown(ws: WebSocket, reason: string): void {
  const townId = wsByTown.get(ws)
  if (!townId) return

  towns.delete(townId)
  wsByTown.delete(ws)

  console.log(`Town disconnected: ${townId} (${reason})`)

  broadcastToAll({
    type: 'town-disconnect',
    townId,
    reason,
  })

  // Broadcast updated town list
  broadcastToAll({ type: 'town-list', towns: getTownList() })
}

// --- Message handlers ---

function handleTownAnnounce(ws: WebSocket, msg: TownAnnounce): void {
  const { townId, name, rigs, agentCount } = msg

  if (!townId || !name) {
    send(ws, { type: 'error', error: 'town-announce requires townId and name' })
    return
  }

  // If this townId is already connected from a different socket, reject
  const existing = towns.get(townId)
  if (existing && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
    send(ws, { type: 'error', error: `Town ${townId} is already connected` })
    return
  }

  const town: ConnectedTown = {
    townId,
    name,
    rigs: rigs || [],
    agentCount: agentCount || 0,
    ws,
    lastHeartbeat: Date.now(),
  }

  towns.set(townId, town)
  wsByTown.set(ws, townId)

  console.log(`Town announced: ${townId} (${name}), ${town.rigs.length} rigs, ${agentCount} agents`)

  // Acknowledge
  send(ws, {
    type: 'announce-ack',
    townId,
    connectedTowns: getTownList().filter((t) => t.townId !== townId),
  })

  // Notify others
  broadcastToAll(
    { type: 'town-announce', townId, name, rigs: town.rigs, agentCount },
    ws
  )
}

function handleAgentVisit(ws: WebSocket, msg: AgentVisit): void {
  const { from, to, duration } = msg

  if (!from?.town || !from?.agent || !to?.town) {
    send(ws, { type: 'error', error: 'agent-visit requires from.town, from.agent, and to.town' })
    return
  }

  // Route to target town
  const delivered = broadcastToTown(to.town, {
    type: 'agent-visit',
    from,
    to,
    duration: duration || 0,
  })

  if (!delivered) {
    send(ws, { type: 'error', error: `Town ${to.town} is not connected` })
  }
}

function handleMeshMessage(ws: WebSocket, msg: MeshMessage): void {
  const { from, to, subject } = msg

  if (!from?.town || !from?.agent || !to?.town || !to?.agent) {
    send(ws, { type: 'error', error: 'mesh-message requires from and to with town and agent' })
    return
  }

  // Route to target town
  const delivered = broadcastToTown(to.town, {
    type: 'mesh-message',
    from,
    to,
    subject: subject || '',
  })

  if (!delivered) {
    send(ws, {
      type: 'message-bounce',
      originalTo: to,
      reason: `Town ${to.town} is not connected`,
    })
  }
}

function handleTownState(ws: WebSocket, msg: TownState): void {
  const { townId, agents, beadCount, activePolecats } = msg
  const townEntry = towns.get(townId)

  if (!townEntry || townEntry.ws !== ws) {
    send(ws, { type: 'error', error: 'Cannot update state for a town you did not announce' })
    return
  }

  townEntry.agentCount = agents?.length || 0
  townEntry.state = { townId, agents: agents || [], beadCount: beadCount || 0, activePolecats: activePolecats || 0 }

  // Broadcast state to all other towns
  broadcastToAll(
    { type: 'town-state', townId, agents: agents || [], beadCount: beadCount || 0, activePolecats: activePolecats || 0 },
    ws
  )
}

function handlePortalState(ws: WebSocket, msg: PortalState): void {
  const { townId, portalId, connected, targetTown } = msg
  const townEntry = towns.get(townId)

  if (!townEntry || townEntry.ws !== ws) {
    send(ws, { type: 'error', error: 'Cannot update portal for a town you did not announce' })
    return
  }

  // Broadcast portal state to all towns
  broadcastToAll(
    { type: 'portal-state', townId, portalId, connected, targetTown },
    ws
  )

  // Also notify the target town specifically
  if (targetTown && connected) {
    broadcastToTown(targetTown, {
      type: 'portal-state',
      townId,
      portalId,
      connected,
      targetTown,
    })
  }
}

function handleHeartbeat(ws: WebSocket): void {
  const townId = wsByTown.get(ws)
  if (!townId) return

  const town = towns.get(townId)
  if (town) {
    town.lastHeartbeat = Date.now()
  }

  send(ws, { type: 'heartbeat-ack', ts: Date.now() })
}

// --- Server setup ---

const server = http.createServer((_req, res) => {
  // Health check endpoint
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      towns: getTownList(),
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const wss = new WebSocketServer({ server, path: '/mesh' })

wss.on('connection', (ws) => {
  console.log('New mesh connection')

  send(ws, {
    type: 'welcome',
    message: 'Connected to Gas Town Mesh Relay',
    connectedTowns: getTownList(),
  })

  ws.on('message', (raw) => {
    let msg: MeshProtocol
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', error: 'Invalid JSON' })
      return
    }

    if (!msg.type) {
      send(ws, { type: 'error', error: 'Missing message type' })
      return
    }

    switch (msg.type) {
      case 'town-announce':
        handleTownAnnounce(ws, msg)
        break
      case 'agent-visit':
        handleAgentVisit(ws, msg)
        break
      case 'mesh-message':
        handleMeshMessage(ws, msg)
        break
      case 'town-state':
        handleTownState(ws, msg)
        break
      case 'portal-state':
        handlePortalState(ws, msg)
        break
      case 'heartbeat':
        handleHeartbeat(ws)
        break
      default:
        send(ws, { type: 'error', error: `Unknown message type: ${(msg as { type: string }).type}` })
    }
  })

  ws.on('close', () => {
    removeTown(ws, 'connection closed')
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
    removeTown(ws, 'connection error')
  })
})

// --- Heartbeat checker: evict stale towns ---

const heartbeatChecker = setInterval(() => {
  const now = Date.now()
  for (const [townId, town] of towns) {
    if (now - town.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      console.log(`Evicting stale town: ${townId} (no heartbeat for ${HEARTBEAT_TIMEOUT_MS}ms)`)
      town.ws.close(1000, 'heartbeat timeout')
      removeTown(town.ws, 'heartbeat timeout')
    }
  }
}, HEARTBEAT_INTERVAL_MS)

// --- Graceful shutdown ---

function shutdown() {
  console.log('Mesh relay shutting down...')
  clearInterval(heartbeatChecker)

  for (const town of towns.values()) {
    send(town.ws, { type: 'server-shutdown' })
    town.ws.close(1000, 'server shutdown')
  }
  towns.clear()

  wss.close(() => {
    server.close(() => {
      console.log('Mesh relay stopped')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// --- Start ---

server.listen(PORT, () => {
  console.log(`Gas Town Mesh Relay listening on :${PORT}`)
  console.log(`  WebSocket: ws://localhost:${PORT}/mesh`)
  console.log(`  Health:    http://localhost:${PORT}/health`)
})
