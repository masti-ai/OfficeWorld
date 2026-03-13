import { TileData } from '../../types'

interface Node {
  x: number
  y: number
  g: number
  h: number
  f: number
  parent: Node | null
}

/** A* pathfinding on the tile grid (4-directional) */
export function findPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  grid: TileData[][],
): { x: number; y: number }[] {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  if (!isValid(end.x, end.y, cols, rows, grid)) return []

  const openSet: Node[] = []
  const closedSet = new Set<string>()

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattan(start, end),
    f: manhattan(start, end),
    parent: null,
  }
  openSet.push(startNode)

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  let iterations = 0
  const maxIterations = 5000

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++

    // Find node with lowest f
    let lowestIdx = 0
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i
    }
    const current = openSet.splice(lowestIdx, 1)[0]

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current)
    }

    closedSet.add(key(current.x, current.y))

    for (const dir of dirs) {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy

      if (!isValid(nx, ny, cols, rows, grid)) continue
      if (closedSet.has(key(nx, ny))) continue

      const g = current.g + 1
      const h = manhattan({ x: nx, y: ny }, end)
      const f = g + h

      const existing = openSet.find((n) => n.x === nx && n.y === ny)
      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = f
          existing.parent = current
        }
      } else {
        openSet.push({ x: nx, y: ny, g, h, f, parent: current })
      }
    }
  }

  return [] // No path found
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function key(x: number, y: number): string {
  return `${x},${y}`
}

function isValid(x: number, y: number, cols: number, rows: number, grid: TileData[][]): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows && grid[y][x].walkable
}

function reconstructPath(node: Node): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = []
  let current: Node | null = node
  while (current) {
    path.unshift({ x: current.x, y: current.y })
    current = current.parent
  }
  return path
}
