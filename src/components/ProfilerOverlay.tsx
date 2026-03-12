import { useState, useMemo } from 'react'
import type { ProfilerReport, EmailTiming, SegmentTiming } from '@/lib/profiler'

interface Props {
  enabled: boolean
  onToggle: () => void
  report: ProfilerReport | null
  panelOpen: boolean
  onPanelToggle: () => void
}

function formatMs(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = ((ms % 60_000) / 1000).toFixed(1)
  return `${mins}m ${secs}s`
}

function SegmentBar({ segment, maxMs }: { segment: SegmentTiming; maxMs: number }) {
  const pct = maxMs > 0 ? (segment.durationMs / maxMs) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 truncate text-gray-400 font-mono">{segment.name}</span>
      <div className="flex-1 bg-gray-800 h-3 overflow-hidden">
        <div
          className="h-full bg-blue-500/70"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="w-16 text-right font-mono text-gray-300">{formatMs(segment.durationMs)}</span>
    </div>
  )
}

function EmailRow({ email, expanded, onToggle }: { email: EmailTiming; expanded: boolean; onToggle: () => void }) {
  const maxSegMs = Math.max(...email.segments.map((s) => s.durationMs), 1)
  const statusColor = email.filteredOut
    ? 'text-gray-600'
    : email.flightsFound > 0
      ? 'text-green-400'
      : 'text-yellow-500'

  return (
    <div className="border-b border-gray-800/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-800/30 transition-colors text-left"
      >
        <span className="w-6 text-gray-600 font-mono text-right">{email.index}</span>
        <span className={`w-4 ${statusColor}`}>
          {email.filteredOut ? '-' : email.flightsFound > 0 ? `${email.flightsFound}` : '0'}
        </span>
        <span className="flex-1 truncate text-gray-400 font-mono">
          {email.domain || '(unknown)'}
          {email.subject ? ` | ${email.subject}` : ''}
        </span>
        <span className="w-16 text-right font-mono text-gray-300">{formatMs(email.totalMs)}</span>
        <span className="w-4 text-gray-600">{expanded ? '\u25BC' : '\u25B6'}</span>
      </button>
      {expanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1">
          {email.segments.length === 0 ? (
            <span className="text-xs text-gray-600 italic">No segments recorded</span>
          ) : (
            email.segments.map((seg, i) => (
              <SegmentBar key={i} segment={seg} maxMs={maxSegMs} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

type SortKey = 'index' | 'total' | 'llm' | 'normalize' | 'flights'
type Tab = 'mbox' | 'emails'

export default function ProfilerOverlay({ enabled, onToggle, report, panelOpen, onPanelToggle }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('mbox')
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('index')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterDomain, setFilterDomain] = useState('')
  const [hideFiltered, setHideFiltered] = useState(false)

  const sortedEmails = useMemo(() => {
    if (!report) return []
    let emails = [...report.emails]

    if (hideFiltered) {
      emails = emails.filter((e) => !e.filteredOut)
    }
    if (filterDomain) {
      const q = filterDomain.toLowerCase()
      emails = emails.filter((e) => e.domain.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q))
    }

    const getSegmentMs = (e: EmailTiming, name: string) =>
      e.segments.find((s) => s.name === name)?.durationMs ?? 0

    emails.sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'index': diff = a.index - b.index; break
        case 'total': diff = a.totalMs - b.totalMs; break
        case 'llm': diff = getSegmentMs(a, 'llm-extract') - getSegmentMs(b, 'llm-extract'); break
        case 'normalize': diff = getSegmentMs(a, 'normalize') - getSegmentMs(b, 'normalize'); break
        case 'flights': diff = a.flightsFound - b.flightsFound; break
      }
      return sortAsc ? diff : -diff
    })

    return emails
  }, [report, sortKey, sortAsc, filterDomain, hideFiltered])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'index')
    }
  }

  const maxMboxMs = report
    ? Math.max(...report.mboxSegments.map((s) => s.durationMs), 1)
    : 1

  if (!enabled || !panelOpen) return null

  return (
    <div className="fixed top-14 right-5 z-[9998] w-[600px] max-w-[90vw] max-h-[70vh] bg-gray-950/95 border border-gray-700/50 shadow-2xl flex flex-col backdrop-blur-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">Pipeline Profiler</span>
          {report && (
            <span className="text-[10px] font-mono text-gray-500">
              {formatMs(report.totalMs)} total
            </span>
          )}
        </div>
        <button
          onClick={() => {
            onToggle()
            onPanelToggle()
          }}
          className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors"
        >
          Disable
        </button>
      </div>
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 shrink-0">
            <button
              onClick={() => setActiveTab('mbox')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'mbox'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Mbox Pipeline
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'emails'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Emails ({report?.emails.length ?? 0})
            </button>
          </div>

          {!report ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No profiler data yet. Process an .mbox file to see timing data.
            </div>
          ) : activeTab === 'mbox' ? (
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <SummaryCard label="Total Time" value={formatMs(report.totalMs)} />
                <SummaryCard label="Emails" value={`${report.summary.totalEmails}`} />
                <SummaryCard label="Flights" value={`${report.summary.totalFlightsExtracted}`} />
                <SummaryCard label="Filtered Out" value={`${report.summary.filteredEmails}`} />
                <SummaryCard label="Processed" value={`${report.summary.processedEmails}`} />
                <SummaryCard label="Avg LLM/email" value={formatMs(report.summary.avgLlmMs)} />
              </div>

              {/* Segment breakdown */}
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Pipeline Segments
                </h3>
                <div className="space-y-1.5">
                  {report.mboxSegments.map((seg, i) => (
                    <SegmentBar key={i} segment={seg} maxMs={maxMboxMs} />
                  ))}
                </div>
              </div>

              {/* Averages */}
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Per-Email Averages
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <AvgRow label="Normalize" value={report.summary.avgNormalizeMs} />
                  <AvgRow label="Domain Filter" value={report.summary.avgDomainFilterMs} />
                  <AvgRow label="LLM Extract" value={report.summary.avgLlmMs} />
                  {report.summary.avgDedupMs !== null && (
                    <AvgRow label="Dedup (total)" value={report.summary.avgDedupMs} />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
                <input
                  type="text"
                  placeholder="Filter domain/subject..."
                  value={filterDomain}
                  onChange={(e) => setFilterDomain(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideFiltered}
                    onChange={(e) => setHideFiltered(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Hide filtered
                </label>
              </div>

              {/* Sort header */}
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800 text-[10px] text-gray-600 uppercase tracking-wider shrink-0">
                <SortBtn label="#" sortKey="index" current={sortKey} asc={sortAsc} onClick={handleSort} width="w-6" />
                <SortBtn label="Flt" sortKey="flights" current={sortKey} asc={sortAsc} onClick={handleSort} width="w-4" />
                <span className="flex-1">Domain / Subject</span>
                <SortBtn label="Total" sortKey="total" current={sortKey} asc={sortAsc} onClick={handleSort} width="w-16" align="text-right" />
                <span className="w-4" />
              </div>

              {/* Email list */}
              <div className="overflow-y-auto">
                {sortedEmails.length === 0 ? (
                  <div className="p-4 text-center text-gray-600 text-xs">No emails match filter</div>
                ) : (
                  sortedEmails.map((email) => (
                    <EmailRow
                      key={email.index}
                      email={email}
                      expanded={expandedEmail === email.index}
                      onToggle={() => setExpandedEmail(expandedEmail === email.index ? null : email.index)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/80 border border-gray-800/50 px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-mono text-gray-200">{value}</div>
    </div>
  )
}

function AvgRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between bg-gray-900/50 px-2 py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{formatMs(value)}</span>
    </div>
  )
}

function SortBtn({
  label,
  sortKey,
  current,
  asc,
  onClick,
  width,
  align = 'text-left',
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  asc: boolean
  onClick: (key: SortKey) => void
  width: string
  align?: string
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`${width} ${align} hover:text-gray-300 transition-colors ${
        active ? 'text-blue-400' : ''
      }`}
    >
      {label}
      {active && (asc ? ' \u2191' : ' \u2193')}
    </button>
  )
}
