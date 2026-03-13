import { RoomConfig } from '../../types'
import { ROOM_COLORS } from '../../constants'

export function createDepartmentRoom(
  id: string,
  name: string,
  x: number,
  y: number,
  color: number,
): RoomConfig {
  return {
    id,
    name,
    x,
    y,
    width: 30,
    height: 25,
    type: 'department',
    color,
    floorStyle: 'carpet',
    furniture: [
      // Left desk cluster — dev workstations with triple monitors, gaming chairs, full setups
      { type: 'desk', x: x + 3, y: y + 5, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 3, y: y + 4, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 7, y: y + 5, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 2, y: y + 5, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 5, y: y + 7, width: 1, height: 1 },
      { type: 'led_strip', x: x + 3, y: y + 7, width: 4, height: 1 },
      { type: 'desk', x: x + 3, y: y + 10, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 3, y: y + 9, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 7, y: y + 10, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 2, y: y + 10, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 5, y: y + 12, width: 1, height: 1 },
      { type: 'led_strip', x: x + 3, y: y + 12, width: 4, height: 1 },
      { type: 'desk', x: x + 3, y: y + 15, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 3, y: y + 14, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 7, y: y + 15, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 2, y: y + 15, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 5, y: y + 17, width: 1, height: 1 },
      { type: 'led_strip', x: x + 3, y: y + 17, width: 4, height: 1 },
      // Right desk cluster — dev workstations with triple monitors
      { type: 'desk', x: x + 15, y: y + 5, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 15, y: y + 4, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 19, y: y + 5, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 14, y: y + 5, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 17, y: y + 7, width: 1, height: 1 },
      { type: 'led_strip', x: x + 15, y: y + 7, width: 4, height: 1 },
      { type: 'desk', x: x + 15, y: y + 10, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 15, y: y + 9, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 19, y: y + 10, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 14, y: y + 10, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 17, y: y + 12, width: 1, height: 1 },
      { type: 'led_strip', x: x + 15, y: y + 12, width: 4, height: 1 },
      { type: 'desk', x: x + 15, y: y + 15, width: 4, height: 2 },
      { type: 'triple_monitor', x: x + 15, y: y + 14, width: 4, height: 1 },
      { type: 'pc_tower', x: x + 19, y: y + 15, width: 1, height: 2 },
      { type: 'headphone_stand', x: x + 14, y: y + 15, width: 1, height: 1 },
      { type: 'gaming_chair', x: x + 17, y: y + 17, width: 1, height: 1 },
      { type: 'led_strip', x: x + 15, y: y + 17, width: 4, height: 1 },
      // Cable management under desk rows
      { type: 'cable_management', x: x + 3, y: y + 19, width: 5, height: 1 },
      { type: 'cable_management', x: x + 15, y: y + 19, width: 5, height: 1 },
      // Decor
      { type: 'plant', x: x + 2, y: y + 2, width: 1, height: 1 },
      { type: 'plant', x: x + 27, y: y + 2, width: 1, height: 1 },
      { type: 'plant', x: x + 12, y: y + 20, width: 1, height: 1 },
      { type: 'trash_can', x: x + 10, y: y + 8, width: 1, height: 1 },
      { type: 'trash_can', x: x + 22, y: y + 13, width: 1, height: 1 },
      { type: 'filing_cabinet', x: x + 22, y: y + 3, width: 1, height: 2 },
      { type: 'bookshelf', x: x + 24, y: y + 3, width: 2, height: 2 },
      { type: 'whiteboard', x: x + 10, y: y + 3, width: 4, height: 2 },
      { type: 'rug', x: x + 8, y: y + 12, width: 6, height: 4 },
      { type: 'coat_rack', x: x + 27, y: y + 18, width: 1, height: 1 },
      // Desk lamps for ambient lighting
      { type: 'desk_lamp', x: x + 2, y: y + 12, width: 1, height: 1 },
      { type: 'desk_lamp', x: x + 14, y: y + 7, width: 1, height: 1 },
      { type: 'desk_lamp', x: x + 20, y: y + 15, width: 1, height: 1 },
    ],
    deskPositions: [
      { x: x + 5, y: y + 7 },
      { x: x + 5, y: y + 12 },
      { x: x + 5, y: y + 17 },
      { x: x + 17, y: y + 7 },
      { x: x + 17, y: y + 12 },
      { x: x + 17, y: y + 17 },
    ],
    decorations: [
      { type: 'clock', x: x + 14, y: y },
      { type: 'window', x: x + 5, y: y },
      { type: 'window', x: x + 8, y: y },
      { type: 'window', x: x + 17, y: y },
      { type: 'window', x: x + 20, y: y },
      { type: 'string_lights', x: x + 10, y: y },
      { type: 'string_lights', x: x + 24, y: y },
      { type: 'neon_sign', x: x + 2, y: y, color: '#00ccff' },
      { type: 'poster', x: x + 26, y: y },
    ],
  }
}

export function createMayorOffice(x: number, y: number): RoomConfig {
  const w = 12
  return {
    id: 'mayor_office',
    name: "Mayor's Office",
    x,
    y,
    width: w,
    height: 25,
    type: 'mayor_office',
    color: ROOM_COLORS.mayor_office,
    floorStyle: 'wood',
    furniture: [
      // Executive desk (wide)
      { type: 'desk', x: x + 3, y: y + 5, width: 4, height: 2 },
      // Triple monitor setup — executive command center
      { type: 'triple_monitor', x: x + 3, y: y + 4, width: 4, height: 1 },
      // Executive desk lamp
      { type: 'desk_lamp', x: x + 7, y: y + 5, width: 1, height: 1 },
      // Cable management under executive desk
      { type: 'cable_management', x: x + 3, y: y + 7, width: 4, height: 1 },
      // Bookshelves (executive library)
      { type: 'bookshelf', x: x + 1, y: y + 2, width: 2, height: 2 },
      { type: 'bookshelf', x: x + w - 3, y: y + 2, width: 2, height: 2 },
      // Plants (executive greenery)
      { type: 'plant', x: x + 1, y: y + 5, width: 1, height: 1 },
      { type: 'plant', x: x + w - 2, y: y + 5, width: 1, height: 1 },
      // Filing cabinet
      { type: 'filing_cabinet', x: x + 1, y: y + 10, width: 1, height: 2 },
      // Guest couch
      { type: 'couch', x: x + 3, y: y + 14, width: 4, height: 2 },
      // Executive rug
      { type: 'rug', x: x + 2, y: y + 7, width: 6, height: 4 },
      // Coffee cup on desk
      { type: 'coffee_cup', x: x + 2, y: y + 5, width: 1, height: 1 },
    ],
    deskPositions: [{ x: x + 5, y: y + 7 }],
    decorations: [
      { type: 'sign', x: x + Math.floor(w / 2), y: y, label: 'MAYOR' },
      { type: 'window', x: x + 2, y: y },
      { type: 'window', x: x + w - 3, y: y },
      { type: 'painting', x: x + Math.floor(w / 2) + 1, y: y },
    ],
  }
}

export function createHallwayRoom(
  x: number,
  y: number,
  width: number,
  height: number,
): RoomConfig {
  const furniture: RoomConfig['furniture'] = []
  // Scatter plants along the hallway
  const interval = Math.max(10, Math.floor(width / 6))
  for (let px = x + 3; px < x + width - 3; px += interval) {
    furniture.push({ type: 'plant', x: px, y: y + 2, width: 1, height: 1 })
  }
  furniture.push({ type: 'water_cooler', x: x + Math.floor(width / 2), y: y + 2, width: 1, height: 1 })
  furniture.push({ type: 'trash_can', x: x + Math.floor(width / 3), y: y + height - 3, width: 1, height: 1 })

  return {
    id: 'hallway',
    name: 'Main Hallway',
    x,
    y,
    width,
    height,
    type: 'hallway',
    color: ROOM_COLORS.hallway,
    floorStyle: 'tile',
    furniture,
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + Math.floor(width / 2) - 1, y: y, label: 'HALL' },
      { type: 'clock', x: x + Math.floor(width / 2) + 2, y: y },
    ],
  }
}

export function createBreakroom(x: number, y: number, width: number): RoomConfig {
  return {
    id: 'breakroom',
    name: 'Break Room',
    x,
    y,
    width,
    height: 20,
    type: 'breakroom',
    color: ROOM_COLORS.breakroom,
    floorStyle: 'tile',
    furniture: [
      { type: 'table', x: x + 3, y: y + 5, width: 3, height: 2 },
      { type: 'chair', x: x + 2, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 4, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 6, y: y + 7, width: 1, height: 1 },
      { type: 'table', x: x + 10, y: y + 5, width: 3, height: 2 },
      { type: 'chair', x: x + 9, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 11, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 13, y: y + 7, width: 1, height: 1 },
      { type: 'vending_machine', x: x + 2, y: y + 2, width: 1, height: 2 },
      { type: 'coffee_machine', x: x + 4, y: y + 2, width: 1, height: 1 },
      { type: 'couch', x: x + 5, y: y + 13, width: 4, height: 2 },
      { type: 'trash_can', x: x + width - 4, y: y + 2, width: 1, height: 1 },
    ],
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + Math.floor(width / 2), y: y, label: 'BREAK' },
      { type: 'poster', x: x + 2, y: y },
      { type: 'clock', x: x + Math.floor(width / 2) + 3, y: y },
    ],
  }
}

export function createMeetingRoom(x: number, y: number, width: number): RoomConfig {
  const cx = Math.floor(width / 2)
  return {
    id: 'meeting_room',
    name: 'Meeting Room',
    x,
    y,
    width,
    height: 20,
    type: 'meeting_room',
    color: ROOM_COLORS.meeting_room,
    floorStyle: 'carpet',
    furniture: [
      { type: 'meeting_table', x: x + cx - 4, y: y + 6, width: 8, height: 4 },
      { type: 'chair', x: x + cx - 5, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + cx - 5, y: y + 9, width: 1, height: 1 },
      { type: 'chair', x: x + cx + 4, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + cx + 4, y: y + 9, width: 1, height: 1 },
      { type: 'chair', x: x + cx - 2, y: y + 11, width: 1, height: 1 },
      { type: 'chair', x: x + cx, y: y + 11, width: 1, height: 1 },
      { type: 'chair', x: x + cx + 2, y: y + 11, width: 1, height: 1 },
      { type: 'chair', x: x + cx - 2, y: y + 5, width: 1, height: 1 },
      { type: 'chair', x: x + cx, y: y + 5, width: 1, height: 1 },
      { type: 'chair', x: x + cx + 2, y: y + 5, width: 1, height: 1 },
      { type: 'projector_screen', x: x + cx - 4, y: y + 2, width: 8, height: 2 },
      { type: 'plant', x: x + 2, y: y + 2, width: 1, height: 1 },
      { type: 'plant', x: x + width - 3, y: y + 2, width: 1, height: 1 },
      { type: 'whiteboard', x: x + width - 5, y: y + 2, width: 3, height: 2 },
    ],
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + cx, y: y, label: 'MEET' },
      { type: 'clock', x: x + cx + 3, y: y },
    ],
  }
}

export function createSmokeArea(x: number, y: number, width: number): RoomConfig {
  return {
    id: 'smoke_area',
    name: 'Smoke Area',
    x,
    y,
    width,
    height: 20,
    type: 'smoke_area',
    color: ROOM_COLORS.smoke_area,
    floorStyle: 'concrete',
    furniture: [
      { type: 'ashtray', x: x + 4, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 3, y: y + 8, width: 1, height: 1 },
      { type: 'chair', x: x + 5, y: y + 8, width: 1, height: 1 },
      { type: 'ashtray', x: x + 10, y: y + 7, width: 1, height: 1 },
      { type: 'chair', x: x + 9, y: y + 8, width: 1, height: 1 },
      { type: 'chair', x: x + 11, y: y + 8, width: 1, height: 1 },
      { type: 'trash_can', x: x + 2, y: y + 2, width: 1, height: 1 },
      { type: 'plant', x: x + width - 3, y: y + 2, width: 1, height: 1 },
    ],
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + Math.floor(width / 2), y: y, label: 'SMOKE' },
    ],
  }
}

export function createBathroom(x: number, y: number, width: number): RoomConfig {
  return {
    id: 'bathroom',
    name: 'Bathroom',
    x,
    y,
    width,
    height: 20,
    type: 'bathroom',
    color: ROOM_COLORS.bathroom,
    floorStyle: 'tile',
    furniture: [
      { type: 'toilet', x: x + 3, y: y + 4, width: 1, height: 1 },
      { type: 'toilet', x: x + 6, y: y + 4, width: 1, height: 1 },
      { type: 'toilet', x: x + 9, y: y + 4, width: 1, height: 1 },
      { type: 'toilet', x: x + 3, y: y + 10, width: 1, height: 1 },
      { type: 'toilet', x: x + 6, y: y + 10, width: 1, height: 1 },
      { type: 'toilet', x: x + 9, y: y + 10, width: 1, height: 1 },
      { type: 'trash_can', x: x + 2, y: y + 2, width: 1, height: 1 },
    ],
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + Math.floor(width / 2), y: y, label: 'WC' },
    ],
  }
}

export function createPlayArea(x: number, y: number, width: number): RoomConfig {
  return {
    id: 'play_area',
    name: 'Play Area',
    x,
    y,
    width,
    height: 20,
    type: 'play_area',
    color: ROOM_COLORS.play_area,
    floorStyle: 'wood',
    furniture: [
      { type: 'arcade_machine', x: x + 4, y: y + 3, width: 1, height: 2 },
      { type: 'arcade_machine', x: x + 7, y: y + 3, width: 1, height: 2 },
      { type: 'arcade_machine', x: x + 10, y: y + 3, width: 1, height: 2 },
      { type: 'arcade_machine', x: x + 13, y: y + 3, width: 1, height: 2 },
      { type: 'ping_pong', x: x + 17, y: y + 5, width: 6, height: 4 },
      { type: 'couch', x: x + 4, y: y + 13, width: 4, height: 2 },
      { type: 'couch', x: x + 12, y: y + 13, width: 4, height: 2 },
      { type: 'table', x: x + width - 8, y: y + 7, width: 3, height: 2 },
      { type: 'chair', x: x + width - 9, y: y + 9, width: 1, height: 1 },
      { type: 'chair', x: x + width - 5, y: y + 9, width: 1, height: 1 },
      { type: 'plant', x: x + 2, y: y + 2, width: 1, height: 1 },
      { type: 'plant', x: x + width - 3, y: y + 2, width: 1, height: 1 },
      { type: 'vending_machine', x: x + width - 5, y: y + 3, width: 1, height: 2 },
    ],
    deskPositions: [],
    decorations: [
      { type: 'sign', x: x + Math.floor(width / 2), y: y, label: 'PLAY' },
      { type: 'poster', x: x + 2, y: y },
      { type: 'poster', x: x + width - 4, y: y },
    ],
  }
}
