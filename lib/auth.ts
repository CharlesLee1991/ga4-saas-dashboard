import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = SupabaseClient<any, any, any>

export interface AuthResult {
  clientCode: string
  supabase: AnySupabaseClient
}

/**
 * API Key를 Supabase ga4_tenant_bq_config에서 동적 검증
 * AP-08: 하드코딩 금지 → DB 조회 방식
 */
export async function validateApiKey(
  req: NextRequest
): Promise<{ result: AuthResult } | { error: NextResponse }> {
  const apiKey =
    req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key')

  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      ),
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('ga4_tenant_bq_config')
    .select('client_code')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return {
    result: {
      clientCode: data.client_code as string,
      supabase,
    },
  }
}
