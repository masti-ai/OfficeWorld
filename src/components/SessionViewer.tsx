import { useState, useRef, useEffect, useCallback } from 'react'
import { THEME } from '../constants'
import { PixelPanel, PixelButton } from './gba'

const RIG_PREFIX: Record<string, string> = {
  planogram: 'vap',
  alc_ai: 'vaa',
  arcade: 'gta',
}

export function agentToSession(rig: string, role: string, name: string): string {
  if (role === 'mayor') return 'hq-mayor'
  if (role === 'deacon') return 'hq-deacon'

  const prefix = RIG_PREFIX[rig] || rig
  if (role === 'witness' || role === 'refinery') return `${prefix}-${role}`
  return `${prefix}-crew-${name}`
}

interface SessionViewerProps {
  visible: boolean
  onClose: () => void
  sessionName: string | null
  title?: string
}

export function SessionViewer({ visible, onClose, sessionName, title }: SessionViewerProps) {
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [width, setWidth] = useState(520)
  const [height, setHeight] = useState(560)
  const [pos, setPos] = useState({ x: -1, y: -1 })
  const dragging = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const resizing = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  useEffect(() => {
    if (!visible || !sessionName) return

    setError(null)
    setOutput('')

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionName}/capture?lines=80`)
        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setOutput(data.data || '')
            setError(null)
          } else {
            setError(data.error || 'Session not available')
          }
        } else {
          setError('Bridge server not reachable')
        }
      } catch {
        setError('Bridge server not reachable')
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [visible, sessionName])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  useEffect(() => {
    if (visible && inputRef.current) inputRef.current.focus()
  }, [visible])

  const sendMessage = useCallback(async () => {
    const text = msgInput.trim()
    if (!text || sending) return

    setSending(true)
    try {
      if (sessionName === 'hq-mayor') {
        await fetch('/api/mayor-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
      }
    } catch {
      // ignore
    } finally {
      setMsgInput('')
      setSending(false)
    }
  }, [msgInput, sending, sessionName])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.target as HTMLElement).closest('[data-session-panel]')?.getBoundingClientRect()
    if (!rect) return
    dragging.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x === -1 ? window.innerWidth - width - 16 : pos.x,
      startPosY: pos.y === -1 ? window.innerHeight - height - 16 : pos.y,
    }

    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: dragging.current.startPosX + (e.clientX - dragging.current.startX),
        y: dragging.current.startPosY + (e.clientY - dragging.current.startY),
      })
    }
    function onUp() {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos, width, height])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }

    function onMove(e: MouseEvent) {
      if (!resizing.current) return
      setWidth(Math.max(360, resizing.current.startW - (e.clientX - resizing.current.startX)))
      setHeight(Math.max(300, resizing.current.startH - (e.clientY - resizing.current.startY)))
    }
    function onUp() {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, height])

  if (!visible) return null

  const isMayor = sessionName === 'hq-mayor'
  const displayTitle = title || sessionName || 'Session'

  const left = pos.x === -1 ? undefined : pos.x
  const top = pos.y === -1 ? undefined : pos.y
  const right = pos.x === -1 ? 16 : undefined
  const bottom = pos.y === -1 ? 16 : undefined

  return (
    <div
      data-session-panel
      style={{
        position: 'fixed',
        left, top, right, bottom,
        width, height,
        zIndex: 1000,
      }}
    >
      <PixelPanel variant="dark" style={{ height: '100%', flexDirection: 'column' }}>
        {/* Resize handle (top-left corner) */}
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 12,
            height: 12,
            cursor: 'nw-resize',
            zIndex: 2,
          }}
        />

        {/* Header / drag handle */}
        <div
          onMouseDown={onDragStart}
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '8px 14px',
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
          <span style={{
            color: isMayor ? THEME.gold : THEME.textPrimary,
            fontWeight: 'bold',
            fontSize: 12,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: THEME.fontFamily,
          }}>
            {displayTitle}
          </span>
          <span style={{
            color: error ? THEME.red : THEME.green,
            fontSize: 9,
            letterSpacing: 1,
            fontFamily: THEME.fontFamily,
          }}>
            {error ? 'OFFLINE' : 'LIVE'}
          </span>
          <PixelButton size="sm" onClick={onClose} style={{ padding: '0 6px', height: 20, minWidth: 0 }}>
            x
          </PixelButton>
        </div>

        {/* Session output */}
        <pre
          ref={outputRef}
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            margin: 0,
            padding: '8px 12px',
            overflowY: 'auto',
            overflowX: 'hidden',
            fontSize: 11,
            lineHeight: 1.4,
            color: THEME.green,
            background: THEME.bgDark,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {error ? (
            <span style={{ color: THEME.red }}>{error}</span>
          ) : output ? (
            output
          ) : (
            <span style={{ color: THEME.textMuted }}>Connecting to {sessionName}...</span>
          )}
        </pre>

        {/* Input (only for mayor) */}
        {isMayor && (
          <div style={{
            position: 'relative',
            zIndex: 1,
            padding: '8px 12px',
            borderTop: `1px solid ${THEME.borderPanel}`,
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Send to Mayor (gt nudge)..."
              style={{
                flex: 1,
                background: THEME.bgBody,
                border: `2px solid ${THEME.borderPanel}`,
                color: THEME.textPrimary,
                padding: '6px 10px',
                fontSize: 11,
                fontFamily: THEME.fontFamily,
                outline: 'none',
              }}
            />
            <PixelButton
              onClick={sendMessage}
              disabled={sending}
              variant="primary"
              size="sm"
            >Send</PixelButton>
          </div>
        )}
      </PixelPanel>
    </div>
  )
}
