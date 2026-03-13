export const TILE_SIZE = 16
export const WORLD_WIDTH = 120
export const WORLD_HEIGHT = 80
export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

// Dark isometric palette (banner.png aesthetic)
export const THEME = {
  // Backgrounds
  bgDark: '#060810',
  bgPanel: '#0a0c14',
  bgBody: '#0e0e1a',
  bgCanvas: '#080812',
  bgHeader: '#0c0a18',

  // Accents
  gold: '#ffd700',
  goldDim: '#b8960f',
  green: '#22c55e',
  greenDim: '#0f9b58',
  red: '#e94560',
  orange: '#ffaa00',
  cyan: '#53d8fb',
  purple: '#64477d',

  // Text
  textBright: '#fff',
  textPrimary: '#e5e7eb',
  textSecondary: '#9ca3af',
  textMuted: '#555',

  // Borders
  borderDark: '#0e1119',
  borderPanel: '#2a2040',
  borderAccent: '#64477d',

  // Font
  fontFamily: "'ArkPixel', 'Courier New', monospace",

  // CRT / Retro Terminal
  crtGreen: '#33ff66',
  crtGreenDim: '#1a9944',
  crtGreenGlow: 'rgba(51, 255, 102, 0.4)',
  crtBg: '#0a120a',
  crtScanlineAlpha: 0.08,
  phosphorGlow: '0 0 8px rgba(51, 255, 102, 0.6), 0 0 2px rgba(51, 255, 102, 0.9)',
  phosphorGlowSubtle: '0 0 4px rgba(51, 255, 102, 0.3)',
} as const

export const SKIN_TONES = [0xfce4c0, 0xf5d0a9, 0xe8b88a, 0xd4956b, 0xb07050, 0x8b5e3c, 0x6b4226, 0x5c3a1e]

export const HAIR_COLORS = [
  0x2c1810, 0x4a3728, 0x8b6f47, 0xd4a76a, 0xf5deb3,
  0xc41e3a, 0x1e6090, 0x6b4e8b, 0x2e8b57, 0x1a1a1a,
]

export const HAT_STYLES = ['none', 'cap', 'beanie', 'tophat', 'headband', 'bandana'] as const
export const HAIR_STYLES = ['short', 'spiky', 'sidepart', 'bald', 'long', 'mohawk', 'ponytail', 'curly'] as const
export const FACE_STYLES = ['default', 'glasses', 'beard', 'both', 'freckles', 'scar'] as const

export const ROOM_COLORS: Record<string, number> = {
  planogram: 0x1a1c28,    // dark charcoal blue
  alc_ai: 0x181c22,       // dark slate
  arcade: 0x1c1a28,       // dark charcoal purple
  mayor_office: 0x1e1a18, // dark charcoal brown
  hallway: 0x16161e,      // deep charcoal
  breakroom: 0x1a1a20,    // dark neutral
  smoke_area: 0x141418,   // near-black
  bathroom: 0x181a20,     // dark blue-gray
  play_area: 0x1a181e,    // dark warm charcoal
  meeting_room: 0x18181e, // dark neutral
  polecat_yard: 0x121416, // near-black outdoor
}

export const FLOOR_STYLES: Record<string, 'wood' | 'carpet' | 'tile' | 'concrete' | 'grass'> = {
  planogram: 'carpet',
  alc_ai: 'carpet',
  arcade: 'carpet',
  mayor_office: 'wood',
  hallway: 'tile',
  breakroom: 'tile',
  smoke_area: 'concrete',
  bathroom: 'tile',
  play_area: 'wood',
  meeting_room: 'carpet',
  polecat_yard: 'concrete',
}

export const BREAK_TIMING = {
  minWorkTime: 30000,
  maxWorkTime: 120000,
  breakDuration: 15000,
  smokeDuration: 20000,
  bathroomDuration: 10000,
}

export const OUTFIT_COLORS: Record<string, number> = {
  planogram: 0x3a7bd5,
  alc_ai: 0x4caf50,
  arcade: 0x9c27b0,
  mayor: 0xd4af37,
  deacon: 0xff9800,
  witness: 0xe91e63,
  refinery: 0xff5722,
  default: 0x607d8b,
}

export const BEAD_SPAWN_CHANCE = 0.003
export const BEAD_MAX_AGE = 60000 // Auto-expire beads after 60s
export const BEAD_MAX_COUNT = 30

// Polecat lifecycle timing (ms)
export const POLECAT_IDLE_MIN = 15000
export const POLECAT_IDLE_MAX = 45000
export const POLECAT_ACTIVITY_DURATION = 8000
export const POLECAT_WORK_MIN = 20000
export const POLECAT_WORK_MAX = 60000
export const POLECAT_DONE_DURATION = 6000
export const POLECAT_BLOCKED_DURATION = 12000
export const POLECAT_BLOCKED_CHANCE = 0.15 // 15% chance of getting blocked
export const POLECAT_SLUNG_SPEED_MULT = 2.5 // Rush speed multiplier
export const POLECAT_PACE_INTERVAL = 2000 // Pacing direction change interval

// Polecat names (Gas Town themed)
export const POLECAT_NAMES = ['furiosa', 'nux', 'slit', 'rictus', 'toast'] as const
