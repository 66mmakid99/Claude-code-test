import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsAPI } from '../services/api'

function Dashboard({ user }) {
  const [url, setUrl] = useState('')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      const response = await reportsAPI.getAll()
      setReports(response.data.reports)
    } catch (err) {
      console.error('리포트 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async (e) => {
    e.preventDefault()
    setError('')

    if (!url) {
      setError('URL을 입력해주세요.')
      return
    }

    try {
      setScanning(true)
      const response = await reportsAPI.scan(url)
      navigate(`/report/${response.data.report.id}`)
    } catch (err) {
      const errorMsg = err.response?.data?.error || '검사 요청 중 오류가 발생했습니다.'
      const errorDetail = err.response?.data?.detail
      setError(errorDetail ? `${errorMsg} (${errorDetail})` : errorMsg)
    } finally {
      setScanning(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'score-good'
    if (score >= 50) return 'score-warning'
    return 'score-danger'
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

  return (
    <div className="container">
      <h1 style={{ marginBottom: '2rem' }}>대시보드</h1>

      {/* 구독 상태 */}
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--gray-500)', marginBottom: '0.25rem' }}>구독 상태</p>
          <p style={{ fontSize: '1.25rem', fontWeight: '600' }}>
            {user.subscription_status === 'active' ? (
              <span style={{ color: 'var(--secondary)' }}>프리미엄 구독중</span>
            ) : (
              <span style={{ color: 'var(--gray-500)' }}>무료 플랜</span>
            )}
          </p>
        </div>
        {user.subscription_status !== 'active' && (
          <Link to="/pricing">
            <button className="btn btn-primary">구독하기</button>
          </Link>
        )}
      </div>

      {/* 새 검사 */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>새 웹사이트 검사</h2>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="url"
            className="input"
            placeholder="https://병원웹사이트.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={scanning}>
            {scanning ? '검사 중...' : '검사 시작'}
          </button>
        </form>
        {error && <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{error}</p>}
      </div>

      {/* 검사 기록 */}
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>검사 기록</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : reports.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '2rem' }}>
            아직 검사 기록이 없습니다.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>URL</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>점수</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>위반</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>상태</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>날짜</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const statusBadge = getStatusBadge(report.status)
                  return (
                    <tr key={report.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {report.url}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                        {report.status === 'completed' ? (
                          <span className={getScoreColor(report.total_score)} style={{ fontWeight: '700' }}>
                            {report.total_score}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                        {report.violation_count > 0 && (
                          <span className="badge badge-critical">{report.violation_count}</span>
                        )}
                        {report.warning_count > 0 && (
                          <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>{report.warning_count}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                        <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--gray-500)' }}>
                        {new Date(report.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                        <Link to={`/report/${report.id}`}>
                          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                            상세보기
                          </button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
