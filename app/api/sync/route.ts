import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DENTIST_API_KEY = 'f84007aa-adf8-42c7-9a02-87eedb5ff111'

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key')
  if (apiKey !== DENTIST_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.rpc('ga4_get_sync_status', {
    p_client_code: 'DENTIST',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
