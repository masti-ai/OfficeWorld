import { useEffect, useState, useMemo } from 'react'
import { THEME } from '../constants'

interface ActivityItem {
  type: 'commit' | 'pr_merge' | 'issue_close' | 'issue_open' | 'pr_open'
  repo: string
  title: string
  author: string
  model: string
  date: string
  sha?: string
  number?: number
}

interface HeatmapEntry {
  timestamp: number
  contributions: number
}

interface ModelStat {
  name: string
  commits: number
  pct: number
}

interface GiteaActivityPanelProps {
  visible: boolean
  onClose: () => void
}

const TYPE_ICONS: Record<string, string> = {
  commit: '\u{25CF}',
  pr_merge: '\u{21C8}',
  issue_close: '\u{2713}',
  issue_open: '\u{25CB}',
  pr_open: '\u{21C5}',
}

const TYPE_COLORS: Record<string, string> = {
  commit: THEME.green,
  pr_merge: THEME.cyan,
  issue_close: THEME.gold,
  issue_open: THEME.orange,
  pr_open: THEME.purple,
}

const TYPE_LABELS: Record<string, string> = {
  commit: 'COMMIT',
  pr_merge: 'PR MERGE',
  issue_close: 'CLOSED',
  issue_open: 'OPENED',
  pr_open: 'PR',
}

const MODEL_COLORS: Record<string, string> = {
  Claude: '#c084fc',
  MiniMax: '#53d8fb',
  Kimi: '#22c55e',
  Human: '#ffd700',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}

// --- Contribution Heatmap ---

function ContributionHeatmap({ entries }: { entries: HeatmapEntry[] }) {
  // Build a 52-week × 7-day grid (like GitHub/Gitea)
  const grid = useMemo(() => {
    if (entries.length === 0) return { weeks: [], maxVal: 0 }

    const now = new Date()
    const dayMs = 86400 * 1000
    // Go back 365 days
    const start = new Date(now.getTime() - 364 * dayMs)
    start.setHours(0, 0, 0, 0)
    // Align to start of week (Sunday)
    const startDay = start.getDay()
    start.setDate(start.getDate() - startDay)

    // Build lookup from timestamp to contributions
    const lookup = new Map<string, number>()
    for (const e of entries) {
      const d = new Date(e.timestamp * 1000)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      lookup.set(key, (lookup.get(key) || 0) + e.contributions)
    }

    const weeks: Array<Array<{ date: Date; count: number }>> = []
    let maxVal = 0
    let current = new Date(start)

    for (let w = 0; w < 53; w++) {
      const week: Array<{ date: Date; count: number }> = []
      for (let d = 0; d < 7; d++) {
        const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`
        const count = lookup.get(key) || 0
        if (count > maxVal) maxVal = count
        week.push({ date: new Date(current), count })
        current.setDate(current.getDate() + 1)
      }
      weeks.push(week)
    }

    return { weeks, maxVal }
  }, [entries])

  function getColor(count: number): string {
    if (count === 0) return '#161b22'
    const { maxVal } = grid
    if (maxVal === 0) return '#161b22'
    const intensity = count / maxVal
    if (intensity > 0.75) return '#39d353'
    if (intensity > 0.5) return '#26a641'
    if (intensity > 0.25) return '#006d32'
    return '#0e4429'
  }

  const cellSize = 9
  const cellGap = 2

  return (
    <div style={{ overflowX: 'auto', padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: cellGap, minWidth: 'fit-content' }}>
        {grid.weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date.toLocaleDateString()}: ${day.count} contributions`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: getColor(day.count),
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        fontSize: 9,
        color: THEME.textMuted,
      }}>
        <span>Less</span>
        {['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'].map((c, i) => (
          <div key={i} style={{ width: cellSize, height: cellSize, background: c, borderRadius: 1 }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// --- Model Breakdown Bar ---

function ModelBreakdown({ models }: { models: ModelStat[] }) {
  const total = models.reduce((a, m) => a + m.commits, 0)
  if (total === 0) return <div style={{ color: THEME.textMuted, fontSize: 10 }}>No data</div>

  return (
    <div>
      {/* Stacked bar */}
      <div style={{
        display: 'flex',
        height: 18,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${THEME.borderPanel}`,
        marginBottom: 8,
      }}>
        {models.filter(m => m.commits > 0).map((m) => (
          <div
            key={m.name}
            title={`${m.name}: ${m.commits} commits (${m.pct}%)`}
            style={{
              width: `${m.pct}%`,
              background: MODEL_COLORS[m.name] || THEME.textMuted,
              minWidth: m.pct > 0 ? 2 : 0,
              transition: 'width 0.5s ease',
            }}
          />
        ))}
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {models.filter(m => m.commits > 0).map((m) => (
          <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: 1,
              background: MODEL_COLORS[m.name] || THEME.textMuted,
            }} />
            <span style={{ fontSize: 10, color: THEME.textPrimary }}>{m.name}</span>
            <span style={{ fontSize: 9, color: THEME.textMuted }}>{m.commits} ({m.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main Panel ---

export function GiteaActivityPanel({ visible, onClose }: GiteaActivityPanelProps) {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([])
  const [models, setModels] = useState<ModelStat[]>([])
  const [tab, setTab] = useState<'feed' | 'heatmap' | 'models'>('feed')
  const [loading, setLoading] = useState(true)
  const [repoFilter, setRepoFilter] = useState<string>('all')

  useEffect(() => {
    if (!visible) return
    setLoading(true)

    Promise.all([
      fetch('/api/gitea/activity').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/gitea/heatmap').then(r => r.json()).catch(() => ({ heatmap: [] })),
      fetch('/api/gitea/contributions').then(r => r.json()).catch(() => ({ models: [] })),
    ]).then(([actRes, heatRes, contRes]) => {
      setActivity(actRes.items || [])
      setHeatmap(heatRes.heatmap || [])
      setModels(contRes.models || [])
      setLoading(false)
    })
  }, [visible])

  if (!visible) return null

  const repos = useMemo(() => {
    const set = new Set(activity.map(a => a.repo))
    return ['all', ...Array.from(set).sort()]
  }, [activity])

  const filteredActivity = repoFilter === 'all'
    ? activity
    : activity.filter(a => a.repo === repoFilter)

  const totalContributions = heatmap.reduce((a, e) => a + e.contributions, 0)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 780,
        height: 560,
        background: THEME.bgDark,
        border: `2px solid ${THEME.borderAccent}`,
        boxShadow: `0 0 24px rgba(100, 71, 125, 0.4), inset 0 0 40px rgba(0,0,0,0.3)`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: THEME.fontFamily,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${THEME.borderPanel}`,
          background: THEME.bgHeader,
        }}>
          <div style={{
            color: THEME.green,
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 2,
          }}>
            GITEA ACTIVITY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: THEME.textMuted }}>
              {totalContributions} contributions
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: THEME.red,
                fontFamily: THEME.fontFamily,
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${THEME.borderDark}`,
          background: THEME.bgPanel,
        }}>
          {(['feed', 'heatmap', 'models'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                background: tab === t ? THEME.bgDark : 'transparent',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${THEME.green}` : '2px solid transparent',
                color: tab === t ? THEME.green : THEME.textMuted,
                fontFamily: THEME.fontFamily,
                fontSize: 10,
                padding: '6px 0',
                cursor: 'pointer',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t === 'feed' ? 'Activity Feed' : t === 'heatmap' ? 'Contribution Graph' : 'Model Breakdown'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: THEME.textMuted,
              fontSize: 11,
            }}>
              Loading Gitea data...
            </div>
          ) : (
            <>
              {/* Feed tab */}
              {tab === 'feed' && (
                <>
                  {/* Repo filter */}
                  <div style={{
                    display: 'flex',
                    gap: 2,
                    padding: '4px 12px',
                    borderBottom: `1px solid ${THEME.borderDark}`,
                    flexWrap: 'wrap',
                  }}>
                    {repos.map(r => (
                      <button
                        key={r}
                        onClick={() => setRepoFilter(r)}
                        style={{
                          background: repoFilter === r ? THEME.green : 'transparent',
                          border: `1px solid ${repoFilter === r ? THEME.green : THEME.borderDark}`,
                          color: repoFilter === r ? '#000' : THEME.textMuted,
                          fontFamily: THEME.fontFamily,
                          fontSize: 9,
                          padding: '1px 6px',
                          cursor: 'pointer',
                          letterSpacing: 1,
                        }}
                      >
                        {r === 'all' ? 'ALL' : r}
                      </button>
                    ))}
                  </div>
                  {/* Activity list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {filteredActivity.length === 0 ? (
                      <div style={{
                        color: THEME.textMuted,
                        fontSize: 10,
                        padding: '20px 12px',
                        textAlign: 'center',
                      }}>
                        No activity found
                      </div>
                    ) : (
                      filteredActivity.map((item, i) => (
                        <div
                          key={`${item.type}-${item.sha || item.number}-${i}`}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 6,
                            padding: '3px 12px',
                            fontSize: 10,
                            lineHeight: 1.5,
                            borderBottom: `1px solid ${THEME.borderDark}`,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = THEME.bgPanel }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <span style={{
                            color: TYPE_COLORS[item.type] || THEME.textMuted,
                            fontSize: 10,
                            flexShrink: 0,
                            marginTop: 1,
                            width: 12,
                            textAlign: 'center',
                          }}>
                            {TYPE_ICONS[item.type] || '\u{25CF}'}
                          </span>
                          <span style={{
                            color: TYPE_COLORS[item.type] || THEME.textMuted,
                            fontSize: 8,
                            fontWeight: 'bold',
                            letterSpacing: 1,
                            width: 58,
                            flexShrink: 0,
                            marginTop: 2,
                          }}>
                            {TYPE_LABELS[item.type]}
                          </span>
                          <span style={{
                            color: THEME.cyan,
                            fontSize: 9,
                            flexShrink: 0,
                            width: 80,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.repo}
                          </span>
                          <span style={{
                            color: THEME.textPrimary,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.title}
                          </span>
                          <span style={{
                            color: MODEL_COLORS[item.model] || THEME.textMuted,
                            fontSize: 8,
                            flexShrink: 0,
                            width: 44,
                            textAlign: 'right',
                          }}>
                            {item.model}
                          </span>
                          <span style={{
                            color: THEME.textMuted,
                            fontSize: 9,
                            flexShrink: 0,
                            width: 50,
                            textAlign: 'right',
                          }}>
                            {formatDate(item.date)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* Heatmap tab */}
              {tab === 'heatmap' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
                  <div style={{
                    color: THEME.textSecondary,
                    fontSize: 11,
                    marginBottom: 8,
                  }}>
                    {totalContributions} contributions across all repos
                  </div>
                  <ContributionHeatmap entries={heatmap} />
                  <div style={{
                    marginTop: 16,
                    padding: '8px',
                    background: THEME.crtBg,
                    border: `1px solid ${THEME.crtGreenDim}`,
                  }}>
                    <div style={{
                      color: THEME.crtGreenDim,
                      fontSize: 9,
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}>
                      CONTRIBUTION STATS
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 18, color: THEME.crtGreen, fontWeight: 'bold', textShadow: THEME.phosphorGlowSubtle }}>
                          {totalContributions}
                        </div>
                        <div style={{ fontSize: 9, color: THEME.crtGreenDim }}>TOTAL</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, color: THEME.crtGreen, fontWeight: 'bold', textShadow: THEME.phosphorGlowSubtle }}>
                          {heatmap.length > 0 ? Math.max(...heatmap.map(h => h.contributions)) : 0}
                        </div>
                        <div style={{ fontSize: 9, color: THEME.crtGreenDim }}>PEAK DAY</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, color: THEME.crtGreen, fontWeight: 'bold', textShadow: THEME.phosphorGlowSubtle }}>
                          {heatmap.filter(h => h.contributions > 0).length}
                        </div>
                        <div style={{ fontSize: 9, color: THEME.crtGreenDim }}>ACTIVE DAYS</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Models tab */}
              {tab === 'models' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
                  <div style={{
                    color: THEME.textSecondary,
                    fontSize: 11,
                    marginBottom: 12,
                  }}>
                    Commit attribution by AI model (from Co-Authored-By trailers)
                  </div>
                  <ModelBreakdown models={models} />
                  {/* Per-model detail cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 8,
                    marginTop: 16,
                  }}>
                    {models.filter(m => m.commits > 0).map(m => (
                      <div key={m.name} style={{
                        background: THEME.crtBg,
                        border: `1px solid ${MODEL_COLORS[m.name] || THEME.borderPanel}`,
                        padding: '8px 10px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}>
                          <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: MODEL_COLORS[m.name] || THEME.textMuted,
                          }} />
                          <span style={{
                            color: MODEL_COLORS[m.name] || THEME.textPrimary,
                            fontSize: 11,
                            fontWeight: 'bold',
                          }}>
                            {m.name}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 20,
                          color: THEME.textBright,
                          fontWeight: 'bold',
                        }}>
                          {m.commits}
                        </div>
                        <div style={{ fontSize: 9, color: THEME.textMuted }}>
                          commits ({m.pct}%)
                        </div>
                        {/* Mini progress bar */}
                        <div style={{
                          marginTop: 4,
                          width: '100%',
                          height: 3,
                          background: '#0a1a0a',
                          border: `1px solid ${THEME.borderDark}`,
                        }}>
                          <div style={{
                            width: `${m.pct}%`,
                            height: '100%',
                            background: MODEL_COLORS[m.name] || THEME.textMuted,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '4px 12px',
          borderTop: `1px solid ${THEME.borderPanel}`,
          background: THEME.bgPanel,
          fontSize: 9,
          color: THEME.textMuted,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>G = toggle | Esc = close</span>
          <span>Source: Gitea API</span>
        </div>
      </div>
    </div>
  )
}
