import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Home({ user }) {
  const [url, setUrl] = useState('')
  const navigate = useNavigate()

  const handleQuickAnalysis = (type) => {
    if (url.trim()) {
      navigate(`/${type}?url=${encodeURIComponent(url)}`)
    } else {
      navigate(`/${type}`)
    }
  }

  return (
    <div className="container">
      {/* Hero Section - AEO/GEO 중심 */}
      <section style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          color: 'white',
          padding: '0.5rem 1.5rem',
          borderRadius: '30px',
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '1.5rem'
        }}>
          AI 시대의 새로운 마케팅 분석 도구
        </div>

        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          <span style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>AEO/GEO</span> 분석부터
          <br />
          <span style={{ color: '#10b981' }}>의료광고 검사</span>까지
        </h1>

        <p style={{ fontSize: '1.25rem', color: '#6b7280', maxWidth: '700px', margin: '0 auto 2.5rem' }}>
          ChatGPT, Gemini 등 AI 검색엔진에서 웹사이트가 얼마나 잘 노출되는지 분석하고,
          <br />
          의료법 위반 여부까지 한번에 검사하세요.
        </p>

        {/* 빠른 URL 입력 */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 3rem',
          background: 'white',
          borderRadius: '16px',
          padding: '0.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              placeholder="분석할 웹사이트 URL 입력"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '1rem 1.25rem'
              }}
            />
            <button
              onClick={() => handleQuickAnalysis('aeo')}
              className="btn btn-primary"
              style={{
                padding: '1rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none'
              }}
            >
              무료 분석
            </button>
          </div>
        </div>

        {/* 비회원 안내 */}
        {!user && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            회원가입 없이 바로 분석 가능 • 상세 결과는 회원 전용
          </p>
        )}
      </section>

      {/* 3대 서비스 카드 */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2.5rem', fontSize: '1.75rem', color: '#374151' }}>
          MEDCHECKER 핵심 서비스
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* AEO/GEO 분석 카드 */}
          <div
            className="card"
            style={{
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid #3b82f6',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => navigate('/aeo')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(59,130,246,0.2)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = ''
            }}
          >
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              HOT
            </div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f620, #3b82f640)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <svg width="32" height="32" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#1e40af' }}>
              AEO/GEO 분석
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              AI 검색엔진(ChatGPT, Gemini, Claude)에서 웹사이트가 얼마나 잘 노출되는지 점검합니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                AI 친화도 점수
              </span>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                경쟁사 비교
              </span>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                개선 권고
              </span>
            </div>
            <button className="btn btn-primary" style={{
              width: '100%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              padding: '1rem'
            }}>
              AEO 분석 시작 →
            </button>
          </div>

          {/* 의료광고 검사 카드 */}
          <div
            className="card"
            style={{
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent'
            }}
            onClick={() => navigate('/scan')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(16,185,129,0.15)'
              e.currentTarget.style.borderColor = '#10b981'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = ''
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b98120, #10b98140)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#065f46' }}>
              의료광고 검사
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              의료법 규정에 따른 광고 위반 사항을 자동으로 검사하고 개선 방안을 제시합니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                법규 준수 검사
              </span>
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                위반 감지
              </span>
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                개선안 제안
              </span>
            </div>
            <button className="btn" style={{
              width: '100%',
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '1rem'
            }}>
              광고 검사 시작 →
            </button>
          </div>

          {/* 바이럴 모니터링 카드 */}
          <div
            className="card"
            style={{
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent'
            }}
            onClick={() => navigate('/viral')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(249,115,22,0.15)'
              e.currentTarget.style.borderColor = '#f97316'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = ''
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#f97316',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              NEW
            </div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f9731620, #f9731640)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <svg width="32" height="32" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#c2410c' }}>
              바이럴 모니터링
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              네이버 블로그, 카페 등에서 병원 관련 바이럴 콘텐츠를 실시간으로 모니터링합니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                네이버 블로그
              </span>
              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                카페 모니터링
              </span>
              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
                실시간 알림
              </span>
            </div>
            <button className="btn" style={{
              width: '100%',
              background: '#f97316',
              color: 'white',
              border: 'none',
              padding: '1rem'
            }}>
              모니터링 시작 →
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        textAlign: 'center',
        padding: '3rem',
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        borderRadius: '20px',
        color: 'white',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>
          지금 바로 무료로 시작하세요
        </h2>
        <p style={{ marginBottom: '2rem', opacity: 0.9 }}>
          회원가입 없이 기본 분석 가능 • 프리미엄 구독으로 상세 리포트 이용
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ background: 'white', color: '#1e40af', padding: '1rem 2rem' }}
            onClick={() => navigate('/aeo')}
          >
            AEO 분석 시작
          </button>
          {!user && (
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '1rem 2rem' }}
              onClick={() => navigate('/register')}
            >
              무료 회원가입
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default Home
