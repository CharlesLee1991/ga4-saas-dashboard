'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

// ── Types ──
interface KpiSummary { total_sessions: number; total_users: number; total_transactions: number; total_revenue: number; avg_conversion_rate: number }
interface KpiRow { date: string; sessions: number; users: number; pageviews: number; transactions: number; revenue: number; conversion_rate: number; bounce_rate: number }
interface Channel { channel: string; attributed_conversions: number; attributed_revenue: number; share_pct: number; total_touchpoints: number }
interface ConvPath { path_sequence: string[]; path_length: number; conversions: number; revenue: number; avg_days_to_convert: number }
interface SyncTable { table_name: string; last_synced_at: string; row_count: number; status: string }
interface SyncData { client_code: string; tables: SyncTable[]; overall_health: string }
interface AttrChannel { utm_source: string; utm_medium: string; order_count: number; order_amount: number; share_pct: number; pageview: number; landing: number; landing_user: number }
interface AttrData { model: string; channels: AttrChannel[]; date_range: { from: string; to: string }; client_code: string }
interface SourcePath { source_trace: string; sessions: number; visitors: number; order_count: number; order_amount: number | null }
interface TermPath { term_trace: string; sessions: number; visitors: number; order_count: number; order_amount: number | null }

// ── Helpers ──
const fmt = (n: number) => n?.toLocaleString('ko-KR') ?? '—'
const fmtRevenue = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

const PERIOD_OPTIONS = [
  { label: '7일', days: 7 },
  { label: '14일', days: 14 },
  { label: '30일', days: 30 },
]

const CHANNEL_COLORS = ['#00E5FF', '#FFB800', '#00FF88', '#FF4757', '#A78BFA', '#F59E0B', '#EC4899', '#3B82F6']

const ATTR_MODELS = [
  { value: 'even', label: '균등 기여' },
  { value: 'divide', label: '미분할' },
  { value: 'first', label: '최초 터치' },
  { value: 'last', label: '최종 터치' },
  { value: 'direct', label: '직접 전환' },
]

function getDateRange(days: number) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

// ── Sub-components ──
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '20px 24px', flex: '1', minWidth: '140px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: accent || 'var(--accent)', opacity: 0.4 }} />
      <p className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</p>
      <p style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
      {sub && <p className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>{title}</h2>
      {badge && <span className="mono" style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '2px', padding: '2px 8px', letterSpacing: '1px' }}>{badge}</span>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Main Dashboard ──
export default function DashboardPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState<string>('')
  const [period, setPeriod] = useState(30)
  const [kpiData, setKpiData] = useState<{ summary: KpiSummary; data: KpiRow[] } | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [paths, setPaths] = useState<ConvPath[]>([])
  const [sync, setSync] = useState<SyncData | null>(null)
  const [attrData, setAttrData] = useState<AttrData | null>(null)
  const [sourcePaths, setSourcePaths] = useState<SourcePath[]>([])
  const [termPaths, setTermPaths] = useState<TermPath[]>([])
  const [attrModel, setAttrModel] = useState('even')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const k = sessionStorage.getItem('ga4_api_key')
    if (!k) { router.push('/'); return }
    setApiKey(k)
  }, [router])

  const fetchAll = useCallback(async (key: string, days: number) => {
    setLoading(true)
    setError('')
    const { from, to } = getDateRange(days)
    const qs = `key=${key}&from=${from}&to=${to}`

    try {
      const [kpiRes, chRes, pathRes, syncRes, attrRes, srcRes, termRes] = await Promise.all([
        fetch(`/api/kpi?${qs}`),
        fetch(`/api/channels?${qs}`),
        fetch(`/api/paths?${qs}`),
        fetch(`/api/sync?key=${key}`),
        fetch(`/api/attribution?${qs}&model=even`),
        fetch(`/api/source-paths?${qs}&limit=20`),
        fetch(`/api/term-paths?${qs}&limit=20`),
      ])
      if (!kpiRes.ok) throw new Error('Auth failed')
      const [kpi, ch, path, sy, attr, src, term] = await Promise.all([
        kpiRes.json(), chRes.json(), pathRes.json(), syncRes.json(),
        attrRes.json(), srcRes.json(), termRes.json(),
      ])
      setKpiData(kpi)
      setChannels((ch.channels || []).filter((c: Channel) => c.attributed_revenue > 0).slice(0, 8))
      setPaths(path.paths || [])
      setSync(sy)
      setAttrData(attr)
      setSourcePaths(src?.paths || [])
      setTermPaths(term?.paths || [])
    } catch (e: any) {
      setError(e.message)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (apiKey) fetchAll(apiKey, period)
  }, [apiKey, period, fetchAll])

  // 기여모델 변경 시 attribution만 재조회
  const handleModelChange = useCallback(async (model: string) => {
    setAttrModel(model)
    if (!apiKey) return
    const { from, to } = getDateRange(period)
    try {
      const res = await fetch(`/api/attribution?key=${apiKey}&from=${from}&to=${to}&model=${model}`)
      if (res.ok) {
        const data = await res.json()
        setAttrData(data)
      }
    } catch { /* ignore */ }
  }, [apiKey, period])

  const summary = kpiData?.summary
  const chartData = (kpiData?.data || []).map(r => ({
    date: r.date.slice(5),
    세션: r.sessions,
    유저: r.users,
    매출: r.revenue,
    전환율: +(r.conversion_rate * 100).toFixed(2),
  }))

  const pieData = channels.map(c => ({
    name: c.channel.length > 16 ? c.channel.slice(0, 16) + '…' : c.channel,
    value: c.attributed_revenue,
    share: c.share_pct,
  }))

  const syncHealth = sync?.overall_health || 'unknown'
  const healthColor = syncHealth === 'healthy' ? 'var(--green)' : syncHealth === 'warning' ? 'var(--gold)' : 'var(--red)'
  const lastSync = sync?.tables?.[0]?.last_synced_at
    ? new Date(sync.tables[0].last_synced_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '—'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(7,10,15,0.92)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--accent)', letterSpacing: '3px' }}>GROWTHPLATFORM.AI</span>
            <h1 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>GA4 Audience Analytics</h1>
          </div>
          <div className="mono" style={{ fontSize: '10px', background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: '2px', padding: '3px 10px', color: 'var(--accent)' }}>DENTIST</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {PERIOD_OPTIONS.map(o => (
              <button key={o.days} onClick={() => setPeriod(o.days)} style={{ padding: '4px 12px', background: period === o.days ? 'var(--accent)' : 'transparent', color: period === o.days ? '#000' : 'var(--text-secondary)', border: `1px solid ${period === o.days ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '2px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
          {/* Sync status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} className="animate-pulse" />
            <span className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>SYNC {syncHealth.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading data...</p>
          </div>
        </div>
      ) : (
        <main style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }} className="animate-fade-in">

          {/* §1 KPI Cards */}
          <section style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <KpiCard label="세션" value={fmt(summary?.total_sessions ?? 0)} accent="var(--accent)" />
              <KpiCard label="유저" value={fmt(summary?.total_users ?? 0)} accent="var(--accent)" />
              <KpiCard label="거래" value={fmt(summary?.total_transactions ?? 0)} accent="var(--gold)" />
              <KpiCard label="매출" value={`₩${fmtRevenue(summary?.total_revenue ?? 0)}`} sub={`${fmt(summary?.total_revenue ?? 0)}원`} accent="var(--gold)" />
              <KpiCard label="전환율" value={fmtPct(summary?.avg_conversion_rate ?? 0)} accent="var(--green)" />
            </div>
          </section>

          {/* §2 KPI Daily Trend */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
            <SectionHeader title="일별 KPI 트렌드" badge={`최근 ${period}일`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Sessions + Users */}
              <div>
                <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>세션 / 유저</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="세션" stroke="#00E5FF" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="유저" stroke="#A78BFA" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Revenue */}
              <div>
                <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>매출 (원)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} width={55} tickFormatter={v => fmtRevenue(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="매출" stroke="#FFB800" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* §3 Channel Attribution */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px', marginBottom: '20px' }}>
            {/* Pie */}
            <div style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px' }}>
              <SectionHeader title="채널 기여도 (매출 비중)" />
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`₩${fmt(Number(value ?? 0))}`, '매출']} contentStyle={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', fontFamily: 'DM Mono', fontSize: '12px' }} />
                  <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'DM Mono' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Bar */}
            <div style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px' }}>
              <SectionHeader title="채널별 전환 & 매출" />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={channels.slice(0, 6)} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} tickFormatter={v => fmtRevenue(v)} />
                  <YAxis type="category" dataKey="channel" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} width={110}
                    tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="attributed_revenue" fill="#FFB800" name="매출" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* §4 Conversion Paths */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
            <SectionHeader title="전환 경로 Top 20" badge="LAST TOUCH" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['경로 시퀀스', '경로 길이', '전환수', '매출', '평균 소요일'].map(h => (
                      <th key={h} className="mono" style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paths.slice(0, 20).map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(28,36,51,0.6)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {(p.path_sequence || []).map((step, j) => (
                            <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '2px', padding: '1px 6px' }}>
                                {step.length > 16 ? step.slice(0, 16) + '…' : step}
                              </span>
                              {j < (p.path_sequence?.length ?? 0) - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{p.path_length}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--accent)' }}>{fmt(p.conversions)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--gold)' }}>₩{fmt(p.revenue)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.avg_days_to_convert?.toFixed(1) ?? '—'}일</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* §6 UTM Attribution — 기여모델별 매출 기여 */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <SectionHeader title="UTM 기여모델 분석" badge={ATTR_MODELS.find(m => m.value === attrModel)?.label || attrModel} />
              <div style={{ display: 'flex', gap: '4px' }}>
                {ATTR_MODELS.map(m => (
                  <button key={m.value} onClick={() => handleModelChange(m.value)}
                    style={{ padding: '4px 10px', background: attrModel === m.value ? 'var(--accent)' : 'transparent', color: attrModel === m.value ? '#000' : 'var(--text-secondary)', border: `1px solid ${attrModel === m.value ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '2px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {attrData?.channels && attrData.channels.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
                {/* Bar Chart */}
                <div>
                  <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>매출 기여 (₩)</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, (attrData.channels.filter(c => c.order_amount > 0).length) * 36)}>
                    <BarChart data={attrData.channels.filter(c => c.order_amount > 0)} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} tickFormatter={v => fmtRevenue(v)} />
                      <YAxis type="category" dataKey="utm_source" tick={{ fill: '#6B7FA3', fontSize: 10, fontFamily: 'DM Mono' }} tickLine={false} axisLine={false} width={120}
                        tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + '…' : v} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="order_amount" fill="#00FF88" name="매출" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['소스', '매체', '매출', '전환수', '기여비중', 'PV'].map(h => (
                          <th key={h} className="mono" style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attrData.channels.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(28,36,51,0.6)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--text-primary)' }}>{c.utm_source}</td>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{c.utm_medium?.length > 18 ? c.utm_medium.slice(0, 18) + '…' : c.utm_medium}</td>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--gold)' }}>₩{fmt(c.order_amount)}</td>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--accent)' }}>{c.order_count}</td>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{c.share_pct?.toFixed(1)}%</td>
                          <td className="mono" style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>{fmt(c.pageview)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>데이터 없음</p>
            )}
          </section>

          {/* §7 Source Paths — 매체별 경로 분석 */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
            <SectionHeader title="매체별 경로 분석" badge="SOURCE TRACE" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['매체 경로', '세션', '방문자', '전환수', '매출'].map(h => (
                      <th key={h} className="mono" style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sourcePaths.length > 0 ? sourcePaths.slice(0, 20).map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(28,36,51,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {(p.source_trace || '').split(' > ').map((step, j, arr) => (
                            <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-primary)', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '2px', padding: '1px 6px' }}>
                                {step.length > 14 ? step.slice(0, 14) + '…' : step}
                              </span>
                              {j < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmt(p.sessions)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmt(p.visitors)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--accent)' }}>{p.order_count}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--gold)' }}>{p.order_amount ? `₩${fmt(p.order_amount)}` : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="mono" style={{ padding: '40px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* §8 Term Paths — 소재별 경로 분석 */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
            <SectionHeader title="소재별 경로 분석" badge="TERM TRACE" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['소재 경로', '세션', '방문자', '전환수', '매출'].map(h => (
                      <th key={h} className="mono" style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {termPaths.length > 0 ? termPaths.slice(0, 20).map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(28,36,51,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {(p.term_trace || '').split(' > ').map((step, j, arr) => (
                            <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-primary)', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '2px', padding: '1px 6px' }}>
                                {step.length > 16 ? step.slice(0, 16) + '…' : step}
                              </span>
                              {j < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmt(p.sessions)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmt(p.visitors)}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--accent)' }}>{p.order_count}</td>
                      <td className="mono" style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--gold)' }}>{p.order_amount ? `₩${fmt(p.order_amount)}` : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="mono" style={{ padding: '40px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* §5 Sync Status */}
          <section style={{ background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <SectionHeader title="파이프라인 동기화 상태" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
                <span className="mono" style={{ fontSize: '11px', color: healthColor }}>{syncHealth.toUpperCase()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(sync?.tables || []).map((t, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '2px', padding: '12px 16px', minWidth: '180px' }}>
                  <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '6px' }}>{t.table_name?.replace('ga4_', '').toUpperCase()}</p>
                  <p className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>{fmt(t.row_count)} rows</p>
                  <p className="mono" style={{ fontSize: '10px', color: t.status === 'ok' ? 'var(--green)' : 'var(--gold)' }}>{t.status?.toUpperCase()}</p>
                </div>
              ))}
            </div>
            <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>마지막 동기화: {lastSync} (Cron 매일 05:00 KST)</p>
          </section>

        </main>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
