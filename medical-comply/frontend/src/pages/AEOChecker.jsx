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
  const [emailModal, setEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')

  // 등급 기준
  const gradeInfo = {
    'A+': { min: 90, max: 100, color: '#059669', bgColor: 'rgba(5,150,105,0.1)', label: '최우수', desc: 'AI 검색에 최적화됨' },
    'A': { min: 80, max: 89, color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: '우수', desc: 'AI 친화적 구조' },
    'B+': { min: 70, max: 79, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: '양호', desc: '일부 개선 필요' },
    'B': { min: 60, max: 69, color: '#f97316', bgColor: 'rgba(249,115,22,0.1)', label: '보통', desc: '개선 권고' },
    'C': { min: 50, max: 59, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: '미흡', desc: '즉시 개선 필요' },
    'D': { min: 0, max: 49, color: '#dc2626', bgColor: 'rgba(220,38,38,0.1)', label: '매우미흡', desc: '전면 개편 필요' }
  }

  useEffect(() => {
    loadData()
    if (user?.email) setEmail(user.email)
  }, [user])

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

  const getGrade = (score) => {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B+'
    if (score >= 60) return 'B'
    if (score >= 50) return 'C'
    return 'D'
  }

  const getGradeColor = (score) => gradeInfo[getGrade(score)]?.color || '#64748b'
  const getGradeBg = (score) => gradeInfo[getGrade(score)]?.bgColor || 'rgba(100,116,139,0.1)'

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
        {"id": "schema", "name": "Schema.org 구조화 데이터", "points": 4, "maxPoints": 8, "status": "warning", "detail": "설명", "reason": "개선이 필요한 이유", "solution": "구체적인 개선 방법"}
      ]
    },
    "content": { "score": 18, "items": [...] },
    "technical": { "score": 20, "items": [...] },
    "trust": { "score": 16, "items": [...] }
  },
  "topIssues": ["개선점1", "개선점2", "개선점3"],
  "recommendations": [
    {"title": "권고1 제목", "reason": "이유", "method": "방법", "priority": "high"},
    {"title": "권고2 제목", "reason": "이유", "method": "방법", "priority": "medium"}
  ]
}`

  const callAPI = async (targetUrl) => {
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
      const results = []
      for (let i = 0; i < validUrls.length; i++) {
        setLoadingProgress({ current: i + 1, total: validUrls.length, message: `${i + 1}/${validUrls.length} 분석 중...` })
        const cached = getCached(validUrls[i])
        if (cached) {
          results.push({ ...cached, fromCache: true })
        } else {
          const r = await callAPI(validUrls[i])
          setCached(validUrls[i], r)
          results.push(r)
        }
      }
      setCompareResults(results)
      saveHistory([...results, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const sendEmail = async () => {
    if (!email) { setError('이메일을 입력해주세요'); return }
    if (!result) return

    setEmailSending(true)
    setEmailSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/aeo/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, result })
      })

      if (response.ok) {
        setEmailSuccess('이메일이 발송되었습니다!')
        setTimeout(() => { setEmailModal(false); setEmailSuccess('') }, 2000)
      } else {
        const err = await response.json()
        setError(err.error || '이메일 발송 실패')
      }
    } catch (err) {
      setError('이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setEmailSending(false)
    }
  }

  const generateReport = () => {
    const data = result || compareResults[0]
    if (!data) return

    const grade = getGrade(data.overallScore)
    const gradeData = gradeInfo[grade]

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>AEO/GEO 분석 리포트 - ${data.siteName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Malgun Gothic',-apple-system,sans-serif;font-size:11px;line-height:1.4;color:#1e293b;padding:20px;max-width:800px;margin:0 auto}
.header{text-align:center;padding:15px 0;border-bottom:2px solid #2563eb;margin-bottom:15px}
.header h1{font-size:18px;color:#2563eb;margin-bottom:5px}
.header p{font-size:12px;color:#64748b}
.score-section{display:flex;gap:15px;margin-bottom:15px}
.score-box{flex:1;text-align:center;padding:15px;background:linear-gradient(135deg,${gradeData.color},${gradeData.color}dd);border-radius:10px;color:white}
.score-box .score{font-size:36px;font-weight:800}
.score-box .grade{font-size:20px;font-weight:700}
.score-box .label{font-size:10px;opacity:0.9}
.grade-table{flex:1;background:#f8fafc;border-radius:10px;padding:10px;font-size:9px}
.grade-table h4{font-size:11px;margin-bottom:8px;color:#374151}
.grade-row{display:flex;justify-content:space-between;padding:3px 5px;border-radius:4px;margin-bottom:2px}
.grade-row.current{background:${gradeData.bgColor};font-weight:600}
.cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px}
.cat-box{background:#f8fafc;border-radius:8px;padding:10px;border:1px solid #e2e8f0}
.cat-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}
.cat-header h3{font-size:12px}
.cat-header .score{font-size:14px;font-weight:700}
.item{display:flex;gap:5px;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:10px}
.item:last-child{border-bottom:none}
.item .icon{width:14px;text-align:center}
.pass{color:#059669}.fail{color:#dc2626}.warning{color:#d97706}
.item .name{flex:1;font-weight:500}
.item .pts{color:#2563eb;font-weight:600}
.issues{background:#fef2f2;border-radius:8px;padding:10px;margin-bottom:10px}
.issues h4{color:#dc2626;font-size:11px;margin-bottom:6px}
.issue{padding:4px 0;font-size:10px;border-bottom:1px solid #fecaca}
.issue:last-child{border-bottom:none}
.recs{background:#eff6ff;border-radius:8px;padding:10px;margin-bottom:10px}
.recs h4{color:#2563eb;font-size:11px;margin-bottom:6px}
.rec{padding:5px 0;border-bottom:1px solid #bfdbfe;font-size:10px}
.rec:last-child{border-bottom:none}
.rec-title{font-weight:600;margin-bottom:2px}
.rec-detail{color:#64748b;font-size:9px}
.footer{text-align:center;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}
.print-btn{display:block;width:150px;margin:0 auto 15px;padding:8px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px}
@media print{.print-btn{display:none}body{padding:10px}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">PDF로 저장</button>
<div class="header">
<h1>AEO/GEO AI 친화도 분석 리포트</h1>
<p>${data.siteName} | ${data.url} | ${new Date().toLocaleDateString('ko-KR')}</p>
</div>
<div class="score-section">
<div class="score-box">
<div class="score">${data.overallScore}</div>
<div class="grade">${grade}</div>
<div class="label">${gradeData.label} - ${gradeData.desc}</div>
</div>
<div class="grade-table">
<h4>등급 기준표</h4>
${Object.entries(gradeInfo).map(([g,info])=>`<div class="grade-row ${g===grade?'current':''}" style="color:${info.color}"><span>${g} (${info.min}-${info.max})</span><span>${info.label}</span></div>`).join('')}
</div>
</div>
<div class="cat-grid">
${Object.entries(data.categories||{}).map(([k,c])=>`<div class="cat-box">
<div class="cat-header"><h3>${{structure:'구조',content:'콘텐츠',technical:'기술',trust:'신뢰도'}[k]}</h3><span class="score" style="color:${getGradeColor(c.score*4)}">${c.score}/25</span></div>
${c.items?.map(i=>`<div class="item"><span class="icon ${i.status}">${{pass:'O',fail:'X',warning:'!'}[i.status]}</span><span class="name">${i.name}</span><span class="pts">${i.points}/${i.maxPoints||8}</span></div>`).join('')}
</div>`).join('')}
</div>
${data.topIssues?.length?`<div class="issues"><h4>주요 문제점</h4>${data.topIssues.map(i=>`<div class="issue">${i}</div>`).join('')}</div>`:''}
<div class="recs"><h4>개선 권고사항</h4>
${(data.recommendations||[]).map(r=>`<div class="rec"><div class="rec-title">${typeof r==='string'?r:r.title}</div>${typeof r==='object'?`<div class="rec-detail">사유: ${r.reason||'-'} | 방법: ${r.method||'-'}</div>`:''}</div>`).join('')}
</div>
<div class="footer">MedicalComply AEO/GEO Analyzer | ${new Date().toLocaleString('ko-KR')}</div>
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

  const statusIcon = (s) => s === 'pass' ? <span style={{color:'#059669',fontWeight:'bold'}}>O</span> : s === 'fail' ? <span style={{color:'#dc2626',fontWeight:'bold'}}>X</span> : <span style={{color:'#d97706',fontWeight:'bold'}}>!</span>

  const catLabels = {
    structure: { icon: '🏗️', name: '구조', full: '구조적 요소' },
    content: { icon: '📝', name: '콘텐츠', full: '콘텐츠 요소' },
    technical: { icon: '⚙️', name: '기술', full: '기술적 요소' },
    trust: { icon: '🛡️', name: '신뢰도', full: '신뢰도 요소' }
  }

  const navItems = [
    { key: 'analyze', label: 'AEO 분석' },
    { key: 'compare', label: '경쟁사 비교' },
    { key: 'history', label: '분석 기록' },
    { key: 'dashboard', label: '통계' }
  ]

  return (
    <div className="container">
      <h1 style={{ marginBottom: '0.5rem' }}>AEO/GEO 친화도 분석</h1>
      <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>병의원 웹사이트의 AI 검색 최적화 점수를 측정합니다</p>

      {/* 등급 기준 안내 */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>등급 기준</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(gradeInfo).map(([grade, info]) => (
            <div key={grade} style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              background: info.bgColor,
              color: info.color,
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {grade} ({info.min}-{info.max}) {info.label}
            </div>
          ))}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
              <button onClick={runDeepAnalysis} disabled={loading} className="btn" style={{ background: '#059669', color: 'white' }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={generateReport} className="btn btn-primary" style={{ flex: 1 }}>
                      PDF 리포트
                    </button>
                    <button onClick={() => setEmailModal(true)} className="btn btn-secondary" style={{ flex: 1 }}>
                      이메일 발송
                    </button>
                  </div>
                </div>

                <div className="card" style={{ textAlign: 'center', background: getGradeBg(result.overallScore) }}>
                  <p style={{ color: getGradeColor(result.overallScore), fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>AI 친화도 점수</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '3.5rem', fontWeight: '800', color: getGradeColor(result.overallScore), lineHeight: 1 }}>{result.overallScore}</div>
                    <div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: getGradeColor(result.overallScore) }}>{getGrade(result.overallScore)}</div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>{gradeInfo[getGrade(result.overallScore)]?.label}</div>
                    </div>
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: getGradeColor(result.overallScore) }}>
                    {gradeInfo[getGrade(result.overallScore)]?.desc}
                  </p>
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
                        border: activeTab === key ? `2px solid ${getGradeColor(score * 4)}` : '1px solid var(--gray-200)',
                        background: activeTab === key ? getGradeBg(score * 4) : 'white'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{label.icon}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: getGradeColor(score * 4) }}>{score}/25</div>
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
                    <span style={{ marginLeft: 'auto', color: getGradeColor((result.categories?.[activeTab]?.score || 0) * 4) }}>
                      {result.categories?.[activeTab]?.score || 0}/25
                    </span>
                  </h3>
                  {result.categories?.[activeTab]?.items?.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--gray-50)', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {statusIcon(item.status)}
                          <strong style={{ fontSize: '0.875rem' }}>{item.name}</strong>
                        </div>
                        <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{item.points}/{item.maxPoints || 8}점</span>
                      </div>
                      <p style={{ color: 'var(--gray-600)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{item.detail}</p>
                      {item.reason && (
                        <p style={{ color: '#d97706', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          <strong>개선 사유:</strong> {item.reason}
                        </p>
                      )}
                      {item.solution && (
                        <p style={{ color: '#059669', fontSize: '0.75rem' }}>
                          <strong>개선 방법:</strong> {item.solution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>개선 권고사항</h3>

                  {result.topIssues?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>주요 문제점</h4>
                      {result.topIssues.map((issue, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(220,38,38,0.1)',
                          border: '1px solid rgba(220,38,38,0.2)',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          color: 'var(--danger)',
                          fontSize: '0.8125rem'
                        }}>
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 style={{ fontSize: '0.875rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>개선 방안</h4>
                  {(result.recommendations || []).slice(0, 5).map((rec, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(37,99,235,0.05)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                        {typeof rec === 'string' ? rec : rec.title}
                      </div>
                      {typeof rec === 'object' && (
                        <>
                          {rec.reason && <p style={{ fontSize: '0.75rem', color: '#d97706', marginBottom: '0.25rem' }}><strong>사유:</strong> {rec.reason}</p>}
                          {rec.method && <p style={{ fontSize: '0.75rem', color: '#059669' }}><strong>방법:</strong> {rec.method}</p>}
                        </>
                      )}
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
                { icon: '🏗️', title: '구조 (25점)', desc: 'Schema.org, 헤딩, 메타태그, OG태그' },
                { icon: '📝', title: '콘텐츠 (25점)', desc: 'FAQ, 정의문, 통계, 업데이트 날짜' },
                { icon: '⚙️', title: '기술 (25점)', desc: '속도, 모바일, AI크롤러, sitemap' },
                { icon: '🛡️', title: '신뢰도 (25점)', desc: '저자정보, 출처, 연락처, SSL' }
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
                {loading ? loadingProgress.message || '분석 중...' : '비교 분석 시작'}
              </button>
            </div>
            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
          </div>

          {compareResults.length > 0 && (
            <div>
              {/* 점수 비교 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareResults.length}, 1fr)`, gap: '1rem', marginBottom: '1.5rem' }}>
                {compareResults.map((r, i) => {
                  const grade = getGrade(r.overallScore)
                  return (
                    <div key={i} className="card" style={{ textAlign: 'center', background: getGradeBg(r.overallScore) }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>{r.siteName}</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: '800', color: getGradeColor(r.overallScore) }}>{r.overallScore}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', color: getGradeColor(r.overallScore) }}>{grade}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{gradeInfo[grade]?.label}</div>
                    </div>
                  )
                })}
              </div>

              {/* 카테고리별 상세 비교 */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>카테고리별 비교</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>카테고리</th>
                      {compareResults.map((r, i) => (
                        <th key={i} style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem' }}>{r.siteName?.slice(0, 15)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(catLabels).map(([key, label]) => (
                      <tr key={key} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.75rem' }}>{label.icon} {label.name}</td>
                        {compareResults.map((r, i) => {
                          const score = r.categories?.[key]?.score || 0
                          return (
                            <td key={i} style={{ textAlign: 'center', padding: '0.75rem' }}>
                              <span style={{ fontWeight: '700', color: getGradeColor(score * 4) }}>{score}/25</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--gray-50)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: '600' }}>총점</td>
                      {compareResults.map((r, i) => (
                        <td key={i} style={{ textAlign: 'center', padding: '0.75rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '1.125rem', color: getGradeColor(r.overallScore) }}>{r.overallScore}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 각 사이트 상세 */}
              {compareResults.map((r, idx) => (
                <div key={idx} className="card" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: getGradeColor(r.overallScore), color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: '700'
                    }}>#{idx + 1}</span>
                    {r.siteName}
                    <span style={{ marginLeft: 'auto', color: getGradeColor(r.overallScore), fontWeight: '700' }}>
                      {r.overallScore}점 ({getGrade(r.overallScore)})
                    </span>
                  </h3>

                  {r.topIssues?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>주요 문제점:</strong>
                      <ul style={{ marginTop: '0.25rem', marginLeft: '1.25rem', color: 'var(--gray-600)', fontSize: '0.8125rem' }}>
                        {r.topIssues.slice(0, 3).map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}

                  {r.recommendations?.length > 0 && (
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>개선 권고:</strong>
                      <ul style={{ marginTop: '0.25rem', marginLeft: '1.25rem', color: 'var(--gray-600)', fontSize: '0.8125rem' }}>
                        {r.recommendations.slice(0, 3).map((rec, i) => (
                          <li key={i}>{typeof rec === 'string' ? rec : rec.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '8px',
                      background: getGradeBg(item.overallScore),
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: getGradeColor(item.overallScore) }}>{item.overallScore}</span>
                      <span style={{ fontSize: '0.625rem', color: getGradeColor(item.overallScore) }}>{getGrade(item.overallScore)}</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: '600' }}>{item.siteName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{item.url}</div>
                    </div>
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
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: '총 분석', value: history.length, color: 'var(--primary)' },
                  { label: '평균 점수', value: Math.round(history.reduce((s, h) => s + h.overallScore, 0) / history.length), color: '#059669' },
                  { label: '최고 점수', value: Math.max(...history.map(h => h.overallScore)), color: '#f59e0b' },
                  { label: '최저 점수', value: Math.min(...history.map(h => h.overallScore)), color: '#dc2626' }
                ].map((s, i) => (
                  <div key={i} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{s.value}</div>
                    <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>등급 분포</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(gradeInfo).map(([grade, info]) => {
                    const count = history.filter(h => getGrade(h.overallScore) === grade).length
                    return (
                      <div key={grade} style={{
                        flex: 1, minWidth: '80px',
                        padding: '1rem', borderRadius: '8px',
                        background: info.bgColor, textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: info.color }}>{count}</div>
                        <div style={{ fontSize: '0.875rem', color: info.color }}>{grade}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 이메일 모달 */}
      {emailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setEmailModal(false)}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>이메일로 리포트 받기</h3>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소"
              style={{ marginBottom: '1rem' }}
            />
            {emailSuccess && <p style={{ color: '#059669', marginBottom: '1rem' }}>{emailSuccess}</p>}
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setEmailModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                취소
              </button>
              <button onClick={sendEmail} disabled={emailSending} className="btn btn-primary" style={{ flex: 1 }}>
                {emailSending ? '발송 중...' : '발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AEOChecker
