import Phaser from 'phaser'
import { AgentState } from '../../types'
import { THEME } from '../../constants'
import { CharacterSprite } from '../sprites/CharacterSprite'
import { CameraController } from '../CameraController'

const FOCUS_ZOOM = 2.0
const DIM_ALPHA = 0.25
const SPOTLIGHT_RADIUS = 48
const OVERLAY_WIDTH = 160
const OVERLAY_HEIGHT = 72

export class FocusSystem {
  private scene: Phaser.Scene
  private focusedAgentId: string | null = null
  private previousZoom = 1
  private characters: Map<string, CharacterSprite>
  private agentStates: Map<string, AgentState>
  private cameraController: CameraController

  // Spotlight overlay (dark mask with circular cutout)
  private spotlightGraphics: Phaser.GameObjects.Graphics | null = null

  // Detailed status overlay
  private overlayContainer: Phaser.GameObjects.Container | null = null
  private overlayBg!: Phaser.GameObjects.Rectangle
  private overlayName!: Phaser.GameObjects.Text
  private overlayRole!: Phaser.GameObjects.Text
  private overlayRig!: Phaser.GameObjects.Text
  private overlayStatus!: Phaser.GameObjects.Text
  private overlayTask!: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    characters: Map<string, CharacterSprite>,
    agentStates: Map<string, AgentState>,
    cameraController: CameraController,
  ) {
    this.scene = scene
    this.characters = characters
    this.agentStates = agentStates
    this.cameraController = cameraController

    this.createSpotlight()
    this.createOverlay()
  }

  private createSpotlight() {
    this.spotlightGraphics = this.scene.add.graphics()
    this.spotlightGraphics.setDepth(90)
    this.spotlightGraphics.setVisible(false)
    this.spotlightGraphics.setScrollFactor(0)
  }

  private createOverlay() {
    const bg = this.scene.add.rectangle(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT, 0x0e1119, 0.9)
    bg.setStrokeStyle(1.5, 0x64477d)
    bg.setOrigin(0, 0)
    this.overlayBg = bg

    const textStyle = {
      fontSize: '9px',
      fontFamily: THEME.fontFamily,
      stroke: '#000000',
      strokeThickness: 1,
    }

    this.overlayName = this.scene.add.text(8, 6, '', { ...textStyle, fontSize: '11px', color: THEME.gold })
    this.overlayRole = this.scene.add.text(8, 20, '', { ...textStyle, color: THEME.textSecondary })
    this.overlayRig = this.scene.add.text(8, 32, '', { ...textStyle, color: THEME.textSecondary })
    this.overlayStatus = this.scene.add.text(8, 44, '', { ...textStyle, color: THEME.green })
    this.overlayTask = this.scene.add.text(8, 56, '', { ...textStyle, color: THEME.textMuted })

    this.overlayContainer = this.scene.add.container(0, 0, [
      this.overlayBg,
      this.overlayName,
      this.overlayRole,
      this.overlayRig,
      this.overlayStatus,
      this.overlayTask,
    ])
    this.overlayContainer.setDepth(95)
    this.overlayContainer.setScrollFactor(0)
    this.overlayContainer.setVisible(false)
    this.overlayContainer.setAlpha(0)
  }

  focus(agentId: string) {
    if (this.focusedAgentId === agentId) {
      this.unfocus()
      return
    }

    // Store previous zoom before first focus
    if (!this.focusedAgentId) {
      this.previousZoom = this.scene.cameras.main.zoom
    }

    this.focusedAgentId = agentId

    // Smooth zoom to 2x
    this.cameraController.smoothZoomTo(FOCUS_ZOOM)

    // Dim non-focused agents
    for (const [id, char] of this.characters) {
      if (id === agentId) {
        char.container.setAlpha(1)
      } else {
        this.scene.tweens.add({
          targets: char.container,
          alpha: DIM_ALPHA,
          duration: 300,
          ease: 'Power2',
        })
      }
    }

    // Show spotlight
    if (this.spotlightGraphics) {
      this.spotlightGraphics.setVisible(true)
    }

    // Show overlay
    this.updateOverlay(agentId)
    if (this.overlayContainer) {
      this.overlayContainer.setVisible(true)
      this.scene.tweens.add({
        targets: this.overlayContainer,
        alpha: 1,
        duration: 300,
        ease: 'Power2',
      })
    }
  }

  unfocus() {
    if (!this.focusedAgentId) return

    this.focusedAgentId = null

    // Restore zoom
    this.cameraController.smoothZoomTo(this.previousZoom)

    // Restore all agent alphas
    for (const [id, char] of this.characters) {
      const state = this.agentStates.get(id)
      const targetAlpha = state?.status === 'offline' ? 0.4 : 1
      this.scene.tweens.add({
        targets: char.container,
        alpha: targetAlpha,
        duration: 300,
        ease: 'Power2',
      })
    }

    // Hide spotlight
    if (this.spotlightGraphics) {
      this.spotlightGraphics.setVisible(false)
    }

    // Hide overlay
    if (this.overlayContainer) {
      this.scene.tweens.add({
        targets: this.overlayContainer,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.overlayContainer?.setVisible(false)
        },
      })
    }
  }

  private updateOverlay(agentId: string) {
    const state = this.agentStates.get(agentId)
    if (!state) return

    const displayName = state.role === 'mayor' ? 'MAYOR' : state.name
    this.overlayName.setText(displayName)
    this.overlayRole.setText(`role: ${state.role}`)
    this.overlayRig.setText(`rig: ${state.rig}`)

    const statusColor = state.status === 'working' ? THEME.green
      : state.status === 'offline' ? THEME.red
      : THEME.orange
    this.overlayStatus.setColor(statusColor)
    this.overlayStatus.setText(`status: ${state.status}`)

    this.overlayTask.setText(state.task ? `task: ${state.task}` : 'task: --')
  }

  update(_delta: number) {
    if (!this.focusedAgentId) return

    const char = this.characters.get(this.focusedAgentId)
    if (!char) return

    // Update spotlight position (drawn relative to screen)
    this.drawSpotlight(char)

    // Position overlay in bottom-left of screen
    if (this.overlayContainer) {
      this.overlayContainer.setPosition(12, this.scene.cameras.main.height - OVERLAY_HEIGHT - 12)
    }

    // Update overlay data
    this.updateOverlay(this.focusedAgentId)
  }

  private drawSpotlight(char: CharacterSprite) {
    if (!this.spotlightGraphics) return

    const camera = this.scene.cameras.main
    const pos = char.getPosition()

    // Convert world position to screen position
    const screenX = (pos.x - camera.scrollX) * camera.zoom
    const screenY = (pos.y - camera.scrollY) * camera.zoom

    const w = camera.width
    const h = camera.height
    const r = SPOTLIGHT_RADIUS * camera.zoom

    this.spotlightGraphics.clear()

    // Dark overlay with gradient falloff around the agent
    this.spotlightGraphics.fillStyle(0x000000, 0.45)
    this.spotlightGraphics.fillRect(0, 0, w, h)

    // Cut out a bright circle using erase blendmode via alpha gradient rings
    // Draw concentric lighter rings to create spotlight falloff
    const steps = 8
    for (let i = steps; i >= 0; i--) {
      const frac = i / steps
      const ringR = r + (r * 0.8 * frac)
      const alpha = 0.45 * frac
      this.spotlightGraphics.fillStyle(0x000000, alpha)
      this.spotlightGraphics.fillCircle(screenX, screenY, ringR)
    }

    // Clear the center to show the agent fully
    this.spotlightGraphics.fillStyle(0x000000, 0)
    this.spotlightGraphics.fillCircle(screenX, screenY, r * 0.4)

    // Use a blend mode approach: draw the spotlight as a bright glow
    // Actually, Phaser graphics don't support erase easily. Let's use a
    // different approach: draw the dark overlay as a shape with a hole.
    this.spotlightGraphics.clear()

    // Outer dark region - use a path with hole
    this.spotlightGraphics.beginPath()
    // Outer rectangle (clockwise)
    this.spotlightGraphics.moveTo(0, 0)
    this.spotlightGraphics.lineTo(w, 0)
    this.spotlightGraphics.lineTo(w, h)
    this.spotlightGraphics.lineTo(0, h)
    this.spotlightGraphics.closePath()

    // Inner circle hole (counter-clockwise)
    const circleSteps = 32
    this.spotlightGraphics.moveTo(screenX + r, screenY)
    for (let i = circleSteps; i >= 0; i--) {
      const angle = (i / circleSteps) * Math.PI * 2
      this.spotlightGraphics.lineTo(
        screenX + Math.cos(angle) * r,
        screenY + Math.sin(angle) * r,
      )
    }
    this.spotlightGraphics.closePath()

    this.spotlightGraphics.fillStyle(0x000000, 0.45)
    this.spotlightGraphics.fillPath()

    // Soft glow ring around the spotlight edge
    this.spotlightGraphics.lineStyle(3, 0xffd700, 0.3)
    this.spotlightGraphics.strokeCircle(screenX, screenY, r)
    this.spotlightGraphics.lineStyle(1, 0xffd700, 0.15)
    this.spotlightGraphics.strokeCircle(screenX, screenY, r + 4)
  }

  isFocused(): boolean {
    return this.focusedAgentId !== null
  }

  getFocusedId(): string | null {
    return this.focusedAgentId
  }
}
