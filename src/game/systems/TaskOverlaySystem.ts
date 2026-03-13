import Phaser from 'phaser'
import { AgentState, AgentHookBead } from '../../types'
import { CharacterSprite } from '../sprites/CharacterSprite'

const OVERLAY_Y_OFFSET = -32
const BADGE_PADDING_X = 6
const BADGE_HEIGHT = 12
const DETAIL_WIDTH = 160
const DETAIL_HEIGHT = 48

const STATUS_BADGE_COLORS: Record<string, number> = {
  open: 0x3388ff,
  in_progress: 0x22aa44,
  hooked: 0xffaa00,
  blocked: 0xe94560,
  done: 0x888888,
}

interface TaskOverlay {
  container: Phaser.GameObjects.Container
  badgeBg: Phaser.GameObjects.Rectangle
  beadIdText: Phaser.GameObjects.Text
  statusBg: Phaser.GameObjects.Rectangle
  statusText: Phaser.GameObjects.Text
  detailPanel: Phaser.GameObjects.Container | null
  expanded: boolean
  currentBeadId: string | null
}

export class TaskOverlaySystem {
  private scene: Phaser.Scene
  private overlays = new Map<string, TaskOverlay>()
  private characters: Map<string, CharacterSprite>

  constructor(scene: Phaser.Scene, characters: Map<string, CharacterSprite>) {
    this.scene = scene
    this.characters = characters
  }

  /** Set or update the hook bead for an agent. Pass null to clear. */
  setHookBead(agentId: string, bead: AgentHookBead | null | undefined) {
    if (!bead) {
      this.removeOverlay(agentId)
      return
    }

    let overlay = this.overlays.get(agentId)
    if (!overlay) {
      overlay = this.createOverlay(agentId)
      this.overlays.set(agentId, overlay)
    }

    if (overlay.currentBeadId !== bead.id) {
      overlay.currentBeadId = bead.id
      this.updateOverlayContent(overlay, bead)
    }
  }

  private createOverlay(agentId: string): TaskOverlay {
    // Bead ID badge
    const beadIdText = this.scene.add.text(0, 0, '', {
      fontSize: '7px',
      color: '#ffffff',
      fontFamily: "'ArkPixel', monospace",
      stroke: '#000000',
      strokeThickness: 1,
    })
    beadIdText.setOrigin(0.5, 0.5)

    const badgeBg = this.scene.add.rectangle(0, 0, 40, BADGE_HEIGHT, 0x2a2040, 0.9)
    badgeBg.setStrokeStyle(1, 0x64477d)

    // Status badge (right of bead ID)
    const statusText = this.scene.add.text(0, 0, '', {
      fontSize: '6px',
      color: '#ffffff',
      fontFamily: "'ArkPixel', monospace",
    })
    statusText.setOrigin(0.5, 0.5)

    const statusBg = this.scene.add.rectangle(0, 0, 30, BADGE_HEIGHT - 2, 0x22aa44, 0.9)
    statusBg.setStrokeStyle(1, 0x000000, 0.5)

    const container = this.scene.add.container(0, OVERLAY_Y_OFFSET, [
      badgeBg, beadIdText, statusBg, statusText,
    ])
    container.setDepth(100)
    container.setAlpha(0)

    // Fade in
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 300,
    })

    // Click to expand
    badgeBg.setInteractive({ useHandCursor: true })
    statusBg.setInteractive({ useHandCursor: true })

    const overlay: TaskOverlay = {
      container,
      badgeBg,
      beadIdText,
      statusBg,
      statusText,
      detailPanel: null,
      expanded: false,
      currentBeadId: null,
    }

    badgeBg.on('pointerdown', () => this.toggleExpand(agentId, overlay))
    statusBg.on('pointerdown', () => this.toggleExpand(agentId, overlay))

    return overlay
  }

  private updateOverlayContent(overlay: TaskOverlay, bead: AgentHookBead) {
    // Update bead ID text
    overlay.beadIdText.setText(bead.id)
    const idWidth = Math.max(overlay.beadIdText.width + BADGE_PADDING_X * 2, 36)
    overlay.badgeBg.setSize(idWidth, BADGE_HEIGHT)

    // Update status badge
    const statusLabel = bead.status.replace(/_/g, ' ')
    overlay.statusText.setText(statusLabel)
    const statusWidth = Math.max(overlay.statusText.width + BADGE_PADDING_X * 2, 28)
    overlay.statusBg.setSize(statusWidth, BADGE_HEIGHT - 2)
    overlay.statusBg.setFillStyle(STATUS_BADGE_COLORS[bead.status] ?? 0x888888, 0.9)

    // Position status badge to right of bead ID badge
    const gap = 2
    const totalWidth = idWidth + gap + statusWidth
    const startX = -totalWidth / 2
    overlay.badgeBg.x = startX + idWidth / 2
    overlay.beadIdText.x = startX + idWidth / 2
    overlay.statusBg.x = startX + idWidth + gap + statusWidth / 2
    overlay.statusText.x = startX + idWidth + gap + statusWidth / 2

    // Update detail panel if expanded
    if (overlay.expanded && overlay.detailPanel) {
      this.updateDetailPanel(overlay, bead)
    }
  }

  private toggleExpand(agentId: string, overlay: TaskOverlay) {
    if (overlay.expanded) {
      this.collapseDetail(overlay)
    } else {
      this.expandDetail(agentId, overlay)
    }
  }

  private expandDetail(agentId: string, overlay: TaskOverlay) {
    const state = this.findAgentState(agentId)
    const bead = state?.hookBead
    if (!bead) return

    overlay.expanded = true

    // Create detail panel below the badge
    const panelBg = this.scene.add.rectangle(0, 18, DETAIL_WIDTH, DETAIL_HEIGHT, 0x141722, 0.95)
    panelBg.setStrokeStyle(1, 0x64477d)
    panelBg.setOrigin(0.5, 0)

    const titleText = this.scene.add.text(0, 22, '', {
      fontSize: '7px',
      color: '#ffd700',
      fontFamily: "'ArkPixel', monospace",
      wordWrap: { width: DETAIL_WIDTH - 12 },
      stroke: '#000000',
      strokeThickness: 1,
    })
    titleText.setOrigin(0.5, 0)

    const infoText = this.scene.add.text(0, 36, '', {
      fontSize: '6px',
      color: '#9ca3af',
      fontFamily: "'ArkPixel', monospace",
      stroke: '#000000',
      strokeThickness: 1,
    })
    infoText.setOrigin(0.5, 0)

    const detailPanel = this.scene.add.container(0, 0, [panelBg, titleText, infoText])
    detailPanel.setAlpha(0)

    overlay.container.add(detailPanel)
    overlay.detailPanel = detailPanel

    this.updateDetailPanel(overlay, bead)

    // Animate in
    this.scene.tweens.add({
      targets: detailPanel,
      alpha: 1,
      duration: 200,
    })
  }

  private updateDetailPanel(overlay: TaskOverlay, bead: AgentHookBead) {
    if (!overlay.detailPanel) return
    const children = overlay.detailPanel.list as Phaser.GameObjects.GameObject[]

    // Title text (index 1)
    const titleText = children[1] as Phaser.GameObjects.Text
    const truncTitle = bead.title.length > 40 ? bead.title.slice(0, 37) + '...' : bead.title
    titleText.setText(truncTitle)

    // Info text (index 2)
    const infoText = children[2] as Phaser.GameObjects.Text
    infoText.setText(`${bead.id} | ${bead.status.replace(/_/g, ' ')}`)

    // Resize panel background to fit content
    const panelBg = children[0] as Phaser.GameObjects.Rectangle
    const contentHeight = Math.max(titleText.height + 20, DETAIL_HEIGHT)
    panelBg.setSize(DETAIL_WIDTH, contentHeight)
  }

  private collapseDetail(overlay: TaskOverlay) {
    overlay.expanded = false
    if (overlay.detailPanel) {
      this.scene.tweens.add({
        targets: overlay.detailPanel,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          overlay.detailPanel?.destroy()
          overlay.detailPanel = null
        },
      })
    }
  }

  private removeOverlay(agentId: string) {
    const overlay = this.overlays.get(agentId)
    if (!overlay) return

    this.scene.tweens.add({
      targets: overlay.container,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        overlay.container.destroy()
        this.overlays.delete(agentId)
      },
    })
  }

  private findAgentState(agentId: string): AgentState | undefined {
    // This will be set externally via updateAgentStates
    return this._agentStates?.get(agentId)
  }

  private _agentStates: Map<string, AgentState> | null = null

  /** Provide reference to agent states for detail panel lookups */
  setAgentStates(states: Map<string, AgentState>) {
    this._agentStates = states
  }

  update(_delta: number) {
    for (const [agentId, overlay] of this.overlays) {
      const char = this.characters.get(agentId)
      if (!char) continue

      const pos = char.getPosition()
      overlay.container.setPosition(pos.x, pos.y + OVERLAY_Y_OFFSET)
      // Keep depth above the character
      overlay.container.setDepth(200)
    }
  }

  destroy() {
    for (const [, overlay] of this.overlays) {
      overlay.container.destroy()
    }
    this.overlays.clear()
  }
}
