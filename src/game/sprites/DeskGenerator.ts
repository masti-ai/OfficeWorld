/**
 * Procedural isometric desk renderer.
 * Generates unique per-agent pixel art workstations using canvas.
 */

const CW = 320
const CH = 240
const WALL_H = 100
const DESK_Y = 130
const DESK_W = 180
const DESK_H = 12
const DESK_DEPTH = 60

// ─── Utils ──────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function rand(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`
}

function dim(c: number, n: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) - n)
  const g = Math.max(0, ((c >> 8) & 0xff) - n)
  const b = Math.max(0, (c & 0xff) - n)
  return (r << 16) | (g << 8) | b
}

function lit(c: number, n: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + n)
  const g = Math.min(255, ((c >> 8) & 0xff) + n)
  const b = Math.min(255, (c & 0xff) + n)
  return (r << 16) | (g << 8) | b
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

// ─── Desk traits ────────────────────────────────────────────────

type RoleTheme = 'executive' | 'dev' | 'surveillance' | 'standard'

interface DeskTraits {
  monitors: 1 | 2 | 3
  deskColor: number
  rgbGlow: number
  items: string[]
  wallDecor: 'window-city' | 'window-nature' | 'window-space' | 'poster' | 'shelf'
  chairColor: number
  chairType: 'gaming' | 'executive' | 'standard'
  lampOn: boolean
  hasPlant: boolean
  hasPcTower: boolean
  hasHeadphoneStand: boolean
  hasCableManagement: boolean
  rigAccent: number
  roleTheme: RoleTheme
}

const DESK_WOODS = [0x8b6f47, 0x6b4f27, 0x5a3a1a, 0x7a6a5a, 0x4a3a2a, 0x9a7a5a]
const RGB_COLORS = [0xff0066, 0x00ff88, 0x6644ff, 0xff6600, 0x00ccff, 0xff00ff, 0x44ff44, 0xffaa00]
const CHAIR_COLORS = [0x3a3a5a, 0x5a3a3a, 0x3a5a3a, 0x2a2a4a, 0x4a2a4a, 0x5a4a3a]
const WALL_DECORS: DeskTraits['wallDecor'][] = ['window-city', 'window-nature', 'window-space', 'poster', 'shelf']
const ALL_ITEMS = ['coffee', 'books', 'headphones', 'energy-drink', 'rubber-duck', 'figurine', 'papers', 'snack', 'photo-frame', 'sticky-notes', 'phone-charger', 'stress-ball']
const RIG_ACCENTS: Record<string, number> = {
  planogram: 0x3a7bd5,
  alc_ai: 0x4caf50,
  arcade: 0x9c27b0,
}

function roleToTheme(role?: string): RoleTheme {
  switch (role) {
    case 'mayor': return 'executive'
    case 'witness': return 'surveillance'
    case 'worker': case 'crew': case 'polecat': return 'dev'
    default: return 'standard'
  }
}

function traitsFor(name: string, rig?: string, role?: string): DeskTraits {
  const h = hash(name)
  const theme = roleToTheme(role)

  // Role-specific monitor counts
  let monitors: 1 | 2 | 3
  if (theme === 'executive') {
    monitors = 3 // Mayor always gets triple monitors
  } else if (theme === 'surveillance') {
    monitors = 3 // Witness needs max screen real estate
  } else if (theme === 'dev') {
    const devOpts: (2 | 3)[] = [2, 2, 2, 3, 3, 3]
    monitors = devOpts[h % devOpts.length]
  } else {
    const monOpts: (1 | 2 | 3)[] = [1, 1, 2, 2, 2, 3]
    monitors = monOpts[h % monOpts.length]
  }

  const itemCount = 3 + ((h >> 9) % 4)
  const items: string[] = []
  for (let i = 0; i < itemCount; i++) {
    const item = ALL_ITEMS[((h >> (12 + i * 3)) % ALL_ITEMS.length)]
    if (!items.includes(item)) items.push(item)
  }

  // Role-specific desk color
  let deskColor: number
  if (theme === 'executive') {
    deskColor = 0x5a3a1a // Rich mahogany
  } else {
    deskColor = DESK_WOODS[(h >> 3) % DESK_WOODS.length]
  }

  // Role-specific chair
  let chairColor: number
  let chairType: 'gaming' | 'executive' | 'standard'
  if (theme === 'executive') {
    chairColor = 0x2a1a0a // Dark leather
    chairType = 'executive'
  } else if (theme === 'dev') {
    chairColor = CHAIR_COLORS[(h >> 23) % CHAIR_COLORS.length]
    chairType = 'gaming'
  } else {
    chairColor = CHAIR_COLORS[(h >> 23) % CHAIR_COLORS.length]
    chairType = 'standard'
  }

  return {
    monitors,
    deskColor,
    rgbGlow: RGB_COLORS[(h >> 6) % RGB_COLORS.length],
    items,
    wallDecor: theme === 'executive' ? 'window-city' : WALL_DECORS[(h >> 20) % WALL_DECORS.length],
    chairColor,
    chairType,
    lampOn: theme === 'executive' ? true : (h >> 28) % 3 !== 0,
    hasPlant: theme === 'executive' ? true : (h >> 29) % 3 === 0,
    hasPcTower: theme === 'dev' || theme === 'surveillance',
    hasHeadphoneStand: theme === 'dev',
    hasCableManagement: theme !== 'standard',
    rigAccent: RIG_ACCENTS[rig || ''] ?? 0x607d8b,
    roleTheme: theme,
  }
}

// ─── Scene drawing ──────────────────────────────────────────────

function drawWall(ctx: CanvasRenderingContext2D, traits: DeskTraits, seed: number) {
  // Textured dark wall
  for (let y = 0; y < WALL_H; y++) {
    for (let x = 0; x < CW; x++) {
      const n = rand(seed + x * 7 + y * 13, 0)
      const brickY = y % 10
      const brickOff = Math.floor(y / 10) % 2 === 0 ? 0 : 16
      const brickX = (x + brickOff) % 32
      const isGrout = brickY === 0 || brickX === 0
      let r = 42, g = 38, b = 52
      if (isGrout) { r -= 6; g -= 6; b -= 6 }
      else { r += n * 5 - 2; g += n * 4 - 2; b += n * 6 - 2 }
      const grad = (1 - y / WALL_H) * 8
      ctx.fillStyle = `rgb(${clamp(r + grad)},${clamp(g + grad)},${clamp(b + grad)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  // Wall decoration
  drawWallDecor(ctx, traits, seed)

  // Baseboard
  ctx.fillStyle = '#2a2530'
  ctx.fillRect(0, WALL_H - 3, CW, 3)
  ctx.fillStyle = '#332e38'
  ctx.fillRect(0, WALL_H - 3, CW, 1)
}

function drawWallDecor(ctx: CanvasRenderingContext2D, traits: DeskTraits, seed: number) {
  const cx = CW / 2
  switch (traits.wallDecor) {
    case 'window-city':
    case 'window-nature':
    case 'window-space':
      drawWindow(ctx, cx - 50, 12, 100, 72, traits.wallDecor.replace('window-', ''), seed)
      break
    case 'poster':
      drawPoster(ctx, cx - 30, 15, 60, 55, seed)
      break
    case 'shelf':
      drawShelf(ctx, cx - 60, 20, 120, seed)
      break
  }
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, view: string, seed: number) {
  // Frame
  ctx.fillStyle = '#5a5560'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#4a4550'
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4)

  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6

  if (view === 'city') {
    ctx.fillStyle = '#0a0a2a'
    ctx.fillRect(ix, iy, iw, ih)
    // Stars
    for (let i = 0; i < 15; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + rand(seed, i + 100) * 0.7})`
      ctx.fillRect(ix + Math.floor(rand(seed, i * 2) * iw), iy + Math.floor(rand(seed, i * 2 + 1) * ih * 0.4), 1, 1)
    }
    // Skyline
    for (let i = 0; i < 8; i++) {
      const bx = ix + (iw / 8) * i
      const bw = iw / 8 - 1
      const bh = 12 + rand(seed, i + 200) * 35
      const shade = 18 + rand(seed, i + 300) * 20
      ctx.fillStyle = `rgb(${Math.floor(shade)},${Math.floor(shade)},${Math.floor(shade + 8)})`
      ctx.fillRect(Math.floor(bx), Math.floor(iy + ih - bh), Math.ceil(bw), Math.floor(bh))
      // Lit windows
      for (let wy = iy + ih - bh + 3; wy < iy + ih - 2; wy += 4) {
        for (let wx = bx + 1; wx < bx + bw - 1; wx += 3) {
          if (rand(seed, Math.floor(wx * 13 + wy * 7)) > 0.4) {
            ctx.fillStyle = `rgba(255,220,100,${0.3 + rand(seed, Math.floor(wx + wy * 100)) * 0.5})`
            ctx.fillRect(Math.floor(wx), wy, 1, 2)
          }
        }
      }
    }
  } else if (view === 'nature') {
    // Sky
    ctx.fillStyle = '#4488cc'
    ctx.fillRect(ix, iy, iw, ih)
    ctx.fillStyle = '#66aadd'
    ctx.fillRect(ix, iy + ih * 0.3, iw, ih * 0.2)
    // Clouds
    ctx.fillStyle = '#ddeeff'
    ctx.fillRect(ix + 8, iy + 6, 16, 5)
    ctx.fillRect(ix + 10, iy + 4, 12, 3)
    ctx.fillRect(ix + 50, iy + 10, 12, 4)
    // Hills
    ctx.fillStyle = '#3a8a3a'
    for (let hx = 0; hx < iw; hx++) {
      const hh = Math.sin(hx * 0.06 + seed * 0.01) * 10 + 18
      ctx.fillRect(ix + hx, iy + ih - hh, 1, hh)
    }
    // Ground
    ctx.fillStyle = '#4a9a4a'
    ctx.fillRect(ix, iy + ih - 4, iw, 4)
  } else {
    // Space
    ctx.fillStyle = '#050510'
    ctx.fillRect(ix, iy, iw, ih)
    for (let i = 0; i < 40; i++) {
      const brightness = rand(seed, i * 3 + 2)
      ctx.fillStyle = `rgba(255,255,255,${0.2 + brightness * 0.8})`
      const sx = ix + Math.floor(rand(seed, i * 3) * iw)
      const sy = iy + Math.floor(rand(seed, i * 3 + 1) * ih)
      ctx.fillRect(sx, sy, 1, 1)
      if (brightness > 0.9) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(sx - 1, sy, 3, 1)
        ctx.fillRect(sx, sy - 1, 1, 3)
      }
    }
    // Nebula
    ctx.fillStyle = 'rgba(100,0,150,0.12)'
    ctx.fillRect(ix + Math.floor(rand(seed, 600) * iw * 0.5), iy + Math.floor(rand(seed, 700) * ih * 0.5), 25, 16)
    // Planet
    const px = ix + iw * 0.7, py = iy + ih * 0.4
    ctx.fillStyle = '#884422'
    for (let dy = -5; dy <= 5; dy++) {
      const dx = Math.floor(Math.sqrt(25 - dy * dy))
      ctx.fillRect(Math.floor(px - dx), Math.floor(py + dy), dx * 2, 1)
    }
    ctx.fillStyle = 'rgba(200,180,150,0.4)'
    ctx.fillRect(Math.floor(px) - 8, Math.floor(py), 16, 1)
  }

  // Cross frame
  ctx.fillStyle = '#5a5560'
  ctx.fillRect(x + w / 2 - 1, y + 2, 2, h - 4)
  ctx.fillRect(x + 2, y + h / 2 - 1, w - 4, 2)
  // Reflection
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(x + 5, y + 5, 6, 3)
  // Sill
  ctx.fillStyle = '#6a6570'
  ctx.fillRect(x - 3, y + h, w + 6, 3)
  ctx.fillStyle = '#7a7580'
  ctx.fillRect(x - 3, y + h, w + 6, 1)
}

function drawPoster(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  // Frame
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#3a3a4a'
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
  // Content - retro game/code art
  const r1 = Math.floor(rand(seed, 50) * 200 + 55)
  const g1 = Math.floor(rand(seed, 51) * 200 + 55)
  const b1 = Math.floor(rand(seed, 52) * 200 + 55)
  ctx.fillStyle = `rgb(${r1},${g1},${b1})`
  ctx.fillRect(x + 4, y + 4, w - 8, Math.floor(h * 0.4))
  // Text lines
  ctx.fillStyle = '#eee'
  for (let i = 0; i < 3; i++) {
    const lw = 10 + rand(seed, 60 + i) * (w - 20)
    ctx.fillRect(x + 6, y + h * 0.5 + i * 6, lw, 2)
  }
  // Tack
  ctx.fillStyle = '#cc4444'
  ctx.fillRect(x + w / 2 - 1, y - 1, 3, 3)
}

function drawShelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) {
  // Shelf bracket
  ctx.fillStyle = '#5a4530'
  ctx.fillRect(x, y + 16, w, 3)
  ctx.fillStyle = '#6a5540'
  ctx.fillRect(x, y + 16, w, 1)
  // Brackets
  ctx.fillStyle = '#4a3520'
  ctx.fillRect(x + 10, y + 18, 2, 8)
  ctx.fillRect(x + w - 12, y + 18, 2, 8)
  // Items on shelf
  const bookColors = [0x8b2252, 0x225588, 0x228b22, 0xcd8500, 0x8b0000, 0x4a4a8b]
  let bx = x + 4
  for (let i = 0; i < 8 && bx < x + w - 8; i++) {
    const bw = 4 + Math.floor(rand(seed, i + 80) * 4)
    const bh = 10 + Math.floor(rand(seed, i + 90) * 6)
    const col = bookColors[Math.floor(rand(seed, i + 100) * bookColors.length)]
    ctx.fillStyle = hex(col)
    ctx.fillRect(bx, y + 16 - bh, bw, bh)
    ctx.fillStyle = `rgba(255,255,255,0.12)`
    ctx.fillRect(bx, y + 16 - bh, 1, bh)
    bx += bw + 1
  }
  // Small plant/figurine at end
  ctx.fillStyle = '#228b22'
  ctx.fillRect(bx + 2, y + 8, 4, 8)
  ctx.fillRect(bx, y + 5, 8, 5)
}

function drawFloor(ctx: CanvasRenderingContext2D, seed: number) {
  // Perspective floor with tile pattern
  for (let y = WALL_H; y < CH; y++) {
    const depth = (y - WALL_H) / (CH - WALL_H)
    for (let x = 0; x < CW; x++) {
      const n = rand(seed + x * 3 + y * 11, 1)
      // Tile grid
      const tileX = x % 24
      const tileY = (y - WALL_H) % 24
      const isGrout = tileX === 0 || tileY === 0

      let r = 35 + depth * 15
      let g = 32 + depth * 12
      let b = 45 + depth * 18
      if (isGrout) { r -= 5; g -= 5; b -= 5 }
      else { r += n * 4 - 2; g += n * 3 - 1; b += n * 5 - 2 }

      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function drawRgbGlow(ctx: CanvasRenderingContext2D, color: number) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const deskLeft = (CW - DESK_W) / 2
  const deskBottom = DESK_Y + DESK_DEPTH

  // Underglow on floor beneath desk
  for (let gy = 0; gy < 20; gy++) {
    const alpha = 0.25 - gy * 0.012
    if (alpha <= 0) break
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(deskLeft + 4, deskBottom + DESK_H + gy, DESK_W - 8, 1)
  }
  // Side glow
  for (let gx = 0; gx < 12; gx++) {
    const alpha = 0.15 - gx * 0.012
    if (alpha <= 0) break
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(deskLeft - gx, DESK_Y + 4, 1, DESK_DEPTH + DESK_H)
    ctx.fillRect(deskLeft + DESK_W + gx, DESK_Y + 4, 1, DESK_DEPTH + DESK_H)
  }
  // Front edge LED strip
  ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
  ctx.fillRect(deskLeft + 6, deskBottom + DESK_H - 2, DESK_W - 12, 2)
  ctx.fillStyle = `rgba(${r},${g},${b},0.3)`
  ctx.fillRect(deskLeft + 4, deskBottom + DESK_H, DESK_W - 8, 1)
}

function drawDesk(ctx: CanvasRenderingContext2D, traits: DeskTraits, seed: number) {
  const deskLeft = (CW - DESK_W) / 2
  const col = traits.deskColor

  // Desk legs
  ctx.fillStyle = hex(dim(col, 30))
  ctx.fillRect(deskLeft + 4, DESK_Y + DESK_DEPTH, 4, DESK_H)
  ctx.fillRect(deskLeft + DESK_W - 8, DESK_Y + DESK_DEPTH, 4, DESK_H)
  ctx.fillRect(deskLeft + 4, DESK_Y + 4, 4, DESK_H)
  ctx.fillRect(deskLeft + DESK_W - 8, DESK_Y + 4, 4, DESK_H)

  // Desk surface with wood grain
  for (let y = 0; y < DESK_DEPTH; y++) {
    for (let x = 0; x < DESK_W; x++) {
      const n = rand(seed + x * 5 + y * 9, 2)
      const grain = Math.sin(x * 0.15 + n * 2) * 6
      const cr = ((col >> 16) & 0xff) + grain + n * 5 - 2
      const cg = ((col >> 8) & 0xff) + grain * 0.7 + n * 3 - 1
      const cb = (col & 0xff) + grain * 0.3 + n * 2 - 1
      ctx.fillStyle = `rgb(${clamp(cr)},${clamp(cg)},${clamp(cb)})`
      ctx.fillRect(deskLeft + x, DESK_Y + y, 1, 1)
    }
  }

  // Front edge
  ctx.fillStyle = hex(dim(col, 20))
  ctx.fillRect(deskLeft, DESK_Y + DESK_DEPTH, DESK_W, DESK_H)
  ctx.fillStyle = hex(dim(col, 10))
  ctx.fillRect(deskLeft, DESK_Y + DESK_DEPTH, DESK_W, 1)
  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(deskLeft, DESK_Y, DESK_W, 1)

  // Keyboard
  drawKeyboard(ctx, CW / 2 - 22, DESK_Y + 32)

  // Mousepad + mouse
  const mpX = CW / 2 + 40
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(mpX, DESK_Y + 24, 28, 22)
  ctx.fillStyle = '#222238'
  ctx.fillRect(mpX + 1, DESK_Y + 25, 26, 20)
  // Mouse
  ctx.fillStyle = '#444'
  ctx.fillRect(mpX + 10, DESK_Y + 30, 8, 12)
  ctx.fillStyle = '#555'
  ctx.fillRect(mpX + 11, DESK_Y + 31, 6, 4)
  ctx.fillStyle = '#333'
  ctx.fillRect(mpX + 13, DESK_Y + 31, 2, 3)

  // Monitors
  drawMonitors(ctx, traits.monitors, DESK_Y + 2, seed)

  // Desk items
  drawDeskItems(ctx, traits.items, deskLeft, DESK_Y, seed)

  // PC Tower (under desk, right side)
  if (traits.hasPcTower) {
    drawPcTower(ctx, deskLeft + DESK_W + 6, DESK_Y + 10, traits.rgbGlow)
  }

  // Headphone stand (left of desk)
  if (traits.hasHeadphoneStand) {
    drawHeadphoneStand(ctx, deskLeft - 16, DESK_Y + 10)
  }

  // Cable management (under desk front edge)
  if (traits.hasCableManagement) {
    drawCableManagement(ctx, deskLeft + 20, DESK_Y + DESK_DEPTH + DESK_H + 2, DESK_W - 40)
  }

  // Desk lamp
  if (traits.lampOn || traits.hasPlant) {
    drawLamp(ctx, deskLeft + DESK_W - 30, DESK_Y - 20, traits.lampOn)
  }

  // Plant
  if (traits.hasPlant) {
    drawPlant(ctx, deskLeft + 6, DESK_Y - 8)
  }
}

function drawKeyboard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Keyboard body
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(x, y, 44, 16)
  ctx.fillStyle = '#333348'
  ctx.fillRect(x + 1, y + 1, 42, 14)
  // Key rows
  ctx.fillStyle = '#3a3a4a'
  for (let ky = 0; ky < 4; ky++) {
    for (let kx = 0; kx < 10; kx++) {
      ctx.fillRect(x + 2 + kx * 4, y + 2 + ky * 3, 3, 2)
    }
  }
  // Space bar
  ctx.fillStyle = '#3a3a4a'
  ctx.fillRect(x + 10, y + 13, 20, 2)
  // Key highlights
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let ky = 0; ky < 4; ky++) {
    for (let kx = 0; kx < 10; kx++) {
      ctx.fillRect(x + 2 + kx * 4, y + 2 + ky * 3, 3, 1)
    }
  }
}

function drawMonitors(ctx: CanvasRenderingContext2D, count: 1 | 2 | 3, y: number, seed: number) {
  const cx = CW / 2

  if (count === 1) {
    drawMonitor(ctx, cx - 28, y - 8, 56, 40, seed, 0)
  } else if (count === 2) {
    drawMonitor(ctx, cx - 54, y - 4, 48, 36, seed, 0)
    drawMonitor(ctx, cx + 6, y - 4, 48, 36, seed, 1)
  } else {
    drawMonitor(ctx, cx - 72, y - 2, 42, 32, seed, 0)
    drawMonitor(ctx, cx - 24, y - 6, 48, 36, seed, 1)
    drawMonitor(ctx, cx + 30, y - 2, 42, 32, seed, 2)
  }
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, idx: number) {
  // Bezel
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(x, y, w, h)
  // Screen
  ctx.fillStyle = '#0d1a2e'
  ctx.fillRect(x + 2, y + 2, w - 4, h - 6)
  // Code lines on screen
  const lineColors = ['#4488cc', '#66cc88', '#cc8844', '#88aacc', '#cc6688', '#88cc66']
  for (let ln = 0; ln < Math.floor((h - 10) / 3); ln++) {
    const indent = Math.floor(rand(seed, idx * 100 + ln) * 3) * 4
    const lineW = 6 + rand(seed, idx * 100 + ln + 50) * (w - 16 - indent)
    ctx.fillStyle = lineColors[Math.floor(rand(seed, idx * 100 + ln + 80) * lineColors.length)]
    ctx.fillRect(x + 4 + indent, y + 4 + ln * 3, Math.floor(lineW), 1)
    // Secondary token on same line
    if (rand(seed, idx * 100 + ln + 90) > 0.5) {
      ctx.fillStyle = lineColors[Math.floor(rand(seed, idx * 100 + ln + 95) * lineColors.length)]
      ctx.fillRect(x + 4 + indent + Math.floor(lineW) + 2, y + 4 + ln * 3, Math.floor(rand(seed, idx * 100 + ln + 99) * 10) + 3, 1)
    }
  }
  // Screen glow
  ctx.fillStyle = 'rgba(40,100,180,0.08)'
  ctx.fillRect(x, y, w, h)
  // Bottom chin
  ctx.fillStyle = '#222238'
  ctx.fillRect(x, y + h - 4, w, 4)
  // Stand
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(x + w / 2 - 4, y + h, 8, 4)
  ctx.fillRect(x + w / 2 - 8, y + h + 3, 16, 3)
  // Stand highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(x + w / 2 - 4, y + h, 8, 1)
  // Power LED
  ctx.fillStyle = '#00cc44'
  ctx.fillRect(x + w / 2, y + h - 3, 2, 1)
}

function drawDeskItems(ctx: CanvasRenderingContext2D, items: string[], deskLeft: number, deskTop: number, seed: number) {
  // Place items along desk edges and corners
  const positions = [
    { x: deskLeft + 10, y: deskTop + 10 },
    { x: deskLeft + DESK_W - 35, y: deskTop + 25 },
    { x: deskLeft + DESK_W - 20, y: deskTop + 10 },
    { x: deskLeft + 20, y: deskTop + 44 },
    { x: deskLeft + DESK_W - 50, y: deskTop + 8 },
    { x: deskLeft + 30, y: deskTop + 25 },
  ]

  items.forEach((item, i) => {
    if (i >= positions.length) return
    const p = positions[i]
    switch (item) {
      case 'coffee':
        // Mug
        ctx.fillStyle = '#ddd'
        ctx.fillRect(p.x, p.y, 8, 10)
        ctx.fillStyle = '#ccc'
        ctx.fillRect(p.x + 1, p.y + 1, 6, 4)
        // Coffee
        ctx.fillStyle = '#4a2a1a'
        ctx.fillRect(p.x + 1, p.y + 1, 6, 3)
        // Handle
        ctx.fillStyle = '#bbb'
        ctx.fillRect(p.x + 8, p.y + 2, 2, 5)
        ctx.fillRect(p.x + 9, p.y + 3, 1, 3)
        // Steam
        ctx.fillStyle = 'rgba(200,200,200,0.3)'
        ctx.fillRect(p.x + 2, p.y - 2, 1, 2)
        ctx.fillRect(p.x + 4, p.y - 3, 1, 3)
        ctx.fillRect(p.x + 6, p.y - 2, 1, 2)
        break

      case 'books':
        // Stack of books
        const bookCols = [0x8b2252, 0x225588, 0x228b22]
        for (let b = 0; b < 3; b++) {
          ctx.fillStyle = hex(bookCols[b])
          ctx.fillRect(p.x, p.y + 8 - b * 4, 14, 3)
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(p.x, p.y + 8 - b * 4, 14, 1)
        }
        break

      case 'headphones':
        // Headphone arc
        ctx.fillStyle = '#333'
        ctx.fillRect(p.x + 2, p.y, 8, 2)
        ctx.fillRect(p.x, p.y + 1, 3, 8)
        ctx.fillRect(p.x + 9, p.y + 1, 3, 8)
        // Ear cups
        ctx.fillStyle = '#444'
        ctx.fillRect(p.x - 1, p.y + 4, 4, 5)
        ctx.fillRect(p.x + 9, p.y + 4, 4, 5)
        // Cushions
        ctx.fillStyle = '#555'
        ctx.fillRect(p.x, p.y + 5, 2, 3)
        ctx.fillRect(p.x + 10, p.y + 5, 2, 3)
        break

      case 'energy-drink':
        // Can
        ctx.fillStyle = '#1a4a8a'
        ctx.fillRect(p.x, p.y, 6, 12)
        ctx.fillStyle = '#2a5a9a'
        ctx.fillRect(p.x + 1, p.y + 1, 4, 4)
        // Label design
        ctx.fillStyle = '#ff4444'
        ctx.fillRect(p.x + 1, p.y + 5, 4, 3)
        // Top
        ctx.fillStyle = '#aaa'
        ctx.fillRect(p.x, p.y, 6, 2)
        ctx.fillStyle = '#999'
        ctx.fillRect(p.x + 2, p.y - 1, 2, 2)
        break

      case 'rubber-duck':
        // Body
        ctx.fillStyle = '#ffcc00'
        ctx.fillRect(p.x + 2, p.y + 3, 8, 6)
        ctx.fillRect(p.x + 3, p.y + 2, 6, 8)
        // Head
        ctx.fillRect(p.x + 1, p.y, 5, 4)
        ctx.fillRect(p.x + 2, p.y - 1, 3, 2)
        // Beak
        ctx.fillStyle = '#ff8800'
        ctx.fillRect(p.x, p.y + 1, 2, 2)
        // Eye
        ctx.fillStyle = '#222'
        ctx.fillRect(p.x + 2, p.y, 1, 1)
        break

      case 'figurine':
        // Small figurine/toy
        ctx.fillStyle = '#cc4444'
        ctx.fillRect(p.x + 3, p.y + 4, 6, 8)
        ctx.fillStyle = '#ffccaa'
        ctx.fillRect(p.x + 4, p.y, 4, 5)
        // Face
        ctx.fillStyle = '#222'
        ctx.fillRect(p.x + 5, p.y + 1, 1, 1)
        ctx.fillRect(p.x + 7, p.y + 1, 1, 1)
        // Base
        ctx.fillStyle = '#333'
        ctx.fillRect(p.x + 2, p.y + 12, 8, 2)
        break

      case 'papers':
        // Stack of papers
        ctx.fillStyle = '#eee'
        ctx.fillRect(p.x, p.y + 2, 16, 10)
        ctx.fillStyle = '#e0e0e0'
        ctx.fillRect(p.x + 1, p.y, 16, 10)
        // Text lines
        ctx.fillStyle = '#888'
        for (let ln = 0; ln < 4; ln++) {
          ctx.fillRect(p.x + 3, p.y + 2 + ln * 2, 8 + rand(seed, ln + 150) * 4, 1)
        }
        break

      case 'snack':
        // Snack bag
        ctx.fillStyle = '#cc6600'
        ctx.fillRect(p.x, p.y, 10, 12)
        ctx.fillStyle = '#dd7700'
        ctx.fillRect(p.x + 1, p.y + 1, 8, 5)
        // Logo
        ctx.fillStyle = '#fff'
        ctx.fillRect(p.x + 3, p.y + 2, 4, 3)
        // Crinkled top
        ctx.fillStyle = '#bb5500'
        ctx.fillRect(p.x + 1, p.y, 8, 2)
        break

      case 'photo-frame':
        // Frame border
        ctx.fillStyle = '#8b6f47'
        ctx.fillRect(p.x, p.y, 12, 14)
        ctx.fillStyle = '#a08060'
        ctx.fillRect(p.x + 1, p.y + 1, 10, 12)
        // Photo content (sky + figure)
        ctx.fillStyle = '#5588cc'
        ctx.fillRect(p.x + 2, p.y + 2, 8, 5)
        ctx.fillStyle = '#44aa44'
        ctx.fillRect(p.x + 2, p.y + 7, 8, 3)
        // Tiny person silhouette
        ctx.fillStyle = '#333'
        ctx.fillRect(p.x + 5, p.y + 4, 2, 4)
        ctx.fillRect(p.x + 4, p.y + 3, 4, 2)
        // Stand
        ctx.fillStyle = '#7a5f37'
        ctx.fillRect(p.x + 3, p.y + 13, 6, 1)
        ctx.fillRect(p.x + 4, p.y + 12, 1, 2)
        ctx.fillRect(p.x + 7, p.y + 12, 1, 2)
        break

      case 'sticky-notes':
        // Yellow sticky
        ctx.fillStyle = '#ffee44'
        ctx.fillRect(p.x, p.y, 10, 10)
        ctx.fillStyle = '#eedd33'
        ctx.fillRect(p.x, p.y, 10, 2)
        // Handwritten lines
        ctx.fillStyle = '#666'
        ctx.fillRect(p.x + 1, p.y + 3, 7, 1)
        ctx.fillRect(p.x + 1, p.y + 5, 5, 1)
        ctx.fillRect(p.x + 1, p.y + 7, 6, 1)
        // Pink sticky behind (offset)
        ctx.fillStyle = '#ffaacc'
        ctx.fillRect(p.x + 6, p.y - 2, 9, 9)
        ctx.fillStyle = '#ee99bb'
        ctx.fillRect(p.x + 6, p.y - 2, 9, 2)
        // Line on pink
        ctx.fillStyle = '#666'
        ctx.fillRect(p.x + 7, p.y + 1, 6, 1)
        ctx.fillRect(p.x + 7, p.y + 3, 4, 1)
        break

      case 'phone-charger':
        // Phone body
        ctx.fillStyle = '#222'
        ctx.fillRect(p.x, p.y, 6, 10)
        ctx.fillStyle = '#333'
        ctx.fillRect(p.x + 1, p.y + 1, 4, 7)
        // Screen glow
        ctx.fillStyle = '#2244aa'
        ctx.fillRect(p.x + 1, p.y + 1, 4, 6)
        // Screen content
        ctx.fillStyle = '#4488ff'
        ctx.fillRect(p.x + 1, p.y + 2, 4, 1)
        ctx.fillStyle = '#66aaff'
        ctx.fillRect(p.x + 2, p.y + 4, 2, 1)
        // Home button
        ctx.fillStyle = '#444'
        ctx.fillRect(p.x + 2, p.y + 8, 2, 1)
        // Cable
        ctx.fillStyle = '#888'
        ctx.fillRect(p.x + 2, p.y + 10, 2, 1)
        ctx.fillRect(p.x + 3, p.y + 11, 1, 2)
        ctx.fillRect(p.x + 4, p.y + 12, 4, 1)
        ctx.fillRect(p.x + 7, p.y + 11, 1, 2)
        // Charging indicator
        ctx.fillStyle = '#00ff44'
        ctx.fillRect(p.x + 4, p.y + 1, 1, 1)
        break

      case 'stress-ball':
        // Ball (round-ish with pixel circles)
        const ballColor = ((seed >> 4) & 1) ? '#ff4466' : '#44aaff'
        const ballDark = ((seed >> 4) & 1) ? '#cc2244' : '#2288dd'
        ctx.fillStyle = ballColor
        ctx.fillRect(p.x + 2, p.y + 1, 8, 8)
        ctx.fillRect(p.x + 1, p.y + 2, 10, 6)
        ctx.fillRect(p.x + 3, p.y, 6, 10)
        // Shading
        ctx.fillStyle = ballDark
        ctx.fillRect(p.x + 4, p.y + 6, 5, 3)
        ctx.fillRect(p.x + 6, p.y + 8, 3, 2)
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(p.x + 3, p.y + 2, 3, 2)
        ctx.fillRect(p.x + 2, p.y + 3, 2, 1)
        // Smiley face on ball
        ctx.fillStyle = '#fff'
        ctx.fillRect(p.x + 4, p.y + 3, 1, 1)
        ctx.fillRect(p.x + 7, p.y + 3, 1, 1)
        ctx.fillRect(p.x + 4, p.y + 5, 4, 1)
        ctx.fillRect(p.x + 3, p.y + 4, 1, 1)
        ctx.fillRect(p.x + 8, p.y + 4, 1, 1)
        break
    }
  })
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean) {
  // Arm
  ctx.fillStyle = '#555'
  ctx.fillRect(x + 6, y + 8, 2, 20)
  // Diagonal arm
  ctx.fillStyle = '#555'
  ctx.fillRect(x + 4, y + 4, 2, 6)
  ctx.fillRect(x + 2, y, 2, 6)
  // Shade
  ctx.fillStyle = on ? '#8a7a5a' : '#4a4a4a'
  ctx.fillRect(x - 2, y - 4, 12, 6)
  ctx.fillStyle = on ? '#aa9a7a' : '#5a5a5a'
  ctx.fillRect(x - 1, y - 3, 10, 4)
  // Light glow
  if (on) {
    ctx.fillStyle = 'rgba(255,240,200,0.12)'
    ctx.fillRect(x - 6, y + 2, 20, 24)
    ctx.fillStyle = 'rgba(255,240,200,0.06)'
    ctx.fillRect(x - 10, y + 6, 28, 30)
    // Bulb
    ctx.fillStyle = '#ffe080'
    ctx.fillRect(x + 3, y + 1, 2, 2)
  }
  // Base
  ctx.fillStyle = '#444'
  ctx.fillRect(x + 3, y + 28, 8, 3)
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Pot
  ctx.fillStyle = '#8b4513'
  ctx.fillRect(x + 2, y + 10, 10, 6)
  ctx.fillStyle = '#a0522d'
  ctx.fillRect(x + 1, y + 10, 12, 2)
  // Soil
  ctx.fillStyle = '#3e2a1a'
  ctx.fillRect(x + 2, y + 10, 10, 1)
  // Leaves
  ctx.fillStyle = '#228b22'
  ctx.fillRect(x + 3, y + 3, 8, 7)
  ctx.fillStyle = '#32cd32'
  ctx.fillRect(x + 5, y + 1, 4, 5)
  ctx.fillRect(x + 1, y + 4, 4, 4)
  ctx.fillStyle = '#2e8b2e'
  ctx.fillRect(x + 8, y + 2, 4, 6)
  // Stem
  ctx.fillStyle = '#1a6a1a'
  ctx.fillRect(x + 6, y + 6, 2, 5)
}

function drawChair(ctx: CanvasRenderingContext2D, color: number, _seed: number, chairType: 'gaming' | 'executive' | 'standard' = 'standard') {
  const cx = CW / 2
  const cy = DESK_Y + DESK_DEPTH + DESK_H + 8

  if (chairType === 'gaming') {
    drawGamingChairPortrait(ctx, cx, cy, color)
  } else if (chairType === 'executive') {
    drawExecutiveChairPortrait(ctx, cx, cy, color)
  } else {
    drawStandardChairPortrait(ctx, cx, cy, color)
  }
}

function drawStandardChairPortrait(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: number) {
  // Chair back
  ctx.fillStyle = hex(dim(color, 10))
  ctx.fillRect(cx - 16, cy - 24, 32, 20)
  ctx.fillStyle = hex(color)
  ctx.fillRect(cx - 14, cy - 22, 28, 16)
  ctx.fillStyle = hex(dim(color, 15))
  ctx.fillRect(cx - 14, cy - 14, 28, 1)
  // Seat
  ctx.fillStyle = hex(color)
  ctx.fillRect(cx - 18, cy - 4, 36, 14)
  ctx.fillStyle = hex(lit(color, 10))
  ctx.fillRect(cx - 16, cy - 2, 32, 10)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(cx - 16, cy - 2, 32, 2)
  // Armrests
  ctx.fillStyle = hex(dim(color, 20))
  ctx.fillRect(cx - 20, cy - 6, 4, 12)
  ctx.fillRect(cx + 16, cy - 6, 4, 12)
  ctx.fillStyle = hex(dim(color, 5))
  ctx.fillRect(cx - 20, cy - 6, 4, 2)
  ctx.fillRect(cx + 16, cy - 6, 4, 2)
  // Stem + wheels
  ctx.fillStyle = '#333'
  ctx.fillRect(cx - 2, cy + 10, 4, 8)
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(cx - 14, cy + 18, 4, 3)
  ctx.fillRect(cx - 4, cy + 18, 4, 3)
  ctx.fillRect(cx + 6, cy + 18, 4, 3)
  ctx.fillRect(cx + 10, cy + 17, 4, 3)
  ctx.fillRect(cx - 18, cy + 17, 4, 3)
  ctx.fillStyle = '#333'
  ctx.fillRect(cx - 12, cy + 17, 24, 2)
}

function drawGamingChairPortrait(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: number) {
  // Tall racing-style back with head pillow
  ctx.fillStyle = hex(dim(color, 10))
  ctx.fillRect(cx - 18, cy - 28, 36, 24)
  ctx.fillStyle = hex(color)
  ctx.fillRect(cx - 16, cy - 26, 32, 20)
  // Head pillow
  ctx.fillStyle = hex(lit(color, 15))
  ctx.fillRect(cx - 10, cy - 28, 20, 6)
  ctx.fillStyle = hex(lit(color, 25))
  ctx.fillRect(cx - 8, cy - 27, 16, 4)
  // Racing stripes (red accent)
  ctx.fillStyle = '#cc2244'
  ctx.fillRect(cx - 14, cy - 24, 3, 18)
  ctx.fillRect(cx + 11, cy - 24, 3, 18)
  // Wing sides
  ctx.fillStyle = hex(dim(color, 20))
  ctx.fillRect(cx - 20, cy - 24, 4, 18)
  ctx.fillRect(cx + 16, cy - 24, 4, 18)
  // Lumbar pillow
  ctx.fillStyle = hex(lit(color, 10))
  ctx.fillRect(cx - 12, cy - 14, 24, 5)
  ctx.fillStyle = hex(lit(color, 20))
  ctx.fillRect(cx - 10, cy - 13, 20, 3)
  // Seat
  ctx.fillStyle = hex(color)
  ctx.fillRect(cx - 18, cy - 4, 36, 14)
  ctx.fillStyle = hex(lit(color, 8))
  ctx.fillRect(cx - 16, cy - 2, 32, 10)
  // 4D armrests
  ctx.fillStyle = '#333'
  ctx.fillRect(cx - 22, cy - 6, 5, 12)
  ctx.fillRect(cx + 17, cy - 6, 5, 12)
  ctx.fillStyle = '#444'
  ctx.fillRect(cx - 22, cy - 6, 5, 2)
  ctx.fillRect(cx + 17, cy - 6, 5, 2)
  // Gas lift
  ctx.fillStyle = '#333'
  ctx.fillRect(cx - 2, cy + 10, 4, 8)
  // Star base + caster wheels
  ctx.fillStyle = '#222'
  ctx.fillRect(cx - 16, cy + 17, 32, 2)
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(cx - 18, cy + 18, 4, 3)
  ctx.fillRect(cx - 6, cy + 18, 4, 3)
  ctx.fillRect(cx + 6, cy + 18, 4, 3)
  ctx.fillRect(cx + 14, cy + 18, 4, 3)
  // RGB accent on base
  ctx.fillStyle = 'rgba(255,0,100,0.15)'
  ctx.fillRect(cx - 16, cy + 17, 32, 1)
}

function drawExecutiveChairPortrait(ctx: CanvasRenderingContext2D, cx: number, cy: number, _color: number) {
  // High-back leather executive chair
  const leather = 0x2a1a0a
  // Tall padded back
  ctx.fillStyle = hex(leather)
  ctx.fillRect(cx - 18, cy - 30, 36, 26)
  ctx.fillStyle = hex(lit(leather, 12))
  ctx.fillRect(cx - 16, cy - 28, 32, 22)
  // Diamond tufting pattern
  ctx.fillStyle = hex(dim(leather, 5))
  for (let ty = -24; ty < -8; ty += 6) {
    for (let tx = -10; tx < 12; tx += 8) {
      ctx.fillRect(cx + tx, cy + ty, 1, 1)
    }
  }
  // Padded headrest
  ctx.fillStyle = hex(lit(leather, 20))
  ctx.fillRect(cx - 12, cy - 30, 24, 6)
  ctx.fillStyle = hex(lit(leather, 28))
  ctx.fillRect(cx - 10, cy - 29, 20, 4)
  // Polished wood armrests
  ctx.fillStyle = '#5a3a1a'
  ctx.fillRect(cx - 22, cy - 6, 5, 12)
  ctx.fillRect(cx + 17, cy - 6, 5, 12)
  ctx.fillStyle = '#7a5a3a'
  ctx.fillRect(cx - 22, cy - 6, 5, 2)
  ctx.fillRect(cx + 17, cy - 6, 5, 2)
  // Seat (deep cushion)
  ctx.fillStyle = hex(leather)
  ctx.fillRect(cx - 18, cy - 4, 36, 14)
  ctx.fillStyle = hex(lit(leather, 10))
  ctx.fillRect(cx - 16, cy - 2, 32, 10)
  // Leather sheen
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(cx - 16, cy - 28, 32, 4)
  ctx.fillRect(cx - 16, cy - 2, 32, 2)
  // Chrome stem
  ctx.fillStyle = '#888'
  ctx.fillRect(cx - 2, cy + 10, 4, 8)
  ctx.fillStyle = '#aaa'
  ctx.fillRect(cx - 1, cy + 10, 2, 8)
  // Chrome 5-star base
  ctx.fillStyle = '#777'
  ctx.fillRect(cx - 16, cy + 17, 32, 2)
  ctx.fillStyle = '#888'
  ctx.fillRect(cx - 18, cy + 18, 4, 3)
  ctx.fillRect(cx - 6, cy + 18, 4, 3)
  ctx.fillRect(cx + 6, cy + 18, 4, 3)
  ctx.fillRect(cx + 14, cy + 18, 4, 3)
}

function drawPcTower(ctx: CanvasRenderingContext2D, x: number, y: number, rgbColor: number) {
  // PC tower case
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x, y, 16, 30)
  ctx.fillStyle = '#222'
  ctx.fillRect(x + 1, y + 1, 14, 28)
  // Power button
  ctx.fillStyle = '#00ff44'
  ctx.fillRect(x + 7, y + 2, 2, 2)
  ctx.fillStyle = 'rgba(0,255,68,0.15)'
  ctx.fillRect(x + 6, y + 1, 4, 4)
  // Drive bays
  ctx.fillStyle = '#333'
  ctx.fillRect(x + 2, y + 5, 12, 3)
  ctx.fillRect(x + 2, y + 9, 12, 3)
  // USB ports
  ctx.fillStyle = '#444'
  ctx.fillRect(x + 3, y + 13, 3, 2)
  ctx.fillRect(x + 7, y + 13, 3, 2)
  // Vent grille
  ctx.fillStyle = '#1a1a1a'
  for (let vy = y + 18; vy < y + 27; vy += 2) {
    ctx.fillRect(x + 3, vy, 10, 1)
  }
  // RGB side strip
  const r = (rgbColor >> 16) & 0xff
  const g = (rgbColor >> 8) & 0xff
  const b = rgbColor & 0xff
  ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
  ctx.fillRect(x + 14, y + 3, 1, 24)
  ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
  ctx.fillRect(x + 12, y + 2, 4, 26)
  // Top vent
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(x + 2, y, 12, 1)
}

function drawHeadphoneStand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Base
  ctx.fillStyle = '#333'
  ctx.fillRect(x + 2, y + 24, 12, 4)
  ctx.fillStyle = '#444'
  ctx.fillRect(x + 3, y + 25, 10, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(x + 2, y + 24, 12, 1)
  // Pole
  ctx.fillStyle = '#555'
  ctx.fillRect(x + 7, y + 6, 2, 18)
  ctx.fillStyle = '#666'
  ctx.fillRect(x + 8, y + 6, 1, 18)
  // Top hook
  ctx.fillStyle = '#555'
  ctx.fillRect(x + 4, y + 3, 8, 3)
  ctx.fillRect(x + 4, y + 3, 2, 6)
  ctx.fillRect(x + 10, y + 3, 2, 6)
  // Headphones draped
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(x + 2, y + 2, 12, 2)
  // Ear cups
  ctx.fillStyle = '#333348'
  ctx.fillRect(x, y + 4, 5, 8)
  ctx.fillRect(x + 11, y + 4, 5, 8)
  ctx.fillStyle = '#444458'
  ctx.fillRect(x + 1, y + 5, 3, 6)
  ctx.fillRect(x + 12, y + 5, 3, 6)
}

function drawCableManagement(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  // Cable tray
  ctx.fillStyle = '#333'
  ctx.fillRect(x, y, w, 4)
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(x + 1, y + 1, w - 2, 2)
  // Bundled cables
  const cableColors = ['#222', '#444', '#2a2a4a', '#4a2a2a', '#2a4a2a']
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = cableColors[i]
    ctx.fillRect(x + 2 + i * Math.floor(w / 6), y + 1, 2, 2)
  }
  // Velcro straps
  ctx.fillStyle = '#555'
  ctx.fillRect(x + Math.floor(w * 0.3), y, 1, 4)
  ctx.fillRect(x + Math.floor(w * 0.7), y, 1, 4)
}

// ─── Main export ────────────────────────────────────────────────

export function generateDeskCanvas(agentName: string, rig?: string, role?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const traits = traitsFor(agentName, rig, role)
  const seed = hash(agentName)

  // Draw scene layers back to front
  drawWall(ctx, traits, seed)
  drawFloor(ctx, seed)
  drawRgbGlow(ctx, traits.rgbGlow)
  drawDesk(ctx, traits, seed)
  drawChair(ctx, traits.chairColor, seed, traits.chairType)

  return canvas
}

export { traitsFor as deskTraitsFromName }
export type { DeskTraits }
