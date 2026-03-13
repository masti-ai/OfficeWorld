# Mesh Multiplayer + Town Builder Design

**Date:** 2026-03-06
**Author:** gt_arcade/crew/manager
**Status:** APPROVED (overseer pre-approved: "go crazy, YOLO")

---

## Vision

Transform GT Arcade from a static office viewer into a **multiplayer town-builder game**
where multiple Gas Towns connect via "Mesh Mode." Each Gas Town is a self-contained
pixel art world. When Mesh Mode activates, towns link via portals — agents can walk
between worlds, messages flow visually as courier sprites, and the player gets a
zoomed-out "world map" showing all connected towns as nodes in a network graph.

Think: **Animal Crossing visiting islands** meets **Clash of Clans base builder** meets
**Game Boy Advance aesthetic**.

---

## Part 1: Town Builder (Clash of Clans Mode)

### Concept
The current static room layout becomes a **drag-and-drop town builder.** Players can:
- Place, move, and resize rooms on a tile grid
- Add/remove furniture within rooms
- Customize room styles (floor, wall color, decorations)
- Save layouts per rig (each rig = a "base" you can customize)

### Architecture

**TownEditor scene** — A new Phaser scene that replaces ArcadeScene in edit mode:
- Grid overlay with snap-to-tile placement
- Room palette (sidebar) with available room types
- Furniture palette per room
- Drag handles for room resize
- Undo/redo stack (command pattern)
- "Play" button to switch back to live ArcadeScene

**Persistence:**
- Layouts stored in SQLite via bridge server (`/api/layouts/:rigId`)
- Default layouts generated from `DynamicRoomGenerator` (current behavior)
- Custom layouts override defaults per rig
- Schema: `layouts(id, rig_id, layout_json, created_at, updated_at)`

**Data model:**
```typescript
interface TownLayout {
  rigId: string
  rooms: PlacedRoom[]
  decorations: PlacedDecoration[]
  portals: PortalConfig[]  // mesh connection points
}

interface PlacedRoom {
  id: string
  templateId: string  // references RoomTemplate
  x: number
  y: number
  width: number
  height: number
  customizations: {
    floorStyle: string
    wallColor: number
    furniture: FurnitureItem[]
    decorations: DecorationItem[]
  }
}
```

### UI: Game Boy / Nintendo Design Language

**Art direction:** GBA-era pixel art. Think Pokemon Ruby/Sapphire overworld meets
Advance Wars UI.

- **Palette:** Limited 16-color palette per scene (GBA constraint feel)
- **UI chrome:** Rounded rectangle windows with 2px pixel borders
- **Buttons:** Chunky pixel buttons with press animation (2px down-shift on click)
- **Font:** ArkPixel (already loaded) for ALL text, no system fonts
- **Menu transitions:** Slide-in from edges, not fade (Game Boy style)
- **Sound cues:** Optional 8-bit beeps on hover/click (Web Audio API)
- **Selector cursor:** Animated hand/arrow sprite that follows mouse in edit mode

**Key UI panels for builder:**
- Room Palette (left sidebar, scrollable, pixel art thumbnails)
- Properties Inspector (right sidebar, shows selected room/furniture details)
- Toolbar (top: save, undo, redo, play, grid toggle, zoom)
- Mini-map (bottom-right corner, shows entire layout as tiny pixel overview)

---

## Part 2: Mesh Mode (Multiplayer)

### Concept

Mesh is NOT a settings panel — it's a **game mode.** When activated, your town connects
to other Gas Towns via WebSocket relay. Each connected town appears as a node on a
world map. Agents can "visit" other towns via portal doorways.

### How It Works

**Connection topology:**
```
Gas Town A  <--WebSocket-->  Mesh Relay Server  <--WebSocket-->  Gas Town B
                                    |
                            Gas Town C (spectator)
```

**Mesh Relay Server** (new service, runs on mayor's bridge or standalone):
- Maintains list of connected towns
- Routes messages between towns
- Broadcasts town presence (heartbeat)
- Relays agent visit events

**Protocol (WebSocket messages):**
```typescript
// Town announces itself
{ type: 'town-announce', townId: string, name: string, rigs: string[], agentCount: number }

// Agent visits another town
{ type: 'agent-visit', from: { town: string, agent: string }, to: { town: string }, duration: number }

// Message courier (visual: sprite walks between towns carrying a letter)
{ type: 'mesh-message', from: { town: string, agent: string }, to: { town: string, agent: string }, subject: string }

// Town state broadcast (periodic)
{ type: 'town-state', townId: string, agents: AgentBrief[], beadCount: number, activePolecats: number }

// Portal open/close
{ type: 'portal-state', townId: string, portalId: string, connected: boolean, targetTown: string }
```

### Visual Design

**World Map view** (new Phaser scene: MeshWorldMap):
- Zoomed-out view showing connected towns as pixel art buildings/islands
- Connection lines between towns (animated dashed lines, pulse on message)
- Click a town to "zoom in" to their ArcadeScene (read-only spectator mode)
- Your town highlighted with a golden glow

**Portals:**
- Special doorway tiles at the edge of your town (shimmering purple/blue portal)
- Agents walking through a portal animate: shrink, sparkle, fade out
- They appear in the remote town's portal with reverse animation
- Portal frame: stone archway with animated rune symbols

**Courier sprites:**
- When a `gt mail send` crosses mesh boundaries, a small courier sprite appears
- Courier runs from sender's town to recipient's town on the world map
- Arrives with a small "letter delivered" particle burst
- Clicking the courier mid-transit shows the message subject

**Town Cards (Game Boy style):**
```
+---------------------------+
|  [pixel art building]     |
|  VILLA AI PLANOGRAM       |
|  Agents: 12/8 online      |
|  Beads: 34 open           |
|  Status: ACTIVE           |
|  [Visit] [Message]        |
+---------------------------+
```

### Node Graph Builder

**MeshBuilder UI** (React overlay, not Phaser):
- Visual node graph editor for connecting Gas Towns
- Drag towns onto a canvas, draw connection lines between them
- Each connection = a WebSocket channel
- Shows real-time message flow as animated dots on connection lines
- Can create "mesh topologies": star (one relay), ring, full mesh
- Export/import mesh configs as JSON

```typescript
interface MeshConfig {
  towns: MeshTown[]
  connections: MeshConnection[]
  relay: { host: string; port: number }
}

interface MeshTown {
  id: string
  name: string
  host: string
  port: number
  position: { x: number; y: number }  // position on world map
}

interface MeshConnection {
  from: string  // town id
  to: string    // town id
  type: 'bidirectional' | 'one-way'
  latency?: number
}
```

---

## Part 3: Character Upgrades (Isometric 3D)

### Current State
Characters are 16x24 or 32x48 pixel sprites, top-down 2D. Procedurally generated
from traits (skin, hair, hat, outfit).

### Target
Isometric chibi characters (like Final Fantasy Tactics Advance or Disgaea on GBA):
- 32x48 base size, rendered at 2x (64x96 on screen)
- 3/4 view (isometric-lite, consistent with current room rendering)
- 8-direction walking (currently 4)
- Idle animations: breathing, blinking, occasional fidget
- Working animations: typing with screen glow, reading with page turns
- Emotional expressions: thought bubbles, exclamation marks, sweat drops
- Equipment: visible laptop, coffee mug, headphones based on status

### Character Customization Panel

**In-game panel (press C or click agent portrait):**
- Paper doll style: drag items onto character
- Categories: Hair, Face, Hat, Outfit, Accessory
- Preview: live character preview with idle animation
- Save: persisted per agent in SQLite
- Pixel art thumbnails for each option (GBA item select style)

---

## Part 4: Implementation Phasing

### Phase A: Town Builder Foundation (3 beads)
1. TownEditor Phaser scene with grid overlay and room placement
2. Room/furniture palette UI components (GBA-style sidebar)
3. Layout persistence API + SQLite schema

### Phase B: GBA Design System (2 beads)
4. Pixel art UI component library (buttons, panels, menus, cursors)
5. Refactor all existing UI to use GBA design system

### Phase C: Mesh Protocol (3 beads)
6. Mesh relay server (standalone Node.js WebSocket service)
7. Mesh client in bridge server (connect/announce/relay)
8. Portal game objects in Phaser (visual doorways between towns)

### Phase D: Mesh World Map (2 beads)
9. MeshWorldMap Phaser scene (town nodes, connection lines, couriers)
10. MeshBuilder React UI (node graph editor for topology)

### Phase E: Character Upgrade (2 beads)
11. Isometric character sprite generator (8-dir, larger, more detail)
12. Character customization panel (paper doll UI)

### Phase F: Polish + Integration (2 beads)
13. Sound effects (8-bit beeps, portal sounds, courier arrival)
14. End-to-end integration testing + performance optimization

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Town builder engine | Phaser scene (TownEditor) | Reuse existing Phaser setup, tile snapping natural |
| Mesh transport | WebSocket via relay | Simple, works across NAT, relay handles discovery |
| Layout storage | SQLite (existing db.ts) | Already have SQLite infra, no new deps |
| Character rendering | Procedural canvas (enhanced) | Current approach works, just needs more frames/detail |
| UI framework | React overlays + Phaser scenes | Split: game rendering in Phaser, menus in React |
| Design system | GBA-inspired pixel art | Matches existing ArkPixel font, cohesive aesthetic |
| Mesh config | JSON file + visual builder | Easy to version control, visual builder for UX |

---

## Open Questions (for future sessions)

- Should mesh relay run as a separate process or integrate into mayor's bridge?
- Do we want real agent code execution across mesh, or just visual presence?
- How much of the town builder should be accessible to agents vs human only?
- Should mesh connections require authentication/keys?
