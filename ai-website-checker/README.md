# AI Website Checker v2.0

AI 친화적인 웹사이트 검증 서비스 - 웹사이트가 AI에게 얼마나 친화적인지 분석하는 풀스택 애플리케이션

## 주요 기능

### 🎯 핵심 기능
- ✅ **단일 URL 검증** - 웹사이트를 5가지 카테고리로 분석
- ✅ **일괄 URL 검증** - 최대 10개의 URL을 한 번에 검증
- ✅ **PDF 보고서 생성** - 상세한 분석 결과를 PDF로 생성
- ✅ **이메일 전송** - PDF 보고서를 이메일로 자동 전송
- ✅ **데이터베이스 저장** - 검증 기록을 SQLite에 저장
- ✅ **검증 기록 조회** - 과거 검증 결과 조회 가능

### 📊 분석 카테고리 (5가지)

1. **HTML 구조** (20점)
   - 시맨틱 HTML5 요소 (header, nav, main, footer)

2. **메타데이터 & SEO** (25점)
   - 제목 태그 및 길이
   - 메타 설명
   - Open Graph 태그
   - JSON-LD 구조화된 데이터

3. **콘텐츠 구조** (25점)
   - 제목 계층 (H1, H2 등)
   - 텍스트 콘텐츠 양
   - 리스트 사용
   - 단락 구조

4. **접근성** (20점)
   - 이미지 alt 텍스트
   - ARIA 레이블
   - 언어 속성
   - 링크 설명

5. **성능 & 최적화** (10점)
   - HTML 파일 크기
   - 인라인 스타일
   - 외부 스크립트 수
   - 뷰포트 메타 태그

## 기술 스택

### Backend
- **Node.js** - 런타임 환경
- **Express.js** - 웹 프레임워크
- **Axios** - HTTP 요청
- **Cheerio** - HTML 파싱 및 분석
- **Better-SQLite3** - 데이터베이스
- **PDFKit** - PDF 생성
- **Nodemailer** - 이메일 전송
- **CORS** - Cross-Origin Resource Sharing
- **Dotenv** - 환경 변수 관리

### Frontend
- **React 18** - UI 라이브러리
- **Axios** - API 통신
- **CSS3** - 그라디언트 및 반응형 디자인

## 프로젝트 구조

```
ai-website-checker/
├── backend/
│   ├── server.js           # Express 서버 및 API 라우트
│   ├── database.js         # SQLite 데이터베이스 모듈
│   ├── pdf-generator.js    # PDF 생성 모듈
│   ├── email-sender.js     # 이메일 전송 모듈
│   ├── package.json        # 백엔드 의존성
│   ├── .env.example        # 환경 변수 템플릿
│   └── reports/            # 생성된 PDF 보고서 (자동 생성)
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML 템플릿
│   ├── src/
│   │   ├── App.js          # 메인 React 컴포넌트
│   │   ├── App.css         # 스타일링
│   │   ├── index.js        # React 진입점
│   │   └── index.css       # 글로벌 스타일
│   └── package.json        # 프론트엔드 의존성
├── package.json            # 루트 패키지 (편의 스크립트)
├── .gitignore
└── README.md
```

## 설치 및 실행

### 사전 요구사항
- Node.js (v14 이상)
- npm 또는 yarn

### 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 클론
git clone <repository-url>
cd ai-website-checker

# 모든 의존성 한 번에 설치
npm run install-all

# 또는 개별적으로 설치
cd backend && npm install
cd ../frontend && npm install
```

### 2. 환경 변수 설정 (이메일 기능 사용 시)

```bash
cd backend
cp .env.example .env
```

`.env` 파일을 편집하여 SMTP 설정 입력:

```env
PORT=5000

# Gmail 사용 시 (앱 비밀번호 필요)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**Gmail 앱 비밀번호 생성 방법:**
1. Google 계정 > 보안 > 2단계 인증 활성화
2. 앱 비밀번호 생성 (https://support.google.com/accounts/answer/185833)
3. 생성된 16자리 비밀번호를 `SMTP_PASS`에 입력

### 3. 서버 실행

**터미널 1 - 백엔드 서버:**
```bash
cd backend
npm start
# 또는 개발 모드 (nodemon):
npm run dev
```

서버가 http://localhost:5000 에서 실행됩니다.

**터미널 2 - 프론트엔드 서버:**
```bash
cd frontend
npm start
```

브라우저가 자동으로 http://localhost:3000 을 엽니다.

## 사용 방법

### 1. 단일 URL 검증

1. "Single URL" 탭 선택
2. 웹사이트 URL 입력 (예: https://example.com)
3. (선택사항) "Send PDF report via email" 체크박스 선택 및 이메일 주소 입력
4. "Check Website" 버튼 클릭
5. 결과 확인

### 2. 일괄 URL 검증

1. "Bulk URLs" 탭 선택
2. 텍스트 영역에 URL 입력 (한 줄에 하나씩, 최대 10개)
   ```
   https://example1.com
   https://example2.com
   https://example3.com
   ```
3. "Check All Websites" 버튼 클릭
4. 각 URL의 결과를 카드 형식으로 확인

### 3. PDF 보고서 이메일 전송

1. 단일 URL 검증 시 "Send PDF report via email" 체크
2. 이메일 주소 입력
3. 검증 실행
4. 이메일로 상세한 PDF 보고서 수신

## API 엔드포인트

### POST /api/verify
단일 URL 검증

**요청:**
```json
{
  "url": "https://example.com",
  "saveToDb": true  // 선택사항, 기본값 true
}
```

**응답:**
```json
{
  "url": "https://example.com",
  "timestamp": "2026-01-13T...",
  "score": 85,
  "maxScore": 100,
  "reportId": 1,
  "checks": {
    "structure": { ... },
    "metadata": { ... },
    "content": { ... },
    "accessibility": { ... },
    "performance": { ... }
  }
}
```

### POST /api/verify-bulk
일괄 URL 검증 (최대 10개)

**요청:**
```json
{
  "urls": [
    "https://example1.com",
    "https://example2.com"
  ]
}
```

**응답:**
```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    { "success": true, "url": "...", "score": 85, ... },
    { "success": true, "url": "...", "score": 72, ... }
  ]
}
```

### POST /api/send-report
PDF 보고서 생성 및 이메일 전송

**요청:**
```json
{
  "url": "https://example.com",
  "email": "user@example.com"
}
```

**응답:**
```json
{
  "success": true,
  "message": "Report sent successfully",
  "reportId": 1,
  "emailSent": true
}
```

### GET /api/reports
모든 검증 기록 조회 (최근 50개)

**응답:**
```json
{
  "total": 10,
  "reports": [
    {
      "id": 1,
      "url": "https://example.com",
      "score": 85,
      "timestamp": "...",
      "created_at": "..."
    }
  ]
}
```

### GET /api/reports/:id
특정 검증 기록 상세 조회

### GET /api/reports/url/:url
특정 URL의 검증 기록 조회

### GET /api/health
서버 상태 확인

## 점수 등급

- **80-100점**: Excellent (우수) - AI 친화적
- **60-79점**: Good (좋음) - 양호
- **40-59점**: Fair (보통) - 개선 권장
- **0-39점**: Needs Improvement (개선 필요) - 많은 개선 필요

## 기능 확장 아이디어

- [ ] 사용자 인증 시스템
- [ ] 개인 대시보드
- [ ] 정기 자동 검증 (크론 작업)
- [ ] 웹사이트 변경 모니터링
- [ ] 경쟁사 비교 분석
- [ ] 더 많은 검증 카테고리 추가
- [ ] 모바일 최적화 검증
- [ ] 보안 헤더 검증
- [ ] API 키 기반 인증

## 문제 해결

### 이메일 전송 실패
- SMTP 자격 증명 확인
- Gmail 사용 시 앱 비밀번호 사용 (일반 비밀번호 아님)
- 방화벽에서 포트 587 허용 확인

### 웹사이트 검증 실패 (403 오류)
- 일부 웹사이트는 봇 요청을 차단할 수 있음
- User-Agent 헤더가 차단될 수 있음
- 다른 URL로 테스트 시도

### 데이터베이스 오류
- `backend/website-checker.db` 파일의 권한 확인
- SQLite가 제대로 설치되었는지 확인

## 라이선스

ISC

## 제작 정보

**AI Website Checker v2.0**
- Express.js + React 풀스택 애플리케이션
- SQLite 데이터베이스
- PDF 보고서 생성
- 이메일 전송 기능

---

Made with ❤️ for better AI-friendly websites
