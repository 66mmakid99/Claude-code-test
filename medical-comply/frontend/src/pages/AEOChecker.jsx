import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function AEOChecker({ user }) {
  const navigate = useNavigate()
  const [analysisType, setAnalysisType] = useState('aeo')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 1, message: '' })
  const [result, setResult] = useState(null)
  const [seoResult, setSeoResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('structure')
  const [activeSeoTab, setActiveSeoTab] = useState('common')
  const [history, setHistory] = useState([])
  const [cache, setCache] = useState({})
  const [showSeoInfo, setShowSeoInfo] = useState(false)

  // 등급 기준
  const gradeInfo = {
    'A+': { min: 90, max: 100, color: '#059669', bgColor: 'rgba(5,150,105,0.1)', label: '최우수', desc: '검색엔진에 최적화됨' },
    'A': { min: 80, max: 89, color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: '우수', desc: '대부분의 요소가 최적화됨' },
    'B+': { min: 70, max: 79, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: '양호', desc: '일부 개선 필요' },
    'B': { min: 60, max: 69, color: '#f97316', bgColor: 'rgba(249,115,22,0.1)', label: '보통', desc: '여러 항목 개선 권고' },
    'C': { min: 50, max: 59, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: '미흡', desc: '즉시 개선 필요' },
    'D': { min: 0, max: 49, color: '#dc2626', bgColor: 'rgba(220,38,38,0.1)', label: '매우미흡', desc: '전면 개편 필요' }
  }

  // SEO 검사 카테고리 (seositecheckup.com 스타일)
  const seoCategories = {
    common: { icon: '🔍', name: 'Common SEO', full: '일반 SEO 이슈', color: '#3b82f6' },
    meta: { icon: '🏷️', name: 'Meta Tags', full: '메타 태그 분석', color: '#8b5cf6' },
    social: { icon: '📱', name: 'Social', full: '소셜 미디어 최적화', color: '#ec4899' },
    speed: { icon: '⚡', name: 'Speed', full: '페이지 속도 & 성능', color: '#f59e0b' },
    security: { icon: '🔒', name: 'Security', full: '보안 검사', color: '#10b981' },
    mobile: { icon: '📲', name: 'Mobile', full: '모바일 최적화', color: '#06b6d4' },
    advanced: { icon: '🎯', name: 'Advanced', full: '고급 SEO', color: '#6366f1' }
  }

  // SEO 효과 정보
  const seoImpactInfo = {
    traffic: { icon: '📈', title: '트래픽 증가', desc: 'SEO 최적화는 평균 50-100% 유기적 트래픽 증가 효과' },
    cost: { icon: '💰', title: '마케팅 비용 절감', desc: '유료 광고 대비 장기적으로 67% 낮은 고객 획득 비용' },
    trust: { icon: '🏆', title: '신뢰도 향상', desc: '검색 상위 노출 시 브랜드 신뢰도 75% 향상' },
    conversion: { icon: '🎯', title: '전환율 개선', desc: 'SEO 트래픽은 유료 광고 대비 14.6% 높은 전환율' }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    try {
      const historyData = localStorage.getItem('aeo-history-v8')
      if (historyData) setHistory(JSON.parse(historyData))
      const cacheData = localStorage.getItem('aeo-cache-v8')
      if (cacheData) setCache(JSON.parse(cacheData))
    } catch (e) {}
  }

  const saveHistory = (newHistory) => {
    setHistory(newHistory)
    try { localStorage.setItem('aeo-history-v8', JSON.stringify(newHistory.slice(0, 50))) } catch (e) {}
  }

  const saveCache = (newCache) => {
    setCache(newCache)
    try {
      const keys = Object.keys(newCache)
      const trimmed = keys.slice(-20).reduce((acc, k) => { acc[k] = newCache[k]; return acc }, {})
      localStorage.setItem('aeo-cache-v8', JSON.stringify(trimmed))
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
        {"id": "schema", "name": "Schema.org 구조화 데이터", "points": 4, "maxPoints": 8, "status": "warning", "detail": "설명", "reason": "이유", "solution": "해결방법"}
      ]
    },
    "content": { "score": 18, "items": [...] },
    "technical": { "score": 20, "items": [...] },
    "trust": { "score": 16, "items": [...] }
  },
  "topIssues": ["개선점1", "개선점2", "개선점3"],
  "recommendations": [
    {"title": "권고1", "reason": "이유", "method": "방법", "priority": "high"}
  ]
}`

  // SEO 분석 프롬프트 (seositecheckup.com 스타일로 대폭 강화)
  const createSEOPrompt = (targetUrl) => `웹사이트 "${targetUrl}"를 전문 SEO 분석 도구(seositecheckup.com) 수준으로 상세히 분석해주세요.

**중요**: 각 항목에 대해 반드시 다음 정보를 모두 포함해주세요:
- 실제 발견된 값 (value)
- 상태 (pass/warning/fail)
- 점수
- 왜 중요한지 (impact)
- 해결 방법 (solution)

## 검사 카테고리별 상세 항목 (총 100점)

### 1. Common SEO Issues (20점)
- title_tag (5점): Title 태그 존재 여부 및 길이 (50-60자 권장)
- meta_description (5점): Meta Description 존재 및 길이 (150-160자 권장)
- heading_tags (4점): H1 태그 1개 존재, H2-H6 적절한 구조
- robots_txt (3점): robots.txt 파일 존재 및 설정
- sitemap_xml (3점): sitemap.xml 존재 및 등록

### 2. Meta Tags (15점)
- meta_title (4점): 제목 태그 최적화 상태
- meta_description_quality (3점): 설명의 클릭 유도 품질
- meta_keywords (2점): 키워드 태그 (참고용)
- meta_viewport (3점): viewport 메타 태그 설정
- meta_charset (2점): UTF-8 인코딩 설정
- meta_language (1점): lang 속성 설정

### 3. Social Media (15점)
- og_title (3점): Open Graph 제목
- og_description (3점): Open Graph 설명
- og_image (3점): Open Graph 이미지 (1200x630 권장)
- og_url (2점): Canonical URL
- twitter_card (2점): Twitter Card 타입
- twitter_image (2점): Twitter 이미지

### 4. Speed & Performance (15점)
- page_load_time (5점): 페이지 로딩 시간 (3초 이내 권장)
- server_response (3점): 서버 응답 시간 (TTFB 200ms 이내)
- render_blocking (3점): 렌더링 차단 리소스
- image_optimization (2점): 이미지 최적화 (WebP, lazy loading)
- minification (2점): CSS/JS 압축

### 5. Security (15점)
- https_enabled (6점): HTTPS 적용 여부
- ssl_certificate (4점): SSL 인증서 유효성
- mixed_content (3점): HTTP/HTTPS 혼합 콘텐츠
- security_headers (2점): 보안 헤더 (CSP, X-Frame-Options)

### 6. Mobile Optimization (10점)
- mobile_responsive (4점): 반응형 디자인
- touch_elements (2점): 터치 요소 크기 (48px 이상)
- font_legibility (2점): 모바일 폰트 가독성 (16px 이상)
- viewport_config (2점): 모바일 viewport 설정

### 7. Advanced SEO (10점)
- canonical_url (3점): Canonical URL 설정
- schema_markup (3점): Schema.org 구조화 데이터
- hreflang (2점): 다국어 지원 태그
- amp_support (2점): AMP 페이지 지원

## JSON 응답 형식 (반드시 이 형식을 따라주세요):

{
  "siteName": "사이트 이름",
  "siteDescription": "한줄 설명",
  "url": "${targetUrl}",
  "analyzedAt": "분석 시간",
  "overallScore": 45,
  "grade": "D",
  "summary": {
    "passed": 8,
    "warnings": 5,
    "failed": 12,
    "totalChecks": 25
  },
  "categories": {
    "common": {
      "score": 12,
      "maxScore": 20,
      "passed": 2,
      "failed": 3,
      "items": [
        {
          "id": "title_tag",
          "name": "Title 태그",
          "points": 3,
          "maxPoints": 5,
          "status": "warning",
          "value": "연세스타피부과 - 피부과전문의, 홍터치료...",
          "detail": "Title 태그가 존재하지만 72자로 권장 길이(50-60자)를 초과합니다.",
          "impact": "검색 결과에서 제목이 잘리며, CTR(클릭률)이 15-20% 감소할 수 있습니다.",
          "solution": "핵심 키워드를 앞에 배치하고 50-60자 이내로 줄이세요. 예: '연세스타피부과 | 피부과전문의 홍터치료'",
          "learnMore": "Title 태그는 검색 순위에 가장 큰 영향을 미치는 요소 중 하나입니다."
        },
        {
          "id": "meta_description",
          "name": "Meta Description",
          "points": 0,
          "maxPoints": 5,
          "status": "fail",
          "value": null,
          "detail": "Meta Description 태그가 발견되지 않았습니다.",
          "impact": "검색엔진이 페이지 내용을 임의로 추출하여 표시하며, CTR이 최대 30% 감소합니다.",
          "solution": "<meta name=\"description\" content=\"연세스타피부과는 피부과 전문의가 직접 진료하는 병원입니다. 여드름, 화상흉터, 튼살 치료 전문.\"> 형태로 150-160자 이내의 설명을 추가하세요.",
          "learnMore": "Meta Description은 검색 결과의 스니펫으로 표시되어 클릭을 유도합니다."
        }
      ]
    },
    "meta": { "score": 8, "maxScore": 15, "passed": 2, "failed": 2, "items": [...] },
    "social": { "score": 0, "maxScore": 15, "passed": 0, "failed": 6, "items": [...] },
    "speed": { "score": 8, "maxScore": 15, "passed": 2, "failed": 2, "items": [...] },
    "security": { "score": 10, "maxScore": 15, "passed": 2, "failed": 1, "items": [...] },
    "mobile": { "score": 5, "maxScore": 10, "passed": 1, "failed": 2, "items": [...] },
    "advanced": { "score": 2, "maxScore": 10, "passed": 1, "failed": 3, "items": [...] }
  },
  "criticalIssues": [
    {
      "category": "meta",
      "issue": "Meta Description 누락",
      "impact": "검색 결과 CTR 30% 감소 예상",
      "priority": "high"
    }
  ],
  "quickWins": [
    {
      "action": "Meta Description 추가",
      "effort": "5분",
      "impact": "CTR 20-30% 개선",
      "howTo": "index.html의 <head> 섹션에 <meta name=\"description\" content=\"...\"> 추가"
    }
  ],
  "competitorComparison": {
    "averageScore": 65,
    "yourPosition": "하위 30%",
    "topCompetitorScore": 85
  }
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

    const type = analysisType === 'combined' ? 'aeo' : analysisType
    const cached = getCached(url, type)
    if (cached) {
      if (type === 'seo') setSeoResult({ ...cached, fromCache: true })
      else setResult({ ...cached, fromCache: true })
      setError('')
      if (analysisType === 'combined') {
        const seoCached = getCached(url, 'seo')
        if (seoCached) setSeoResult({ ...seoCached, fromCache: true })
      }
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setSeoResult(null)

    try {
      if (analysisType === 'combined') {
        setLoadingProgress({ current: 1, total: 2, message: 'AEO/GEO 분석 중...' })
        const aeoR = await callAPI(url, 'aeo')
        setResult(aeoR)
        setCached(url, aeoR, 'aeo')

        setLoadingProgress({ current: 2, total: 2, message: 'SEO 분석 중...' })
        const seoR = await callAPI(url, 'seo')
        setSeoResult(seoR)
        setCached(url, seoR, 'seo')
        saveHistory([aeoR, seoR, ...history].slice(0, 50))
      } else {
        setLoadingProgress({ current: 1, total: 1, message: `${type.toUpperCase()} 분석 중...` })
        const r = await callAPI(url, type)
        if (type === 'seo') setSeoResult(r)
        else setResult(r)
        setCached(url, r, type)
        saveHistory([r, ...history].slice(0, 50))
      }
    } catch (err) {
      setError(`오류: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = (s) => {
    if (s === 'pass') return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
    if (s === 'fail') return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">✗</span>
    return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold">!</span>
  }

  const catLabels = {
    structure: { icon: '🏗️', name: '구조', full: '구조적 요소' },
    content: { icon: '📝', name: '콘텐츠', full: '콘텐츠 요소' },
    technical: { icon: '⚙️', name: '기술', full: '기술적 요소' },
    trust: { icon: '🛡️', name: '신뢰도', full: '신뢰도 요소' }
  }

  const clearCache = () => {
    if (confirm('캐시를 삭제할까요?')) {
      setCache({})
      localStorage.removeItem('aeo-cache-v8')
    }
  }

  // SEO 결과 항목 렌더링 (상세 버전)
  const renderSeoItem = (item) => {
    const statusColors = {
      pass: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
      warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
      fail: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' }
    }
    const colors = statusColors[item.status] || statusColors.fail

    return (
      <div key={item.id} className={`rounded-lg border ${colors.border} ${colors.bg} p-4 mb-3`}>
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {statusIcon(item.status)}
            <div>
              <h4 className="font-semibold text-gray-900">{item.name}</h4>
              <p className="text-xs text-gray-500">{item.id}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-lg font-bold ${colors.text}`}>{item.points}/{item.maxPoints}</span>
            <span className="text-xs text-gray-500 block">점</span>
          </div>
        </div>

        {/* 발견된 값 */}
        {item.value !== null && item.value !== undefined && (
          <div className="mb-3 p-2 bg-white rounded border border-gray-200">
            <span className="text-xs text-gray-500 block mb-1">발견된 값:</span>
            <code className="text-sm text-blue-600 break-all">{String(item.value).substring(0, 200)}{String(item.value).length > 200 ? '...' : ''}</code>
          </div>
        )}

        {/* 값이 없을 때 (0점 항목) */}
        {(item.value === null || item.value === undefined) && item.status === 'fail' && (
          <div className="mb-3 p-3 bg-red-100 rounded border border-red-300">
            <span className="text-red-700 font-medium text-sm">⚠️ 해당 요소가 발견되지 않았습니다</span>
            <p className="text-red-600 text-xs mt-1">이 항목은 SEO에 중요한 요소입니다. 아래 해결 방법을 참고하여 추가해주세요.</p>
          </div>
        )}

        {/* 상세 설명 */}
        <p className="text-sm text-gray-700 mb-3">{item.detail}</p>

        {/* 영향도 */}
        {item.impact && (
          <div className="mb-3 p-2 bg-amber-50 rounded border-l-4 border-amber-400">
            <span className="text-xs font-semibold text-amber-800 block">📊 영향도</span>
            <p className="text-sm text-amber-700">{item.impact}</p>
          </div>
        )}

        {/* 해결 방법 */}
        {item.solution && (
          <div className="mb-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
            <span className="text-xs font-semibold text-green-800 block">💡 해결 방법</span>
            <p className="text-sm text-green-700">{item.solution}</p>
          </div>
        )}

        {/* 추가 정보 */}
        {item.learnMore && (
          <p className="text-xs text-gray-500 mt-2 italic">ℹ️ {item.learnMore}</p>
        )}
      </div>
    )
  }

  return (
    <div className="container py-6 max-w-6xl">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">웹사이트 최적화 분석</h1>
        <p className="text-gray-500">AEO/GEO (AI 검색 최적화) + SEO (검색엔진 최적화) 전문 분석</p>
      </div>

      {/* SEO 중요성 안내 배너 */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">왜 SEO 최적화가 중요한가요?</h2>
            <p className="text-blue-100 text-sm">검색엔진 최적화는 지속 가능한 성장의 핵심입니다</p>
          </div>
          <button
            onClick={() => setShowSeoInfo(!showSeoInfo)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            {showSeoInfo ? '닫기' : '자세히 보기'}
          </button>
        </div>

        {showSeoInfo && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(seoImpactInfo).map(([key, info]) => (
              <div key={key} className="bg-white/10 rounded-lg p-4">
                <span className="text-2xl">{info.icon}</span>
                <h3 className="font-semibold mt-2">{info.title}</h3>
                <p className="text-xs text-blue-100 mt-1">{info.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 분석 타입 선택 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
        {[
          { key: 'aeo', label: '🤖 AEO/GEO', desc: 'AI 검색 최적화' },
          { key: 'seo', label: '🔍 SEO', desc: '검색엔진 최적화' },
          { key: 'combined', label: '📊 통합', desc: 'AEO + SEO' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setAnalysisType(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              analysisType === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* URL 입력 */}
      <div className="rounded-xl border bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{analysisType === 'seo' ? '🔍' : analysisType === 'combined' ? '📊' : '🤖'}</span>
          <h3 className="font-semibold text-lg">
            {analysisType === 'seo' ? 'SEO 분석' : analysisType === 'combined' ? '통합 분석' : 'AEO/GEO 분석'}
          </h3>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            className="input flex-1"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && runAnalysis()}
            placeholder="분석할 웹사이트 URL (예: www.example.com)"
          />
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="btn btn-primary px-8"
          >
            {loading ? '분석 중...' : '분석 시작'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="font-semibold text-lg">{loadingProgress.message}</h3>
          <p className="text-gray-500 text-sm mt-2">웹사이트를 분석하고 있습니다. 잠시만 기다려주세요...</p>
          {loadingProgress.total > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: loadingProgress.total }, (_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < loadingProgress.current ? 'bg-blue-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* AEO 결과 */}
      {result && !loading && (analysisType === 'aeo' || analysisType === 'combined') && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🤖</span> AEO/GEO 분석 결과
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* 점수 카드 */}
            <div className="lg:col-span-1 rounded-xl border p-6 text-center" style={{ background: getGradeBg(result.overallScore) }}>
              <p className="text-sm font-medium mb-2" style={{ color: getGradeColor(result.overallScore) }}>AI 친화도 점수</p>
              <div className="text-6xl font-bold mb-2" style={{ color: getGradeColor(result.overallScore) }}>{result.overallScore}</div>
              <div className="text-2xl font-bold" style={{ color: getGradeColor(result.overallScore) }}>{getGrade(result.overallScore)}</div>
              <p className="text-sm text-gray-500 mt-1">{gradeInfo[getGrade(result.overallScore)]?.desc}</p>
            </div>

            {/* 사이트 정보 */}
            <div className="lg:col-span-2 rounded-xl border bg-white p-6">
              <p className="text-sm font-medium text-blue-600 mb-2">분석 대상</p>
              <h2 className="text-xl font-bold mb-2">{result.siteName}</h2>
              <p className="text-gray-600 mb-4">{result.siteDescription}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(catLabels).map(([key, label]) => {
                  const score = result.categories?.[key]?.score || 0
                  return (
                    <span key={key} className="px-3 py-1 rounded-full text-sm" style={{ background: getGradeBg(score * 4), color: getGradeColor(score * 4) }}>
                      {label.icon} {label.name}: {score}/25
                    </span>
                  )
                })}
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
                  className={`rounded-lg border p-4 text-center transition-all ${
                    activeTab === key ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'
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
          <div className="rounded-xl border bg-white p-6">
            <h3 className="font-semibold mb-4">{catLabels[activeTab]?.icon} {catLabels[activeTab]?.full}</h3>
            <div className="space-y-3">
              {result.categories?.[activeTab]?.items?.map((item, idx) => (
                <div key={idx} className={`rounded-lg p-4 ${item.status === 'pass' ? 'bg-green-50 border border-green-200' : item.status === 'fail' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(item.status)}
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold" style={{ color: getGradeColor((item.points / (item.maxPoints || 8)) * 100) }}>
                      {item.points}/{item.maxPoints || 8}점
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{item.detail}</p>
                  {item.solution && <p className="text-green-600 text-sm mt-2">💡 {item.solution}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEO 결과 (대폭 강화) */}
      {seoResult && !loading && (analysisType === 'seo' || analysisType === 'combined') && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🔍</span> SEO 분석 결과
            <span className="text-sm font-normal text-gray-500 ml-2">seositecheckup.com 스타일</span>
          </h2>

          {/* 요약 카드 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* 점수 */}
            <div className="rounded-xl border p-6 text-center" style={{ background: getGradeBg(seoResult.overallScore) }}>
              <p className="text-sm font-medium mb-2" style={{ color: getGradeColor(seoResult.overallScore) }}>SEO 점수</p>
              <div className="text-5xl font-bold mb-1" style={{ color: getGradeColor(seoResult.overallScore) }}>{seoResult.overallScore}</div>
              <div className="text-xl font-bold" style={{ color: getGradeColor(seoResult.overallScore) }}>{getGrade(seoResult.overallScore)}</div>
              <p className="text-xs text-gray-500 mt-1">{gradeInfo[getGrade(seoResult.overallScore)]?.desc}</p>
            </div>

            {/* 통과/경고/실패 요약 */}
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold mb-3 text-sm text-gray-600">검사 결과 요약</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-green-600"><span className="w-3 h-3 rounded-full bg-green-500"></span> 통과</span>
                  <span className="font-bold">{seoResult.summary?.passed || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-amber-600"><span className="w-3 h-3 rounded-full bg-amber-500"></span> 경고</span>
                  <span className="font-bold">{seoResult.summary?.warnings || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-red-600"><span className="w-3 h-3 rounded-full bg-red-500"></span> 실패</span>
                  <span className="font-bold">{seoResult.summary?.failed || 0}</span>
                </div>
              </div>
            </div>

            {/* 빠른 개선 */}
            {seoResult.quickWins && seoResult.quickWins.length > 0 && (
              <div className="lg:col-span-2 rounded-xl border bg-gradient-to-r from-green-50 to-emerald-50 p-6">
                <h3 className="font-semibold mb-3 text-green-800 flex items-center gap-2">
                  <span>⚡</span> Quick Wins (빠른 개선)
                </h3>
                <div className="space-y-2">
                  {seoResult.quickWins.slice(0, 3).map((win, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 font-bold">{idx + 1}.</span>
                      <div>
                        <span className="font-medium">{win.action}</span>
                        <span className="text-gray-500 ml-2">({win.effort} 소요, {win.impact})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 카테고리 탭 (seositecheckup 스타일) */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {Object.entries(seoCategories).map(([key, cat]) => {
              const catData = seoResult.categories?.[key]
              const score = catData?.score || 0
              const maxScore = catData?.maxScore || 15
              const percent = Math.round((score / maxScore) * 100)
              const isActive = activeSeoTab === key

              return (
                <button
                  key={key}
                  onClick={() => setActiveSeoTab(key)}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    isActive ? 'border-2 shadow-md' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  style={isActive ? { borderColor: cat.color, background: `${cat.color}10` } : {}}
                >
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="text-sm font-bold" style={{ color: getGradeColor(percent) }}>{score}/{maxScore}</div>
                  <div className="text-xs text-gray-500 truncate">{cat.name}</div>
                </button>
              )
            })}
          </div>

          {/* SEO 상세 결과 */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span style={{ color: seoCategories[activeSeoTab]?.color }}>{seoCategories[activeSeoTab]?.icon}</span>
                {seoCategories[activeSeoTab]?.full}
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600">✓ {seoResult.categories?.[activeSeoTab]?.passed || 0} 통과</span>
                <span className="text-red-600">✗ {seoResult.categories?.[activeSeoTab]?.failed || 0} 실패</span>
              </div>
            </div>

            {/* 항목 목록 */}
            <div className="space-y-4">
              {seoResult.categories?.[activeSeoTab]?.items?.map(item => renderSeoItem(item))}

              {/* 항목이 없을 때 */}
              {(!seoResult.categories?.[activeSeoTab]?.items || seoResult.categories[activeSeoTab].items.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>이 카테고리의 검사 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 심각한 문제점 */}
          {seoResult.criticalIssues && seoResult.criticalIssues.length > 0 && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
              <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                <span>🚨</span> 심각한 문제점 (우선 해결 필요)
              </h3>
              <div className="space-y-3">
                {seoResult.criticalIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white rounded-lg p-4 border border-red-100">
                    <span className="text-red-500 font-bold">{idx + 1}</span>
                    <div>
                      <p className="font-medium text-red-700">{issue.issue || issue}</p>
                      {issue.impact && <p className="text-sm text-red-600 mt-1">영향: {issue.impact}</p>}
                    </div>
                    {issue.priority === 'high' && (
                      <span className="ml-auto px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">긴급</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 안내 (결과 없을 때) */}
      {!result && !seoResult && !loading && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-4">검사 항목 미리보기</h3>

          {(analysisType === 'seo' || analysisType === 'combined') && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(seoCategories).slice(0, 4).map(([key, cat]) => (
                <div key={key} className="rounded-xl border bg-white p-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3" style={{ background: `${cat.color}20` }}>
                    {cat.icon}
                  </div>
                  <h4 className="font-semibold">{cat.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{cat.full}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border bg-gray-50 p-6 text-center">
            <span className="text-4xl block mb-3">🔍</span>
            <h3 className="font-semibold text-lg mb-2">URL을 입력하고 분석을 시작하세요</h3>
            <p className="text-gray-500 text-sm">SEO 점수, 문제점, 개선방법을 상세히 분석해드립니다</p>
          </div>
        </div>
      )}

      {/* 하단 */}
      <div className="mt-8 pt-6 border-t flex justify-between items-center text-sm text-gray-500">
        <span>분석 기록: {history.length}건</span>
        <button onClick={clearCache} className="hover:text-gray-700">캐시 삭제</button>
      </div>
    </div>
  )
}

export default AEOChecker
