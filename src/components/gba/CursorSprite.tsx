import { useEffect, useRef, useState } from 'react'

export interface CursorSpriteProps {
  active: boolean
}

const CURSOR_SIZE = 24
const FRAME_INTERVAL = 400

/**
 * Animated GBA-style hand cursor sprite that follows the mouse in edit mode.
 * Draws a pixel art pointing hand on a small canvas, with a 2-frame
 * idle animation (slight bounce). Replaces the default cursor when active.
 */
export function CursorSprite({ active }: CursorSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const [, setTick] = useState(0)

  // Track mouse position
  useEffect(() => {
    if (!active) return
    function handleMove(e: MouseEvent) {
      posRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [active])

  // Animation frame toggle (2-frame bounce)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % 2
      setTick((t) => t + 1)
    }, FRAME_INTERVAL)
    return () => clearInterval(timer)
  }, [active])

  // Render loop: move canvas to mouse position
  useEffect(() => {
    if (!active) return
    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      if (!canvas) return
      const { x, y } = posRef.current
      canvas.style.left = `${x}px`
      canvas.style.top = `${y + (frameRef.current === 1 ? 1 : 0)}px`
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active])

  // Draw the hand sprite onto the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawHandCursor(ctx, frameRef.current)
  }, [active, frameRef.current])

  // Hide default cursor when active
  useEffect(() => {
    if (active) {
      document.body.style.cursor = 'none'
    } else {
      document.body.style.cursor = ''
    }
    return () => { document.body.style.cursor = '' }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      width={CURSOR_SIZE}
      height={CURSOR_SIZE}
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 9999,
        imageRendering: 'pixelated',
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
      }}
    />
  )
}

/**
 * Draws a 16x16 pixel art pointing hand cursor, scaled up to CURSOR_SIZE.
 * Frame 0: normal, Frame 1: slight finger curl (bounce).
 */
function drawHandCursor(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.clearRect(0, 0, CURSOR_SIZE, CURSOR_SIZE)
  ctx.imageSmoothingEnabled = false

  // Work at 16x16 then scale
  const s = CURSOR_SIZE / 16

  const outline = '#1a1a2e'
  const skin = '#fce4c0'
  const skinDark = '#e8b88a'
  const highlight = '#fff5e0'

  // Pixel map for the hand cursor (16x16 grid)
  // 0=transparent, 1=outline, 2=skin, 3=skinDark, 4=highlight
  const hand: number[][] = frame === 0 ? [
    // Frame 0: pointing hand
    [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,1,1,0,1,1,0,0,0,0,0],
    [0,0,1,2,2,1,2,2,1,2,2,1,0,0,0,0],
    [0,0,1,2,2,1,2,2,1,2,2,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,1,2,1,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  ] : [
    // Frame 1: slight finger curl (bounce)
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,1,1,0,1,1,0,0,0,0,0],
    [0,0,1,2,2,1,2,2,1,2,2,1,0,0,0,0],
    [0,0,1,2,2,1,2,2,1,2,2,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,1,2,1,0,0],
    [0,0,1,4,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  ]

  const colorMap: Record<number, string> = {
    1: outline,
    2: skin,
    3: skinDark,
    4: highlight,
  }

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const val = hand[y][x]
      if (val === 0) continue
      ctx.fillStyle = colorMap[val]
      ctx.fillRect(x * s, y * s, Math.ceil(s), Math.ceil(s))
    }
  }
}
