import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return auth.error

  const { clientCode, supabase } = auth.result
  const dateFrom = req.nextUrl.searchParams.get('from') || undefined
  const dateTo = req.nextUrl.searchParams.get('to') || undefined
  const model = req.nextUrl.searchParams.get('model') || 'even'

  let query = supabase
    .from('ga4_utm_attribution')
    .select('stat_date, utm_source, session_count, order_count, order_amount')
    .eq('client_code', clientCode)
    .eq('attribution_model', model)
    .order('stat_date', { ascending: true })

  if (dateFrom) query = query.gte('stat_date', dateFrom)
  if (dateTo) query = query.lte('stat_date', dateTo)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by date + source for chart
  const grouped: Record<string, Record<string, number>> = {}
  const sources = new Set<string>()

  for (const row of data || []) {
    const d = row.stat_date
    const s = row.utm_source || 'direct'
    sources.add(s)
    if (!grouped[d]) grouped[d] = {}
    grouped[d][s] = (grouped[d][s] || 0) + (row.session_count || 0)
  }

  const chartData = Object.entries(grouped).map(([date, vals]) => ({
    date,
    ...vals,
  }))

  return NextResponse.json({
    data: chartData,
    sources: Array.from(sources).sort(),
  })
}
