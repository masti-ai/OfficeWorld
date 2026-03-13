import Phaser from 'phaser'
import { AgentVisualTraits } from '../../types'
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAT_STYLES, FACE_STYLES } from '../../constants'

const FRAME_W = 32
const FRAME_H = 48
const COLS = 8  // animation frames per row
const ROWS = 20 // idle, walk×8, action, smoke, play, typing, drinking, chatting, stretching, reading, emote×3
const SHEET_W = FRAME_W * COLS
const SHEET_H = FRAME_H * ROWS

// Row assignments
const ROW_IDLE = 0
const ROW_WALK_DOWN = 1
const ROW_WALK_UP = 2
const ROW_WALK_LEFT = 3
const ROW_WALK_RIGHT = 4
const ROW_WALK_DOWN_LEFT = 5
const ROW_WALK_DOWN_RIGHT = 6
const ROW_WALK_UP_LEFT = 7
const ROW_WALK_UP_RIGHT = 8
const ROW_ACTION = 9
const ROW_SMOKE = 10
const ROW_PLAY = 11
const ROW_TYPING = 12
const ROW_DRINKING = 13
const ROW_CHATTING = 14
const ROW_STRETCHING = 15
const ROW_READING = 16
const ROW_EMOTE_THOUGHT = 17
const ROW_EMOTE_EXCLAIM = 18
const ROW_EMOTE_SWEAT = 19

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function traitsFromName(name: string, rig?: string): AgentVisualTraits {
  const h = hashString(name)
  return {
    skinTone: SKIN_TONES[h % SKIN_TONES.length],
    hairColor: HAIR_COLORS[(h >> 4) % HAIR_COLORS.length],
    hairStyle: (h >> 8) % 8,
    outfitColor: rig ? (OUTFIT_COLORS[rig] ?? OUTFIT_COLORS.default) : OUTFIT_COLORS.default,
    hatStyle: HAT_STYLES[(h >> 12) % HAT_STYLES.length],
    faceStyle: FACE_STYLES[(h >> 16) % FACE_STYLES.length],
    accessoryColor: HAIR_COLORS[(h >> 20) % HAIR_COLORS.length],
  }
}

export function generateSpritesheet(
  scene: Phaser.Scene,
  textureKey: string,
  traits: AgentVisualTraits,
): void {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_W
  canvas.height = SHEET_H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, SHEET_W, SHEET_H)

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      drawFrame(ctx, col * FRAME_W, row * FRAME_H, row, col, traits)
    }
  }

  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey)
  }
  const texture = scene.textures.addCanvas(textureKey, canvas)
  if (!texture) return

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const frameIdx = row * COLS + col
      texture.add(frameIdx, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H)
    }
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  row: number,
  col: number,
  traits: AgentVisualTraits,
) {
  const skin = toCSS(traits.skinTone)
  const skinDark = toCSS(darken(traits.skinTone, 20))
  const skinLight = toCSS(lighten(traits.skinTone, 15))
  const hair = toCSS(traits.hairColor)
  const hairDark = toCSS(darken(traits.hairColor, 25))
  const outfit = toCSS(traits.outfitColor)
  const outfitDark = toCSS(darken(traits.outfitColor, 30))
  const outfitLight = toCSS(lighten(traits.outfitColor, 20))

  const isWalking = row >= ROW_WALK_DOWN && row <= ROW_WALK_UP_RIGHT
  const isAction = row === ROW_ACTION
  const isSmoking = row === ROW_SMOKE
  const isPlaying = row === ROW_PLAY
  const isTyping = row === ROW_TYPING
  const isDrinking = row === ROW_DRINKING
  const isChatting = row === ROW_CHATTING
  const isStretching = row === ROW_STRETCHING
  const isReading = row === ROW_READING
  const isEmote = row >= ROW_EMOTE_THOUGHT && row <= ROW_EMOTE_SWEAT

  // Isometric 3/4 view offset: body slightly shifted for depth
  // Left side is "far" side (darker), right is "near" (lighter)
  const isoShift = 1

  // Breathing bob for idle: subtle rise on frames 2-4
  const breatheY = (row === ROW_IDLE && col >= 2 && col <= 4) ? -1 : 0
  // Fidget on idle frames 6-7: slight side shift
  const fidgetX = (row === ROW_IDLE && col === 6) ? 1 : (row === ROW_IDLE && col === 7) ? -1 : 0
  const bobY = isWalking ? [0, -1, -1, 0, 0, -1, -1, 0][col] : breatheY
  const legOffset = isWalking ? [2, 1, 0, -1, -2, -1, 0, 1][col] : 0
  const armSwing = isWalking ? [2, 1, 0, -1, -2, -1, 0, 1][col] : 0

  // Direction flags
  const facingBack = row === ROW_WALK_UP || row === ROW_WALK_UP_LEFT || row === ROW_WALK_UP_RIGHT
  const facingLeft = row === ROW_WALK_LEFT || row === ROW_WALK_DOWN_LEFT || row === ROW_WALK_UP_LEFT
  const facingRight = row === ROW_WALK_RIGHT || row === ROW_WALK_DOWN_RIGHT || row === ROW_WALK_UP_RIGHT
  const isDiagonal = row >= ROW_WALK_DOWN_LEFT && row <= ROW_WALK_UP_RIGHT

  // Diagonal walk: blend leg offsets for diagonal movement feel
  const diagLegShift = isDiagonal ? (facingLeft ? -1 : 1) : 0

  // Blink on idle frame 5
  const isBlinking = row === ROW_IDLE && col === 5

  // Stretch extends body upward
  const stretchY = isStretching ? -2 : 0

  // === DROP SHADOW (isometric ellipse) ===
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(x + 8, y + 43, 16, 2)
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  ctx.fillRect(x + 7, y + 44, 18, 2)
  ctx.fillRect(x + 10, y + 42, 12, 1)
  // Isometric shadow stretch
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(x + 6, y + 44, 2, 1)
  ctx.fillRect(x + 24, y + 44, 2, 1)

  // === LEGS (isometric 3/4 view - staggered feet) ===
  const legBase = y + 34 + bobY
  const leftLegX = x + 10 + fidgetX
  const rightLegX = x + 17 + fidgetX + isoShift
  // Near leg (right) drawn slightly lower for depth
  const nearLegDrop = 1

  // Pants - left (far) leg
  ctx.fillStyle = '#2a2a4a'
  ctx.fillRect(leftLegX, legBase, 5, 6 + legOffset + diagLegShift)
  // Pants - right (near) leg
  ctx.fillRect(rightLegX, legBase + nearLegDrop, 5, 6 - legOffset - diagLegShift)
  // Pants shading (far leg darker for depth)
  ctx.fillStyle = '#1e1e38'
  ctx.fillRect(leftLegX, legBase, 5, 1)
  ctx.fillStyle = '#222240'
  ctx.fillRect(rightLegX, legBase + nearLegDrop, 5, 1)
  // Inner leg shadow
  ctx.fillStyle = '#1a1a30'
  ctx.fillRect(leftLegX + 5, legBase, 2, 5)
  // Pants cuff detail
  ctx.fillStyle = '#252545'
  ctx.fillRect(leftLegX, legBase + 5 + legOffset + diagLegShift, 5, 1)
  ctx.fillRect(rightLegX, legBase + 5 - legOffset - diagLegShift + nearLegDrop, 5, 1)
  // Knee highlight
  ctx.fillStyle = '#2e2e52'
  ctx.fillRect(leftLegX + 1, legBase + 2 + Math.max(0, legOffset), 3, 1)
  ctx.fillRect(rightLegX + 1, legBase + 2 + Math.max(0, -legOffset) + nearLegDrop, 3, 1)

  // Shoes (isometric - near shoe slightly overlaps)
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(leftLegX - 1, legBase + 6 + legOffset + diagLegShift, 7, 3)
  ctx.fillRect(rightLegX - 1, legBase + 6 - legOffset - diagLegShift + nearLegDrop, 7, 3)
  // Shoe toe cap
  ctx.fillStyle = '#2a2a3e'
  ctx.fillRect(leftLegX - 1, legBase + 6 + legOffset + diagLegShift, 7, 1)
  ctx.fillRect(rightLegX - 1, legBase + 6 - legOffset - diagLegShift + nearLegDrop, 7, 1)
  // Shoe sole
  ctx.fillStyle = '#111120'
  ctx.fillRect(leftLegX - 1, legBase + 8 + legOffset + diagLegShift, 7, 1)
  ctx.fillRect(rightLegX - 1, legBase + 8 - legOffset - diagLegShift + nearLegDrop, 7, 1)
  // Shoe lace detail
  ctx.fillStyle = '#444460'
  ctx.fillRect(leftLegX + 1, legBase + 7 + legOffset + diagLegShift, 3, 1)
  ctx.fillRect(rightLegX + 1, legBase + 7 - legOffset - diagLegShift + nearLegDrop, 3, 1)

  // === BODY / OUTFIT (isometric 3/4 torso) ===
  const bodyTop = y + 21 + bobY + stretchY
  const bodyX = x + fidgetX
  // Main torso block (slightly asymmetric for 3/4 view)
  ctx.fillStyle = outfit
  ctx.fillRect(bodyX + 8, bodyTop, 16, 13)
  // Far shoulder (left, narrower)
  ctx.fillRect(bodyX + 6, bodyTop + 2, 2, 9)
  // Near shoulder (right, wider for depth)
  ctx.fillRect(bodyX + 24, bodyTop + 1, 3, 10)
  // Shoulder curves
  ctx.fillRect(bodyX + 7, bodyTop + 1, 1, 2)
  ctx.fillRect(bodyX + 24, bodyTop, 2, 2)

  // Outfit depth shading (far side darker)
  ctx.fillStyle = outfitDark
  ctx.fillRect(bodyX + 6, bodyTop + 2, 2, 9) // left shadow (far)
  ctx.fillRect(bodyX + 8, bodyTop + 10, 16, 3) // bottom fold
  ctx.fillRect(bodyX + 7, bodyTop + 1, 1, 2) // left shoulder curve shadow

  // Outfit highlight (near side lighter)
  ctx.fillStyle = outfitLight
  ctx.fillRect(bodyX + 10, bodyTop, 14, 1) // shoulder highlight
  ctx.fillRect(bodyX + 25, bodyTop + 2, 1, 7) // right edge highlight (near)
  ctx.fillRect(bodyX + 24, bodyTop + 1, 1, 1) // near shoulder top highlight

  // Fabric texture (seam lines)
  ctx.fillStyle = outfitDark
  ctx.fillRect(bodyX + 13, bodyTop + 3, 1, 7) // left seam
  ctx.fillRect(bodyX + 19, bodyTop + 3, 1, 7) // right seam

  // Collar detail - V-neck
  ctx.fillStyle = '#fff'
  ctx.fillRect(bodyX + 14, bodyTop, 1, 3)
  ctx.fillRect(bodyX + 17, bodyTop, 1, 3)
  ctx.fillStyle = darkenCSS(toCSS(traits.outfitColor), 10)
  ctx.fillRect(bodyX + 15, bodyTop + 2, 2, 1)

  // Shirt buttons
  ctx.fillStyle = outfitLight
  ctx.fillRect(bodyX + 16, bodyTop + 4, 1, 1)
  ctx.fillRect(bodyX + 16, bodyTop + 6, 1, 1)
  ctx.fillRect(bodyX + 16, bodyTop + 8, 1, 1)

  // Belt
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(bodyX + 8, bodyTop + 12, 16, 1)
  ctx.fillStyle = '#8a8a4a'
  ctx.fillRect(bodyX + 15, bodyTop + 12, 2, 1)

  // Pocket details
  ctx.fillStyle = outfitDark
  ctx.fillRect(bodyX + 9, bodyTop + 6, 3, 3)
  ctx.fillRect(bodyX + 20, bodyTop + 6, 3, 3)
  ctx.fillStyle = outfitLight
  ctx.fillRect(bodyX + 9, bodyTop + 6, 3, 1)

  // === ARMS ===
  drawArms(ctx, bodyX, bodyTop, row, col, traits, {
    skin, skinDark, skinLight, outfit, outfitDark, outfitLight,
    armSwing, isWalking, isAction, isSmoking, isPlaying, isTyping,
    isDrinking, isChatting, isStretching, isReading, isEmote,
  })

  // === HEAD (isometric 3/4 - big chibi head) ===
  const headTop = y + 2 + bobY + stretchY
  const headX = x + fidgetX
  // Head shape (slightly asymmetric for 3/4 view)
  ctx.fillStyle = skin
  // Main head block
  ctx.fillRect(headX + 8, headTop + 3, 16, 13)
  // Wider middle for roundness (near side slightly wider)
  ctx.fillRect(headX + 7, headTop + 4, 18, 10)
  ctx.fillRect(headX + 24, headTop + 5, 1, 8) // extra near-side width
  // Top round
  ctx.fillRect(headX + 9, headTop + 2, 14, 2)
  ctx.fillRect(headX + 10, headTop + 1, 12, 2)
  // Bottom chin (slightly off-center for 3/4)
  ctx.fillRect(headX + 10, headTop + 16, 12, 1)
  ctx.fillRect(headX + 11, headTop + 17, 10, 1)

  // Face shading (far side darker for depth)
  ctx.fillStyle = skinDark
  ctx.fillRect(headX + 7, headTop + 13, 18, 1) // jaw shadow
  ctx.fillRect(headX + 10, headTop + 16, 12, 1) // chin shadow
  ctx.fillRect(headX + 7, headTop + 4, 1, 9) // left face shadow (far side)
  ctx.fillRect(headX + 8, headTop + 12, 1, 3) // extra far-side jaw shadow

  // Face highlight (near side lighter)
  ctx.fillStyle = skinLight
  ctx.fillRect(headX + 10, headTop + 2, 10, 2) // forehead highlight
  ctx.fillRect(headX + 24, headTop + 5, 1, 6) // right highlight (near)
  ctx.fillRect(headX + 23, headTop + 4, 1, 2) // upper near highlight

  // Ears (asymmetric - far ear partially hidden)
  ctx.fillStyle = skin
  ctx.fillRect(headX + 6, headTop + 8, 1, 3) // far ear (smaller)
  ctx.fillRect(headX + 25, headTop + 7, 1, 4) // near ear
  ctx.fillStyle = skinDark
  ctx.fillRect(headX + 6, headTop + 9, 1, 1) // far ear shadow
  ctx.fillRect(headX + 25, headTop + 8, 1, 2) // near ear shadow

  // Neck
  ctx.fillStyle = skinDark
  ctx.fillRect(headX + 13, headTop + 17, 6, 4)
  ctx.fillStyle = skin
  ctx.fillRect(headX + 14, headTop + 17, 4, 3)

  // === HAIR ===
  drawHair(ctx, headX, headTop, traits, hair, hairDark, facingBack)

  // === FACE DETAILS ===
  if (!facingBack) {
    drawFace(ctx, headX, headTop, row, col, traits, {
      skin, skinDark, skinLight, hair, hairDark,
      isBlinking, isSmoking, isPlaying, isAction, isTyping,
      isDrinking, isChatting, isStretching, isReading, isEmote,
      facingLeft, facingRight,
    })
  }

  // === HAT ===
  drawHat(ctx, headX, headTop, traits)

  // === EQUIPMENT (status-based) ===
  if (isTyping || isAction) {
    drawHeadphones(ctx, headX, headTop, traits)
    drawScreenGlow(ctx, bodyX, bodyTop, col)
  }
  if (isReading) {
    drawBook(ctx, bodyX, bodyTop, col)
  }

  // === EMOTE OVERLAYS ===
  if (row === ROW_EMOTE_THOUGHT) {
    drawThoughtBubble(ctx, x, y, col)
  } else if (row === ROW_EMOTE_EXCLAIM) {
    drawExclamation(ctx, x, y, col)
  } else if (row === ROW_EMOTE_SWEAT) {
    drawSweatDrop(ctx, x, y, col)
  }
}

// === ARM DRAWING ===
function drawArms(
  ctx: CanvasRenderingContext2D,
  bodyX: number, bodyTop: number,
  _row: number, col: number,
  _traits: AgentVisualTraits,
  p: {
    skin: string, skinDark: string, skinLight: string,
    outfit: string, outfitDark: string, outfitLight: string,
    armSwing: number, isWalking: boolean, isAction: boolean,
    isSmoking: boolean, isPlaying: boolean, isTyping: boolean,
    isDrinking: boolean, isChatting: boolean, isStretching: boolean,
    isReading: boolean, isEmote: boolean,
  },
) {
  if (p.isSmoking) {
    // Right arm at side
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 4, bodyTop + 6, 3, 5)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(bodyX + 4, bodyTop + 6, 1, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 4, bodyTop + 10, 3, 2)
    // Left arm holding cigarette out
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 4)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 25, bodyTop + 5, 3, 4)
    ctx.fillRect(bodyX + 28, bodyTop + 5, 2, 2)
    // Cigarette
    ctx.fillStyle = '#eee'
    ctx.fillRect(bodyX + 29, bodyTop + 5, 3, 1)
    ctx.fillStyle = '#ff6633'
    ctx.fillRect(bodyX + 31, bodyTop + 5, 1, 1)
    // Smoke particles
    const smokePhase = col % 4
    ctx.fillStyle = `rgba(180,180,180,${0.5 - smokePhase * 0.1})`
    ctx.fillRect(bodyX + 30, bodyTop + 3 - smokePhase, 1, 1)
    ctx.fillRect(bodyX + 29, bodyTop + 1 - smokePhase, 1, 1)
    if (smokePhase > 0) {
      ctx.fillStyle = 'rgba(180,180,180,0.2)'
      ctx.fillRect(bodyX + 28, bodyTop - 1 - smokePhase, 1, 1)
      ctx.fillRect(bodyX + 31, bodyTop + 2 - smokePhase, 1, 1)
    }
    if (smokePhase > 1) {
      ctx.fillStyle = 'rgba(180,180,180,0.1)'
      ctx.fillRect(bodyX + 27, bodyTop - 3 - smokePhase, 2, 1)
    }
  } else if (p.isPlaying) {
    const armUp = col % 2 === 0
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 3, bodyTop + 1, 3, 4)
    ctx.fillRect(bodyX + 26, bodyTop + 1, 3, 4)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 3, bodyTop + (armUp ? -1 : 5), 3, 4)
    ctx.fillRect(bodyX + 26, bodyTop + (armUp ? 5 : -1), 3, 4)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(bodyX + 3, bodyTop + (armUp ? -1 : 5), 1, 4)
    ctx.fillRect(bodyX + 26, bodyTop + (armUp ? 5 : -1), 1, 4)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 3, bodyTop + (armUp ? -1 : 8), 3, 2)
    ctx.fillRect(bodyX + 26, bodyTop + (armUp ? 8 : -1), 3, 2)
  } else if (p.isAction) {
    const typePhase = col % 3
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 3, bodyTop + 6, 3, 3)
    ctx.fillRect(bodyX + 26, bodyTop + 6, 3, 3)
    if (typePhase === 0) {
      ctx.fillRect(bodyX + 2, bodyTop + 8, 1, 1)
    } else if (typePhase === 1) {
      ctx.fillRect(bodyX + 28, bodyTop + 8, 1, 1)
    }
  } else if (p.isTyping) {
    const typeFrame = col % 4
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 3, bodyTop + 6, 4, 3)
    ctx.fillRect(bodyX + 25, bodyTop + 6, 4, 3)
    ctx.fillStyle = p.skin
    if (typeFrame === 0) {
      ctx.fillRect(bodyX + 2, bodyTop + 8, 2, 1)
      ctx.fillRect(bodyX + 26, bodyTop + 7, 2, 1)
    } else if (typeFrame === 1) {
      ctx.fillRect(bodyX + 3, bodyTop + 7, 2, 1)
      ctx.fillRect(bodyX + 28, bodyTop + 8, 2, 1)
    } else if (typeFrame === 2) {
      ctx.fillRect(bodyX + 2, bodyTop + 7, 2, 1)
      ctx.fillRect(bodyX + 27, bodyTop + 8, 2, 1)
    } else {
      ctx.fillRect(bodyX + 3, bodyTop + 8, 2, 1)
      ctx.fillRect(bodyX + 25, bodyTop + 7, 2, 1)
    }
  } else if (p.isDrinking) {
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 4, bodyTop + 6, 3, 5)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(bodyX + 4, bodyTop + 6, 1, 5)
    // Left arm raised holding cup
    const drinkPhase = col % 4
    const cupY = drinkPhase < 2 ? -2 : 0
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 3)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 25, bodyTop + 4, 3, 2)
    ctx.fillRect(bodyX + 26, bodyTop - 1 + cupY, 2, 5)
    // Coffee cup
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(bodyX + 26, bodyTop - 3 + cupY, 3, 3)
    ctx.fillStyle = '#6B3410'
    ctx.fillRect(bodyX + 26, bodyTop - 3 + cupY, 1, 3)
    // Cup lid
    ctx.fillStyle = '#fff'
    ctx.fillRect(bodyX + 26, bodyTop - 4 + cupY, 3, 1)
    // Cup handle
    ctx.fillStyle = '#7B4513'
    ctx.fillRect(bodyX + 29, bodyTop - 2 + cupY, 1, 2)
    // Steam
    if (drinkPhase < 2) {
      ctx.fillStyle = 'rgba(200,200,200,0.3)'
      ctx.fillRect(bodyX + 27, bodyTop - 6 + cupY, 1, 1)
      ctx.fillRect(bodyX + 28, bodyTop - 7 + cupY - drinkPhase, 1, 1)
    }
  } else if (p.isChatting) {
    const chatPhase = col % 4
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    if (chatPhase === 0 || chatPhase === 2) {
      ctx.fillRect(bodyX + 3, bodyTop + 6, 3, 4)
      ctx.fillRect(bodyX + 26, bodyTop + 6, 3, 4)
    } else if (chatPhase === 1) {
      ctx.fillRect(bodyX + 3, bodyTop + 3, 3, 4)
      ctx.fillRect(bodyX + 26, bodyTop + 6, 3, 4)
      ctx.fillRect(bodyX + 2, bodyTop + 3, 1, 2)
    } else {
      ctx.fillRect(bodyX + 3, bodyTop + 6, 3, 4)
      ctx.fillRect(bodyX + 26, bodyTop + 3, 3, 4)
      ctx.fillRect(bodyX + 29, bodyTop + 3, 1, 2)
    }
  } else if (p.isStretching) {
    const stretchPhase = col % 4
    ctx.fillStyle = p.outfit
    if (stretchPhase === 0 || stretchPhase === 3) {
      ctx.fillRect(bodyX + 2, bodyTop + 1, 4, 3)
      ctx.fillRect(bodyX + 26, bodyTop + 1, 4, 3)
      ctx.fillStyle = p.skin
      ctx.fillRect(bodyX + 0, bodyTop + 1, 2, 3)
      ctx.fillRect(bodyX + 30, bodyTop + 1, 2, 3)
    } else {
      ctx.fillRect(bodyX + 4, bodyTop - 1, 3, 3)
      ctx.fillRect(bodyX + 25, bodyTop - 1, 3, 3)
      ctx.fillStyle = p.skin
      ctx.fillRect(bodyX + 4, bodyTop - 4, 3, 4)
      ctx.fillRect(bodyX + 25, bodyTop - 4, 3, 4)
      ctx.fillRect(bodyX + 4, bodyTop - 5, 3, 2)
      ctx.fillRect(bodyX + 25, bodyTop - 5, 3, 2)
    }
    if (stretchPhase === 1 || stretchPhase === 2) {
      ctx.fillStyle = p.skin
      ctx.fillRect(bodyX + 8, bodyTop + 10, 16, 2)
    }
  } else if (p.isReading) {
    // Arms forward holding book
    const pagePhase = col % 4
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 4, bodyTop + 1, 3, 5)
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 5)
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 3, bodyTop + 6, 3, 3)
    ctx.fillRect(bodyX + 26, bodyTop + 6, 3, 3)
    // Hands holding book position
    ctx.fillRect(bodyX + 2, bodyTop + 8, 2, 2)
    ctx.fillRect(bodyX + 28, bodyTop + 8, 2, 2)
    // Page turn: slight hand movement
    if (pagePhase === 2) {
      ctx.fillRect(bodyX + 29, bodyTop + 7, 1, 1)
    }
  } else {
    // Normal arms with walk swing (isometric: far arm slightly behind)
    const lArmExt = p.armSwing > 0 ? 1 : 0
    const rArmExt = p.armSwing < 0 ? 1 : 0
    // Far sleeve (left)
    ctx.fillStyle = p.outfitDark
    ctx.fillRect(bodyX + 4, bodyTop + 2, 3, 4)
    // Near sleeve (right)
    ctx.fillStyle = p.outfit
    ctx.fillRect(bodyX + 25, bodyTop + 1, 3, 4)
    // Far arm skin (darker)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(bodyX + 4, bodyTop + 6, 3, 4 + lArmExt)
    // Near arm skin
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 25, bodyTop + 5, 3, 4 + rArmExt)
    // Arm shadow
    ctx.fillStyle = p.skinDark
    ctx.fillRect(bodyX + 25, bodyTop + 5, 1, 4 + rArmExt)
    // Hands
    ctx.fillStyle = p.skin
    ctx.fillRect(bodyX + 4, bodyTop + 9 + lArmExt, 3, 2)
    ctx.fillRect(bodyX + 25, bodyTop + 8 + rArmExt, 3, 2)
  }
}

// === HAIR DRAWING ===
function drawHair(
  ctx: CanvasRenderingContext2D,
  headX: number, headTop: number,
  traits: AgentVisualTraits,
  hair: string, hairDark: string,
  facingBack: boolean,
) {
  ctx.fillStyle = hair
  const hs = traits.hairStyle % 8
  switch (hs) {
    case 0: // Short neat
      ctx.fillRect(headX + 8, headTop, 16, 5)
      ctx.fillRect(headX + 7, headTop + 1, 1, 4)
      ctx.fillRect(headX + 24, headTop + 1, 1, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 7, headTop + 4, 2, 1)
      ctx.fillRect(headX + 23, headTop + 4, 2, 1)
      ctx.fillRect(headX + 12, headTop, 1, 1)
      ctx.fillRect(headX + 18, headTop + 1, 1, 1)
      break
    case 1: // Spiky
      ctx.fillRect(headX + 8, headTop, 16, 5)
      ctx.fillRect(headX + 7, headTop + 1, 2, 4)
      ctx.fillRect(headX + 23, headTop + 1, 2, 4)
      ctx.fillRect(headX + 8, headTop - 1, 3, 2)
      ctx.fillRect(headX + 13, headTop - 2, 3, 2)
      ctx.fillRect(headX + 18, headTop - 1, 3, 2)
      ctx.fillRect(headX + 22, headTop, 2, 1)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 8, headTop + 4, 16, 1)
      ctx.fillRect(headX + 10, headTop - 1, 1, 1)
      ctx.fillRect(headX + 15, headTop - 2, 1, 1)
      ctx.fillRect(headX + 20, headTop - 1, 1, 1)
      break
    case 2: // Side part
      ctx.fillRect(headX + 8, headTop, 16, 5)
      ctx.fillRect(headX + 5, headTop + 1, 3, 11)
      ctx.fillRect(headX + 7, headTop + 1, 1, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 5, headTop + 10, 3, 2)
      ctx.fillRect(headX + 12, headTop, 1, 4)
      ctx.fillRect(headX + 6, headTop + 5, 1, 1)
      break
    case 3: // Bald / buzz
      ctx.fillRect(headX + 9, headTop + 1, 14, 3)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 9, headTop + 3, 14, 1)
      ctx.fillRect(headX + 11, headTop + 1, 1, 1)
      ctx.fillRect(headX + 16, headTop + 2, 1, 1)
      ctx.fillRect(headX + 20, headTop + 1, 1, 1)
      break
    case 4: // Long hair
      ctx.fillRect(headX + 8, headTop, 16, 5)
      ctx.fillRect(headX + 5, headTop + 1, 3, 14)
      ctx.fillRect(headX + 24, headTop + 1, 3, 14)
      ctx.fillRect(headX + 7, headTop + 1, 1, 4)
      ctx.fillRect(headX + 24, headTop + 1, 1, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 5, headTop + 12, 3, 3)
      ctx.fillRect(headX + 24, headTop + 12, 3, 3)
      ctx.fillRect(headX + 6, headTop + 5, 1, 1)
      ctx.fillRect(headX + 25, headTop + 5, 1, 1)
      ctx.fillRect(headX + 10, headTop, 1, 1)
      ctx.fillRect(headX + 20, headTop + 1, 1, 1)
      break
    case 5: // Mohawk
      ctx.fillRect(headX + 12, headTop - 3, 8, 7)
      ctx.fillRect(headX + 13, headTop - 4, 6, 2)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 12, headTop + 3, 8, 1)
      ctx.fillRect(headX + 14, headTop - 4, 1, 1)
      ctx.fillRect(headX + 17, headTop - 3, 1, 1)
      break
    case 6: // Ponytail
      ctx.fillRect(headX + 8, headTop, 16, 5)
      ctx.fillRect(headX + 7, headTop + 1, 1, 4)
      if (!facingBack) {
        ctx.fillRect(headX + 24, headTop + 3, 3, 10)
        ctx.fillRect(headX + 26, headTop + 10, 2, 5)
        ctx.fillStyle = hairDark
        ctx.fillRect(headX + 24, headTop + 12, 4, 1)
        ctx.fillStyle = toCSS(traits.accessoryColor ?? traits.hairColor)
        ctx.fillRect(headX + 24, headTop + 3, 3, 1)
      } else {
        ctx.fillRect(headX + 12, headTop + 3, 8, 4)
        ctx.fillRect(headX + 13, headTop + 7, 6, 9)
        ctx.fillStyle = hairDark
        ctx.fillRect(headX + 13, headTop + 14, 6, 2)
        ctx.fillRect(headX + 15, headTop + 8, 1, 1)
        ctx.fillRect(headX + 17, headTop + 10, 1, 1)
      }
      break
    case 7: // Curly/afro
      ctx.fillRect(headX + 7, headTop - 1, 18, 6)
      ctx.fillRect(headX + 5, headTop, 2, 8)
      ctx.fillRect(headX + 25, headTop, 2, 8)
      ctx.fillRect(headX + 7, headTop + 5, 1, 4)
      ctx.fillRect(headX + 24, headTop + 5, 1, 4)
      ctx.fillStyle = hairDark
      ctx.fillRect(headX + 9, headTop, 2, 1)
      ctx.fillRect(headX + 13, headTop - 1, 2, 1)
      ctx.fillRect(headX + 17, headTop, 2, 1)
      ctx.fillRect(headX + 21, headTop - 1, 2, 1)
      ctx.fillRect(headX + 7, headTop + 3, 1, 1)
      ctx.fillRect(headX + 24, headTop + 3, 1, 1)
      ctx.fillRect(headX + 5, headTop + 4, 1, 1)
      ctx.fillRect(headX + 26, headTop + 4, 1, 1)
      ctx.fillRect(headX + 11, headTop + 1, 1, 1)
      ctx.fillRect(headX + 19, headTop + 1, 1, 1)
      break
  }
}

// === FACE DRAWING ===
function drawFace(
  ctx: CanvasRenderingContext2D,
  headX: number, headTop: number,
  row: number, col: number,
  traits: AgentVisualTraits,
  p: {
    skin: string, skinDark: string, skinLight: string,
    hair: string, hairDark: string,
    isBlinking: boolean, isSmoking: boolean, isPlaying: boolean,
    isAction: boolean, isTyping: boolean, isDrinking: boolean,
    isChatting: boolean, isStretching: boolean, isReading: boolean,
    isEmote: boolean, facingLeft: boolean, facingRight: boolean,
  },
) {
  // Eye shift for direction (isometric: slightly asymmetric)
  let eyeShiftX = 0
  if (p.facingLeft) eyeShiftX = -1
  else if (p.facingRight) eyeShiftX = 1

  // Eyes
  if (p.isBlinking) {
    ctx.fillStyle = '#222'
    ctx.fillRect(headX + 9, headTop + 9, 5, 1)
    ctx.fillRect(headX + 18, headTop + 9, 5, 1)
  } else {
    // White of eyes (near eye slightly larger for 3/4 view)
    ctx.fillStyle = '#fff'
    ctx.fillRect(headX + 9, headTop + 7, 5, 5) // far eye
    ctx.fillRect(headX + 18, headTop + 7, 6, 5) // near eye (wider)

    // Pupils
    ctx.fillStyle = '#222'
    ctx.fillRect(headX + 10 + eyeShiftX, headTop + 7, 4, 5)
    ctx.fillRect(headX + 19 + eyeShiftX, headTop + 7, 4, 5)

    // Iris color
    ctx.fillStyle = '#334'
    ctx.fillRect(headX + 11 + eyeShiftX, headTop + 8, 2, 3)
    ctx.fillRect(headX + 20 + eyeShiftX, headTop + 8, 2, 3)

    // Pupil highlights (AC-style sparkle)
    ctx.fillStyle = '#fff'
    ctx.fillRect(headX + 10 + eyeShiftX, headTop + 7, 2, 2)
    ctx.fillRect(headX + 19 + eyeShiftX, headTop + 7, 2, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillRect(headX + 13 + eyeShiftX, headTop + 11, 1, 1)
    ctx.fillRect(headX + 22 + eyeShiftX, headTop + 11, 1, 1)
  }

  // Eyebrows
  ctx.fillStyle = p.hairDark
  ctx.fillRect(headX + 9, headTop + 6, 5, 1)
  ctx.fillRect(headX + 18, headTop + 6, 5, 1)

  // Nose
  ctx.fillStyle = p.skinDark
  ctx.fillRect(headX + 14, headTop + 12, 3, 1)
  ctx.fillRect(headX + 15, headTop + 11, 1, 1)

  // Cheek blush
  ctx.fillStyle = 'rgba(255,130,130,0.25)'
  ctx.fillRect(headX + 8, headTop + 11, 3, 3)
  ctx.fillRect(headX + 21, headTop + 11, 3, 3)

  // Mouth
  if (p.isSmoking) {
    ctx.fillStyle = '#999'
    ctx.fillRect(headX + 13, headTop + 14, 5, 1)
  } else if (p.isPlaying || p.isStretching) {
    ctx.fillStyle = '#cc6655'
    ctx.fillRect(headX + 13, headTop + 14, 6, 2)
    ctx.fillStyle = '#aa4433'
    ctx.fillRect(headX + 14, headTop + 15, 4, 1)
  } else if (p.isAction || p.isTyping) {
    ctx.fillStyle = '#bb8877'
    ctx.fillRect(headX + 13, headTop + 14, 4, 1)
  } else if (p.isChatting) {
    const mouthOpen = col % 2 === 0
    if (mouthOpen) {
      ctx.fillStyle = '#cc6655'
      ctx.fillRect(headX + 13, headTop + 14, 5, 2)
      ctx.fillStyle = '#aa4433'
      ctx.fillRect(headX + 14, headTop + 15, 3, 1)
    } else {
      ctx.fillStyle = '#cc8877'
      ctx.fillRect(headX + 13, headTop + 14, 5, 1)
    }
  } else if (p.isDrinking) {
    const sipFrame = col % 4
    if (sipFrame < 2) {
      ctx.fillStyle = '#cc8877'
      ctx.fillRect(headX + 14, headTop + 14, 3, 1)
    } else {
      ctx.fillStyle = '#cc6655'
      ctx.fillRect(headX + 14, headTop + 14, 3, 2)
    }
  } else if (p.isReading) {
    // Focused reading expression - slight frown
    ctx.fillStyle = '#bb8877'
    ctx.fillRect(headX + 13, headTop + 14, 5, 1)
    // Slightly furrowed brows for concentration
    ctx.fillStyle = p.hairDark
    ctx.fillRect(headX + 9, headTop + 5, 2, 1)
    ctx.fillRect(headX + 21, headTop + 5, 2, 1)
  } else if (p.isEmote) {
    // Emote expression varies by type
    if (row === ROW_EMOTE_THOUGHT) {
      // Thinking face - slightly pursed
      ctx.fillStyle = '#cc8877'
      ctx.fillRect(headX + 14, headTop + 14, 3, 1)
      ctx.fillRect(headX + 15, headTop + 15, 1, 1)
    } else if (row === ROW_EMOTE_EXCLAIM) {
      // Surprised face
      ctx.fillStyle = '#cc6655'
      ctx.fillRect(headX + 14, headTop + 14, 4, 3)
      ctx.fillStyle = '#aa4433'
      ctx.fillRect(headX + 15, headTop + 15, 2, 1)
    } else {
      // Nervous face (sweat)
      ctx.fillStyle = '#cc8877'
      ctx.fillRect(headX + 12, headTop + 14, 7, 1)
      ctx.fillStyle = '#bb7766'
      ctx.fillRect(headX + 12, headTop + 14, 1, 1)
      ctx.fillRect(headX + 18, headTop + 14, 1, 1)
    }
  } else {
    // Gentle smile
    ctx.fillStyle = '#cc8877'
    ctx.fillRect(headX + 12, headTop + 14, 7, 1)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(headX + 12, headTop + 14, 1, 1)
    ctx.fillRect(headX + 18, headTop + 14, 1, 1)
  }

  // Face accessories
  const face = traits.faceStyle ?? 'default'
  if (face === 'glasses' || face === 'both') {
    ctx.fillStyle = '#444'
    ctx.fillRect(headX + 8, headTop + 6, 6, 1)
    ctx.fillRect(headX + 8, headTop + 12, 6, 1)
    ctx.fillRect(headX + 8, headTop + 6, 1, 7)
    ctx.fillRect(headX + 13, headTop + 6, 1, 7)
    ctx.fillRect(headX + 13, headTop + 9, 6, 1)
    ctx.fillRect(headX + 17, headTop + 6, 6, 1)
    ctx.fillRect(headX + 17, headTop + 12, 6, 1)
    ctx.fillRect(headX + 17, headTop + 6, 1, 7)
    ctx.fillRect(headX + 22, headTop + 6, 1, 7)
    ctx.fillStyle = 'rgba(120,160,255,0.15)'
    ctx.fillRect(headX + 9, headTop + 7, 4, 5)
    ctx.fillRect(headX + 18, headTop + 7, 4, 5)
  }
  if (face === 'beard' || face === 'both') {
    ctx.fillStyle = p.hair
    ctx.fillRect(headX + 10, headTop + 14, 12, 2)
    ctx.fillRect(headX + 11, headTop + 16, 10, 2)
    ctx.fillStyle = p.hairDark
    ctx.fillRect(headX + 11, headTop + 16, 10, 2)
    ctx.fillRect(headX + 12, headTop + 14, 1, 1)
    ctx.fillRect(headX + 17, headTop + 15, 1, 1)
    ctx.fillRect(headX + 19, headTop + 14, 1, 1)
  }
  if (face === 'freckles') {
    ctx.fillStyle = darkenCSS(p.skin, 30)
    ctx.fillRect(headX + 9, headTop + 11, 1, 1)
    ctx.fillRect(headX + 11, headTop + 10, 1, 1)
    ctx.fillRect(headX + 21, headTop + 11, 1, 1)
    ctx.fillRect(headX + 23, headTop + 10, 1, 1)
    ctx.fillRect(headX + 10, headTop + 12, 1, 1)
    ctx.fillRect(headX + 22, headTop + 12, 1, 1)
  }
  if (face === 'scar') {
    ctx.fillStyle = p.skinLight
    ctx.fillRect(headX + 20, headTop + 7, 1, 5)
    ctx.fillStyle = p.skinDark
    ctx.fillRect(headX + 21, headTop + 7, 1, 5)
  }
}

// === HAT DRAWING ===
function drawHat(
  ctx: CanvasRenderingContext2D,
  headX: number, headTop: number,
  traits: AgentVisualTraits,
) {
  const hat = traits.hatStyle ?? 'none'
  if (hat === 'none') return

  const hatColor = toCSS(traits.accessoryColor ?? traits.hairColor)
  const hatDark = toCSS(darken(traits.accessoryColor ?? traits.hairColor, 25))
  ctx.fillStyle = hatColor
  switch (hat) {
    case 'cap':
      ctx.fillRect(headX + 7, headTop - 1, 18, 5)
      ctx.fillRect(headX + 4, headTop + 3, 6, 2)
      ctx.fillStyle = hatDark
      ctx.fillRect(headX + 7, headTop + 3, 18, 1)
      ctx.fillRect(headX + 15, headTop - 1, 2, 1)
      break
    case 'beanie':
      ctx.fillRect(headX + 8, headTop - 2, 16, 6)
      ctx.fillRect(headX + 12, headTop - 4, 8, 3)
      ctx.fillStyle = hatDark
      ctx.fillRect(headX + 8, headTop + 3, 16, 1)
      ctx.fillRect(headX + 10, headTop - 1, 1, 1)
      ctx.fillRect(headX + 14, headTop, 1, 1)
      ctx.fillRect(headX + 18, headTop - 1, 1, 1)
      ctx.fillRect(headX + 22, headTop, 1, 1)
      break
    case 'tophat':
      ctx.fillRect(headX + 9, headTop - 5, 14, 9)
      ctx.fillRect(headX + 7, headTop + 2, 18, 2)
      ctx.fillStyle = hatDark
      ctx.fillRect(headX + 9, headTop, 14, 1)
      ctx.fillStyle = toCSS(lighten(traits.accessoryColor ?? traits.hairColor, 15))
      ctx.fillRect(headX + 20, headTop - 4, 1, 4)
      break
    case 'headband':
      ctx.fillRect(headX + 7, headTop + 2, 18, 2)
      break
    case 'bandana':
      ctx.fillRect(headX + 7, headTop - 1, 18, 5)
      ctx.fillRect(headX + 24, headTop + 2, 4, 4)
      ctx.fillStyle = hatDark
      ctx.fillRect(headX + 7, headTop + 3, 18, 1)
      ctx.fillRect(headX + 24, headTop + 4, 4, 1)
      break
  }
}

// === EQUIPMENT: HEADPHONES ===
function drawHeadphones(
  ctx: CanvasRenderingContext2D,
  headX: number, headTop: number,
  _traits: AgentVisualTraits,
) {
  // Headband across top of head
  ctx.fillStyle = '#333'
  ctx.fillRect(headX + 6, headTop - 1, 20, 2)
  ctx.fillRect(headX + 5, headTop, 1, 2)
  ctx.fillRect(headX + 26, headTop, 1, 2)
  // Left ear cup
  ctx.fillStyle = '#444'
  ctx.fillRect(headX + 4, headTop + 5, 3, 5)
  ctx.fillStyle = '#555'
  ctx.fillRect(headX + 5, headTop + 6, 1, 3)
  // Right ear cup
  ctx.fillStyle = '#444'
  ctx.fillRect(headX + 25, headTop + 5, 3, 5)
  ctx.fillStyle = '#555'
  ctx.fillRect(headX + 26, headTop + 6, 1, 3)
}

// === EQUIPMENT: SCREEN GLOW ===
function drawScreenGlow(
  ctx: CanvasRenderingContext2D,
  bodyX: number, bodyTop: number,
  col: number,
) {
  // Subtle blue glow from screen reflecting on body
  const glowPhase = col % 3
  const glowAlpha = 0.12 + glowPhase * 0.04
  ctx.fillStyle = `rgba(100,180,255,${glowAlpha})`
  ctx.fillRect(bodyX + 8, bodyTop + 2, 16, 8)
  // Stronger glow on near arm
  ctx.fillStyle = `rgba(100,180,255,${glowAlpha + 0.05})`
  ctx.fillRect(bodyX + 22, bodyTop + 4, 4, 4)
  // Face glow
  ctx.fillStyle = `rgba(100,180,255,${glowAlpha * 0.6})`
  ctx.fillRect(bodyX + 10, bodyTop - 8, 12, 6)
}

// === EQUIPMENT: BOOK ===
function drawBook(
  ctx: CanvasRenderingContext2D,
  bodyX: number, bodyTop: number,
  col: number,
) {
  const pagePhase = col % 4
  // Book body (brown cover)
  ctx.fillStyle = '#6B3A2A'
  ctx.fillRect(bodyX + 5, bodyTop + 8, 22, 6)
  // Book spine
  ctx.fillStyle = '#4A2A1A'
  ctx.fillRect(bodyX + 15, bodyTop + 8, 2, 6)
  // Pages (white)
  ctx.fillStyle = '#F5F0E0'
  ctx.fillRect(bodyX + 6, bodyTop + 9, 9, 4)
  ctx.fillRect(bodyX + 17, bodyTop + 9, 9, 4)
  // Page lines
  ctx.fillStyle = '#D0C8B0'
  ctx.fillRect(bodyX + 7, bodyTop + 10, 7, 1)
  ctx.fillRect(bodyX + 7, bodyTop + 12, 5, 1)
  ctx.fillRect(bodyX + 18, bodyTop + 10, 7, 1)
  ctx.fillRect(bodyX + 18, bodyTop + 12, 6, 1)
  // Page turn animation
  if (pagePhase === 2 || pagePhase === 3) {
    ctx.fillStyle = '#F8F4E8'
    ctx.fillRect(bodyX + 16 + (pagePhase === 2 ? -1 : 0), bodyTop + 8, 2, 5)
    // Curled page corner
    ctx.fillStyle = '#E8E0D0'
    ctx.fillRect(bodyX + 16, bodyTop + 8, 1, 1)
  }
}

// === EMOTE: THOUGHT BUBBLE ===
function drawThoughtBubble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  col: number,
) {
  const bobPhase = col % 4
  const ey = y - 2 + (bobPhase < 2 ? 0 : -1)
  // Small dots leading to bubble
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 22, ey + 10, 2, 2)
  ctx.fillRect(x + 24, ey + 7, 2, 2)
  // Main bubble
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 18, ey, 12, 7)
  ctx.fillRect(x + 17, ey + 1, 14, 5)
  // Bubble border
  ctx.fillStyle = '#aaa'
  ctx.fillRect(x + 18, ey, 12, 1)
  ctx.fillRect(x + 18, ey + 6, 12, 1)
  ctx.fillRect(x + 17, ey + 1, 1, 5)
  ctx.fillRect(x + 30, ey + 1, 1, 5)
  // "..." dots inside
  ctx.fillStyle = '#666'
  const dotFrame = col % 4
  if (dotFrame >= 0) ctx.fillRect(x + 20, ey + 3, 2, 2)
  if (dotFrame >= 1) ctx.fillRect(x + 23, ey + 3, 2, 2)
  if (dotFrame >= 2) ctx.fillRect(x + 26, ey + 3, 2, 2)
}

// === EMOTE: EXCLAMATION ===
function drawExclamation(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  col: number,
) {
  const flash = col % 3
  const ey = y - 1
  // Burst effect (star-like)
  if (flash < 2) {
    ctx.fillStyle = 'rgba(255,220,50,0.3)'
    ctx.fillRect(x + 20, ey - 2, 8, 12)
    ctx.fillRect(x + 18, ey, 12, 8)
  }
  // "!" mark
  ctx.fillStyle = flash === 0 ? '#ff4444' : '#ff6644'
  // Vertical bar
  ctx.fillRect(x + 23, ey, 2, 7)
  ctx.fillRect(x + 22, ey + 1, 4, 5)
  // Dot
  ctx.fillRect(x + 23, ey + 9, 2, 2)
  // Outline
  ctx.fillStyle = '#aa2222'
  ctx.fillRect(x + 22, ey, 1, 1)
  ctx.fillRect(x + 25, ey, 1, 1)
  ctx.fillRect(x + 22, ey + 6, 1, 1)
  ctx.fillRect(x + 25, ey + 6, 1, 1)
}

// === EMOTE: SWEAT DROP ===
function drawSweatDrop(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  col: number,
) {
  const fallPhase = col % 4
  const ey = y + 2 + fallPhase
  // Drop shape (teardrop)
  ctx.fillStyle = '#88ccff'
  ctx.fillRect(x + 26, ey, 2, 1)
  ctx.fillRect(x + 25, ey + 1, 4, 2)
  ctx.fillRect(x + 25, ey + 3, 4, 2)
  ctx.fillRect(x + 26, ey + 5, 2, 1)
  // Highlight
  ctx.fillStyle = '#bbddff'
  ctx.fillRect(x + 26, ey + 1, 1, 2)
  // Drop outline
  ctx.fillStyle = '#5599cc'
  ctx.fillRect(x + 26, ey, 2, 1)
  ctx.fillRect(x + 25, ey + 1, 1, 1)
  ctx.fillRect(x + 28, ey + 1, 1, 1)
  ctx.fillRect(x + 26, ey + 5, 2, 1)
  // Additional drip for later frames
  if (fallPhase >= 2) {
    ctx.fillStyle = 'rgba(136,204,255,0.4)'
    ctx.fillRect(x + 26, ey - 2, 2, 2)
  }
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

function darkenCSS(css: string, amount: number): string {
  const hex = parseInt(css.slice(1), 16)
  return toCSS(darken(hex, amount))
}

export { FRAME_W, FRAME_H, COLS as SHEET_COLS, ROWS as SHEET_ROWS }
