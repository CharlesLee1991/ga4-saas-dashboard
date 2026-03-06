'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/sync?key=${key}`)
    if (res.ok) {
      sessionStorage.setItem('ga4_api_key', key)
      router.push('/dashboard')
    } else {
      setError('유효하지 않은 API 키입니다.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(0,229,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div className="animate-fade-in" style={{ position: 'relative', background: '#0D1117', border: '1px solid var(--border)', borderRadius: '2px', padding: '48px', width: '100%', maxWidth: '420px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        <div style={{ marginBottom: '8px' }}>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase' }}>GrowthPlatform.AI</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>GA4 Analytics</h1>
        <p className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '40px' }}>DENTIST × Audience Intelligence</p>
        <form onSubmit={handleSubmit}>
          <label className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>API KEY</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your API key"
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '2px', padding: '12px 16px', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          {error && <p className="mono" style={{ fontSize: '11px', color: 'var(--red)', marginBottom: '8px' }}>{error}</p>}
          <button type="submit" disabled={loading || !key} style={{ width: '100%', marginTop: '16px', padding: '12px', background: loading ? 'transparent' : 'var(--accent)', color: loading ? 'var(--accent)' : '#000', border: `1px solid var(--accent)`, borderRadius: '2px', fontFamily: 'Syne, sans-serif', fontWeight: '600', fontSize: '13px', letterSpacing: '1px', cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'VERIFYING...' : 'ACCESS DASHBOARD →'}
          </button>
        </form>
      </div>
    </div>
  )
}
