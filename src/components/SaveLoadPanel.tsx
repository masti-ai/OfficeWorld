import { useState, useEffect, useCallback } from 'react'
import Phaser from 'phaser'
import { PixelPanel } from './gba/PixelPanel'
import { PixelButton } from './gba/PixelButton'
import { THEME } from '../constants'
import { ArcadeScene } from '../game/ArcadeScene'
import { notify } from './NotificationToast'

interface SaveLoadPanelProps {
  visible: boolean
  onClose: () => void
  game: Phaser.Game | null
}

interface SaveEntry {
  slot: string
  name: string
  is_autosave: number
  created_at: number
  updated_at: number
}

const MAX_MANUAL_SLOTS = 5

export function SaveLoadPanel({ visible, onClose, game }: SaveLoadPanelProps) {
  const [saves, setSaves] = useState<SaveEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saveName, setSaveName] = useState('')

  const fetchSaves = useCallback(async () => {
    try {
      const res = await fetch('/api/saves')
      if (!res.ok) return
      const data = await res.json()
      setSaves(data.saves ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (visible) fetchSaves()
  }, [visible, fetchSaves])

  const getScene = useCallback((): ArcadeScene | null => {
    if (!game) return null
    return game.scene.getScene('ArcadeScene') as ArcadeScene | null
  }, [game])

  const handleSave = useCallback(async (slot?: string) => {
    const scene = getScene()
    if (!scene) return

    const state = scene.getFullState()
    const targetSlot = slot || `manual-${Date.now()}`
    const name = saveName.trim() || new Date().toLocaleString()

    try {
      setLoading(true)
      const res = await fetch(`/api/saves/${encodeURIComponent(targetSlot)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, state, autosave: false }),
      })
      if (res.ok) {
        notify('system', 'Game Saved', name)
        setSaveName('')
        fetchSaves()
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [getScene, saveName, fetchSaves])

  const handleLoad = useCallback(async (slot: string) => {
    const scene = getScene()
    if (!scene) return

    try {
      setLoading(true)
      const res = await fetch(`/api/saves/${encodeURIComponent(slot)}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.save?.state) {
        scene.loadState(data.save.state)
        notify('system', 'Game Loaded', data.save.name)
        onClose()
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [getScene, onClose])

  const handleDelete = useCallback(async (slot: string) => {
    try {
      const res = await fetch(`/api/saves/${encodeURIComponent(slot)}`, { method: 'DELETE' })
      if (res.ok) {
        notify('system', 'Save Deleted', slot)
        fetchSaves()
      }
    } catch { /* ignore */ }
  }, [fetchSaves])

  if (!visible) return null

  const manualSaves = saves.filter(s => !s.is_autosave)
  const autoSaves = saves.filter(s => s.is_autosave)

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9000,
      fontFamily: THEME.fontFamily,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420 }}>
        <PixelPanel title="SAVE / LOAD" width={420}>
          {/* New save section */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Save name..."
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                maxLength={48}
                style={{
                  flex: 1,
                  fontFamily: THEME.fontFamily,
                  fontSize: 11,
                  background: THEME.bgDark,
                  color: THEME.textPrimary,
                  border: `1px solid ${THEME.borderPanel}`,
                  padding: '4px 8px',
                  outline: 'none',
                }}
              />
              <PixelButton
                variant="primary"
                size="sm"
                onClick={() => handleSave()}
                disabled={loading || manualSaves.length >= MAX_MANUAL_SLOTS}
              >
                SAVE
              </PixelButton>
            </div>
            {manualSaves.length >= MAX_MANUAL_SLOTS && (
              <div style={{ fontSize: 9, color: THEME.red, marginTop: 3 }}>
                Max {MAX_MANUAL_SLOTS} manual saves. Delete one to save again.
              </div>
            )}
          </div>

          {/* Auto-saves */}
          {autoSaves.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: THEME.gold, letterSpacing: 1, marginBottom: 4 }}>
                AUTO-SAVES
              </div>
              {autoSaves.map(s => (
                <SaveRow key={s.slot} save={s} onLoad={handleLoad} onDelete={handleDelete} loading={loading} />
              ))}
            </div>
          )}

          {/* Manual saves */}
          {manualSaves.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: THEME.gold, letterSpacing: 1, marginBottom: 4 }}>
                MANUAL SAVES
              </div>
              {manualSaves.map(s => (
                <SaveRow key={s.slot} save={s} onLoad={handleLoad} onDelete={handleDelete} loading={loading} />
              ))}
            </div>
          )}

          {saves.length === 0 && (
            <div style={{ fontSize: 11, color: THEME.textMuted, textAlign: 'center', padding: '12px 0' }}>
              No saves yet. Create one above.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <PixelButton size="sm" onClick={onClose}>CLOSE</PixelButton>
          </div>
        </PixelPanel>
      </div>
    </div>
  )
}

function SaveRow({ save, onLoad, onDelete, loading }: {
  save: SaveEntry
  onLoad: (slot: string) => void
  onDelete: (slot: string) => void
  loading: boolean
}) {
  const date = new Date(save.updated_at * 1000)
  const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 0',
      borderBottom: `1px solid ${THEME.borderDark}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: THEME.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {save.name}
        </div>
        <div style={{ fontSize: 9, color: THEME.textMuted }}>
          {timeStr}{save.is_autosave ? ' (auto)' : ''}
        </div>
      </div>
      <PixelButton size="sm" variant="primary" onClick={() => onLoad(save.slot)} disabled={loading}>
        LOAD
      </PixelButton>
      <PixelButton size="sm" variant="danger" onClick={() => onDelete(save.slot)} disabled={loading}>
        DEL
      </PixelButton>
    </div>
  )
}

// Auto-save interval (2 minutes)
const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000
const AUTOSAVE_SLOT = 'autosave'

export function useAutoSave(game: Phaser.Game | null) {
  useEffect(() => {
    if (!game) return

    const timer = setInterval(async () => {
      const scene = game.scene.getScene('ArcadeScene') as ArcadeScene | null
      if (!scene) return

      const state = scene.getFullState()
      try {
        await fetch(`/api/saves/${AUTOSAVE_SLOT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Auto-save ${new Date().toLocaleTimeString()}`,
            state,
            autosave: true,
          }),
        })
      } catch { /* silent fail for auto-save */ }
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [game])
}
