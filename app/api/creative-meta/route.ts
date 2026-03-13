import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return auth.error

  const { clientCode, supabase } = auth.result

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('ga4_get_creative_meta', {
    p_client_code: clientCode,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
