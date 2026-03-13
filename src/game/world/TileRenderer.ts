import Phaser from 'phaser'
import { RoomConfig, DecorationItem } from '../../types'
import { TILE_SIZE, FLOOR_STYLES } from '../../constants'
import {
  drawWoodFloor, drawCarpetFloor, drawTileFloor, drawConcreteFloor,
  drawWall, lighten, darken, seededRandom, colorToRGB,
} from './PixelArtUtils'

export class TileRenderer {
  private scene: Phaser.Scene
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  drawRoom(room: RoomConfig, rt: Phaser.GameObjects.RenderTexture) {
    const T = TILE_SIZE
    const floorStyle = room.floorStyle || FLOOR_STYLES[room.id] || 'tile'

    // Size canvas for this room
    this.canvas.width = room.width * T
    this.canvas.height = room.height * T
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw floor tiles with texture
    const floorColor = room.color
    for (let ty = 2; ty < room.height - 1; ty++) {
      for (let tx = 1; tx < room.width - 1; tx++) {
        switch (floorStyle) {
          case 'wood': drawWoodFloor(this.ctx, tx, ty, T, lighten(floorColor, 30)); break
          case 'carpet': drawCarpetFloor(this.ctx, tx, ty, T, floorColor); break
          case 'tile': drawTileFloor(this.ctx, tx, ty, T, lighten(floorColor, 20)); break
          case 'concrete': drawConcreteFloor(this.ctx, tx, ty, T, lighten(floorColor, 10)); break
          default: drawTileFloor(this.ctx, tx, ty, T, floorColor)
        }
      }
    }

    // Warm ambient lighting overlay
    this.drawAmbientLighting(room)

    // Window light rays on floor
    this.drawWindowLightRays(room)

    // 3/4 perspective walls with visible wall tops
    this.draw3DWalls(room)

    // Room name sign on top wall
    this.drawRoomSign(room.name, Math.floor(room.width / 2) * T, T * 0.3)

    // Draw decorations
    if (room.decorations) {
      for (const deco of room.decorations) {
        this.drawDecoration(deco, room.x, room.y)
      }
    }

    // Blit to render texture at room position
    const key = `room_${room.id}_${Date.now()}`
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    this.scene.textures.addCanvas(key, this.canvas)
    const img = this.scene.add.image(room.x * T, room.y * T, key)
    img.setOrigin(0, 0)
    rt.draw(img)
    img.destroy()
    this.scene.textures.remove(key)
  }

  /** Isometric-lite 3/4 perspective walls with visible wall tops and depth gradient */
  private draw3DWalls(room: RoomConfig) {
    const ctx = this.ctx
    const T = TILE_SIZE
    const wallColor = darken(room.color, 15)
    const [wr, wg, wb] = colorToRGB(wallColor)

    // === TOP WALL (2 tiles thick with 3D wall cap) ===
    const topWallH = 2 * T
    const capH = 4 // visible top surface of wall (3/4 perspective)

    // Wall cap — lighter top face visible from above
    const capColor = lighten(wallColor, 25)
    const [cr, cg, cb] = colorToRGB(capColor)
    for (let y = 0; y < capH; y++) {
      for (let x = 0; x < room.width * T; x++) {
        const noise = seededRandom(x, y, 91)
        const grad = (y / capH) * 8
        ctx.fillStyle = `rgb(${clamp(cr + grad + noise * 4)},${clamp(cg + grad + noise * 3)},${clamp(cb + grad + noise * 2)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Wall face below cap — gradient: lighter at top, darker near floor
    for (let y = capH; y < topWallH; y++) {
      for (let x = 0; x < room.width * T; x++) {
        const noise = seededRandom(x, y, 73)
        const depthT = (y - capH) / (topWallH - capH)
        const gradient = (1 - depthT) * 15 - 8
        let r = wr + gradient, g = wg + gradient, b = wb + gradient
        // Brick pattern
        const brickY = (y - capH) % 5
        const brickOffset = Math.floor((y - capH) / 5) % 2 === 0 ? 0 : 4
        const brickX = (x + brickOffset) % 8
        if (brickY === 0 || brickX === 0) {
          r -= 12; g -= 10; b -= 8
        }
        if (brickY === 1 && brickX === 1) { r += 5; g += 4; b += 3 }
        r += (noise - 0.5) * 6
        g += (noise - 0.5) * 5
        b += (noise - 0.5) * 4
        ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Enhanced wall shadow onto floor (gradient fade)
    for (let sy = 0; sy < 6; sy++) {
      const alpha = 0.18 * (1 - sy / 6)
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(T, 2 * T + sy, (room.width - 2) * T, 1)
    }

    // === BOTTOM WALL with baseboard ledge ===
    drawWall(ctx, 0, (room.height - 1) * T, room.width * T, T, darken(wallColor, 15), 'bottom')
    // Baseboard highlight (3D ledge)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(T, (room.height - 1) * T, (room.width - 2) * T, 1)

    // === LEFT WALL with depth ===
    const leftDark = darken(wallColor, 10)
    for (let y = 0; y < room.height; y++) {
      drawWall(ctx, 0, y * T, T, T, leftDark, 'left')
    }
    // Inner edge highlight where wall meets the room
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(T - 1, capH, 1, topWallH - capH)

    // === RIGHT WALL ===
    for (let y = 0; y < room.height; y++) {
      drawWall(ctx, (room.width - 1) * T, y * T, T, T, darken(wallColor, 10), 'right')
    }

    // Corner darkening where walls meet
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 0, T, capH)
    ctx.fillRect((room.width - 1) * T, 0, T, capH)
  }

  /** Cool ambient lighting — subtle radial glow centered in room */
  private drawAmbientLighting(room: RoomConfig) {
    const ctx = this.ctx
    const T = TILE_SIZE
    const floorX = T
    const floorY = 2 * T
    const floorW = (room.width - 2) * T
    const floorH = (room.height - 3) * T
    const cx = floorX + floorW / 2
    const cy = floorY + floorH / 2

    const radius = Math.max(floorW, floorH) * 0.6
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0, 'rgba(80,100,180,0.04)')
    grad.addColorStop(0.5, 'rgba(60,70,140,0.02)')
    grad.addColorStop(1, 'rgba(0,0,0,0.06)')
    ctx.fillStyle = grad
    ctx.fillRect(floorX, floorY, floorW, floorH)
  }

  /** Light rays from windows onto the floor */
  private drawWindowLightRays(room: RoomConfig) {
    if (!room.decorations) return
    const ctx = this.ctx
    const T = TILE_SIZE

    for (const deco of room.decorations) {
      if (deco.type !== 'window') continue
      const wx = (deco.x - room.x) * T + T / 2
      const wy = 2 * T // just below top wall
      const rayWidth = T * 1.5
      const rayLength = T * 4

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(wx - rayWidth / 2, wy)
      ctx.lineTo(wx + rayWidth / 2, wy)
      ctx.lineTo(wx + rayWidth * 0.9, wy + rayLength)
      ctx.lineTo(wx - rayWidth * 0.9, wy + rayLength)
      ctx.closePath()

      const grad = ctx.createLinearGradient(wx, wy, wx, wy + rayLength)
      grad.addColorStop(0, 'rgba(100,120,200,0.08)')
      grad.addColorStop(0.4, 'rgba(80,100,180,0.04)')
      grad.addColorStop(1, 'rgba(60,80,160,0.0)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }
  }

  private drawRoomSign(name: string, x: number, y: number) {
    const ctx = this.ctx
    const textWidth = name.length * 5 + 12
    const signX = x - textWidth / 2
    const signH = 12
    // Plaque background (dark metal)
    ctx.fillStyle = '#1a1a24'
    ctx.fillRect(signX, y, textWidth, signH)
    // Inner bevel
    ctx.fillStyle = '#222233'
    ctx.fillRect(signX + 1, y + 1, textWidth - 2, signH - 2)
    // Dark nameplate with subtle glow
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(signX + 2, y + 2, textWidth - 4, signH - 4)
    ctx.fillStyle = '#202030'
    ctx.fillRect(signX + 2, y + signH - 3, textWidth - 4, 1)
    // Text (cool glow)
    ctx.fillStyle = '#8899cc'
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(name, x, y + 9)
    ctx.textAlign = 'start'
  }

  private drawDecoration(deco: DecorationItem, roomX: number, roomY: number) {
    const ctx = this.ctx
    const dx = (deco.x - roomX) * TILE_SIZE
    const dy = (deco.y - roomY) * TILE_SIZE

    switch (deco.type) {
      case 'clock':
        // Clock face
        ctx.fillStyle = '#ddd'
        ctx.fillRect(dx + 3, dy + 2, 10, 10)
        ctx.fillStyle = '#eee'
        ctx.fillRect(dx + 4, dy + 3, 8, 8)
        // Hands
        ctx.fillStyle = '#333'
        ctx.fillRect(dx + 8, dy + 4, 1, 4)
        ctx.fillRect(dx + 6, dy + 7, 4, 1)
        // Center dot
        ctx.fillStyle = '#c00'
        ctx.fillRect(dx + 8, dy + 7, 1, 1)
        break

      case 'window': {
        const T = TILE_SIZE
        // Outer frame (aluminum)
        ctx.fillStyle = '#4a4a5a'
        ctx.fillRect(dx, dy, T, T)
        // Inner frame
        ctx.fillStyle = '#5a5a6a'
        ctx.fillRect(dx + 1, dy + 1, T - 2, T - 2)

        // Night sky gradient (dark blue to deep navy)
        ctx.fillStyle = '#060a18'
        ctx.fillRect(dx + 2, dy + 2, T - 4, 3)
        ctx.fillStyle = '#0a0e1e'
        ctx.fillRect(dx + 2, dy + 5, T - 4, 3)
        ctx.fillStyle = '#0e1224'
        ctx.fillRect(dx + 2, dy + 8, T - 4, T - 10)

        // Stars and moon
        const sx = seededRandom(deco.x, deco.y, 77)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillRect(dx + 3 + Math.floor(sx * 5), dy + 2, 1, 1)
        ctx.fillRect(dx + 9 + Math.floor(sx * 2), dy + 3, 1, 1)
        ctx.fillStyle = 'rgba(255,255,200,0.5)'
        ctx.fillRect(dx + 4, dy + 3, 1, 1)
        // Moon (crescent)
        if (Math.floor(sx * 10) % 3 === 0) {
          ctx.fillStyle = '#dde8ff'
          ctx.fillRect(dx + 10, dy + 2, 2, 2)
          ctx.fillStyle = '#060a18'
          ctx.fillRect(dx + 11, dy + 2, 1, 1)
        }

        // City skyline — layered buildings at different depths
        // Far buildings (darker, shorter)
        ctx.fillStyle = '#0f1520'
        ctx.fillRect(dx + 2, dy + 7, 2, 5)
        ctx.fillRect(dx + 5, dy + 6, 3, 6)
        ctx.fillRect(dx + 10, dy + 8, 2, 4)
        // Mid buildings (medium)
        ctx.fillStyle = '#151c2a'
        ctx.fillRect(dx + 3, dy + 8, 2, 4)
        ctx.fillRect(dx + 7, dy + 5, 2, 7)
        ctx.fillRect(dx + 11, dy + 7, 2, 5)
        // Near buildings (tallest, lighter)
        ctx.fillStyle = '#1a2235'
        ctx.fillRect(dx + 2, dy + 9, 3, 3)
        ctx.fillRect(dx + 6, dy + 4, 2, 8)
        ctx.fillRect(dx + 9, dy + 6, 3, 6)

        // Antenna / spire on tallest building
        ctx.fillStyle = '#2a3040'
        ctx.fillRect(dx + 7, dy + 3, 1, 2)
        // Blinking red light on antenna
        ctx.fillStyle = '#ff2222'
        ctx.fillRect(dx + 7, dy + 3, 1, 1)

        // Lit windows on buildings (warm yellow, cool blue mix)
        const litPositions = [
          [3, 9, '#ffdd66'], [4, 10, '#ffdd66'],
          [6, 5, '#aaccff'], [6, 7, '#ffdd66'], [6, 9, '#aaccff'], [6, 11, '#ffcc44'],
          [7, 6, '#ffdd66'], [7, 8, '#ffdd66'], [7, 10, '#aaccff'],
          [8, 6, '#aaccff'], [8, 8, '#aaccff'],
          [9, 7, '#ffdd66'], [9, 9, '#ffdd66'], [10, 8, '#ffcc44'], [10, 10, '#aaccff'],
          [11, 8, '#ffdd66'], [11, 10, '#ffdd66'],
        ]
        for (const [lx, ly, color] of litPositions) {
          // Randomly light ~60% of windows based on position seed
          if (seededRandom(deco.x + (lx as number), deco.y + (ly as number), 55) > 0.4) {
            ctx.fillStyle = color as string
            ctx.fillRect(dx + (lx as number), dy + (ly as number), 1, 1)
          }
        }

        // Cross frame divider
        ctx.fillStyle = '#5a5a6a'
        ctx.fillRect(dx + T / 2, dy + 1, 1, T - 2)
        ctx.fillRect(dx + 1, dy + T / 2, T - 2, 1)
        // Frame highlights
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(dx + 1, dy + 1, T - 2, 1)
        ctx.fillRect(dx + 1, dy + 1, 1, T - 2)
        // Glass reflection (subtle diagonal)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(dx + 3, dy + 3, 2, 1)
        ctx.fillRect(dx + 4, dy + 4, 2, 1)
        break
      }

      case 'poster':
        ctx.fillStyle = '#3a3a5a'
        ctx.fillRect(dx + 2, dy + 1, 12, 14)
        ctx.fillStyle = '#4a4a6a'
        ctx.fillRect(dx + 3, dy + 2, 10, 12)
        // Random colored design
        ctx.fillStyle = `rgb(${Math.floor(seededRandom(deco.x, deco.y) * 200 + 55)},${Math.floor(seededRandom(deco.x + 1, deco.y) * 200 + 55)},${Math.floor(seededRandom(deco.x, deco.y + 1) * 200 + 55)})`
        ctx.fillRect(dx + 4, dy + 3, 8, 6)
        break

      case 'painting':
        // Gold frame
        ctx.fillStyle = '#c8a84e'
        ctx.fillRect(dx + 1, dy + 1, 14, 12)
        ctx.fillStyle = '#b8983e'
        ctx.fillRect(dx + 2, dy + 2, 12, 10)
        // Canvas with landscape
        ctx.fillStyle = '#5a8ab0'
        ctx.fillRect(dx + 3, dy + 3, 10, 4) // sky
        ctx.fillStyle = '#4a7a40'
        ctx.fillRect(dx + 3, dy + 7, 10, 4) // ground
        // Sun
        ctx.fillStyle = '#ffd700'
        ctx.fillRect(dx + 10, dy + 4, 2, 2)
        // Frame highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(dx + 1, dy + 1, 14, 1)
        break

      case 'sign':
        ctx.fillStyle = '#2a4a2a'
        ctx.fillRect(dx + 1, dy + 3, 14, 8)
        if (deco.label) {
          ctx.fillStyle = '#88ff88'
          ctx.font = '5px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(deco.label, dx + 8, dy + 9)
          ctx.textAlign = 'start'
        }
        break

      case 'wall_shelf': {
        // Wall-mounted shelf with books
        const shelfW = TILE_SIZE
        // Shelf bracket
        ctx.fillStyle = '#5a4a3a'
        ctx.fillRect(dx + 1, dy + 10, shelfW - 2, 2)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(dx + 1, dy + 10, shelfW - 2, 1)
        // Brackets
        ctx.fillStyle = '#4a3a2a'
        ctx.fillRect(dx + 3, dy + 10, 1, 3)
        ctx.fillRect(dx + shelfW - 4, dy + 10, 1, 3)
        // Books on shelf
        const bookPalette = ['#8b2252', '#225588', '#228b22', '#cd8500', '#8b0000', '#4a4a8b']
        let bx = dx + 2
        for (let i = 0; i < 4; i++) {
          const bw = 2 + Math.floor(seededRandom(deco.x + i, deco.y, 33) * 2)
          const bh = 4 + Math.floor(seededRandom(deco.x, deco.y + i, 44) * 3)
          ctx.fillStyle = bookPalette[i % bookPalette.length]
          ctx.fillRect(bx, dy + 10 - bh, bw, bh)
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(bx, dy + 10 - bh, 1, bh)
          bx += bw + 1
        }
        break
      }

      case 'string_lights': {
        // Decorative string lights along wall (spans 2 tiles wide)
        const wireY = dy + 6
        // Wire
        ctx.fillStyle = '#333'
        ctx.fillRect(dx, wireY, TILE_SIZE, 1)
        // Drooping wire effect
        ctx.fillRect(dx + 4, wireY + 1, 1, 1)
        ctx.fillRect(dx + 12, wireY + 1, 1, 1)
        // Bulbs with warm glow
        const bulbColors = ['#ffdd44', '#ff8844', '#ff6688', '#44ddff', '#88ff66']
        for (let i = 0; i < 5; i++) {
          const lx = dx + 1 + i * 3
          const ly = wireY + (i % 2 === 0 ? 1 : 2)
          const color = bulbColors[i]
          ctx.fillStyle = color
          ctx.fillRect(lx, ly, 2, 2)
          // Glow halo
          ctx.fillStyle = color.replace(')', ',0.15)').replace('rgb', 'rgba').replace('#', '')
          // Parse hex to rgba for glow
          const hr = parseInt(color.slice(1, 3), 16)
          const hg = parseInt(color.slice(3, 5), 16)
          const hb = parseInt(color.slice(5, 7), 16)
          ctx.fillStyle = `rgba(${hr},${hg},${hb},0.15)`
          ctx.fillRect(lx - 1, ly - 1, 4, 4)
        }
        break
      }

      case 'ceiling_light': {
        // Recessed ceiling light with downward light cone
        // Light fixture
        ctx.fillStyle = '#444'
        ctx.fillRect(dx + 4, dy + 1, 8, 2)
        ctx.fillStyle = '#555'
        ctx.fillRect(dx + 5, dy + 1, 6, 1)
        // Bulb (cool white)
        ctx.fillStyle = '#c0c8e0'
        ctx.fillRect(dx + 6, dy + 3, 4, 2)
        // Light cone (cool downward glow)
        ctx.fillStyle = 'rgba(140,160,220,0.06)'
        ctx.beginPath()
        ctx.moveTo(dx + 5, dy + 5)
        ctx.lineTo(dx + 11, dy + 5)
        ctx.lineTo(dx + 14, dy + TILE_SIZE)
        ctx.lineTo(dx + 2, dy + TILE_SIZE)
        ctx.closePath()
        ctx.fill()
        // Inner brighter cone
        ctx.fillStyle = 'rgba(140,160,220,0.04)'
        ctx.fillRect(dx + 6, dy + 5, 4, TILE_SIZE - 5)
        break
      }

      case 'neon_sign': {
        // Neon accent sign on wall
        const neonColor = deco.color || '#ff44aa'
        const nr = parseInt(neonColor.slice(1, 3), 16)
        const ng = parseInt(neonColor.slice(3, 5), 16)
        const nb = parseInt(neonColor.slice(5, 7), 16)
        // Outer glow
        ctx.fillStyle = `rgba(${nr},${ng},${nb},0.12)`
        ctx.fillRect(dx, dy + 1, TILE_SIZE, 12)
        // Neon tube shape (bar or simple design)
        ctx.fillStyle = neonColor
        if (deco.label === 'X') {
          // X shape
          ctx.fillRect(dx + 3, dy + 3, 2, 2)
          ctx.fillRect(dx + 5, dy + 5, 2, 2)
          ctx.fillRect(dx + 7, dy + 7, 2, 2)
          ctx.fillRect(dx + 7, dy + 3, 2, 2)
          ctx.fillRect(dx + 5, dy + 5, 2, 2)
          ctx.fillRect(dx + 3, dy + 7, 2, 2)
        } else {
          // Horizontal bar
          ctx.fillRect(dx + 2, dy + 5, TILE_SIZE - 4, 2)
          // Vertical accents
          ctx.fillRect(dx + 3, dy + 3, 2, 6)
          ctx.fillRect(dx + TILE_SIZE - 5, dy + 3, 2, 6)
        }
        // Inner bright core
        ctx.fillStyle = `rgba(255,255,255,0.4)`
        ctx.fillRect(dx + 4, dy + 5, TILE_SIZE - 8, 1)
        // Wall glow spill
        ctx.fillStyle = `rgba(${nr},${ng},${nb},0.06)`
        ctx.fillRect(dx - 2, dy, TILE_SIZE + 4, TILE_SIZE)
        break
      }
    }
  }

  drawDoorway(x: number, y: number, rt: Phaser.GameObjects.RenderTexture, floorColor: number) {
    const T = TILE_SIZE
    this.canvas.width = T
    this.canvas.height = T * 3
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.imageSmoothingEnabled = false

    // Draw doorway floor tiles
    for (let dy = 0; dy < 3; dy++) {
      drawTileFloor(this.ctx, 0, dy, T, floorColor)
    }

    // Door frame markers
    this.ctx.fillStyle = 'rgba(100,120,200,0.10)'
    this.ctx.fillRect(0, 0, T, 1)
    this.ctx.fillRect(0, T * 3 - 1, T, 1)

    const key = `door_${x}_${y}_${Date.now()}`
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    this.scene.textures.addCanvas(key, this.canvas)
    const img = this.scene.add.image(x * T, (y - 1) * T, key)
    img.setOrigin(0, 0)
    rt.draw(img)
    img.destroy()
    this.scene.textures.remove(key)
  }

  destroy() {
    // No persistent graphics to clean up
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
