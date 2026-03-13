import { useState, useEffect, useCallback, useRef } from 'react'
import { PixelPanel } from './gba/PixelPanel'
import { PixelButton } from './gba/PixelButton'
import { THEME } from '../constants'
import { getVolume, setVolume, isMuted, setMuted, sfx } from '../audio/GBAAudio'

// ─── Types ──────────────────────────────────────────────────────────

interface SettingsPanelProps {
  visible: boolean
  onClose: () => void
  onPreferencesChange?: (prefs: Preferences) => void
}

export interface KeyBinding {
  action: string
  label: string
  keys: string[]
  default: string[]
}

export interface Preferences {
  fontSize: number
  crtEffect: boolean
  theme: 'dark' | 'retro-green' | 'warm'
  animationSpeed: number
  keybindings: Record<string, string[]>
}

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  { action: 'terminal', label: 'Toggle Terminal', keys: ['`'], default: ['`'] },
  { action: 'mayor', label: 'Open Mayor Chat', keys: ['m'], default: ['m'] },
  { action: 'settings', label: 'Open Settings', keys: ['s'], default: ['s'] },
  { action: 'customize', label: 'Character Customizer', keys: ['c'], default: ['c'] },
  { action: 'close', label: 'Close Panel', keys: ['Escape'], default: ['Escape'] },
  { action: 'zoomIn', label: 'Zoom In', keys: ['+'], default: ['+'] },
  { action: 'zoomOut', label: 'Zoom Out', keys: ['-'], default: ['-'] },
]

const DEFAULT_PREFS: Preferences = {
  fontSize: 12,
  crtEffect: false,
  theme: 'dark',
  animationSpeed: 1,
  keybindings: Object.fromEntries(DEFAULT_KEYBINDINGS.map(k => [k.action, k.default])),
}

const TABS = ['Keybindings', 'Display', 'Audio', 'About'] as const
type Tab = typeof TABS[number]

// ─── Helpers ────────────────────────────────────────────────────────

function formatKey(key: string): string {
  const map: Record<string, string> = {
    ' ': 'Space', 'Escape': 'Esc', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
    'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Backspace': 'Bksp',
    'Control': 'Ctrl', 'Meta': 'Cmd',
  }
  return map[key] || key.length === 1 ? (map[key] || key.toUpperCase()) : (map[key] || key)
}

function keysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((k, i) => k === b[i])
}

// ─── Main Component ─────────────────────────────────────────────────

export function SettingsPanel({ visible, onClose, onPreferencesChange }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('Keybindings')
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [bindings, setBindings] = useState<KeyBinding[]>(DEFAULT_KEYBINDINGS)
  const [capturing, setCapturing] = useState<string | null>(null)
  const [chordBuffer, setChordBuffer] = useState<string[]>([])
  const captureTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load preferences from server
  useEffect(() => {
    if (!visible) return
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return
        const p = { ...DEFAULT_PREFS }
        if (data.preferences.fontSize) p.fontSize = parseInt(data.preferences.fontSize, 10) || 12
        if (data.preferences.crtEffect) p.crtEffect = data.preferences.crtEffect === 'true'
        if (data.preferences.theme) p.theme = data.preferences.theme as Preferences['theme']
        if (data.preferences.animationSpeed) p.animationSpeed = parseFloat(data.preferences.animationSpeed) || 1
        if (data.preferences.keybindings) {
          try {
            const kb = JSON.parse(data.preferences.keybindings)
            p.keybindings = { ...DEFAULT_PREFS.keybindings, ...kb }
          } catch { /* use defaults */ }
        }
        setPrefs(p)
        // Update bindings from loaded keybindings
        setBindings(DEFAULT_KEYBINDINGS.map(b => ({
          ...b,
          keys: p.keybindings[b.action] || b.default,
        })))
        /* prefs loaded */
      })
      .catch(() => { /* use defaults */ })
  }, [visible])

  // Save preferences
  const save = useCallback((newPrefs: Preferences) => {
    setPrefs(newPrefs)
    onPreferencesChange?.(newPrefs)
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: {
          fontSize: String(newPrefs.fontSize),
          crtEffect: String(newPrefs.crtEffect),
          theme: newPrefs.theme,
          animationSpeed: String(newPrefs.animationSpeed),
          keybindings: JSON.stringify(newPrefs.keybindings),
        },
      }),
    }).catch(() => {})
  }, [onPreferencesChange])

  // Keybinding capture handler
  useEffect(() => {
    if (!capturing) return

    function handleCapture(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()

      const key = e.key
      // Ignore lone modifier keys while building chord
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return

      // Build chord: modifiers + key
      const chord: string[] = []
      if (e.ctrlKey) chord.push('Ctrl')
      if (e.shiftKey) chord.push('Shift')
      if (e.altKey) chord.push('Alt')
      if (e.metaKey) chord.push('Cmd')
      chord.push(key)

      setChordBuffer(prev => {
        const next = [...prev, chord.join('+')]
        // Auto-finish after 500ms of no new keys
        if (captureTimeout.current) clearTimeout(captureTimeout.current)
        captureTimeout.current = setTimeout(() => finishCapture(next), 500)
        return next
      })
    }

    window.addEventListener('keydown', handleCapture, true)
    return () => {
      window.removeEventListener('keydown', handleCapture, true)
      if (captureTimeout.current) clearTimeout(captureTimeout.current)
    }
  }, [capturing])

  const finishCapture = useCallback((keys: string[]) => {
    if (!capturing || keys.length === 0) {
      setCapturing(null)
      setChordBuffer([])
      return
    }
    const newBindings = bindings.map(b =>
      b.action === capturing ? { ...b, keys } : b
    )
    setBindings(newBindings)
    const newKeybindings = Object.fromEntries(newBindings.map(b => [b.action, b.keys]))
    save({ ...prefs, keybindings: newKeybindings })
    setCapturing(null)
    setChordBuffer([])
  }, [capturing, bindings, prefs, save])

  // Close on Escape (only when not capturing)
  useEffect(() => {
    if (!visible || capturing) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [visible, capturing, onClose])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      fontFamily: THEME.fontFamily,
    }}>
      <PixelPanel
        title="Options"
        variant="accent"
        width={520}
        height={440}
        style={{ position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            background: 'none',
            border: 'none',
            color: THEME.textMuted,
            fontFamily: THEME.fontFamily,
            fontSize: 14,
            cursor: 'pointer',
            zIndex: 10,
            padding: '2px 6px',
          }}
        >
          X
        </button>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: `2px solid ${THEME.goldDim}`,
          marginBottom: 8,
        }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '6px 0',
                background: tab === t ? '#2a2010' : 'transparent',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${THEME.gold}` : '2px solid transparent',
                color: tab === t ? THEME.gold : THEME.textSecondary,
                fontFamily: THEME.fontFamily,
                fontSize: 11,
                fontWeight: 'bold',
                letterSpacing: 2,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {tab === 'Keybindings' && (
            <KeybindingsTab
              bindings={bindings}
              capturing={capturing}
              chordBuffer={chordBuffer}
              onStartCapture={(action) => {
                setCapturing(action)
                setChordBuffer([])
              }}
              onCancelCapture={() => {
                setCapturing(null)
                setChordBuffer([])
              }}
              onReset={(action) => {
                const def = DEFAULT_KEYBINDINGS.find(k => k.action === action)
                if (!def) return
                const newBindings = bindings.map(b =>
                  b.action === action ? { ...b, keys: [...def.default] } : b
                )
                setBindings(newBindings)
                const newKeybindings = Object.fromEntries(newBindings.map(b => [b.action, b.keys]))
                save({ ...prefs, keybindings: newKeybindings })
              }}
              onResetAll={() => {
                setBindings(DEFAULT_KEYBINDINGS.map(b => ({ ...b, keys: [...b.default] })))
                save({ ...prefs, keybindings: DEFAULT_PREFS.keybindings })
              }}
            />
          )}
          {tab === 'Display' && (
            <DisplayTab prefs={prefs} onUpdate={(p) => save(p)} />
          )}
          {tab === 'Audio' && <AudioTab />}
          {tab === 'About' && <AboutTab />}
        </div>
      </PixelPanel>
    </div>
  )
}

// ─── Keybindings Tab ────────────────────────────────────────────────

function KeybindingsTab({
  bindings, capturing, chordBuffer, onStartCapture, onCancelCapture, onReset, onResetAll,
}: {
  bindings: KeyBinding[]
  capturing: string | null
  chordBuffer: string[]
  onStartCapture: (action: string) => void
  onCancelCapture: () => void
  onReset: (action: string) => void
  onResetAll: () => void
}) {
  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: '0 4px 6px',
        borderBottom: `1px solid ${THEME.borderPanel}`,
        marginBottom: 4,
      }}>
        <span style={{ flex: 1, fontSize: 9, color: THEME.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
          Action
        </span>
        <span style={{ width: 140, fontSize: 9, color: THEME.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
          Binding
        </span>
        <span style={{ width: 60, fontSize: 9, color: THEME.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
          Default
        </span>
        <span style={{ width: 30 }} />
      </div>

      {/* Binding rows */}
      {bindings.map(b => {
        const isCapturing = capturing === b.action
        const isCustom = !keysEqual(b.keys, b.default)

        return (
          <div
            key={b.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              background: isCapturing ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
              borderBottom: `1px solid ${THEME.borderDark}`,
            }}
          >
            {/* Action label */}
            <span style={{
              flex: 1,
              fontSize: 11,
              color: THEME.textPrimary,
            }}>
              {b.label}
            </span>

            {/* Current binding */}
            <div style={{ width: 140, display: 'flex', justifyContent: 'center', gap: 2 }}>
              {isCapturing ? (
                <div
                  onClick={onCancelCapture}
                  style={{
                    padding: '2px 8px',
                    background: 'rgba(255, 215, 0, 0.15)',
                    border: `1px dashed ${THEME.gold}`,
                    color: THEME.gold,
                    fontSize: 10,
                    cursor: 'pointer',
                    animation: 'pulse-border 1s infinite',
                    textAlign: 'center',
                    minWidth: 80,
                  }}
                >
                  {chordBuffer.length > 0
                    ? chordBuffer.map(k => formatKey(k)).join(' , ')
                    : 'Press key...'}
                </div>
              ) : (
                <div
                  onClick={() => onStartCapture(b.action)}
                  style={{
                    padding: '2px 8px',
                    background: THEME.bgDark,
                    border: `1px solid ${isCustom ? THEME.gold : THEME.borderPanel}`,
                    color: isCustom ? THEME.gold : THEME.textPrimary,
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: 80,
                  }}
                >
                  {b.keys.map(k => formatKey(k)).join(' , ')}
                </div>
              )}
            </div>

            {/* Default */}
            <div style={{ width: 60, textAlign: 'center' }}>
              <span style={{ fontSize: 9, color: THEME.textMuted }}>
                {b.default.map(k => formatKey(k)).join(' , ')}
              </span>
            </div>

            {/* Reset single */}
            <div style={{ width: 30, textAlign: 'center' }}>
              {isCustom && (
                <button
                  onClick={() => onReset(b.action)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: THEME.textMuted,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontFamily: THEME.fontFamily,
                    padding: '0 4px',
                  }}
                  title="Reset to default"
                >
                  R
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: THEME.textMuted }}>
          Click binding to rebind. Press multiple keys for chords.
        </span>
        <PixelButton size="sm" onClick={onResetAll}>
          Reset All
        </PixelButton>
      </div>
    </div>
  )
}

// ─── Display Tab ────────────────────────────────────────────────────

function DisplayTab({ prefs, onUpdate }: { prefs: Preferences; onUpdate: (p: Preferences) => void }) {
  const themes: { id: Preferences['theme']; label: string; preview: string }[] = [
    { id: 'dark', label: 'Dark', preview: '#141722' },
    { id: 'retro-green', label: 'Retro Green', preview: '#0a2010' },
    { id: 'warm', label: 'Warm', preview: '#1a1508' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Font Size */}
      <SettingRow label="Font Size" hint={`${prefs.fontSize}px`}>
        <input
          type="range"
          min={8}
          max={20}
          step={1}
          value={prefs.fontSize}
          onChange={e => onUpdate({ ...prefs, fontSize: parseInt(e.target.value, 10) })}
          style={{ width: 160, accentColor: THEME.gold }}
        />
      </SettingRow>

      {/* CRT Effect */}
      <SettingRow label="CRT Effect" hint={prefs.crtEffect ? 'ON' : 'OFF'}>
        <ToggleSwitch
          value={prefs.crtEffect}
          onChange={v => onUpdate({ ...prefs, crtEffect: v })}
        />
      </SettingRow>

      {/* Theme Selector */}
      <SettingRow label="Theme">
        <div style={{ display: 'flex', gap: 6 }}>
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => onUpdate({ ...prefs, theme: t.id })}
              style={{
                width: 70,
                padding: '6px 4px',
                background: t.preview,
                border: `2px solid ${prefs.theme === t.id ? THEME.gold : THEME.borderPanel}`,
                color: prefs.theme === t.id ? THEME.gold : THEME.textSecondary,
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Animation Speed */}
      <SettingRow label="Animation Speed" hint={`${prefs.animationSpeed.toFixed(1)}x`}>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.5}
          value={prefs.animationSpeed}
          onChange={e => onUpdate({ ...prefs, animationSpeed: parseFloat(e.target.value) })}
          style={{ width: 160, accentColor: THEME.gold }}
        />
      </SettingRow>
    </div>
  )
}

// ─── Audio Tab ──────────────────────────────────────────────────────

function AudioTab() {
  const [vol, setVol] = useState(getVolume())
  const [muted, setMutedState] = useState(isMuted())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mute toggle */}
      <SettingRow label="Sound Effects" hint={muted ? 'OFF' : 'ON'}>
        <ToggleSwitch
          value={!muted}
          onChange={(v) => {
            setMuted(!v)
            setMutedState(!v)
            if (v) sfx('buttonClick')
          }}
        />
      </SettingRow>

      {/* Volume slider */}
      <SettingRow label="Volume" hint={`${Math.round(vol * 100)}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(vol * 100)}
          onChange={e => {
            const v = parseInt(e.target.value, 10) / 100
            setVol(v)
            setVolume(v)
          }}
          onMouseUp={() => sfx('buttonClick')}
          style={{ width: 160, accentColor: THEME.gold }}
          disabled={muted}
        />
      </SettingRow>

      {/* Test sounds */}
      <div>
        <div style={{
          fontSize: 9,
          color: THEME.goldDim,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Test Sounds
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['menuOpen', 'menuSelect', 'notifyAgent', 'notifyAlert', 'agentSpawn', 'agentComplete', 'bootChime', 'beadPickup'] as const).map(name => (
            <button
              key={name}
              onClick={() => sfx(name)}
              disabled={muted}
              style={{
                padding: '4px 8px',
                background: THEME.bgDark,
                border: `1px solid ${THEME.borderPanel}`,
                color: muted ? THEME.textMuted : THEME.textSecondary,
                fontFamily: THEME.fontFamily,
                fontSize: 9,
                cursor: muted ? 'default' : 'pointer',
                opacity: muted ? 0.4 : 1,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── About Tab ──────────────────────────────────────────────────────

function AboutTab() {
  const [status, setStatus] = useState<string>('Loading...')

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => setStatus(data.data || 'No status available'))
      .catch(() => setStatus('Bridge offline'))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Version */}
      <div style={{
        textAlign: 'center',
        padding: '12px 0',
        borderBottom: `1px solid ${THEME.borderPanel}`,
      }}>
        <div style={{ fontSize: 16, color: THEME.gold, fontWeight: 'bold', letterSpacing: 3 }}>
          GT ARCADE
        </div>
        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>
          v0.1.0
        </div>
      </div>

      {/* GT Status */}
      <div>
        <div style={{
          fontSize: 9,
          color: THEME.goldDim,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Gas Town Status
        </div>
        <pre style={{
          fontSize: 9,
          color: THEME.textSecondary,
          background: THEME.bgDark,
          border: `1px solid ${THEME.borderPanel}`,
          padding: 8,
          margin: 0,
          maxHeight: 140,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: THEME.fontFamily,
        }}>
          {status}
        </pre>
      </div>

      {/* Credits */}
      <div style={{
        textAlign: 'center',
        padding: '8px 0',
        borderTop: `1px solid ${THEME.borderPanel}`,
      }}>
        <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: 1 }}>
          BUILT WITH
        </div>
        <div style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 4 }}>
          React + Phaser + Gas Town
        </div>
        <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 8, lineHeight: 1.6 }}>
          Pixel art engine by polecats
          <br />
          Multi-agent orchestration by Gas Town
          <br />
          Powered by Claude
        </div>
      </div>
    </div>
  )
}

// ─── Shared Sub-Components ──────────────────────────────────────────

function SettingRow({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 0',
    }}>
      <div>
        <span style={{ fontSize: 11, color: THEME.textPrimary }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 9, color: THEME.goldDim, marginLeft: 8 }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40,
        height: 20,
        background: value ? THEME.green : THEME.bgDark,
        border: `2px solid ${value ? THEME.greenDim : THEME.borderPanel}`,
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        transition: 'background 150ms',
      }}
    >
      {/* Knob */}
      <div style={{
        position: 'absolute',
        top: 1,
        left: value ? 20 : 2,
        width: 14,
        height: 14,
        background: value ? '#fff' : THEME.textMuted,
        transition: 'left 150ms',
      }} />
    </button>
  )
}

// ─── Exported helpers for App.tsx keybinding integration ────────────

export function matchesBinding(
  e: KeyboardEvent,
  keys: string[],
): boolean {
  for (const keyStr of keys) {
    const parts = keyStr.split('+')
    const key = parts[parts.length - 1]
    const needCtrl = parts.includes('Ctrl')
    const needShift = parts.includes('Shift')
    const needAlt = parts.includes('Alt')
    const needCmd = parts.includes('Cmd')

    if (
      e.key === key &&
      e.ctrlKey === needCtrl &&
      e.shiftKey === needShift &&
      e.altKey === needAlt &&
      e.metaKey === needCmd
    ) {
      return true
    }
  }
  return false
}
