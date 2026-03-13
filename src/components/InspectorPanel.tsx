import { useState, useRef, useEffect, useCallback } from 'react'
import { THEME } from '../constants'
import { PixelPanel, PixelButton } from './gba'

interface InspectorPanelProps {
  visible: boolean
  onClose: () => void
  agentName: string
  agentRig: string
  agentRole: string
}

interface InspectorData {
  name: string
  rig: string
  role?: string
  type?: string
  online?: boolean
  model?: string
  extra?: string
  polecatDetails?: string
  hookedBead?: string
  sessionName?: string
  transcriptTail?: string | null
  sessionCreatedAt?: number
  uptimeSeconds?: number
  costToday?: number
  totalCostToday?: number
  memoryFiles?: string | null
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd > 0) return `$${usd.toFixed(3)}`
  return '$0.00'
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: THEME.crtBg,
      border: `1px solid ${THEME.crtGreenDim}`,
      padding: '3px 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      minWidth: 60,
    }}>
      <div style={{ fontSize: 8, color: THEME.crtGreenDim, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 11, color, fontWeight: 'bold', textShadow: `0 0 4px ${color}` }}>{value}</div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 9,
      color: THEME.gold,
      letterSpacing: 2,
      textTransform: 'uppercase',
      padding: '6px 0 3px',
      borderBottom: `1px solid ${THEME.borderPanel}`,
      marginBottom: 4,
      fontFamily: THEME.fontFamily,
    }}>
      {label}
    </div>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 10, lineHeight: 1.6, fontFamily: THEME.fontFamily }}>
      <span style={{ color: THEME.textMuted, minWidth: 70 }}>{label}:</span>
      <span style={{ color: color || THEME.textPrimary, flex: 1, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

export function InspectorPanel({ visible, onClose, agentName, agentRig, agentRole: _agentRole }: InspectorPanelProps) {
  const [data, setData] = useState<InspectorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript' | 'bead'>('overview')
  const [pos, setPos] = useState({ x: -1, y: -1 })
  const dragging = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const transcriptRef = useRef<HTMLPreElement>(null)

  // Fetch inspector data
  useEffect(() => {
    if (!visible || !agentName) return
    setLoading(true)
    setData(null)

    async function fetchData() {
      try {
        const res = await fetch(`/api/agent-inspect/${encodeURIComponent(agentRig)}/${encodeURIComponent(agentName)}`)
        if (res.ok) {
          const json = await res.json()
          if (json.ok) setData(json)
        }
      } catch { /* bridge offline */ }
      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [visible, agentName, agentRig])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
  }, [data?.transcriptTail, activeTab])

  // Drag handling
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = (e.target as HTMLElement).closest('[data-inspector-panel]')
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragging.current = {
      startX: e.clientX, startY: e.clientY,
      ox: pos.x === -1 ? rect.left : pos.x,
      oy: pos.y === -1 ? rect.top : pos.y,
    }
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: dragging.current.ox + (e.clientX - dragging.current.startX),
        y: dragging.current.oy + (e.clientY - dragging.current.startY),
      })
    }
    function onUp() {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  if (!visible) return null

  const panelW = 440
  const panelH = 520
  const left = pos.x === -1 ? `calc(50vw - ${panelW / 2}px + 220px)` : pos.x
  const top = pos.y === -1 ? `calc(50vh - ${panelH / 2}px)` : pos.y

  const isOnline = data?.online ?? false
  const tabs: Array<{ id: 'overview' | 'transcript' | 'bead'; label: string }> = [
    { id: 'overview', label: 'Status' },
    { id: 'transcript', label: 'Terminal' },
    { id: 'bead', label: 'Bead' },
  ]

  return (
    <div
      data-inspector-panel
      style={{ position: 'fixed', left, top, width: panelW, height: panelH, zIndex: 1001 }}
    >
      <PixelPanel variant="dark" style={{ height: '100%', flexDirection: 'column' }}>
        {/* Header */}
        <div
          onMouseDown={onDragStart}
          style={{
            position: 'relative', zIndex: 1,
            padding: '6px 14px',
            background: THEME.bgHeader,
            display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: `2px solid ${THEME.borderAccent}`,
            cursor: 'grab', userSelect: 'none', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>&#x1F50D;</span>
          <span style={{ color: THEME.textPrimary, fontWeight: 'bold', fontSize: 12, flex: 1, fontFamily: THEME.fontFamily }}>
            {agentRig}/{agentName}
          </span>
          <span style={{
            color: isOnline ? THEME.green : THEME.red,
            fontSize: 9, letterSpacing: 1, fontFamily: THEME.fontFamily,
          }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          <PixelButton size="sm" onClick={onClose} style={{ padding: '0 6px', height: 20, minWidth: 0 }}>
            x
          </PixelButton>
        </div>

        {/* Tab bar */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', gap: 0,
          borderBottom: `1px solid ${THEME.borderPanel}`,
          flexShrink: 0,
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '5px 8px',
                background: activeTab === tab.id ? THEME.bgPanel : 'transparent',
                color: activeTab === tab.id ? THEME.gold : THEME.textMuted,
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${THEME.gold}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 10, fontFamily: THEME.fontFamily,
                letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'auto', minHeight: 0, padding: '8px 12px' }}>
          {loading && !data ? (
            <div style={{ color: THEME.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 40 }}>
              Loading agent data...
            </div>
          ) : !data ? (
            <div style={{ color: THEME.red, fontSize: 11, textAlign: 'center', paddingTop: 40 }}>
              Could not fetch agent data
            </div>
          ) : activeTab === 'overview' ? (
            <OverviewTab data={data} />
          ) : activeTab === 'transcript' ? (
            <TranscriptTab data={data} transcriptRef={transcriptRef} />
          ) : (
            <BeadTab data={data} />
          )}
        </div>
      </PixelPanel>
    </div>
  )
}

function OverviewTab({ data }: { data: InspectorData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Stat badges row */}
      <div style={{ display: 'flex', gap: 4 }}>
        <StatBadge
          label="Role"
          value={data.type || data.role || 'unknown'}
          color={THEME.cyan}
        />
        <StatBadge
          label="Uptime"
          value={data.uptimeSeconds != null ? formatUptime(data.uptimeSeconds) : '--'}
          color={THEME.green}
        />
        <StatBadge
          label="Cost"
          value={data.costToday != null ? formatCost(data.costToday) : '--'}
          color={data.costToday && data.costToday > 10 ? THEME.orange : THEME.crtGreen}
        />
      </div>

      {/* Identity section */}
      <SectionHeader label="Identity" />
      <InfoRow label="Name" value={data.name} />
      <InfoRow label="Rig" value={data.rig} />
      <InfoRow label="Role" value={data.role || data.type || 'unknown'} />
      <InfoRow label="Model" value={data.model || 'unknown'} color={THEME.cyan} />
      <InfoRow label="Session" value={data.sessionName || 'none'} color={THEME.textSecondary} />
      {data.extra && <InfoRow label="Extra" value={data.extra} />}

      {/* Runtime section */}
      <SectionHeader label="Runtime" />
      <InfoRow
        label="Status"
        value={data.online ? 'Online' : 'Offline'}
        color={data.online ? THEME.green : THEME.red}
      />
      {data.uptimeSeconds != null && (
        <InfoRow label="Uptime" value={formatUptime(data.uptimeSeconds)} color={THEME.green} />
      )}
      {data.costToday != null && (
        <InfoRow label="Session $" value={formatCost(data.costToday)} color={THEME.orange} />
      )}
      {data.totalCostToday != null && (
        <InfoRow label="Town $ today" value={formatCost(data.totalCostToday)} color={THEME.textSecondary} />
      )}

      {/* Polecat details */}
      {data.polecatDetails && (
        <>
          <SectionHeader label="Polecat Details" />
          <pre style={{
            margin: 0, padding: '4px 6px',
            fontSize: 9, lineHeight: 1.4,
            color: THEME.crtGreen, background: THEME.crtBg,
            border: `1px solid ${THEME.crtGreenDim}`,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 120, overflow: 'auto',
          }}>
            {data.polecatDetails}
          </pre>
        </>
      )}

      {/* Memory */}
      {data.memoryFiles && (
        <>
          <SectionHeader label="Memory" />
          <pre style={{
            margin: 0, padding: '4px 6px',
            fontSize: 9, lineHeight: 1.4,
            color: THEME.textSecondary, background: THEME.bgPanel,
            border: `1px solid ${THEME.borderPanel}`,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 80, overflow: 'auto',
          }}>
            {data.memoryFiles}
          </pre>
        </>
      )}
    </div>
  )
}

function TranscriptTab({ data, transcriptRef }: { data: InspectorData; transcriptRef: React.RefObject<HTMLPreElement> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 9, color: THEME.textMuted, marginBottom: 4, fontFamily: THEME.fontFamily }}>
        Session: {data.sessionName || 'none'} (last 30 lines)
      </div>
      <pre
        ref={transcriptRef}
        style={{
          flex: 1, margin: 0, padding: '6px 8px',
          fontSize: 10, lineHeight: 1.4,
          color: THEME.crtGreen, background: THEME.crtBg,
          border: `1px solid ${THEME.crtGreenDim}`,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          overflow: 'auto', minHeight: 0,
        }}
      >
        {data.transcriptTail ? data.transcriptTail : (
          <span style={{ color: THEME.textMuted }}>
            {data.online ? 'No transcript available' : 'Agent is offline'}
          </span>
        )}
      </pre>
    </div>
  )
}

function BeadTab({ data }: { data: InspectorData }) {
  const [beadDetail, setBeadDetail] = useState<string | null>(null)
  const [beadLoading, setBeadLoading] = useState(false)

  // Extract bead ID from hooked bead text
  const beadId = data.hookedBead?.match(/([a-zA-Z]+-[a-zA-Z0-9]+)/)?.[1] || null

  useEffect(() => {
    if (!beadId) return
    setBeadLoading(true)
    fetch(`/api/beads/${encodeURIComponent(beadId)}`)
      .then((r) => r.json())
      .then((json) => { if (json.ok) setBeadDetail(json.data) })
      .catch(() => {})
      .finally(() => setBeadLoading(false))
  }, [beadId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader label="Hooked Work" />
      {data.hookedBead ? (
        <pre style={{
          margin: 0, padding: '6px 8px',
          fontSize: 10, lineHeight: 1.5,
          color: THEME.textPrimary, background: THEME.bgPanel,
          border: `1px solid ${THEME.borderPanel}`,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 80, overflow: 'auto',
        }}>
          {data.hookedBead}
        </pre>
      ) : (
        <div style={{ color: THEME.textMuted, fontSize: 10 }}>No hooked bead</div>
      )}

      {beadId && (
        <>
          <SectionHeader label={`Bead: ${beadId}`} />
          {beadLoading ? (
            <div style={{ color: THEME.textMuted, fontSize: 10 }}>Loading bead details...</div>
          ) : beadDetail ? (
            <pre style={{
              margin: 0, padding: '6px 8px',
              fontSize: 9, lineHeight: 1.4,
              color: THEME.crtGreen, background: THEME.crtBg,
              border: `1px solid ${THEME.crtGreenDim}`,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              overflow: 'auto', flex: 1, minHeight: 0,
            }}>
              {beadDetail}
            </pre>
          ) : (
            <div style={{ color: THEME.textMuted, fontSize: 10 }}>Could not load bead details</div>
          )}
        </>
      )}
    </div>
  )
}
