import { useEffect, useState } from 'react'
import Phaser from 'phaser'
import { THEME } from '../constants'

interface StatusData {
  unreadMail: number
  activePolecat: number
}

interface RigInfo {
  name: string
  agents: number
  maxAgents: number
  color: string
}

function parseCount(text: string, pattern: RegExp): number {
  const match = text.match(pattern)
  return match ? parseInt(match[1], 10) : 0
}

// Pixel-art HP bar with GBA-style segments
function HPBar({
  label,
  value,
  max,
  color,
  dimColor,
  width = 64,
}: {
  label: string
  value: number
  max: number
  color: string
  dimColor: string
  width?: number
}) {
  const segments = 8
  const filled = max > 0 ? Math.round((value / max) * segments) : 0
  const segW = Math.floor((width - (segments - 1)) / segments)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{
        fontSize: 8,
        fontFamily: THEME.fontFamily,
        color: THEME.textSecondary,
        letterSpacing: 1,
        width: 24,
        textAlign: 'right',
        fontWeight: 'bold',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 1 }}>
        {Array.from({ length: segments }, (_, i) => {
          const isFilled = i < filled
          return (
            <div key={i} style={{
              width: segW,
              height: 6,
              background: isFilled ? color : '#0a0c14',
              border: `1px solid ${isFilled ? dimColor : '#1a1e2e'}`,
              boxShadow: isFilled ? `0 0 2px ${color}40` : 'none',
              imageRendering: 'pixelated',
            }} />
          )
        })}
      </div>
      <span style={{
        fontSize: 8,
        fontFamily: THEME.fontFamily,
        color,
        fontWeight: 'bold',
        minWidth: 16,
        textAlign: 'right',
      }}>
        {value}/{max}
      </span>
    </div>
  )
}

// XP progress bar — full-width gradient fill
function XPBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* XP label pixel icon */}
      <div style={{
        width: 10,
        height: 10,
        position: 'relative',
        imageRendering: 'pixelated',
      }}>
        {/* Star shape via pixel blocks */}
        <div style={{ position: 'absolute', top: 0, left: 3, width: 4, height: 4, background: '#ffdd44' }} />
        <div style={{ position: 'absolute', top: 3, left: 0, width: 10, height: 4, background: '#ffdd44' }} />
        <div style={{ position: 'absolute', top: 7, left: 2, width: 2, height: 3, background: '#ffdd44' }} />
        <div style={{ position: 'absolute', top: 7, left: 6, width: 2, height: 3, background: '#ffdd44' }} />
      </div>
      <span style={{
        fontSize: 8,
        fontFamily: THEME.fontFamily,
        color: '#ffdd44',
        fontWeight: 'bold',
        letterSpacing: 1,
      }}>
        XP
      </span>
      {/* Bar track */}
      <div style={{
        width: 80,
        height: 8,
        background: '#0a0c14',
        border: '1px solid #2a2040',
        position: 'relative',
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}>
        {/* Fill */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #44aa44, #66dd66)',
          boxShadow: `0 0 4px ${THEME.crtGreen}40`,
          transition: 'width 0.5s ease-out',
        }} />
        {/* Highlight line on top of fill */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 1,
          width: `${pct}%`,
          background: 'rgba(255,255,255,0.25)',
        }} />
        {/* Segment markers */}
        {[25, 50, 75].map(p => (
          <div key={p} style={{
            position: 'absolute',
            top: 0,
            left: `${p}%`,
            width: 1,
            height: '100%',
            background: 'rgba(0,0,0,0.3)',
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 8,
        fontFamily: THEME.fontFamily,
        color: '#88cc88',
        fontWeight: 'bold',
        minWidth: 28,
      }}>
        {current}/{total}
      </span>
    </div>
  )
}

// Pixel coin icon + counter
function CoinCounter({ amount }: { amount: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {/* Pixel coin */}
      <div style={{
        width: 10,
        height: 10,
        position: 'relative',
        imageRendering: 'pixelated',
      }}>
        <div style={{ position: 'absolute', top: 1, left: 2, width: 6, height: 8, background: '#ffcc00', borderRadius: 0 }} />
        <div style={{ position: 'absolute', top: 0, left: 3, width: 4, height: 10, background: '#ffdd44' }} />
        <div style={{ position: 'absolute', top: 3, left: 4, width: 2, height: 4, background: '#cc9900' }} />
      </div>
      <span style={{
        fontSize: 10,
        fontFamily: THEME.fontFamily,
        color: '#ffdd44',
        fontWeight: 'bold',
        letterSpacing: 1,
        textShadow: '0 0 4px rgba(255,221,68,0.3)',
      }}>
        {amount.toLocaleString()}
      </span>
    </div>
  )
}

// Pixel mail icon
function MailIndicator({ count }: { count: number }) {
  const hasUnread = count > 0
  const color = hasUnread ? THEME.orange : THEME.textMuted

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {/* Pixel envelope */}
      <div style={{
        width: 10,
        height: 8,
        position: 'relative',
        imageRendering: 'pixelated',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 8, background: color, opacity: 0.8 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: 4, background: 'transparent',
          borderRight: `5px solid transparent`, borderTop: `4px solid ${hasUnread ? '#1a1200' : '#0a0c14'}` }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 5, height: 4, background: 'transparent',
          borderLeft: `5px solid transparent`, borderTop: `4px solid ${hasUnread ? '#1a1200' : '#0a0c14'}` }} />
      </div>
      <span style={{
        fontSize: 9,
        fontFamily: THEME.fontFamily,
        color,
        fontWeight: 'bold',
      }}>
        {count}
      </span>
      {hasUnread && (
        <div style={{
          width: 4,
          height: 4,
          background: THEME.red,
          boxShadow: `0 0 4px ${THEME.red}`,
          animation: 'statusPulse 2s ease-in-out infinite',
        }} />
      )}
    </div>
  )
}

// Connection dot
function LinkDot({ status }: { status: 'connecting' | 'connected' | 'disconnected' }) {
  const color = status === 'connected' ? THEME.green
    : status === 'connecting' ? THEME.orange
    : THEME.red

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{
        fontSize: 7,
        fontFamily: THEME.fontFamily,
        color: THEME.textMuted,
        letterSpacing: 1,
      }}>
        LINK
      </span>
      <div style={{
        width: 6,
        height: 6,
        background: color,
        boxShadow: status === 'connected' ? `0 0 4px ${color}` : 'none',
        imageRendering: 'pixelated',
      }} />
    </div>
  )
}

// Retro LCD clock panel (inline, compact)
function LCDClock({ time, gameTime, phase }: {
  time: string
  gameTime: string
  phase: string
}) {
  const phaseColors: Record<string, string> = {
    dawn: '#ffaa77', day: '#ffdd66', golden: '#ffcc44',
    dusk: '#cc88bb', night: '#6688cc',
  }
  const pColor = phaseColors[phase] || '#ffdd66'

  return (
    <div style={{
      background: '#0a1208',
      border: '2px solid #1a3a12',
      padding: '2px 6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      imageRendering: 'pixelated',
    }}>
      <div style={{
        fontFamily: THEME.fontFamily,
        fontSize: 12,
        fontWeight: 'bold',
        color: THEME.green,
        letterSpacing: 2,
        textShadow: `0 0 6px ${THEME.green}40`,
        lineHeight: 1.2,
      }}>
        {time}
      </div>
      <div style={{
        fontSize: 7,
        fontFamily: THEME.fontFamily,
        color: pColor,
        letterSpacing: 1,
        lineHeight: 1,
      }}>
        {gameTime} {phase.toUpperCase()}
      </div>
    </div>
  )
}

// Pixel separator (vertical dotted line)
function Sep() {
  return (
    <div style={{
      width: 1,
      height: 32,
      background: `repeating-linear-gradient(to bottom, ${THEME.borderPanel} 0px, ${THEME.borderPanel} 2px, transparent 2px, transparent 4px)`,
      flexShrink: 0,
      margin: '0 2px',
    }} />
  )
}

export function StatusHUD({
  selectedAgent,
  beadCount,
  polecatCount,
  gameRef,
}: {
  selectedAgent: string | null
  beadCount: number
  polecatCount: number
  gameRef: Phaser.Game | null
}) {
  const [data, setData] = useState<StatusData>({ unreadMail: 0, activePolecat: 0 })
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [time, setTime] = useState('')
  const [gameTime, setGameTime] = useState({ timeString: '12:00', phase: 'day' })
  const [paused, setPaused] = useState(false)
  const [rigs, setRigs] = useState<RigInfo[]>([
    { name: 'PLN', agents: 0, maxAgents: 3, color: '#3a7bd5' },
    { name: 'ALC', agents: 0, maxAgents: 3, color: '#4caf50' },
    { name: 'ARC', agents: 0, maxAgents: 3, color: '#9c27b0' },
  ])
  const [xpCurrent, setXpCurrent] = useState(0)
  const [xpTotal, setXpTotal] = useState(20)
  const [coins, setCoins] = useState(0)

  // Clock
  useEffect(() => {
    function tick() {
      const now = new Date()
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      setTime(`${days[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`)
    }
    tick()
    const interval = setInterval(tick, 10000)
    return () => clearInterval(interval)
  }, [])

  // Game time from day/night cycle
  useEffect(() => {
    if (!gameRef) return
    const handler = (data: { timeString: string; phase: string }) => {
      setGameTime({ timeString: data.timeString, phase: data.phase })
    }
    gameRef.events.on('game-time', handler)
    return () => { gameRef.events.off('game-time', handler) }
  }, [gameRef])

  // Fetch status + derive rig info
  useEffect(() => {
    async function fetchStatus() {
      try {
        const [mailRes, polecatRes] = await Promise.all([
          fetch('/api/mail').then((r) => r.json()).catch(() => null),
          fetch('/api/polecats').then((r) => r.json()).catch(() => null),
        ])
        setData((prev) => ({
          ...prev,
          unreadMail: mailRes?.data ? parseCount(mailRes.data, /(\d+) unread/) : prev.unreadMail,
          activePolecat: polecatRes?.data ? (polecatRes.data.match(/\u25CF/g) || []).length : prev.activePolecat,
        }))

        // Parse rig agent counts from polecat data
        if (polecatRes?.data) {
          const text = polecatRes.data as string
          setRigs(prev => prev.map(rig => {
            const rigKey = rig.name === 'PLN' ? 'planogram' : rig.name === 'ALC' ? 'alc_ai' : 'arcade'
            const rigLines = text.split('\n').filter(l => l.toLowerCase().includes(rigKey))
            const activeCount = rigLines.filter(l => l.includes('\u25CF')).length
            return { ...rig, agents: Math.max(activeCount, rig.name === 'ARC' ? polecatCount : 0) }
          }))
        }
      } catch { /* Bridge not running */ }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [polecatCount])

  // Derive XP from bead completion (beads closed = XP gained)
  useEffect(() => {
    // Beads pending = work remaining; completed beads = XP
    const totalBeads = Math.max(20, beadCount + xpCurrent)
    setXpTotal(totalBeads)
  }, [beadCount])

  // Derive coins from polecat work (each active polecat generates coins)
  useEffect(() => {
    if (polecatCount === 0) return
    const interval = setInterval(() => {
      setCoins(prev => prev + polecatCount)
    }, 10000)
    return () => clearInterval(interval)
  }, [polecatCount])

  // WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout>
    function connect() {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`)
        ws.onopen = () => setWsStatus('connected')
        ws.onclose = () => { setWsStatus('disconnected'); retryTimer = setTimeout(connect, 3000) }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'gt-mail') setData((prev) => ({ ...prev, unreadMail: parseCount(msg.data || '', /(\d+) unread/) }))
            else if (msg.type === 'gt-polecats') setData((prev) => ({ ...prev, activePolecat: (msg.data?.match(/\u25CF/g) || []).length }))
            else if (msg.type === 'bead-closed') {
              setXpCurrent(prev => prev + 1)
              setCoins(prev => prev + 50)
            }
          } catch { /* ignore */ }
        }
      } catch { setWsStatus('disconnected') }
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])

  return (
    <div style={{
      height: 48,
      flexShrink: 0,
      background: THEME.bgDark,
      borderBottom: `2px solid ${THEME.borderPanel}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: 8,
      fontFamily: THEME.fontFamily,
      position: 'relative',
      overflow: 'hidden',
      imageRendering: 'auto',
    }}>
      {/* Play/Pause — pixel buttons */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          onClick={() => setPaused(!paused)}
          style={{
            width: 20, height: 20,
            background: paused ? '#1a3a1a' : '#0a1a0a',
            border: `1px solid ${paused ? THEME.green : THEME.crtGreenDim}`,
            color: paused ? THEME.green : THEME.crtGreenDim,
            fontFamily: 'sans-serif', fontSize: 10,
            cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            imageRendering: 'pixelated',
          }}
        >
          {paused ? '\u25B6' : '\u23F8'}
        </button>
        <button
          onClick={() => {}}
          style={{
            width: 20, height: 20,
            background: '#0a1a0a',
            border: `1px solid ${THEME.crtGreenDim}`,
            color: THEME.crtGreenDim,
            fontFamily: 'sans-serif', fontSize: 10,
            cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {'\u23E9'}
        </button>
      </div>

      {/* LCD Clock */}
      <LCDClock time={time} gameTime={gameTime.timeString} phase={gameTime.phase} />

      <Sep />

      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <span style={{
          color: THEME.gold,
          fontWeight: 'bold',
          fontSize: 11,
          letterSpacing: 2,
          lineHeight: 1.2,
          textShadow: `0 0 8px ${THEME.gold}20`,
        }}>
          GAS TOWN
        </span>
        <span style={{ fontSize: 6, color: THEME.textMuted, letterSpacing: 1, lineHeight: 1 }}>
          ARCADE
        </span>
      </div>

      <Sep />

      {/* Rig HP bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rigs.map(rig => (
          <HPBar
            key={rig.name}
            label={rig.name}
            value={rig.agents}
            max={rig.maxAgents}
            color={rig.color}
            dimColor={rig.color + '88'}
            width={48}
          />
        ))}
      </div>

      <Sep />

      {/* XP Bar */}
      <XPBar current={xpCurrent} total={xpTotal} />

      <Sep />

      {/* Coin counter */}
      <CoinCounter amount={coins} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Selected agent tag */}
      {selectedAgent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: '#1a1200',
          border: `1px solid ${THEME.goldDim}`,
          padding: '1px 6px',
        }}>
          {/* Pixel eye */}
          <div style={{
            width: 8, height: 6,
            position: 'relative', imageRendering: 'pixelated',
          }}>
            <div style={{ position: 'absolute', top: 1, left: 0, width: 8, height: 4, background: THEME.gold, borderRadius: 0 }} />
            <div style={{ position: 'absolute', top: 2, left: 3, width: 2, height: 2, background: '#1a1200' }} />
          </div>
          <span style={{
            fontSize: 8,
            fontFamily: THEME.fontFamily,
            color: THEME.gold,
            fontWeight: 'bold',
            letterSpacing: 1,
          }}>
            {selectedAgent.toUpperCase()}
          </span>
        </div>
      )}

      {/* Mail */}
      <MailIndicator count={data.unreadMail} />

      <Sep />

      {/* Polecat count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {/* Pixel paw */}
        <div style={{
          width: 8, height: 8,
          position: 'relative', imageRendering: 'pixelated',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 2, background: THEME.cyan }} />
          <div style={{ position: 'absolute', top: 0, left: 3, width: 2, height: 2, background: THEME.cyan }} />
          <div style={{ position: 'absolute', top: 0, left: 6, width: 2, height: 2, background: THEME.cyan }} />
          <div style={{ position: 'absolute', top: 3, left: 1, width: 6, height: 5, background: THEME.cyan }} />
        </div>
        <span style={{
          fontSize: 9,
          fontFamily: THEME.fontFamily,
          color: polecatCount > 0 ? THEME.cyan : THEME.textMuted,
          fontWeight: 'bold',
        }}>
          {polecatCount}
        </span>
      </div>

      <Sep />

      {/* Link status */}
      <LinkDot status={wsStatus} />

      {/* Scanline overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        zIndex: 2,
      }} />

      {/* Top edge highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: 'rgba(255,255,255,0.05)',
        zIndex: 2,
      }} />

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
