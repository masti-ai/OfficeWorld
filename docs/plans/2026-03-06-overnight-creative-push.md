# Overnight Creative Push: Making GT Arcade Feel Alive

**Date:** 2026-03-06 (overnight session)
**Author:** gt_arcade/crew/manager (creative director mode)
**Status:** APPROVED (Overseer: "go crazy, YOLO, full authority")

---

## Creative Vision

GT Arcade should feel like a **living, breathing pixel world** — not a dashboard with
sprites on it. Every pixel intentional. Every interaction satisfying. Every moment atmospheric.

**Reference games:**
- Final Fantasy Tactics Advance (isometric depth, lighting, job system UI)
- Advance Wars (crisp UI, satisfying button sounds, tactical map)
- Fire Emblem GBA (character portraits, stat panels, map transitions)
- Stardew Valley (cozy detail, day/night, weather, ambient life)
- Habbo Hotel (isometric furniture, room builder, social spaces)
- Pokemon Ruby/Sapphire (overworld detail, menu polish, transition wipes)

**The mantra:** _Dense with detail. Every pixel intentional. The world breathes._

---

## Epic 1: Atmospheric Systems (NEW)

### 1A. Day/Night Cycle
**Bead:** `gta-atm.1`

Real-time or accelerated day/night cycle that transforms the entire visual feel:
- **Dawn (6-8am):** Warm orange tint, long shadows from left, birds chirping ambient
- **Day (8am-5pm):** Full brightness, neutral lighting, standard palette
- **Golden hour (5-7pm):** Warm golden tint, shadows lengthening from right
- **Dusk (7-9pm):** Purple/pink sky gradient, office windows begin glowing
- **Night (9pm-6am):** Deep blue overlay, office windows bright yellow, desk lamp cones visible
- **Implementation:** Phaser camera pipeline with color matrix filter, tinted overlay layer
- **Details:**
  - Monitor screens glow brighter at night (subtle bloom)
  - Agent sprites get a slight blue tint outdoors at night
  - Street lamps flicker on at dusk (warm yellow light cones)
  - Stars appear in sky tiles at night (twinkling animation, 3 brightness levels)

### 1B. Weather System
**Bead:** `gta-atm.2`

Particle-based weather that adds atmosphere without blocking gameplay:
- **Rain:** Diagonal particle streaks, puddle ripples on ground tiles, window streaks
  - Light rain: sparse, gentle
  - Heavy rain: dense, camera shake on thunder
  - Thunder: screen flash (white frame), rumble camera shake
  - Puddles: small animated circles on walkable tiles, reflections
- **Snow:** Slow diagonal particles, accumulation on rooftops (white pixel layer grows)
  - Agents leave footprints in snow (fade after 10 seconds)
  - Window sills accumulate snow
- **Fog:** Semi-transparent noise layer that drifts slowly, reduces visibility
- **Clear:** Default, occasional floating dust motes in sunbeams
- **Implementation:** Phaser particle emitter per weather type, tiled overlay for accumulation
- **Cycle:** Weather changes every 20-30 minutes, with 2-minute transitions

### 1C. Ambient Life
**Bead:** `gta-atm.3`

Small details that make the world feel inhabited:
- **Coffee machine steam:** Wispy particle rising from break room coffee maker
- **Plant sway:** Potted plants have 2-frame gentle sway animation
- **Clock hands:** Wall clocks show real time, second hand ticks
- **Monitor flicker:** Random subtle brightness variation on agent screens
- **Ceiling fan rotation:** Slow 4-frame rotation on ceiling fan sprites
- **Paper flutter:** Occasional paper sprite lifts off desk, floats to floor, disappears
- **Fly/bug sprite:** Tiny 2-pixel sprite that flies in random patterns near lights
- **Water cooler bubbles:** Periodic bubble animation in break room water cooler
- **Whiteboard markers:** Randomly placed colored dots on whiteboard sprites

---

## Epic 2: Visual Polish & Shaders (NEW)

### 2A. CRT Scanline Shader
**Bead:** `gta-vfx.1`

A toggleable CRT post-processing effect for that authentic retro feel:
- **Scanlines:** Horizontal dark lines every 2px, 15% opacity
- **Screen curvature:** Subtle barrel distortion at edges (2-3% curve)
- **Vignette:** Dark corners, bright center (radial gradient overlay)
- **Color bleed:** Slight RGB channel separation (0.5px offset)
- **Phosphor persistence:** Faint ghost of previous frame (5% opacity trail)
- **Implementation:** Phaser WebGL pipeline with custom fragment shader
- **Toggle:** Settings panel checkbox, default OFF (some people get headaches)
- **Intensity slider:** 0-100% for each effect independently

### 2B. Screen Transitions
**Bead:** `gta-vfx.2`

GBA-style transitions between scenes/modes:
- **Circle wipe:** Expanding/contracting circle (Pokemon style room enter)
- **Diamond wipe:** Diamond shape expand from center (Fire Emblem map transition)
- **Fade through black:** Quick 300ms fade for minor transitions
- **Slide:** New scene slides in from direction (menu panels)
- **Iris:** Small circle at clicked position expands (for agent focus)
- **Pixel dissolve:** Random pixels disappear revealing new scene
- **Implementation:** Phaser camera fade + custom mask shapes via graphics

### 2C. Lighting System
**Bead:** `gta-vfx.3`

Dynamic per-tile lighting for depth and atmosphere:
- **Desk lamps:** Warm yellow cone from desk lamps (radial gradient overlay)
- **Monitor glow:** Cool blue/white rectangle in front of each active monitor
- **Window light:** Directional light from windows, shifts with day/night
- **Hallway lights:** Overhead fluorescent strips with occasional flicker
- **Emergency lighting:** Red pulsing during alerts/stuck agents
- **Implementation:** Light map texture rendered each frame, multiplied with scene
- **Shadow casting:** Walls block light, creating shadow zones in corridors

---

## Epic 3: Boot Sequence & Loading (NEW)

### 3A. Pixel Art Boot Sequence
**Bead:** `gta-boot.1`

When the page loads, don't show a blank screen — show a GBA boot sequence:
```
Frame 1 (0.5s):    Black screen
Frame 2 (1s):      "Gas Town" logo fades in (pixel art, centered)
Frame 3 (0.5s):    Logo shines (white highlight sweeps across)
Frame 4 (1s):      "PRESS START" blinks (like GBA title screens)
Frame 5:           Auto-proceed or click
Frame 6 (2s):      Console-style text scroll:
                     > Initializing engine...
                     > Loading rigs... [villa_ai_planogram, villa_alc_ai, gt_arcade]
                     > Spawning agents... 14 found
                     > Connecting to bridge server... OK
                     > World generation... COMPLETE
Frame 7 (0.5s):    Circle wipe transition into ArcadeScene
```

- **Logo:** Pixel art "GAS TOWN" with gear/wrench motif, 8-color palette
- **Sound:** Boot chime (if audio enabled), mechanical startup sounds
- **Skip:** Click or any key skips to game immediately
- **Cache:** Only show full sequence on first load, quick version on refresh

### 3B. Loading Screen Between Scenes
**Bead:** `gta-boot.2`

When switching between ArcadeScene, TownEditor, MeshWorldMap:
- **Loading bar:** Pixel art progress bar with animated fill
- **Tip text:** Random gameplay tips below the bar:
  - "Press SPACE to follow the nearest active agent"
  - "Click a polecat to see what they're working on"
  - "Try the Town Builder — press B to enter edit mode"
  - "Connect to other Gas Towns via Mesh Mode"
- **Character sprite:** Random agent idle animation next to loading bar
- **Background:** Subtle animated pattern (diagonal scrolling grid)

---

## Epic 4: Particle Effects (NEW)

### 4A. Agent Action Particles
**Bead:** `gta-pfx.1`

Particles that communicate what agents are doing:
- **Typing debris:** Tiny letter sprites (a, b, c, 0, 1) float up from keyboard
- **Code compile:** Green sparkles rise when an agent "builds" something
- **Merge:** Two streams of particles converge (for refinery merging)
- **Error/stuck:** Red exclamation particles, sweat drops
- **Break time:** Coffee cup steam + small hearts
- **Reading:** Small page/document sprites flip past face
- **Thinking:** Rotating gear sprites above head (2-3 small gears)
- **Celebration:** Confetti burst when a bead completes

### 4B. Environmental Particles
**Bead:** `gta-pfx.2`

Ambient particles that add life:
- **Dust motes:** Tiny bright dots drifting in sunbeams from windows
- **Footstep dust:** Small puff when agents walk (2-frame, quick fade)
- **Door use:** Small draft particles when agents go through doorways
- **Electrical sparks:** Occasional spark near server room / electrical panels
- **Smoke/steam:** Break room kitchen area, rising wispy particles
- **Firefly:** Tiny glowing dots outside windows at night (if outdoor area exists)

---

## Epic 5: Enhanced Agent Behaviors (NEW)

### 5A. Social Interactions
**Bead:** `gta-soc.1`

Agents aren't just working — they're people in an office:
- **Water cooler chat:** 2 agents meet at break area, speech bubbles appear
  - Bubbles show "..." typing animation, then brief emoji reactions
  - Chat duration: 10-20 seconds, then both return to desks
- **Hallway greeting:** When agents pass each other, small wave animation
- **Pair programming:** Two agents at adjacent desks, occasional "high five" particle
- **Meeting:** 3+ agents gather in meeting room, whiteboard gets scribbles
- **Lunch break:** Agents walk to break room, sit at table, eating animation

### 5B. Agent Mood & Energy
**Bead:** `gta-soc.2`

Visual indicators of agent state beyond just "working/idle":
- **Energy bar:** Tiny 3-segment bar under agent (green/yellow/red)
  - Depletes while working, refills during breaks
- **Mood emoji:** Periodic thought bubble with mood (determined by bead status)
  - Bead completing = happy star eyes
  - Long task = tired face
  - Stuck = frustrated swirl
  - Just deployed = sunglasses cool
- **Posture change:** Agent sprite shifts when energy low (slouch animation)
- **Speed variation:** Low energy = slower walking, high energy = bouncy walk

---

## Epic 6: Sound Design (Enhancement)

### 6A. Ambient Soundscape
**Bead:** `gta-snd.1`

Procedural ambient audio that responds to the world state:
- **Base layer:** Low office hum (fan noise, distant typing)
- **Activity layer:** More typing clicks when many agents working
- **Weather layer:** Rain patter, thunder rumble, wind howl
- **Time layer:** Crickets at night, birds at dawn
- **Proximity:** Sounds get louder near source (coffee machine gurgle near break room)
- **Implementation:** Web Audio API with layered oscillators and noise generators
- **Mix:** Each layer has independent volume, master volume in settings

### 6B. Interaction Sounds
**Bead:** `gta-snd.2`

Every interaction has a satisfying sound:
- **Camera move:** Soft swoosh (filtered noise burst)
- **Agent select:** Bright ping (sine wave, 800Hz, quick decay)
- **Agent deselect:** Lower ping (sine wave, 400Hz)
- **Panel open:** Slide-in whoosh (rising filtered noise)
- **Panel close:** Slide-out whoosh (falling filtered noise)
- **Polecat spawn:** Dramatic entrance (ascending arpeggio C-E-G-C')
- **Polecat despawn:** Descending arpeggio with reverb tail
- **Bead complete:** Fanfare (short 3-note victorious chord)
- **Error/alert:** Two-tone warning (alternating square waves)
- **Button hover:** Soft tick (very short click)
- **Button press:** Satisfying thunk (short noise burst with resonance)

---

## Epic 7: UI Enhancements (NEW)

### 7A. Mini-Map Widget
**Bead:** `gta-4ge` (already created)

Corner overlay showing the full town:
- **Position:** Bottom-right, 160x120px (GBA screen ratio)
- **Render:** Simplified color blocks for rooms, colored dots for agents
- **Viewport indicator:** White rectangle showing current camera view
- **Click to pan:** Click anywhere on minimap to move camera there
- **Agent tracking:** Active agent dots pulse, selected agent has ring
- **Toggle:** M key or minimap button, drag to resize
- **Style:** GBA-style pixel border, semi-transparent background

### 7B. Notification Toast System
**Bead:** `gta-ui.1`

In-game notifications as pixel art toast popups:
- **Position:** Top-right, stack downward
- **Style:** GBA dialog box (rounded pixel rect, dark border)
- **Categories:**
  - Agent events: "Furiosa completed gta-7xe.1" (green border)
  - Alerts: "Agent stuck: nux" (red border, pulsing)
  - System: "Mesh connection established" (blue border)
  - Mail: "New message from Mayor" (gold border)
- **Animation:** Slide in from right, auto-dismiss after 5s, click to dismiss
- **Queue:** Max 3 visible, overflow queued
- **Sound:** Each category has a unique chime

### 7C. Command Palette
**Bead:** `gta-ui.2`

Press `/` or `Ctrl+K` for a pixel art command palette:
- **Style:** GBA-style centered dialog, dark background overlay
- **Search:** Type to filter commands
- **Commands:**
  - `gt status` — show engine status overlay
  - `gt sling <bead>` — sling work
  - `bd list` — show beads panel
  - `attach <agent>` — focus camera on agent
  - `mesh connect` — open mesh panel
  - `build mode` — enter town builder
  - `settings` — open settings
- **Keyboard nav:** Arrow keys + Enter, Escape to close
- **Recents:** Shows last 5 commands used

---

## Epic 8: Advanced Game World (NEW)

### 8A. Outdoor Area
**Bead:** `gta-world.1`

The office building has an exterior! Beyond the walls:
- **Parking lot:** Tiny pixel art cars, lamp posts
- **Garden:** Small pixel garden with bench, tree, flowers
- **Smoking area:** Agents on break wander outside
- **Delivery area:** Where polecats "arrive" (van drives in, polecat hops out)
- **Path to portal:** Walkway leading to mesh portal at edge of map
- **Sky:** Visible sky tiles at top of map (clouds drift, day/night colors)
- **Implementation:** Extend world generation to include outdoor tiles beyond office walls

### 8B. Server Room
**Bead:** `gta-world.2`

A special room with unique visual treatment:
- **Blinking lights:** Rows of server racks with randomly blinking LEDs (green/amber/red)
- **Temperature visual:** Heat shimmer effect (subtle wave distortion)
- **Cable runs:** Colored lines running along floor to desks
- **The Deacon lives here:** Deacon agent is usually found in server room
- **Alert state:** Room goes red when system issues detected
- **Ambient sound:** Louder fan hum, mechanical clicking

### 8C. Elevator / Floor System
**Bead:** `gta-world.3`

If we have many rigs, expand vertically:
- **Elevator:** Clickable elevator sprite at building edge
- **Floor indicator:** Small display showing current floor number
- **Each floor = 1 rig:** Floor 1 = villa_ai_planogram, Floor 2 = villa_alc_ai, etc.
- **Transition:** Circle wipe when changing floors
- **Floor plan mini-map:** Shows which floor you're on
- **Cross-floor agents:** Agents can "visit" other floors (walk to elevator, ride up/down)

---

## Implementation Priority (Overnight)

### Wave 1: Immediate (sling now)
| Bead | Task | Target |
|------|------|--------|
| gta-19b.2 | Mesh client integration | polecat (SLUNG) |
| gta-547.2 | Room/furniture palette | polecat (SLUNG) |

### Wave 2: Create & sling as polecats free up
| Bead | Task | Priority |
|------|------|----------|
| gta-atm.1 | Day/night cycle | P1 |
| gta-vfx.2 | Screen transitions | P1 |
| gta-boot.1 | Boot sequence | P1 |
| gta-pfx.1 | Agent action particles | P1 |
| gta-soc.1 | Social interactions | P1 |

### Wave 3: gt-docker assignments (GitHub issues)
| Issue | Task | Priority |
|-------|------|----------|
| #32 | Agent task overlay | P1 |
| #33 | Save/load system | P1 |
| #34 | GBA audio system | P1 |

### Wave 4: Backlog (create beads, sling when capacity opens)
| Task | Priority |
|------|----------|
| Weather system | P1 |
| CRT scanline shader | P2 |
| Lighting system | P2 |
| Ambient life details | P2 |
| Loading screen | P2 |
| Notification toasts | P1 |
| Command palette | P2 |
| Outdoor area | P2 |
| Environmental particles | P2 |
| Ambient soundscape | P2 |
| Agent mood & energy | P2 |
| Server room | P2 |
| Elevator/floor system | P2 |

---

## Art Direction Notes

### Color Palette Constraint
Limit each scene to a **32-color palette** (extended GBA):
- 8 earth tones (floors, walls, wood)
- 6 skin/hair tones
- 4 accent colors (UI highlights, status indicators)
- 4 nature (greens, sky blue, water)
- 4 technology (monitor blues, LED colors)
- 4 atmosphere (shadow, highlight, warm tint, cool tint)
- 2 pure (black, white)

### Pixel Density Rules
- **Sprites:** 1 game pixel = 2-3 screen pixels (crisp, readable)
- **UI text:** ArkPixel font only, no anti-aliasing
- **Borders:** Always 1-2px, never sub-pixel
- **Shadows:** Drop shadows are 1px offset, 50% opacity darker shade
- **No gradients** in game world (flat shading only)
- **Gradients OK** in sky/atmosphere overlays

### Animation Frame Counts
- **Idle:** 2-4 frames, 500ms per frame (subtle breathing)
- **Walk:** 4 frames per direction, 150ms per frame
- **Action:** 2-6 frames, varies by action type
- **Particles:** 3-5 frames, 100ms per frame
- **UI:** 2-3 frames for hover/press states

---

## Success Criteria

The game should pass the **"show someone" test:**
1. Someone glances at the screen and says "what game is that?"
2. They lean in to look at the details
3. They notice something new every time they look
4. They want to interact with everything
5. They forget they're looking at a DevOps dashboard

_That's when we know we've nailed it._
