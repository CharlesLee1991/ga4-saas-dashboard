import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // /dashboard 경로: API routes에서 이중 검증하므로 패스
  // 향후 쿠키 기반 세션 도입 시 여기서 처리
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
