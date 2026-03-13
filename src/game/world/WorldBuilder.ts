import Phaser from 'phaser'
import { TileData, RoomConfig, Doorway } from '../../types'
import { TILE_SIZE } from '../../constants'
import { TileRenderer } from './TileRenderer'
import { FurnitureRenderer } from './FurnitureRenderer'

export class WorldBuilder {
  private scene: Phaser.Scene
  private grid: TileData[][] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  buildWorld(
    rooms: RoomConfig[],
    doorways: Doorway[],
    worldWidth: number,
    worldHeight: number,
  ): { texture: Phaser.GameObjects.RenderTexture; grid: TileData[][] } {
    // Initialize grid — all unwalkable by default
    this.grid = Array.from({ length: worldHeight }, () =>
      Array.from({ length: worldWidth }, () => ({
        walkable: false,
        roomId: null,
        furnitureType: null,
      })),
    )

    // Create render texture for entire world
    const rt = this.scene.add.renderTexture(
      0,
      0,
      worldWidth * TILE_SIZE,
      worldHeight * TILE_SIZE,
    )

    // Fill background
    const bgGfx = this.scene.add.graphics()
    bgGfx.fillStyle(0x040408)
    bgGfx.fillRect(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE)
    rt.draw(bgGfx)
    bgGfx.destroy()

    // Render rooms
    const renderer = new TileRenderer(this.scene)
    const furnitureRenderer = new FurnitureRenderer(this.scene)

    for (const room of rooms) {
      renderer.drawRoom(room, rt)

      // Mark walkable tiles (interior, not walls)
      for (let y = room.y + 2; y < room.y + room.height - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
          if (y < worldHeight && x < worldWidth) {
            this.grid[y][x] = { walkable: true, roomId: room.id, furnitureType: null }
          }
        }
      }

      // Mark furniture as unwalkable
      for (const item of room.furniture) {
        for (let dy = 0; dy < item.height; dy++) {
          for (let dx = 0; dx < item.width; dx++) {
            const gx = item.x + dx
            const gy = item.y + dy
            if (gy < worldHeight && gx < worldWidth) {
              this.grid[gy][gx] = { walkable: false, roomId: room.id, furnitureType: item.type }
            }
          }
        }
      }

      // Draw furniture via dedicated renderer
      for (const item of room.furniture) {
        furnitureRenderer.drawFurniture(item, rt)
      }
    }

    // Draw doorways and mark walkable
    for (const door of doorways) {
      // Make 3 tiles tall doorway
      for (let dy = -1; dy <= 1; dy++) {
        const gy = door.y + dy
        if (gy >= 0 && gy < worldHeight && door.x < worldWidth) {
          this.grid[gy][door.x] = { walkable: true, roomId: 'doorway', furnitureType: null }
        }
      }
      renderer.drawDoorway(door.x, door.y, rt, 0x2a2a3e)
    }

    renderer.destroy()
    furnitureRenderer.destroy()

    // Set origin so position makes sense with camera
    rt.setOrigin(0, 0)

    return { texture: rt, grid: this.grid }
  }

  getCollisionGrid(): TileData[][] {
    return this.grid
  }

  getDeskPositions(roomId: string, rooms: RoomConfig[]): { x: number; y: number }[] {
    const room = rooms.find((r) => r.id === roomId)
    return room?.deskPositions ?? []
  }
}
