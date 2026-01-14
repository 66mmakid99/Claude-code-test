import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsAPI } from '../services/api'

function Scan({ user }) {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleScan = async (e) => {
    e.preventDefault()
    setError('')

    if (!url) {
      setError('URL을 입력해주세요.')
      return
    }

    // URL 형식 검증
    let formattedUrl = url.trim()
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl
    }

    try {
      new URL(formattedUrl)
    } catch {
      setError('올바른 URL 형식이 아닙니다.')
      return
    }

    try {
      setScanning(true)
      const response = await reportsAPI.scan(formattedUrl)
      navigate(`/report/${response.data.report.id}`)
    } catch (err) {
      // 세션 만료시 로그아웃 처리
      if (err.response?.data?.code === 'SESSION_EXPIRED') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }
      const errorMsg = err.response?.data?.error || '검사 요청 중 오류가 발생했습니다.'
      const errorDetail = err.response?.data?.detail
      setError(errorDetail ? `${errorMsg} (${errorDetail})` : errorMsg)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #10b98120, #10b98140)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#111827' }}>
          의료광고 법규 검사
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
          의료법에 따른 광고 위반 사항을 자동으로 분석합니다
        </p>
      </div>

      {/* 검사 폼 */}
      <div className="card" style={{
        borderRadius: '20px',
        padding: '2.5rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        marginBottom: '2rem'
      }}>
        <form onSubmit={handleScan}>
          <label style={{
            display: 'block',
            marginBottom: '0.75rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            검사할 웹사이트 URL
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input"
              placeholder="예: hospital.co.kr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '1rem 1.25rem',
                fontSize: '1rem',
                borderRadius: '12px'
              }}
              disabled={scanning}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={scanning}
              style={{
                padding: '1rem 2rem',
                borderRadius: '12px',
                background: scanning ? '#9ca3af' : '#10b981',
                border: 'none',
                minWidth: '140px'
              }}
            >
              {scanning ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  검사 중...
                </span>
              ) : (
                '검사 시작'
              )}
            </button>
          </div>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}
        </form>
      </div>

      {/* 검사 항목 안내 */}
      <div className="card" style={{
        borderRadius: '20px',
        padding: '2rem',
        background: '#f9fafb'
      }}>
        <h3 style={{ marginBottom: '1.5rem', color: '#374151' }}>검사 항목</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[
            { icon: '⚠️', title: '과장 광고', desc: '효과 보장, 과장된 표현 검사' },
            { icon: '📋', title: '필수 표기', desc: '의료기관 정보 표기 확인' },
            { icon: '🚫', title: '금지 표현', desc: '의료법 금지 문구 검출' },
            { icon: '📝', title: '사례 후기', desc: '치료 후기 관련 규정 검사' },
            { icon: '💰', title: '가격 표시', desc: '의료비 표시 규정 확인' },
            { icon: '🏆', title: '비교 광고', desc: '타 의료기관 비교 표현 검사' }
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', color: '#111827' }}>{item.title}</h4>
              <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 구독 안내 */}
      {user?.subscription_status !== 'active' && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#1e40af', marginBottom: '0.5rem' }}>
            무료 플랜은 월 3회 검사로 제한됩니다
          </p>
          <a href="/pricing" style={{ color: '#3b82f6', fontWeight: '600' }}>
            프리미엄 업그레이드로 무제한 검사 →
          </a>
        </div>
      )}
    </div>
  )
}

export default Scan
