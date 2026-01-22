# ARCHITECTURE.md - 시스템 아키텍처

## 개요

MADMEDCHECK의 시스템 아키텍처, 데이터 흐름, 주요 컴포넌트 설계를 문서화합니다.

---

## 1. 시스템 개요

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MADMEDCHECK                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│  │   Client    │     │   Backend   │     │   External APIs     │   │
│  │  (Browser)  │────▶│  (Express)  │────▶│  - Claude AI        │   │
│  │   React     │◀────│   Node.js   │◀────│  - Naver Search     │   │
│  │   Vite      │     │             │     │  - Toss Payments    │   │
│  └─────────────┘     └──────┬──────┘     └─────────────────────┘   │
│                             │                                       │
│                      ┌──────▼──────┐                               │
│                      │  PostgreSQL │                               │
│                      │  Database   │                               │
│                      └─────────────┘                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

배포: Railway (Backend + DB) / Vercel or Railway (Frontend)
```

### 1.2 기술 스택 상세

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Frontend** | React | 18.x | UI 라이브러리 |
| | Vite | 5.x | 빌드 도구 |
| | Tailwind CSS | 3.x | 스타일링 |
| | React Router | 6.x | 라우팅 |
| | Axios | 1.x | HTTP 클라이언트 |
| **Backend** | Node.js | 20.x | 런타임 |
| | Express.js | 4.x | 웹 프레임워크 |
| | Puppeteer | 21.x | 웹 크롤링 |
| | PDFKit | 0.14.x | PDF 생성 |
| **Database** | PostgreSQL | 16.x | 메인 데이터베이스 |
| **External** | Claude API | - | AI 분석 |
| | Naver Search API | - | 검색 데이터 |
| | Toss Payments | - | 결제 처리 |
| | Resend | - | 이메일 발송 |

---

## 2. 백엔드 아키텍처

### 2.1 디렉토리 구조 및 역할

```
backend/
├── server.js              # 애플리케이션 진입점
├── config/
│   ├── database.js        # DB 연결 관리 (Pool, Mock DB)
│   └── schema.sql         # 데이터베이스 스키마
├── routes/                # API 라우트 (Controller 역할)
│   ├── auth.js            # 인증 (/api/auth/*)
│   ├── reports.js         # 검사/리포트 (/api/reports/*)
│   ├── aeo.js             # AEO 분석 (/api/aeo/*)
│   ├── viral.js           # 바이럴 모니터링 (/api/viral/*)
│   ├── payments.js        # 결제 (/api/payments/*)
│   └── dealers.js         # 딜러 (/api/dealers/*)
├── services/              # 비즈니스 로직 (Service 역할)
│   ├── crawler.js         # 웹 크롤링 (Puppeteer)
│   ├── analyzer.js        # 위반 분석 엔진
│   ├── aeo-analyzer.js    # AEO/GEO 분석
│   ├── seo-analyzer.js    # SEO 분석
│   ├── viral-monitor.js   # 바이럴 모니터링
│   ├── pdf-generator.js   # PDF 생성
│   └── email-sender.js    # 이메일 발송
├── middlewares/           # Express 미들웨어
│   └── auth.js            # JWT 인증 미들웨어
└── utils/                 # 유틸리티 함수
    └── helpers.js
```

### 2.2 레이어드 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    Routes (Controller)              │
│   - HTTP 요청/응답 처리                              │
│   - 입력 검증                                        │
│   - 인증/인가 체크                                    │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                    Services (Business Logic)        │
│   - 핵심 비즈니스 로직                               │
│   - 외부 API 연동                                    │
│   - 데이터 가공                                      │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                    Database (Persistence)           │
│   - 데이터 CRUD                                     │
│   - 트랜잭션 관리                                    │
└─────────────────────────────────────────────────────┘
```

### 2.3 미들웨어 체인

```javascript
// 요청 처리 순서
app.use(cors())                    // 1. CORS 처리
app.use(express.json())            // 2. JSON 파싱
app.use(requestLogger)             // 3. 요청 로깅
app.use('/api/auth', authRoutes)   // 4. 인증 라우트 (토큰 불필요)
app.use(authMiddleware)            // 5. JWT 검증 (이후 라우트에 적용)
app.use('/api/*', protectedRoutes) // 6. 보호된 라우트
app.use(errorHandler)              // 7. 에러 핸들링
```

---

## 3. 프론트엔드 아키텍처

### 3.1 디렉토리 구조

```
frontend/src/
├── App.jsx                # 애플리케이션 루트
├── main.jsx               # 진입점
├── pages/                 # 페이지 컴포넌트 (라우트 단위)
│   ├── Home.jsx           # 랜딩 페이지
│   ├── Dashboard.jsx      # 대시보드
│   ├── AEOChecker.jsx     # AEO 분석
│   ├── Scan.jsx           # 의료광고 검사
│   ├── ViralMonitoring.jsx# 바이럴 모니터링
│   ├── Pricing.jsx        # 요금제
│   ├── Login.jsx          # 로그인
│   ├── Register.jsx       # 회원가입
│   ├── ReportDetail.jsx   # 분석 결과 상세
│   ├── OAuthCallback.jsx  # OAuth 콜백
│   └── DealerDashboard.jsx# 딜러 대시보드
├── components/            # 재사용 컴포넌트
│   ├── ui/                # 기본 UI 컴포넌트
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   └── Input.jsx
│   ├── Header.jsx         # 네비게이션 헤더
│   ├── Footer.jsx         # 푸터
│   └── features/          # 기능별 컴포넌트
│       ├── AnalysisCard.jsx
│       └── ViolationList.jsx
├── hooks/                 # 커스텀 훅
│   ├── useAuth.js         # 인증 상태 관리
│   └── useApi.js          # API 호출 훅
├── services/              # API 호출 모듈
│   └── api.js             # Axios 인스턴스 + API 함수
├── context/               # React Context
│   └── AuthContext.jsx    # 인증 컨텍스트
├── utils/                 # 유틸리티
│   └── helpers.js
└── styles/                # 스타일
    └── global.css         # 전역 스타일
```

### 3.2 상태 관리

```
┌─────────────────────────────────────────────────────┐
│                   State Management                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐     ┌─────────────┐               │
│  │ AuthContext │     │ Local State │               │
│  │ (전역 인증)  │     │ (컴포넌트)   │               │
│  └─────────────┘     └─────────────┘               │
│         │                   │                       │
│         └───────┬───────────┘                       │
│                 │                                   │
│         ┌───────▼───────┐                          │
│         │   useState    │                          │
│         │   useEffect   │                          │
│         │   useCallback │                          │
│         └───────────────┘                          │
│                                                     │
│  * 복잡한 전역 상태 필요 시 Zustand 도입 고려       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.3 라우팅 구조

```javascript
// App.jsx 라우트 구조
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
  <Route path="/pricing" element={<Pricing />} />

  {/* Protected Routes */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/aeo" element={<AEOChecker />} />
    <Route path="/scan" element={<Scan />} />
    <Route path="/viral" element={<ViralMonitoring />} />
    <Route path="/report/:id" element={<ReportDetail />} />
    <Route path="/dealer" element={<DealerDashboard />} />
  </Route>
</Routes>
```

---

## 4. 데이터베이스 설계

### 4.1 ERD (Entity Relationship Diagram)

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   users     │       │  subscriptions  │       │   scan_reports  │
├─────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)     │──┐    │ id (PK)         │       │ id (PK)         │
│ email       │  │    │ user_id (FK)    │──┐    │ user_id (FK)    │──┐
│ password    │  └───▶│ plan_type       │  │    │ url             │  │
│ name        │       │ status          │  │    │ score           │  │
│ role        │       │ start_date      │  │    │ violations      │  │
│ oauth_*     │       │ end_date        │  │    │ created_at      │  │
│ referred_by │       └─────────────────┘  │    └─────────────────┘  │
│ created_at  │                            │                         │
└─────────────┘                            │    ┌─────────────────┐  │
       │                                   │    │  aeo_reports    │  │
       │                                   │    ├─────────────────┤  │
       │       ┌─────────────────┐         │    │ id (PK)         │  │
       │       │    payments     │         │    │ user_id (FK)    │──┤
       │       ├─────────────────┤         │    │ url             │  │
       └──────▶│ id (PK)         │         │    │ aeo_score       │  │
               │ user_id (FK)    │─────────┘    │ seo_score       │  │
               │ amount          │              │ details         │  │
               │ status          │              │ created_at      │  │
               │ payment_key     │              └─────────────────┘  │
               │ created_at      │                                   │
               └─────────────────┘              ┌─────────────────┐  │
                                               │ viral_results   │  │
                                               ├─────────────────┤  │
                                               │ id (PK)         │  │
                                               │ user_id (FK)    │──┘
                                               │ keyword         │
                                               │ platform        │
                                               │ results         │
                                               │ created_at      │
                                               └─────────────────┘
```

### 4.2 주요 테이블 스키마

```sql
-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),  -- OAuth 사용자는 NULL 가능
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',  -- user, dealer, admin
    oauth_provider VARCHAR(20),  -- google, naver, kakao
    oauth_id VARCHAR(255),
    referred_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 구독 테이블
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL,  -- free, basic, pro, enterprise
    status VARCHAR(20) DEFAULT 'active',  -- active, cancelled, expired
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    payment_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 검사 리포트 테이블
CREATE TABLE scan_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    score INTEGER,
    violations JSONB,  -- 위반 항목 배열
    raw_html TEXT,
    analysis_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AEO 리포트 테이블
CREATE TABLE aeo_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    aeo_score INTEGER,
    seo_score INTEGER,
    total_score INTEGER,
    details JSONB,  -- 상세 분석 결과
    recommendations JSONB,  -- 개선 권장사항
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 결제 테이블
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id),
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, failed
    payment_key VARCHAR(255),
    order_id VARCHAR(255),
    method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_scan_reports_user_id ON scan_reports(user_id);
CREATE INDEX idx_scan_reports_created_at ON scan_reports(created_at);
CREATE INDEX idx_aeo_reports_user_id ON aeo_reports(user_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
```

### 4.3 JSONB 데이터 구조

```javascript
// scan_reports.violations 구조
{
  "violations": [
    {
      "code": "MED001",
      "title": "환자 후기/치료 경험담",
      "severity": "violation",  // violation, warning
      "description": "의료법 제56조에 따라 환자 후기 게시 금지",
      "evidence": ["치료 후 만족스러운 경험", "환자분 말씀..."],
      "location": "https://example.com/reviews"
    }
  ],
  "summary": {
    "totalViolations": 3,
    "totalWarnings": 2,
    "score": 65
  }
}

// aeo_reports.details 구조
{
  "aeo": {
    "score": 78,
    "categories": {
      "structure": { "score": 85, "items": [...] },
      "content": { "score": 72, "items": [...] },
      "metadata": { "score": 80, "items": [...] }
    }
  },
  "seo": {
    "score": 82,
    "categories": {
      "technical": { "score": 88, "items": [...] },
      "content": { "score": 75, "items": [...] },
      "performance": { "score": 85, "items": [...] }
    }
  }
}
```

---

## 5. 핵심 데이터 흐름

### 5.1 웹사이트 검사 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │ Crawler  │    │ Analyzer │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /scan    │               │               │
     │ {url}         │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ crawl(url)    │               │
     │               │──────────────▶│               │
     │               │               │               │
     │               │               │ Puppeteer     │
     │               │               │ fetch HTML    │
     │               │               │               │
     │               │ htmlContent   │               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ analyze(html) │               │
     │               │───────────────────────────────▶
     │               │               │               │
     │               │               │  Pattern      │
     │               │               │  Matching     │
     │               │               │  + AI (옵션)  │
     │               │               │               │
     │               │ violations   │               │
     │               │◀──────────────────────────────│
     │               │               │               │
     │               │ Save to DB    │               │
     │               │               │               │
     │  Response     │               │               │
     │  {score,      │               │               │
     │   violations} │               │               │
     │◀──────────────│               │               │
     │               │               │               │
```

### 5.2 AEO 분석 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │ AEO Svc  │    │ SEO Svc  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /aeo/    │               │               │
     │ analyze       │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ Parallel Analysis             │
     │               │───────────────┬───────────────▶
     │               │               │               │
     │               │ analyzeAEO()  │               │
     │               │──────────────▶│               │
     │               │               │               │
     │               │               │  - Structure  │
     │               │               │  - Schema.org │
     │               │               │  - Content    │
     │               │               │  - Meta       │
     │               │               │               │
     │               │ aeoResult     │               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ analyzeSEO()  │               │
     │               │───────────────────────────────▶
     │               │               │               │
     │               │               │  - Technical  │
     │               │               │  - On-page    │
     │               │               │  - Performance│
     │               │               │               │
     │               │ seoResult     │               │
     │               │◀──────────────────────────────│
     │               │               │               │
     │               │ Merge Results │               │
     │               │ Calculate     │               │
     │               │ Total Score   │               │
     │               │               │               │
     │  Response     │               │               │
     │◀──────────────│               │               │
```

### 5.3 바이럴 모니터링 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │ViralSvc  │    │Naver API │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /viral/  │               │               │
     │ scan          │               │               │
     │ {keyword,     │               │               │
     │  platforms}   │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ searchViral() │               │
     │               │──────────────▶│               │
     │               │               │               │
     │               │               │ Blog Search   │
     │               │               │──────────────▶│
     │               │               │◀──────────────│
     │               │               │               │
     │               │               │ Cafe Search   │
     │               │               │──────────────▶│
     │               │               │◀──────────────│
     │               │               │               │
     │               │               │ Kin Search    │
     │               │               │──────────────▶│
     │               │               │◀──────────────│
     │               │               │               │
     │               │               │ Analyze       │
     │               │               │ Violations    │
     │               │               │               │
     │               │ results       │               │
     │               │◀──────────────│               │
     │               │               │               │
     │  Response     │               │               │
     │  {results,    │               │               │
     │   violations} │               │               │
     │◀──────────────│               │               │
```

### 5.4 결제 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │   Toss   │    │    DB    │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ POST /payments│               │               │
     │ /request      │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ Create Order  │               │
     │               │───────────────────────────────▶
     │               │               │               │
     │  {orderId,    │               │               │
     │   clientKey}  │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │ Toss SDK      │               │               │
     │ Payment UI    │               │               │
     │──────────────────────────────▶│               │
     │               │               │               │
     │ Callback      │               │               │
     │ {paymentKey}  │               │               │
     │◀──────────────────────────────│               │
     │               │               │               │
     │ POST /payments│               │               │
     │ /confirm      │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ Confirm       │               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ Update        │               │
     │               │ Subscription  │               │
     │               │───────────────────────────────▶
     │               │               │               │
     │  {success}    │               │               │
     │◀──────────────│               │               │
```

---

## 6. 인증 아키텍처

### 6.1 JWT 기반 인증

```
┌────────────────────────────────────────────────────────────────┐
│                     JWT Authentication Flow                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Login Request                  JWT Token                     │
│   ┌──────────┐    ┌──────────┐   ┌──────────────────────────┐ │
│   │ email    │───▶│ Verify   │──▶│ Header.Payload.Signature │ │
│   │ password │    │ Password │   └──────────────────────────┘ │
│   └──────────┘    └──────────┘                                │
│                                                                │
│   Protected Request              Middleware                    │
│   ┌──────────────┐    ┌──────────┐    ┌──────────┐           │
│   │ Authorization│───▶│ Verify   │───▶│ req.user │           │
│   │ Bearer xxx   │    │ JWT      │    │ {id,role}│           │
│   └──────────────┘    └──────────┘    └──────────┘           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 OAuth 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Backend │    │ OAuth    │    │    DB    │
│          │    │          │    │ Provider │    │          │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ Click Login   │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │ Redirect to   │               │               │
     │ OAuth URL     │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │ Authenticate  │               │               │
     │──────────────────────────────▶│               │
     │               │               │               │
     │ Callback with │               │               │
     │ auth code     │               │               │
     │◀──────────────────────────────│               │
     │               │               │               │
     │ POST callback │               │               │
     │ {code}        │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ Exchange for  │               │
     │               │ access token  │               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ Get user info │               │
     │               │──────────────▶│               │
     │               │◀──────────────│               │
     │               │               │               │
     │               │ Find or Create│               │
     │               │ User          │               │
     │               │───────────────────────────────▶
     │               │◀──────────────────────────────│
     │               │               │               │
     │  JWT Token    │               │               │
     │◀──────────────│               │               │
```

---

## 7. 외부 서비스 연동

### 7.1 Claude AI API

```javascript
// services/ai-analyzer.js
const analyzeWithAI = async (content, prompt) => {
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `${prompt}\n\n분석 대상:\n${content}`
    }]
  });

  return parseAIResponse(response.content[0].text);
};
```

### 7.2 네이버 검색 API

```javascript
// services/naver-search.js
const searchNaver = async (query, type = 'blog') => {
  const response = await axios.get(
    `https://openapi.naver.com/v1/search/${type}.json`,
    {
      params: { query, display: 100 },
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
      }
    }
  );

  return response.data.items;
};
```

### 7.3 토스페이먼츠 API

```javascript
// services/toss-payments.js
const confirmPayment = async (paymentKey, orderId, amount) => {
  const response = await axios.post(
    'https://api.tosspayments.com/v1/payments/confirm',
    { paymentKey, orderId, amount },
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          process.env.TOSS_SECRET_KEY + ':'
        ).toString('base64')}`
      }
    }
  );

  return response.data;
};
```

---

## 8. 보안 아키텍처

### 8.1 보안 레이어

```
┌─────────────────────────────────────────────────────────────────┐
│                       Security Layers                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Layer 1: Network Security                                 │ │
│  │ - HTTPS 강제 (SSL/TLS)                                    │ │
│  │ - CORS 화이트리스트                                        │ │
│  │ - Rate Limiting                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │ Layer 2: Application Security                             │ │
│  │ - JWT 토큰 검증                                            │ │
│  │ - 입력값 검증/Sanitization                                 │ │
│  │ - SQL Injection 방지 (파라미터 바인딩)                     │ │
│  │ - XSS 방지 (출력 인코딩)                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │ Layer 3: Data Security                                    │ │
│  │ - 비밀번호 해싱 (bcrypt)                                   │ │
│  │ - 민감 정보 암호화                                         │ │
│  │ - 환경변수로 시크릿 관리                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 인증/인가 매트릭스

| 엔드포인트 | 인증 필요 | 역할 제한 |
|-----------|----------|----------|
| `GET /api/health` | ❌ | - |
| `POST /api/auth/*` | ❌ | - |
| `GET /api/reports` | ✅ | user+ |
| `POST /api/reports/scan` | ✅ | user+ |
| `GET /api/dealers/*` | ✅ | dealer+ |
| `GET /api/admin/*` | ✅ | admin |

---

## 9. 배포 아키텍처

### 9.1 Railway 배포 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                          Railway                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Backend       │    │   PostgreSQL    │                    │
│  │   Service       │───▶│   Database      │                    │
│  │   (Node.js)     │    │                 │                    │
│  │                 │    │   - Auto backup │                    │
│  │   - Auto deploy │    │   - HA mode     │                    │
│  │   - Env vars    │    │                 │                    │
│  └────────┬────────┘    └─────────────────┘                    │
│           │                                                     │
│           │ Serves static files                                 │
│           │ (Frontend build)                                    │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │   Internet    │
    │   (Users)     │
    └───────────────┘
```

### 9.2 환경별 설정

| 환경 | 용도 | DATABASE_URL | NODE_ENV |
|------|------|--------------|----------|
| Development | 로컬 개발 | localhost 또는 Mock | development |
| Staging | 테스트 | Railway (별도 DB) | staging |
| Production | 실서비스 | Railway (프로덕션 DB) | production |

---

## 10. 모니터링 및 로깅

### 10.1 로깅 전략 (향후 구현)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Logging Strategy                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Log Levels:                                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  ERROR  │ │  WARN   │ │  INFO   │ │  DEBUG  │ │  TRACE  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                 │
│  Log Categories:                                                │
│  - request: HTTP 요청/응답                                      │
│  - auth: 인증/인가 이벤트                                       │
│  - payment: 결제 트랜잭션                                       │
│  - analysis: 분석 작업                                          │
│  - error: 에러 및 예외                                          │
│                                                                 │
│  Format: JSON (구조화된 로깅)                                   │
│  {                                                              │
│    "timestamp": "2024-01-22T10:30:00Z",                         │
│    "level": "info",                                             │
│    "category": "request",                                       │
│    "message": "POST /api/reports/scan",                         │
│    "userId": 123,                                               │
│    "duration": 1234                                             │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 모니터링 지표 (향후 구현)

| 지표 | 설명 | 알림 기준 |
|------|------|----------|
| Response Time | API 응답 시간 | > 3초 |
| Error Rate | 에러 비율 | > 1% |
| CPU Usage | CPU 사용률 | > 80% |
| Memory Usage | 메모리 사용률 | > 85% |
| DB Connections | DB 연결 수 | > 90% pool |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-22 | 1.0 | 초기 아키텍처 문서 작성 |

---

*마지막 업데이트: 2026-01-22*
