import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function AEOChecker({ user }) {
  const navigate = useNavigate()
  const [currentView, setCurrentView] = useState('analyze')
  const [url, setUrl] = useState('')
  const [compareUrls, setCompareUrls] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 1, message: '' })
  const [result, setResult] = useState(null)
  const [compareResults, setCompareResults] = useState([])
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('structure')
  const [history, setHistory] = useState([])
  const [cache, setCache] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    try {
      const historyData = localStorage.getItem('aeo-history-v6')
      if (historyData) setHistory(JSON.parse(historyData))
      const cacheData = localStorage.getItem('aeo-cache-v6')
      if (cacheData) setCache(JSON.parse(cacheData))
    } catch (e) {
      console.log('Storage init')
    }
  }

  const saveHistory = (newHistory) => {
    setHistory(newHistory)
    try { localStorage.setItem('aeo-history-v6', JSON.stringify(newHistory.slice(0, 50))) } catch (e) {}
  }

  const saveCache = (newCache) => {
    setCache(newCache)
    try {
      const keys = Object.keys(newCache)
      const trimmed = keys.slice(-20).reduce((acc, k) => { acc[k] = newCache[k]; return acc }, {})
      localStorage.setItem('aeo-cache-v6', JSON.stringify(trimmed))
    } catch (e) {}
  }

  const normalizeUrl = (u) => {
    let n = u.trim().toLowerCase()
    if (!n.startsWith('http')) n = 'https://' + n
    return n.replace(/\/+$/, '')
  }

  const getCached = (u) => {
    const key = normalizeUrl(u)
    const cached = cache[key]
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) return cached.data
    return null
  }

  const setCached = (u, data) => {
    const key = normalizeUrl(u)
    const newCache = { ...cache, [key]: { data, timestamp: Date.now() } }
    saveCache(newCache)
  }

  const createPrompt = (targetUrl) => `웹사이트 "${targetUrl}"를 AEO/GEO 관점에서 분석해주세요.

채점 기준 (100점 만점):
1. 구조(25점): Schema.org(8점), 헤딩구조(6점), 메타태그(6점), OG태그(5점)
2. 콘텐츠(25점): FAQ섹션(8점), 명확한정의(7점), 통계데이터(5점), 업데이트날짜(5점)
3. 기술(25점): 로딩속도(7점), 모바일최적화(7점), AI크롤러허용(6점), 사이트맵(5점)
4. 신뢰도(25점): 저자정보(7점), 출처표기(6점), 연락처(6점), SSL(6점)

반드시 아래 JSON 형식으로만 응답하세요:

{
  "siteName": "사이트 이름",
  "siteDescription": "사이트 설명",
  "categories": {
    "structure": {
      "score": 15,
      "items": [
        {"id": "schema", "name": "Schema.org 구조화 데이터", "points": 4, "status": "warning", "detail": "설명"},
        {"id": "heading", "name": "H1-H6 헤딩 구조", "points": 5, "status": "pass", "detail": "설명"},
        {"id": "meta", "name": "메타 타이틀/디스크립션", "points": 4, "status": "warning", "detail": "설명"},
        {"id": "og", "name": "Open Graph 태그", "points": 2, "status": "fail", "detail": "설명"}
      ]
    },
    "content": {
      "score": 18,
      "items": [
        {"id": "faq", "name": "FAQ/Q&A 형식", "points": 6, "status": "pass", "detail": "설명"},
        {"id": "definition", "name": "명확한 정의/설명", "points": 5, "status": "pass", "detail": "설명"},
        {"id": "data", "name": "통계/수치 데이터", "points": 4, "status": "warning", "detail": "설명"},
        {"id": "update", "name": "업데이트 날짜", "points": 3, "status": "warning", "detail": "설명"}
      ]
    },
    "technical": {
      "score": 20,
      "items": [
        {"id": "speed", "name": "페이지 로딩 속도", "points": 6, "status": "pass", "detail": "설명"},
        {"id": "mobile", "name": "모바일 최적화", "points": 6, "status": "pass", "detail": "설명"},
        {"id": "robots", "name": "AI 크롤러 허용", "points": 4, "status": "warning", "detail": "설명"},
        {"id": "sitemap", "name": "Sitemap.xml", "points": 4, "status": "pass", "detail": "설명"}
      ]
    },
    "trust": {
      "score": 16,
      "items": [
        {"id": "author", "name": "저자/전문가 정보", "points": 4, "status": "warning", "detail": "설명"},
        {"id": "source", "name": "출처/참고문헌", "points": 3, "status": "warning", "detail": "설명"},
        {"id": "contact", "name": "연락처/회사 정보", "points": 5, "status": "pass", "detail": "설명"},
        {"id": "ssl", "name": "SSL 인증서", "points": 4, "status": "pass", "detail": "설명"}
      ]
    }
  },
  "topIssues": ["개선점1", "개선점2", "개선점3"],
  "recommendations": ["권고1", "권고2", "권고3", "권고4", "권고5"]
}`

  const callAPI = async (targetUrl) => {
    // 백엔드 API를 통해 분석 요청
    const token = localStorage.getItem('token')
    const response = await fetch('/api/aeo/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url: targetUrl, prompt: createPrompt(targetUrl) })
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || `API 오류: ${response.status}`)
    }

    const data = await response.json()

    const result = data.result
    result.overallScore = ['structure', 'content', 'technical', 'trust']
      .reduce((sum, cat) => sum + (result.categories?.[cat]?.score || 0), 0)
    result.url = normalizeUrl(targetUrl)
    result.analyzedAt = new Date().toISOString()

    return result
  }

  const runAnalysis = async () => {
    if (!url.trim()) { setError('URL을 입력해주세요'); return }

    const cached = getCached(url)
    if (cached) {
      setResult({ ...cached, fromCache: true })
      setError('')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setLoadingProgress({ current: 0, total: 1, message: '분석 중...' })

    try {
      const r = await callAPI(url)
      r.analysisCount = 1
      r.reliability = 'standard'
      setResult(r)
      setCached(url, r)
      saveHistory([r, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runDeepAnalysis = async () => {
    if (!url.trim()) { setError('URL을 입력해주세요'); return }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const results = []
      for (let i = 0; i < 3; i++) {
        setLoadingProgress({ current: i + 1, total: 3, message: `${i + 1}차 분석 중...` })
        results.push(await callAPI(url))
        if (i < 2) await new Promise(r => setTimeout(r, 1000))
      }

      const avgResult = { ...results[0] }
      const cats = ['structure', 'content', 'technical', 'trust']
      cats.forEach(cat => {
        if (avgResult.categories?.[cat]) {
          const scores = results.map(r => r.categories?.[cat]?.score || 0)
          avgResult.categories[cat].score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        }
      })

      const allScores = results.map(r => cats.reduce((s, c) => s + (r.categories?.[c]?.score || 0), 0))
      avgResult.overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      avgResult.scoreVariance = Math.round(Math.sqrt(allScores.reduce((s, v) => s + Math.pow(v - avgResult.overallScore, 2), 0) / allScores.length))
      avgResult.individualScores = allScores
      avgResult.analysisCount = 3
      avgResult.reliability = 'high'

      setResult(avgResult)
      setCached(url, avgResult)
      saveHistory([avgResult, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runCompareAnalysis = async () => {
    const validUrls = compareUrls.filter(u => u.trim())
    if (validUrls.length < 2) { setError('2개 이상 입력해주세요'); return }

    setLoading(true)
    setError('')
    setCompareResults([])

    try {
      const results = await Promise.all(validUrls.map(async (targetUrl) => {
        const cached = getCached(targetUrl)
        if (cached) return { ...cached, fromCache: true }
        const r = await callAPI(targetUrl)
        setCached(targetUrl, r)
        return r
      }))
      setCompareResults(results)
      saveHistory([...results, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = () => {
    const data = result || compareResults[0]
    if (!data) return

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>AEO 분석 - ${data.siteName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
.header{text-align:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #2563eb}h1{font-size:28px;color:#2563eb}
.score-box{text-align:center;padding:40px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:16px;color:white;margin:30px 0}
.score{font-size:72px;font-weight:800}.grade{font-size:36px;font-weight:700}
.cat{background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0}
.cat-head{display:flex;justify-content:space-between;margin-bottom:12px;font-weight:600}
.item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0}
.pass{color:#059669}.fail{color:#dc2626}.warning{color:#d97706}
.issue{background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin-bottom:8px;border-radius:0 8px 8px 0}
.rec{background:#eff6ff;border-left:4px solid #2563eb;padding:12px;margin-bottom:8px;border-radius:0 8px 8px 0}
.print-btn{display:block;width:200px;margin:0 auto 30px;padding:12px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer}
@media print{.print-btn{display:none}}</style></head>
<body><button class="print-btn" onclick="window.print()">PDF로 저장</button>
<div class="header"><h1>AEO/GEO 분석 리포트</h1><p>${data.siteName}</p></div>
<div class="score-box"><div class="score">${data.overallScore}</div><div class="grade">${data.overallScore>=80?'A':data.overallScore>=60?'B':'C'}</div></div>
${Object.entries(data.categories||{}).map(([k,c])=>`<div class="cat"><div class="cat-head"><span>${{structure:'구조',content:'콘텐츠',technical:'기술',trust:'신뢰도'}[k]}</span><span>${c.score}/25</span></div>
${c.items?.map(i=>`<div class="item"><span class="${i.status}">${{pass:'O',fail:'X',warning:'!'}[i.status]}</span><div style="flex:1"><strong>${i.name}</strong><p style="color:#64748b;font-size:13px">${i.detail}</p></div><span>${i.points}점</span></div>`).join('')}</div>`).join('')}
${data.topIssues?.map(i=>`<div class="issue">${i}</div>`).join('')||''}
${data.recommendations?.map(r=>`<div class="rec">${r}</div>`).join('')||''}
</body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
    else setError('팝업을 허용해주세요')
  }

  const clearHistory = () => {
    if (confirm('기록을 삭제할까요?')) {
      setHistory([])
      localStorage.removeItem('aeo-history-v6')
    }
  }

  const clearCache = () => {
    if (confirm('캐시를 삭제할까요?')) {
      setCache({})
      localStorage.removeItem('aeo-cache-v6')
    }
  }

  const scoreColor = (s) => s >= 80 ? 'var(--secondary)' : s >= 60 ? '#d97706' : 'var(--danger)'
  const grade = (s) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : s >= 50 ? 'C' : 'D'
  const statusIcon = (s) => s === 'pass' ? <span style={{color:'var(--secondary)',fontWeight:'bold'}}>O</span> : s === 'fail' ? <span style={{color:'var(--danger)',fontWeight:'bold'}}>X</span> : <span style={{color:'#d97706',fontWeight:'bold'}}>!</span>

  const catLabels = {
    structure: { icon: '🏗️', name: '구조', full: '구조적 요소' },
    content: { icon: '📝', name: '콘텐츠', full: '콘텐츠 요소' },
    technical: { icon: '⚙️', name: '기술', full: '기술적 요소' },
    trust: { icon: '🛡️', name: '신뢰도', full: '신뢰도 요소' }
  }

  const navItems = [
    { key: 'analyze', label: '분석' },
    { key: 'compare', label: '비교' },
    { key: 'history', label: '기록' },
    { key: 'dashboard', label: '통계' }
  ]

  return (
    <div className="container">
      <h1 style={{ marginBottom: '0.5rem' }}>AEO/GEO 친화도 분석</h1>
      <p style={{ color: 'var(--gray-500)', marginBottom: '2rem' }}>병의원 웹사이트의 AI 검색 최적화 점수를 측정합니다</p>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {navItems.map(n => (
          <button
            key={n.key}
            onClick={() => setCurrentView(n.key)}
            className={currentView === n.key ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* 분석 뷰 */}
      {currentView === 'analyze' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>웹사이트 URL 입력</h3>
            <input
              type="text"
              className="input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && runAnalysis()}
              placeholder="분석할 URL (예: hospital.co.kr)"
              style={{ marginBottom: '1rem' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button onClick={runAnalysis} disabled={loading} className="btn btn-primary">
                {loading ? `${loadingProgress.message}` : '빠른 분석'}
              </button>
              <button onClick={runDeepAnalysis} disabled={loading} className="btn btn-secondary" style={{ background: 'var(--secondary)', color: 'white' }}>
                {loading ? '...' : '정밀 분석 (3회)'}
              </button>
            </div>

            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
          </div>

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
              <h3>{loadingProgress.message || '분석 중...'}</h3>
              {loadingProgress.total > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: i <= loadingProgress.current ? 'var(--primary)' : 'var(--gray-200)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: i <= loadingProgress.current ? 'white' : 'var(--gray-500)', fontWeight: '600'
                    }}>{i}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result && !loading && (
            <div>
              {/* 배지 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {result.fromCache && <span className="badge badge-warning">캐시된 결과</span>}
                {result.analysisCount > 1 && <span className="badge badge-success">{result.analysisCount}회 분석 평균</span>}
              </div>

              {/* 점수 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card">
                  <p style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>분석 대상</p>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{result.siteName}</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1rem' }}>{result.siteDescription}</p>
                  <button onClick={generateReport} className="btn btn-primary" style={{ width: '100%' }}>
                    리포트 보기
                  </button>
                </div>

                <div className="card" style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>AI 친화도 점수</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '3.5rem', fontWeight: '800', color: scoreColor(result.overallScore), lineHeight: 1 }}>{result.overallScore}</div>
                    <div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: scoreColor(result.overallScore) }}>{grade(result.overallScore)}</div>
                      <div style={{ color: 'var(--gray-500)' }}>/ 100</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 카테고리 버튼 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {Object.entries(catLabels).map(([key, label]) => {
                  const score = result.categories?.[key]?.score || 0
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className="card"
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: '1rem',
                        border: activeTab === key ? '2px solid var(--primary)' : '1px solid var(--gray-200)'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{label.icon}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: scoreColor(score * 4) }}>{score}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{label.name}</div>
                    </button>
                  )
                })}
              </div>

              {/* 상세 결과 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <div className="card">
                  <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {catLabels[activeTab]?.icon} {catLabels[activeTab]?.full}
                    <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}>{result.categories?.[activeTab]?.score || 0}/25</span>
                  </h3>
                  {result.categories?.[activeTab]?.items?.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--gray-50)', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {statusIcon(item.status)}
                          <strong style={{ fontSize: '0.875rem' }}>{item.name}</strong>
                        </div>
                        <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{item.points}점</span>
                      </div>
                      <p style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', marginLeft: '1.5rem' }}>{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>개선 권고</h3>
                  {result.topIssues?.map((issue, idx) => (
                    <div key={idx} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem', color: 'var(--danger)', fontSize: '0.8125rem' }}>
                      {issue}
                    </div>
                  ))}
                  {result.recommendations?.slice(0, 3).map((rec, idx) => (
                    <div key={idx} style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '0.8125rem' }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 안내 카드 */}
          {!result && !loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '🏗️', title: '구조 분석', desc: 'Schema.org, 헤딩, 메타태그' },
                { icon: '📝', title: '콘텐츠', desc: 'FAQ, 정의문, 통계 데이터' },
                { icon: '⚙️', title: '기술', desc: '속도, 모바일, AI 크롤러' },
                { icon: '🛡️', title: '신뢰도', desc: '저자, 출처, SSL 인증서' }
              ].map((f, i) => (
                <div key={i} className="card">
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{f.title}</h3>
                  <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 비교 뷰 */}
      {currentView === 'compare' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>경쟁사 비교 분석</h3>
            {compareUrls.map((u, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--primary)', minWidth: '40px', fontWeight: '600' }}>#{idx + 1}</span>
                <input
                  type="text"
                  className="input"
                  value={u}
                  onChange={e => { const arr = [...compareUrls]; arr[idx] = e.target.value; setCompareUrls(arr) }}
                  placeholder="URL 입력"
                  style={{ flex: 1 }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              {compareUrls.length < 4 && (
                <button onClick={() => setCompareUrls([...compareUrls, ''])} className="btn btn-secondary">
                  + URL 추가
                </button>
              )}
              <button onClick={runCompareAnalysis} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                {loading ? '분석 중...' : '비교 분석'}
              </button>
            </div>
            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
          </div>

          {compareResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {compareResults.map((r, i) => (
                <div key={i} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>{r.siteName}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: scoreColor(r.overallScore) }}>{r.overallScore}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: scoreColor(r.overallScore) }}>{grade(r.overallScore)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 기록 뷰 */}
      {currentView === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2>분석 기록</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={clearCache} className="btn btn-secondary">캐시 삭제</button>
              <button onClick={clearHistory} className="btn" style={{ background: 'var(--danger)', color: 'white' }}>기록 삭제</button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--gray-500)' }}>기록이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((item, idx) => (
                <div key={idx} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: scoreColor(item.overallScore) }}>{item.overallScore}</span>
                    <span style={{ fontWeight: '600' }}>{item.siteName}</span>
                  </div>
                  <button onClick={() => { setResult(item); setCurrentView('analyze') }} className="btn btn-primary">
                    보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 통계 뷰 */}
      {currentView === 'dashboard' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>분석 통계</h2>
          {history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--gray-500)' }}>데이터가 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {[
                { label: '총 분석', value: history.length, color: 'var(--primary)' },
                { label: '평균 점수', value: Math.round(history.reduce((s, h) => s + h.overallScore, 0) / history.length), color: 'var(--secondary)' },
                { label: '최고 점수', value: Math.max(...history.map(h => h.overallScore)), color: '#d97706' },
                { label: '최저 점수', value: Math.min(...history.map(h => h.overallScore)), color: 'var(--danger)' }
              ].map((s, i) => (
                <div key={i} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: s.color }}>{s.value}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AEOChecker
