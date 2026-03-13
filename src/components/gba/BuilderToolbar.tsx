import { useState } from 'react'
import { THEME } from '../../constants'

export interface BuilderToolbarProps {
  onSave?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onPlay?: () => void
  onGridToggle?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  gridVisible?: boolean
  canUndo?: boolean
  canRedo?: boolean
  isPlaying?: boolean
  zoomLevel?: number
}

interface ToolbarButton {
  id: string
  label: string
  icon: number[][]
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  variant?: 'default' | 'primary' | 'accent'
}

const ICON_SIZE = 9

export function BuilderToolbar({
  onSave,
  onUndo,
  onRedo,
  onPlay,
  onGridToggle,
  onZoomIn,
  onZoomOut,
  gridVisible = true,
  canUndo = false,
  canRedo = false,
  isPlaying = false,
  zoomLevel = 1,
}: BuilderToolbarProps) {
  const buttons: ToolbarButton[] = [
    {
      id: 'save',
      label: 'Save',
      icon: ICON_SAVE,
      onClick: onSave,
      variant: 'primary',
    },
    {
      id: 'sep1',
      label: '',
      icon: [],
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: ICON_UNDO,
      onClick: onUndo,
      disabled: !canUndo,
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: ICON_REDO,
      onClick: onRedo,
      disabled: !canRedo,
    },
    {
      id: 'sep2',
      label: '',
      icon: [],
    },
    {
      id: 'play',
      label: isPlaying ? 'Stop' : 'Play',
      icon: isPlaying ? ICON_STOP : ICON_PLAY,
      onClick: onPlay,
      active: isPlaying,
      variant: isPlaying ? 'accent' : 'default',
    },
    {
      id: 'sep3',
      label: '',
      icon: [],
    },
    {
      id: 'grid',
      label: 'Grid',
      icon: ICON_GRID,
      onClick: onGridToggle,
      active: gridVisible,
    },
    {
      id: 'sep4',
      label: '',
      icon: [],
    },
    {
      id: 'zoom_out',
      label: '-',
      icon: ICON_ZOOM_OUT,
      onClick: onZoomOut,
    },
    {
      id: 'zoom_level',
      label: `${Math.round(zoomLevel * 100)}%`,
      icon: [],
    },
    {
      id: 'zoom_in',
      label: '+',
      icon: ICON_ZOOM_IN,
      onClick: onZoomIn,
    },
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: THEME.bgPanel,
      border: `2px solid ${THEME.borderAccent}`,
      padding: '3px 6px',
    }}>
      {buttons.map((btn) => {
        if (btn.id.startsWith('sep')) {
          return <Separator key={btn.id} />
        }
        if (btn.id === 'zoom_level') {
          return (
            <span key={btn.id} style={{
              fontFamily: THEME.fontFamily,
              fontSize: 9,
              color: THEME.textSecondary,
              minWidth: 32,
              textAlign: 'center',
            }}>
              {btn.label}
            </span>
          )
        }
        return (
          <ToolButton
            key={btn.id}
            icon={btn.icon}
            label={btn.label}
            onClick={btn.onClick}
            disabled={btn.disabled}
            active={btn.active}
            variant={btn.variant}
          />
        )
      })}
    </div>
  )
}

function Separator() {
  return (
    <div style={{
      width: 1,
      height: 18,
      background: THEME.borderPanel,
      margin: '0 3px',
    }} />
  )
}

function ToolButton({ icon, label, onClick, disabled, active, variant = 'default' }: {
  icon: number[][]
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  variant?: 'default' | 'primary' | 'accent'
}) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const colors = BUTTON_COLORS[variant]
  const isActive = pressed && !disabled

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => { setPressed(false); setHovered(false) }}
      onMouseEnter={() => setHovered(true)}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 22,
        fontFamily: THEME.fontFamily,
        fontSize: 9,
        cursor: disabled ? 'default' : 'pointer',
        border: `2px solid ${active ? colors.activeBorder : hovered && !disabled ? colors.hoverBorder : colors.border}`,
        background: active ? colors.activeBg : hovered && !disabled ? colors.hoverBg : colors.bg,
        color: disabled ? THEME.textMuted : colors.text,
        opacity: disabled ? 0.4 : 1,
        transform: isActive ? 'translateY(1px)' : 'none',
        transition: 'transform 50ms ease-out',
        outline: 'none',
        padding: 0,
        position: 'relative',
      }}
    >
      {icon.length > 0 ? (
        <PixelIcon pixels={icon} color={disabled ? THEME.textMuted : colors.iconColor} />
      ) : (
        <span>{label}</span>
      )}
    </button>
  )
}

function PixelIcon({ pixels, color }: { pixels: number[][]; color: string }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      style={{ imageRendering: 'pixelated' }}
    >
      {pixels.map((row, y) =>
        row.map((val, x) =>
          val ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : null
        )
      )}
    </svg>
  )
}

const BUTTON_COLORS = {
  default: {
    bg: THEME.bgDark,
    hoverBg: '#1e2235',
    activeBg: THEME.borderAccent + '40',
    border: THEME.borderPanel,
    hoverBorder: THEME.borderAccent,
    activeBorder: THEME.borderAccent,
    text: THEME.textPrimary,
    iconColor: THEME.textPrimary,
  },
  primary: {
    bg: '#0e1a08',
    hoverBg: '#162a10',
    activeBg: '#1a3a14',
    border: THEME.greenDim,
    hoverBorder: THEME.green,
    activeBorder: THEME.green,
    text: THEME.green,
    iconColor: THEME.green,
  },
  accent: {
    bg: '#1a1400',
    hoverBg: '#2a2000',
    activeBg: '#3a2c00',
    border: THEME.goldDim,
    hoverBorder: THEME.gold,
    activeBorder: THEME.gold,
    text: THEME.gold,
    iconColor: THEME.gold,
  },
} as const

// 9x9 pixel art icons
// 1 = filled, 0 = empty

const ICON_SAVE: number[][] = [
  [1,1,1,1,1,1,1,1,0],
  [1,0,0,0,0,0,0,1,1],
  [1,0,1,1,1,1,0,0,1],
  [1,0,1,1,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,0,1],
  [1,0,1,0,0,1,1,0,1],
  [1,0,1,0,0,1,1,0,1],
  [1,1,1,1,1,1,1,1,1],
]

const ICON_UNDO: number[][] = [
  [0,0,0,1,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,0,0],
  [0,0,1,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,1,0,0],
  [0,0,0,1,1,1,0,0,0],
]

const ICON_REDO: number[][] = [
  [0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,1,0,0],
  [0,0,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0],
  [0,1,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,0,0,0],
]

const ICON_PLAY: number[][] = [
  [0,1,0,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0],
  [0,1,1,1,0,0,0,0,0],
  [0,1,1,1,1,0,0,0,0],
  [0,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,0,0,0,0],
  [0,1,1,1,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0],
]

const ICON_STOP: number[][] = [
  [0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0],
]

const ICON_GRID: number[][] = [
  [0,0,0,1,0,0,0,1,0],
  [0,0,0,1,0,0,0,1,0],
  [0,0,0,1,0,0,0,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,0,0,1,0,0,0,1,0],
  [0,0,0,1,0,0,0,1,0],
  [0,0,0,1,0,0,0,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,0,0,1,0,0,0,1,0],
]

const ICON_ZOOM_IN: number[][] = [
  [0,0,1,1,1,0,0,0,0],
  [0,1,0,0,0,1,0,0,0],
  [1,0,0,1,0,0,1,0,0],
  [1,0,1,1,1,0,1,0,0],
  [1,0,0,1,0,0,1,0,0],
  [0,1,0,0,0,1,0,0,0],
  [0,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,1,0],
]

const ICON_ZOOM_OUT: number[][] = [
  [0,0,1,1,1,0,0,0,0],
  [0,1,0,0,0,1,0,0,0],
  [1,0,0,0,0,0,1,0,0],
  [1,0,1,1,1,0,1,0,0],
  [1,0,0,0,0,0,1,0,0],
  [0,1,0,0,0,1,0,0,0],
  [0,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,1,0],
]
