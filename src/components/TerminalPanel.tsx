import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { THEME } from '../constants'
import { PixelPanel, PixelButton } from './gba'

const ALLOWED_PREFIXES = ['gt ', 'bd ']
const MIN_HEIGHT = 150
const MAX_HEIGHT_RATIO = 0.8

const CRT_SCANLINE_CSS = `
  repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, ${0.08}) 0px,
    rgba(0, 0, 0, ${0.08}) 1px,
    transparent 1px,
    transparent 3px
  )
`

const CRT_CURVATURE_SHADOW = `
  inset 0 0 60px rgba(0, 0, 0, 0.4),
  inset 0 0 120px rgba(0, 0, 0, 0.2)
`

export function TerminalPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const termRef = useRef<HTMLDivElement>(null)
  const termInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const inputRef = useRef('')
  const hasInitialized = useRef(false)
  const [height, setHeight] = useState(Math.round(window.innerHeight * 0.45))
  const resizing = useRef<{ startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    if (!visible || !termRef.current || hasInitialized.current) {
      if (visible && fitAddon.current && hasInitialized.current) {
        setTimeout(() => fitAddon.current?.fit(), 50)
      }
      return
    }

    hasInitialized.current = true

    const term = new Terminal({
      theme: {
        background: THEME.crtBg,
        foreground: THEME.crtGreen,
        cursor: THEME.crtGreen,
        cursorAccent: THEME.crtBg,
        selectionBackground: 'rgba(51, 255, 102, 0.2)',
        selectionForeground: '#ffffff',
      },
      fontFamily: THEME.fontFamily,
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 2000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(termRef.current)

    setTimeout(() => fit.fit(), 100)

    termInstance.current = term
    fitAddon.current = fit

    term.writeln(`\x1b[32m${'='.repeat(50)}\x1b[0m`)
    term.writeln(`\x1b[1;32m  > Gas Town Arcade Terminal_\x1b[0m`)
    term.writeln(`\x1b[32m  Type gt or bd commands\x1b[0m`)
    term.writeln(`\x1b[2;32m  Press ~ to toggle  |  Drag top edge to resize\x1b[0m`)
    term.writeln(`\x1b[32m${'='.repeat(50)}\x1b[0m`)
    term.writeln('')
    writePrompt(term)

    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (domEvent.key === 'Enter') {
        const cmd = inputRef.current.trim()
        term.writeln('')

        if (cmd) {
          executeCommand(term, cmd)
        } else {
          writePrompt(term)
        }

        inputRef.current = ''
      } else if (domEvent.key === 'Backspace') {
        if (inputRef.current.length > 0) {
          inputRef.current = inputRef.current.slice(0, -1)
          term.write('\b \b')
        }
      } else if (printable && key.length === 1) {
        inputRef.current += key
        term.write(key)
      }
    })
  }, [visible])

  useEffect(() => {
    function handleResize() {
      if (visible && fitAddon.current) fitAddon.current.fit()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [visible])

  useEffect(() => {
    if (visible && fitAddon.current) {
      setTimeout(() => fitAddon.current?.fit(), 50)
    }
  }, [height, visible])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = { startY: e.clientY, startHeight: height }

    function onMove(e: MouseEvent) {
      if (!resizing.current) return
      const delta = resizing.current.startY - e.clientY
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO
      setHeight(Math.min(maxH, Math.max(MIN_HEIGHT, resizing.current.startHeight + delta)))
    }
    function onUp() {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [height])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: visible ? height : 0,
        transition: resizing.current ? 'none' : 'height 0.3s ease',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      <PixelPanel variant="dark" style={{ height: '100%', flexDirection: 'column' }}>
        {/* Resize drag handle */}
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'relative',
            zIndex: 2,
            height: 6,
            cursor: 'ns-resize',
            background: 'transparent',
            flexShrink: 0,
          }}
        />
        {/* Title bar with phosphor glow */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: 32,
            background: THEME.crtBg,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            fontFamily: THEME.fontFamily,
            fontSize: 12,
            flexShrink: 0,
            borderBottom: `1px solid ${THEME.crtGreenDim}`,
          }}
        >
          <span style={{
            color: THEME.crtGreen,
            fontWeight: 'bold',
            letterSpacing: 1,
            textShadow: THEME.phosphorGlowSubtle,
          }}>TERMINAL</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: THEME.crtGreenDim, fontSize: 10, marginRight: 12 }}>drag top edge to resize</span>
          <PixelButton size="sm" variant="danger" onClick={onClose} style={{ padding: '0 6px', height: 20, minWidth: 0 }}>
            x
          </PixelButton>
        </div>
        {/* Terminal container with CRT effects */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div ref={termRef} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', padding: '4px 8px', overflow: 'hidden' }} />
          {/* CRT Scanline overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: CRT_SCANLINE_CSS,
            pointerEvents: 'none',
            zIndex: 2,
          }} />
          {/* CRT curvature vignette */}
          <div style={{
            position: 'absolute',
            inset: 0,
            boxShadow: CRT_CURVATURE_SHADOW,
            pointerEvents: 'none',
            zIndex: 3,
          }} />
        </div>
      </PixelPanel>
    </div>
  )
}

function writePrompt(term: Terminal) {
  term.write('\x1b[1;32mgt-arcade\x1b[0m \x1b[32m>\x1b[0m ')
}

async function executeCommand(term: Terminal, cmd: string) {
  const isAllowed = ALLOWED_PREFIXES.some((p) => cmd.startsWith(p))

  if (!isAllowed) {
    term.writeln(`\x1b[31mOnly gt and bd commands are allowed\x1b[0m`)
    writePrompt(term)
    return
  }

  term.writeln(`\x1b[90mExecuting: ${cmd}\x1b[0m`)

  try {
    const res = await fetch(`/api/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.output) {
        const lines = data.output.split('\n')
        for (const line of lines) {
          term.writeln(line)
        }
      }
      if (data.error) {
        term.writeln(`\x1b[31m${data.error}\x1b[0m`)
      }
    } else {
      term.writeln(`\x1b[31mBridge server error: ${res.status}\x1b[0m`)
    }
  } catch {
    term.writeln(`\x1b[31mCannot reach bridge server. Start with: npm run server\x1b[0m`)
  }

  writePrompt(term)
}
