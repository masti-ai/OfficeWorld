import { useState, useEffect, useRef, useCallback } from 'react'
import { THEME } from '../constants'
import { sfx, initAudio } from '../audio/GBAAudio'

type BootPhase = 'logo' | 'press-start' | 'console-scroll' | 'engine-init' | 'done'

interface BootSequenceProps {
  onComplete: () => void
}

const LOGO_DURATION = 2400
const PRESS_START_BLINK_MS = 500
const CONSOLE_LINE_DELAY = 80
const ENGINE_STEP_DELAY = 300

const CONSOLE_LINES = [
  '> gas-town v0.1.0',
  '> initializing beads runtime...',
  '> loading rig: gt_arcade',
  '> connecting mesh relay...',
  '> spawning polecats...',
  '> mounting witness overlay',
  '> refinery queue: idle',
  '> mayor office: ONLINE',
  '> pixel renderer: ready',
  '> all systems nominal',
]

const ENGINE_STEPS = [
  { label: 'PHASER', status: 'OK' },
  { label: 'WEBSOCKET', status: 'OK' },
  { label: 'BEADS DB', status: 'OK' },
  { label: 'TILE MAP', status: 'OK' },
  { label: 'SPRITES', status: 'OK' },
]

// 16x16 pixel art "GT" logo as a bitmap (1 = filled, 0 = empty)
const GT_LOGO: number[][] = [
  [0,0,1,1,1,1,1,0,0,0,1,1,1,1,1,0],
  [0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0],
  [1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0],
  [1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0],
  [1,1,0,0,1,1,1,0,0,0,0,1,1,0,0,0],
  [1,1,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0,0,0,1,1,0,0,0],
]

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<BootPhase>('logo')
  const [blinkOn, setBlinkOn] = useState(true)
  const [visibleLines, setVisibleLines] = useState(0)
  const [engineStep, setEngineStep] = useState(0)
  const [engineDone, setEngineDone] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)

  // Draw the pixel art logo on canvas
  const drawLogo = useCallback((opacity: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pixelSize = 6
    const logoW = GT_LOGO[0].length * pixelSize
    const logoH = GT_LOGO.length * pixelSize
    const offsetX = (canvas.width - logoW) / 2
    const offsetY = (canvas.height - logoH) / 2 - 20

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = opacity

    // Draw each pixel of the logo
    for (let y = 0; y < GT_LOGO.length; y++) {
      for (let x = 0; x < GT_LOGO[y].length; x++) {
        if (GT_LOGO[y][x]) {
          ctx.fillStyle = THEME.gold
          ctx.fillRect(
            offsetX + x * pixelSize,
            offsetY + y * pixelSize,
            pixelSize - 1,
            pixelSize - 1,
          )
        }
      }
    }

    // Draw "ARCADE" text below logo
    ctx.fillStyle = THEME.purple
    ctx.font = `bold 10px ${THEME.fontFamily}`
    ctx.textAlign = 'center'
    ctx.fillText('A R C A D E', canvas.width / 2, offsetY + logoH + 16)

    ctx.globalAlpha = 1
  }, [])

  // Phase: logo fade in/out
  useEffect(() => {
    if (phase !== 'logo') return

    const start = performance.now()
    let raf: number

    function animate(now: number) {
      const elapsed = now - start
      let opacity: number

      if (elapsed < 800) {
        opacity = elapsed / 800 // fade in
      } else if (elapsed < LOGO_DURATION - 600) {
        opacity = 1 // hold
      } else if (elapsed < LOGO_DURATION) {
        opacity = 1 - (elapsed - (LOGO_DURATION - 600)) / 600 // fade out
      } else {
        setPhase('press-start')
        return
      }

      drawLogo(opacity)
      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [phase, drawLogo])

  // Phase: press-start blink
  useEffect(() => {
    if (phase !== 'press-start') return

    const interval = setInterval(() => {
      setBlinkOn(prev => !prev)
    }, PRESS_START_BLINK_MS)

    function handleInput() {
      initAudio()
      sfx('bootChime')
      setPhase('console-scroll')
    }

    window.addEventListener('keydown', handleInput)
    window.addEventListener('click', handleInput)

    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleInput)
      window.removeEventListener('click', handleInput)
    }
  }, [phase])

  // Phase: console scroll
  useEffect(() => {
    if (phase !== 'console-scroll') return

    if (visibleLines >= CONSOLE_LINES.length) {
      const timeout = setTimeout(() => setPhase('engine-init'), 400)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      setVisibleLines(prev => prev + 1)
    }, CONSOLE_LINE_DELAY)

    return () => clearTimeout(timeout)
  }, [phase, visibleLines])

  // Phase: engine init
  useEffect(() => {
    if (phase !== 'engine-init') return

    if (engineStep >= ENGINE_STEPS.length) {
      const timeout = setTimeout(() => {
        setEngineDone(true)
        setTimeout(() => {
          setPhase('done')
          onComplete()
        }, 800)
      }, 400)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      setEngineStep(prev => prev + 1)
    }, ENGINE_STEP_DELAY)

    return () => clearTimeout(timeout)
  }, [phase, engineStep, onComplete])

  // Scanline animation
  useEffect(() => {
    let raf: number
    function tick() {
      frameRef.current += 1
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (phase === 'done') return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: THEME.bgDark,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: THEME.fontFamily,
      imageRendering: 'pixelated',
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* CRT vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      <div style={{ position: 'relative', zIndex: 3, width: '100%', maxWidth: 480, padding: '0 24px' }}>
        {/* Logo phase */}
        {phase === 'logo' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <canvas
              ref={canvasRef}
              width={240}
              height={120}
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}

        {/* Press Start phase */}
        {phase === 'press-start' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: THEME.gold,
              letterSpacing: 6,
              marginBottom: 32,
              textShadow: `0 0 8px ${THEME.goldDim}`,
            }}>
              GAS TOWN
            </div>
            <div style={{
              fontSize: 11,
              color: THEME.textSecondary,
              letterSpacing: 2,
              marginBottom: 48,
            }}>
              A R C A D E
            </div>
            <div style={{
              fontSize: 14,
              color: blinkOn ? THEME.textBright : 'transparent',
              letterSpacing: 4,
              transition: 'color 100ms',
            }}>
              PRESS START
            </div>
          </div>
        )}

        {/* Console scroll phase */}
        {phase === 'console-scroll' && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${THEME.borderPanel}`,
            padding: '12px 16px',
            minHeight: 200,
          }}>
            {CONSOLE_LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} style={{
                fontSize: 11,
                color: line.includes('nominal') ? THEME.green : THEME.textSecondary,
                lineHeight: '18px',
                fontFamily: THEME.fontFamily,
              }}>
                {line}
              </div>
            ))}
            {visibleLines < CONSOLE_LINES.length && (
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 12,
                background: THEME.textSecondary,
                animation: 'blink 0.6s step-end infinite',
              }} />
            )}
          </div>
        )}

        {/* Engine init phase */}
        {phase === 'engine-init' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 11,
              color: THEME.textMuted,
              letterSpacing: 2,
              marginBottom: 16,
            }}>
              ENGINE INITIALIZATION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              {ENGINE_STEPS.map((step, i) => (
                <div key={step.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: i < engineStep ? 1 : 0.2,
                  transition: 'opacity 200ms',
                }}>
                  <span style={{
                    fontSize: 10,
                    color: THEME.textSecondary,
                    width: 80,
                    textAlign: 'right',
                    letterSpacing: 1,
                  }}>
                    {step.label}
                  </span>
                  {/* Progress bar */}
                  <div style={{
                    width: 120,
                    height: 8,
                    background: THEME.bgPanel,
                    border: `1px solid ${THEME.borderPanel}`,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: i < engineStep ? '100%' : '0%',
                      height: '100%',
                      background: THEME.green,
                      transition: 'width 250ms ease-out',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: i < engineStep ? THEME.green : THEME.textMuted,
                    width: 24,
                    letterSpacing: 1,
                  }}>
                    {i < engineStep ? step.status : '...'}
                  </span>
                </div>
              ))}
            </div>
            {engineDone && (
              <div style={{
                marginTop: 24,
                fontSize: 12,
                color: THEME.gold,
                letterSpacing: 3,
              }}>
                READY
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
