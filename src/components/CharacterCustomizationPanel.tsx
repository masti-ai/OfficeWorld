import { useState, useEffect, useCallback, useRef } from 'react'
import { PixelPanel } from './gba/PixelPanel'
import { PixelButton } from './gba/PixelButton'
import { generatePortrait } from '../game/sprites/PortraitGenerator'
import { traitsFromName } from '../game/sprites/SpriteGenerator'
import {
  THEME, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS,
  HAT_STYLES, HAIR_STYLES, FACE_STYLES,
} from '../constants'
import type { AgentVisualTraits } from '../types'

interface CharacterCustomizationPanelProps {
  visible: boolean
  onClose: () => void
  agentId: string | null
  agentName: string
  agentRig?: string
}

type Category = 'hair' | 'face' | 'hat' | 'skin' | 'outfit' | 'accessory'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'hair', label: 'Hair' },
  { id: 'face', label: 'Face' },
  { id: 'hat', label: 'Hat' },
  { id: 'skin', label: 'Skin' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'accessory', label: 'Acc.' },
]

const ACCESSORY_COLORS = [
  0xc41e3a, 0x1e6090, 0x6b4e8b, 0x2e8b57, 0xffd700,
  0xff9800, 0x607d8b, 0x8b5e3c, 0x1a1a1a, 0xf5deb3,
]

function toCSS(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export function CharacterCustomizationPanel({
  visible, onClose, agentId, agentName, agentRig,
}: CharacterCustomizationPanelProps) {
  const [category, setCategory] = useState<Category>('hair')
  const [traits, setTraits] = useState<AgentVisualTraits | null>(null)
  const [savedTraits, setSavedTraits] = useState<AgentVisualTraits | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [animFrame, setAnimFrame] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load traits from server, fall back to generated defaults
  useEffect(() => {
    if (!visible || !agentId) return
    const defaults = traitsFromName(agentName, agentRig)
    fetch(`/api/agent-traits/${encodeURIComponent(agentId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.traits) {
          setTraits(data.traits)
          setSavedTraits(data.traits)
        } else {
          setTraits(defaults)
          setSavedTraits(defaults)
        }
      })
      .catch(() => {
        setTraits(defaults)
        setSavedTraits(defaults)
      })
  }, [visible, agentId, agentName, agentRig])

  // Idle animation cycle for preview
  useEffect(() => {
    if (!visible) {
      if (animRef.current) clearInterval(animRef.current)
      return
    }
    animRef.current = setInterval(() => {
      setAnimFrame(f => (f + 1) % 8)
    }, 400)
    return () => {
      if (animRef.current) clearInterval(animRef.current)
    }
  }, [visible])

  // Regenerate preview when traits change
  useEffect(() => {
    if (!traits) return
    const url = generatePortrait(agentName, traits)
    setPreviewUrl(url)
  }, [traits, agentName, animFrame])

  const updateTrait = useCallback(<K extends keyof AgentVisualTraits>(
    key: K, value: AgentVisualTraits[K],
  ) => {
    setTraits(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  const handleSave = useCallback(() => {
    if (!agentId || !traits) return
    fetch(`/api/agent-traits/${encodeURIComponent(agentId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traits }),
    }).catch(() => {})
    setSavedTraits(traits)
    onClose()
  }, [agentId, traits, onClose])

  const handleCancel = useCallback(() => {
    setTraits(savedTraits)
    onClose()
  }, [savedTraits, onClose])

  // Escape to close
  useEffect(() => {
    if (!visible) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [visible, handleCancel])

  if (!visible || !traits) return null

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
        title="Character Customizer"
        variant="accent"
        width={560}
        height={420}
        style={{ position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={handleCancel}
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

        <div style={{ display: 'flex', gap: 12, height: '100%' }}>
          {/* Left: Live Preview */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            minWidth: 140,
          }}>
            {/* Portrait preview (scaled up) */}
            <div style={{
              width: 128,
              height: 192,
              border: `2px solid ${THEME.borderAccent}`,
              background: THEME.bgDark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              imageRendering: 'pixelated',
            }}>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={agentName}
                  style={{
                    width: 128,
                    height: 192,
                    imageRendering: 'pixelated',
                  }}
                />
              )}
            </div>

            {/* Agent name */}
            <div style={{
              fontSize: 12,
              color: THEME.cyan,
              fontWeight: 'bold',
              letterSpacing: 1,
              textAlign: 'center',
            }}>
              {agentName}
            </div>

            {/* Rig badge */}
            {agentRig && (
              <div style={{
                fontSize: 9,
                color: THEME.goldDim,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                {agentRig}
              </div>
            )}

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <PixelButton variant="primary" size="sm" onClick={handleSave}>
                Save
              </PixelButton>
              <PixelButton size="sm" onClick={handleCancel}>
                Cancel
              </PixelButton>
            </div>
          </div>

          {/* Right: Category Tabs + Options */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Category tab bar */}
            <div style={{
              display: 'flex',
              gap: 0,
              borderBottom: `2px solid ${THEME.goldDim}`,
              marginBottom: 8,
            }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    background: category === cat.id ? '#2a2010' : 'transparent',
                    border: 'none',
                    borderBottom: category === cat.id
                      ? `2px solid ${THEME.gold}`
                      : '2px solid transparent',
                    color: category === cat.id ? THEME.gold : THEME.textSecondary,
                    fontFamily: THEME.fontFamily,
                    fontSize: 10,
                    fontWeight: 'bold',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Category content */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {category === 'hair' && (
                <HairOptions traits={traits} onUpdate={updateTrait} />
              )}
              {category === 'face' && (
                <FaceOptions traits={traits} onUpdate={updateTrait} />
              )}
              {category === 'hat' && (
                <HatOptions traits={traits} onUpdate={updateTrait} />
              )}
              {category === 'skin' && (
                <SkinOptions traits={traits} onUpdate={updateTrait} />
              )}
              {category === 'outfit' && (
                <OutfitOptions traits={traits} onUpdate={updateTrait} agentRig={agentRig} />
              )}
              {category === 'accessory' && (
                <AccessoryOptions traits={traits} onUpdate={updateTrait} />
              )}
            </div>
          </div>
        </div>
      </PixelPanel>
    </div>
  )
}

// ---- Sub-components for each category ----

interface OptionProps {
  traits: AgentVisualTraits
  onUpdate: <K extends keyof AgentVisualTraits>(key: K, value: AgentVisualTraits[K]) => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 9,
      color: THEME.goldDim,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 4,
    }}>
      {children}
    </div>
  )
}

function ColorSwatch({
  color, selected, onClick,
}: {
  color: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        background: toCSS(color),
        border: `2px solid ${selected ? THEME.gold : THEME.borderPanel}`,
        cursor: 'pointer',
        padding: 0,
        boxShadow: selected ? `0 0 6px ${THEME.gold}` : 'none',
      }}
    />
  )
}

function StyleThumbnail({
  label, selected, onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px',
        background: selected ? '#2a2010' : THEME.bgDark,
        border: `2px solid ${selected ? THEME.gold : THEME.borderPanel}`,
        color: selected ? THEME.gold : THEME.textPrimary,
        fontFamily: THEME.fontFamily,
        fontSize: 10,
        cursor: 'pointer',
        textTransform: 'capitalize',
        minWidth: 60,
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  )
}

function HairOptions({ traits, onUpdate }: OptionProps) {
  return (
    <div>
      <SectionLabel>Style</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {HAIR_STYLES.map((style, i) => (
          <StyleThumbnail
            key={style}
            label={style}
            selected={traits.hairStyle === i}
            onClick={() => onUpdate('hairStyle', i)}
          />
        ))}
      </div>

      <SectionLabel>Color</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {HAIR_COLORS.map(color => (
          <ColorSwatch
            key={color}
            color={color}
            selected={traits.hairColor === color}
            onClick={() => onUpdate('hairColor', color)}
          />
        ))}
      </div>
    </div>
  )
}

function FaceOptions({ traits, onUpdate }: OptionProps) {
  const current = traits.faceStyle ?? 'default'
  return (
    <div>
      <SectionLabel>Face Style</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {FACE_STYLES.map(style => (
          <StyleThumbnail
            key={style}
            label={style}
            selected={current === style}
            onClick={() => onUpdate('faceStyle', style)}
          />
        ))}
      </div>
    </div>
  )
}

function HatOptions({ traits, onUpdate }: OptionProps) {
  const current = traits.hatStyle ?? 'none'
  return (
    <div>
      <SectionLabel>Hat Style</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {HAT_STYLES.map(style => (
          <StyleThumbnail
            key={style}
            label={style}
            selected={current === style}
            onClick={() => onUpdate('hatStyle', style)}
          />
        ))}
      </div>
    </div>
  )
}

function SkinOptions({ traits, onUpdate }: OptionProps) {
  return (
    <div>
      <SectionLabel>Skin Tone</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SKIN_TONES.map(tone => (
          <ColorSwatch
            key={tone}
            color={tone}
            selected={traits.skinTone === tone}
            onClick={() => onUpdate('skinTone', tone)}
          />
        ))}
      </div>
    </div>
  )
}

function OutfitOptions({ traits, onUpdate, agentRig }: OptionProps & { agentRig?: string }) {
  const allColors = Object.entries(OUTFIT_COLORS)
  return (
    <div>
      <SectionLabel>Outfit Color</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {allColors.map(([label, color]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ColorSwatch
              color={color}
              selected={traits.outfitColor === color}
              onClick={() => onUpdate('outfitColor', color)}
            />
            <span style={{
              fontSize: 8,
              color: traits.outfitColor === color ? THEME.gold : THEME.textMuted,
              textTransform: 'capitalize',
            }}>
              {label === agentRig ? `${label}*` : label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccessoryOptions({ traits, onUpdate }: OptionProps) {
  return (
    <div>
      <SectionLabel>Accessory Color</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ACCESSORY_COLORS.map(color => (
          <ColorSwatch
            key={color}
            color={color}
            selected={(traits.accessoryColor ?? traits.hairColor) === color}
            onClick={() => onUpdate('accessoryColor', color)}
          />
        ))}
      </div>
    </div>
  )
}
