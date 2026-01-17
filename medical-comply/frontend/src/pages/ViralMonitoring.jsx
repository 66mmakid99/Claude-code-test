import { useState, useEffect } from 'react'

function ViralMonitoring({ user }) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [searchHistory, setSearchHistory] = useState([])
  const [savedKeywords, setSavedKeywords] = useState([])
  const [activeTab, setActiveTab] = useState('search') // search, saved, history
  const [filters, setFilters] = useState({
    platform: 'all', // all, blog, cafe
    period: '7d', // 1d, 7d, 30d, 90d
    sort: 'recent' // recent, views, relevance
  })
  const [selectedItems, setSelectedItems] = useState([])

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    try {
      const history = localStorage.getItem('viral-search-history')
      const saved = localStorage.getItem('viral-saved-keywords')
      if (history) setSearchHistory(JSON.parse(history))
      if (saved) setSavedKeywords(JSON.parse(saved))
    } catch (e) {}
  }, [])

  // 검색 히스토리 저장
  const saveToHistory = (kw, count) => {
    const newHistory = [
      { keyword: kw, count, date: new Date().toISOString() },
      ...searchHistory.filter(h => h.keyword !== kw)
    ].slice(0, 20)
    setSearchHistory(newHistory)
    localStorage.setItem('viral-search-history', JSON.stringify(newHistory))
  }

  // 키워드 저장
  const toggleSaveKeyword = (kw) => {
    const exists = savedKeywords.includes(kw)
    const newSaved = exists
      ? savedKeywords.filter(k => k !== kw)
      : [...savedKeywords, kw]
    setSavedKeywords(newSaved)
    localStorage.setItem('viral-saved-keywords', JSON.stringify(newSaved))
  }

  // 플랫폼별 아이콘
  const getPlatformIcon = (platform) => {
    if (platform.includes('블로그')) return '📝'
    if (platform.includes('카페')) return '💬'
    if (platform.includes('지식인')) return '❓'
    return '📄'
  }

  // 플랫폼별 색상
  const getPlatformColor = (platform) => {
    if (platform.includes('블로그')) return { bg: '#dbeafe', text: '#1d4ed8' }
    if (platform.includes('카페')) return { bg: '#d1fae5', text: '#065f46' }
    if (platform.includes('지식인')) return { bg: '#fef3c7', text: '#92400e' }
    return { bg: '#f3f4f6', text: '#374151' }
  }

  // 감성 분석 색상
  const getSentimentColor = (sentiment) => {
    if (sentiment === 'positive') return { bg: '#dcfce7', text: '#166534', label: '긍정' }
    if (sentiment === 'negative') return { bg: '#fee2e2', text: '#991b1b', label: '부정' }
    return { bg: '#f3f4f6', text: '#374151', label: '중립' }
  }

  // 검색 실행
  const handleSearch = async (e) => {
    e?.preventDefault()
    const searchKeyword = keyword.trim()
    if (!searchKeyword) {
      setError('검색 키워드를 입력해주세요')
      return
    }

    setLoading(true)
    setError('')
    setSelectedItems([])

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

      if (!response.ok) {
        throw new Error('검색 중 오류가 발생했습니다')
      }

      const data = await response.json()
      setResults(data)
      saveToHistory(searchKeyword, data.totalCount)
    } catch (err) {
      // API가 없으면 목업 데이터 사용 (개발용)
      const mockResults = generateMockResults(searchKeyword, filters)
      setResults(mockResults)
      saveToHistory(searchKeyword, mockResults.totalCount)
    } finally {
      setLoading(false)
    }
  }

  // 목업 데이터 생성 (API 연동 전 개발용)
  const generateMockResults = (kw, filters) => {
    const platforms = ['네이버 블로그', '네이버 카페', '네이버 지식인']
    const sentiments = ['positive', 'neutral', 'negative']
    const titles = [
      `${kw} 실제 후기 - 3개월 다녀본 솔직 리뷰`,
      `${kw} 추천 vs 비추천? 직접 경험담`,
      `${kw} 가격 비교 정리 (2024년 최신)`,
      `${kw} 방문 전 꼭 알아야 할 것들`,
      `${kw} 상담 받고 온 후기`,
      `[내돈내산] ${kw} 한달 후기`,
      `${kw} 예약 방법 총정리`,
      `${kw} 위치/주차 정보`,
      `${kw} vs 경쟁업체 비교`,
      `${kw} 이벤트 정보 공유`,
      `${kw} 전문의 상담 후기`,
      `${kw} 시술 비용 공개`,
      `${kw} 재방문 후기 (2차 방문)`,
      `${kw} 친구 추천 받고 다녀왔어요`,
      `강남 ${kw} 근처 맛집까지`,
    ]

    const items = titles.map((title, idx) => {
      const daysAgo = Math.floor(Math.random() * 30)
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)

      return {
        id: idx + 1,
        title,
        url: `https://blog.naver.com/example${idx}`,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        author: `user${Math.floor(Math.random() * 1000)}`,
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 10000) + 100,
        likes: Math.floor(Math.random() * 500),
        comments: Math.floor(Math.random() * 100),
        sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
        snippet: `${kw}에 대한 상세한 후기입니다. 직접 방문해서 경험한 내용을 솔직하게 공유합니다. 전반적인 만족도와 개선점을 정리했습니다.`,
        hasImage: Math.random() > 0.3,
        isAd: Math.random() > 0.85
      }
    })

    // 필터 적용
    let filtered = items
    if (filters.platform !== 'all') {
      const platformMap = { blog: '블로그', cafe: '카페', kin: '지식인' }
      filtered = filtered.filter(i => i.platform.includes(platformMap[filters.platform] || ''))
    }

    // 정렬
    if (filters.sort === 'views') {
      filtered.sort((a, b) => b.views - a.views)
    } else if (filters.sort === 'recent') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
    }

    const positiveCount = filtered.filter(i => i.sentiment === 'positive').length
    const negativeCount = filtered.filter(i => i.sentiment === 'negative').length

    return {
      keyword: kw,
      totalCount: filtered.length,
      items: filtered,
      stats: {
        blogCount: filtered.filter(i => i.platform.includes('블로그')).length,
        cafeCount: filtered.filter(i => i.platform.includes('카페')).length,
        kinCount: filtered.filter(i => i.platform.includes('지식인')).length,
        totalViews: filtered.reduce((sum, i) => sum + i.views, 0),
        avgViews: Math.round(filtered.reduce((sum, i) => sum + i.views, 0) / filtered.length),
        positiveRatio: Math.round((positiveCount / filtered.length) * 100),
        negativeRatio: Math.round((negativeCount / filtered.length) * 100)
      },
      analyzedAt: new Date().toISOString()
    }
  }

  // 선택 항목 토글
  const toggleSelect = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // 전체 선택
  const selectAll = () => {
    if (selectedItems.length === results?.items?.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(results?.items?.map(i => i.id) || [])
    }
  }

  // CSV 내보내기
  const exportCSV = () => {
    if (!results?.items) return

    const items = selectedItems.length > 0
      ? results.items.filter(i => selectedItems.includes(i.id))
      : results.items

    const headers = ['제목', '플랫폼', '작성자', '날짜', '조회수', '좋아요', '댓글', '감성', 'URL']
    const rows = items.map(item => [
      item.title,
      item.platform,
      item.author,
      item.date,
      item.views,
      item.likes,
      item.comments,
      getSentimentColor(item.sentiment).label,
      item.url
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `바이럴모니터링_${results.keyword}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #f9731620, #f9731640)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem'
        }}>
          <svg width="36" height="36" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#111827' }}>
          네이버 바이럴 모니터링
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          병원명, 키워드로 네이버 블로그/카페 콘텐츠를 실시간 모니터링합니다
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'search', label: '🔍 검색', count: null },
          { key: 'saved', label: '⭐ 저장된 키워드', count: savedKeywords.length },
          { key: 'history', label: '📋 검색 기록', count: searchHistory.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === tab.key ? '#f97316' : '#f3f4f6',
              color: activeTab === tab.key ? 'white' : '#374151',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                padding: '0.125rem 0.5rem',
                borderRadius: '10px',
                fontSize: '0.75rem'
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
                  placeholder="병원명, 브랜드명, 키워드 입력"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ flex: 1, padding: '0.875rem 1rem', borderRadius: '10px' }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={loading}
                  style={{
                    padding: '0.875rem 1.75rem',
                    borderRadius: '10px',
                    background: loading ? '#9ca3af' : '#f97316',
                    color: 'white',
                    border: 'none',
                    minWidth: '120px',
                    fontWeight: '600'
                  }}
                >
                  {loading ? '검색 중...' : '모니터링'}
                </button>
              </div>

              {/* 필터 */}
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
                    <option value="1d">최근 1일</option>
                    <option value="7d">최근 7일</option>
                    <option value="30d">최근 30일</option>
                    <option value="90d">최근 90일</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>정렬:</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  >
                    <option value="recent">최신순</option>
                    <option value="views">조회수순</option>
                    <option value="relevance">관련도순</option>
                  </select>
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop: '1rem',
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
            <>
              {/* 통계 요약 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f97316' }}>
                    {results.totalCount}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>총 콘텐츠</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#3b82f6' }}>
                    {results.stats?.blogCount || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>블로그</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>
                    {results.stats?.cafeCount || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>카페</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#8b5cf6' }}>
                    {(results.stats?.totalViews || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>총 조회수</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#16a34a' }}>
                      {results.stats?.positiveRatio || 0}%
                    </span>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#dc2626' }}>
                      {results.stats?.negativeRatio || 0}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>긍정/부정 비율</div>
                </div>
              </div>

              {/* 결과 헤더 */}
              <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.length === results.items?.length && results.items?.length > 0}
                        onChange={selectAll}
                      />
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>전체 선택</span>
                    </label>
                    {selectedItems.length > 0 && (
                      <span style={{ fontSize: '0.875rem', color: '#f97316' }}>
                        {selectedItems.length}개 선택됨
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => toggleSaveKeyword(results.keyword)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        background: savedKeywords.includes(results.keyword) ? '#fef3c7' : 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      {savedKeywords.includes(results.keyword) ? '⭐ 저장됨' : '☆ 키워드 저장'}
                    </button>
                    <button
                      onClick={exportCSV}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      📥 CSV 내보내기
                    </button>
                  </div>
                </div>
              </div>

              {/* 결과 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {results.items?.map((item) => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      borderLeft: selectedItems.includes(item.id) ? '3px solid #f97316' : '3px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {/* 체크박스 */}
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        style={{ marginTop: '0.25rem' }}
                      />

                      {/* 콘텐츠 */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{
                            ...getPlatformColor(item.platform),
                            background: getPlatformColor(item.platform).bg,
                            color: getPlatformColor(item.platform).text,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {getPlatformIcon(item.platform)} {item.platform}
                          </span>
                          <span style={{
                            ...getSentimentColor(item.sentiment),
                            background: getSentimentColor(item.sentiment).bg,
                            color: getSentimentColor(item.sentiment).text,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem'
                          }}>
                            {getSentimentColor(item.sentiment).label}
                          </span>
                          {item.isAd && (
                            <span style={{
                              background: '#fecaca',
                              color: '#991b1b',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem'
                            }}>
                              광고
                            </span>
                          )}
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{item.date}</span>
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>by {item.author}</span>
                        </div>

                        <h4 style={{ color: '#111827', marginBottom: '0.5rem', fontWeight: '600' }}>
                          {item.hasImage && <span style={{ marginRight: '0.25rem' }}>🖼️</span>}
                          {item.title}
                        </h4>

                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                          {item.snippet}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                          <span>👁️ {item.views.toLocaleString()}</span>
                          <span>❤️ {item.likes}</span>
                          <span>💬 {item.comments}</span>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            background: 'white',
                            color: '#374151',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            textAlign: 'center'
                          }}
                        >
                          원문 보기
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 기능 안내 (결과 없을 때) */}
          {!results && !loading && (
            <div className="card" style={{ borderRadius: '16px', padding: '2rem', background: '#f9fafb' }}>
              <h3 style={{ marginBottom: '1.25rem', color: '#374151' }}>모니터링 기능</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem'
              }}>
                {[
                  { icon: '📝', title: '블로그 모니터링', desc: '네이버 블로그 실시간 추적' },
                  { icon: '💬', title: '카페 모니터링', desc: '네이버 카페 게시글 탐지' },
                  { icon: '❓', title: '지식인 모니터링', desc: '네이버 지식인 질문/답변 추적' },
                  { icon: '😊', title: '감성 분석', desc: '긍정/부정/중립 자동 분류' },
                  { icon: '📊', title: '통계 대시보드', desc: '조회수, 반응 통계 분석' },
                  { icon: '📥', title: 'CSV 내보내기', desc: '데이터 엑셀 다운로드' }
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
        </>
      )}

      {/* 저장된 키워드 탭 */}
      {activeTab === 'saved' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#374151' }}>저장된 키워드</h3>
          {savedKeywords.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              저장된 키워드가 없습니다. 검색 후 키워드를 저장해보세요.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedKeywords.map((kw, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '10px'
                }}>
                  <span style={{ fontWeight: '500' }}>⭐ {kw}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setKeyword(kw)
                        setActiveTab('search')
                        setTimeout(() => handleSearch(), 100)
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#f97316',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      검색
                    </button>
                    <button
                      onClick={() => toggleSaveKeyword(kw)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
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
                onClick={() => {
                  setSearchHistory([])
                  localStorage.removeItem('viral-search-history')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                기록 삭제
              </button>
            )}
          </div>
          {searchHistory.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              검색 기록이 없습니다.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {searchHistory.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem 1rem',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <div>
                    <span style={{ fontWeight: '500', marginRight: '0.75rem' }}>{item.keyword}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                      {item.count}개 결과
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                      {new Date(item.date).toLocaleDateString('ko-KR')}
                    </span>
                    <button
                      onClick={() => {
                        setKeyword(item.keyword)
                        setActiveTab('search')
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#e5e7eb',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      다시 검색
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ViralMonitoring
