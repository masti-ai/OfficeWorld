# OfficeWorld

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Phaser](https://img.shields.io/badge/Phaser-3.80-blueviolet?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABzSURBVDhPY/hPAGBioBBQ3dH/DAwM/6GYGMDEQASg2FES0g4o4OjoCAYMDAz/GRkZQZgBDzA6OjqQJxUFAAAAAElFTkSuQmCC)](https://phaser.io/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Watch your AI agents work in a retro isometric office.**

OfficeWorld is an isometric pixel art simulation where AI agents come alive in a virtual office. Powered by Phaser 3 and React, it renders a GBA-inspired workspace where you can observe agents typing, collaborating, taking breaks, and responding to real-time events via WebSocket.

Think *Gather Town* meets *Game Boy Advance* — but for your AI team.

> **Fun fact:** The agents you see working in OfficeWorld actually helped build OfficeWorld. This project is uniquely built *by* AI agents — the very agents it simulates. Meta? We think so too.

<p align="center">
  <em>Screenshots coming soon</em>
</p>

---

## Features

- **Isometric Pixel Art Office** — Hand-crafted GBA-inspired aesthetic with isometric tile rendering
- **Real-Time Agent State** — WebSocket-powered live updates show what each agent is doing right now
- **Day/Night Cycle** — Time passes in the office with smooth lighting transitions
- **Weather System** — Rain, snow, and atmospheric effects that change the mood
- **Ambient Particle Effects** — Dust motes, screen glow, coffee steam, and environmental particles
- **Character Editor** — Customize agent appearances with a sprite trait system
- **Town Editor** — Build and arrange custom office layouts with a drag-and-drop tile editor
- **Save/Load System** — Full game state serialization with multiple save slots
- **Activity Log** — Scrollable feed of everything happening in the office
- **Session Viewer** — Inspect individual agent work sessions in detail
- **Gitea Activity Feed** — Live git commit and PR activity integrated into the office view
- **GBA-Styled UI** — Pixel-perfect panels, menus, and buttons inspired by classic handhelds
- **CRT Shader** — Optional retro CRT post-processing effect
- **Keyboard Shortcuts** — Configurable keybindings for power users
- **Boot Sequence** — Nostalgic startup animation when the app loads

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/masti-ai/OfficeWorld.git
cd OfficeWorld

# Install dependencies
npm install

# Start the dev server (frontend on port 3200)
npm run dev

# In another terminal, start the backend server (port 3201)
npm run server
```

Open `http://localhost:3200` in your browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Engine | [Phaser 3](https://phaser.io/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| UI Framework | [React 18](https://react.dev/) |
| Bundler | [Vite](https://vitejs.dev/) |
| Backend | [Express](https://expressjs.com/) + [ws](https://github.com/websockets/ws) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Terminal | [xterm.js](https://xtermjs.org/) |

---

## Architecture

```
src/
  game/
    ArcadeScene.ts          # Main Phaser scene — agents, tiles, interactions
    MeshWorldMapScene.ts    # Multi-office world map view
    CameraController.ts     # Smooth isometric camera with zoom
    editor/                 # Town editor scene and tools
    sprites/                # Character sprite generation and animation
    systems/                # Modular game systems (see below)
    shaders/                # CRT post-processing shader
    transitions/            # Screen transition effects
    world/                  # World building, pathfinding, room generation
  components/
    App.tsx                 # Root React component with Phaser integration
    StatusHUD.tsx           # Top bar with time, weather, agent counts
    BottomPanels.tsx        # Tabbed bottom panel container
    Sidebar.tsx             # Side navigation
    TerminalPanel.tsx       # Embedded xterm.js terminal
    SessionViewer.tsx       # Agent session detail view
    ActivityLogPanel.tsx    # Live activity feed
    CharacterCustomizationPanel.tsx  # Sprite trait editor
    SaveLoadPanel.tsx       # Save/load game state UI
    GiteaActivityPanel.tsx  # Git activity feed
    InspectorPanel.tsx      # Agent inspector
    SettingsPanel.tsx       # Preferences and keybindings
    BootSequence.tsx        # Startup animation
    gba/                    # GBA-styled reusable UI primitives
  api/                      # API client utilities
  audio/                    # Ambient audio system
  fonts/                    # Pixel fonts
server/
  index.ts                  # Express + WebSocket server
  db.ts                     # SQLite persistence layer
```

---

## Systems

OfficeWorld is built around modular game systems that run each frame inside the Phaser update loop.

| System | Description |
|--------|-------------|
| **DayNightSystem** | Tracks in-game time and smoothly transitions ambient lighting between dawn, day, dusk, and night |
| **WeatherSystem** | Generates rain, snow, and atmospheric conditions with particle effects |
| **EnvironmentalParticleSystem** | Dust motes, light shafts, and ambient floating particles |
| **AmbientLifeSystem** | Background office life — flickering monitors, spinning fans, subtle movement |
| **AgentParticleSystem** | Per-agent effects like typing sparks, focus auras, and status indicators |
| **DailyRoutineSystem** | Drives agent schedules — work blocks, coffee breaks, meetings, end of day |
| **SocialSystem** | Agent-to-agent interactions, water cooler chats, pair programming |
| **ThoughtBubbleSystem** | Floating thought/status bubbles above agent heads |
| **ActivityAnimationSystem** | Context-specific animations (typing, reading, running commands) |
| **TaskOverlaySystem** | Visual task cards and progress indicators floating near agents |
| **BeadSystem** | Tracks work items and renders them as in-world objects |
| **PolecatSystem** | Spawns and manages sub-agent (polecat) sprites |
| **FocusSystem** | Camera focus and spotlight effects for selected agents |
| **JuiceSystem** | Screen shake, flash, and other "game feel" effects |
| **HoverTooltipSystem** | Context-aware tooltips on mouse hover |
| **InteractiveEnvironmentSystem** | Clickable office objects — whiteboards, coffee machines, monitors |

---

## Configuration

The backend server accepts these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3201` | Backend server port |
| `TOWN_ID` | `gt-local` | Unique identifier for this office instance |
| `TOWN_NAME` | `Gas Town` | Display name shown in the UI |

The frontend dev server runs on port `3200` by default (configurable via Vite).

---

## Contributing

Contributions are welcome! Whether it's new game systems, UI improvements, pixel art, or bug fixes.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/cool-thing`)
3. Make your changes
4. Run `npm run build` to verify everything compiles
5. Open a pull request

### Ideas for Contributions

- New weather effects (fog, thunderstorm, cherry blossoms)
- Additional ambient life animations
- Sound effects and music
- New office furniture and room themes
- Mobile touch controls
- Multiplayer office viewing
- Agent mood/energy visualization

---

## Created By

Built by [Pratham Bhatnagar](https://github.com/pratham-bhatnagar) and a team of AI agents at [Deepwork AI](https://github.com/masti-ai).

---

## Support

If you like OfficeWorld, give it a star! It helps others discover the project and motivates us to keep building.

[![Star on GitHub](https://img.shields.io/github/stars/masti-ai/OfficeWorld?style=social)](https://github.com/masti-ai/OfficeWorld)

---

## License

[MIT](LICENSE) - Copyright 2026 [Pratham Bhatnagar](https://github.com/pratham-bhatnagar) / [Deepwork AI](https://github.com/masti-ai)
