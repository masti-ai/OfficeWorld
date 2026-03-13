import { useState, useRef, useEffect, useCallback } from 'react'
import { THEME } from '../constants'
import { generateDeskCanvas } from '../game/sprites/DeskGenerator'
import { agentToSession } from './SessionViewer'
import { PixelPanel, PixelButton } from './gba'

interface AgentDeskViewProps {
  visible: boolean
  onClose: () => void
  agentName: string
  agentRig: string
  agentRole: string
}

export function AgentDeskView({ visible, onClose, agentName, agentRig, agentRole }: AgentDeskViewProps) {
  const deskRef = useRef<HTMLCanvasElement>(null)
  const outputRef = useRef<HTMLPreElement>(null)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pos, setPos] = useState({ x: -1, y: -1 })
  const dragging = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)

  const sessionName = agentToSession(agentRig, agentRole, agentName)

  // Generate desk pixel art
  useEffect(() => {
    if (!visible || !agentName || !deskRef.current) return
    const deskCanvas = generateDeskCanvas(agentName, agentRig, agentRole)
    const target = deskRef.current
    target.width = deskCanvas.width
    target.height = deskCanvas.height
    const ctx = target.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(deskCanvas, 0, 0)
  }, [visible, agentName, agentRig, agentRole])

  // Poll terminal output
  useEffect(() => {
    if (!visible || !sessionName) return
    setError(null)
    setOutput('')

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionName}/capture?lines=60`)
        if (res.ok) {
          const data = await res.json()
          if (data.ok) { setOutput(data.data || ''); setError(null) }
          else { setError(data.error || 'Session not available') }
        } else { setError('Bridge not reachable') }
      } catch { setError('Bridge not reachable') }
    }

    poll()
    const interval = setInterval(poll, 2500)
    return () => clearInterval(interval)
  }, [visible, sessionName])

  // Auto-scroll terminal
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  // Drag handling
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = (e.target as HTMLElement).closest('[data-desk-panel]')
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

  const panelW = 820
  const panelH = 520
  const left = pos.x === -1 ? `calc(50vw - ${panelW / 2}px)` : pos.x
  const top = pos.y === -1 ? `calc(50vh - ${panelH / 2}px)` : pos.y

  return (
    <div
      data-desk-panel
      style={{
        position: 'fixed',
        left, top,
        width: panelW,
        height: panelH,
        zIndex: 1000,
      }}
    >
      <PixelPanel variant="dark" style={{ height: '100%', flexDirection: 'column' }}>
        {/* Header */}
        <div
          onMouseDown={onDragStart}
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '6px 14px',
            background: THEME.bgHeader,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `2px solid ${THEME.borderAccent}`,
            cursor: 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ color: THEME.textPrimary, fontWeight: 'bold', fontSize: 12, flex: 1, fontFamily: THEME.fontFamily }}>
            {agentRig}/{agentName}
          </span>
          <span style={{ color: THEME.textMuted, fontSize: 9, fontFamily: THEME.fontFamily }}>{agentRole}</span>
          <span style={{ color: error ? THEME.red : THEME.green, fontSize: 9, letterSpacing: 1, fontFamily: THEME.fontFamily }}>
            {error ? 'OFFLINE' : 'LIVE'}
          </span>
          <PixelButton size="sm" onClick={onClose} style={{ padding: '0 6px', height: 20, minWidth: 0 }}>
            x
          </PixelButton>
        </div>

        {/* Split content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: Terminal */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `2px solid ${THEME.borderPanel}`,
            minWidth: 0,
          }}>
            <div style={{
              padding: '4px 10px',
              fontSize: 9,
              color: THEME.gold,
              letterSpacing: 2,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${THEME.borderPanel}`,
              fontFamily: THEME.fontFamily,
            }}>
              Terminal
            </div>
            <pre
              ref={outputRef}
              style={{
                flex: 1,
                margin: 0,
                padding: '6px 10px',
                overflowY: 'auto',
                overflowX: 'hidden',
                fontSize: 10,
                lineHeight: 1.4,
                color: THEME.green,
                background: THEME.bgDark,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error ? (
                <span style={{ color: THEME.red }}>{error}</span>
              ) : output ? output : (
                <span style={{ color: THEME.textMuted }}>Connecting to {sessionName}...</span>
              )}
            </pre>
          </div>

          {/* Right: Desk view */}
          <div style={{
            width: 360,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            background: THEME.bgPanel,
          }}>
            <div style={{
              padding: '4px 10px',
              fontSize: 9,
              color: THEME.gold,
              letterSpacing: 2,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${THEME.borderPanel}`,
              fontFamily: THEME.fontFamily,
            }}>
              Workstation
            </div>

            {/* Desk canvas */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              minHeight: 0,
            }}>
              <canvas
                ref={deskRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  imageRendering: 'pixelated',
                  border: `1px solid ${THEME.borderPanel}`,
                }}
              />
            </div>

            {/* Agent info footer */}
            <PixelPanel variant="default" style={{ margin: 4 }}>
              <div style={{
                position: 'relative',
                zIndex: 1,
                padding: '4px 8px',
                fontSize: 10,
                color: THEME.textSecondary,
                lineHeight: 1.6,
                fontFamily: THEME.fontFamily,
              }}>
                <div>
                  <span style={{ color: THEME.textMuted }}>Agent: </span>
                  <span style={{ color: THEME.textPrimary }}>{agentName}</span>
                </div>
                <div>
                  <span style={{ color: THEME.textMuted }}>Rig: </span>
                  <span style={{ color: THEME.textPrimary }}>{agentRig}</span>
                </div>
                <div>
                  <span style={{ color: THEME.textMuted }}>Session: </span>
                  <span style={{ color: THEME.cyan }}>{sessionName}</span>
                </div>
              </div>
            </PixelPanel>
          </div>
        </div>
      </PixelPanel>
    </div>
  )
}
