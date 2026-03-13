import { useEffect, useState, type CSSProperties } from 'react'
import { THEME } from '../../constants'
import { sfx } from '../../audio/GBAAudio'

export interface PixelMenuItem {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  onSelect?: () => void
}

export interface PixelMenuProps {
  items: PixelMenuItem[]
  visible: boolean
  onClose: () => void
  from?: 'left' | 'right' | 'top' | 'bottom'
  title?: string
  style?: CSSProperties
}

const SLIDE_DURATION = 200
const BORDER = 2

/**
 * GBA-style slide-in menu panel. Slides in from a specified edge with
 * a pixel art border and selectable items with highlight cursor.
 */
export function PixelMenu({
  items,
  visible,
  onClose,
  from = 'right',
  title,
  style,
}: PixelMenuProps) {
  const [mounted, setMounted] = useState(false)
  const [animIn, setAnimIn] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Mount/unmount with animation
  useEffect(() => {
    if (visible) {
      setMounted(true)
      setActiveIdx(0)
      sfx('menuOpen')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimIn(true))
      })
    } else {
      sfx('menuClose')
      setAnimIn(false)
      const timer = setTimeout(() => setMounted(false), SLIDE_DURATION)
      return () => clearTimeout(timer)
    }
  }, [visible])

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveIdx((prev) => {
          let next = prev + 1
          while (next < items.length && items[next].disabled) next++
          if (next < items.length) { sfx('menuNav'); return next }
          return prev
        })
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveIdx((prev) => {
          let next = prev - 1
          while (next >= 0 && items[next].disabled) next--
          if (next >= 0) { sfx('menuNav'); return next }
          return prev
        })
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const item = items[activeIdx]
        if (item && !item.disabled) {
          sfx('menuSelect')
          item.onSelect?.()
          onClose()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible, activeIdx, items, onClose])

  if (!mounted) return null

  const slideTransform = getSlideTransform(from, animIn)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          opacity: animIn ? 1 : 0,
          transition: `opacity ${SLIDE_DURATION}ms ease`,
          zIndex: 1000,
        }}
      />

      {/* Menu panel */}
      <div style={{
        position: 'fixed',
        ...getPositionStyles(from),
        zIndex: 1001,
        transform: slideTransform,
        transition: `transform ${SLIDE_DURATION}ms ease-out`,
        ...style,
      }}>
        <div style={{
          background: THEME.bgPanel,
          border: `${BORDER}px solid ${THEME.borderAccent}`,
          minWidth: 180,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `4px 4px 0px ${THEME.borderDark}`,
        }}>
          {/* Title bar */}
          {title && (
            <div style={{
              fontFamily: THEME.fontFamily,
              fontSize: 11,
              fontWeight: 'bold',
              color: THEME.gold,
              letterSpacing: 2,
              textTransform: 'uppercase',
              padding: '6px 12px 4px',
              borderBottom: `${BORDER}px solid ${THEME.borderPanel}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ color: THEME.goldDim }}>{'>'}</span>
              {title}
            </div>
          )}

          {/* Menu items */}
          <div style={{ overflowY: 'auto', padding: '4px 0' }}>
            {items.map((item, idx) => {
              const isActive = idx === activeIdx
              const isDisabled = item.disabled
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isDisabled) return
                    sfx('menuSelect')
                    item.onSelect?.()
                    onClose()
                  }}
                  onMouseEnter={() => { if (!isDisabled) { sfx('menuNav'); setActiveIdx(idx) } }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    fontFamily: THEME.fontFamily,
                    fontSize: 12,
                    color: isDisabled ? THEME.textMuted : isActive ? THEME.textBright : THEME.textPrimary,
                    background: isActive && !isDisabled ? THEME.borderAccent + '40' : 'transparent',
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {/* GBA-style selection cursor */}
                  <span style={{
                    width: 8,
                    color: THEME.gold,
                    fontSize: 10,
                    visibility: isActive && !isDisabled ? 'visible' : 'hidden',
                  }}>
                    {'\u25B6'}
                  </span>
                  {item.icon && <span style={{ fontSize: 14 }}>{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>

          {/* Footer hint */}
          <div style={{
            borderTop: `1px solid ${THEME.borderPanel}`,
            padding: '3px 12px',
            fontSize: 9,
            color: THEME.textMuted,
            fontFamily: THEME.fontFamily,
          }}>
            Arrow keys=nav | Enter=select | Esc=close
          </div>
        </div>
      </div>
    </>
  )
}

function getSlideTransform(from: string, animIn: boolean): string {
  if (animIn) return 'translate(0, 0)'
  switch (from) {
    case 'left': return 'translateX(-100%)'
    case 'right': return 'translateX(100%)'
    case 'top': return 'translateY(-100%)'
    case 'bottom': return 'translateY(100%)'
    default: return 'translateX(100%)'
  }
}

function getPositionStyles(from: string): CSSProperties {
  switch (from) {
    case 'left': return { top: 0, left: 0, bottom: 0 }
    case 'right': return { top: 0, right: 0, bottom: 0 }
    case 'top': return { top: 0, left: 0, right: 0 }
    case 'bottom': return { bottom: 0, left: 0, right: 0 }
    default: return { top: 0, right: 0, bottom: 0 }
  }
}
