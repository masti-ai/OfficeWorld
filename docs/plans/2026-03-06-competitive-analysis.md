# Competitive Analysis: GT Arcade vs Pixel Agents vs AgentOffice

**Date:** 2026-03-06
**Author:** gt_arcade/crew/manager (creative director)

---

## Competitors

### Pixel Agents (VS Code Extension)
- **What it does:** Pixel characters in VS Code representing Claude Code terminals
- **Strengths:** Office layout editor, 6 diverse characters, activity-based animations
- **Weaknesses:** Agent-terminal sync desyncs, status detection misfires, Windows-only, paid tileset
- **URL:** github.com/pablodelucca/pixel-agents

### AgentOffice (Phaser + React)
- **What it does:** Self-growing AI teams in pixel art virtual office
- **Strengths:** Focus mode camera, inspector panel, task board, self-hiring agents
- **Weaknesses:** Local-only (Ollama), no multi-town/mesh, limited visual polish
- **URL:** dev.to/harishkotra/agentoffice

---

## Our Advantages (GT Arcade / OfficeWorld)

| Feature | Us | Pixel Agents | AgentOffice |
|---------|-----|--------------|-------------|
| Multi-rig (multiple projects) | YES | No | No |
| Mesh multiplayer (cross-town) | YES | No | No |
| Day/night cycle | YES | No | No |
| Weather system | YES | No | No |
| Boot sequence | YES | No | No |
| Screen transitions | YES | No | No |
| Particle effects | YES | No | No |
| Town builder | YES | Basic editor | Basic editor |
| GBA design system | YES | Generic pixel | Generic pixel |
| Notification toasts | YES | Sound only | Text only |
| Real cost tracking | YES | No | No |
| Bead/task integration | YES | No | Task board |
| Convoy/workflow tracking | YES | No | No |
| Refinery (merge queue) | YES | No | No |
| Agent focus mode | BUILDING | No | YES |
| Inspector panel | BUILDING | No | YES |
| Activity animations | BUILDING | YES | Basic |
| Agent thought bubbles | BUILDING | Speech bubbles | No |
| Juice (screen shake etc) | BUILDING | No | No |
| Hover tooltips | BUILDING | No | No |
| Interactive environment | BUILDING | No | No |

---

## What They Have That We Need

1. **Inspector panel** (AgentOffice) -> gta-rux (assigned to gt-docker #43)
2. **Activity log** (AgentOffice) -> gta-oep (assigned to gt-docker #44)
3. **Focus mode camera** (AgentOffice) -> gta-tm5 (polecat rictus working)
4. **Activity animations** (Pixel Agents) -> gta-cf3 (polecat cheedo working)
5. **Layout editor** (Pixel Agents) -> gta-67c (backlog)
6. **Sound notifications** (Pixel Agents) -> gta-7xe.3 (backlog, also gt-docker #34)

---

## Our Unique Differentiators (What NOBODY Else Has)

1. **Mesh Multiplayer** — Connect multiple Gas Towns via portals. Nobody else does cross-instance agent coordination visualization.
2. **Atmospheric Systems** — Day/night + weather + particles = living world. Competitors have static scenes.
3. **GBA Design System** — Cohesive retro aesthetic vs. generic pixel art. Intentional art direction.
4. **Production Infrastructure** — Beads, convoys, refinery, witness. Real devops visualization, not toy demos.
5. **Cost Tracking** — Real-time cost monitoring per agent, role, rig. Financial awareness built in.
6. **Scale** — 3 rigs, 20+ agents, polecats spawning/despawning dynamically. Not a 3-agent demo.

---

## Strategy: Where to Double Down

### "Feel" > "Features"
Both competitors have features but lack FEEL. Our GBA aesthetic, juice system, particles, day/night, weather — this is what makes someone say "what game is that?" Nobody leans in to look at a status dashboard.

### Focus on the "show someone" test
Can you screenshot GT Arcade and make someone jealous? That's the bar.

### Depth over breadth
Rather than adding 20 shallow features, make 5 features deeply polished:
1. Agent visualization (animations + thought bubbles + particles)
2. Atmospheric systems (day/night + weather + ambient life)
3. Town builder (room editor + furniture + persistence)
4. Mesh multiplayer (portals + world map + couriers)
5. GBA UI polish (boot sequence + transitions + toasts + juice)
