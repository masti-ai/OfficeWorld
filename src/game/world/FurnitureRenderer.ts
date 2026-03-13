import Phaser from 'phaser'
import { FurnitureItem } from '../../types'
import { TILE_SIZE } from '../../constants'
import { drawShadow, seededRandom, colorToRGB } from './PixelArtUtils'

export class FurnitureRenderer {
  private scene: Phaser.Scene
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  drawFurniture(item: FurnitureItem, rt: Phaser.GameObjects.RenderTexture) {
    const T = TILE_SIZE
    const pw = item.width * T
    const ph = item.height * T

    this.canvas.width = pw + 4
    this.canvas.height = ph + 4
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.imageSmoothingEnabled = false

    switch (item.type) {
      case 'desk': this.drawDesk(pw, ph); break
      case 'monitor': this.drawMonitor(T); break
      case 'plant': this.drawPlant(T); break
      case 'toilet': this.drawToilet(T); break
      case 'arcade_machine': this.drawArcadeMachine(T, ph); break
      case 'vending_machine': this.drawVendingMachine(T, ph); break
      case 'table': this.drawTable(pw, ph); break
      case 'chair': this.drawChair(T); break
      case 'couch': this.drawCouch(pw, ph); break
      case 'ashtray': this.drawAshtray(T); break
      case 'ping_pong': this.drawPingPong(pw, ph); break
      case 'whiteboard': this.drawWhiteboard(pw, ph); break
      case 'bookshelf': this.drawBookshelf(pw, ph); break
      case 'coffee_machine': this.drawCoffeeMachine(T); break
      case 'water_cooler': this.drawWaterCooler(T); break
      case 'trash_can': this.drawTrashCan(T); break
      case 'projector_screen': this.drawProjectorScreen(pw, ph); break
      case 'meeting_table': this.drawMeetingTable(pw, ph); break
      case 'server_rack': this.drawServerRack(T, ph); break
      case 'filing_cabinet': this.drawFilingCabinet(T, ph); break
      case 'rug': this.drawRug(pw, ph); break
      case 'lamp': this.drawLamp(T); break
      case 'coat_rack': this.drawCoatRack(T, ph); break
      case 'coffee_cup': this.drawCoffeeCup(T); break
      case 'desk_figurine': this.drawDeskFigurine(T); break
      case 'desk_photo_frame': this.drawDeskPhotoFrame(T); break
      case 'desk_sticky_notes': this.drawDeskStickyNotes(T); break
      case 'desk_energy_drink': this.drawDeskEnergyDrink(T); break
      case 'desk_snack': this.drawDeskSnack(T); break
      case 'desk_stress_ball': this.drawDeskStressBall(T); break
      case 'led_strip': this.drawLedStrip(pw, ph); break
      case 'pc_tower': this.drawPcTower(T, ph); break
      case 'headphone_stand': this.drawHeadphoneStand(T); break
      case 'desk_lamp': this.drawDeskLamp(T); break
      case 'cable_management': this.drawCableManagement(pw, ph); break
      case 'gaming_chair': this.drawGamingChair(T); break
      case 'dual_monitor': this.drawDualMonitor(pw, ph); break
      case 'triple_monitor': this.drawTripleMonitor(pw, ph); break
    }

    const key = `furn_${item.type}_${item.x}_${item.y}_${Date.now()}`
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    this.scene.textures.addCanvas(key, this.canvas)
    const img = this.scene.add.image(item.x * T, item.y * T, key)
    img.setOrigin(0, 0)
    rt.draw(img)
    img.destroy()
    this.scene.textures.remove(key)
  }

  private drawDesk(w: number, h: number) {
    const ctx = this.ctx
    const woodBase = 0x2a2830 // dark charcoal desk surface
    const isoDepth = 4 // isometric front-face depth

    // --- Desk top surface with subtle grain ---
    for (let y = 0; y < h - isoDepth; y++) {
      for (let x = 0; x < w; x++) {
        const noise = seededRandom(x, y, 11)
        const grain = Math.sin(x * 0.4 + noise) * 2
        const [r, g, b] = colorToRGB(woodBase)
        ctx.fillStyle = `rgb(${clamp(r + grain + noise * 4)},${clamp(g + grain * 0.8 + noise * 3)},${clamp(b + grain * 0.6 + noise * 2)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    // Highlight on top edge (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, w, 1)
    // Subtle top-surface sheen
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(2, 1, Math.floor(w * 0.4), Math.floor((h - isoDepth) * 0.6))

    // --- Isometric front face (3D depth) ---
    const frontTop = h - isoDepth
    for (let y = 0; y < isoDepth; y++) {
      const darkenAmt = y * 6
      for (let x = 0; x < w; x++) {
        const noise = seededRandom(x, y + 50, 11)
        ctx.fillStyle = `rgb(${clamp(30 - darkenAmt + noise * 3)},${clamp(28 - darkenAmt + noise * 2)},${clamp(34 - darkenAmt + noise * 2)})`
        ctx.fillRect(x, frontTop + y, 1, 1)
      }
    }
    // Front face top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, frontTop, w, 1)

    // --- Right side face (isometric depth illusion) ---
    for (let y = 0; y < isoDepth; y++) {
      const shade = 22 - y * 5
      ctx.fillStyle = `rgb(${clamp(shade + 8)},${clamp(shade + 6)},${clamp(shade + 10)})`
      ctx.fillRect(w - 1, frontTop + y, 1, 1)
    }

    // Metal legs with crossbar
    ctx.fillStyle = '#1a1a1e'
    ctx.fillRect(1, h - 3, 2, 3)
    ctx.fillRect(w - 3, h - 3, 2, 3)
    ctx.fillStyle = '#222'
    ctx.fillRect(1, h - 2, 2, 1) // leg highlight
    ctx.fillRect(w - 3, h - 2, 2, 1)
    // Crossbar between legs
    ctx.fillStyle = '#181818'
    ctx.fillRect(3, h - 1, w - 6, 1)

    drawShadow(ctx, 0, 0, w, h, 0.3)

    // RGB underglow strip under front edge (enhanced for dark aesthetic)
    const glowColors = [
      [80, 120, 255],   // blue
      [180, 50, 255],   // purple
      [0, 200, 255],    // cyan
      [255, 50, 180],   // magenta
    ]
    const glowIdx = Math.floor(seededRandom(w, h, 42) * glowColors.length)
    const [gr, gg, gb] = glowColors[glowIdx]
    ctx.fillStyle = `rgba(${gr},${gg},${gb},0.30)`
    ctx.fillRect(1, h, w - 2, 2)
    ctx.fillStyle = `rgba(${gr},${gg},${gb},0.15)`
    ctx.fillRect(0, h + 2, w, 3)
  }

  private drawMonitor(T: number) {
    const ctx = this.ctx
    // Pick a screen color theme per monitor (purple/blue/cyan)
    const screenThemes = [
      { bg: '#0a0e2e', glow: [80, 100, 220], code: ['#8866cc', '#6688dd', '#55aadd', '#aa77cc', '#7799ee'] },
      { bg: '#0e0a2a', glow: [140, 60, 200], code: ['#bb55cc', '#9966dd', '#cc77bb', '#8855aa', '#dd88cc'] },
      { bg: '#081820', glow: [40, 160, 220], code: ['#44bbdd', '#66ccee', '#55aacc', '#77ddee', '#33aacc'] },
    ]
    const theme = screenThemes[Math.floor(seededRandom(T, 99) * screenThemes.length)]
    const [glowR, glowG, glowB] = theme.glow
    // Screen bezel (rounded look)
    ctx.fillStyle = '#0a0a18'
    ctx.fillRect(1, 1, T - 2, T - 5)
    ctx.fillStyle = '#101020'
    ctx.fillRect(0, 2, T, T - 7)
    // Screen
    ctx.fillStyle = theme.bg
    ctx.fillRect(2, 2, T - 4, T - 7)
    // Line numbers gutter
    ctx.fillStyle = '#121830'
    ctx.fillRect(2, 2, 2, T - 7)
    // Code lines with syntax highlighting
    for (let line = 0; line < 5; line++) {
      const indent = Math.floor(seededRandom(line, 7) * 2) * 2
      // Line number
      ctx.fillStyle = '#334466'
      ctx.fillRect(2, 3 + line * 2, 1, 1)
      // Code token 1
      const w1 = 2 + Math.floor(seededRandom(line, 1) * 4)
      ctx.fillStyle = theme.code[line % theme.code.length]
      ctx.fillRect(5 + indent, 3 + line * 2, w1, 1)
      // Code token 2
      if (seededRandom(line, 3) > 0.3) {
        const w2 = 1 + Math.floor(seededRandom(line, 4) * 3)
        ctx.fillStyle = theme.code[(line + 2) % theme.code.length]
        ctx.fillRect(5 + indent + w1 + 1, 3 + line * 2, w2, 1)
      }
    }
    // Cursor blink pixel
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(5, 3 + 4 * 2, 1, 1)
    // Screen scanline effect
    for (let sy = 2; sy < T - 5; sy += 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fillRect(2, sy, T - 4, 1)
    }
    // Enhanced screen glow (primary light source in dark rooms)
    ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.25)`
    ctx.fillRect(0, 0, T, T - 3)
    // Glow spill onto desk (enhanced multi-layer)
    ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.20)`
    ctx.fillRect(1, T - 3, T - 2, 3)
    // Extended glow spill onto surrounding area (stronger for dark aesthetic)
    ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.12)`
    ctx.fillRect(-2, T, T + 4, 4)
    ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.06)`
    ctx.fillRect(-4, T + 4, T + 8, 4)
    ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.03)`
    ctx.fillRect(-6, T + 8, T + 12, 4)
    // Bezel highlight (top edge)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(1, 1, T - 2, 1)
    // Stand
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(T / 2 - 2, T - 4, 4, 2)
    ctx.fillStyle = '#222'
    ctx.fillRect(T / 2 - 3, T - 2, 6, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(T / 2 - 2, T - 4, 4, 1)
    // Power LED
    ctx.fillStyle = '#00ff44'
    ctx.fillRect(T - 3, T - 6, 1, 1)
    // LED glow
    ctx.fillStyle = 'rgba(0,255,68,0.15)'
    ctx.fillRect(T - 4, T - 7, 3, 3)
    drawShadow(ctx, 1, 1, T - 2, T - 2, 0.2)
  }

  private drawPlant(_T: number) {
    const ctx = this.ctx
    // Pot with rim detail
    ctx.fillStyle = '#7a3a10'
    ctx.fillRect(4, 11, 8, 4)
    ctx.fillStyle = '#8b4513'
    ctx.fillRect(5, 12, 6, 3)
    ctx.fillStyle = '#a0522d'
    ctx.fillRect(3, 10, 10, 2)
    // Pot rim highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(3, 10, 10, 1)
    // Soil with texture
    ctx.fillStyle = '#3e2a1a'
    ctx.fillRect(4, 10, 8, 1)
    ctx.fillStyle = '#4a3522'
    ctx.fillRect(5, 10, 2, 1)
    ctx.fillRect(9, 10, 1, 1)
    // Stem
    ctx.fillStyle = '#2e6b2e'
    ctx.fillRect(7, 4, 2, 7)
    ctx.fillStyle = '#256b25'
    ctx.fillRect(7, 6, 1, 4)
    // Leaves with depth
    const leafColors = ['#228b22', '#32cd32', '#2e8b2e', '#3cb043']
    ctx.fillStyle = leafColors[0]; ctx.fillRect(2, 3, 5, 4)
    ctx.fillStyle = leafColors[1]; ctx.fillRect(3, 2, 3, 3)
    ctx.fillStyle = leafColors[2]; ctx.fillRect(1, 5, 4, 2)
    ctx.fillStyle = leafColors[0]; ctx.fillRect(9, 3, 5, 4)
    ctx.fillStyle = leafColors[3]; ctx.fillRect(10, 1, 3, 4)
    ctx.fillStyle = leafColors[1]; ctx.fillRect(11, 5, 3, 2)
    ctx.fillStyle = leafColors[2]; ctx.fillRect(5, 0, 6, 3)
    ctx.fillStyle = leafColors[3]; ctx.fillRect(6, -1, 4, 3)
    // Leaf veins
    ctx.fillStyle = 'rgba(0,60,0,0.25)'
    ctx.fillRect(4, 4, 1, 2)
    ctx.fillRect(11, 3, 1, 2)
    ctx.fillRect(7, 1, 1, 2)
    // Highlights
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(3, 2, 2, 1)
    ctx.fillRect(10, 1, 2, 1)
    ctx.fillRect(6, 0, 2, 1)
    // Tiny flower bud
    ctx.fillStyle = '#ff6688'
    ctx.fillRect(11, 2, 1, 1)
    drawShadow(ctx, 3, 10, 10, 5, 0.2)
  }

  private drawToilet(_T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#3a3a44'
    ctx.fillRect(4, 0, 8, 5)
    ctx.fillStyle = '#333340'
    ctx.fillRect(5, 1, 6, 3)
    ctx.fillStyle = '#2a2a30'
    ctx.fillRect(10, 2, 2, 1)
    ctx.fillStyle = '#404048'
    ctx.fillRect(3, 5, 10, 8)
    ctx.fillStyle = '#383840'
    ctx.fillRect(4, 6, 8, 6)
    ctx.fillStyle = '#2a3844'
    ctx.fillRect(5, 7, 6, 4)
    ctx.fillStyle = '#444450'
    ctx.fillRect(3, 5, 10, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(3, 5, 10, 1)
    drawShadow(ctx, 3, 5, 10, 8, 0.2)
  }

  private drawArcadeMachine(T: number, ph: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#1a1a4a'
    ctx.fillRect(1, 0, T - 2, ph)
    ctx.fillStyle = '#12123a'
    ctx.fillRect(1, 0, 2, ph)
    ctx.fillRect(T - 3, 0, 2, ph)
    // Marquee
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(2, 1, T - 4, 4)
    ctx.fillStyle = '#ff6666'
    ctx.fillRect(3, 2, T - 6, 2)
    // Screen
    ctx.fillStyle = '#001a00'
    ctx.fillRect(3, 6, T - 6, T - 4)
    const screenColors = ['#00ff88', '#00cc66', '#009944', '#00ff44']
    for (let sy = 0; sy < 8; sy++) {
      for (let sx = 0; sx < 8; sx++) {
        if (seededRandom(sx, sy, 55) > 0.6) {
          ctx.fillStyle = screenColors[Math.floor(seededRandom(sx, sy, 77) * 4)]
          ctx.fillRect(4 + sx, 7 + sy, 1, 1)
        }
      }
    }
    // Screen glow
    ctx.fillStyle = 'rgba(0,255,100,0.1)'
    ctx.fillRect(2, 5, T - 4, T - 2)
    // Controls
    ctx.fillStyle = '#2a2a5a'
    ctx.fillRect(3, T + 2, T - 6, 6)
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(5, T + 3, 2, 4)
    ctx.fillStyle = '#ff6666'
    ctx.fillRect(5, T + 3, 2, 1)
    ctx.fillStyle = '#4444ff'
    ctx.fillRect(9, T + 4, 2, 2)
    ctx.fillStyle = '#44ff44'
    ctx.fillRect(11, T + 3, 2, 2)
    drawShadow(ctx, 1, 0, T - 2, ph, 0.25)
  }

  private drawVendingMachine(T: number, ph: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#2a3a6a'
    ctx.fillRect(1, 0, T - 2, ph)
    ctx.fillStyle = '#354a7a'
    ctx.fillRect(2, 1, T - 4, ph - 3)
    ctx.fillStyle = '#1a2a4a'
    ctx.fillRect(3, 2, T - 6, ph - 10)
    const products = [0xff4444, 0x44ff44, 0x4444ff, 0xffaa44, 0xff44ff]
    for (let r = 0; r < Math.min(5, Math.floor((ph - 10) / 4)); r++) {
      ctx.fillStyle = `#${products[r].toString(16).padStart(6, '0')}`
      ctx.fillRect(4, 3 + r * 4, T - 8, 3)
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(4, 3 + r * 4, T - 8, 1)
    }
    ctx.fillStyle = '#111'
    ctx.fillRect(3, ph - 7, T - 6, 4)
    ctx.fillStyle = '#222'
    ctx.fillRect(4, ph - 6, T - 8, 2)
    ctx.fillStyle = '#888'
    ctx.fillRect(T - 5, ph / 2, 2, 3)
    drawShadow(ctx, 1, 0, T - 2, ph, 0.25)
  }

  private drawTable(w: number, h: number) {
    const ctx = this.ctx
    for (let y = 0; y < h - 2; y++) {
      for (let x = 0; x < w; x++) {
        const noise = seededRandom(x, y, 33)
        const grain = Math.sin(x * 0.5) * 2
        ctx.fillStyle = `rgb(${clamp(38 + grain + noise * 3)},${clamp(36 + grain * 0.7 + noise * 2)},${clamp(42 + grain * 0.5 + noise * 2)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    ctx.fillStyle = '#1e1c24'
    ctx.fillRect(0, h - 2, w, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, 0, w, 1)
    ctx.fillStyle = '#161420'
    ctx.fillRect(1, h - 2, 2, 2)
    ctx.fillRect(w - 3, h - 2, 2, 2)
    drawShadow(ctx, 0, 0, w, h, 0.25)
  }

  private drawChair(T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(3, 6, T - 6, 6)
    ctx.fillStyle = '#303042'
    ctx.fillRect(4, 7, T - 8, 4)
    ctx.fillStyle = '#222234'
    ctx.fillRect(3, 2, T - 6, 5)
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(4, 3, T - 8, 3)
    ctx.fillStyle = '#1a1a2a'
    ctx.fillRect(3, 12, 2, 3)
    ctx.fillRect(T - 5, 12, 2, 3)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(4, 7, T - 8, 1)
    drawShadow(ctx, 3, 6, T - 6, 9, 0.15)
  }

  private drawCouch(w: number, h: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#2a1a2e'
    ctx.fillRect(2, 3, w - 4, h - 4)
    const cushionW = Math.floor((w - 6) / 2)
    ctx.fillStyle = '#322238'
    ctx.fillRect(3, 4, cushionW, h - 6)
    ctx.fillRect(4 + cushionW, 4, cushionW, h - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(3, 4, cushionW, 2)
    ctx.fillRect(4 + cushionW, 4, cushionW, 2)
    ctx.fillStyle = '#221428'
    ctx.fillRect(0, 2, 3, h - 3)
    ctx.fillRect(w - 3, 2, 3, h - 3)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, 2, 3, 1)
    ctx.fillRect(w - 3, 2, 3, 1)
    ctx.fillStyle = '#1a0e20'
    ctx.fillRect(1, 0, w - 2, 4)
    drawShadow(ctx, 0, 2, w, h - 2, 0.25)
  }

  private drawAshtray(_T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#666'
    ctx.fillRect(4, 6, 8, 5)
    ctx.fillStyle = '#777'
    ctx.fillRect(3, 6, 10, 2)
    ctx.fillStyle = '#999'
    ctx.fillRect(5, 7, 6, 3)
    ctx.fillStyle = '#aaa'
    ctx.fillRect(6, 8, 4, 1)
    ctx.fillStyle = '#eee'
    ctx.fillRect(3, 7, 4, 1)
    ctx.fillStyle = '#ff6633'
    ctx.fillRect(2, 7, 2, 1)
    ctx.fillStyle = 'rgba(180,180,180,0.3)'
    ctx.fillRect(3, 5, 1, 2)
    ctx.fillRect(4, 3, 1, 3)
    ctx.fillRect(2, 4, 1, 2)
  }

  private drawPingPong(w: number, h: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#1a5a2a'
    ctx.fillRect(0, 2, w, h - 3)
    ctx.fillStyle = '#2a7a3a'
    ctx.fillRect(1, 3, w - 2, h - 5)
    ctx.fillStyle = '#fff'
    ctx.fillRect(1, 3, w - 2, 1)
    ctx.fillRect(1, h - 3, w - 2, 1)
    ctx.fillRect(1, 3, 1, h - 6)
    ctx.fillRect(w - 2, 3, 1, h - 6)
    ctx.fillRect(1, Math.floor(h / 2), w - 2, 1)
    ctx.fillStyle = '#ccc'
    ctx.fillRect(Math.floor(w / 2) - 1, 2, 2, h - 3)
    ctx.fillStyle = '#ddd'
    for (let y = 2; y < h - 1; y += 2) {
      ctx.fillRect(Math.floor(w / 2) - 1, y, 2, 1)
    }
    ctx.fillStyle = '#888'
    ctx.fillRect(Math.floor(w / 2), 1, 1, 2)
    ctx.fillRect(Math.floor(w / 2), h - 2, 1, 2)
    ctx.fillStyle = '#fff'
    ctx.fillRect(Math.floor(w * 0.3), Math.floor(h * 0.3), 2, 2)
    ctx.fillStyle = '#444'
    ctx.fillRect(2, h - 1, 2, 2)
    ctx.fillRect(w - 4, h - 1, 2, 2)
    drawShadow(ctx, 0, 2, w, h - 2, 0.2)
  }

  private drawWhiteboard(w: number, h: number) {
    const ctx = this.ctx
    // Frame (dark aluminum look)
    ctx.fillStyle = '#333340'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3a3a48'
    ctx.fillRect(0, 0, w, 1)
    // Dark surface (glass whiteboard aesthetic)
    ctx.fillStyle = '#1a1a28'
    ctx.fillRect(1, 1, w - 2, h - 3)
    // Faint grid lines
    ctx.fillStyle = 'rgba(100,100,140,0.15)'
    for (let gx = 5; gx < w - 2; gx += 5) {
      ctx.fillRect(gx, 1, 1, h - 3)
    }
    for (let gy = 5; gy < h - 2; gy += 5) {
      ctx.fillRect(1, gy, w - 2, 1)
    }
    // Scribbled text lines (glowing on dark board)
    const colors = ['#6688cc', '#cc6688', '#66cc88', '#ccaa66']
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i % colors.length]
      const lineY = 3 + i * 3
      const lineW = 4 + seededRandom(i, 0) * (w - 10)
      ctx.fillRect(3, lineY, lineW, 1)
    }
    // Small box diagram
    ctx.fillStyle = '#4488dd'
    ctx.fillRect(w - 12, 3, 6, 4)
    ctx.fillStyle = '#1a1a28'
    ctx.fillRect(w - 11, 4, 4, 2)
    // Arrow
    ctx.fillStyle = '#dd4488'
    ctx.fillRect(w - 14, 5, 2, 1)
    // Sticky note (muted)
    ctx.fillStyle = '#4a4430'
    ctx.fillRect(3, h - 9, 6, 5)
    ctx.fillStyle = '#3a3420'
    ctx.fillRect(3, h - 9, 6, 1)
    ctx.fillStyle = '#8888aa'
    ctx.fillRect(4, h - 7, 4, 1)
    ctx.fillRect(4, h - 5, 3, 1)
    // Sticky note (muted pink)
    if (w > 20) {
      ctx.fillStyle = '#4a2a3a'
      ctx.fillRect(11, h - 8, 5, 4)
      ctx.fillStyle = '#3a1a2a'
      ctx.fillRect(11, h - 8, 5, 1)
      ctx.fillStyle = '#8888aa'
      ctx.fillRect(12, h - 6, 3, 1)
    }
    // Marker tray
    ctx.fillStyle = '#2a2a34'
    ctx.fillRect(2, h - 2, w - 4, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(2, h - 2, w - 4, 1)
    // Markers in tray
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(4, h - 3, 3, 1)
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(8, h - 3, 3, 1)
    ctx.fillStyle = '#00aa00'
    ctx.fillRect(12, h - 3, 3, 1)
    // Eraser
    ctx.fillStyle = '#444'
    ctx.fillRect(w - 6, h - 3, 4, 1)
  }

  private drawBookshelf(w: number, h: number) {
    const ctx = this.ctx
    // Back panel (dark)
    ctx.fillStyle = '#141418'
    ctx.fillRect(0, 0, w, h)
    // Side panels
    ctx.fillStyle = '#1a1a20'
    ctx.fillRect(0, 0, 1, h)
    ctx.fillRect(w - 1, 0, 1, h)
    // Top
    ctx.fillStyle = '#222230'
    ctx.fillRect(0, 0, w, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(0, 0, w, 1)
    const shelfCount = Math.floor(h / 6)
    for (let s = 0; s < shelfCount; s++) {
      const sy = s * 6 + 1
      let bx = 1
      while (bx < w - 2) {
        const bookW = 2 + Math.floor(seededRandom(bx, s, 99) * 2)
        const bookH = 4 + Math.floor(seededRandom(bx, s, 88) * 2)
        const bookColors = [0x8b2252, 0x225588, 0x228b22, 0xcd8500, 0x8b0000, 0x4a4a8b, 0x6a3a6a, 0x2a6a8a]
        const color = bookColors[Math.floor(seededRandom(bx, s, 77) * bookColors.length)]
        const [r, g, b] = colorToRGB(color)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(bx, sy + (5 - bookH), bookW, bookH)
        // Spine highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(bx, sy + (5 - bookH), 1, bookH)
        // Title line on spine
        if (bookH >= 4) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.fillRect(bx, sy + (5 - bookH) + 1, bookW, 1)
        }
        // Leaning book (occasionally)
        if (seededRandom(bx, s, 66) > 0.85 && bx + bookW + 2 < w - 2) {
          ctx.fillStyle = `rgb(${clamp(r + 30)},${clamp(g + 20)},${clamp(b + 20)})`
          ctx.fillRect(bx + bookW, sy + 2, bookW, 3)
        }
        bx += bookW + 1
      }
      // Shelf plank
      ctx.fillStyle = '#222230'
      ctx.fillRect(0, sy + 5, w, 1)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, sy + 5, w, 1)
    }
    // Small decorative item on top shelf (tiny plant or bookend)
    if (shelfCount > 0) {
      ctx.fillStyle = '#228b22'
      ctx.fillRect(w - 4, 1, 2, 3)
      ctx.fillStyle = '#8b4513'
      ctx.fillRect(w - 4, 4, 2, 1)
    }
    drawShadow(ctx, 0, 0, w, h, 0.2)
  }

  private drawCoffeeMachine(T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#1a1a20'
    ctx.fillRect(2, 2, T - 4, T - 4)
    ctx.fillStyle = '#222230'
    ctx.fillRect(3, 3, T - 6, T - 6)
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(4, 1, T - 8, 4)
    ctx.fillStyle = 'rgba(80,120,180,0.15)'
    ctx.fillRect(5, 2, T - 10, 2)
    ctx.fillStyle = '#181820'
    ctx.fillRect(T / 2 - 1, 6, 2, 3)
    ctx.fillStyle = '#303038'
    ctx.fillRect(T / 2 - 2, 9, 4, 4)
    ctx.fillStyle = '#2a2a30'
    ctx.fillRect(T / 2 - 1, 10, 2, 2)
    ctx.fillStyle = '#2a1a14'
    ctx.fillRect(T / 2 - 1, 10, 2, 1)
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(T - 4, 4, 1, 1)
    drawShadow(ctx, 2, 2, T - 4, T - 2, 0.2)
  }

  private drawWaterCooler(_T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#2a3844'
    ctx.fillRect(4, 0, 8, 6)
    ctx.fillStyle = 'rgba(100,150,200,0.12)'
    ctx.fillRect(5, 1, 2, 4)
    ctx.fillStyle = '#223040'
    ctx.fillRect(5, 5, 6, 2)
    ctx.fillStyle = '#2a2a34'
    ctx.fillRect(3, 7, 10, 7)
    ctx.fillStyle = '#303040'
    ctx.fillRect(4, 8, 8, 5)
    ctx.fillStyle = '#3366aa'
    ctx.fillRect(5, 10, 2, 2)
    ctx.fillStyle = '#aa3333'
    ctx.fillRect(9, 10, 2, 2)
    ctx.fillStyle = '#222230'
    ctx.fillRect(2, 14, 12, 2)
    drawShadow(ctx, 3, 7, 10, 9, 0.2)
  }

  private drawTrashCan(_T: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#1e1e26'
    ctx.fillRect(3, 4, 10, 10)
    ctx.fillStyle = '#24242e'
    ctx.fillRect(4, 5, 8, 8)
    ctx.fillStyle = '#222230'
    ctx.fillRect(2, 3, 12, 2)
    ctx.fillStyle = '#2a2a34'
    ctx.fillRect(6, 2, 4, 2)
    ctx.fillStyle = '#1a1a22'
    ctx.fillRect(3, 13, 10, 1)
    drawShadow(ctx, 3, 4, 10, 10, 0.2)
  }

  private drawProjectorScreen(w: number, h: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#2a2a34'
    ctx.fillRect(0, 0, w, 2)
    // Dark screen with glowing presentation
    ctx.fillStyle = '#0e0e1a'
    ctx.fillRect(1, 2, w - 2, h - 3)
    ctx.fillStyle = '#1a3366'
    ctx.fillRect(2, 3, w - 4, 4)
    ctx.fillStyle = '#226655'
    ctx.fillRect(3, 9, 3, 4)
    ctx.fillStyle = '#662244'
    ctx.fillRect(7, 8, 3, 5)
    ctx.fillStyle = '#446622'
    ctx.fillRect(11, 10, 3, 3)
    // Screen glow
    ctx.fillStyle = 'rgba(60,80,140,0.08)'
    ctx.fillRect(0, h, w, 3)
    ctx.fillStyle = '#222230'
    ctx.fillRect(0, 2, 1, h - 3)
    ctx.fillRect(w - 1, 2, 1, h - 3)
    ctx.fillRect(0, h - 1, w, 1)
  }

  private drawMeetingTable(w: number, h: number) {
    const ctx = this.ctx
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const noise = seededRandom(x, y, 44)
        const grain = Math.sin(x * 0.3 + noise) * 2
        ctx.fillStyle = `rgb(${clamp(34 + grain + noise * 3)},${clamp(32 + grain * 0.7 + noise * 2)},${clamp(38 + grain * 0.5 + noise * 2)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    ctx.fillStyle = '#1a1820'
    ctx.fillRect(0, 0, w, 1)
    ctx.fillRect(0, h - 1, w, 1)
    ctx.fillRect(0, 0, 1, h)
    ctx.fillRect(w - 1, 0, 1, h)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(1, 1, w - 2, 1)
    ctx.fillStyle = '#141218'
    ctx.fillRect(2, h - 1, 2, 2)
    ctx.fillRect(w - 4, h - 1, 2, 2)
    ctx.fillRect(2, 0, 2, -1)
    ctx.fillRect(w - 4, 0, 2, -1)
    drawShadow(ctx, 0, 0, w, h, 0.25)
  }

  private drawServerRack(T: number, ph: number) {
    const ctx = this.ctx
    // Rack body
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(1, 0, T - 2, ph)
    ctx.fillStyle = '#333'
    ctx.fillRect(2, 1, T - 4, ph - 2)
    // Server units
    for (let u = 0; u < Math.floor(ph / 5); u++) {
      const uy = 2 + u * 5
      ctx.fillStyle = '#444'
      ctx.fillRect(3, uy, T - 6, 4)
      // LED lights with glow
      const led1On = seededRandom(u, 0) > 0.3
      const led2On = seededRandom(u, 1) > 0.5
      // LED 1
      const led1Color = led1On ? '#00ff00' : '#ff4444'
      ctx.fillStyle = led1Color
      ctx.fillRect(4, uy + 1, 1, 1)
      // LED glow
      if (led1On) {
        ctx.fillStyle = 'rgba(0,255,0,0.15)'
        ctx.fillRect(3, uy, 3, 3)
      }
      // LED 2
      const led2Color = led2On ? '#00ff00' : '#ffaa00'
      ctx.fillStyle = led2Color
      ctx.fillRect(6, uy + 1, 1, 1)
      if (led2On) {
        ctx.fillStyle = 'rgba(0,255,0,0.12)'
        ctx.fillRect(5, uy, 3, 3)
      }
      // Activity LED (blinking effect via random)
      if (seededRandom(u, 2) > 0.4) {
        ctx.fillStyle = '#ffaa00'
        ctx.fillRect(8, uy + 1, 1, 1)
        ctx.fillStyle = 'rgba(255,170,0,0.1)'
        ctx.fillRect(7, uy, 3, 3)
      }
      // Vent holes
      ctx.fillStyle = '#333'
      for (let vx = 9; vx < T - 4; vx += 2) {
        ctx.fillRect(vx, uy + 1, 1, 2)
      }
    }
    // Overall rack glow from LEDs
    ctx.fillStyle = 'rgba(0,255,50,0.04)'
    ctx.fillRect(1, 0, T - 2, ph)
    drawShadow(ctx, 1, 0, T - 2, ph, 0.25)
  }

  private drawFilingCabinet(T: number, ph: number) {
    const ctx = this.ctx
    // Cabinet body (dark metal)
    ctx.fillStyle = '#222230'
    ctx.fillRect(1, 0, T - 2, ph)
    ctx.fillStyle = '#282838'
    ctx.fillRect(2, 0, T - 4, ph)
    const drawerCount = Math.floor(ph / 7)
    for (let d = 0; d < drawerCount; d++) {
      const dy = 1 + d * 7
      // Drawer face
      ctx.fillStyle = '#2a2a38'
      ctx.fillRect(2, dy, T - 4, 6)
      ctx.fillStyle = '#303040'
      ctx.fillRect(3, dy + 1, T - 6, 4)
      // Drawer edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(2, dy, T - 4, 1)
      // Handle (metallic)
      ctx.fillStyle = '#3a3a44'
      ctx.fillRect(T / 2 - 2, dy + 2, 4, 2)
      ctx.fillStyle = '#444450'
      ctx.fillRect(T / 2 - 1, dy + 2, 2, 1)
      // Label holder
      ctx.fillStyle = '#333340'
      ctx.fillRect(T / 2 - 3, dy + 4, 6, 2)
      ctx.fillStyle = '#3a3a48'
      ctx.fillRect(T / 2 - 2, dy + 4, 4, 1)
      // Paper sticking out of top drawer
      if (d === 0) {
        ctx.fillStyle = '#303038'
        ctx.fillRect(3, dy - 1, 4, 2)
        ctx.fillStyle = '#2a2a30'
        ctx.fillRect(4, dy - 1, 2, 1)
      }
    }
    // Top surface highlight
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(1, 0, T - 2, 1)
    // Keyhole on top drawer
    ctx.fillStyle = '#555'
    ctx.fillRect(T - 4, 3, 1, 2)
    drawShadow(ctx, 1, 0, T - 2, ph, 0.18)
  }

  private drawRug(w: number, h: number) {
    const ctx = this.ctx
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const noise = seededRandom(x, y, 66)
        const isBorder = x < 2 || x >= w - 2 || y < 2 || y >= h - 2
        const isInnerBorder = x >= 3 && x < w - 3 && y >= 3 && y < h - 3 &&
          (x === 3 || x === w - 4 || y === 3 || y === h - 4)
        if (isBorder) {
          ctx.fillStyle = `rgb(${clamp(30 + noise * 6)},${clamp(20 + noise * 5)},${clamp(35 + noise * 6)})`
        } else if (isInnerBorder) {
          ctx.fillStyle = `rgb(${clamp(40 + noise * 5)},${clamp(30 + noise * 4)},${clamp(45 + noise * 5)})`
        } else {
          const pattern = ((x + y) % 4 < 2) ? 6 : 0
          ctx.fillStyle = `rgb(${clamp(35 + pattern + noise * 5)},${clamp(25 + pattern + noise * 4)},${clamp(40 + pattern + noise * 5)})`
        }
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  private drawLamp(T: number) {
    const ctx = this.ctx
    // Base (dark metal, weighted)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(T / 2 - 4, T - 3, 8, 3)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(T / 2 - 3, T - 2, 6, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(T / 2 - 4, T - 3, 8, 1)
    // Arm (articulated joints)
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2, 5, 1, T - 8)
    ctx.fillStyle = '#666'
    ctx.fillRect(T / 2 - 1, 5, 1, T - 8)
    // Joint circles
    ctx.fillStyle = '#777'
    ctx.fillRect(T / 2 - 1, 8, 2, 2)
    // Lampshade (dark metal with cool highlight)
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(T / 2 - 4, 1, 8, 5)
    ctx.fillStyle = '#222230'
    ctx.fillRect(T / 2 - 3, 2, 6, 3)
    ctx.fillStyle = '#1a1a28'
    ctx.fillRect(T / 2 - 3, 4, 6, 1)
    // Shade top highlight
    ctx.fillStyle = '#333344'
    ctx.fillRect(T / 2 - 4, 1, 8, 1)
    // Shade inner (cool light)
    ctx.fillStyle = '#8090c0'
    ctx.fillRect(T / 2 - 2, 3, 4, 2)
    // Light bulb (inside shade)
    ctx.fillStyle = '#c0c8e0'
    ctx.fillRect(T / 2 - 1, 4, 2, 2)
    // Light cone (cool glow below shade, multi-layer)
    ctx.fillStyle = 'rgba(130,150,220,0.10)'
    ctx.beginPath()
    ctx.moveTo(T / 2 - 4, 6)
    ctx.lineTo(T / 2 + 4, 6)
    ctx.lineTo(T / 2 + 6, T - 3)
    ctx.lineTo(T / 2 - 6, T - 3)
    ctx.closePath()
    ctx.fill()
    // Inner brighter cone
    ctx.fillStyle = 'rgba(130,150,220,0.06)'
    ctx.fillRect(T / 2 - 2, 6, 4, T - 9)
    // Floor glow pool
    ctx.fillStyle = 'rgba(130,150,220,0.04)'
    ctx.fillRect(T / 2 - 5, T - 3, 10, 2)
    drawShadow(ctx, T / 2 - 3, T - 3, 6, 3, 0.12)
  }

  private drawCoatRack(T: number, ph: number) {
    const ctx = this.ctx
    // Base (cross-shaped feet)
    ctx.fillStyle = '#4a3a2a'
    ctx.fillRect(T / 2 - 4, ph - 2, 8, 2)
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(T / 2 - 1, ph - 3, 2, 1)
    // Main pole
    ctx.fillStyle = '#6a5a4a'
    ctx.fillRect(T / 2 - 1, 4, 2, ph - 6)
    ctx.fillStyle = '#7a6a5a'
    ctx.fillRect(T / 2, 4, 1, ph - 6)
    // Top knob
    ctx.fillStyle = '#8a7a6a'
    ctx.fillRect(T / 2 - 1, 2, 2, 3)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(T / 2 - 1, 2, 2, 1)
    // Hooks (4 pegs at different heights)
    ctx.fillStyle = '#5a4a3a'
    // Left hooks
    ctx.fillRect(T / 2 - 4, 5, 3, 1)
    ctx.fillRect(T / 2 - 4, 5, 1, 2)
    ctx.fillRect(T / 2 - 5, ph / 3, 4, 1)
    ctx.fillRect(T / 2 - 5, ph / 3, 1, 2)
    // Right hooks
    ctx.fillRect(T / 2 + 1, 6, 3, 1)
    ctx.fillRect(T / 2 + 3, 6, 1, 2)
    ctx.fillRect(T / 2 + 1, ph / 3 + 1, 4, 1)
    ctx.fillRect(T / 2 + 4, ph / 3 + 1, 1, 2)
    // Hanging coat (dark jacket on left hook)
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(T / 2 - 6, 7, 4, 8)
    ctx.fillStyle = '#333348'
    ctx.fillRect(T / 2 - 5, 8, 2, 6)
    // Hanging scarf on right hook
    ctx.fillStyle = '#cc4444'
    ctx.fillRect(T / 2 + 2, 8, 2, 5)
    ctx.fillStyle = '#dd5555'
    ctx.fillRect(T / 2 + 2, 8, 1, 4)
    // Hat on top
    ctx.fillStyle = '#3a3a4a'
    ctx.fillRect(T / 2 - 3, 1, 6, 2)
    ctx.fillStyle = '#4a4a5a'
    ctx.fillRect(T / 2 - 2, 0, 4, 2)
    drawShadow(ctx, T / 2 - 4, ph - 2, 8, 2, 0.15)
  }

  private drawCoffeeCup(T: number) {
    const ctx = this.ctx
    // Saucer
    ctx.fillStyle = '#ddd'
    ctx.fillRect(2, T - 4, T - 4, 3)
    ctx.fillStyle = '#eee'
    ctx.fillRect(3, T - 4, T - 6, 1)
    // Cup body
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(4, T - 10, T - 8, 7)
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(5, T - 9, T - 10, 5)
    // Coffee inside (visible from top)
    ctx.fillStyle = '#4a2a1a'
    ctx.fillRect(5, T - 10, T - 10, 2)
    ctx.fillStyle = '#5a3a2a'
    ctx.fillRect(6, T - 10, T - 12, 1)
    // Handle
    ctx.fillStyle = '#ddd'
    ctx.fillRect(T - 4, T - 9, 2, 5)
    ctx.fillRect(T - 3, T - 8, 2, 3)
    ctx.fillStyle = '#eee'
    ctx.fillRect(T - 3, T - 9, 1, 1)
    // Steam wisps (3 curls)
    ctx.fillStyle = 'rgba(200,200,220,0.35)'
    ctx.fillRect(5, T - 13, 1, 2)
    ctx.fillRect(6, T - 14, 1, 2)
    ctx.fillStyle = 'rgba(200,200,220,0.25)'
    ctx.fillRect(8, T - 14, 1, 3)
    ctx.fillRect(7, T - 15, 1, 2)
    ctx.fillStyle = 'rgba(200,200,220,0.2)'
    ctx.fillRect(T / 2, T - 13, 1, 2)
    ctx.fillRect(T / 2 + 1, T - 15, 1, 2)
    // Cup highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(4, T - 10, 1, 6)
    drawShadow(ctx, 3, T - 10, T - 6, 9, 0.12)
  }

  private drawDeskFigurine(T: number) {
    const ctx = this.ctx
    // Base
    ctx.fillStyle = '#333'
    ctx.fillRect(T / 2 - 3, T - 3, 6, 3)
    // Body
    const bodyColor = seededRandom(T, 5) > 0.5 ? '#cc4444' : '#4488cc'
    ctx.fillStyle = bodyColor
    ctx.fillRect(T / 2 - 2, T - 9, 4, 6)
    // Head
    ctx.fillStyle = '#ffccaa'
    ctx.fillRect(T / 2 - 2, T - 13, 4, 4)
    // Eyes
    ctx.fillStyle = '#222'
    ctx.fillRect(T / 2 - 1, T - 12, 1, 1)
    ctx.fillRect(T / 2 + 1, T - 12, 1, 1)
    // Hair
    ctx.fillStyle = '#442200'
    ctx.fillRect(T / 2 - 2, T - 14, 4, 2)
    drawShadow(ctx, T / 2 - 3, T - 3, 6, 3, 0.12)
  }

  private drawDeskPhotoFrame(T: number) {
    const ctx = this.ctx
    // Frame
    ctx.fillStyle = '#8b6f47'
    ctx.fillRect(T / 2 - 5, T / 2 - 5, 10, 10)
    ctx.fillStyle = '#a08060'
    ctx.fillRect(T / 2 - 4, T / 2 - 4, 8, 8)
    // Photo
    ctx.fillStyle = '#5588cc'
    ctx.fillRect(T / 2 - 3, T / 2 - 3, 6, 3)
    ctx.fillStyle = '#44aa44'
    ctx.fillRect(T / 2 - 3, T / 2, 6, 3)
    // Silhouette
    ctx.fillStyle = '#333'
    ctx.fillRect(T / 2 - 1, T / 2 - 2, 2, 3)
    // Stand
    ctx.fillStyle = '#7a5f37'
    ctx.fillRect(T / 2 - 1, T / 2 + 5, 2, 2)
    drawShadow(ctx, T / 2 - 5, T / 2 - 5, 10, 12, 0.1)
  }

  private drawDeskStickyNotes(T: number) {
    const ctx = this.ctx
    // Yellow note
    ctx.fillStyle = '#ffee44'
    ctx.fillRect(2, 2, T - 6, T - 6)
    ctx.fillStyle = '#eedd33'
    ctx.fillRect(2, 2, T - 6, 2)
    // Lines
    ctx.fillStyle = '#888'
    ctx.fillRect(3, 5, T - 9, 1)
    ctx.fillRect(3, 7, T - 11, 1)
    ctx.fillRect(3, 9, T - 10, 1)
    // Pink note (offset)
    ctx.fillStyle = '#ffaacc'
    ctx.fillRect(5, 5, T - 6, T - 6)
    ctx.fillStyle = '#ee99bb'
    ctx.fillRect(5, 5, T - 6, 2)
    // Line on pink
    ctx.fillStyle = '#888'
    ctx.fillRect(6, 8, T - 10, 1)
    ctx.fillRect(6, 10, T - 12, 1)
  }

  private drawDeskEnergyDrink(T: number) {
    const ctx = this.ctx
    // Can
    ctx.fillStyle = '#1a4a8a'
    ctx.fillRect(T / 2 - 3, 2, 6, T - 4)
    ctx.fillStyle = '#2a5a9a'
    ctx.fillRect(T / 2 - 2, 3, 4, 4)
    // Label
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(T / 2 - 2, 7, 4, 3)
    // Top
    ctx.fillStyle = '#aaa'
    ctx.fillRect(T / 2 - 3, 2, 6, 2)
    ctx.fillStyle = '#999'
    ctx.fillRect(T / 2 - 1, 1, 2, 2)
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(T / 2 - 3, 2, 1, T - 4)
    drawShadow(ctx, T / 2 - 3, 2, 6, T - 4, 0.12)
  }

  private drawDeskSnack(T: number) {
    const ctx = this.ctx
    // Wrapper (crinkled bag)
    ctx.fillStyle = '#cc6600'
    ctx.fillRect(2, 2, T - 4, T - 4)
    ctx.fillStyle = '#dd7700'
    ctx.fillRect(3, 3, T - 6, T / 2 - 2)
    // Logo
    ctx.fillStyle = '#fff'
    ctx.fillRect(T / 2 - 2, 4, 4, 3)
    // Crinkled top
    ctx.fillStyle = '#bb5500'
    ctx.fillRect(3, 2, T - 6, 2)
    // Crumbs
    ctx.fillStyle = '#aa5500'
    ctx.fillRect(T - 3, T - 4, 1, 1)
    ctx.fillRect(T - 5, T - 3, 1, 1)
    drawShadow(ctx, 2, 2, T - 4, T - 4, 0.1)
  }

  private drawDeskStressBall(T: number) {
    const ctx = this.ctx
    const isRed = seededRandom(T, 9) > 0.5
    const main = isRed ? '#ff4466' : '#44aaff'
    const dark = isRed ? '#cc2244' : '#2288dd'
    // Ball shape
    ctx.fillStyle = main
    ctx.fillRect(T / 2 - 4, T / 2 - 3, 8, 6)
    ctx.fillRect(T / 2 - 3, T / 2 - 4, 6, 8)
    ctx.fillRect(T / 2 - 5, T / 2 - 2, 10, 4)
    // Shading
    ctx.fillStyle = dark
    ctx.fillRect(T / 2 - 2, T / 2 + 1, 5, 3)
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillRect(T / 2 - 3, T / 2 - 3, 3, 2)
    // Smiley
    ctx.fillStyle = '#fff'
    ctx.fillRect(T / 2 - 2, T / 2 - 2, 1, 1)
    ctx.fillRect(T / 2 + 1, T / 2 - 2, 1, 1)
    ctx.fillRect(T / 2 - 2, T / 2, 4, 1)
    drawShadow(ctx, T / 2 - 5, T / 2 - 4, 10, 8, 0.1)
  }

  private drawLedStrip(w: number, h: number) {
    const ctx = this.ctx
    // Thin LED strip fixture (mounted under desk edge or along wall base)
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, w, h)
    // LED colors cycling along the strip (cool tones for dark aesthetic)
    const ledColors = [
      [60, 100, 255],  // blue
      [180, 50, 255],  // purple
      [0, 200, 255],   // cyan
      [255, 50, 180],  // magenta
      [100, 60, 255],  // indigo
    ]
    const segW = Math.max(2, Math.floor(w / ledColors.length))
    for (let i = 0; i < ledColors.length; i++) {
      const [r, g, b] = ledColors[i]
      const sx = i * segW
      // LED pixel
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(sx, 0, segW, h)
      // Bright center line
      ctx.fillStyle = `rgba(255,255,255,0.25)`
      ctx.fillRect(sx, Math.floor(h / 2), segW, 1)
      // Enhanced glow spill below
      ctx.fillStyle = `rgba(${r},${g},${b},0.20)`
      ctx.fillRect(sx - 1, h, segW + 2, 4)
      ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
      ctx.fillRect(sx - 2, h + 4, segW + 4, 3)
    }
  }

  private drawPcTower(T: number, ph: number) {
    const ctx = this.ctx
    // Case body (dark metal)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(2, 1, T - 4, ph - 2)
    ctx.fillStyle = '#222'
    ctx.fillRect(3, 2, T - 6, ph - 4)
    // Front panel
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(3, 2, T - 6, ph - 4)
    // Power button with glow ring
    ctx.fillStyle = '#00ff44'
    ctx.fillRect(T / 2 - 1, 3, 2, 2)
    ctx.fillStyle = 'rgba(0,255,68,0.20)'
    ctx.fillRect(T / 2 - 2, 2, 4, 4)
    // Drive bay
    ctx.fillStyle = '#333'
    ctx.fillRect(4, 6, T - 8, 3)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(5, 7, T - 10, 1)
    // USB ports
    ctx.fillStyle = '#444'
    ctx.fillRect(4, 10, 2, 1)
    ctx.fillRect(7, 10, 2, 1)
    // Vent grille
    ctx.fillStyle = '#1a1a1a'
    for (let vy = ph - 10; vy < ph - 3; vy += 2) {
      ctx.fillRect(4, vy, T - 8, 1)
    }
    // Tempered glass side panel — visible internal RGB
    const rgbColors: [number, number, number][] = [
      [255, 0, 102],   // hot pink
      [0, 255, 136],   // neon green
      [102, 68, 255],  // purple
      [255, 102, 0],   // orange
      [0, 180, 255],   // cyan
    ]
    const rgbIdx = Math.floor(seededRandom(T, ph, 42) * rgbColors.length)
    const [rr, rg, rb] = rgbColors[rgbIdx]
    // Glass panel tint
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.06)`
    ctx.fillRect(3, 3, T - 6, ph - 6)
    // Internal RGB fan glow (top and bottom)
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.35)`
    ctx.fillRect(4, ph - 8, 3, 3) // bottom fan
    ctx.fillRect(4, 4, 3, 3) // top fan
    // Fan blade hint
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.55)`
    ctx.fillRect(5, ph - 7, 1, 1)
    ctx.fillRect(5, 5, 1, 1)
    // RGB strip on right edge
    ctx.fillStyle = `rgb(${rr},${rg},${rb})`
    ctx.fillRect(T - 3, 4, 1, ph - 8)
    // Side panel glow spill
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.15)`
    ctx.fillRect(T - 4, 3, 3, ph - 6)
    // Ambient glow on floor
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.08)`
    ctx.fillRect(0, ph - 1, T, 2)
    // Case highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(2, 1, T - 4, 1)
    // Case edge lines
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(2, 1, 1, ph - 2)
    drawShadow(ctx, 2, 1, T - 4, ph - 2, 0.2)
  }

  private drawHeadphoneStand(T: number) {
    const ctx = this.ctx
    // Base (weighted metal)
    ctx.fillStyle = '#333'
    ctx.fillRect(T / 2 - 4, T - 3, 8, 3)
    ctx.fillStyle = '#444'
    ctx.fillRect(T / 2 - 3, T - 2, 6, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(T / 2 - 4, T - 3, 8, 1)
    // Vertical pole
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2 - 1, 4, 2, T - 7)
    ctx.fillStyle = '#666'
    ctx.fillRect(T / 2, 4, 1, T - 7)
    // Top hook (curved)
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2 - 3, 2, 6, 2)
    ctx.fillRect(T / 2 - 3, 2, 2, 4)
    ctx.fillRect(T / 2 + 1, 2, 2, 4)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(T / 2 - 3, 2, 6, 1)
    // Headphones draped over stand
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(T / 2 - 5, 1, 10, 2)
    // Left ear cup
    ctx.fillStyle = '#333348'
    ctx.fillRect(T / 2 - 6, 3, 4, 5)
    ctx.fillStyle = '#444458'
    ctx.fillRect(T / 2 - 5, 4, 2, 3)
    // Right ear cup
    ctx.fillStyle = '#333348'
    ctx.fillRect(T / 2 + 2, 3, 4, 5)
    ctx.fillStyle = '#444458'
    ctx.fillRect(T / 2 + 3, 4, 2, 3)
    drawShadow(ctx, T / 2 - 4, T - 3, 8, 3, 0.12)
  }

  private drawDeskLamp(T: number) {
    const ctx = this.ctx
    // Base (round, heavy)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(T / 2 - 3, T - 3, 6, 3)
    ctx.fillStyle = '#333'
    ctx.fillRect(T / 2 - 2, T - 2, 4, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(T / 2 - 3, T - 3, 6, 1)
    // Articulated arm
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2, 6, 1, T - 9)
    ctx.fillStyle = '#666'
    ctx.fillRect(T / 2 - 1, 6, 1, T - 9)
    // Joint
    ctx.fillStyle = '#777'
    ctx.fillRect(T / 2 - 1, 9, 2, 2)
    // Head (modern flat)
    ctx.fillStyle = '#444'
    ctx.fillRect(T / 2 - 4, 2, 8, 4)
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2 - 3, 3, 6, 2)
    // LED strip (cool white)
    ctx.fillStyle = '#b0c0e8'
    ctx.fillRect(T / 2 - 3, 5, 6, 1)
    // Light cone (cool)
    ctx.fillStyle = 'rgba(130,150,220,0.08)'
    ctx.fillRect(T / 2 - 5, 6, 10, T - 9)
    ctx.fillStyle = 'rgba(130,150,220,0.05)'
    ctx.fillRect(T / 2 - 3, 6, 6, T - 9)
    drawShadow(ctx, T / 2 - 3, T - 3, 6, 3, 0.1)
  }

  private drawCableManagement(w: number, _h: number) {
    const ctx = this.ctx
    // Cable tray (under-desk style)
    ctx.fillStyle = '#333'
    ctx.fillRect(1, 2, w - 2, 4)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(2, 3, w - 4, 2)
    // Bundled cables
    const cableColors = ['#222', '#444', '#2a2a4a', '#4a2a2a', '#2a4a2a']
    for (let i = 0; i < Math.min(5, w - 4); i++) {
      ctx.fillStyle = cableColors[i % cableColors.length]
      const cx = 3 + i * Math.floor((w - 6) / 5)
      ctx.fillRect(cx, 3, 2, 2)
    }
    // Velcro straps
    ctx.fillStyle = '#555'
    ctx.fillRect(Math.floor(w * 0.25), 2, 1, 4)
    ctx.fillRect(Math.floor(w * 0.75), 2, 1, 4)
    // Power strip (dark)
    ctx.fillStyle = '#2a2a30'
    ctx.fillRect(2, 7, w - 4, 3)
    ctx.fillStyle = '#333340'
    ctx.fillRect(3, 8, w - 6, 1)
    // Outlet slots
    ctx.fillStyle = '#333'
    for (let ox = 4; ox < w - 4; ox += 3) {
      ctx.fillRect(ox, 8, 1, 1)
    }
    // Power LED
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(w - 4, 8, 1, 1)
    drawShadow(ctx, 1, 2, w - 2, 8, 0.1)
  }

  private drawGamingChair(T: number) {
    const ctx = this.ctx
    // Pick a random accent color per chair
    const accents: [number, number, number][] = [
      [204, 34, 68],   // red
      [0, 180, 255],   // cyan
      [180, 0, 255],   // purple
      [255, 140, 0],   // orange
      [0, 220, 120],   // green
    ]
    const accentIdx = Math.floor(seededRandom(T, 77, 33) * accents.length)
    const [ar, ag, ab] = accents[accentIdx]
    const accentHex = `rgb(${ar},${ag},${ab})`

    // Chair back (tall, racing-style with wings)
    ctx.fillStyle = '#1a1a2a'
    ctx.fillRect(2, 0, T - 4, 7)
    ctx.fillStyle = '#222238'
    ctx.fillRect(3, 1, T - 6, 5)
    // Racing stripes (accent color)
    ctx.fillStyle = accentHex
    ctx.fillRect(4, 1, 2, 5)
    ctx.fillRect(T - 6, 1, 2, 5)
    // Center spine detail
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.3)`
    ctx.fillRect(T / 2 - 1, 1, 2, 5)
    // Head pillow with stitching
    ctx.fillStyle = '#333348'
    ctx.fillRect(T / 2 - 2, 0, 4, 2)
    ctx.fillStyle = '#444458'
    ctx.fillRect(T / 2 - 1, 0, 2, 1)
    // Stitch line on pillow
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.4)`
    ctx.fillRect(T / 2 - 2, 1, 4, 1)
    // Wing sides
    ctx.fillStyle = '#151528'
    ctx.fillRect(1, 1, 2, 5)
    ctx.fillRect(T - 3, 1, 2, 5)
    // Seat cushion
    ctx.fillStyle = '#222238'
    ctx.fillRect(2, 7, T - 4, 4)
    ctx.fillStyle = '#2a2a42'
    ctx.fillRect(3, 7, T - 6, 3)
    // Seat accent trim
    ctx.fillStyle = accentHex
    ctx.fillRect(2, 7, T - 4, 1)
    // Lumbar pillow
    ctx.fillStyle = '#333348'
    ctx.fillRect(4, 5, T - 8, 2)
    // Armrests (4D adjustable) with accent pads
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 6, 3, 5)
    ctx.fillRect(T - 3, 6, 3, 5)
    ctx.fillStyle = '#444'
    ctx.fillRect(0, 6, 3, 1)
    ctx.fillRect(T - 3, 6, 3, 1)
    // Armrest accent pads
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.5)`
    ctx.fillRect(0, 7, 3, 1)
    ctx.fillRect(T - 3, 7, 3, 1)
    // Gas lift cylinder (chrome)
    ctx.fillStyle = '#555'
    ctx.fillRect(T / 2 - 1, 11, 2, 2)
    ctx.fillStyle = '#666'
    ctx.fillRect(T / 2, 11, 1, 2)
    // Star base with wheels
    ctx.fillStyle = '#222'
    ctx.fillRect(T / 2 - 6, 13, 12, 2)
    ctx.fillStyle = '#333'
    ctx.fillRect(1, 14, 3, 2)
    ctx.fillRect(T / 2 - 2, 14, 4, 2)
    ctx.fillRect(T - 4, 14, 3, 2)
    // Wheel detail
    ctx.fillStyle = '#444'
    ctx.fillRect(2, 15, 1, 1)
    ctx.fillRect(T / 2 - 1, 15, 2, 1)
    ctx.fillRect(T - 3, 15, 1, 1)
    drawShadow(ctx, 2, 7, T - 4, 8, 0.15)
  }

  private drawDualMonitor(pw: number, _ph: number) {
    const ctx = this.ctx
    const monW = Math.floor((pw - 4) / 2)
    const monH = Math.floor(monW * 0.7)
    // Monitor arm mount (center)
    ctx.fillStyle = '#333'
    ctx.fillRect(pw / 2 - 2, monH + 2, 4, 3)
    ctx.fillRect(pw / 2 - 1, monH + 4, 2, 2)
    // Arm base clamp
    ctx.fillStyle = '#444'
    ctx.fillRect(pw / 2 - 3, monH + 5, 6, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(pw / 2 - 3, monH + 5, 6, 1)
    // Left monitor
    this.drawMiniMonitor(ctx, 0, 1, monW, monH, 0)
    // Right monitor
    this.drawMiniMonitor(ctx, monW + 3, 1, monW, monH, 1)
    // Monitor arms
    ctx.fillStyle = '#444'
    ctx.fillRect(monW / 2, monH + 1, pw / 2 - monW / 2, 2)
    ctx.fillRect(monW + 3 + monW / 2, monH + 1, pw / 2 - monW / 2 - 3, 2)
    drawShadow(ctx, 0, 0, pw, monH + 7, 0.12)
  }

  private drawTripleMonitor(pw: number, _ph: number) {
    const ctx = this.ctx
    const monW = Math.floor((pw - 6) / 3)
    const monH = Math.floor(monW * 0.7)
    // Triple arm mount (heavy duty)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(pw / 2 - 3, monH + 2, 6, 3)
    ctx.fillStyle = '#333'
    ctx.fillRect(pw / 2 - 2, monH + 2, 4, 3)
    ctx.fillRect(pw / 2 - 1, monH + 4, 2, 2)
    ctx.fillStyle = '#444'
    ctx.fillRect(pw / 2 - 5, monH + 5, 10, 2)
    // Mount highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(pw / 2 - 5, monH + 5, 10, 1)
    // Left monitor (angled inward — slight offset)
    this.drawMiniMonitor(ctx, 0, 2, monW, monH, 0)
    // Angle shadow on left monitor (isometric cue)
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(monW - 1, 2, 1, monH)
    // Center monitor (primary, raised)
    this.drawMiniMonitor(ctx, monW + 3, 0, monW, monH, 1)
    // Right monitor (angled inward)
    this.drawMiniMonitor(ctx, (monW + 3) * 2, 2, monW, monH, 2)
    // Angle shadow on right monitor
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect((monW + 3) * 2, 2, 1, monH)
    // Arms connecting to mount
    ctx.fillStyle = '#444'
    ctx.fillRect(monW / 2, monH + 1, pw / 2 - monW / 2, 2)
    ctx.fillRect((monW + 3) * 2 + monW / 2, monH + 1, pw / 2 - monW / 2 - 6, 2)
    ctx.fillRect(pw / 2 - 1, monH, 2, 3)
    // Screen glow on desk (enhanced ambient light spill)
    ctx.fillStyle = 'rgba(100,80,200,0.12)'
    ctx.fillRect(0, monH + 7, pw, 3)
    ctx.fillStyle = 'rgba(100,80,200,0.06)'
    ctx.fillRect(-2, monH + 10, pw + 4, 3)
    drawShadow(ctx, 0, 0, pw, monH + 7, 0.15)
  }

  private drawMiniMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, idx: number) {
    // Pick glow color based on monitor index (purple/blue/cyan variety)
    const glowThemes = [
      { glow: [100, 80, 220], code: ['#8866cc', '#6688dd', '#aa77cc', '#7799ee', '#9966dd'] },
      { glow: [50, 150, 230], code: ['#44bbdd', '#66ccee', '#55aacc', '#77ddee', '#33aacc'] },
      { glow: [160, 50, 200], code: ['#bb55cc', '#cc77bb', '#9966dd', '#dd88cc', '#8855aa'] },
    ]
    const theme = glowThemes[idx % glowThemes.length]
    const [glR, glG, glB] = theme.glow
    // Bezel
    ctx.fillStyle = '#0a0a18'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#101020'
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
    // Screen
    ctx.fillStyle = '#080e22'
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
    // Code lines
    for (let ln = 0; ln < Math.floor((h - 6) / 2); ln++) {
      const indent = Math.floor(seededRandom(ln, idx, 10) * 2) * 2
      const lineW = 2 + seededRandom(ln, idx, 20) * (w - 10 - indent)
      ctx.fillStyle = theme.code[Math.floor(seededRandom(ln, idx, 30) * theme.code.length)]
      ctx.fillRect(x + 3 + indent, y + 3 + ln * 2, Math.floor(lineW), 1)
    }
    // Enhanced screen glow
    ctx.fillStyle = `rgba(${glR},${glG},${glB},0.18)`
    ctx.fillRect(x, y, w, h)
    // Glow spill below monitor
    ctx.fillStyle = `rgba(${glR},${glG},${glB},0.12)`
    ctx.fillRect(x - 1, y + h, w + 2, 3)
    ctx.fillStyle = `rgba(${glR},${glG},${glB},0.06)`
    ctx.fillRect(x - 2, y + h + 3, w + 4, 3)
    // Power LED
    ctx.fillStyle = '#00ff44'
    ctx.fillRect(x + w - 3, y + h - 2, 1, 1)
    // Bezel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(x + 1, y + 1, w - 2, 1)
  }

  destroy() {
    // No persistent graphics to clean up
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
