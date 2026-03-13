import Phaser from 'phaser'
import { RoomConfig } from '../types'
import { TILE_SIZE } from '../constants'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const LERP_SPEED = 0.05

export class CameraController {
  private scene: Phaser.Scene
  private camera: Phaser.Cameras.Scene2D.Camera
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0
  private dragScrollX = 0
  private dragScrollY = 0
  private trackingTarget: { x: number; y: number } | null = null

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number, rooms: RoomConfig[]) {
    this.scene = scene
    this.camera = scene.cameras.main

    // Set world bounds
    this.camera.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE)
    this.camera.setZoom(1)

    // Center on the building initially
    const centerX = Math.floor(worldWidth / 2)
    this.camera.scrollX = Math.max(0, centerX - 20) * TILE_SIZE
    this.camera.scrollY = 5 * TILE_SIZE

    this.setupInput(rooms)
  }

  private setupInput(rooms: RoomConfig[]) {
    // Click and drag to pan
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return
      this.isDragging = true
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
      this.dragScrollX = this.camera.scrollX
      this.dragScrollY = this.camera.scrollY
      this.trackingTarget = null
    })

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return
      const dx = (this.dragStartX - pointer.x) / this.camera.zoom
      const dy = (this.dragStartY - pointer.y) / this.camera.zoom
      this.camera.scrollX = this.dragScrollX + dx
      this.camera.scrollY = this.dragScrollY + dy
    })

    this.scene.input.on('pointerup', () => {
      this.isDragging = false
    })

    // Mouse wheel to zoom
    this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const zoomDelta = deltaY > 0 ? -0.1 : 0.1
      this.camera.zoom = Phaser.Math.Clamp(this.camera.zoom + zoomDelta, MIN_ZOOM, MAX_ZOOM)
    })

    // Number keys to jump to rooms (generated from room list)
    if (this.scene.input.keyboard) {
      const roomPositions = rooms.slice(0, 9).map((r) => ({
        x: r.x + Math.floor(r.width / 2),
        y: r.y + Math.floor(r.height / 2),
      }))

      for (let i = 0; i < roomPositions.length; i++) {
        const key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i)
        const pos = roomPositions[i]
        key.on('down', () => {
          this.trackingTarget = null
          this.panTo(pos.x * TILE_SIZE, pos.y * TILE_SIZE)
        })
      }
    }
  }

  /** Smoothly pan camera to a world position */
  panTo(worldX: number, worldY: number) {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: worldX - this.camera.width / (2 * this.camera.zoom),
      scrollY: worldY - this.camera.height / (2 * this.camera.zoom),
      duration: 500,
      ease: 'Power2',
    })
  }

  /** Smoothly animate camera zoom to a target level */
  smoothZoomTo(zoom: number) {
    const clamped = Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM)
    this.scene.tweens.add({
      targets: this.camera,
      zoom: clamped,
      duration: 400,
      ease: 'Power2',
    })
  }

  /** Track a moving target (e.g., selected agent) */
  followTarget(target: { x: number; y: number } | null) {
    this.trackingTarget = target
  }

  update() {
    if (this.trackingTarget && !this.isDragging) {
      const targetX = this.trackingTarget.x - this.camera.width / (2 * this.camera.zoom)
      const targetY = this.trackingTarget.y - this.camera.height / (2 * this.camera.zoom)
      this.camera.scrollX += (targetX - this.camera.scrollX) * LERP_SPEED
      this.camera.scrollY += (targetY - this.camera.scrollY) * LERP_SPEED
    }
  }
}
