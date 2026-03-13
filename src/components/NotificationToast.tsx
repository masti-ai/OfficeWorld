import { useState, useEffect, useCallback, useRef } from 'react'
import { THEME } from '../constants'
import { sfx } from '../audio/GBAAudio'

export type NotificationCategory = 'agent' | 'alert' | 'mail' | 'system'

export interface Notification {
  id: string
  category: NotificationCategory
  title: string
  message?: string
  timestamp: number
  duration?: number
}

interface ToastEntry extends Notification {
  phase: 'entering' | 'visible' | 'exiting'
  progress: number
}

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 3500
const ENTER_DURATION = 300
const EXIT_DURATION = 250

const CATEGORY_CONFIG: Record<NotificationCategory, {
  icon: string
  color: string
  bgTint: string
  borderColor: string
  label: string
  sfxName: 'notifyAgent' | 'notifyAlert' | 'notifyMail' | 'notifySystem'
}> = {
  agent: {
    icon: '\u{1F916}',
    color: THEME.cyan,
    bgTint: '#0a1a22',
    borderColor: '#1a4a5a',
    label: 'AGENT',
    sfxName: 'notifyAgent',
  },
  alert: {
    icon: '\u26A0',
    color: THEME.red,
    bgTint: '#220a0a',
    borderColor: '#5a1a1a',
    label: 'ALERT',
    sfxName: 'notifyAlert',
  },
  mail: {
    icon: '\u2709',
    color: THEME.gold,
    bgTint: '#1a1800',
    borderColor: '#4a4010',
    label: 'MAIL',
    sfxName: 'notifyMail',
  },
  system: {
    icon: '\u2699',
    color: THEME.green,
    bgTint: '#0a1a0a',
    borderColor: '#1a4a1a',
    label: 'SYS',
    sfxName: 'notifySystem',
  },
}

let notifyListeners: Array<(n: Notification) => void> = []
let idCounter = 0

export function notify(
  category: NotificationCategory,
  title: string,
  message?: string,
  duration?: number,
) {
  const notification: Notification = {
    id: `toast-${++idCounter}-${Date.now()}`,
    category,
    title,
    message,
    timestamp: Date.now(),
    duration,
  }
  notifyListeners.forEach((fn) => fn(notification))
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const startExit = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, phase: 'exiting' as const } : t)),
    )
    const timer = setTimeout(() => removeToast(id), EXIT_DURATION)
    timersRef.current.set(`exit-${id}`, timer)
  }, [removeToast])

  const addToast = useCallback((n: Notification) => {
    const entry: ToastEntry = { ...n, phase: 'entering', progress: 1 }
    const config = CATEGORY_CONFIG[n.category]

    sfx(config.sfxName)

    setToasts((prev) => {
      const next = [...prev, entry]
      // Evict oldest if over limit
      while (next.length > MAX_VISIBLE) {
        const oldest = next.shift()
        if (oldest) {
          const timer = timersRef.current.get(oldest.id)
          if (timer) clearTimeout(timer)
          timersRef.current.delete(oldest.id)
        }
      }
      return next
    })

    // Enter -> visible
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === n.id ? { ...t, phase: 'visible' as const } : t)),
      )
    }, ENTER_DURATION)

    // Auto-dismiss
    const duration = n.duration ?? DEFAULT_DURATION
    const timer = setTimeout(() => startExit(n.id), duration)
    timersRef.current.set(n.id, timer)
  }, [startExit])

  useEffect(() => {
    notifyListeners.push(addToast)
    return () => {
      notifyListeners = notifyListeners.filter((fn) => fn !== addToast)
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [addToast])

  // Progress bar animation
  useEffect(() => {
    if (toasts.length === 0) return
    const interval = setInterval(() => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.phase !== 'visible') return t
          const duration = t.duration ?? DEFAULT_DURATION
          const elapsed = Date.now() - t.timestamp - ENTER_DURATION
          const progress = Math.max(0, 1 - elapsed / duration)
          return { ...t, progress }
        }),
      )
    }, 50)
    return () => clearInterval(interval)
  }, [toasts.length > 0])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 72,
      right: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {toasts.map((toast) => {
        const config = CATEGORY_CONFIG[toast.category]
        const translateX =
          toast.phase === 'entering' ? 'translateX(120%)' :
          toast.phase === 'exiting' ? 'translateX(120%)' :
          'translateX(0)'
        const opacity = toast.phase === 'exiting' ? 0.3 : 1

        return (
          <div
            key={toast.id}
            onClick={() => startExit(toast.id)}
            style={{
              width: 280,
              background: config.bgTint,
              border: `2px solid ${config.borderColor}`,
              fontFamily: THEME.fontFamily,
              transform: translateX,
              opacity,
              transition: `transform ${toast.phase === 'entering' ? ENTER_DURATION : EXIT_DURATION}ms ease-out, opacity ${EXIT_DURATION}ms ease-out`,
              pointerEvents: 'auto',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              imageRendering: 'pixelated',
            }}
          >
            {/* Pixel border highlight (top edge bevel) */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 2,
              right: 2,
              height: 1,
              background: config.color,
              opacity: 0.3,
            }} />

            {/* Content */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px 6px',
            }}>
              {/* Category icon with pixel border */}
              <div style={{
                width: 28,
                height: 28,
                background: config.borderColor,
                border: `2px solid ${config.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontFamily: 'sans-serif',
                flexShrink: 0,
              }}>
                {config.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category label + title */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 2,
                }}>
                  <span style={{
                    fontSize: 8,
                    fontWeight: 'bold',
                    color: config.color,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}>
                    {config.label}
                  </span>
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: THEME.textBright,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {toast.title}
                </div>
                {toast.message && (
                  <div style={{
                    fontSize: 10,
                    color: THEME.textSecondary,
                    lineHeight: 1.3,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {toast.message}
                  </div>
                )}
              </div>

              {/* Dismiss pixel X */}
              <span style={{
                fontSize: 10,
                color: THEME.textMuted,
                fontWeight: 'bold',
                flexShrink: 0,
                marginTop: 2,
              }}>
                x
              </span>
            </div>

            {/* Progress bar (pixel scanline style) */}
            <div style={{
              height: 3,
              background: `${config.color}15`,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${toast.progress * 100}%`,
                background: config.color,
                opacity: 0.6,
                transition: 'width 60ms linear',
                // Pixel dither pattern via repeating gradient
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  ${config.color} 0px,
                  ${config.color} 2px,
                  transparent 2px,
                  transparent 4px
                )`,
              }} />
            </div>

            {/* Bottom shadow edge */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 2,
              right: 2,
              height: 1,
              background: '#000',
              opacity: 0.4,
            }} />
          </div>
        )
      })}
    </div>
  )
}
