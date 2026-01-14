import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function ViralMonitoring({ user }) {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!keyword.trim()) {
      setError('검색 키워드를 입력해주세요')
      return
    }

    setLoading(true)
    setError('')

    // 비회원/무료회원은 제한된 결과만 표시
    setTimeout(() => {
      setResults({
        keyword,
        totalCount: 127,
        blogs: [
          { title: '강남 00병원 후기', date: '2024-01-14', views: 1523, platform: '네이버 블로그' },
          { title: '서울 피부과 추천', date: '2024-01-13', views: 892, platform: '네이버 블로그' },
          { title: '치과 임플란트 비용', date: '2024-01-12', views: 2341, platform: '네이버 카페' },
        ],
        isLimited: !user || user.subscription_status !== 'active'
      })
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #f9731620, #f9731640)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <svg width="40" height="40" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#111827' }}>
          네이버 바이럴 모니터링
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
          병원명, 키워드로 네이버 블로그/카페 콘텐츠를 실시간 모니터링합니다
        </p>
      </div>

      {/* 검색 폼 */}
      <div className="card" style={{
        borderRadius: '20px',
        padding: '2.5rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        marginBottom: '2rem'
      }}>
        <form onSubmit={handleSearch}>
          <label style={{
            display: 'block',
            marginBottom: '0.75rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            모니터링 키워드
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input"
              placeholder="예: 강남 00병원, 피부과 추천"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{
                flex: 1,
                padding: '1rem 1.25rem',
                fontSize: '1rem',
                borderRadius: '12px'
              }}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                padding: '1rem 2rem',
                borderRadius: '12px',
                background: loading ? '#9ca3af' : '#f97316',
                color: 'white',
                border: 'none',
                minWidth: '140px'
              }}
            >
              {loading ? '검색 중...' : '모니터링'}
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

      {/* 결과 */}
      {results && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#374151', marginBottom: '0.25rem' }}>
                  "{results.keyword}" 검색 결과
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  총 {results.totalCount}개의 콘텐츠 발견
                </p>
              </div>
              {results.isLimited && (
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  무료 플랜: 3개만 표시
                </span>
              )}
            </div>
          </div>

          {/* 결과 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.blogs.map((blog, idx) => (
              <div key={idx} className="card" style={{
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      background: blog.platform.includes('블로그') ? '#dbeafe' : '#d1fae5',
                      color: blog.platform.includes('블로그') ? '#1d4ed8' : '#065f46',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem'
                    }}>
                      {blog.platform}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{blog.date}</span>
                  </div>
                  <h4 style={{ color: '#111827', marginBottom: '0.25rem' }}>{blog.title}</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>조회수: {blog.views.toLocaleString()}</p>
                </div>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  상세보기
                </button>
              </div>
            ))}
          </div>

          {/* 프리미엄 업그레이드 안내 */}
          {results.isLimited && (
            <div style={{
              marginTop: '2rem',
              padding: '2rem',
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderRadius: '16px',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#92400e', marginBottom: '0.75rem' }}>
                전체 {results.totalCount}개 결과를 확인하세요
              </h3>
              <p style={{ color: '#a16207', marginBottom: '1.5rem' }}>
                프리미엄 구독으로 실시간 알림, 상세 분석, 경쟁사 비교 기능을 이용하세요
              </p>
              <button
                className="btn"
                style={{ background: '#92400e', color: 'white', padding: '1rem 2rem' }}
                onClick={() => navigate('/pricing')}
              >
                프리미엄 업그레이드
              </button>
            </div>
          )}
        </div>
      )}

      {/* 기능 안내 */}
      {!results && (
        <div className="card" style={{
          borderRadius: '20px',
          padding: '2rem',
          background: '#f9fafb'
        }}>
          <h3 style={{ marginBottom: '1.5rem', color: '#374151' }}>모니터링 기능</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {[
              { icon: '📝', title: '블로그 모니터링', desc: '네이버 블로그 실시간 추적' },
              { icon: '💬', title: '카페 모니터링', desc: '네이버 카페 게시글 탐지' },
              { icon: '🔔', title: '실시간 알림', desc: '신규 콘텐츠 즉시 알림' },
              { icon: '📊', title: '트렌드 분석', desc: '키워드별 트렌드 파악' },
              { icon: '🏆', title: '경쟁사 분석', desc: '경쟁 병원 바이럴 비교' },
              { icon: '📈', title: '리포트', desc: '주간/월간 리포트 제공' }
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
      )}
    </div>
  )
}

export default ViralMonitoring
