import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reportsAPI } from '../services/api'

function ReportDetail() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadReport()
    const interval = setInterval(() => {
      if (report?.status === 'processing' || report?.status === 'pending') {
        loadReport()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [id, report?.status])

  const loadReport = async () => {
    try {
      const response = await reportsAPI.getById(id)
      setReport(response.data.report)
      setViolations(response.data.violations)
    } catch (err) {
      setError('리포트를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'score-good'
    if (score >= 50) return 'score-warning'
    return 'score-danger'
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: { class: 'badge-critical', text: '위반' },
      warning: { class: 'badge-warning', text: '주의' },
      info: { class: 'badge-success', text: '정보' }
    }
    return badges[severity] || badges.info
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--gray-500)' }}>리포트 로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <Link to="/dashboard">
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>대시보드로 돌아가기</button>
        </Link>
      </div>
    )
  }

  if (report.status === 'processing' || report.status === 'pending') {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <h2 style={{ marginTop: '1.5rem' }}>웹사이트 분석 중...</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem' }}>
          {report.url}
        </p>
        <p style={{ color: 'var(--gray-500)', marginTop: '1rem' }}>
          AI가 의료법 위반 여부를 분석하고 있습니다.
          <br />잠시만 기다려주세요.
        </p>
      </div>
    )
  }

  if (report.status === 'failed') {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ fontSize: '3rem' }}>❌</p>
        <h2 style={{ marginTop: '1rem' }}>분석 실패</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem' }}>
          웹사이트를 분석하는 데 실패했습니다.
          <br />URL이 올바른지 확인 후 다시 시도해주세요.
        </p>
        <Link to="/dashboard">
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }}>대시보드로 돌아가기</button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container">
      <Link to="/dashboard" style={{ color: 'var(--gray-500)', display: 'inline-block', marginBottom: '1rem' }}>
        ← 대시보드로 돌아가기
      </Link>

      {/* 헤더 */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>검사 결과 리포트</h1>
            <p style={{ color: 'var(--gray-500)', wordBreak: 'break-all' }}>{report.url}</p>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              검사일: {new Date(report.completed_at).toLocaleString('ko-KR')}
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--gray-500)', marginBottom: '0.25rem' }}>종합 점수</p>
            <p className={`score ${getScoreColor(report.total_score)}`}>
              {report.total_score}
            </p>
            <p style={{ color: 'var(--gray-500)' }}>/ 100</p>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: '2rem', fontWeight: '700' }}>{report.violation_count}</p>
          <p style={{ color: 'var(--gray-500)' }}>위반 항목</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--warning)', fontSize: '2rem', fontWeight: '700' }}>{report.warning_count}</p>
          <p style={{ color: 'var(--gray-500)' }}>주의 항목</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--secondary)', fontSize: '2rem', fontWeight: '700' }}>{report.pass_count || 0}</p>
          <p style={{ color: 'var(--gray-500)' }}>통과 항목</p>
        </div>
      </div>

      {/* 위반 상세 */}
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>상세 분석 결과</h2>

        {violations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '3rem' }}>✅</p>
            <p style={{ color: 'var(--secondary)', fontWeight: '600', marginTop: '1rem' }}>
              발견된 위반 사항이 없습니다!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {violations.map((violation, index) => {
              const badge = getSeverityBadge(violation.severity)
              return (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${violation.severity === 'critical' ? '#fecaca' : '#fef3c7'}`,
                    background: violation.severity === 'critical' ? '#fef2f2' : '#fffbeb'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className={`badge ${badge.class}`}>{badge.text}</span>
                    <span style={{ fontWeight: '600' }}>{violation.rule_name}</span>
                    <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>({violation.rule_code})</span>
                  </div>
                  <p style={{ marginBottom: '0.5rem' }}>{violation.description}</p>
                  {violation.evidence && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
                      <strong>발견 내용:</strong> "{violation.evidence}"
                    </p>
                  )}
                  {violation.location && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
                      <strong>위치:</strong> {violation.location}
                    </p>
                  )}
                  {violation.recommendation && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                      <strong>권고사항:</strong> {violation.recommendation}
                    </p>
                  )}
                  {violation.legal_basis && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                      법적 근거: {violation.legal_basis}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportDetail
