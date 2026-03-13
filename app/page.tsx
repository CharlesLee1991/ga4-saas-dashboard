'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!key.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/kpi?key=${key.trim()}`)
      if (!res.ok) throw new Error('Invalid API Key')
      sessionStorage.setItem('ga4_api_key', key.trim())
      router.push('/dashboard')
    } catch {
      setError('유효하지 않은 API Key입니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '48px 40px', width: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#3182ce', letterSpacing: '3px', fontWeight: '600' }}>GROWTHPLATFORM.AI</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a202c', marginBottom: '8px' }}>기여 성과 대시보드</h1>
        <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '32px' }}>CTS — Cache · Transform · Serve</p>

        <input
          type="text"
          placeholder="API Key를 입력하세요"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', marginBottom: '16px', background: '#f7fafc' }}
        />

        {error && <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '인증 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}
