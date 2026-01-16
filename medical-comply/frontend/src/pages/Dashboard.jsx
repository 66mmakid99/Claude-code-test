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
    if (score >= 80) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: '대기' },
      processing: { class: 'badge-warning', text: '분석중' },
      completed: { class: 'badge-success', text: '완료' },
      failed: { class: 'badge-critical', text: '실패' }
    }
    return badges[status] || badges.pending
  }

  const services = [
    {
      id: 'aeo',
      name: 'AEO/GEO 분석',
      description: 'AI 검색엔진 최적화 점검',
      path: '/aeo',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
      )
    },
    {
      id: 'scan',
      name: '의료광고 검사',
      description: '의료법 규정 준수 검토',
      path: '/scan',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    },
    {
      id: 'viral',
      name: '바이럴 모니터링',
      description: '블로그/카페 콘텐츠 추적',
      path: '/viral',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
      )
    }
  ]

  return (
    <div className="container py-8">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user?.name || '사용자'}님, 안녕하세요
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            마케팅 현황을 확인하고 새로운 분석을 시작하세요
          </p>
        </div>
        <button
          onClick={() => navigate('/aeo')}
          className="btn btn-primary h-10 px-6"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          새 분석 시작
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg border bg-white">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">총 분석</p>
          <p className="text-2xl font-semibold mt-1">{reports.length}</p>
        </div>
        <div className="p-4 rounded-lg border bg-white">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">구독 상태</p>
          <p className="text-2xl font-semibold mt-1">
            {user?.subscription_status === 'active' ? '프리미엄' : '무료'}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-white">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">이번 달 분석</p>
          <p className="text-2xl font-semibold mt-1">
            {reports.filter(r => {
              const d = new Date(r.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
      </div>

      {/* Services Section */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">서비스</h2>
        <div className="rounded-lg border bg-white divide-y">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => navigate(service.path)}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-gray-600">
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{service.name}</p>
                <p className="text-xs text-muted-foreground">{service.description}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">최근 분석</h2>
          {reports.length > 5 && (
            <Link to="/reports" className="text-xs text-muted-foreground hover:text-foreground">
              모두 보기 ({reports.length})
            </Link>
          )}
        </div>

        <div className="rounded-lg border bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground mb-4">아직 분석 기록이 없습니다</p>
              <button
                onClick={() => navigate('/aeo')}
                className="btn btn-primary text-sm h-9"
              >
                첫 분석 시작하기
              </button>
            </div>
          ) : (
            <table className="linear-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th className="w-20 text-center">점수</th>
                  <th className="w-20 text-center">상태</th>
                  <th className="w-24 text-center">날짜</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 5).map((report) => {
                  const statusBadge = getStatusBadge(report.status)
                  return (
                    <tr key={report.id}>
                      <td>
                        <span className="block truncate max-w-xs text-sm">
                          {report.url}
                        </span>
                      </td>
                      <td className="text-center">
                        {report.status === 'completed' ? (
                          <span className={`font-semibold ${getScoreColor(report.total_score)}`}>
                            {report.total_score}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${statusBadge.class}`}>
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="text-center text-xs text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="text-center">
                        <Link
                          to={`/report/${report.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Upgrade CTA - only for free users, subtle */}
      {user?.subscription_status !== 'active' && reports.length > 0 && (
        <div className="mt-6 p-4 rounded-lg border border-dashed bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">프리미엄으로 업그레이드</p>
                <p className="text-xs text-muted-foreground">무제한 분석과 상세 리포트를 이용하세요</p>
              </div>
            </div>
            <Link to="/pricing" className="btn btn-ghost text-sm h-8 px-3">
              요금제 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
