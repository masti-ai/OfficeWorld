import { useEffect, useRef, useState, useCallback } from 'react'
import { THEME } from '../constants'

export interface ActivityEvent {
  id: string
  timestamp: number
  category: 'file' | 'tool' | 'git' | 'mail' | 'bead' | 'agent' | 'system'
  summary: string
  agent?: string
  rig?: string
}

const CATEGORY_COLORS: Record<ActivityEvent['category'], string> = {
  file: '#53d8fb',
  tool: '#ffaa00',
  git: '#22c55e',
  mail: '#c084fc',
  bead: '#ffd700',
  agent: '#e94560',
  system: '#9ca3af',
}

const CATEGORY_LABELS: Record<ActivityEvent['category'], string> = {
  file: 'FILE',
  tool: 'TOOL',
  git: 'GIT',
  mail: 'MAIL',
  bead: 'BEAD',
  agent: 'AGNT',
  system: 'SYS',
}

const MAX_EVENTS = 200

let nextId = 0
function makeId(): string {
  return `evt-${++nextId}-${Date.now()}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function parseFeedLine(line: string): ActivityEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  let category: ActivityEvent['category'] = 'system'
  if (/\b(commit|push|merge|rebase|branch|pull)\b/i.test(trimmed)) category = 'git'
  else if (/\b(mail|inbox|sent|received)\b/i.test(trimmed)) category = 'mail'
  else if (/\b(bead|wisp|molecule|issue|close|create)\b/i.test(trimmed)) category = 'bead'
  else if (/\b(polecat|witness|refinery|mayor|deacon|spawned|dispatched|online|offline)\b/i.test(trimmed)) category = 'agent'
  else if (/\b(edit|write|read|file|\.tsx?|\.jsx?|\.go|\.py)\b/i.test(trimmed)) category = 'file'
  else if (/\b(tool|exec|bash|command|run)\b/i.test(trimmed)) category = 'tool'

  return {
    id: makeId(),
    timestamp: Date.now(),
    category,
    summary: trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed,
  }
}

function parseWsMessage(msg: Record<string, unknown>): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const type = msg.type as string

  switch (type) {
    case 'gt-feed': {
      const data = (msg.data as string) || ''
      for (const line of data.split('\n')) {
        const evt = parseFeedLine(line)
        if (evt) events.push(evt)
      }
      break
    }
    case 'gt-mail': {
      const data = (msg.data as string) || ''
      const countMatch = data.match(/(\d+) unread/)
      if (countMatch && parseInt(countMatch[1]) > 0) {
        events.push({
          id: makeId(),
          timestamp: Date.now(),
          category: 'mail',
          summary: `${countMatch[1]} unread message${parseInt(countMatch[1]) !== 1 ? 's' : ''} in inbox`,
        })
      }
      break
    }
    case 'agent-status': {
      const name = (msg.name as string) || 'Agent'
      const status = (msg.status as string) || 'updated'
      const task = msg.task as string | undefined
      events.push({
        id: makeId(),
        timestamp: Date.now(),
        category: 'agent',
        agent: name,
        summary: `${name} ${status}${task ? ': ' + task : ''}`,
      })
      break
    }
    case 'gt-status-parsed': {
      const agents = msg.agents as Array<{ name: string; role: string; online: boolean }> | undefined
      if (agents) {
        const online = agents.filter(a => a.online).length
        events.push({
          id: makeId(),
          timestamp: Date.now(),
          category: 'system',
          summary: `Status update: ${online}/${agents.length} agents online`,
        })
      }
      break
    }
    case 'gt-notify': {
      events.push({
        id: makeId(),
        timestamp: Date.now(),
        category: (msg.category as ActivityEvent['category']) || 'system',
        summary: `${msg.title || 'Notification'}: ${msg.message || ''}`,
      })
      break
    }
    case 'gt-beads': {
      const data = (msg.data as string) || ''
      const lines = data.trim().split('\n').filter(Boolean)
      if (lines.length > 0) {
        events.push({
          id: makeId(),
          timestamp: Date.now(),
          category: 'bead',
          summary: `${lines.length} ready bead${lines.length !== 1 ? 's' : ''} in queue`,
        })
      }
      break
    }
    case 'gt-polecats': {
      const data = (msg.data as string) || ''
      const lines = data.trim().split('\n').filter(Boolean)
      if (lines.length > 0) {
        events.push({
          id: makeId(),
          timestamp: Date.now(),
          category: 'agent',
          summary: `Polecat roster: ${lines.length} tracked`,
        })
      }
      break
    }
  }

  return events
}

interface ActivityLogPanelProps {
  visible: boolean
  onClose: () => void
}

export function ActivityLogPanel({ visible, onClose }: ActivityLogPanelProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<ActivityEvent['category'] | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const addEvents = useCallback((newEvents: ActivityEvent[]) => {
    if (pausedRef.current || newEvents.length === 0) return
    setEvents(prev => {
      const combined = [...prev, ...newEvents]
      return combined.length > MAX_EVENTS ? combined.slice(-MAX_EVENTS) : combined
    })
  }, [])

  // Fetch initial feed data
  useEffect(() => {
    if (!visible) return
    async function fetchFeed() {
      try {
        const res = await fetch('/api/feed?lines=50')
        const json = await res.json()
        if (json.data) {
          const parsed = json.data.split('\n')
            .map((line: string) => parseFeedLine(line))
            .filter(Boolean) as ActivityEvent[]
          setEvents(parsed)
        }
      } catch { /* bridge not available */ }
    }
    fetchFeed()
  }, [visible])

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!visible) return
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`)
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            const newEvents = parseWsMessage(msg)
            addEvents(newEvents)
          } catch { /* ignore */ }
        }
        ws.onclose = () => {
          retryTimer = setTimeout(connect, 5000)
        }
      } catch { /* ws not available */ }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [visible, addEvents])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, autoScroll])

  if (!visible) return null

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter)

  const categories: Array<ActivityEvent['category'] | 'all'> = ['all', 'file', 'tool', 'git', 'mail', 'bead', 'agent', 'system']

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 700,
        height: 520,
        background: THEME.bgDark,
        border: `2px solid ${THEME.borderAccent}`,
        boxShadow: `0 0 24px rgba(100, 71, 125, 0.4), inset 0 0 40px rgba(0,0,0,0.3)`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: THEME.fontFamily,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${THEME.borderPanel}`,
          background: THEME.bgHeader,
        }}>
          <div style={{
            color: THEME.gold,
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 2,
          }}>
            ACTIVITY LOG
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 9,
              color: THEME.textMuted,
            }}>
              {filtered.length} events
            </span>
            <button
              onClick={() => setPaused(p => !p)}
              style={{
                background: paused ? THEME.orange : 'transparent',
                border: `1px solid ${paused ? THEME.orange : THEME.borderAccent}`,
                color: paused ? '#000' : THEME.textSecondary,
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                padding: '2px 8px',
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              {paused ? 'PAUSED' : 'PAUSE'}
            </button>
            <button
              onClick={() => { setAutoScroll(a => !a) }}
              style={{
                background: autoScroll ? THEME.crtGreenDim : 'transparent',
                border: `1px solid ${autoScroll ? THEME.crtGreenDim : THEME.borderAccent}`,
                color: autoScroll ? '#000' : THEME.textSecondary,
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                padding: '2px 8px',
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              AUTO
            </button>
            <button
              onClick={() => setEvents([])}
              style={{
                background: 'transparent',
                border: `1px solid ${THEME.borderAccent}`,
                color: THEME.textMuted,
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                padding: '2px 8px',
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              CLEAR
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: THEME.red,
                fontFamily: THEME.fontFamily,
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: '4px 12px',
          borderBottom: `1px solid ${THEME.borderDark}`,
          background: THEME.bgPanel,
          flexWrap: 'wrap',
        }}>
          {categories.map(cat => {
            const isActive = filter === cat
            const color = cat === 'all' ? THEME.textSecondary : CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  background: isActive ? color : 'transparent',
                  border: `1px solid ${isActive ? color : THEME.borderDark}`,
                  color: isActive ? '#000' : color,
                  fontFamily: THEME.fontFamily,
                  fontSize: 9,
                  padding: '1px 6px',
                  cursor: 'pointer',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  opacity: isActive ? 1 : 0.7,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { if (!isActive) (e.target as HTMLElement).style.opacity = '0.7' }}
              >
                {cat === 'all' ? 'ALL' : CATEGORY_LABELS[cat]}
              </button>
            )
          })}
        </div>

        {/* Log entries */}
        <div
          ref={logRef}
          onScroll={() => {
            if (!logRef.current) return
            const { scrollTop, scrollHeight, clientHeight } = logRef.current
            const atBottom = scrollHeight - scrollTop - clientHeight < 30
            if (autoScroll !== atBottom) setAutoScroll(atBottom)
          }}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
            background: THEME.bgDark,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{
              color: THEME.textMuted,
              fontSize: 11,
              padding: '20px 12px',
              textAlign: 'center',
            }}>
              {paused ? 'Log paused. Click PAUSE to resume.' : 'Waiting for activity...'}
            </div>
          ) : (
            filtered.map(evt => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: '2px 12px',
                  fontSize: 11,
                  lineHeight: 1.5,
                  borderBottom: `1px solid ${THEME.borderDark}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.bgPanel }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{
                  color: THEME.textMuted,
                  fontSize: 9,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {formatTime(evt.timestamp)}
                </span>
                <span style={{
                  color: CATEGORY_COLORS[evt.category],
                  fontSize: 8,
                  fontWeight: 'bold',
                  letterSpacing: 1,
                  width: 32,
                  flexShrink: 0,
                  marginTop: 3,
                  textAlign: 'center',
                }}>
                  {CATEGORY_LABELS[evt.category]}
                </span>
                {evt.agent && (
                  <span style={{
                    color: THEME.orange,
                    fontSize: 10,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {evt.agent}
                  </span>
                )}
                <span style={{
                  color: THEME.textPrimary,
                  flex: 1,
                  wordBreak: 'break-word',
                }}>
                  {evt.summary}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '4px 12px',
          borderTop: `1px solid ${THEME.borderPanel}`,
          background: THEME.bgPanel,
          fontSize: 9,
          color: THEME.textMuted,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>L = toggle log | Esc = close</span>
          <span>{autoScroll ? 'auto-scroll on' : 'scroll locked'}</span>
        </div>
      </div>
    </div>
  )
}
