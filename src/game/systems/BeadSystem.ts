import Phaser from 'phaser'
import { Bead, TileData } from '../../types'
import { TILE_SIZE, BEAD_SPAWN_CHANCE, BEAD_MAX_AGE, BEAD_MAX_COUNT } from '../../constants'

const BEAD_TYPES: Bead['type'][] = ['cigarette_butt', 'coffee_cup', 'paper']

export class BeadSystem {
  private scene: Phaser.Scene
  private beads = new Map<string, Bead>()
  private sprites = new Map<string, Phaser.GameObjects.Container>()
  private nextId = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Try to spawn a bead near an agent position */
  trySpawnBead(agentX: number, agentY: number, roomId: string, grid: TileData[][]) {
    if (Math.random() > BEAD_SPAWN_CHANCE) return
    if (!roomId || roomId === 'doorway') return

    // Random offset near agent
    const ox = Math.floor(Math.random() * 3) - 1
    const oy = Math.floor(Math.random() * 3) - 1
    const bx = agentX + ox
    const by = agentY + oy

    // Check walkable
    if (!grid[by]?.[bx]?.walkable) return

    const id = `bead_${this.nextId++}`
    const type = BEAD_TYPES[Math.floor(Math.random() * BEAD_TYPES.length)]
    const bead: Bead = { id, x: bx, y: by, roomId, age: 0, type }
    this.beads.set(id, bead)

    // Create sprite
    const container = this.createBeadSprite(bead)
    this.sprites.set(id, container)
  }

  private createBeadSprite(bead: Bead): Phaser.GameObjects.Container {
    const px = bead.x * TILE_SIZE + TILE_SIZE / 2
    const py = bead.y * TILE_SIZE + TILE_SIZE / 2

    const gfx = this.scene.add.graphics()

    switch (bead.type) {
      case 'cigarette_butt':
        // Butt body
        gfx.fillStyle(0xeeeeee)
        gfx.fillRect(-3, -1, 5, 2)
        // Filter
        gfx.fillStyle(0xddaa55)
        gfx.fillRect(-3, -1, 2, 2)
        // Burned tip
        gfx.fillStyle(0x444444)
        gfx.fillRect(2, -1, 1, 2)
        // Ember glow
        gfx.fillStyle(0xff6633, 0.5)
        gfx.fillRect(2, 0, 1, 1)
        break

      case 'coffee_cup':
        // Cup
        gfx.fillStyle(0xffffff)
        gfx.fillRect(-2, -2, 4, 5)
        gfx.fillStyle(0xdddddd)
        gfx.fillRect(-2, -2, 4, 1)
        // Coffee stain
        gfx.fillStyle(0x6b4226, 0.4)
        gfx.fillRect(-1, 2, 3, 1)
        break

      case 'paper':
        // Crumpled paper
        gfx.fillStyle(0xeeeecc)
        gfx.fillRect(-3, -2, 6, 4)
        gfx.fillStyle(0xddddbb)
        gfx.fillRect(-2, -1, 4, 2)
        // Fold lines
        gfx.lineStyle(1, 0xccccaa)
        gfx.lineBetween(-2, -1, 1, 1)
        break
    }

    const container = this.scene.add.container(px, py, [gfx])
    container.setDepth(1) // Below characters
    container.setAlpha(0)

    // Fade in
    this.scene.tweens.add({
      targets: container,
      alpha: 0.8,
      duration: 300,
    })

    return container
  }

  /** Remove a bead with a cleaning animation */
  removeBead(beadId: string): { x: number; y: number } | null {
    const bead = this.beads.get(beadId)
    if (!bead) return null

    const sprite = this.sprites.get(beadId)
    if (sprite) {
      // Sparkle/clean animation
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 400,
        ease: 'Power2',
        onComplete: () => sprite.destroy(),
      })
    }

    const pos = { x: bead.x, y: bead.y }
    this.beads.delete(beadId)
    this.sprites.delete(beadId)
    return pos
  }

  /** Get all beads */
  getBeads(): Map<string, Bead> {
    return this.beads
  }

  /** Get nearest bead to a position */
  getNearestBead(x: number, y: number): Bead | null {
    let nearest: Bead | null = null
    let minDist = Infinity

    for (const bead of this.beads.values()) {
      const dist = Math.abs(bead.x - x) + Math.abs(bead.y - y)
      if (dist < minDist) {
        minDist = dist
        nearest = bead
      }
    }

    return nearest
  }

  /** Update bead ages and auto-expire old ones */
  update(delta: number) {
    const toRemove: string[] = []
    for (const bead of this.beads.values()) {
      bead.age += delta
      if (bead.age > BEAD_MAX_AGE) {
        toRemove.push(bead.id)
      }
    }
    // Auto-expire old beads
    for (const id of toRemove) {
      this.removeBead(id)
    }
    // Cap total bead count
    if (this.beads.size > BEAD_MAX_COUNT) {
      const oldest = [...this.beads.values()].sort((a, b) => b.age - a.age)
      for (let i = BEAD_MAX_COUNT; i < oldest.length; i++) {
        this.removeBead(oldest[i].id)
      }
    }
  }

  getBeadCount(): number {
    return this.beads.size
  }
}
