import { AgentVisualTraits } from '../../types'

const PORTRAIT_W = 64
const PORTRAIT_H = 96

export function generatePortrait(name: string, traits: AgentVisualTraits): string {
  const canvas = document.createElement('canvas')
  canvas.width = PORTRAIT_W
  canvas.height = PORTRAIT_H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const skin = toCSS(traits.skinTone)
  const skinDark = toCSS(darken(traits.skinTone, 20))
  const skinLight = toCSS(lighten(traits.skinTone, 15))
  const hair = toCSS(traits.hairColor)
  const hairDark = toCSS(darken(traits.hairColor, 25))
  const outfit = toCSS(traits.outfitColor)
  const outfitDark = toCSS(darken(traits.outfitColor, 30))
  const outfitLight = toCSS(lighten(traits.outfitColor, 20))

  // Background gradient
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H)
  // Subtle vignette
  for (let y = 0; y < PORTRAIT_H; y++) {
    for (let x = 0; x < PORTRAIT_W; x++) {
      const dx = (x - PORTRAIT_W / 2) / PORTRAIT_W
      const dy = (y - PORTRAIT_H / 2) / PORTRAIT_H
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.4) {
        ctx.fillStyle = `rgba(0,0,0,${(dist - 0.4) * 0.3})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  // === BODY (compact, chibi) ===
  ctx.fillStyle = outfit
  ctx.fillRect(16, 54, 32, 22)
  // Rounded shoulders
  ctx.fillRect(14, 56, 2, 18)
  ctx.fillRect(48, 56, 2, 18)
  ctx.fillStyle = outfitDark
  ctx.fillRect(14, 56, 3, 18)
  ctx.fillRect(16, 70, 32, 6)
  ctx.fillStyle = outfitLight
  ctx.fillRect(18, 54, 28, 2)
  ctx.fillRect(47, 57, 1, 10)

  // Collar V-neck
  ctx.fillStyle = '#fff'
  ctx.fillRect(28, 54, 2, 4)
  ctx.fillRect(34, 54, 2, 4)
  ctx.fillStyle = toCSS(darken(traits.outfitColor, 10))
  ctx.fillRect(30, 56, 4, 2)

  // Buttons
  ctx.fillStyle = outfitLight
  ctx.fillRect(32, 60, 2, 2)
  ctx.fillRect(32, 64, 2, 2)

  // Arms
  ctx.fillStyle = outfit
  ctx.fillRect(8, 56, 8, 8)
  ctx.fillRect(48, 56, 8, 8)
  ctx.fillStyle = skin
  ctx.fillRect(8, 64, 8, 10)
  ctx.fillRect(48, 64, 8, 10)
  ctx.fillStyle = skinDark
  ctx.fillRect(8, 64, 3, 10)
  ctx.fillRect(48, 64, 3, 10)

  // Neck
  ctx.fillStyle = skinDark
  ctx.fillRect(28, 44, 8, 12)

  // === HEAD (large chibi head) ===
  ctx.fillStyle = skin
  // Main head
  ctx.fillRect(18, 8, 28, 34)
  // Wider middle
  ctx.fillRect(16, 12, 32, 28)
  // Top round
  ctx.fillRect(20, 6, 24, 4)
  // Bottom chin
  ctx.fillRect(22, 42, 20, 2)

  // Face shading
  ctx.fillStyle = skinDark
  ctx.fillRect(16, 38, 32, 2)
  ctx.fillRect(16, 12, 3, 28)
  ctx.fillRect(22, 42, 20, 2)
  // Highlight
  ctx.fillStyle = skinLight
  ctx.fillRect(22, 8, 16, 4)
  ctx.fillRect(46, 14, 2, 10)

  // Ears
  ctx.fillStyle = skin
  ctx.fillRect(14, 18, 2, 8)
  ctx.fillRect(48, 18, 2, 8)
  ctx.fillStyle = skinDark
  ctx.fillRect(14, 20, 2, 3)
  ctx.fillRect(48, 20, 2, 3)

  // Cheek blush
  ctx.fillStyle = 'rgba(255,130,130,0.2)'
  ctx.fillRect(18, 30, 6, 4)
  ctx.fillRect(40, 30, 6, 4)

  // === HAIR ===
  ctx.fillStyle = hair
  const hs = traits.hairStyle % 8
  switch (hs) {
    case 0: // Short neat
      ctx.fillRect(16, 4, 32, 12)
      ctx.fillRect(14, 6, 2, 8)
      ctx.fillRect(48, 6, 2, 8)
      ctx.fillStyle = hairDark
      ctx.fillRect(14, 12, 4, 4)
      ctx.fillRect(46, 12, 4, 4)
      break
    case 1: // Spiky
      ctx.fillRect(16, 4, 32, 12)
      ctx.fillRect(14, 6, 4, 10)
      ctx.fillRect(46, 6, 4, 10)
      ctx.fillRect(16, 0, 4, 6)
      ctx.fillRect(26, -2, 4, 6)
      ctx.fillRect(36, 0, 4, 6)
      ctx.fillRect(44, 2, 4, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(16, 14, 32, 2)
      break
    case 2: // Side part
      ctx.fillRect(16, 4, 32, 12)
      ctx.fillRect(12, 8, 6, 24) // long left side
      ctx.fillStyle = hairDark
      ctx.fillRect(12, 26, 6, 6)
      ctx.fillRect(28, 4, 2, 8) // part line
      break
    case 3: // Bald/buzz
      ctx.fillRect(20, 6, 24, 6)
      ctx.fillStyle = hairDark
      ctx.fillRect(20, 10, 24, 2)
      break
    case 4: // Long hair
      ctx.fillRect(16, 4, 32, 12)
      ctx.fillRect(12, 8, 6, 32) // left cascade
      ctx.fillRect(46, 8, 6, 32) // right cascade
      ctx.fillStyle = hairDark
      ctx.fillRect(12, 32, 6, 8)
      ctx.fillRect(46, 32, 6, 8)
      break
    case 5: // Mohawk
      ctx.fillRect(24, -2, 16, 16)
      ctx.fillRect(26, -4, 12, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(24, 12, 16, 2)
      break
    case 6: // Ponytail
      ctx.fillRect(16, 4, 32, 12)
      ctx.fillRect(46, 10, 6, 22)
      ctx.fillRect(50, 26, 6, 12)
      ctx.fillStyle = hairDark
      ctx.fillRect(46, 28, 10, 2)
      break
    case 7: // Curly/afro
      ctx.fillRect(14, 2, 36, 16)
      ctx.fillRect(12, 6, 4, 16)
      ctx.fillRect(48, 6, 4, 16)
      ctx.fillRect(14, 16, 4, 8)
      ctx.fillRect(46, 16, 4, 8)
      // Curl texture
      ctx.fillStyle = hairDark
      ctx.fillRect(20, 4, 4, 4)
      ctx.fillRect(28, 2, 4, 4)
      ctx.fillRect(36, 4, 4, 4)
      ctx.fillRect(44, 2, 4, 4)
      ctx.fillRect(14, 10, 4, 4)
      ctx.fillRect(46, 10, 4, 4)
      break
  }

  // === EYES (big chibi eyes with sparkle) ===
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(20, 20, 10, 8)
  ctx.fillRect(34, 20, 10, 8)
  // Pupils
  ctx.fillStyle = '#222'
  ctx.fillRect(24, 21, 6, 6)
  ctx.fillRect(38, 21, 6, 6)
  // Iris hint
  ctx.fillStyle = '#334'
  ctx.fillRect(26, 21, 2, 4)
  ctx.fillRect(40, 21, 2, 4)
  // Main highlights
  ctx.fillStyle = '#fff'
  ctx.fillRect(24, 21, 2, 2)
  ctx.fillRect(38, 21, 2, 2)
  // Small secondary highlights
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillRect(28, 25, 2, 2)
  ctx.fillRect(42, 25, 2, 2)

  // Eyebrows
  ctx.fillStyle = hairDark
  ctx.fillRect(20, 18, 10, 2)
  ctx.fillRect(34, 18, 10, 2)

  // Nose
  ctx.fillStyle = skinDark
  ctx.fillRect(30, 30, 4, 2)
  ctx.fillStyle = skinLight
  ctx.fillRect(31, 30, 2, 1)

  // Mouth (gentle smile)
  ctx.fillStyle = '#cc8877'
  ctx.fillRect(26, 34, 12, 2)
  // Smile upturn
  ctx.fillStyle = skinDark
  ctx.fillRect(26, 34, 2, 1)
  ctx.fillRect(36, 34, 2, 1)
  // Lower lip shadow
  ctx.fillStyle = '#bb7766'
  ctx.fillRect(28, 35, 8, 1)

  // Face accessories
  const face = traits.faceStyle ?? 'default'
  if (face === 'glasses' || face === 'both') {
    ctx.fillStyle = '#444'
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 2
    ctx.strokeRect(19, 19, 12, 10)
    ctx.strokeRect(33, 19, 12, 10)
    ctx.fillRect(30, 23, 4, 2) // bridge
    ctx.fillStyle = 'rgba(120,160,255,0.1)'
    ctx.fillRect(20, 20, 10, 8)
    ctx.fillRect(34, 20, 10, 8)
  }
  if (face === 'beard' || face === 'both') {
    ctx.fillStyle = hair
    ctx.fillRect(22, 34, 20, 6)
    ctx.fillRect(26, 38, 12, 4)
    ctx.fillStyle = hairDark
    ctx.fillRect(28, 40, 8, 2)
  }
  if (face === 'freckles') {
    ctx.fillStyle = toCSS(darken(traits.skinTone, 30))
    ctx.fillRect(20, 30, 2, 2)
    ctx.fillRect(26, 28, 2, 2)
    ctx.fillRect(38, 30, 2, 2)
    ctx.fillRect(42, 28, 2, 2)
  }
  if (face === 'scar') {
    ctx.fillStyle = skinLight
    ctx.fillRect(38, 20, 2, 8)
    ctx.fillStyle = skinDark
    ctx.fillRect(40, 20, 2, 8)
  }

  // Hat
  const hat = traits.hatStyle ?? 'none'
  if (hat !== 'none') {
    const hatColor = toCSS(traits.accessoryColor ?? traits.hairColor)
    const hatDarkC = toCSS(darken(traits.accessoryColor ?? traits.hairColor, 25))
    ctx.fillStyle = hatColor
    switch (hat) {
      case 'cap':
        ctx.fillRect(14, 2, 36, 10)
        ctx.fillRect(10, 10, 14, 6)
        ctx.fillStyle = hatDarkC
        ctx.fillRect(14, 10, 36, 3)
        break
      case 'beanie':
        ctx.fillRect(16, 0, 32, 12)
        ctx.fillRect(24, -4, 16, 6)
        ctx.fillStyle = hatDarkC
        ctx.fillRect(16, 10, 32, 3)
        break
      case 'tophat':
        ctx.fillRect(20, -8, 24, 16)
        ctx.fillRect(14, 6, 36, 6)
        ctx.fillStyle = hatDarkC
        ctx.fillRect(20, 2, 24, 3)
        break
      case 'headband':
        ctx.fillRect(16, 6, 32, 6)
        break
      case 'bandana':
        ctx.fillRect(16, 2, 32, 10)
        ctx.fillRect(44, 8, 10, 6)
        ctx.fillStyle = hatDarkC
        ctx.fillRect(16, 10, 32, 3)
        break
    }
  }

  // Name plate
  ctx.fillStyle = 'rgba(10,10,30,0.85)'
  ctx.fillRect(0, PORTRAIT_H - 20, PORTRAIT_W, 20)
  ctx.fillStyle = '#53d8fb'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(name, PORTRAIT_W / 2, PORTRAIT_H - 6)
  ctx.textAlign = 'start'

  // Border
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, PORTRAIT_W, PORTRAIT_H)

  return canvas.toDataURL('image/png')
}

function toCSS(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount)
  const g = Math.max(0, ((color >> 8) & 0xff) - amount)
  const b = Math.max(0, (color & 0xff) - amount)
  return (r << 16) | (g << 8) | b
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount)
  const g = Math.min(255, ((color >> 8) & 0xff) + amount)
  const b = Math.min(255, (color & 0xff) + amount)
  return (r << 16) | (g << 8) | b
}
