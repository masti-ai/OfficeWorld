import { type ReactNode, type CSSProperties } from 'react'
import { THEME } from '../../constants'

export interface PixelPanelProps {
  children: ReactNode
  title?: string
  width?: number | string
  height?: number | string
  style?: CSSProperties
  variant?: 'default' | 'dark' | 'accent' | 'crt'
}

const BORDER_WIDTH = 2
const CORNER_SIZE = 6

/**
 * GBA-style rounded-rect panel with pixel art border.
 * Uses CSS clip-path to simulate pixel-rounded corners (no actual border-radius).
 */
export function PixelPanel({
  children,
  title,
  width,
  height,
  style,
  variant = 'default',
}: PixelPanelProps) {
  const colors = VARIANT_COLORS[variant]

  return (
    <div style={{
      position: 'relative',
      width,
      height,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {/* Outer border layer (pixel rounded rect) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: colors.border,
        clipPath: pixelRoundedRect(CORNER_SIZE),
      }} />

      {/* Inner fill */}
      <div style={{
        position: 'absolute',
        inset: BORDER_WIDTH,
        background: colors.bg,
        clipPath: pixelRoundedRect(CORNER_SIZE - BORDER_WIDTH),
      }} />

      {/* Highlight edge (top-left bevel) */}
      <div style={{
        position: 'absolute',
        top: BORDER_WIDTH,
        left: BORDER_WIDTH,
        right: BORDER_WIDTH + 1,
        height: 1,
        background: colors.highlight,
        opacity: 0.4,
        clipPath: pixelRoundedRect(CORNER_SIZE - BORDER_WIDTH),
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        zIndex: 1,
      }}>
        {title && (
          <div style={{
            fontFamily: THEME.fontFamily,
            fontSize: 11,
            fontWeight: 'bold',
            color: colors.titleColor,
            letterSpacing: 2,
            textTransform: 'uppercase',
            padding: '6px 10px 4px',
            borderBottom: `1px solid ${colors.divider}`,
          }}>
            {title}
          </div>
        )}
        <div style={{
          flex: 1,
          padding: title ? '6px 10px' : '8px 10px',
          overflow: 'auto',
          minHeight: 0,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const VARIANT_COLORS = {
  default: {
    border: THEME.borderAccent,
    bg: THEME.bgPanel,
    highlight: '#ffffff',
    titleColor: THEME.gold,
    divider: THEME.borderPanel,
  },
  dark: {
    border: THEME.borderDark,
    bg: THEME.bgDark,
    highlight: '#888888',
    titleColor: THEME.textSecondary,
    divider: THEME.borderDark,
  },
  accent: {
    border: THEME.gold,
    bg: '#1a1800',
    highlight: THEME.gold,
    titleColor: THEME.gold,
    divider: THEME.goldDim,
  },
  crt: {
    border: THEME.crtGreenDim,
    bg: THEME.crtBg,
    highlight: THEME.crtGreen,
    titleColor: THEME.crtGreen,
    divider: THEME.crtGreenDim,
  },
} as const

/**
 * Generates a CSS clip-path polygon that creates pixel-art rounded corners.
 * Each corner is notched in a staircase pattern (2px steps) to simulate GBA-style rounding.
 */
function pixelRoundedRect(corner: number): string {
  if (corner <= 0) return 'none'

  // Build corner notch points (staircase: 2px per step)
  const steps = Math.max(1, Math.floor(corner / 2))
  const topLeft: string[] = []
  const topRight: string[] = []
  const bottomRight: string[] = []
  const bottomLeft: string[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Quadratic curve approximation for pixel staircase
    const x = corner * (1 - (1 - t) * (1 - t))
    const y = corner * (1 - t * t)
    topLeft.push(`${x}px ${y}px`)
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = corner * t * t
    const y = corner * (1 - (1 - t) * (1 - t))
    topRight.push(`calc(100% - ${x}px) ${y}px`)
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = corner * (1 - t * t)
    const y = corner * (1 - (1 - t) * (1 - t))
    bottomRight.push(`calc(100% - ${x}px) calc(100% - ${y}px)`)
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = corner * (1 - (1 - t) * (1 - t))
    const y = corner * t * t
    bottomLeft.push(`${x}px calc(100% - ${y}px)`)
  }

  const points = [
    ...topLeft,
    `${corner}px 0`,
    `calc(100% - ${corner}px) 0`,
    ...topRight,
    `100% ${corner}px`,
    `100% calc(100% - ${corner}px)`,
    ...bottomRight,
    `calc(100% - ${corner}px) 100%`,
    `${corner}px 100%`,
    ...bottomLeft,
    `0 calc(100% - ${corner}px)`,
    `0 ${corner}px`,
  ]

  return `polygon(${points.join(', ')})`
}
