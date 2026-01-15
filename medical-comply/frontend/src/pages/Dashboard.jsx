import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsAPI } from '../services/api'

function Dashboard({ user }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      const response = await reportsAPI.getAll()
      setReports(response.data.reports || [])
    } catch (err) {
      console.error('리포트 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'
    if (score >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: '대기중' },
      processing: { class: 'badge-warning', text: '분석중' },
      completed: { class: 'badge-success', text: '완료' },
      failed: { class: 'badge-critical', text: '실패' }
    }
    return badges[status] || badges.pending
  }

  // 서비스 카드 스타일
  const serviceCardStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '2px solid transparent',
    height: '100%'
  }

  const iconBoxStyle = (color) => ({
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: `linear-gradient(135deg, ${color}20, ${color}40)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem'
  })

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      {/* 환영 메시지 & 구독 상태 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        borderRadius: '20px',
        padding: '2rem',
        marginBottom: '2rem',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            안녕하세요, {user?.name || '사용자'}님! 👋
          </h1>
          <p style={{ opacity: 0.9 }}>
            MEDCHECKER에서 웹사이트 최적화를 시작하세요
          </p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>구독 상태</p>
          <p style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {user?.subscription_status === 'active' ? '프리미엄' : '무료 플랜'}
          </p>
        </div>
      </div>

      {/* 서비스 카드 섹션 */}
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: '#374151' }}>
        서비스 이용하기
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* AEO/GEO 분석 */}
        <div
          style={{ ...serviceCardStyle, borderColor: '#3b82f6' }}
          onClick={() => navigate('/aeo')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,0.2)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
          }}
        >
          <div style={iconBoxStyle('#3b82f6')}>
            <svg width="32" height="32" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#1e40af' }}>
            AEO/GEO 분석
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            AI 검색엔진 최적화 분석으로 ChatGPT, Gemini, Claude 등에서
            웹사이트가 얼마나 잘 노출되는지 점검합니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: '1.5rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              padding: '1rem'
            }}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/aeo')
            }}
          >
            분석 시작하기 →
          </button>
        </div>

        {/* 의료광고 검사 */}
        <div
          style={serviceCardStyle}
          onClick={() => navigate('/scan')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(16,185,129,0.15)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
          }}
        >
          <div style={iconBoxStyle('#10b981')}>
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#065f46' }}>
            의료광고 검사
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            의료법 규정에 따른 광고 위반 사항을 자동으로 검사하고
            개선 방안을 제시합니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
          <button
            className="btn"
            style={{
              width: '100%',
              marginTop: '1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '1rem'
            }}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/scan')
            }}
          >
            검사 시작하기 →
          </button>
        </div>

        {/* 바이럴 모니터링 */}
        <div
          style={serviceCardStyle}
          onClick={() => navigate('/viral')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(139,92,246,0.15)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
          }}
        >
          <div style={iconBoxStyle('#8b5cf6')}>
            <svg width="32" height="32" fill="none" stroke="#8b5cf6" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#5b21b6' }}>
            바이럴 모니터링
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            네이버 블로그, 카페 등에서 병원 관련 바이럴 콘텐츠를
            실시간으로 모니터링합니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
              블로그 추적
            </span>
            <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
              카페 모니터링
            </span>
            <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem' }}>
              알림 설정
            </span>
          </div>
          <button
            className="btn"
            style={{
              width: '100%',
              marginTop: '1.5rem',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              padding: '1rem'
            }}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/viral')
            }}
          >
            모니터링 시작하기 →
          </button>
        </div>
      </div>

      {/* 빠른 액션 버튼들 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <Link to="/pricing" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💳</div>
            <p style={{ color: '#374151', fontWeight: '500' }}>요금제 보기</p>
          </div>
        </Link>
        <Link to="/aeo" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
            <p style={{ color: '#374151', fontWeight: '500' }}>AEO 분석</p>
          </div>
        </Link>
        <Link to="/scan" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <p style={{ color: '#374151', fontWeight: '500' }}>광고 검사</p>
          </div>
        </Link>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => window.open('mailto:support@medicalcomply.com')}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</div>
          <p style={{ color: '#374151', fontWeight: '500' }}>문의하기</p>
        </div>
      </div>

      {/* 최근 검사 기록 */}
      <div className="card" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#374151' }}>MEDCHECKER 사용기록</h2>
          {reports.length > 0 && (
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              총 {reports.length}건
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>로딩 중...</p>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              아직 검사 기록이 없습니다.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/scan')}
            >
              첫 검사 시작하기
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '1rem', color: '#6b7280', fontWeight: '500' }}>URL</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontWeight: '500' }}>점수</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontWeight: '500' }}>위반</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontWeight: '500' }}>상태</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontWeight: '500' }}>날짜</th>
                  <th style={{ textAlign: 'center', padding: '1rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 5).map((report) => {
                  const statusBadge = getStatusBadge(report.status)
                  return (
                    <tr key={report.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '1rem', maxWidth: '250px' }}>
                        <span style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#374151'
                        }}>
                          {report.url}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        {report.status === 'completed' ? (
                          <span style={{
                            fontWeight: '700',
                            fontSize: '1.125rem',
                            color: getScoreColor(report.total_score)
                          }}>
                            {report.total_score}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        {report.violation_count > 0 && (
                          <span className="badge badge-critical">{report.violation_count}</span>
                        )}
                        {report.warning_count > 0 && (
                          <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>{report.warning_count}</span>
                        )}
                        {!report.violation_count && !report.warning_count && (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                        {new Date(report.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        <Link to={`/report/${report.id}`}>
                          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                            상세
                          </button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {reports.length > 5 && (
              <div style={{ textAlign: 'center', padding: '1rem', borderTop: '1px solid #f3f4f6' }}>
                <Link to="/reports" style={{ color: '#3b82f6', fontWeight: '500' }}>
                  모든 기록 보기 ({reports.length}건) →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 업그레이드 배너 (무료 사용자만) */}
      {user?.subscription_status !== 'active' && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ color: '#92400e', marginBottom: '0.5rem' }}>
              프리미엄으로 업그레이드하세요!
            </h3>
            <p style={{ color: '#a16207' }}>
              무제한 분석, 상세 리포트, 경쟁사 비교 기능을 이용하세요.
            </p>
          </div>
          <Link to="/pricing">
            <button className="btn" style={{
              background: '#92400e',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem'
            }}>
              요금제 보기
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default Dashboard
