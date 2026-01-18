import { useState, useEffect } from 'react'

function ViralMonitoring({ user }) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [searchHistory, setSearchHistory] = useState([])
  const [savedKeywords, setSavedKeywords] = useState([])
  const [activeTab, setActiveTab] = useState('search')
  const [filters, setFilters] = useState({
    platform: 'all',
    period: '30d',
    sort: 'risk'
  })
  const [selectedItems, setSelectedItems] = useState([])
  const [showActionModal, setShowActionModal] = useState(null)
  const [apiStatus, setApiStatus] = useState(null)

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    try {
      const history = localStorage.getItem('viral-search-history')
      const saved = localStorage.getItem('viral-saved-keywords')
      if (history) setSearchHistory(JSON.parse(history))
      if (saved) setSavedKeywords(JSON.parse(saved))
    } catch (e) {}
  }, [])

  useEffect(() => {
    fetch('/api/monitoring/status')
      .then(res => res.json())
      .then(data => setApiStatus(data))
      .catch(() => setApiStatus({ naverApiConfigured: false }))
  }, [])

  const saveToHistory = (kw, count, riskInfo) => {
    const newHistory = [
      { keyword: kw, count, riskLevel: riskInfo?.level, date: new Date().toISOString() },
      ...searchHistory.filter(h => h.keyword !== kw)
    ].slice(0, 20)
    setSearchHistory(newHistory)
    localStorage.setItem('viral-search-history', JSON.stringify(newHistory))
  }

  const toggleSaveKeyword = (kw) => {
    const exists = savedKeywords.includes(kw)
    const newSaved = exists ? savedKeywords.filter(k => k !== kw) : [...savedKeywords, kw]
    setSavedKeywords(newSaved)
    localStorage.setItem('viral-saved-keywords', JSON.stringify(newSaved))
  }

  // 위험도 색상
  const getRiskColor = (level) => {
    if (level === 'high') return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: '고위험' }
    if (level === 'medium') return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: '주의' }
    return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', label: '양호' }
  }

  // 위반 심각도 색상
  const getViolationColor = (level) => {
    if (level === 'critical') return { bg: '#fef2f2', text: '#dc2626', icon: '🔴' }
    if (level === 'warning') return { bg: '#fffbeb', text: '#d97706', icon: '🟠' }
    return { bg: '#fefce8', text: '#ca8a04', icon: '🟡' }
  }

  const getPlatformIcon = (platform) => {
    if (platform?.includes('블로그')) return '📝'
    if (platform?.includes('카페')) return '💬'
    if (platform?.includes('지식인')) return '❓'
    return '📄'
  }

  // 검색 실행
  const handleSearch = async (e) => {
    e?.preventDefault()
    const searchKeyword = keyword.trim()
    if (!searchKeyword) {
      setError('병원명 또는 키워드를 입력해주세요')
      return
    }

    setLoading(true)
    setError('')
    setSelectedItems([])
    setResults(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/monitoring/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keyword: searchKeyword,
          platform: filters.platform,
          period: filters.period,
          sort: filters.sort
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.apiRequired) {
          setError('네이버 API 키가 설정되지 않았습니다.')
        } else if (data.apiError) {
          setError('네이버 API 호출에 실패했습니다.')
        } else {
          setError(data.error || '검색 중 오류가 발생했습니다')
        }
        return
      }

      setResults(data)
      saveToHistory(searchKeyword, data.totalCount, data.overallRisk)
    } catch (err) {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 조치 요청 모달
  const ActionModal = ({ item, onClose }) => {
    const [actionType, setActionType] = useState('')
    const [memo, setMemo] = useState('')

    const handleSubmit = () => {
      // TODO: 실제 조치 요청 API 연동
      alert(`조치 요청이 접수되었습니다.\n\n유형: ${actionType}\n콘텐츠: ${item.title}`)
      onClose()
    }

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '1.5rem', maxWidth: '500px', width: '90%'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#111827' }}>조치 요청</h3>

          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>대상 콘텐츠</div>
            <div style={{ fontWeight: '500', color: '#111827' }}>{item.title}</div>
          </div>

          {item.violations?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>탐지된 위반 사항</div>
              {item.violations.map((v, idx) => (
                <div key={idx} style={{
                  background: getViolationColor(v.level).bg,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem'
                }}>
                  {getViolationColor(v.level).icon} {v.name}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>조치 유형</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { value: 'delete', label: '콘텐츠 삭제 요청', desc: '위반 콘텐츠의 완전 삭제를 요청합니다' },
                { value: 'modify', label: '콘텐츠 수정 요청', desc: '위반 부분만 수정을 요청합니다' },
                { value: 'contact', label: '대행사 연락 요청', desc: '담당 대행사에게 연락을 취합니다' }
              ].map(opt => (
                <label key={opt.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                  border: actionType === opt.value ? '2px solid #f97316' : '1px solid #e5e7eb',
                  background: actionType === opt.value ? '#fff7ed' : 'white'
                }}>
                  <input
                    type="radio"
                    name="actionType"
                    value={opt.value}
                    checked={actionType === opt.value}
                    onChange={(e) => setActionType(e.target.value)}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: '#111827' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>추가 메모 (선택)</div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="요청 사항이 있으시면 작성해주세요"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px',
                border: '1px solid #e5e7eb', minHeight: '80px', resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '8px',
                border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!actionType}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '8px',
                border: 'none', background: actionType ? '#f97316' : '#e5e7eb',
                color: actionType ? 'white' : '#9ca3af', cursor: actionType ? 'pointer' : 'not-allowed',
                fontWeight: '600'
              }}
            >
              조치 요청하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 위반 상세 정보 카드
  const ViolationDetailCard = ({ violation }) => {
    const color = getViolationColor(violation.level)
    return (
      <div style={{
        background: color.bg,
        border: `1px solid ${color.text}20`,
        borderRadius: '8px',
        padding: '0.75rem',
        marginBottom: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span>{color.icon}</span>
          <span style={{ fontWeight: '600', color: color.text }}>{violation.name}</span>
          <span style={{
            fontSize: '0.7rem', padding: '0.125rem 0.375rem', borderRadius: '4px',
            background: `${color.text}20`, color: color.text
          }}>
            {violation.code}
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.5rem' }}>
          {violation.description}
        </p>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          <div><strong>법적 근거:</strong> {violation.legalBasis}</div>
          {violation.penalty && <div><strong>처벌:</strong> {violation.penalty}</div>}
          {violation.matchedKeywords?.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              <strong>발견된 표현:</strong>{' '}
              {violation.matchedKeywords.map((kw, i) => (
                <span key={i} style={{
                  background: '#fee2e2', color: '#dc2626', padding: '0.125rem 0.375rem',
                  borderRadius: '4px', marginRight: '0.25rem', fontSize: '0.7rem'
                }}>
                  "{kw}"
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '70px', height: '70px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #dc262620, #dc262640)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem'
        }}>
          <svg width="36" height="36" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#111827' }}>
          의료광고 위반 모니터링
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          우리 병원 관련 콘텐츠의 의료법 위반 여부를 실시간 탐지합니다
        </p>
      </div>

      {/* API 상태 경고 */}
      {apiStatus && !apiStatus.naverApiConfigured && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '12px',
          padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '600', color: '#92400e' }}>네이버 API 설정 필요</div>
            <div style={{ fontSize: '0.875rem', color: '#b45309' }}>
              NAVER_SEARCH_ID, NAVER_SEARCH_SECRET 환경변수를 설정해주세요.
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'search', label: '🔍 위반 검색' },
          { key: 'saved', label: '⭐ 저장 키워드', count: savedKeywords.length },
          { key: 'history', label: '📋 검색 기록', count: searchHistory.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.75rem 1.25rem', borderRadius: '10px', border: 'none',
              background: activeTab === tab.key ? '#dc2626' : '#f3f4f6',
              color: activeTab === tab.key ? 'white' : '#374151',
              fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                padding: '0.125rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 검색 탭 */}
      {activeTab === 'search' && (
        <>
          {/* 검색 폼 */}
          <div className="card" style={{ borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <form onSubmit={handleSearch}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="병원명을 입력하세요 (예: OO피부과, OO성형외과)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ flex: 1, padding: '0.875rem 1rem', borderRadius: '10px' }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.875rem 1.75rem', borderRadius: '10px',
                    background: loading ? '#9ca3af' : '#dc2626',
                    color: 'white', border: 'none', minWidth: '140px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  {loading ? '분석 중...' : '위반 검사'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>플랫폼:</span>
                  <select
                    value={filters.platform}
                    onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  >
                    <option value="all">전체</option>
                    <option value="blog">블로그</option>
                    <option value="cafe">카페</option>
                    <option value="kin">지식인</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>기간:</span>
                  <select
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  >
                    <option value="7d">최근 7일</option>
                    <option value="30d">최근 30일</option>
                    <option value="90d">최근 90일</option>
                    <option value="all">전체 기간</option>
                  </select>
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop: '1rem', background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '8px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* 결과 */}
          {results && (
            <>
              {/* 전체 위험도 대시보드 */}
              <div style={{
                background: getRiskColor(results.overallRisk?.level).bg,
                border: `2px solid ${getRiskColor(results.overallRisk?.level).border}`,
                borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      "{results.keyword}" 모니터링 결과
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: '2rem', fontWeight: '700',
                        color: getRiskColor(results.overallRisk?.level).text
                      }}>
                        {results.overallRisk?.label || '분석중'}
                      </span>
                      <span style={{
                        background: getRiskColor(results.overallRisk?.level).text,
                        color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px',
                        fontSize: '0.875rem', fontWeight: '500'
                      }}>
                        위험점수 {results.overallRisk?.score || 0}점
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                        {results.stats?.highRiskCount || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>심각</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>
                        {results.stats?.mediumRiskCount || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>주의</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>
                        {results.stats?.cleanCount || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>정상</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 통계 카드 */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.75rem', marginBottom: '1.5rem'
              }}>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#374151' }}>
                    {results.totalCount}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>총 콘텐츠</div>
                </div>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
                    {results.stats?.blogCount || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>블로그</div>
                </div>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                    {results.stats?.cafeCount || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>카페</div>
                </div>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
                    {results.stats?.kinCount || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>지식인</div>
                </div>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f97316' }}>
                    {results.stats?.hasViolationCount || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>위반의심</div>
                </div>
              </div>

              {/* 결과 목록 */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ color: '#111827', fontSize: '1rem' }}>
                    검출된 콘텐츠 ({results.items?.length || 0}건)
                  </h3>
                  <button
                    onClick={() => toggleSaveKeyword(results.keyword)}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb',
                      background: savedKeywords.includes(results.keyword) ? '#fef3c7' : 'white',
                      cursor: 'pointer', fontSize: '0.875rem'
                    }}
                  >
                    {savedKeywords.includes(results.keyword) ? '⭐ 저장됨' : '☆ 키워드 저장'}
                  </button>
                </div>

                {/* 위반 있는 항목 먼저 표시 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.items?.map((item) => (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: '1.25rem',
                        borderLeft: `4px solid ${getRiskColor(item.riskLevel).text}`,
                        background: item.violations?.length > 0 ? getRiskColor(item.riskLevel).bg : 'white'
                      }}
                    >
                      {/* 헤더 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              background: getRiskColor(item.riskLevel).bg,
                              color: getRiskColor(item.riskLevel).text,
                              border: `1px solid ${getRiskColor(item.riskLevel).text}`,
                              padding: '0.25rem 0.5rem', borderRadius: '6px',
                              fontSize: '0.75rem', fontWeight: '600'
                            }}>
                              {item.riskLabel || '양호'}
                            </span>
                            <span style={{
                              background: '#f3f4f6', color: '#374151',
                              padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem'
                            }}>
                              {getPlatformIcon(item.platform)} {item.platform}
                            </span>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{item.date}</span>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>by {item.author}</span>
                          </div>

                          <h4 style={{ color: '#111827', marginBottom: '0.5rem', fontWeight: '600', fontSize: '1rem' }}>
                            {item.title}
                          </h4>

                          {item.description && (
                            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '100px' }}>
                          {item.violations?.length > 0 && (
                            <button
                              onClick={() => setShowActionModal(item)}
                              style={{
                                padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none',
                                background: '#dc2626', color: 'white', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: '500'
                              }}
                            >
                              조치 요청
                            </button>
                          )}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.5rem 0.75rem', borderRadius: '8px',
                              border: '1px solid #e5e7eb', background: 'white',
                              color: '#374151', textDecoration: 'none', fontSize: '0.8rem',
                              textAlign: 'center'
                            }}
                          >
                            원문 보기
                          </a>
                        </div>
                      </div>

                      {/* 위반 상세 정보 */}
                      {item.violations?.length > 0 && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>
                            ⚠️ 탐지된 위반 사항 ({item.violations.length}건)
                          </div>
                          {item.violations.map((v, idx) => (
                            <ViolationDetailCard key={idx} violation={v} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {results.items?.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </>
          )}

          {/* 안내 (결과 없을 때) */}
          {!results && !loading && (
            <div className="card" style={{ borderRadius: '16px', padding: '2rem', background: '#fef2f2' }}>
              <h3 style={{ marginBottom: '1.25rem', color: '#991b1b' }}>의료광고 위반 탐지 항목</h3>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'
              }}>
                {[
                  { icon: '🔴', title: '치료효과 보장', desc: '100% 완치, 효과 보장 등', level: '심각' },
                  { icon: '🔴', title: '전후사진 게시', desc: '비포애프터, 시술전후 사진', level: '심각' },
                  { icon: '🔴', title: '과대/허위 광고', desc: '최초, 유일, 1위 등 표현', level: '심각' },
                  { icon: '🟠', title: '비교 광고', desc: '타병원 비교, 경쟁 언급', level: '주의' },
                  { icon: '🟠', title: '가격/할인 광고', desc: '파격 할인, 무료 시술', level: '주의' },
                  { icon: '🟠', title: '광고 미표기', desc: '협찬/체험단 미표기', level: '주의' }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    background: 'white', borderRadius: '12px', padding: '1rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.icon}</div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', color: '#111827' }}>{item.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>{item.desc}</p>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.125rem 0.5rem', borderRadius: '4px',
                      background: item.level === '심각' ? '#fef2f2' : '#fffbeb',
                      color: item.level === '심각' ? '#dc2626' : '#d97706'
                    }}>
                      {item.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 저장된 키워드 탭 */}
      {activeTab === 'saved' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#374151' }}>저장된 키워드</h3>
          {savedKeywords.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              저장된 키워드가 없습니다.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedKeywords.map((kw, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem', background: '#f9fafb', borderRadius: '10px'
                }}>
                  <span style={{ fontWeight: '500' }}>⭐ {kw}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setKeyword(kw); setActiveTab('search'); setTimeout(() => handleSearch(), 100) }}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                        background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '0.875rem'
                      }}
                    >
                      검사
                    </button>
                    <button
                      onClick={() => toggleSaveKeyword(kw)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb',
                        background: 'white', cursor: 'pointer', fontSize: '0.875rem'
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 검색 기록 탭 */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#374151' }}>검색 기록</h3>
            {searchHistory.length > 0 && (
              <button
                onClick={() => { setSearchHistory([]); localStorage.removeItem('viral-search-history') }}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #fecaca',
                  background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.875rem'
                }}
              >
                기록 삭제
              </button>
            )}
          </div>
          {searchHistory.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>검색 기록이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {searchHistory.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.875rem 1rem', background: '#f9fafb', borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: '500' }}>{item.keyword}</span>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '4px',
                      background: getRiskColor(item.riskLevel).bg,
                      color: getRiskColor(item.riskLevel).text
                    }}>
                      {getRiskColor(item.riskLevel).label}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{item.count}건</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                      {new Date(item.date).toLocaleDateString('ko-KR')}
                    </span>
                    <button
                      onClick={() => { setKeyword(item.keyword); setActiveTab('search') }}
                      style={{
                        padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none',
                        background: '#e5e7eb', cursor: 'pointer', fontSize: '0.8rem'
                      }}
                    >
                      다시 검사
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 조치 요청 모달 */}
      {showActionModal && (
        <ActionModal item={showActionModal} onClose={() => setShowActionModal(null)} />
      )}
    </div>
  )
}

export default ViralMonitoring
