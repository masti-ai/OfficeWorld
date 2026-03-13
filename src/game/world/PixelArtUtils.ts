/** Pixel art drawing utilities for creating rich textures */

export function colorToRGB(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}

export function rgbToColor(r: number, g: number, b: number): number {
  return (Math.max(0, Math.min(255, r)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, b))
}

export function lighten(color: number, amount: number): number {
  const [r, g, b] = colorToRGB(color)
  return rgbToColor(r + amount, g + amount, b + amount)
}

export function darken(color: number, amount: number): number {
  return lighten(color, -amount)
}

export function tint(color: number, tintColor: number, amount: number): number {
  const [r, g, b] = colorToRGB(color)
  const [tr, tg, tb] = colorToRGB(tintColor)
  return rgbToColor(
    r + (tr - r) * amount,
    g + (tg - g) * amount,
    b + (tb - b) * amount,
  )
}

/** Seeded random for deterministic textures */
export function seededRandom(x: number, y: number, seed = 42): number {
  let h = (seed * 374761393 + x * 668265263 + y * 2147483647) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

/** Draw a wood plank pattern into a canvas context */
export function drawWoodFloor(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number, baseColor: number) {
  const [br, bg, bb] = colorToRGB(baseColor)
  // Wood base
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = seededRandom(tx * size + x, ty * size + y)
      // Plank lines every 4 pixels
      const plankY = y % 8
      const isGrout = plankY === 0
      // Offset alternating planks
      const plankOffset = Math.floor(y / 8) % 2 === 0 ? 0 : 4
      const plankX = (x + plankOffset) % 8
      const isVertGrout = plankX === 0

      let r = br, g = bg, b = bb
      if (isGrout || isVertGrout) {
        r -= 25; g -= 20; b -= 15
      } else {
        // Wood grain variation
        const grain = Math.sin((x + tx * size) * 0.3 + noise * 2) * 8
        r += grain + noise * 6 - 3
        g += grain * 0.7 + noise * 4 - 2
        b += grain * 0.3 + noise * 2 - 1
      }
      // Subtle highlight on plank edges
      if (plankY === 1) { r += 8; g += 6; b += 4 }
      if (plankY === 7) { r -= 5; g -= 4; b -= 3 }

      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(tx * size + x, ty * size + y, 1, 1)
    }
  }
}

/** Draw a carpet pattern */
export function drawCarpetFloor(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number, baseColor: number) {
  const [br, bg, bb] = colorToRGB(baseColor)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = seededRandom(tx * size + x, ty * size + y)
      const noise2 = seededRandom(tx * size + x + 100, ty * size + y + 100)
      // Carpet texture - fine noise
      const variation = (noise - 0.5) * 16 + (noise2 - 0.5) * 8
      // Subtle diamond pattern
      const diamond = ((x + tx * size + y + ty * size) % 4 === 0) ? 4 : 0
      const r = br + variation + diamond
      const g = bg + variation * 0.8 + diamond * 0.8
      const b = bb + variation * 0.6 + diamond * 0.6
      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(tx * size + x, ty * size + y, 1, 1)
    }
  }
}

/** Draw a tile floor (bathroom/hallway style) */
export function drawTileFloor(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number, baseColor: number) {
  const [br, bg, bb] = colorToRGB(baseColor)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = seededRandom(tx * size + x, ty * size + y) * 6
      // Tile grid with grout
      const tileX = (tx * size + x) % 8
      const tileY = (ty * size + y) % 8
      const isGrout = tileX === 0 || tileY === 0

      let r = br, g = bg, b = bb
      if (isGrout) {
        // Dark grout lines
        r -= 30; g -= 28; b -= 25
      } else {
        // Tile surface with subtle sheen
        const sheen = tileX === 1 && tileY === 1 ? 12 : 0
        r += noise + sheen; g += noise + sheen; b += noise + sheen
        // Slight color variation per tile
        const tileNoise = seededRandom(Math.floor((tx * size + x) / 8), Math.floor((ty * size + y) / 8)) * 10
        r += tileNoise; g += tileNoise; b += tileNoise
      }
      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(tx * size + x, ty * size + y, 1, 1)
    }
  }
}

/** Draw concrete / outdoor floor */
export function drawConcreteFloor(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number, baseColor: number) {
  const [br, bg, bb] = colorToRGB(baseColor)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = seededRandom(tx * size + x, ty * size + y)
      const noise2 = seededRandom(tx * size + x + 50, ty * size + y + 50)
      // Rough concrete texture
      const variation = (noise - 0.5) * 20 + (noise2 - 0.5) * 10
      // Occasional small cracks
      const crack = noise > 0.97 ? -15 : 0
      // Subtle aggregate spots
      const spot = noise2 > 0.92 ? 8 : 0
      const r = br + variation + crack + spot
      const g = bg + variation + crack + spot
      const b = bb + variation + crack + spot
      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(tx * size + x, ty * size + y, 1, 1)
    }
  }
}

/** Draw a wall section with depth and texture */
export function drawWall(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  width: number,
  height: number,
  baseColor: number,
  position: 'top' | 'bottom' | 'left' | 'right',
) {
  const [br, bg, bb] = colorToRGB(baseColor)
  const isTop = position === 'top'

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const noise = seededRandom(px + x, py + y, 73)
      let r = br, g = bg, b = bb

      if (isTop) {
        // Top wall has depth - darker at bottom, lighter at top
        const gradient = (1 - y / height) * 20 - 10
        r += gradient; g += gradient; b += gradient
        // Brick pattern
        const brickY = y % 5
        const brickOffset = Math.floor(y / 5) % 2 === 0 ? 0 : 4
        const brickX = (x + brickOffset) % 8
        if (brickY === 0 || brickX === 0) {
          r -= 12; g -= 10; b -= 8
        }
        // Mortar highlight
        if (brickY === 1 && brickX === 1) { r += 5; g += 4; b += 3 }
      } else {
        // Side/bottom walls - solid dark
        r -= 20; g -= 18; b -= 15
        // Baseboard stripe at bottom
        if (position === 'bottom' && y >= height - 2) {
          r -= 10; g -= 10; b -= 10
        }
      }

      r += (noise - 0.5) * 6
      g += (noise - 0.5) * 5
      b += (noise - 0.5) * 4

      ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
      ctx.fillRect(px + x, py + y, 1, 1)
    }
  }
}

/** Draw a shadow underneath an object */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${intensity})`
  // Shadow slightly offset to bottom-right
  ctx.fillRect(x + 1, y + h, w, 2)
  ctx.fillRect(x + w, y + 1, 1, h)
  // Softer edge
  ctx.fillStyle = `rgba(0,0,0,${intensity * 0.5})`
  ctx.fillRect(x + 1, y + h + 2, w, 1)
  ctx.fillRect(x + w + 1, y + 1, 1, h)
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
