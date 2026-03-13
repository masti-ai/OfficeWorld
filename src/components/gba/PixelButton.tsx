import { useState, type ReactNode, type CSSProperties } from 'react'
import { THEME } from '../../constants'
import { sfx } from '../../audio/GBAAudio'

export interface PixelButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger' | 'crt'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  style?: CSSProperties
}

const PRESS_OFFSET = 2

/**
 * GBA-style chunky pixel button with press animation.
 * On mousedown/active: shifts 2px down and shadow shrinks to simulate physical press.
 */
export function PixelButton({
  children,
  onClick,
  disabled = false,
  variant = 'default',
  size = 'md',
  icon,
  style,
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const colors = VARIANT_COLORS[variant]
  const sizeStyles = SIZE_MAP[size]
  const isActive = pressed && !disabled
  const isHot = hovered && !disabled

  return (
    <div style={{
      display: 'inline-block',
      position: 'relative',
      paddingBottom: PRESS_OFFSET,
      ...style,
    }}>
      {/* Shadow layer (behind the button face) */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(100% - ${PRESS_OFFSET}px)`,
        background: colors.shadow,
        border: `2px solid ${colors.shadowBorder}`,
        borderTop: 'none',
      }} />

      {/* Button face */}
      <button
        onClick={disabled ? undefined : () => { sfx('buttonClick'); onClick?.() }}
        onMouseDown={() => !disabled && setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => { setPressed(false); setHovered(false) }}
        onMouseEnter={() => { if (!disabled) { sfx('buttonHover'); setHovered(true) } }}
        disabled={disabled}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontFamily: THEME.fontFamily,
          fontWeight: 'bold',
          letterSpacing: 1,
          cursor: disabled ? 'default' : 'pointer',
          border: `2px solid ${isHot ? colors.borderHover : colors.border}`,
          background: isHot ? colors.bgHover : colors.bg,
          color: disabled ? THEME.textMuted : colors.text,
          opacity: disabled ? 0.5 : 1,
          transform: isActive ? `translateY(${PRESS_OFFSET}px)` : 'translateY(0)',
          transition: 'transform 50ms ease-out',
          outline: 'none',
          padding: 0,
          ...sizeStyles,
        }}
      >
        {icon && <span style={{ fontSize: (sizeStyles.fontSize as number ?? 12) + 2 }}>{icon}</span>}
        {children}
      </button>
    </div>
  )
}

const VARIANT_COLORS = {
  default: {
    bg: THEME.bgPanel,
    bgHover: '#1e2235',
    border: THEME.borderAccent,
    borderHover: '#7d5da0',
    shadow: '#0a0c14',
    shadowBorder: THEME.borderDark,
    text: THEME.textPrimary,
  },
  primary: {
    bg: '#1a2a10',
    bgHover: '#223a15',
    border: THEME.green,
    borderHover: '#3ad874',
    shadow: '#0a1a05',
    shadowBorder: THEME.greenDim,
    text: THEME.green,
  },
  danger: {
    bg: '#2a1018',
    bgHover: '#3a1520',
    border: THEME.red,
    borderHover: '#ff6080',
    shadow: '#1a0810',
    shadowBorder: '#8b2030',
    text: THEME.red,
  },
  crt: {
    bg: '#0a1a0a',
    bgHover: '#0f2a0f',
    border: THEME.crtGreenDim,
    borderHover: THEME.crtGreen,
    shadow: '#051005',
    shadowBorder: '#0d3320',
    text: THEME.crtGreen,
  },
} as const

const SIZE_MAP: Record<string, CSSProperties> = {
  sm: { fontSize: 10, padding: '3px 8px', minWidth: 40 },
  md: { fontSize: 12, padding: '5px 14px', minWidth: 60 },
  lg: { fontSize: 14, padding: '8px 20px', minWidth: 80 },
}
