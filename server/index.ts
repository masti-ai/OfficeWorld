import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import { exec } from 'child_process'
import {
  recordSnapshot, getHistory, pruneSnapshots,
  setPreference, getPreference, getAllPreferences,
  getLayoutByRigId, upsertLayoutForRig, deleteLayoutForRig,
  setAgentTraits, getAgentTraitsById,
  saveGameState, loadGameState, listGameSaves, deleteGameSave,
  closeDb,
} from './db.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const PORT = Number(process.env.PORT) || 3201
const GT_ROOT = process.env.GT_ROOT || '/home/pratham2/gt'
const ARCADE_ROOT = process.env.ARCADE_ROOT || '/home/pratham2/gt/gt_arcade/crew/manager'
const MESH_RELAY_URL = process.env.MESH_RELAY_URL || 'ws://localhost:3210/mesh'
const TOWN_ID = process.env.TOWN_ID || 'gt-local'
const TOWN_NAME = process.env.TOWN_NAME || 'Gas Town'
const CACHE_TTL_MS = 2000
const EXEC_TIMEOUT_MS = 10000
const POLL_INTERVAL_MS = 10000
const MESH_STATE_INTERVAL_MS = 15_000
const MESH_HEARTBEAT_INTERVAL_MS = 8_000
const MESH_RECONNECT_DELAY_MS = 5_000
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SNAPSHOT_RETENTION_DAYS = 7

// --- Cache layer ---

interface CacheEntry {
  data: string
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function getCached(key: string): string | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data
  }
  return null
}

function setCache(key: string, data: string): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// --- Command execution ---

function runCommand(cmd: string, timeout = EXEC_TIMEOUT_MS, cwd = GT_ROOT): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, {
      cwd,
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve(stdout)
      }
    })
  })
}

function runBdCommand(cmd: string): Promise<string> {
  return runCommand(cmd, EXEC_TIMEOUT_MS, ARCADE_ROOT)
}

async function cachedCommand(key: string, cmd: string, cwd?: string): Promise<string> {
  const cached = getCached(key)
  if (cached !== null) return cached

  const result = await runCommand(cmd, EXEC_TIMEOUT_MS, cwd)
  setCache(key, result)
  return result
}

app.use(express.json())

// --- Structured status parser ---

interface AgentInfo {
  name: string
  role: string
  rig: string
  online: boolean
  model: string
  type: 'mayor' | 'deacon' | 'witness' | 'refinery' | 'crew' | 'polecat'
  extra?: string // e.g. "MQ:1"
}

function parseGtStatus(raw: string): { agents: AgentInfo[]; rigs: string[] } {
  const agents: AgentInfo[] = []
  const rigs: string[] = []
  let currentRig = ''
  let currentSection: 'global' | 'crew' | 'polecats' | '' = 'global'

  for (const line of raw.split('\n')) {
    // Rig header: ─── rig_name/ ───
    const rigMatch = line.match(/─── (.+?)\/ ─/)
    if (rigMatch) {
      currentRig = rigMatch[1]
      rigs.push(currentRig)
      currentSection = ''
      continue
    }

    // Section headers
    if (line.includes('Crew (')) { currentSection = 'crew'; continue }
    if (line.includes('Polecats (')) { currentSection = 'polecats'; continue }

    // Global agents (mayor, deacon)
    const globalMatch = line.match(/^.+?(mayor|deacon)\s+(●|○)\s+\[(.+?)\]/)
    if (globalMatch) {
      agents.push({
        name: globalMatch[1],
        role: globalMatch[1],
        rig: 'global',
        online: globalMatch[2] === '●',
        model: globalMatch[3],
        type: globalMatch[1] as 'mayor' | 'deacon',
      })
      continue
    }

    // Rig-level agents (witness, refinery)
    const rigAgentMatch = line.match(/^.+?(witness|refinery)\s+(●|○)\s+\[(.+?)\](.*)/)
    if (rigAgentMatch && currentRig) {
      agents.push({
        name: rigAgentMatch[1],
        role: rigAgentMatch[1],
        rig: currentRig,
        online: rigAgentMatch[2] === '●',
        model: rigAgentMatch[3],
        type: rigAgentMatch[1] as 'witness' | 'refinery',
        extra: rigAgentMatch[4].trim() || undefined,
      })
      continue
    }

    // Crew/polecat members (indented: "   name   ● [model]")
    const memberMatch = line.match(/^\s{3,}(\S+)\s+(●|○)\s+\[(.+?)\]/)
    if (memberMatch && currentRig) {
      agents.push({
        name: memberMatch[1],
        role: memberMatch[1],
        rig: currentRig,
        online: memberMatch[2] === '●',
        model: memberMatch[3],
        type: currentSection === 'polecats' ? 'polecat' : 'crew',
      })
    }
  }

  return { agents, rigs }
}

// --- Command execution endpoint (terminal) ---

const ALLOWED_CMD_PREFIXES = ['gt ', 'bd ']

app.post('/api/exec', async (req, res) => {
  const { cmd } = req.body
  if (!cmd || typeof cmd !== 'string') {
    res.status(400).json({ ok: false, error: 'Missing cmd' })
    return
  }

  const isAllowed = ALLOWED_CMD_PREFIXES.some((p) => cmd.startsWith(p))
  if (!isAllowed) {
    res.status(403).json({ ok: false, error: 'Only gt and bd commands are allowed' })
    return
  }

  try {
    // bd commands run from arcade root for correct bead resolution
    const cwd = cmd.startsWith('bd ') ? ARCADE_ROOT : GT_ROOT
    const output = await runCommand(cmd + ' 2>&1', EXEC_TIMEOUT_MS, cwd)
    res.json({ ok: true, output })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Command failed'
    res.json({ ok: true, output: '', error: message })
  }
})

// --- REST endpoints: status ---

app.get('/api/status', async (_req, res) => {
  try {
    const output = await cachedCommand('status', 'gt status 2>/dev/null')
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get status' })
  }
})

app.get('/api/status/parsed', async (_req, res) => {
  try {
    const output = await cachedCommand('status', 'gt status 2>/dev/null')
    const parsed = parseGtStatus(output)
    res.json({ ok: true, ...parsed })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get status' })
  }
})

// --- REST endpoints: convoy ---

app.get('/api/convoy', async (_req, res) => {
  try {
    const output = await cachedCommand('convoy', 'gt convoy list 2>/dev/null')
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get convoy' })
  }
})

// --- REST endpoints: mail ---

app.get('/api/mail', async (_req, res) => {
  try {
    const output = await cachedCommand('mail', 'gt mail inbox 2>/dev/null')
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get mail' })
  }
})

// --- REST endpoints: polecats ---

app.get('/api/polecats', async (_req, res) => {
  try {
    const output = await cachedCommand('polecats', 'gt polecat list --all 2>/dev/null')
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get polecats' })
  }
})

// --- REST endpoints: beads ---

app.get('/api/beads', async (_req, res) => {
  try {
    const output = await cachedCommand('beads', 'bd list 2>/dev/null', ARCADE_ROOT)
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get beads' })
  }
})

app.get('/api/beads/ready', async (_req, res) => {
  try {
    const output = await cachedCommand('beads-ready', 'bd ready 2>/dev/null', ARCADE_ROOT)
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get ready beads' })
  }
})

app.get('/api/beads/blocked', async (_req, res) => {
  try {
    const output = await cachedCommand('beads-blocked', 'bd blocked 2>/dev/null', ARCADE_ROOT)
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get blocked beads' })
  }
})

app.get('/api/beads/:id', async (req, res) => {
  const { id } = req.params
  // Sanitize bead ID
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    res.status(400).json({ ok: false, error: 'Invalid bead ID' })
    return
  }
  try {
    const output = await runBdCommand(`bd show ${id} 2>/dev/null`)
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: `Failed to get bead ${id}` })
  }
})

// --- REST endpoints: agent hooks (bead assignments) ---

interface AgentHookInfo {
  agent: string
  rig: string
  beadId: string
  title: string
  status: string
}

function parseAgentHooks(polecatRaw: string, beadsRaw: string): AgentHookInfo[] {
  const hooks: AgentHookInfo[] = []

  // Parse polecat list for hook assignments
  // Format varies but typically: "  name   ● [model]  hook: bead-id"
  // Also parse beads for assignee info
  // Format: "? bead-id · Title   [STATUS]"  with "Assignee: rig/polecats/name"

  // Parse from beads list - look for assigned/hooked beads
  for (const line of beadsRaw.split('\n')) {
    // Match bead lines: "? gta-abc · Title   [● STATUS]"
    const beadMatch = line.match(/^[?!●○✓]\s+([\w-]+)\s+[·:]\s+(.+?)\s+\[([^\]]+)\]/)
    if (beadMatch) {
      const beadId = beadMatch[1]
      const title = beadMatch[2].trim()
      const statusRaw = beadMatch[3].replace(/[●○]\s*/, '').trim()
      // We'll match these with assignees below
      hooks.push({
        agent: '',
        rig: '',
        beadId,
        title,
        status: statusRaw.toLowerCase().replace(/\s+/g, '_'),
      })
    }
  }

  // Parse polecat list for name -> hook mappings
  let currentRig = ''
  for (const line of polecatRaw.split('\n')) {
    const rigMatch = line.match(/─── (.+?)\/ ─/)
    if (rigMatch) {
      currentRig = rigMatch[1]
      continue
    }

    // Look for polecat lines with hook info
    // e.g., "   rictus   ● [opus]  -> gta-dmr"
    const hookMatch = line.match(/^\s+(\S+)\s+[●○]\s+\[.*?\].*?(?:->|hook:?|→)\s*([\w-]+)/)
    if (hookMatch && currentRig) {
      const agentName = hookMatch[1]
      const beadId = hookMatch[2]
      // Find matching bead in our list
      const existing = hooks.find(h => h.beadId === beadId)
      if (existing) {
        existing.agent = agentName
        existing.rig = currentRig
      } else {
        hooks.push({
          agent: agentName,
          rig: currentRig,
          beadId,
          title: '',
          status: 'hooked',
        })
      }
    }
  }

  return hooks.filter(h => h.agent !== '')
}

app.get('/api/agent-hooks', async (_req, res) => {
  try {
    const [polecatRaw, beadsRaw] = await Promise.all([
      cachedCommand('polecats', 'gt polecat list --all 2>/dev/null'),
      cachedCommand('beads', 'bd list 2>/dev/null', ARCADE_ROOT),
    ])
    const hooks = parseAgentHooks(polecatRaw, beadsRaw)
    res.json({ ok: true, hooks })
  } catch {
    res.json({ ok: true, hooks: [] })
  }
})

// --- REST endpoints: agent inspector ---

app.get('/api/agent-inspect/:rig/:name', async (req, res) => {
  const { rig, name } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(rig) || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    res.status(400).json({ ok: false, error: 'Invalid rig or agent name' })
    return
  }

  const results: Record<string, unknown> = { rig, name }

  // Get agent info from parsed status
  try {
    const raw = getCached('status') || await cachedCommand('status', 'gt status 2>/dev/null')
    const parsed = parseGtStatus(raw)
    const agent = parsed.agents.find((a) => a.name === name && (a.rig === rig || rig === 'hq'))
    if (agent) {
      results.role = agent.role
      results.type = agent.type
      results.online = agent.online
      results.model = agent.model
      results.extra = agent.extra
    }
  } catch { /* skip */ }

  // Get polecat details (hook, uptime, session info)
  try {
    const polecatRaw = await runCommand(`gt polecat show ${name} 2>/dev/null`)
    results.polecatDetails = polecatRaw.trim()
  } catch { /* not a polecat or not found */ }

  // Get hooked bead
  try {
    const hookRaw = await runCommand(
      `gt hook --polecat ${name} 2>/dev/null`
    )
    results.hookedBead = hookRaw.trim()
  } catch { /* skip */ }

  // Get session transcript tail
  const RIG_PREFIX: Record<string, string> = {
    planogram: 'vap', alc_ai: 'vaa', arcade: 'gta',
  }
  const prefix = RIG_PREFIX[rig] || rig
  let sessionName = ''
  if (name === 'mayor') sessionName = 'hq-mayor'
  else if (name === 'deacon') sessionName = 'hq-deacon'
  else if (name === 'witness' || name === 'refinery') sessionName = `${prefix}-${name}`
  else sessionName = `${prefix}-crew-${name}`

  results.sessionName = sessionName

  try {
    const transcript = await runCommand(
      `tmux capture-pane -t "${sessionName}" -p -S -30 2>/dev/null`
    )
    results.transcriptTail = transcript
  } catch {
    results.transcriptTail = null
  }

  // Get session start time (uptime)
  try {
    const sessionInfo = await runCommand(
      `tmux display-message -t "${sessionName}" -p "#{session_created}" 2>/dev/null`
    )
    const created = parseInt(sessionInfo.trim(), 10)
    if (!isNaN(created)) {
      results.sessionCreatedAt = created
      results.uptimeSeconds = Math.floor(Date.now() / 1000) - created
    }
  } catch { /* skip */ }

  // Get cost data for this agent's role
  try {
    const costsRaw = getCached('costs-today')
    if (costsRaw) {
      const costsData = JSON.parse(costsRaw)
      if (costsData.by_role) {
        // Try to find cost by agent name or role
        const costKey = Object.keys(costsData.by_role).find(
          (k) => k.toLowerCase().includes(name.toLowerCase())
        )
        if (costKey) {
          results.costToday = costsData.by_role[costKey]
        }
      }
      results.totalCostToday = costsData.total_usd
    }
  } catch { /* skip */ }

  // Get memory file info (check if agent has memory dir)
  try {
    const memoryCheck = await runCommand(
      `ls -la ${process.env.CLAUDE_MEMORY_PATH || '/home/pratham2/.claude/projects/*/memory/MEMORY.md'} 2>/dev/null | head -5`
    )
    results.memoryFiles = memoryCheck.trim() || null
  } catch {
    results.memoryFiles = null
  }

  res.json({ ok: true, ...results })
})

// --- REST endpoints: feed ---

app.get('/api/feed', async (req, res) => {
  const lines = Number(req.query.lines) || 50
  try {
    const output = await cachedCommand('feed', `gt feed 2>/dev/null | tail -${lines}`)
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get feed' })
  }
})

// --- REST endpoints: sessions (tmux) ---

app.get('/api/sessions', async (_req, res) => {
  try {
    const output = await cachedCommand('sessions', 'tmux list-sessions 2>/dev/null')
    const sessions = output.trim().split('\n').filter(Boolean).map((line) => {
      const match = line.match(/^(.+?):\s+(\d+)\s+windows?\s+\(created\s+(.+?)\)(\s+\(attached\))?/)
      if (!match) return { name: line.split(':')[0], raw: line }
      return {
        name: match[1],
        windows: Number(match[2]),
        created: match[3],
        attached: !!match[4],
      }
    })
    res.json({ ok: true, sessions })
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to list sessions' })
  }
})

app.get('/api/sessions/:name/capture', async (req, res) => {
  const { name } = req.params
  const lines = Number(req.query.lines) || 100
  // Sanitize session name to prevent injection
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    res.status(400).json({ ok: false, error: 'Invalid session name' })
    return
  }
  try {
    const output = await runCommand(
      `tmux capture-pane -t "${name}" -p -S -${lines} 2>/dev/null`
    )
    res.json({ ok: true, data: output, session: name })
  } catch {
    res.status(500).json({ ok: false, error: `Failed to capture session: ${name}` })
  }
})

// --- REST endpoints: mayor chat ---

app.post('/api/mayor-chat', async (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== 'string') {
    res.status(400).json({ ok: false, error: 'Missing message' })
    return
  }

  // Sanitize: strip shell-dangerous characters for the nudge command
  const sanitized = message.replace(/[`$\\!"]/g, '')

  try {
    // Send message to mayor via gt nudge
    await runCommand(`gt nudge mayor '${sanitized.replace(/'/g, "'\\''")}'`)
    res.json({
      ok: true,
      reply: "Message sent to the Mayor. They'll respond when available.",
      delivered: true,
    })
  } catch {
    // If nudge fails, try via mail as fallback
    try {
      await runCommand(
        `gt mail send mayor/ -s "Arcade Chat" -m '${sanitized.replace(/'/g, "'\\''")}'`
      )
      res.json({
        ok: true,
        reply: "Mayor is busy. Message queued via mail.",
        delivered: true,
        method: 'mail',
      })
    } catch {
      res.json({
        ok: false,
        reply: "Couldn't reach the Mayor right now. Try again later.",
        delivered: false,
      })
    }
  }
})

// Get mayor session output (for polling responses)
app.get('/api/mayor-chat/history', async (_req, res) => {
  try {
    const output = await runCommand(
      'tmux capture-pane -t "hq-mayor" -p -S -200 2>/dev/null'
    )
    res.json({ ok: true, data: output })
  } catch {
    res.status(500).json({ ok: false, error: 'Mayor session not available' })
  }
})

// --- REST endpoints: cache health ---

app.get('/api/cache/health', (_req, res) => {
  const now = Date.now()
  const health: Record<string, { age_ms: number; stale: boolean }> = {}
  for (const [key, entry] of cache.entries()) {
    const age = now - entry.timestamp
    health[key] = { age_ms: age, stale: age > CACHE_TTL_MS }
  }
  res.json({ ok: true, ttl_ms: CACHE_TTL_MS, keys: health })
})

// --- REST endpoints: preferences ---

const ALLOWED_PREF_KEYS = ['fontSize', 'theme', 'keybindings', 'zoom', 'panelLayout']

app.get('/api/preferences', (_req, res) => {
  const prefs = getAllPreferences()
  res.json({ ok: true, preferences: prefs })
})

app.get('/api/preferences/:key', (req, res) => {
  const { key } = req.params
  if (!ALLOWED_PREF_KEYS.includes(key)) {
    res.status(400).json({ ok: false, error: `Unknown preference key: ${key}` })
    return
  }
  const value = getPreference(key)
  res.json({ ok: true, key, value })
})

app.post('/api/preferences', (req, res) => {
  const { preferences } = req.body
  if (!preferences || typeof preferences !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing preferences object' })
    return
  }
  for (const [key, value] of Object.entries(preferences)) {
    if (!ALLOWED_PREF_KEYS.includes(key)) continue
    setPreference(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  res.json({ ok: true, saved: Object.keys(preferences).filter(k => ALLOWED_PREF_KEYS.includes(k)) })
})

// --- REST endpoints: agent traits (character customization) ---

const AGENT_ID_RE = /^[a-zA-Z0-9_.-]+$/

app.get('/api/agent-traits/:agentId', (req, res) => {
  const { agentId } = req.params
  if (!AGENT_ID_RE.test(agentId)) {
    res.status(400).json({ ok: false, error: 'Invalid agent ID' })
    return
  }
  const json = getAgentTraitsById(agentId)
  if (json) {
    try {
      res.json({ ok: true, traits: JSON.parse(json) })
    } catch {
      res.json({ ok: true, traits: null })
    }
  } else {
    res.json({ ok: true, traits: null })
  }
})

app.post('/api/agent-traits/:agentId', (req, res) => {
  const { agentId } = req.params
  if (!AGENT_ID_RE.test(agentId)) {
    res.status(400).json({ ok: false, error: 'Invalid agent ID' })
    return
  }
  const { traits } = req.body
  if (!traits || typeof traits !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing traits object' })
    return
  }
  try {
    setAgentTraits(agentId, JSON.stringify(traits))
    res.json({ ok: true, agentId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save traits'
    res.status(500).json({ ok: false, error: message })
  }
})

// --- REST endpoints: layouts ---

const RIG_ID_RE = /^[a-zA-Z0-9_-]+$/

app.get('/api/layouts/:rigId', (req, res) => {
  const { rigId } = req.params
  if (!RIG_ID_RE.test(rigId)) {
    res.status(400).json({ ok: false, error: 'Invalid rig ID' })
    return
  }

  const row = getLayoutByRigId(rigId)
  if (row) {
    res.json({ ok: true, layout: JSON.parse(row.layout_json), created_at: row.created_at, updated_at: row.updated_at })
  } else {
    // Return default layout from DynamicRoomGenerator
    res.json({ ok: true, layout: null, default: true })
  }
})

app.put('/api/layouts/:rigId', (req, res) => {
  const { rigId } = req.params
  if (!RIG_ID_RE.test(rigId)) {
    res.status(400).json({ ok: false, error: 'Invalid rig ID' })
    return
  }

  const { layout } = req.body
  if (!layout || typeof layout !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing layout object in request body' })
    return
  }

  try {
    upsertLayoutForRig(rigId, JSON.stringify(layout))
    res.json({ ok: true, rigId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save layout'
    res.status(500).json({ ok: false, error: message })
  }
})

app.delete('/api/layouts/:rigId', (req, res) => {
  const { rigId } = req.params
  if (!RIG_ID_RE.test(rigId)) {
    res.status(400).json({ ok: false, error: 'Invalid rig ID' })
    return
  }

  const deleted = deleteLayoutForRig(rigId)
  if (deleted) {
    res.json({ ok: true, rigId, deleted: true })
  } else {
    res.status(404).json({ ok: false, error: `No custom layout found for rig: ${rigId}` })
  }
})

// --- REST endpoints: game saves ---

const SAVE_SLOT_RE = /^[a-zA-Z0-9_-]{1,64}$/

app.get('/api/saves', (_req, res) => {
  const saves = listGameSaves()
  res.json({ ok: true, saves })
})

app.get('/api/saves/:slot', (req, res) => {
  const { slot } = req.params
  if (!SAVE_SLOT_RE.test(slot)) {
    res.status(400).json({ ok: false, error: 'Invalid save slot' })
    return
  }
  const save = loadGameState(slot)
  if (save) {
    try {
      res.json({ ok: true, save: { ...save, state: JSON.parse(save.state_json), state_json: undefined } })
    } catch {
      res.json({ ok: true, save: null })
    }
  } else {
    res.json({ ok: true, save: null })
  }
})

app.post('/api/saves/:slot', (req, res) => {
  const { slot } = req.params
  if (!SAVE_SLOT_RE.test(slot)) {
    res.status(400).json({ ok: false, error: 'Invalid save slot' })
    return
  }
  const { name, state, autosave } = req.body
  if (!state || typeof state !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing state object' })
    return
  }
  const saveName = typeof name === 'string' ? name : slot
  try {
    saveGameState(slot, saveName, JSON.stringify(state), !!autosave)
    res.json({ ok: true, slot, name: saveName })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save game state'
    res.status(500).json({ ok: false, error: message })
  }
})

app.delete('/api/saves/:slot', (req, res) => {
  const { slot } = req.params
  if (!SAVE_SLOT_RE.test(slot)) {
    res.status(400).json({ ok: false, error: 'Invalid save slot' })
    return
  }
  const deleted = deleteGameSave(slot)
  if (deleted) {
    res.json({ ok: true, slot, deleted: true })
  } else {
    res.status(404).json({ ok: false, error: `No save found for slot: ${slot}` })
  }
})

// --- REST endpoints: costs (total, not just live sessions) ---

app.get('/api/costs/today', async (_req, res) => {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      exec('gt costs --today --by-role --json 2>/dev/null', { timeout: EXEC_TIMEOUT_MS }, (err, stdout) => {
        if (err) reject(err); else resolve(stdout)
      })
    })
    const parsed = JSON.parse(output)
    res.json({ ok: true, ...parsed })
  } catch {
    res.json({ ok: false, total_usd: 0, period: 'today', error: 'Failed to fetch costs' })
  }
})

app.get('/api/costs/week', async (_req, res) => {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      exec('gt costs --week --by-role --json 2>/dev/null', { timeout: EXEC_TIMEOUT_MS }, (err, stdout) => {
        if (err) reject(err); else resolve(stdout)
      })
    })
    const parsed = JSON.parse(output)
    res.json({ ok: true, ...parsed })
  } catch {
    res.json({ ok: false, total_usd: 0, period: 'this week', error: 'Failed to fetch costs' })
  }
})

// --- REST endpoints: cost history ---

app.get('/api/history/:key', (req, res) => {
  const { key } = req.params
  const since = Number(req.query.since) || Math.floor(Date.now() / 1000) - 86400 // default 24h
  const rows = getHistory(key, since)
  res.json({ ok: true, key, rows })
})

// --- WebSocket ---

interface WsClient extends WebSocket {
  terminalSubscription?: string
}

function broadcast(data: Record<string, unknown>) {
  const msg = JSON.stringify(data)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  }
}

const POLL_ENDPOINTS = [
  { key: 'status', cmd: 'gt status 2>/dev/null', type: 'gt-status' },
  { key: 'convoy', cmd: 'gt convoy list 2>/dev/null', type: 'gt-convoy' },
  { key: 'polecats', cmd: 'gt polecat list --all 2>/dev/null', type: 'gt-polecats' },
  { key: 'mail', cmd: 'gt mail inbox 2>/dev/null', type: 'gt-mail' },
  { key: 'beads-ready', cmd: 'bd ready 2>/dev/null', type: 'gt-beads', cwd: ARCADE_ROOT },
  { key: 'feed', cmd: 'gt feed 2>/dev/null | tail -30', type: 'gt-feed' },
  { key: 'sessions', cmd: 'tmux list-sessions 2>/dev/null', type: 'gt-sessions' },
  { key: 'costs-today', cmd: 'gt costs --today --by-role --json 2>/dev/null', type: 'gt-costs-today' },
  { key: 'costs-live', cmd: 'gt costs --json 2>/dev/null', type: 'gt-costs-live' },
]

async function pollAndBroadcast() {
  for (const ep of POLL_ENDPOINTS) {
    try {
      const output = await cachedCommand(ep.key, ep.cmd, (ep as { cwd?: string }).cwd)
      broadcast({ type: ep.type, data: output })
    } catch {
      // Command unavailable, skip
    }
  }

  // Also broadcast parsed status for structured consumers
  try {
    const raw = getCached('status')
    if (raw) {
      broadcast({ type: 'gt-status-parsed', ...parseGtStatus(raw) })
    }
  } catch {
    // Skip
  }
}

setInterval(pollAndBroadcast, POLL_INTERVAL_MS)

// --- WebSocket terminal streaming ---

function cleanupTerminal(ws: WsClient) {
  ws.terminalSubscription = undefined
}

wss.on('connection', (rawWs) => {
  const ws = rawWs as WsClient
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Gas Town Arcade' }))

  // Send initial state
  pollAndBroadcast()

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      switch (msg.type) {
        // Subscribe to a tmux session's output (read-only stream)
        case 'terminal-subscribe': {
          const session = msg.session
          if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid session name' }))
            return
          }

          // Clean up any existing subscription
          cleanupTerminal(ws)
          ws.terminalSubscription = session

          // Start streaming session output via periodic capture
          const intervalId = setInterval(async () => {
            if (ws.readyState !== WebSocket.OPEN || ws.terminalSubscription !== session) {
              clearInterval(intervalId)
              return
            }
            try {
              const output = await runCommand(
                `tmux capture-pane -t "${session}" -p -S -50 2>/dev/null`
              )
              ws.send(JSON.stringify({ type: 'terminal-output', session, data: output }))
            } catch {
              ws.send(JSON.stringify({ type: 'terminal-error', session, error: 'Session ended' }))
              clearInterval(intervalId)
            }
          }, 2000) // Capture every 2s
          break
        }

        // Send input to a tmux session
        case 'terminal-input': {
          const session = msg.session
          const input = msg.data
          if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid session name' }))
            return
          }
          // Use tmux send-keys to forward input
          exec(
            `tmux send-keys -t "${session}" "${input.replace(/"/g, '\\"')}" 2>/dev/null`,
            { cwd: GT_ROOT, timeout: 3000 }
          )
          break
        }

        // Unsubscribe from terminal
        case 'terminal-unsubscribe': {
          cleanupTerminal(ws)
          ws.send(JSON.stringify({ type: 'terminal-closed' }))
          break
        }

        // Request immediate data refresh
        case 'refresh': {
          cache.clear()
          pollAndBroadcast()
          break
        }
      }
    } catch {
      // Non-JSON or malformed message, ignore
    }
  })

  ws.on('close', () => {
    cleanupTerminal(ws)
  })
})

// --- Mesh client: connect to mesh relay ---

let meshWs: WebSocket | null = null
let meshConnected = false
let meshHeartbeatTimer: ReturnType<typeof setInterval> | null = null
let meshStateTimer: ReturnType<typeof setInterval> | null = null
let meshReconnectTimer: ReturnType<typeof setTimeout> | null = null

interface MeshStatus {
  connected: boolean
  relayUrl: string
  townId: string
  townName: string
  connectedTowns: Array<{ townId: string; name: string; rigs: string[]; agentCount: number }>
  lastError?: string
}

const meshStatus: MeshStatus = {
  connected: false,
  relayUrl: MESH_RELAY_URL,
  townId: TOWN_ID,
  townName: TOWN_NAME,
  connectedTowns: [],
}

function meshSend(data: Record<string, unknown>): void {
  if (meshWs && meshWs.readyState === WebSocket.OPEN) {
    meshWs.send(JSON.stringify(data))
  }
}

async function buildTownState(): Promise<{
  rigs: string[]
  agentCount: number
  agents: Array<{ name: string; role: string; online: boolean }>
  beadCount: number
  activePolecats: number
}> {
  try {
    const raw = getCached('status') || await cachedCommand('status', 'gt status 2>/dev/null')
    const parsed = parseGtStatus(raw)
    const onlineAgents = parsed.agents.filter((a) => a.online)
    const activePolecats = parsed.agents.filter((a) => a.type === 'polecat' && a.online).length

    let beadCount = 0
    try {
      const beadsRaw = getCached('beads') || await cachedCommand('beads', 'bd list 2>/dev/null', ARCADE_ROOT)
      beadCount = beadsRaw.trim().split('\n').filter(Boolean).length
    } catch { /* skip */ }

    return {
      rigs: parsed.rigs,
      agentCount: onlineAgents.length,
      agents: parsed.agents.map((a) => ({ name: a.name, role: a.role, online: a.online })),
      beadCount,
      activePolecats,
    }
  } catch {
    return { rigs: [], agentCount: 0, agents: [], beadCount: 0, activePolecats: 0 }
  }
}

function connectToMeshRelay(): void {
  if (meshWs && (meshWs.readyState === WebSocket.CONNECTING || meshWs.readyState === WebSocket.OPEN)) {
    return
  }

  console.log(`Mesh client: connecting to ${MESH_RELAY_URL}...`)

  try {
    meshWs = new WebSocket(MESH_RELAY_URL)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed'
    console.error(`Mesh client: failed to create WebSocket: ${msg}`)
    meshStatus.lastError = msg
    scheduleMeshReconnect()
    return
  }

  meshWs.on('open', async () => {
    console.log('Mesh client: connected to relay')
    meshConnected = true
    meshStatus.connected = true
    delete meshStatus.lastError

    // Announce this town
    const state = await buildTownState()
    meshSend({
      type: 'town-announce',
      townId: TOWN_ID,
      name: TOWN_NAME,
      rigs: state.rigs,
      agentCount: state.agentCount,
    })

    // Start heartbeat
    meshHeartbeatTimer = setInterval(() => {
      meshSend({ type: 'heartbeat' })
    }, MESH_HEARTBEAT_INTERVAL_MS)

    // Start periodic town-state updates
    meshStateTimer = setInterval(async () => {
      const s = await buildTownState()
      meshSend({
        type: 'town-state',
        townId: TOWN_ID,
        agents: s.agents,
        beadCount: s.beadCount,
        activePolecats: s.activePolecats,
      })
    }, MESH_STATE_INTERVAL_MS)
  })

  meshWs.on('message', (raw) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    const msgType = msg.type as string

    switch (msgType) {
      case 'welcome':
        // Store initial town list from relay
        if (Array.isArray(msg.connectedTowns)) {
          meshStatus.connectedTowns = msg.connectedTowns as MeshStatus['connectedTowns']
        }
        break

      case 'announce-ack':
        if (Array.isArray(msg.connectedTowns)) {
          meshStatus.connectedTowns = msg.connectedTowns as MeshStatus['connectedTowns']
        }
        break

      case 'town-announce': {
        // A new town joined — add to our list
        const t = msg as { townId: string; name: string; rigs: string[]; agentCount: number }
        meshStatus.connectedTowns = meshStatus.connectedTowns.filter((c) => c.townId !== t.townId)
        meshStatus.connectedTowns.push({ townId: t.townId, name: t.name, rigs: t.rigs || [], agentCount: t.agentCount || 0 })
        // Broadcast to local WS clients
        broadcast({ type: 'mesh-town-announce', town: t })
        break
      }

      case 'town-disconnect': {
        const disconnectedId = msg.townId as string
        meshStatus.connectedTowns = meshStatus.connectedTowns.filter((c) => c.townId !== disconnectedId)
        broadcast({ type: 'mesh-town-disconnect', townId: disconnectedId, reason: msg.reason })
        break
      }

      case 'town-list':
        if (Array.isArray(msg.towns)) {
          meshStatus.connectedTowns = (msg.towns as MeshStatus['connectedTowns']).filter((t) => t.townId !== TOWN_ID)
        }
        broadcast({ type: 'mesh-town-list', towns: meshStatus.connectedTowns })
        break

      case 'town-state':
        // Update cached state for this town
        if (msg.townId !== TOWN_ID) {
          const idx = meshStatus.connectedTowns.findIndex((t) => t.townId === msg.townId)
          if (idx >= 0 && typeof msg.agentCount === 'number') {
            meshStatus.connectedTowns[idx].agentCount = msg.agentCount as number
          }
          broadcast({ type: 'mesh-town-state', ...msg })
        }
        break

      case 'agent-visit':
      case 'mesh-message':
      case 'portal-state':
        // Forward remote events to local dashboard clients
        broadcast({ type: `mesh-${msgType}`, ...msg })
        break

      case 'heartbeat-ack':
        break

      case 'server-shutdown':
        console.log('Mesh client: relay shutting down')
        break

      case 'error':
        console.error(`Mesh relay error: ${msg.error}`)
        meshStatus.lastError = msg.error as string
        break
    }
  })

  meshWs.on('close', () => {
    console.log('Mesh client: disconnected from relay')
    cleanupMeshTimers()
    meshConnected = false
    meshStatus.connected = false
    scheduleMeshReconnect()
  })

  meshWs.on('error', (err) => {
    console.error(`Mesh client error: ${err.message}`)
    meshStatus.lastError = err.message
    meshStatus.connected = false
    meshConnected = false
    cleanupMeshTimers()
    scheduleMeshReconnect()
  })
}

function cleanupMeshTimers(): void {
  if (meshHeartbeatTimer) { clearInterval(meshHeartbeatTimer); meshHeartbeatTimer = null }
  if (meshStateTimer) { clearInterval(meshStateTimer); meshStateTimer = null }
}

function scheduleMeshReconnect(): void {
  if (meshReconnectTimer) return
  meshReconnectTimer = setTimeout(() => {
    meshReconnectTimer = null
    connectToMeshRelay()
  }, MESH_RECONNECT_DELAY_MS)
}

function disconnectMeshRelay(): void {
  cleanupMeshTimers()
  if (meshReconnectTimer) { clearTimeout(meshReconnectTimer); meshReconnectTimer = null }
  if (meshWs) {
    meshWs.removeAllListeners()
    if (meshWs.readyState === WebSocket.OPEN) {
      meshWs.close(1000, 'bridge shutdown')
    }
    meshWs = null
  }
  meshConnected = false
  meshStatus.connected = false
}

// --- Mesh REST endpoints ---

app.get('/api/mesh/status', (_req, res) => {
  res.json({ ok: true, ...meshStatus })
})

app.get('/api/mesh/towns', (_req, res) => {
  res.json({ ok: true, towns: meshStatus.connectedTowns, self: { townId: TOWN_ID, name: TOWN_NAME } })
})

app.post('/api/mesh/connect', (_req, res) => {
  if (meshConnected) {
    res.json({ ok: true, message: 'Already connected to mesh relay' })
    return
  }
  connectToMeshRelay()
  res.json({ ok: true, message: 'Connecting to mesh relay...' })
})

// --- Gitea activity feed & contribution endpoints ---

const GITEA_URL = process.env.GITEA_URL || 'http://localhost:3300'
const GITEA_TOKEN = process.env.GITEA_TOKEN || ''
const GITEA_REPOS = ['Deepwork-AI/OfficeWorld', 'Deepwork-AI/gt-arcade', 'Deepwork-AI/ai-planogram', 'Deepwork-AI/alc-ai-villa', 'Deepwork-AI/content-studio']
const GITEA_CACHE_TTL_MS = 30_000

const giteaCache = new Map<string, CacheEntry>()

function getGiteaCached(key: string): string | null {
  const entry = giteaCache.get(key)
  if (entry && Date.now() - entry.timestamp < GITEA_CACHE_TTL_MS) return entry.data
  return null
}

function setGiteaCache(key: string, data: string): void {
  giteaCache.set(key, { data, timestamp: Date.now() })
}

async function giteaFetch(path: string): Promise<unknown> {
  const url = `${GITEA_URL}/api/v1${path}`
  const resp = await fetch(url, {
    headers: { Authorization: `token ${GITEA_TOKEN}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!resp.ok) throw new Error(`Gitea ${resp.status}: ${resp.statusText}`)
  return resp.json()
}

function detectModel(commitMessage: string, authorName: string): string {
  const lower = commitMessage.toLowerCase()
  if (lower.includes('claude')) return 'Claude'
  if (lower.includes('minimax')) return 'MiniMax'
  if (lower.includes('kimi')) return 'Kimi'
  // Fallback: check author name patterns
  const authorLower = authorName.toLowerCase()
  if (authorLower === 'pratham' || authorLower.includes('pratham')) return 'Human'
  // Most Gas Town agents use Claude
  return 'Claude'
}

interface GiteaCommit {
  sha: string
  commit: {
    message: string
    author: { name: string; email: string; date: string }
  }
}

interface GiteaIssue {
  number: number
  title: string
  state: string
  closed_at: string | null
  created_at: string
  user: { login: string }
  labels: Array<{ name: string }>
  pull_request?: unknown
}

interface GiteaPR {
  number: number
  title: string
  state: string
  merged: boolean
  merged_at: string | null
  created_at: string
  user: { login: string }
}

interface ActivityItem {
  type: 'commit' | 'pr_merge' | 'issue_close' | 'issue_open' | 'pr_open'
  repo: string
  title: string
  author: string
  model: string
  date: string
  sha?: string
  number?: number
}

app.get('/api/gitea/activity', async (_req, res) => {
  const cached = getGiteaCached('activity')
  if (cached) { res.json(JSON.parse(cached)); return }

  const items: ActivityItem[] = []

  await Promise.all(GITEA_REPOS.map(async (repo) => {
    const repoShort = repo.split('/')[1]
    try {
      const commits = await giteaFetch(`/repos/${repo}/commits?limit=10`) as GiteaCommit[]
      for (const c of commits) {
        items.push({
          type: 'commit',
          repo: repoShort,
          title: c.commit.message.split('\n')[0].slice(0, 100),
          author: c.commit.author.name,
          model: detectModel(c.commit.message, c.commit.author.name),
          date: c.commit.author.date,
          sha: c.sha.slice(0, 8),
        })
      }
    } catch { /* repo may not exist */ }

    try {
      const issues = await giteaFetch(`/repos/${repo}/issues?limit=8&state=closed&type=issues`) as GiteaIssue[]
      for (const i of issues) {
        if (i.pull_request) continue
        items.push({
          type: 'issue_close',
          repo: repoShort,
          title: i.title.slice(0, 100),
          author: i.user.login,
          model: detectModel('', i.user.login),
          date: i.closed_at || i.created_at,
          number: i.number,
        })
      }
    } catch { /* skip */ }

    try {
      const prs = await giteaFetch(`/repos/${repo}/pulls?limit=8&state=closed`) as GiteaPR[]
      for (const p of prs) {
        if (p.merged) {
          items.push({
            type: 'pr_merge',
            repo: repoShort,
            title: p.title.slice(0, 100),
            author: p.user.login,
            model: detectModel('', p.user.login),
            date: p.merged_at || p.created_at,
            number: p.number,
          })
        }
      }
    } catch { /* skip */ }
  }))

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const result = { ok: true, items: items.slice(0, 50) }
  setGiteaCache('activity', JSON.stringify(result))
  res.json(result)
})

app.get('/api/gitea/heatmap', async (_req, res) => {
  const cached = getGiteaCached('heatmap')
  if (cached) { res.json(JSON.parse(cached)); return }

  const users = ['gt-local', 'gasclaw-1', 'gasclaw-2', 'pratham', 'mayor', 'gta-coordinator']
  const heatmap: Record<number, number> = {}

  await Promise.all(users.map(async (user) => {
    try {
      const data = await giteaFetch(`/users/${user}/heatmap`) as Array<{ timestamp: number; contributions: number }>
      for (const d of data) {
        heatmap[d.timestamp] = (heatmap[d.timestamp] || 0) + d.contributions
      }
    } catch { /* user may not exist */ }
  }))

  // Convert to sorted array
  const entries = Object.entries(heatmap)
    .map(([ts, count]) => ({ timestamp: Number(ts), contributions: count }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const result = { ok: true, heatmap: entries }
  setGiteaCache('heatmap', JSON.stringify(result))
  res.json(result)
})

app.get('/api/gitea/contributions', async (_req, res) => {
  const cached = getGiteaCached('contributions')
  if (cached) { res.json(JSON.parse(cached)); return }

  const modelCounts: Record<string, number> = { Claude: 0, MiniMax: 0, Kimi: 0, Human: 0 }

  await Promise.all(GITEA_REPOS.map(async (repo) => {
    try {
      const commits = await giteaFetch(`/repos/${repo}/commits?limit=50`) as GiteaCommit[]
      for (const c of commits) {
        const model = detectModel(c.commit.message, c.commit.author.name)
        modelCounts[model] = (modelCounts[model] || 0) + 1
      }
    } catch { /* skip */ }
  }))

  const total = Object.values(modelCounts).reduce((a, b) => a + b, 0)
  const result = {
    ok: true,
    models: Object.entries(modelCounts).map(([name, count]) => ({
      name,
      commits: count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
    total,
  }
  setGiteaCache('contributions', JSON.stringify(result))
  res.json(result)
})

// --- Pre-warm cache on startup ---

async function prewarmCache() {
  console.log('Pre-warming cache...')
  for (const ep of POLL_ENDPOINTS) {
    try {
      await cachedCommand(ep.key, ep.cmd, (ep as { cwd?: string }).cwd)
    } catch {
      // Command unavailable at startup, skip
    }
  }
  console.log('Cache pre-warm complete')
}

// --- Snapshot recording (every 5 minutes) ---

const SNAPSHOT_KEYS = ['status', 'polecats', 'beads-ready', 'mail']

function recordSnapshots() {
  for (const key of SNAPSHOT_KEYS) {
    const data = getCached(key)
    if (data !== null) {
      recordSnapshot(key, data)
    }
  }
}

// Prune snapshots older than retention period once per hour
function pruneOldSnapshots() {
  const cutoff = Math.floor(Date.now() / 1000) - (SNAPSHOT_RETENTION_DAYS * 86400)
  pruneSnapshots(cutoff)
}

setInterval(recordSnapshots, SNAPSHOT_INTERVAL_MS)
setInterval(pruneOldSnapshots, 60 * 60 * 1000)

// --- Graceful shutdown ---

process.on('SIGTERM', () => {
  disconnectMeshRelay()
  closeDb()
  process.exit(0)
})
process.on('SIGINT', () => {
  disconnectMeshRelay()
  closeDb()
  process.exit(0)
})

// --- Start server ---

server.listen(PORT, () => {
  console.log(`Gas Town Arcade bridge server listening on :${PORT}`)
  console.log(`  REST API: http://localhost:${PORT}/api/*`)
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`  GT_ROOT: ${GT_ROOT}`)
  console.log(`  Mesh relay: ${MESH_RELAY_URL}`)
  prewarmCache()
  connectToMeshRelay()
})
