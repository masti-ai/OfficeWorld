import { useEffect, useState } from 'react'
import { THEME } from '../constants'
import { PixelPanel, PixelButton } from './gba'

interface AgentInfo {
  name: string
  role: string
  status: 'online' | 'offline'
  rig: string
}

interface BottomPanelsProps {
  activeRig: string
  onRigSelect: (rigId: string) => void
  onMayorChat: () => void
  onAgentClick: (agent: AgentInfo) => void
  onTerminalToggle: () => void
  onSettingsToggle: () => void
  onActivityLogToggle: () => void
  onGiteaActivityToggle?: () => void
  selectedAgent: string | null
  beadCount: number
  polecatCount: number
}

const RIGS = [
  { id: 'planogram', name: 'Planogram', icon: '\u{1F4CA}' },
  { id: 'alc_ai', name: 'ALC AI', icon: '\u{1F9EA}' },
  { id: 'arcade', name: 'Arcade', icon: '\u{1F579}' },
]

function parseAgentsFromStatus(text: string): AgentInfo[] {
  const agents: AgentInfo[] = []
  const lines = text.split('\n')
  let currentRig = ''
  for (const line of lines) {
    const rigMatch = line.match(/─── (\w+)\/ ─/)
    if (rigMatch) { currentRig = rigMatch[1]; continue }
    const topMatch = line.match(/(🎩|🐺)\s+(\w[\w-]*)\s+(●|○)/)
    if (topMatch) { agents.push({ name: topMatch[2], role: topMatch[1] === '🎩' ? 'Mayor' : 'Deacon', status: topMatch[3] === '●' ? 'online' : 'offline', rig: 'hq' }); continue }
    const agentMatch = line.match(/(🦉|🏭)\s+(\w[\w-]*)\s+(●|○)/)
    if (agentMatch) { const roleMap: Record<string, string> = { '🦉': 'Witness', '🏭': 'Refinery' }; agents.push({ name: agentMatch[2], role: roleMap[agentMatch[1]] || agentMatch[2], status: agentMatch[3] === '●' ? 'online' : 'offline', rig: currentRig }); continue }
    const crewMatch = line.match(/^\s{3,}(\w[\w-]*)\s+(●|○)\s+\[/)
    if (crewMatch) { agents.push({ name: crewMatch[1], role: 'Worker', status: crewMatch[2] === '●' ? 'online' : 'offline', rig: currentRig }) }
  }
  return agents
}

// --- Status Panel (left) ---

function StatusPanel({ selectedAgent, beadCount, polecatCount }: { selectedAgent: string | null; beadCount: number; polecatCount: number }) {
  const [feed, setFeed] = useState<string[]>([])

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/feed').then((r) => r.json()).catch(() => null)
        if (res?.data) setFeed(res.data.split('\n').filter((l: string) => l.trim()).slice(0, 8))
      } catch { /* */ }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <PixelPanel title="Memo" style={{ flex: '1 1 420px', minWidth: 280 }}>
      <div style={{ fontSize: 11, color: THEME.textSecondary, lineHeight: 1.5 }}>
        {selectedAgent && (
          <div style={{ color: THEME.orange, marginBottom: 4, fontWeight: 'bold' }}>
            {'\u{1F441}'} Watching: {selectedAgent}
          </div>
        )}
        {feed.length > 0 ? feed.map((line, i) => (
          <div key={i} style={{ opacity: 1 - i * 0.06, borderBottom: `1px solid ${THEME.borderDark}`, padding: '2px 0' }}>{line}</div>
        )) : (
          <div style={{ color: THEME.textMuted }}>
            <div style={{ marginBottom: 4 }}>--- Gas Town Arcade ---</div>
            <div>Beads on floor: {beadCount}</div>
            <div>Active polecats: {polecatCount}</div>
            <div style={{ marginTop: 8, color: THEME.textMuted }}>Waiting for activity feed...</div>
          </div>
        )}
      </div>
    </PixelPanel>
  )
}

function StatCard({ label, value, color, barPct }: { label: string; value: string; color: string; barPct: number }) {
  return (
    <div style={{
      flex: 1,
      background: THEME.crtBg,
      padding: '4px 6px',
      border: `1px solid ${THEME.crtGreenDim}`,
    }}>
      <div style={{ color: THEME.crtGreenDim, marginBottom: 2, fontSize: 8, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontWeight: 'bold', fontSize: 11, textShadow: `0 0 4px ${color}` }}>{value}</div>
      <div style={{
        marginTop: 2,
        width: '100%',
        height: 3,
        background: '#0a1a0a',
        border: `1px solid ${THEME.crtGreenDim}`,
      }}>
        <div style={{
          width: `${barPct}%`,
          height: '100%',
          background: color,
          boxShadow: `0 0 3px ${color}`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// --- Control Panel (center) ---

interface CostData {
  todayTotal: number
  liveTotal: number
  byRole: Record<string, number>
  meshConnected: boolean
  meshTowns: number
}

function ControlPanel({ activeRig, onRigSelect, onTerminalToggle, onSettingsToggle, onActivityLogToggle, onGiteaActivityToggle, onMayorChat }: { activeRig: string; onRigSelect: (rigId: string) => void; onTerminalToggle: () => void; onSettingsToggle: () => void; onActivityLogToggle: () => void; onGiteaActivityToggle?: () => void; onMayorChat: () => void }) {
  const [costs, setCosts] = useState<CostData>({ todayTotal: 0, liveTotal: 0, byRole: {}, meshConnected: false, meshTowns: 0 })
  const [rigs, setRigs] = useState(RIGS)

  useEffect(() => {
    async function fetchCosts() {
      try {
        const [todayRes, liveRes, meshRes, statusRes] = await Promise.all([
          fetch('/api/costs/today').then((r) => r.json()).catch(() => null),
          fetch('/api/costs').then((r) => r.json()).catch(() => null),
          fetch('/api/mesh/status').then((r) => r.json()).catch(() => null),
          fetch('/api/status/parsed').then((r) => r.json()).catch(() => null),
        ])

        setCosts({
          todayTotal: todayRes?.total_usd || 0,
          liveTotal: liveRes?.data ? parseFloat((liveRes.data.match(/Total: \$([0-9.]+)/) || [])[1] || '0') : 0,
          byRole: todayRes?.by_role || {},
          meshConnected: meshRes?.connected || false,
          meshTowns: meshRes?.connectedTowns?.length || 0,
        })

        // Build dynamic rig list from API
        if (statusRes?.rigs && statusRes.rigs.length > 0) {
          const rigIcons: Record<string, string> = {
            villa_ai_planogram: '\u{1F4CA}', villa_alc_ai: '\u{1F9EA}', gt_arcade: '\u{1F579}',
          }
          const shortNames: Record<string, string> = {
            villa_ai_planogram: 'Planogram', villa_alc_ai: 'ALC AI', gt_arcade: 'Arcade',
          }
          setRigs(statusRes.rigs.map((r: string) => ({
            id: r.replace('villa_ai_', '').replace('villa_', '').replace('gt_', ''),
            fullId: r,
            name: shortNames[r] || r.split('_').pop() || r,
            icon: rigIcons[r] || '\u{1F3E2}',
          })))
        }
      } catch { /* bridge not running */ }
    }
    fetchCosts()
    const interval = setInterval(fetchCosts, 15000)
    return () => clearInterval(interval)
  }, [])

  function formatCost(usd: number): string {
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`
    if (usd >= 1) return `$${usd.toFixed(0)}`
    return `$${usd.toFixed(2)}`
  }

  const costColor = costs.todayTotal > 500 ? THEME.red : costs.todayTotal > 100 ? THEME.orange : THEME.green

  return (
    <PixelPanel title="Control" style={{ flex: '1 1 360px', minWidth: 240 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        {/* Rig buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {rigs.map((rig) => {
            const isActive = activeRig === rig.id
            return (
              <PixelButton
                key={rig.id}
                onClick={() => onRigSelect(rig.id)}
                variant={isActive ? 'primary' : 'default'}
                size="sm"
                style={{ flex: 1 }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div>{rig.icon}</div>
                  <div style={{ marginTop: 2, fontSize: 9 }}>{rig.name}</div>
                </div>
              </PixelButton>
            )
          })}
        </div>

        {/* Cost breakdown (stat buff cards) */}
        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: THEME.textMuted }}>
          <StatCard label="LIVE $" value={formatCost(costs.liveTotal)} color={THEME.crtGreen}
            barPct={Math.min(100, (costs.liveTotal / 50) * 100)} />
          <StatCard label="TODAY $" value={formatCost(costs.todayTotal)} color={costColor}
            barPct={Math.min(100, (costs.todayTotal / 500) * 100)} />
          <StatCard label="MESH" value={costs.meshConnected ? `${costs.meshTowns} towns` : 'off'}
            color={costs.meshConnected ? THEME.crtGreen : THEME.textMuted}
            barPct={costs.meshConnected ? 100 : 0} />
        </div>

        {/* Top cost roles */}
        {Object.keys(costs.byRole).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 9 }}>
            {Object.entries(costs.byRole)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([role, cost]) => (
                <span key={role} style={{
                  background: THEME.crtBg,
                  border: `1px solid ${THEME.crtGreenDim}`,
                  padding: '1px 5px',
                  color: THEME.crtGreenDim,
                }}>
                  {role}: <span style={{ color: THEME.crtGreen, textShadow: THEME.phosphorGlowSubtle }}>{formatCost(cost)}</span>
                </span>
              ))}
          </div>
        )}

        {/* Action icon grid */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PixelButton size="sm" onClick={onTerminalToggle} style={{ width: 52, height: 44, flexDirection: 'column' }}>
            <span style={{ fontSize: 16 }}>{'>'}</span>
            <span style={{ fontSize: 9 }}>Terminal</span>
          </PixelButton>
          <PixelButton size="sm" onClick={onMayorChat} style={{ width: 52, height: 44, flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontFamily: 'sans-serif' }}>{'\u{1F3A9}'}</span>
            <span style={{ fontSize: 9 }}>Mayor</span>
          </PixelButton>
          <PixelButton size="sm" onClick={onActivityLogToggle} style={{ width: 52, height: 44, flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontFamily: 'sans-serif' }}>{'\u{1F4DC}'}</span>
            <span style={{ fontSize: 9 }}>Log</span>
          </PixelButton>
          <PixelButton size="sm" onClick={onGiteaActivityToggle} style={{ width: 52, height: 44, flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontFamily: 'sans-serif' }}>{'\u{1F4CA}'}</span>
            <span style={{ fontSize: 9 }}>Gitea</span>
          </PixelButton>
          <PixelButton size="sm" onClick={onSettingsToggle} style={{ width: 52, height: 44, flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontFamily: 'sans-serif' }}>{'\u2699'}</span>
            <span style={{ fontSize: 9 }}>Settings</span>
          </PixelButton>
        </div>

        {/* Hints */}
        <div style={{ marginTop: 'auto', fontSize: 9, color: THEME.textMuted, lineHeight: 1.6, fontFamily: THEME.fontFamily }}>
          Drag=pan | Scroll=zoom | Click=select | ~=term | M=mayor | L=log | G=gitea | Esc=close
        </div>
      </div>
    </PixelPanel>
  )
}

// --- Agents Panel (right) ---

function AgentsPanel({ onMayorChat, onAgentClick }: { onMayorChat: () => void; onAgentClick: (agent: AgentInfo) => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/status')
        if (res.ok) { const { data } = await res.json(); if (data) { setAgents(parseAgentsFromStatus(data)) } }
      } catch { /* bridge offline */ }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])

  const byRig = new Map<string, AgentInfo[]>()
  for (const a of agents) { const list = byRig.get(a.rig) || []; list.push(a); byRig.set(a.rig, list) }

  const online = agents.filter((a) => a.status === 'online').length
  const total = agents.length

  return (
    <PixelPanel title="Agents" style={{ flex: '1 1 360px', minWidth: 240 }}>
      <div style={{ position: 'absolute', top: 6, right: 10, fontSize: 9, color: online > 0 ? THEME.green : THEME.textMuted, zIndex: 2, fontFamily: THEME.fontFamily }}>
        {online}/{total}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {agents.length === 0 ? (
          <div style={{ color: THEME.textMuted, fontSize: 10 }}>Waiting for bridge...</div>
        ) : (
          Array.from(byRig.entries()).map(([rig, rigAgents]) => (
            <div key={rig}>
              <div style={{ padding: '4px 0 1px', color: THEME.goldDim, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontFamily: THEME.fontFamily }}>
                {rig || 'hq'}
              </div>
              {rigAgents.map((a) => (
                <div
                  key={`${rig}-${a.name}`}
                  onClick={() => a.role === 'Mayor' ? onMayorChat() : onAgentClick(a)}
                  style={{
                    padding: '3px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: a.status === 'offline' ? 0.4 : 1,
                    fontSize: 11,
                    fontFamily: THEME.fontFamily,
                  }}
                >
                  <span style={{ color: a.status === 'online' ? THEME.green : THEME.textMuted, fontSize: 7 }}>{'\u25CF'}</span>
                  <span style={{ color: THEME.textPrimary, flex: 1 }}>{a.name}</span>
                  <span style={{ color: THEME.textMuted, fontSize: 9 }}>{a.role}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </PixelPanel>
  )
}

// --- Export ---

export function BottomPanels(props: BottomPanelsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 0,
      maxWidth: 1280,
      width: '100%',
      margin: '0 auto',
      height: 240,
      flexShrink: 0,
    }}>
      <StatusPanel selectedAgent={props.selectedAgent} beadCount={props.beadCount} polecatCount={props.polecatCount} />
      <ControlPanel activeRig={props.activeRig} onRigSelect={props.onRigSelect} onTerminalToggle={props.onTerminalToggle} onSettingsToggle={props.onSettingsToggle} onActivityLogToggle={props.onActivityLogToggle} onGiteaActivityToggle={props.onGiteaActivityToggle} onMayorChat={props.onMayorChat} />
      <AgentsPanel onMayorChat={props.onMayorChat} onAgentClick={props.onAgentClick} />
    </div>
  )
}
