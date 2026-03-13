import { RoomConfig, FurnitureItem } from '../../types'

export interface Command {
  type: string
  execute(): void
  undo(): void
}

export class PlaceRoomCommand implements Command {
  type = 'place-room'
  constructor(
    private rooms: RoomConfig[],
    private room: RoomConfig,
  ) {}

  execute() {
    this.rooms.push({ ...this.room, furniture: [...this.room.furniture], deskPositions: [...this.room.deskPositions] })
  }

  undo() {
    const idx = this.rooms.findIndex((r) => r.id === this.room.id)
    if (idx >= 0) this.rooms.splice(idx, 1)
  }
}

export class MoveRoomCommand implements Command {
  type = 'move-room'
  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private oldX: number,
    private oldY: number,
    private newX: number,
    private newY: number,
  ) {}

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) {
      room.x = this.newX
      room.y = this.newY
    }
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) {
      room.x = this.oldX
      room.y = this.oldY
    }
  }
}

export class ResizeRoomCommand implements Command {
  type = 'resize-room'
  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private oldX: number,
    private oldY: number,
    private oldW: number,
    private oldH: number,
    private newX: number,
    private newY: number,
    private newW: number,
    private newH: number,
  ) {}

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) {
      room.x = this.newX
      room.y = this.newY
      room.width = this.newW
      room.height = this.newH
    }
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) {
      room.x = this.oldX
      room.y = this.oldY
      room.width = this.oldW
      room.height = this.oldH
    }
  }
}

export class DeleteRoomCommand implements Command {
  type = 'delete-room'
  private removedRoom: RoomConfig | null = null
  private removedIndex = -1

  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
  ) {}

  execute() {
    const idx = this.rooms.findIndex((r) => r.id === this.roomId)
    if (idx >= 0) {
      this.removedRoom = this.rooms[idx]
      this.removedIndex = idx
      this.rooms.splice(idx, 1)
    }
  }

  undo() {
    if (this.removedRoom && this.removedIndex >= 0) {
      this.rooms.splice(this.removedIndex, 0, this.removedRoom)
    }
  }
}

export class ChangeFloorCommand implements Command {
  type = 'change-floor'
  private oldStyle: string

  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private newStyle: 'wood' | 'carpet' | 'tile' | 'concrete' | 'grass',
  ) {
    const room = this.rooms.find((r) => r.id === this.roomId)
    this.oldStyle = room?.floorStyle || 'carpet'
  }

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) room.floorStyle = this.newStyle
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) room.floorStyle = this.oldStyle as any
  }
}

export class ChangeWallColorCommand implements Command {
  type = 'change-wall-color'
  private oldColor: number

  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private newColor: number,
  ) {
    const room = this.rooms.find((r) => r.id === this.roomId)
    this.oldColor = room?.color ?? 0x9a9080
  }

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) room.color = this.newColor
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) room.color = this.oldColor
  }
}

export class PlaceFurnitureCommand implements Command {
  type = 'place-furniture'
  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private furniture: FurnitureItem,
  ) {}

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) room.furniture.push({ ...this.furniture })
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room) {
      const idx = room.furniture.findIndex(
        (f) => f.type === this.furniture.type && f.x === this.furniture.x && f.y === this.furniture.y,
      )
      if (idx >= 0) room.furniture.splice(idx, 1)
    }
  }
}

export class RemoveFurnitureCommand implements Command {
  type = 'remove-furniture'
  private removed: FurnitureItem | null = null
  private removedIndex = -1

  constructor(
    private rooms: RoomConfig[],
    private roomId: string,
    private furnitureIndex: number,
  ) {}

  execute() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room && this.furnitureIndex < room.furniture.length) {
      this.removed = room.furniture[this.furnitureIndex]
      this.removedIndex = this.furnitureIndex
      room.furniture.splice(this.furnitureIndex, 1)
    }
  }

  undo() {
    const room = this.rooms.find((r) => r.id === this.roomId)
    if (room && this.removed) {
      room.furniture.splice(this.removedIndex, 0, this.removed)
    }
  }
}

export class CommandStack {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private onChange?: () => void

  constructor(onChange?: () => void) {
    this.onChange = onChange
  }

  execute(cmd: Command) {
    cmd.execute()
    this.undoStack.push(cmd)
    this.redoStack = []
    this.onChange?.()
  }

  undo() {
    const cmd = this.undoStack.pop()
    if (cmd) {
      cmd.undo()
      this.redoStack.push(cmd)
      this.onChange?.()
    }
  }

  redo() {
    const cmd = this.redoStack.pop()
    if (cmd) {
      cmd.execute()
      this.undoStack.push(cmd)
      this.onChange?.()
    }
  }

  get canUndo() {
    return this.undoStack.length > 0
  }

  get canRedo() {
    return this.redoStack.length > 0
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
    this.onChange?.()
  }
}
