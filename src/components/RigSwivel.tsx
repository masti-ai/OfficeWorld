import { useState } from 'react'

const RIGS = [
  { id: 'planogram', name: 'Planogram', color: '#3a7bd5', icon: '📊' },
  { id: 'alc_ai', name: 'ALC AI', color: '#4caf50', icon: '🧪' },
  { id: 'arcade', name: 'Arcade', color: '#9c27b0', icon: '🕹' },
]

export function RigSwivel({
  activeRig,
  onRigSelect,
}: {
  activeRig: string
  onRigSelect: (rigId: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div style={{
      display: 'flex',
      gap: 2,
      padding: '4px 8px',
      background: '#0a0a1a',
      borderBottom: '1px solid #1a1a3e',
    }}>
      {RIGS.map((rig) => {
        const isActive = activeRig === rig.id
        const isHovered = hovered === rig.id
        return (
          <button
            key={rig.id}
            onClick={() => onRigSelect(rig.id)}
            onMouseEnter={() => setHovered(rig.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: isActive ? '#1a1a3e' : isHovered ? '#12122e' : 'transparent',
              border: isActive ? `1px solid ${rig.color}55` : '1px solid transparent',
              borderBottom: isActive ? `2px solid ${rig.color}` : '2px solid transparent',
              color: isActive ? rig.color : '#666',
              padding: '4px 12px',
              fontSize: 10,
              fontFamily: 'monospace',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s',
            }}
          >
            <span>{rig.icon}</span>
            <span>{rig.name}</span>
          </button>
        )
      })}
    </div>
  )
}
