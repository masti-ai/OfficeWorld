import Phaser from 'phaser'
import { AgentActivity } from '../../types'

/**
 * Visual overlays for agent activities: typing, reading, bash, waiting, permission-needed.
 * Each agent gets a persistent overlay container positioned above their character.
 */

interface ActivityOverlay {
  container: Phaser.GameObjects.Container
  graphics: Phaser.GameObjects.Graphics
  activity: AgentActivity
  timer: number
  frame: number
  // Per-activity state
  terminalLines: string[]
  terminalScroll: number
  footTapPhase: number
  handRaiseY: number
  fingerTapTimer: number
  glowAlpha: number
  glowDir: number
  pageFlipTimer: number
  pageFrame: number
}

// Terminal green text lines (scrolling)
const TERMINAL_LINES = [
  '$ npm run build',
  'compiling...',
  'PASS src/index.ts',
  '$ git push origin',
  'Enumerating objects',
  'Writing objects: 100%',
  '$ grep -r "TODO"',
  'src/main.ts:42',
  '$ eslint --fix .',
  'All files pass',
  '$ cargo test',
  'running 12 tests',
  'test result: ok.',
  '$ docker compose up',
  'Container started',
  '$ python manage.py',
]

export class ActivityAnimationSystem {
  private scene: Phaser.Scene
  private overlays = new Map<string, ActivityOverlay>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Set or change the activity for an agent */
  setActivity(agentId: string, activity: AgentActivity, worldX: number, worldY: number) {
    const existing = this.overlays.get(agentId)

    if (existing && existing.activity === activity) {
      // Same activity, just update position
      existing.container.setPosition(worldX, worldY)
      return
    }

    // Remove old overlay
    if (existing) {
      existing.container.destroy()
      this.overlays.delete(agentId)
    }

    if (activity === 'none') return

    const graphics = this.scene.add.graphics()
    const container = this.scene.add.container(worldX, worldY, [graphics])
    container.setDepth(45) // Above characters, below particles

    const overlay: ActivityOverlay = {
      container,
      graphics,
      activity,
      timer: 0,
      frame: 0,
      terminalLines: this.pickTerminalLines(),
      terminalScroll: 0,
      footTapPhase: 0,
      handRaiseY: 0,
      fingerTapTimer: 0,
      glowAlpha: 0.15,
      glowDir: 1,
      pageFlipTimer: 0,
      pageFrame: 0,
    }

    this.overlays.set(agentId, overlay)
  }

  /** Update position for an agent (call each frame for moving agents) */
  updatePosition(agentId: string, worldX: number, worldY: number) {
    const overlay = this.overlays.get(agentId)
    if (overlay) {
      overlay.container.setPosition(worldX, worldY)
    }
  }

  /** Remove overlay for an agent */
  removeActivity(agentId: string) {
    const overlay = this.overlays.get(agentId)
    if (overlay) {
      overlay.container.destroy()
      this.overlays.delete(agentId)
    }
  }

  update(delta: number) {
    for (const [, overlay] of this.overlays) {
      overlay.timer += delta
      overlay.graphics.clear()

      switch (overlay.activity) {
        case 'typing':
          this.drawTypingActivity(overlay, delta)
          break
        case 'reading':
          this.drawReadingActivity(overlay, delta)
          break
        case 'bash':
          this.drawBashActivity(overlay, delta)
          break
        case 'waiting':
          this.drawWaitingActivity(overlay, delta)
          break
        case 'permission-needed':
          this.drawPermissionNeeded(overlay, delta)
          break
      }
    }
  }

  /** Typing: rapid finger tap indicators + enhanced screen glow pulse */
  private drawTypingActivity(overlay: ActivityOverlay, delta: number) {
    const gfx = overlay.graphics

    // Pulsing screen glow (brighter than the sprite's built-in glow)
    overlay.glowAlpha += overlay.glowDir * delta * 0.001
    if (overlay.glowAlpha > 0.35) { overlay.glowAlpha = 0.35; overlay.glowDir = -1 }
    if (overlay.glowAlpha < 0.08) { overlay.glowAlpha = 0.08; overlay.glowDir = 1 }

    // Screen glow cone projecting from below character (monitor position)
    gfx.fillStyle(0x64b4ff, overlay.glowAlpha)
    gfx.fillRect(-12, -4, 24, 14)
    gfx.fillStyle(0x64b4ff, overlay.glowAlpha * 0.5)
    gfx.fillRect(-16, 2, 32, 10)

    // Rapid finger tap sparks - tiny bright dots that pop out rapidly
    overlay.fingerTapTimer += delta
    if (overlay.fingerTapTimer > 80) { // Very rapid: every 80ms
      overlay.fingerTapTimer = 0
      overlay.frame = (overlay.frame + 1) % 6
    }

    const tapFrame = overlay.frame
    // Alternating left/right key-strike sparks
    const sparkColors = [0xaaccff, 0xffffff, 0x66ff99, 0xffcc44]
    const sparkColor = sparkColors[tapFrame % sparkColors.length]

    // Left finger tap spark
    if (tapFrame % 2 === 0) {
      gfx.fillStyle(sparkColor, 0.9)
      gfx.fillRect(-8 + (tapFrame % 3) * 2, 6, 2, 1)
      gfx.fillStyle(sparkColor, 0.5)
      gfx.fillRect(-8 + (tapFrame % 3) * 2, 5, 1, 1)
    }
    // Right finger tap spark
    if (tapFrame % 2 === 1) {
      gfx.fillStyle(sparkColor, 0.9)
      gfx.fillRect(4 + (tapFrame % 3) * 2, 6, 2, 1)
      gfx.fillStyle(sparkColor, 0.5)
      gfx.fillRect(5 + (tapFrame % 3) * 2, 5, 1, 1)
    }

    // Keyboard outline glow
    gfx.lineStyle(1, 0x4488cc, overlay.glowAlpha * 1.5)
    gfx.strokeRect(-10, 5, 20, 4)
  }

  /** Reading: animated page flip sprite with floating text particles */
  private drawReadingActivity(overlay: ActivityOverlay, delta: number) {
    const gfx = overlay.graphics

    overlay.pageFlipTimer += delta
    if (overlay.pageFlipTimer > 1200) { // Page flip every 1.2s
      overlay.pageFlipTimer = 0
      overlay.pageFrame = (overlay.pageFrame + 1) % 4
    }

    const pf = overlay.pageFrame

    // Book glow (warm reading light)
    gfx.fillStyle(0xffe8b0, 0.08 + (pf === 2 ? 0.04 : 0))
    gfx.fillRect(-14, -2, 28, 16)

    // Floating page fragment on flip frames
    if (pf === 2 || pf === 3) {
      const flyY = pf === 2 ? -8 : -14
      const flyX = pf === 2 ? 6 : 10
      const alpha = pf === 2 ? 0.7 : 0.3
      // Small page piece floating up
      gfx.fillStyle(0xf5f0e0, alpha)
      gfx.fillRect(flyX, flyY, 4, 3)
      gfx.fillStyle(0xd0c8b0, alpha)
      gfx.fillRect(flyX + 1, flyY + 1, 2, 1)
    }

    // Reading focus lines (subtle concentration marks near head)
    if (pf === 0 || pf === 1) {
      gfx.fillStyle(0xffffff, 0.15)
      gfx.fillRect(-14, -18, 2, 1)
      gfx.fillRect(-16, -16, 2, 1)
      gfx.fillRect(12, -18, 2, 1)
      gfx.fillRect(14, -16, 2, 1)
    }
  }

  /** Bash: terminal screen with green scrolling text + green pulse */
  private drawBashActivity(overlay: ActivityOverlay, delta: number) {
    const gfx = overlay.graphics

    // Terminal background (dark rectangle above character)
    const termX = -14
    const termY = -30
    const termW = 28
    const termH = 18

    // Terminal bezel
    gfx.fillStyle(0x222222, 0.95)
    gfx.fillRect(termX - 1, termY - 1, termW + 2, termH + 2)

    // Terminal screen
    gfx.fillStyle(0x0a1a0a, 0.92)
    gfx.fillRect(termX, termY, termW, termH)

    // Green pulse glow around terminal
    overlay.glowAlpha += overlay.glowDir * delta * 0.0008
    if (overlay.glowAlpha > 0.25) { overlay.glowAlpha = 0.25; overlay.glowDir = -1 }
    if (overlay.glowAlpha < 0.05) { overlay.glowAlpha = 0.05; overlay.glowDir = 1 }

    gfx.fillStyle(0x00ff44, overlay.glowAlpha)
    gfx.fillRect(termX - 2, termY - 2, termW + 4, termH + 4)

    // Green ambient glow on character
    gfx.fillStyle(0x00ff44, overlay.glowAlpha * 0.4)
    gfx.fillRect(-12, -10, 24, 20)

    // Scrolling text lines
    overlay.terminalScroll += delta * 0.003
    if (overlay.terminalScroll >= 1) {
      overlay.terminalScroll = 0
      overlay.frame = (overlay.frame + 1) % overlay.terminalLines.length
    }

    // Draw 4 lines of terminal text (as pixel-approximated green text)
    for (let i = 0; i < 4; i++) {
      const lineIdx = (overlay.frame + i) % overlay.terminalLines.length
      const line = overlay.terminalLines[lineIdx]
      const ly = termY + 2 + i * 4
      const brightness = i === 3 ? 1.0 : 0.5 + i * 0.15 // newest line brightest

      // Render each character as a small green pixel block
      for (let c = 0; c < Math.min(line.length, 12); c++) {
        if (line[c] === ' ') continue
        const isPrompt = line[c] === '$'
        const color = isPrompt ? 0x44ff88 : 0x00ff44
        const alpha = brightness * (isPrompt ? 1.0 : 0.7 + Math.random() * 0.3)
        gfx.fillStyle(color, alpha)
        gfx.fillRect(termX + 2 + c * 2, ly, 1, 2)
      }
    }

    // Cursor blink on bottom line
    const cursorOn = Math.floor(overlay.timer / 400) % 2 === 0
    if (cursorOn) {
      const lastLine = overlay.terminalLines[(overlay.frame + 3) % overlay.terminalLines.length]
      const cursorX = termX + 2 + Math.min(lastLine.length, 12) * 2 + 1
      gfx.fillStyle(0x00ff44, 0.9)
      gfx.fillRect(cursorX, termY + 14, 2, 2)
    }

    // Scanline effect
    for (let sy = 0; sy < termH; sy += 2) {
      gfx.fillStyle(0x000000, 0.1)
      gfx.fillRect(termX, termY + sy, termW, 1)
    }
  }

  /** Waiting: tapping foot animation + idle indicators */
  private drawWaitingActivity(overlay: ActivityOverlay, delta: number) {
    const gfx = overlay.graphics

    // Foot tapping cycle
    overlay.footTapPhase += delta * 0.004
    const tapCycle = Math.sin(overlay.footTapPhase * Math.PI * 2)
    const footUp = tapCycle > 0.3

    // Tapping foot indicator (small foot shape that lifts)
    const footY = footUp ? 18 : 20
    const footAlpha = 0.7

    // Left foot (tapping)
    gfx.fillStyle(0x1a1a2a, footAlpha)
    gfx.fillRect(-5, footY, 4, 2)
    // Tap impact mark when foot comes down
    if (!footUp && tapCycle < -0.5) {
      gfx.fillStyle(0xaaaaaa, 0.3)
      gfx.fillRect(-7, 21, 8, 1)
      // Small dust particles
      gfx.fillStyle(0xccccaa, 0.2)
      gfx.fillRect(-8, 19, 1, 1)
      gfx.fillRect(4, 20, 1, 1)
    }

    // Impatience indicators: "..." thought dots that pulse
    const dotPhase = Math.floor(overlay.timer / 500) % 4
    const dotY = -22

    // Small thought cloud
    gfx.fillStyle(0xffffff, 0.6)
    gfx.fillRect(-6, dotY, 12, 6)
    gfx.fillRect(-7, dotY + 1, 14, 4)

    // Border
    gfx.fillStyle(0xaaaaaa, 0.4)
    gfx.fillRect(-6, dotY, 12, 1)
    gfx.fillRect(-6, dotY + 5, 12, 1)
    gfx.fillRect(-7, dotY + 1, 1, 4)
    gfx.fillRect(6, dotY + 1, 1, 4)

    // Animated dots
    const dotColors = [0x888888, 0x666666]
    for (let d = 0; d < 3; d++) {
      const visible = d < dotPhase
      if (visible) {
        gfx.fillStyle(dotColors[d % 2], 0.8)
        gfx.fillRect(-4 + d * 4, dotY + 2, 2, 2)
      }
    }

    // Tail from thought cloud to head
    gfx.fillStyle(0xffffff, 0.4)
    gfx.fillRect(-2, dotY + 6, 2, 1)
    gfx.fillRect(-1, dotY + 7, 1, 1)

    // Clock/timer icon (tiny)
    const clockPhase = Math.floor(overlay.timer / 250) % 8
    gfx.fillStyle(0xffaa00, 0.5)
    gfx.fillCircle(10, dotY + 3, 3)
    gfx.fillStyle(0x0a1a0a, 0.7)
    gfx.fillCircle(10, dotY + 3, 2)
    // Clock hands
    gfx.fillStyle(0xffaa00, 0.8)
    gfx.fillRect(10, dotY + 2, 1, 2) // minute hand
    const hourAngle = (clockPhase / 8) * Math.PI * 2
    gfx.fillRect(10 + Math.round(Math.cos(hourAngle)), dotY + 3 + Math.round(Math.sin(hourAngle)), 1, 1)
  }

  /** Permission-needed: raised hand + exclamation mark */
  private drawPermissionNeeded(overlay: ActivityOverlay, _delta: number) {
    const gfx = overlay.graphics

    // Raised hand animation (oscillating up/down)
    overlay.handRaiseY = Math.sin(overlay.timer * 0.003) * 2

    const handX = 12
    const handY = -24 + overlay.handRaiseY

    // Arm extending up
    gfx.fillStyle(0xe8b88a, 0.9) // skin tone
    gfx.fillRect(handX, handY + 8, 3, 6)

    // Sleeve
    gfx.fillStyle(0x607d8b, 0.8)
    gfx.fillRect(handX - 1, handY + 12, 5, 3)

    // Open hand (palm facing forward)
    gfx.fillStyle(0xe8b88a, 0.95)
    // Palm
    gfx.fillRect(handX - 1, handY + 2, 5, 6)
    // Fingers
    gfx.fillRect(handX - 2, handY, 2, 4) // pinky+ring
    gfx.fillRect(handX, handY - 1, 2, 3) // middle
    gfx.fillRect(handX + 2, handY, 2, 4) // index
    gfx.fillRect(handX + 4, handY + 3, 2, 3) // thumb

    // Finger lines (darker skin tone)
    gfx.fillStyle(0xd4956b, 0.5)
    gfx.fillRect(handX - 1, handY + 1, 1, 1)
    gfx.fillRect(handX + 1, handY, 1, 1)
    gfx.fillRect(handX + 3, handY + 1, 1, 1)

    // Exclamation mark (flashing)
    const flash = Math.floor(overlay.timer / 300) % 3
    const exclX = -8
    const exclY = -32 + overlay.handRaiseY * 0.5

    // Burst background
    if (flash < 2) {
      gfx.fillStyle(0xffdd33, 0.25)
      gfx.fillRect(exclX - 4, exclY - 2, 12, 16)
      gfx.fillRect(exclX - 2, exclY - 4, 8, 20)
    }

    // "!" mark body
    const exclColor = flash === 0 ? 0xff4444 : flash === 1 ? 0xff6644 : 0xff4444
    gfx.fillStyle(exclColor, 0.95)
    // Vertical bar
    gfx.fillRect(exclX, exclY, 4, 8)
    gfx.fillRect(exclX - 1, exclY + 1, 6, 6)
    // Dot
    gfx.fillRect(exclX, exclY + 10, 4, 3)

    // "!" outline
    gfx.fillStyle(0xaa2222, 0.7)
    gfx.fillRect(exclX - 1, exclY, 1, 1)
    gfx.fillRect(exclX + 4, exclY, 1, 1)
    gfx.fillRect(exclX - 1, exclY + 7, 1, 1)
    gfx.fillRect(exclX + 4, exclY + 7, 1, 1)

    // "!" highlight
    gfx.fillStyle(0xffaaaa, 0.6)
    gfx.fillRect(exclX, exclY, 1, 1)
    gfx.fillRect(exclX, exclY + 10, 1, 1)

    // Urgency ripple rings (expanding)
    const ripplePhase = (overlay.timer % 1500) / 1500
    const rippleRadius = 8 + ripplePhase * 12
    const rippleAlpha = 0.3 * (1 - ripplePhase)
    gfx.lineStyle(1, 0xff4444, rippleAlpha)
    gfx.strokeCircle(2, -18, rippleRadius)
  }

  private pickTerminalLines(): string[] {
    // Shuffle and pick a subset
    const shuffled = [...TERMINAL_LINES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 8)
  }

  destroy() {
    for (const [, overlay] of this.overlays) {
      overlay.container.destroy()
    }
    this.overlays.clear()
  }
}
