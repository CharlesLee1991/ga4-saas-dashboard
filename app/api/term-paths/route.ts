import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return auth.error

  const { clientCode, supabase } = auth.result

  const dateFrom = req.nextUrl.searchParams.get('from') || undefined
  const dateTo = req.nextUrl.searchParams.get('to') || undefined
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('ga4_get_term_paths', {
    p_client_code: clientCode,
    p_limit: limit,
    ...(dateFrom && { p_date_from: dateFrom }),
    ...(dateTo && { p_date_to: dateTo }),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
