# AI Website Checker

AI 친화적인 웹사이트 검증 서비스 - 웹사이트가 AI에게 얼마나 친화적인지 분석하는 풀스택 애플리케이션

## 기능

이 서비스는 웹사이트를 다음 5가지 카테고리로 분석합니다:

1. **HTML 구조** - 시맨틱 HTML5 요소 사용 여부
2. **메타데이터 & SEO** - 제목, 설명, Open Graph, 구조화된 데이터
3. **콘텐츠 구조** - 제목 계층, 텍스트 콘텐츠, 단락 구조
4. **접근성** - Alt 텍스트, ARIA 레이블, 언어 속성
5. **성능 & 최적화** - HTML 크기, 스크립트 수, 뷰포트 설정

## 기술 스택

### Backend
- Node.js
- Express.js
- Axios (HTTP 요청)
- Cheerio (HTML 파싱)
- CORS

### Frontend
- React 18
- Axios
- CSS3 (그라디언트 및 반응형 디자인)

## 프로젝트 구조

```
ai-website-checker/
├── backend/
│   ├── server.js           # Express 서버 및 검증 로직
│   ├── package.json        # 백엔드 의존성
│   └── .env.example        # 환경 변수 템플릿
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML 템플릿
│   ├── src/
│   │   ├── App.js          # 메인 React 컴포넌트
│   │   ├── App.css         # 스타일링
│   │   ├── index.js        # React 진입점
│   │   └── index.css       # 글로벌 스타일
│   └── package.json        # 프론트엔드 의존성
└── README.md
```

## 설치 방법

### 사전 요구사항
- Node.js (v14 이상)
- npm 또는 yarn

### 1. 백엔드 설정

```bash
cd backend
npm install
```

환경 변수 파일 생성:
```bash
cp .env.example .env
```

백엔드 서버 시작:
```bash
npm start
# 또는 개발 모드로:
npm run dev
```

서버는 http://localhost:5000 에서 실행됩니다.

### 2. 프론트엔드 설정

새 터미널 창을 열고:

```bash
cd frontend
npm install
```

프론트엔드 개발 서버 시작:
```bash
npm start
```

브라우저가 자동으로 http://localhost:3000 을 엽니다.

## 사용 방법

1. 브라우저에서 http://localhost:3000 접속
2. 입력 필드에 검증하고 싶은 웹사이트 URL 입력 (예: https://example.com)
3. "Check Website" 버튼 클릭
4. 결과를 확인:
   - 전체 점수 (0-100)
   - 각 카테고리별 상세 점수
   - 발견된 문제점
   - 개선 권장사항

## API 엔드포인트

### POST /api/verify
웹사이트 분석을 수행합니다.

**요청:**
```json
{
  "url": "https://example.com"
}
```

**응답:**
```json
{
  "url": "https://example.com",
  "timestamp": "2026-01-13T...",
  "score": 85,
  "maxScore": 100,
  "checks": {
    "structure": { ... },
    "metadata": { ... },
    "content": { ... },
    "accessibility": { ... },
    "performance": { ... }
  }
}
```

### GET /api/health
서버 상태 확인

## 평가 기준

### 점수 등급
- **80-100**: Excellent (우수)
- **60-79**: Good (좋음)
- **40-59**: Fair (보통)
- **0-39**: Needs Improvement (개선 필요)

### 카테고리별 배점
- HTML 구조: 20점
- 메타데이터 & SEO: 25점
- 콘텐츠 구조: 25점
- 접근성: 20점
- 성능 & 최적화: 10점

## 개발 참고사항

### 백엔드 개발
- `server.js`에서 새로운 검증 로직 추가 가능
- 각 카테고리별 분석 함수는 독립적으로 작동
- Cheerio를 사용하여 HTML 파싱 및 분석

### 프론트엔드 개발
- React 함수형 컴포넌트 및 Hooks 사용
- 반응형 디자인 (모바일 친화적)
- 그라디언트 UI 및 애니메이션 효과

## 향후 개선 사항

- [ ] 데이터베이스 연동 (검증 기록 저장)
- [ ] 사용자 인증 및 대시보드
- [ ] PDF 보고서 생성
- [ ] 여러 URL 일괄 검증
- [ ] 웹사이트 변경 모니터링
- [ ] 경쟁사 비교 분석
- [ ] API 키 기반 인증

## 라이선스

ISC

## 제작자

AI Website Checker v1.0
