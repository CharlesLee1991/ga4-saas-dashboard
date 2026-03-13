'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ── Types ──
interface AttrChannel { utm_source: string; utm_medium: string; order_count: number; order_amount: number; share_pct: number; pageview: number; landing: number; landing_user: number }
interface AttrData { model: string; channels: AttrChannel[]; date_range: { from: string; to: string }; client_code: string }
interface SourcePath { source_trace: string; sessions: number; visitors: number; order_count: number; order_amount: number | null }
interface TermPath { term_trace: string; sessions: number; visitors: number; order_count: number; order_amount: number | null }
interface DailyRow { date: string; [source: string]: string | number }
interface SyncTable { table_name: string; last_synced_at: string; row_count: number; status: string }
interface SyncData { tables: SyncTable[] }

// ── Constants ──
const TABS = [
  { id: 'attribution', label: '기여 분석', icon: '📊' },
  { id: 'source', label: '매체별 경로분석', icon: '🔗' },
  { id: 'content', label: '소재별 경로분석', icon: '📋' },
]

const MODELS = [
  { value: 'first', label: '최초캠페인' },
  { value: 'last', label: '최종캠페인' },
  { value: 'even', label: '균등분할' },
  { value: 'divide', label: '균등미분할' },
  { value: 'direct', label: '직접전환' },
]

const DIMENSIONS = [
  { value: 'source', label: 'source' },
  { value: 'medium', label: 'medium' },
]

const LINE_COLORS = ['#38a169', '#d69e2e', '#805ad5', '#3182ce', '#e53e3e', '#dd6b20', '#319795', '#d53f8c']

const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString('ko-KR') : '—'
const fmtW = (n: number | null | undefined) => n != null ? `₩${n.toLocaleString('ko-KR')}` : '—'

function getDateRange(days: number) {
  const to = new Date(); const from = new Date()
  from.setDate(from.getDate() - days)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

// ── Filter Dropdown (JUVIS-style popup) ──
function FilterDropdown({ label, options, selected, onChange, multi = false }: {
  label: string; options: { value: string; label: string }[]; selected: string; onChange: (v: string) => void; multi?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selectedLabel = options.find(o => o.value === selected)?.label || selected

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', minWidth: '160px',
        background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px',
        cursor: 'pointer', color: '#1a202c', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: '500' }}>{label}</span>
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px', minWidth: '240px',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 50,
        }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px 12px', background: '#f9fafb', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af' }}>🔍</span>
            <input type="text" placeholder="검색어 입력" value={search} onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', flex: 1, color: '#374151' }} />
            <span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#6b7280' }}>{label}</span>
          </div>

          {/* Options */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); if (!multi) setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                  color: selected === o.value ? '#1a202c' : '#4b5563', borderRadius: '6px',
                  fontWeight: selected === o.value ? '600' : '400',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: multi ? '4px' : '50%',
                  border: `2px solid ${selected === o.value ? '#3182ce' : '#d1d5db'}`,
                  background: selected === o.value ? '#3182ce' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selected === o.value && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>✓</span>}
                </span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Source Multi-Select Filter (JUVIS-style) ──
function SourceFilterDropdown({ label, sources, selected, onToggle }: {
  label: string; sources: string[]; selected: Set<string>; onToggle: (s: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = sources.filter(s => s.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', minWidth: '160px',
        background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px',
        cursor: 'pointer', color: '#1a202c', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: '500' }}>{label}</span>
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px', minWidth: '280px',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px 12px', background: '#f9fafb', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af' }}>🔍</span>
            <input type="text" placeholder="검색어 입력" value={search} onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', flex: 1, color: '#374151' }} />
            <span style={{ background: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#6b7280' }}>{label}</span>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {filtered.map(s => (
              <button key={s} onClick={() => onToggle(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                  color: '#4b5563', borderRadius: '6px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  border: `2px solid ${selected.has(s) ? '#e53e3e' : '#d1d5db'}`,
                  background: selected.has(s) ? '#e53e3e' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selected.has(s) && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>✓</span>}
                </span>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabNav({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <nav style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: active === t.id ? '700' : '400',
          color: active === t.id ? '#3182ce' : '#4a5568',
          borderBottom: active === t.id ? '2px solid #3182ce' : '2px solid transparent',
          marginBottom: '-2px', transition: 'all 0.15s',
        }}>
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function BarCell({ value, maxVal, color = '#90cdf4' }: { value: number; maxVal: number; color?: string }) {
  const pct = maxVal > 0 ? (value / maxVal) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '18px', background: '#edf2f7', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
      <span className="mono" style={{ fontSize: '12px', color: '#2d3748', minWidth: '60px', textAlign: 'right' }}>{fmt(value)}</span>
    </div>
  )
}

function PathBadge({ step, isFirst, isLast }: { step: string; isFirst?: boolean; isLast?: boolean }) {
  const bg = isFirst ? '#c6f6d5' : isLast ? '#bee3f8' : '#edf2f7'
  const color = isFirst ? '#276749' : isLast ? '#2b6cb0' : '#4a5568'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', background: bg, color, borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
      {step.length > 20 ? step.slice(0, 20) + '…' : step}
    </span>
  )
}

// ── Tab 1: Attribution ──
function AttributionTab({ apiKey, period }: { apiKey: string; period: number }) {
  const [attrData, setAttrData] = useState<AttrData | null>(null)
  const [dailyData, setDailyData] = useState<DailyRow[]>([])
  const [allSources, setAllSources] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [model, setModel] = useState('last')
  const [dimension, setDimension] = useState('source')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (m: string) => {
    setLoading(true)
    const { from, to } = getDateRange(period)
    const qs = `key=${apiKey}&from=${from}&to=${to}&model=${m}`
    try {
      const [attrRes, dailyRes] = await Promise.all([
        fetch(`/api/attribution?${qs}`),
        fetch(`/api/attribution-daily?${qs}`),
      ])
      const [attr, daily] = await Promise.all([attrRes.json(), dailyRes.json()])
      setAttrData(attr)
      setDailyData(daily.data || [])
      // Extract all sources from channels
      const srcs = (attr?.channels || []).map((c: AttrChannel) => c.utm_source).filter(Boolean)
      const unique = Array.from(new Set(srcs)) as string[]
      setAllSources(unique)
      setSelectedSources(new Set(unique.slice(0, 5))) // default: top 5
    } catch { /* */ }
    setLoading(false)
  }, [apiKey, period])

  useEffect(() => { fetchData(model) }, [fetchData, model])

  const toggleSource = (s: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  const channels = (attrData?.channels || []).filter(c => selectedSources.has(c.utm_source))
  const chartSources = allSources.filter(s => selectedSources.has(s)).slice(0, 6)
  const maxOrder = Math.max(...channels.map(c => c.order_count), 1)
  const maxRevenue = Math.max(...channels.map(c => c.order_amount), 1)
  const maxPV = Math.max(...channels.map(c => c.pageview), 1)
  const maxLanding = Math.max(...channels.map(c => c.landing_user), 1)

  const totals = channels.reduce((acc, c) => ({
    order_count: acc.order_count + c.order_count,
    order_amount: acc.order_amount + c.order_amount,
    pageview: acc.pageview + c.pageview,
    landing_user: acc.landing_user + c.landing_user,
  }), { order_count: 0, order_amount: 0, pageview: 0, landing_user: 0 })

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#a0aec0' }}>데이터 로딩 중...</div>

  return (
    <div className="animate-fade-in">
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SourceFilterDropdown label="source" sources={allSources} selected={selectedSources} onToggle={toggleSource} />
        <FilterDropdown label={`model: ${MODELS.find(m => m.value === model)?.label || model}`} options={MODELS} selected={model} onChange={setModel} />
        <span style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff', color: '#4a5568' }}>
          최근 {period}일
        </span>
      </div>

      {/* Info bar */}
      <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '8px', padding: '10px 16px', marginBottom: '24px', fontSize: '13px', color: '#2b6cb0' }}>
        💡 모델을 선택하여 소스/미디어별 분석결과를 확인해보세요!
      </div>

      {/* Line Chart */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#1a202c' }}>유입수</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
            <XAxis dataKey="date" tick={{ fill: '#a0aec0', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }}
              tickFormatter={(v: string) => v.slice(5).replace('-', '.')} />
            <YAxis tick={{ fill: '#a0aec0', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
              labelFormatter={(v) => String(v)} />
            {chartSources.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2} dot={false} name={s} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '8px' }}>
          {chartSources.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4a5568' }}>
              <div style={{ width: '12px', height: '3px', background: LINE_COLORS[i % LINE_COLORS.length], borderRadius: '2px' }} />
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Attribution Table */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#1a202c' }}>
          Attribution ({dimension === 'source' ? 'Source' : 'Medium'})
          <span style={{ fontSize: '12px', fontWeight: '400', color: '#a0aec0', marginLeft: '12px' }}>소스별 콘텐츠 상세 내용을 확인해보세요.</span>
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#718096', fontWeight: '600' }}>{dimension}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>주문수</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '220px' }}>수익</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>페이지뷰</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>유입수</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f7fafc' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '12px', fontSize: '13px', fontWeight: '500', color: '#2d3748' }}>
                  {dimension === 'source' ? c.utm_source : c.utm_medium}
                </td>
                <td style={{ padding: '12px', width: '180px' }}><BarCell value={c.order_count} maxVal={maxOrder} color="#90cdf4" /></td>
                <td style={{ padding: '12px', width: '220px' }}><BarCell value={c.order_amount} maxVal={maxRevenue} color="#90cdf4" /></td>
                <td style={{ padding: '12px', width: '180px' }}><BarCell value={c.pageview} maxVal={maxPV} color="#90cdf4" /></td>
                <td style={{ padding: '12px', width: '180px' }}><BarCell value={c.landing_user} maxVal={maxLanding} color="#fc8181" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f7fafc' }}>
              <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: '#1a202c' }}>총 합계</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '700' }}>{fmt(totals.order_count)}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '700' }}>{fmtW(totals.order_amount)}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '700' }}>{fmt(totals.pageview)}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '700' }}>{fmt(totals.landing_user)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Tab 2: Source Path ──
function SourcePathTab({ apiKey, period }: { apiKey: string; period: number }) {
  const [paths, setPaths] = useState<SourcePath[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { from, to } = getDateRange(period)
      try {
        const res = await fetch(`/api/source-paths?key=${apiKey}&from=${from}&to=${to}&limit=30`)
        const data = await res.json()
        setPaths(data?.paths || [])
      } catch { /* */ }
      setLoading(false)
    })()
  }, [apiKey, period])

  const maxSessions = Math.max(...paths.map(p => p.sessions), 1)
  const maxRevenue = Math.max(...paths.filter(p => p.order_amount).map(p => p.order_amount!), 1)

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#a0aec0' }}>데이터 로딩 중...</div>

  // Top paths for bar chart
  const topPaths = paths.slice(0, 7)

  return (
    <div className="animate-fade-in">
      {/* 전환 경로 Bar Chart */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#1a202c' }}>전환 경로</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topPaths.map((p, i) => {
            const steps = (p.source_trace || '').split(' > ')
            const pct = maxSessions > 0 ? (p.sessions / maxSessions) * 100 : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, height: '32px', background: '#edf2f7', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: '4px',
                    background: `linear-gradient(90deg, ${LINE_COLORS[i % LINE_COLORS.length]}88, ${LINE_COLORS[i % LINE_COLORS.length]})`,
                    display: 'flex', alignItems: 'center', paddingLeft: '12px', minWidth: 'fit-content',
                  }}>
                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      {steps.join(' > ')}
                    </span>
                  </div>
                  {pct < 40 && (
                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#718096' }}>
                      {steps.join(' > ')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 경로 분석 Table */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1a202c' }}>경로 분석</h3>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38a169' }} /> 최초 인식
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3182ce' }} /> 최종 전환
            </span>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#718096', fontWeight: '600' }}>전환 경로</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '140px' }}>세션수</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>주문수</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>매출액</th>
            </tr>
          </thead>
          <tbody>
            {paths.slice(0, 20).map((p, i) => {
              const steps = (p.source_trace || '').split(' > ')
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f7fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {steps.map((s, j) => (
                        <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <PathBadge step={s} isFirst={j === 0} isLast={j === steps.length - 1 && steps.length > 1} />
                          {j < steps.length - 1 && <span style={{ color: '#a0aec0', fontSize: '11px' }}>&gt;</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#2d3748' }}>{fmt(p.sessions)}</td>
                  <td style={{ padding: '12px', width: '180px' }}><BarCell value={p.order_count} maxVal={Math.max(...paths.map(x => x.order_count), 1)} color="#90cdf4" /></td>
                  <td style={{ padding: '12px', width: '180px' }}><BarCell value={p.order_amount || 0} maxVal={maxRevenue || 1} color="#fbd38d" /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f7fafc' }}>
              <td style={{ padding: '12px', fontWeight: '700', fontSize: '13px' }}>총 합계</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>{fmt(paths.reduce((s, p) => s + p.sessions, 0))}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>{fmt(paths.reduce((s, p) => s + p.order_count, 0))}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>{fmtW(paths.reduce((s, p) => s + (p.order_amount || 0), 0))}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '12px', color: '#a0aec0' }}>
          1 - {Math.min(paths.length, 20)} / {paths.length}
        </div>
      </div>
    </div>
  )
}

// ── Tab 3: Content (Term) Path ──
interface CreativeMeta { utm_term: string; platform: string; creative_name: string | null; thumbnail_url: string | null; landing_url: string | null }

function ContentPathTab({ apiKey, period }: { apiKey: string; period: number }) {
  const [paths, setPaths] = useState<TermPath[]>([])
  const [metas, setMetas] = useState<Record<string, CreativeMeta>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { from, to } = getDateRange(period)
      try {
        const [pathRes, metaRes] = await Promise.all([
          fetch(`/api/term-paths?key=${apiKey}&from=${from}&to=${to}&limit=30`),
          fetch(`/api/creative-meta?key=${apiKey}`),
        ])
        const [pathData, metaData] = await Promise.all([pathRes.json(), metaRes.json()])
        setPaths(pathData?.paths || [])
        const map: Record<string, CreativeMeta> = {}
        for (const m of (metaData || [])) { map[m.utm_term] = m }
        setMetas(map)
      } catch { /* */ }
      setLoading(false)
    })()
  }, [apiKey, period])

  const resolveName = (term: string) => metas[term]?.creative_name || term
  const resolveThumb = (term: string) => metas[term]?.thumbnail_url || null
  const maxRevenue = Math.max(...paths.filter(p => p.order_amount).map(p => p.order_amount!), 1)

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#a0aec0' }}>데이터 로딩 중...</div>

  const topPath = paths[0]
  const topSteps = topPath ? (topPath.term_trace || '').split(' > ') : []

  return (
    <div className="animate-fade-in">
      {topPath && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px', color: '#1a202c' }}>Content Analysis</h3>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', overflowX: 'auto', paddingBottom: '8px' }}>
            {topSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ minWidth: '160px', maxWidth: '200px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#718096', fontWeight: '700', marginBottom: '8px', letterSpacing: '1px' }}>Step  {i + 1}</div>
                  <div style={{
                    width: '150px', height: '200px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden',
                    border: '1px solid #e2e8f0', background: '#f7fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {resolveThumb(step) ? (
                      <img src={resolveThumb(step)!} alt={resolveName(step)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '12px' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                          {metas[step]?.platform === 'tiktok' ? '🎵' : metas[step]?.platform === 'meta' ? '📸' : '📄'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#a0aec0', wordBreak: 'break-all' }}>{resolveName(step)}</div>
                      </div>
                    )}
                  </div>
                </div>
                {i < topSteps.length - 1 && (
                  <div style={{ padding: '0 4px', color: '#a0aec0', fontSize: '20px', fontWeight: '700', alignSelf: 'center', marginTop: '28px' }}>▶</div>
                )}
              </div>
            ))}
            <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '20px 28px', background: '#fed7d7', borderRadius: '8px', textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '11px', color: '#9b2c2c', fontWeight: '600', marginBottom: '4px' }}>세션수</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#c53030' }}>{fmt(topPath.sessions)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#1a202c' }}>전환 경로</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#718096', fontWeight: '600', width: '40px' }}>#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#718096', fontWeight: '600' }}>전환 경로</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '180px' }}>세션수</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#718096', fontWeight: '600', width: '200px' }}>매출액</th>
            </tr>
          </thead>
          <tbody>
            {paths.slice(0, 20).map((p, i) => {
              const steps = (p.term_trace || '').split(' > ')
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f7fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#a0aec0', fontWeight: '500' }}>{i + 1}.</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {steps.map((s, j) => (
                        <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <PathBadge step={resolveName(s)} isFirst={j === 0} isLast={j === steps.length - 1 && steps.length > 1} />
                          {j < steps.length - 1 && <span style={{ color: '#a0aec0', fontSize: '11px' }}>&gt;</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px', width: '180px' }}><BarCell value={p.sessions} maxVal={Math.max(...paths.map(x => x.sessions), 1)} color="#90cdf4" /></td>
                  <td style={{ padding: '12px', width: '200px' }}><BarCell value={p.order_amount || 0} maxVal={maxRevenue || 1} color="#fbd38d" /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f7fafc' }}>
              <td colSpan={2} style={{ padding: '12px', fontWeight: '700', fontSize: '13px' }}>총 합계</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>{fmt(paths.reduce((s, p) => s + p.sessions, 0))}</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>{fmtW(paths.reduce((s, p) => s + (p.order_amount || 0), 0))}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '12px', color: '#a0aec0' }}>
          1 - {Math.min(paths.length, 20)} / {paths.length}
        </div>
      </div>
    </div>
  )
}
// ── Main Dashboard ──
export default function DashboardPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [tab, setTab] = useState('attribution')
  const [period, setPeriod] = useState(30)
  const [sync, setSync] = useState<SyncData | null>(null)

  useEffect(() => {
    const k = sessionStorage.getItem('ga4_api_key')
    if (!k) { router.push('/'); return }
    setApiKey(k)
    // Fetch sync status
    fetch(`/api/sync?key=${k}`).then(r => r.json()).then(setSync).catch(() => {})
  }, [router])

  const lastSync = sync?.tables?.[0]?.last_synced_at
    ? new Date(sync.tables[0].last_synced_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '—'

  if (!apiKey) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#3182ce', letterSpacing: '2px', fontWeight: '600' }}>GROWTHPLATFORM.AI</span>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', lineHeight: 1.2 }}>기여 성과 대시보드</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{ label: '7일', d: 7 }, { label: '30일', d: 30 }, { label: '90일', d: 90 }].map(o => (
              <button key={o.d} onClick={() => setPeriod(o.d)} style={{
                padding: '6px 14px', fontSize: '12px', fontWeight: period === o.d ? '600' : '400',
                background: period === o.d ? '#3182ce' : '#fff', color: period === o.d ? '#fff' : '#4a5568',
                border: `1px solid ${period === o.d ? '#3182ce' : '#e2e8f0'}`, borderRadius: '6px', cursor: 'pointer',
              }}>{o.label}</button>
            ))}
          </div>
          <button onClick={() => { sessionStorage.removeItem('ga4_api_key'); router.push('/') }}
            style={{ padding: '6px 12px', fontSize: '12px', color: '#718096', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>
        <TabNav active={tab} onChange={setTab} />

        {tab === 'attribution' && <AttributionTab apiKey={apiKey} period={period} />}
        {tab === 'source' && <SourcePathTab apiKey={apiKey} period={period} />}
        {tab === 'content' && <ContentPathTab apiKey={apiKey} period={period} />}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: '11px', color: '#a0aec0' }}>
        데이터 마지막 업데이트: {lastSync} | <a href="#" style={{ color: '#3182ce' }}>개인정보처리방침</a>
      </footer>
    </div>
  )
}
