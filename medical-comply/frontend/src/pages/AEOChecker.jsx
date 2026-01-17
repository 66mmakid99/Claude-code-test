import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function AEOChecker({ user }) {
  const navigate = useNavigate()
  const [analysisType, setAnalysisType] = useState('aeo') // 'aeo' | 'seo'
  const [currentView, setCurrentView] = useState('analyze')
  const [url, setUrl] = useState('')
  const [compareUrls, setCompareUrls] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 1, message: '' })
  const [result, setResult] = useState(null)
  const [seoResult, setSeoResult] = useState(null)
  const [compareResults, setCompareResults] = useState([])
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('structure')
  const [activeSeoTab, setActiveSeoTab] = useState('meta')
  const [history, setHistory] = useState([])
  const [cache, setCache] = useState({})
  const [emailModal, setEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')

  // AEO 등급 기준
  const gradeInfo = {
    'A+': { min: 90, max: 100, color: '#059669', bgColor: 'rgba(5,150,105,0.1)', label: '최우수', desc: 'AI 검색에 최적화됨' },
    'A': { min: 80, max: 89, color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: '우수', desc: 'AI 친화적 구조' },
    'B+': { min: 70, max: 79, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: '양호', desc: '일부 개선 필요' },
    'B': { min: 60, max: 69, color: '#f97316', bgColor: 'rgba(249,115,22,0.1)', label: '보통', desc: '개선 권고' },
    'C': { min: 50, max: 59, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: '미흡', desc: '즉시 개선 필요' },
    'D': { min: 0, max: 49, color: '#dc2626', bgColor: 'rgba(220,38,38,0.1)', label: '매우미흡', desc: '전면 개편 필요' }
  }

  // SEO 검사 카테고리
  const seoCategories = {
    meta: { icon: '🏷️', name: '메타 태그', full: 'Meta Tags 분석' },
    social: { icon: '📱', name: '소셜 미디어', full: 'Social Meta Tags' },
    technical: { icon: '⚙️', name: '기술적 SEO', full: 'Technical SEO' },
    speed: { icon: '⚡', name: '속도 & 모바일', full: 'Speed & Mobile' },
    content: { icon: '📄', name: '콘텐츠', full: 'Content Analysis' },
    security: { icon: '🔒', name: '보안', full: 'Security' }
  }

  // SEO 검사 항목
  const seoCheckItems = {
    meta: [
      { id: 'title', name: 'Title 태그', desc: '페이지 제목이 60자 이내인지, 키워드를 포함하는지 확인', maxPoints: 10 },
      { id: 'description', name: 'Meta Description', desc: '설명이 160자 이내인지, 클릭을 유도하는지 확인', maxPoints: 10 },
      { id: 'keywords', name: 'Meta Keywords', desc: '키워드 태그 존재 여부 (중요도 낮음)', maxPoints: 3 },
      { id: 'viewport', name: 'Viewport 설정', desc: '모바일 반응형을 위한 viewport 메타 태그', maxPoints: 7 },
      { id: 'charset', name: 'Character Encoding', desc: 'UTF-8 문자 인코딩 설정', maxPoints: 5 },
      { id: 'language', name: 'Language 설정', desc: 'HTML lang 속성 설정', maxPoints: 5 }
    ],
    social: [
      { id: 'og_title', name: 'OG:Title', desc: 'Open Graph 제목 태그', maxPoints: 8 },
      { id: 'og_description', name: 'OG:Description', desc: 'Open Graph 설명 태그', maxPoints: 8 },
      { id: 'og_image', name: 'OG:Image', desc: 'Open Graph 이미지 (1200x630 권장)', maxPoints: 8 },
      { id: 'og_url', name: 'OG:URL', desc: 'Canonical URL 지정', maxPoints: 5 },
      { id: 'twitter_card', name: 'Twitter Card', desc: 'Twitter 공유 최적화', maxPoints: 6 },
      { id: 'twitter_image', name: 'Twitter Image', desc: 'Twitter 이미지 설정', maxPoints: 5 }
    ],
    technical: [
      { id: 'robots_txt', name: 'Robots.txt', desc: '검색엔진 크롤러 접근 제어 파일', maxPoints: 8 },
      { id: 'sitemap', name: 'XML Sitemap', desc: '사이트맵 존재 및 등록 여부', maxPoints: 10 },
      { id: 'canonical', name: 'Canonical URL', desc: '중복 콘텐츠 방지를 위한 정규 URL', maxPoints: 8 },
      { id: 'schema', name: 'Schema.org', desc: '구조화된 데이터 마크업', maxPoints: 10 },
      { id: 'hreflang', name: 'Hreflang', desc: '다국어 사이트 언어 태그', maxPoints: 4 }
    ],
    speed: [
      { id: 'page_speed', name: '페이지 로딩 속도', desc: 'LCP 2.5초 이내 권장', maxPoints: 15 },
      { id: 'mobile_friendly', name: '모바일 친화성', desc: '반응형 디자인 및 터치 요소', maxPoints: 12 },
      { id: 'image_optimization', name: '이미지 최적화', desc: '이미지 압축 및 lazy loading', maxPoints: 8 },
      { id: 'minification', name: 'CSS/JS 압축', desc: '리소스 최소화 여부', maxPoints: 5 }
    ],
    content: [
      { id: 'h1_tag', name: 'H1 태그', desc: '페이지당 1개의 H1 태그', maxPoints: 8 },
      { id: 'heading_structure', name: '헤딩 구조', desc: 'H1-H6 논리적 계층 구조', maxPoints: 7 },
      { id: 'image_alt', name: '이미지 Alt 텍스트', desc: '모든 이미지에 대체 텍스트', maxPoints: 8 },
      { id: 'internal_links', name: '내부 링크', desc: '사이트 내 링크 구조', maxPoints: 7 },
      { id: 'broken_links', name: '깨진 링크', desc: '404 오류 링크 없음', maxPoints: 5 },
      { id: 'content_length', name: '콘텐츠 길이', desc: '충분한 텍스트 콘텐츠', maxPoints: 5 }
    ],
    security: [
      { id: 'https', name: 'HTTPS', desc: 'SSL 인증서 적용', maxPoints: 15 },
      { id: 'mixed_content', name: 'Mixed Content', desc: 'HTTP/HTTPS 혼합 콘텐츠 없음', maxPoints: 8 },
      { id: 'security_headers', name: '보안 헤더', desc: 'CSP, X-Frame-Options 등', maxPoints: 7 }
    ]
  }

  useEffect(() => {
    loadData()
    if (user?.email) setEmail(user.email)
  }, [user])

  const loadData = () => {
    try {
      const historyData = localStorage.getItem('aeo-history-v7')
      if (historyData) setHistory(JSON.parse(historyData))
      const cacheData = localStorage.getItem('aeo-cache-v7')
      if (cacheData) setCache(JSON.parse(cacheData))
    } catch (e) {
      console.log('Storage init')
    }
  }

  const saveHistory = (newHistory) => {
    setHistory(newHistory)
    try { localStorage.setItem('aeo-history-v7', JSON.stringify(newHistory.slice(0, 50))) } catch (e) {}
  }

  const saveCache = (newCache) => {
    setCache(newCache)
    try {
      const keys = Object.keys(newCache)
      const trimmed = keys.slice(-20).reduce((acc, k) => { acc[k] = newCache[k]; return acc }, {})
      localStorage.setItem('aeo-cache-v7', JSON.stringify(trimmed))
    } catch (e) {}
  }

  const normalizeUrl = (u) => {
    let n = u.trim().toLowerCase()
    if (!n.startsWith('http')) n = 'https://' + n
    return n.replace(/\/+$/, '')
  }

  const getCached = (u, type) => {
    const key = `${type}:${normalizeUrl(u)}`
    const cached = cache[key]
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) return cached.data
    return null
  }

  const setCached = (u, data, type) => {
    const key = `${type}:${normalizeUrl(u)}`
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

  // AEO 분석 프롬프트
  const createAEOPrompt = (targetUrl) => `웹사이트 "${targetUrl}"를 AEO/GEO 관점에서 분석해주세요.

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

  // SEO 분석 프롬프트
  const createSEOPrompt = (targetUrl) => `웹사이트 "${targetUrl}"를 SEO 관점에서 상세히 분석해주세요.

다음 카테고리별로 검사하세요 (총 100점):

1. 메타 태그 (40점):
   - Title 태그 (10점): 존재 여부, 60자 이내, 키워드 포함
   - Meta Description (10점): 존재 여부, 160자 이내
   - Meta Keywords (3점): 존재 여부
   - Viewport (7점): 모바일 반응형 설정
   - Charset (5점): UTF-8 인코딩
   - Language (5점): lang 속성

2. 소셜 미디어 (40점):
   - OG:Title (8점), OG:Description (8점), OG:Image (8점)
   - OG:URL (5점), Twitter Card (6점), Twitter Image (5점)

3. 기술적 SEO (40점):
   - Robots.txt (8점), XML Sitemap (10점)
   - Canonical URL (8점), Schema.org (10점), Hreflang (4점)

4. 속도 & 모바일 (40점):
   - 페이지 속도 (15점), 모바일 친화성 (12점)
   - 이미지 최적화 (8점), CSS/JS 압축 (5점)

5. 콘텐츠 (40점):
   - H1 태그 (8점), 헤딩 구조 (7점), 이미지 Alt (8점)
   - 내부 링크 (7점), 깨진 링크 (5점), 콘텐츠 길이 (5점)

6. 보안 (30점):
   - HTTPS (15점), Mixed Content (8점), 보안 헤더 (7점)

반드시 아래 JSON 형식으로만 응답하세요:

{
  "siteName": "사이트 이름",
  "siteDescription": "사이트 설명",
  "overallScore": 75,
  "categories": {
    "meta": {
      "score": 32,
      "maxScore": 40,
      "items": [
        {"id": "title", "name": "Title 태그", "points": 8, "maxPoints": 10, "status": "pass", "detail": "상세 설명", "value": "실제 타이틀 값"}
      ]
    },
    "social": { "score": 28, "maxScore": 40, "items": [...] },
    "technical": { "score": 30, "maxScore": 40, "items": [...] },
    "speed": { "score": 25, "maxScore": 40, "items": [...] },
    "content": { "score": 30, "maxScore": 40, "items": [...] },
    "security": { "score": 25, "maxScore": 30, "items": [...] }
  },
  "criticalIssues": ["심각한 문제1", "심각한 문제2"],
  "warnings": ["경고1", "경고2"],
  "passedChecks": ["통과한 항목1", "통과한 항목2"],
  "recommendations": [
    {"title": "권고1", "priority": "high", "category": "meta", "impact": "높음"},
    {"title": "권고2", "priority": "medium", "category": "technical", "impact": "중간"}
  ]
}`

  const callAPI = async (targetUrl, type = 'aeo') => {
    const token = localStorage.getItem('token')
    const prompt = type === 'seo' ? createSEOPrompt(targetUrl) : createAEOPrompt(targetUrl)

    const response = await fetch('/api/aeo/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url: targetUrl, prompt })
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    const result = data.result

    if (type === 'aeo') {
      result.overallScore = ['structure', 'content', 'technical', 'trust']
        .reduce((sum, cat) => sum + (result.categories?.[cat]?.score || 0), 0)
    }

    result.url = normalizeUrl(targetUrl)
    result.analyzedAt = new Date().toISOString()
    result.type = type

    return result
  }

  const runAnalysis = async () => {
    if (!url.trim()) { setError('URL을 입력해주세요'); return }

    const cached = getCached(url, analysisType)
    if (cached) {
      if (analysisType === 'seo') {
        setSeoResult({ ...cached, fromCache: true })
      } else {
        setResult({ ...cached, fromCache: true })
      }
      setError('')
      return
    }

    setLoading(true)
    setError('')
    if (analysisType === 'seo') {
      setSeoResult(null)
    } else {
      setResult(null)
    }
    setLoadingProgress({ current: 0, total: 1, message: `${analysisType.toUpperCase()} 분석 중...` })

    try {
      const r = await callAPI(url, analysisType)
      r.analysisCount = 1
      r.reliability = 'standard'

      if (analysisType === 'seo') {
        setSeoResult(r)
      } else {
        setResult(r)
      }

      setCached(url, r, analysisType)
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
    if (analysisType === 'seo') {
      setSeoResult(null)
    } else {
      setResult(null)
    }

    try {
      const results = []
      for (let i = 0; i < 3; i++) {
        setLoadingProgress({ current: i + 1, total: 3, message: `${i + 1}차 분석 중...` })
        results.push(await callAPI(url, analysisType))
        if (i < 2) await new Promise(r => setTimeout(r, 1000))
      }

      const avgResult = { ...results[0] }

      if (analysisType === 'aeo') {
        const cats = ['structure', 'content', 'technical', 'trust']
        cats.forEach(cat => {
          if (avgResult.categories?.[cat]) {
            const scores = results.map(r => r.categories?.[cat]?.score || 0)
            avgResult.categories[cat].score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          }
        })
        const allScores = results.map(r => cats.reduce((s, c) => s + (r.categories?.[c]?.score || 0), 0))
        avgResult.overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      } else {
        const allScores = results.map(r => r.overallScore || 0)
        avgResult.overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      }

      avgResult.analysisCount = 3
      avgResult.reliability = 'high'

      if (analysisType === 'seo') {
        setSeoResult(avgResult)
      } else {
        setResult(avgResult)
      }

      setCached(url, avgResult, analysisType)
      saveHistory([avgResult, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runCombinedAnalysis = async () => {
    if (!url.trim()) { setError('URL을 입력해주세요'); return }

    setLoading(true)
    setError('')
    setResult(null)
    setSeoResult(null)

    try {
      setLoadingProgress({ current: 1, total: 2, message: 'AEO/GEO 분석 중...' })
      const aeoR = await callAPI(url, 'aeo')
      aeoR.analysisCount = 1
      setResult(aeoR)
      setCached(url, aeoR, 'aeo')

      setLoadingProgress({ current: 2, total: 2, message: 'SEO 분석 중...' })
      const seoR = await callAPI(url, 'seo')
      seoR.analysisCount = 1
      setSeoResult(seoR)
      setCached(url, seoR, 'seo')

      saveHistory([aeoR, seoR, ...history].slice(0, 50))
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = (s) => s === 'pass' ? <span style={{color:'#059669',fontWeight:'bold'}}>✓</span> : s === 'fail' ? <span style={{color:'#dc2626',fontWeight:'bold'}}>✗</span> : <span style={{color:'#d97706',fontWeight:'bold'}}>!</span>

  const catLabels = {
    structure: { icon: '🏗️', name: '구조', full: '구조적 요소' },
    content: { icon: '📝', name: '콘텐츠', full: '콘텐츠 요소' },
    technical: { icon: '⚙️', name: '기술', full: '기술적 요소' },
    trust: { icon: '🛡️', name: '신뢰도', full: '신뢰도 요소' }
  }

  const clearHistory = () => {
    if (confirm('기록을 삭제할까요?')) {
      setHistory([])
      localStorage.removeItem('aeo-history-v7')
    }
  }

  const clearCache = () => {
    if (confirm('캐시를 삭제할까요?')) {
      setCache({})
      localStorage.removeItem('aeo-cache-v7')
    }
  }

  return (
    <div className="container py-6">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">웹사이트 최적화 분석</h1>
        <p className="text-sm text-gray-500">AEO/GEO (AI 검색 최적화) + SEO (검색엔진 최적화) 통합 분석</p>
      </div>

      {/* 분석 타입 선택 탭 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setAnalysisType('aeo')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'aeo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🤖 AEO/GEO 분석
        </button>
        <button
          onClick={() => setAnalysisType('seo')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'seo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🔍 SEO 분석
        </button>
        <button
          onClick={() => setAnalysisType('combined')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'combined' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 통합 분석
        </button>
      </div>

      {/* 등급 기준 안내 */}
      <div className="rounded-lg border bg-white p-4 mb-6">
        <h4 className="text-sm font-medium mb-3">등급 기준</h4>
        <div className="flex flex-wrap gap-2">
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

      {/* URL 입력 */}
      <div className="rounded-lg border bg-white p-6 mb-6">
        <h3 className="font-medium mb-4">
          {analysisType === 'seo' ? '🔍 SEO 분석' : analysisType === 'combined' ? '📊 통합 분석' : '🤖 AEO/GEO 분석'}
        </h3>

        <input
          type="text"
          className="input mb-4"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && runAnalysis()}
          placeholder="분석할 URL (예: hospital.co.kr)"
        />

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? loadingProgress.message : '빠른 분석'}
          </button>
          <button
            onClick={runDeepAnalysis}
            disabled={loading}
            className="btn"
            style={{ background: '#059669', color: 'white' }}
          >
            {loading ? '...' : '정밀 분석 (3회)'}
          </button>
          {analysisType !== 'combined' && (
            <button
              onClick={runCombinedAnalysis}
              disabled={loading}
              className="btn"
              style={{ background: '#7c3aed', color: 'white' }}
            >
              {loading ? '...' : 'AEO + SEO 통합'}
            </button>
          )}
        </div>

        {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="rounded-lg border bg-white p-12 text-center">
          <div className="spinner mx-auto mb-4" style={{ width: '40px', height: '40px' }}></div>
          <h3 className="font-medium">{loadingProgress.message || '분석 중...'}</h3>
          {loadingProgress.total > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: loadingProgress.total }, (_, i) => (
                <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  i < loadingProgress.current ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{i + 1}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AEO 결과 */}
      {result && !loading && (analysisType === 'aeo' || analysisType === 'combined') && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">🤖 AEO/GEO 분석 결과</h2>

          {/* 점수 카드 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm font-medium text-blue-600 mb-2">분석 대상</p>
              <h2 className="text-xl font-semibold mb-1">{result.siteName}</h2>
              <p className="text-sm text-gray-500 mb-4">{result.siteDescription}</p>
              {result.fromCache && <span className="badge badge-warning text-xs">캐시된 결과</span>}
            </div>

            <div className="rounded-lg border p-6 text-center" style={{ background: getGradeBg(result.overallScore) }}>
              <p className="text-sm font-medium mb-2" style={{ color: getGradeColor(result.overallScore) }}>AI 친화도 점수</p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-5xl font-bold" style={{ color: getGradeColor(result.overallScore) }}>{result.overallScore}</span>
                <div>
                  <div className="text-2xl font-bold" style={{ color: getGradeColor(result.overallScore) }}>{getGrade(result.overallScore)}</div>
                  <div className="text-xs text-gray-500">{gradeInfo[getGrade(result.overallScore)]?.label}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 카테고리 탭 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Object.entries(catLabels).map(([key, label]) => {
              const score = result.categories?.[key]?.score || 0
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`rounded-lg border p-4 text-center transition-colors ${
                    activeTab === key ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{label.icon}</div>
                  <div className="text-lg font-bold" style={{ color: getGradeColor(score * 4) }}>{score}/25</div>
                  <div className="text-xs text-gray-500">{label.name}</div>
                </button>
              )
            })}
          </div>

          {/* 상세 결과 */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="font-medium mb-4">{catLabels[activeTab]?.icon} {catLabels[activeTab]?.full}</h3>
            <div className="space-y-3">
              {result.categories?.[activeTab]?.items?.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(item.status)}
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className="text-blue-600 font-semibold text-sm">{item.points}/{item.maxPoints || 8}점</span>
                  </div>
                  <p className="text-gray-600 text-sm">{item.detail}</p>
                  {item.solution && <p className="text-green-600 text-xs mt-2">💡 {item.solution}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEO 결과 */}
      {seoResult && !loading && (analysisType === 'seo' || analysisType === 'combined') && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">🔍 SEO 분석 결과</h2>

          {/* 점수 카드 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm font-medium text-green-600 mb-2">분석 대상</p>
              <h2 className="text-xl font-semibold mb-1">{seoResult.siteName}</h2>
              <p className="text-sm text-gray-500 mb-4">{seoResult.siteDescription}</p>
              {seoResult.fromCache && <span className="badge badge-warning text-xs">캐시된 결과</span>}
            </div>

            <div className="rounded-lg border p-6 text-center" style={{ background: getGradeBg(seoResult.overallScore) }}>
              <p className="text-sm font-medium mb-2" style={{ color: getGradeColor(seoResult.overallScore) }}>SEO 점수</p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-5xl font-bold" style={{ color: getGradeColor(seoResult.overallScore) }}>{seoResult.overallScore}</span>
                <div>
                  <div className="text-2xl font-bold" style={{ color: getGradeColor(seoResult.overallScore) }}>{getGrade(seoResult.overallScore)}</div>
                  <div className="text-xs text-gray-500">{gradeInfo[getGrade(seoResult.overallScore)]?.label}</div>
                </div>
              </div>
            </div>
          </div>

          {/* SEO 카테고리 탭 */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {Object.entries(seoCategories).map(([key, label]) => {
              const catData = seoResult.categories?.[key]
              const score = catData?.score || 0
              const maxScore = catData?.maxScore || 40
              const percent = Math.round((score / maxScore) * 100)
              return (
                <button
                  key={key}
                  onClick={() => setActiveSeoTab(key)}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    activeSeoTab === key ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xl mb-1">{label.icon}</div>
                  <div className="text-sm font-bold" style={{ color: getGradeColor(percent) }}>{score}/{maxScore}</div>
                  <div className="text-xs text-gray-500">{label.name}</div>
                </button>
              )
            })}
          </div>

          {/* SEO 상세 결과 */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="font-medium mb-4">{seoCategories[activeSeoTab]?.icon} {seoCategories[activeSeoTab]?.full}</h3>
            <div className="space-y-3">
              {seoResult.categories?.[activeSeoTab]?.items?.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(item.status)}
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className="text-green-600 font-semibold text-sm">{item.points}/{item.maxPoints}점</span>
                  </div>
                  <p className="text-gray-600 text-sm">{item.detail}</p>
                  {item.value && <p className="text-blue-600 text-xs mt-1 font-mono bg-blue-50 px-2 py-1 rounded">{item.value}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* SEO 요약 */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {seoResult.criticalIssues?.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="font-medium text-red-700 mb-2">🚨 심각한 문제 ({seoResult.criticalIssues.length})</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {seoResult.criticalIssues.slice(0, 3).map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {seoResult.warnings?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h4 className="font-medium text-amber-700 mb-2">⚠️ 경고 ({seoResult.warnings.length})</h4>
                <ul className="text-sm text-amber-600 space-y-1">
                  {seoResult.warnings.slice(0, 3).map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {seoResult.passedChecks?.length > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h4 className="font-medium text-green-700 mb-2">✅ 통과 ({seoResult.passedChecks.length})</h4>
                <ul className="text-sm text-green-600 space-y-1">
                  {seoResult.passedChecks.slice(0, 3).map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 안내 (결과 없을 때) */}
      {!result && !seoResult && !loading && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            {analysisType === 'seo' ? 'SEO 검사 항목' : analysisType === 'combined' ? '통합 검사 항목' : 'AEO/GEO 검사 항목'}
          </h3>

          {analysisType === 'seo' || analysisType === 'combined' ? (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(seoCategories).map(([key, label]) => (
                <div key={key} className="rounded-lg border bg-white p-4">
                  <div className="text-2xl mb-2">{label.icon}</div>
                  <h4 className="font-medium mb-2">{label.name}</h4>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {seoCheckItems[key]?.slice(0, 3).map((item, i) => (
                      <li key={i}>• {item.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: '🏗️', title: '구조 (25점)', desc: 'Schema.org, 헤딩, 메타태그' },
                { icon: '📝', title: '콘텐츠 (25점)', desc: 'FAQ, 정의문, 통계' },
                { icon: '⚙️', title: '기술 (25점)', desc: '속도, 모바일, sitemap' },
                { icon: '🛡️', title: '신뢰도 (25점)', desc: '저자정보, 출처, SSL' }
              ].map((f, i) => (
                <div key={i} className="rounded-lg border bg-white p-4">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h4 className="font-medium mb-1">{f.title}</h4>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 하단 기록/통계 링크 */}
      <div className="mt-8 pt-6 border-t flex justify-between items-center">
        <div className="text-sm text-gray-500">
          분석 기록: {history.length}건 | 캐시: {Object.keys(cache).length}건
        </div>
        <div className="flex gap-2">
          <button onClick={clearCache} className="btn btn-ghost text-sm h-8">캐시 삭제</button>
          <button onClick={clearHistory} className="btn btn-ghost text-sm h-8 text-red-600">기록 삭제</button>
        </div>
      </div>
    </div>
  )
}

export default AEOChecker
