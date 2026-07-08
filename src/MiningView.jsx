import React, { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import dagre from 'dagre'
import { UploadCloud, FileDown, Sparkles } from 'lucide-react'

const SAMPLE_CSV = `case_id,activity,timestamp
1001,Create Purchase Request,2026-06-01T09:00:00
1001,Approve Request,2026-06-01T11:30:00
1001,Select Supplier,2026-06-01T14:00:00
1001,Create Purchase Order,2026-06-02T09:15:00
1001,Receive Goods,2026-06-05T10:00:00
1001,Process Invoice,2026-06-06T13:00:00
1002,Create Purchase Request,2026-06-01T10:00:00
1002,Approve Request,2026-06-02T09:00:00
1002,Select Supplier,2026-06-02T12:00:00
1002,Create Purchase Order,2026-06-03T08:00:00
1002,Process Invoice,2026-06-08T09:00:00
1003,Create Purchase Request,2026-06-02T09:00:00
1003,Reject Request,2026-06-02T15:00:00
1004,Create Purchase Request,2026-06-03T09:00:00
1004,Approve Request,2026-06-03T10:00:00
1004,Select Supplier,2026-06-03T13:00:00
1004,Create Purchase Order,2026-06-04T09:00:00
1004,Expedite Shipping,2026-06-05T09:00:00
1004,Receive Goods,2026-06-07T10:00:00
1004,Process Invoice,2026-06-09T11:00:00
1005,Create Purchase Request,2026-06-04T09:00:00
1005,Approve Request,2026-06-04T13:00:00
1005,Select Supplier,2026-06-04T15:00:00
1005,Create Purchase Order,2026-06-05T09:00:00
1005,Receive Goods,2026-06-09T10:00:00
1005,Process Invoice,2026-06-10T09:00:00
`

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatDuration(ms) {
  if (!isFinite(ms) || ms <= 0) return '—'
  const hours = ms / 36e5
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} days`
}

function computeAnalysis(rawRows, mapping, modelTaskNames) {
  const events = rawRows
    .map((r) => ({
      caseId: String(r[mapping.case] ?? '').trim(),
      activity: String(r[mapping.activity] ?? '').trim(),
      time: new Date(r[mapping.timestamp]),
    }))
    .filter((e) => e.caseId && e.activity && !isNaN(e.time.getTime()))

  if (!events.length) {
    return { error: 'No valid rows after mapping. Check that the selected columns match the file.' }
  }

  const byCase = new Map()
  for (const e of events) {
    if (!byCase.has(e.caseId)) byCase.set(e.caseId, [])
    byCase.get(e.caseId).push(e)
  }
  for (const list of byCase.values()) list.sort((a, b) => a.time - b.time)

  const edgeCounts = new Map()
  const activityCounts = new Map()
  const startCounts = new Map()
  const endCounts = new Map()
  const variantCounts = new Map()
  const durations = []

  for (const list of byCase.values()) {
    const seq = list.map((e) => e.activity)
    const variantKey = seq.join(' → ')
    variantCounts.set(variantKey, (variantCounts.get(variantKey) || 0) + 1)

    startCounts.set(seq[0], (startCounts.get(seq[0]) || 0) + 1)
    endCounts.set(seq[seq.length - 1], (endCounts.get(seq[seq.length - 1]) || 0) + 1)
    durations.push(list[list.length - 1].time - list[0].time)

    for (const a of seq) activityCounts.set(a, (activityCounts.get(a) || 0) + 1)
    for (let i = 0; i < seq.length - 1; i++) {
      const key = `${seq[i]}||${seq[i + 1]}`
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1)
    }
  }

  const activities = [...activityCounts.keys()]
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length

  const logSet = new Set(activities.map((a) => a.toLowerCase()))
  const modelSet = new Set((modelTaskNames || []).map((a) => a.toLowerCase()))

  return {
    caseCount: byCase.size,
    eventCount: events.length,
    activityCount: activities.length,
    variantCount: variantCounts.size,
    avgDuration,
    activityCounts,
    edgeCounts,
    startCounts,
    endCounts,
    topVariants: [...variantCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    onlyInLog: activities.filter((a) => !modelSet.has(a.toLowerCase())),
    onlyInModel: (modelTaskNames || []).filter((a) => !logSet.has(a.toLowerCase())),
    inBoth: activities.filter((a) => modelSet.has(a.toLowerCase())),
  }
}

function computeLayout(analysis) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 22, ranksep: 64, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))

  g.setNode('__start__', { width: 64, height: 34, label: 'Start', kind: 'terminal' })
  g.setNode('__end__', { width: 64, height: 34, label: 'End', kind: 'terminal' })

  for (const activity of analysis.activityCounts.keys()) {
    const width = Math.max(96, Math.min(190, activity.length * 7.4))
    g.setNode(activity, { width, height: 46, label: activity, kind: 'activity' })
  }

  const allCounts = [...analysis.edgeCounts.values(), ...analysis.startCounts.values(), ...analysis.endCounts.values()]
  const maxEdge = Math.max(...allCounts, 1)

  for (const [key, count] of analysis.edgeCounts.entries()) {
    const [from, to] = key.split('||')
    g.setEdge(from, to, { count })
  }
  for (const [activity, count] of analysis.startCounts.entries()) {
    g.setEdge('__start__', activity, { count })
  }
  for (const [activity, count] of analysis.endCounts.entries()) {
    g.setEdge(activity, '__end__', { count })
  }

  dagre.layout(g)

  const nodes = g.nodes().map((id) => ({ id, ...g.node(id) }))
  const edges = g.edges().map((e) => ({ from: e.v, to: e.w, ...g.edge(e) }))

  return { width: g.graph().width || 600, height: g.graph().height || 240, nodes, edges, maxEdge }
}

function DfgDiagram({ layout }) {
  if (!layout) return null
  const { width, height, nodes, edges, maxEdge } = layout

  return (
    <div className="dfg-scroll">
      <svg
        width={Math.max(width, 400)}
        height={Math.max(height, 200)}
        viewBox={`0 0 ${Math.max(width, 400)} ${Math.max(height, 200)}`}
      >
        <defs>
          <marker
            id="dfg-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-muted)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const strokeWidth = 1.4 + (e.count / maxEdge) * 4.2
          const points = e.points || []
          if (points.length < 2) return null
          const d = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
          const mid = points[Math.floor(points.length / 2)]
          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="var(--ink-muted)"
                strokeWidth={strokeWidth}
                strokeOpacity="0.55"
                markerEnd="url(#dfg-arrow)"
              />
              <text
                x={mid.x}
                y={mid.y - 6}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="10.5"
                fill="var(--ink-muted)"
              >
                {e.count}
              </text>
            </g>
          )
        })}

        {nodes.map((n) => {
          const isTerminal = n.kind === 'terminal'
          return (
            <g key={n.id} transform={`translate(${n.x - n.width / 2}, ${n.y - n.height / 2})`}>
              <rect
                width={n.width}
                height={n.height}
                rx={isTerminal ? n.height / 2 : 8}
                fill={isTerminal ? 'var(--accent-soft)' : 'var(--surface)'}
                stroke={isTerminal ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={isTerminal ? 1.4 : 1.2}
              />
              <text
                x={n.width / 2}
                y={n.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="var(--font-ui)"
                fontSize={isTerminal ? 11.5 : 12}
                fontWeight={isTerminal ? 600 : 500}
                fill={isTerminal ? 'var(--accent)' : 'var(--ink)'}
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function MiningView({ modelTaskNames, onStatus }) {
  const fileInputRef = useRef(null)
  const [rawRows, setRawRows] = useState(null)
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({ case: '', activity: '', timestamp: '' })
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  const handleFile = (file) => {
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) {
          setError('No rows found in this file.')
          return
        }
        const fields = res.meta.fields || []
        setHeaders(fields)
        setRawRows(res.data)
        setFileName(file.name)
        const guess = (candidates) => fields.find((f) => candidates.includes(f.toLowerCase().trim())) || ''
        setMapping({
          case: guess(['case_id', 'case', 'caseid', 'case id']),
          activity: guess(['activity', 'task', 'event', 'step']),
          timestamp: guess(['timestamp', 'time', 'datetime', 'date']),
        })
        onStatus?.(`Loaded ${res.data.length} rows from ${file.name}`)
      },
      error: (err) => setError(err.message),
    })
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const loadSample = () => {
    handleFile(new File([new Blob([SAMPLE_CSV], { type: 'text/csv' })], 'sample-event-log.csv'))
  }

  const downloadSample = () => downloadFile('sample-event-log.csv', SAMPLE_CSV, 'text/csv')

  const ready = rawRows && mapping.case && mapping.activity && mapping.timestamp

  const analysis = useMemo(() => {
    if (!ready) return null
    try {
      return computeAnalysis(rawRows, mapping, modelTaskNames)
    } catch (err) {
      return { error: err.message }
    }
  }, [ready, rawRows, mapping, modelTaskNames])

  const layout = useMemo(() => {
    if (!analysis || analysis.error) return null
    return computeLayout(analysis)
  }, [analysis])

  return (
    <div className="mining-view">
      <div className="mining-intro">
        <div className="mining-intro-text">
          <h2>Discover the process as it's actually run</h2>
          <p>
            Upload an event log (CSV with a case ID, an activity name, and a timestamp per row) to
            discover the real flow of activities and compare it against your modeled diagram.
          </p>
        </div>
        <div className="mining-intro-actions">
          <button className="tbtn tbtn-ghost" onClick={downloadSample} type="button">
            <FileDown size={15} strokeWidth={1.75} />
            <span>Sample CSV</span>
          </button>
          <button className="tbtn tbtn-ghost" onClick={loadSample} type="button">
            <Sparkles size={15} strokeWidth={1.75} />
            <span>Try sample data</span>
          </button>
          <button className="tbtn tbtn-primary" onClick={() => fileInputRef.current?.click()} type="button">
            <UploadCloud size={15} strokeWidth={1.75} />
            <span>Upload event log</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      </div>

      {error && <div className="mining-error">{error}</div>}

      {rawRows && (
        <div className="mining-mapping">
          <span className="mining-mapping-label">{fileName}</span>
          <div className="mining-mapping-fields">
            <label>
              Case ID column
              <select value={mapping.case} onChange={(e) => setMapping((m) => ({ ...m, case: e.target.value }))}>
                <option value="">Select…</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
            <label>
              Activity column
              <select value={mapping.activity} onChange={(e) => setMapping((m) => ({ ...m, activity: e.target.value }))}>
                <option value="">Select…</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
            <label>
              Timestamp column
              <select value={mapping.timestamp} onChange={(e) => setMapping((m) => ({ ...m, timestamp: e.target.value }))}>
                <option value="">Select…</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {analysis?.error && <div className="mining-error">{analysis.error}</div>}

      {analysis && !analysis.error && (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <span className="stat-value">{analysis.caseCount}</span>
              <span className="stat-label">Cases</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analysis.eventCount}</span>
              <span className="stat-label">Events</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analysis.activityCount}</span>
              <span className="stat-label">Activities</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analysis.variantCount}</span>
              <span className="stat-label">Variants</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatDuration(analysis.avgDuration)}</span>
              <span className="stat-label">Avg. case duration</span>
            </div>
          </div>

          <div className="mining-section">
            <div className="mining-section-header">Discovered process flow</div>
            <p className="mining-section-hint">
              Line thickness and labels reflect how often that transition occurred across all cases.
            </p>
            <DfgDiagram layout={layout} />
          </div>

          <div className="mining-columns">
            <div className="mining-section">
              <div className="mining-section-header">Top variants</div>
              <ol className="variant-list">
                {analysis.topVariants.map(([variant, count]) => (
                  <li key={variant}>
                    <span className="variant-count">{count}×</span>
                    <span className="variant-path">{variant}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mining-section">
              <div className="mining-section-header">Model vs. reality</div>
              {!modelTaskNames?.length && (
                <p className="mining-section-hint">
                  No named tasks found in the current diagram — switch to Model, name a few
                  tasks, then come back to compare.
                </p>
              )}
              {!!modelTaskNames?.length && (
                <div className="conformance">
                  {analysis.onlyInLog.length > 0 && (
                    <div className="conformance-group">
                      <span className="conformance-title">Executed but not modeled</span>
                      <div className="badge-row">
                        {analysis.onlyInLog.map((a) => (
                          <span className="badge badge-accent" key={a}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.onlyInModel.length > 0 && (
                    <div className="conformance-group">
                      <span className="conformance-title">Modeled but never executed</span>
                      <div className="badge-row">
                        {analysis.onlyInModel.map((a) => (
                          <span className="badge badge-muted" key={a}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.inBoth.length > 0 && (
                    <div className="conformance-group">
                      <span className="conformance-title">Consistent</span>
                      <div className="badge-row">
                        {analysis.inBoth.map((a) => (
                          <span className="badge badge-neutral" key={a}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!rawRows && !error && (
        <div className="mining-empty">
          No event log loaded yet. Upload a CSV, or try the sample data to see how this works.
        </div>
      )}
    </div>
  )
}
