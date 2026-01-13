import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsAPI } from '../services/api'

function Home({ user }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!user) {
      navigate('/register')
      return
    }

    if (!url) {
      setError('URL을 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      const response = await reportsAPI.scan(url)
      navigate(`/report/${response.data.report.id}`)
    } catch (err) {
      setError(err.response?.data?.error || '검사 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '4rem 0' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '1.5rem' }}>
          병원 웹사이트
          <br />
          <span style={{ color: 'var(--primary)' }}>의료법 준수</span> 검사
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--gray-500)', maxWidth: '600px', margin: '0 auto 2rem' }}>
          AI가 자동으로 의료법 위반 여부를 검사하고
          <br />
          상세한 리포트를 제공합니다.
        </p>

        {/* URL 입력 폼 */}
        <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="url"
              className="input"
              placeholder="https://병원웹사이트.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '검사 중...' : '무료 검사'}
            </button>
          </div>
          {error && <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{error}</p>}
        </form>
      </section>

      {/* Features Section */}
      <section style={{ padding: '4rem 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem' }}>
          주요 검사 항목
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[
            {
              title: '환자 후기 검사',
              description: '치료 후기, 환자 경험담 등 의료법 제56조 위반 콘텐츠를 탐지합니다.',
              icon: '📝'
            },
            {
              title: '전후 사진 검사',
              description: '시술 전후 비교 사진, 결과 사진 등을 자동으로 탐지합니다.',
              icon: '📸'
            },
            {
              title: '성공률 표현',
              description: '치료 성공률, 완치율 등 검증되지 않은 수치 표현을 검사합니다.',
              icon: '📊'
            },
            {
              title: '최상급 표현',
              description: '최고, 최초, 1위 등 객관적 근거 없는 표현을 탐지합니다.',
              icon: '🏆'
            },
            {
              title: '할인/이벤트 광고',
              description: '과도한 할인, 경품 제공 등 위반 소지 광고를 검사합니다.',
              icon: '💰'
            },
            {
              title: 'AI 정밀 분석',
              description: 'Claude AI를 활용한 맥락 기반 정밀 분석을 제공합니다.',
              icon: '🤖'
            }
          ].map((feature, index) => (
            <div key={index} className="card">
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{feature.icon}</div>
              <h3 style={{ marginBottom: '0.5rem' }}>{feature.title}</h3>
              <p style={{ color: 'var(--gray-500)' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="card" style={{ textAlign: 'center', padding: '3rem', background: 'var(--primary)', color: 'white' }}>
        <h2 style={{ marginBottom: '1rem' }}>지금 바로 시작하세요</h2>
        <p style={{ marginBottom: '2rem', opacity: 0.9 }}>
          무료로 1회 검사 가능, 구독 시 무제한 검사
        </p>
        <button
          className="btn"
          style={{ background: 'white', color: 'var(--primary)' }}
          onClick={() => navigate(user ? '/dashboard' : '/register')}
        >
          {user ? '대시보드 이동' : '무료 회원가입'}
        </button>
      </section>
    </div>
  )
}

export default Home
