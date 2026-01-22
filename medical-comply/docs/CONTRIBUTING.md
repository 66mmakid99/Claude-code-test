# CONTRIBUTING.md - 개발 기여 가이드

## 개요

MADMEDCHECK 프로젝트에 기여하기 위한 코딩 컨벤션, PR 규칙, 코드 리뷰 기준을 정의합니다.

---

## 1. 코딩 컨벤션

### 1.1 일반 원칙

| 원칙 | 설명 |
|------|------|
| **일관성** | 기존 코드 스타일을 따릅니다 |
| **가독성** | 명확하고 이해하기 쉬운 코드를 작성합니다 |
| **단순성** | 불필요한 복잡성을 피합니다 |
| **테스트 가능성** | 테스트하기 쉬운 구조로 작성합니다 |

### 1.2 JavaScript/Node.js (Backend)

```javascript
// ✅ Good: 명확한 함수명과 에러 처리
async function analyzeWebsite(url) {
  if (!url) {
    throw new Error('URL is required');
  }

  try {
    const result = await crawler.fetch(url);
    return processResult(result);
  } catch (error) {
    logger.error(`Website analysis failed: ${url}`, error);
    throw error;
  }
}

// ❌ Bad: 불명확한 함수명, 에러 처리 없음
async function analyze(u) {
  const r = await crawler.fetch(u);
  return process(r);
}
```

**규칙:**
- 세미콜론 사용 필수
- 들여쓰기: 2 spaces
- 문자열: 작은따옴표(') 사용, 템플릿 리터럴 허용
- 변수명: camelCase
- 상수: UPPER_SNAKE_CASE
- 파일명: kebab-case (예: `pdf-generator.js`)
- async/await 사용 권장 (콜백 지양)

### 1.3 React/JSX (Frontend)

```jsx
// ✅ Good: 명확한 컴포넌트 구조
function AnalysisCard({ title, score, items }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className="analysis-card">
      <h3>{title}</h3>
      <span className="score">{score}점</span>
      <button onClick={handleToggle}>
        {isExpanded ? '접기' : '펼치기'}
      </button>
      {isExpanded && <ItemList items={items} />}
    </div>
  );
}

// ❌ Bad: 인라인 스타일, 불명확한 구조
function Card({ d }) {
  const [e, setE] = useState(false);
  return (
    <div style={{padding: '10px'}}>
      <h3>{d.t}</h3>
      <button onClick={() => setE(!e)}>toggle</button>
    </div>
  );
}
```

**규칙:**
- 함수형 컴포넌트 사용 (클래스 컴포넌트 지양)
- 컴포넌트명: PascalCase
- Props 구조분해 할당 사용
- 이벤트 핸들러: `handle` 접두사 (예: `handleClick`)
- CSS 클래스: Tailwind CSS 또는 CSS Modules 사용
- 인라인 스타일 지양

### 1.4 CSS/Tailwind

```css
/* ✅ Good: BEM 명명법 또는 Tailwind */
.analysis-card {
  @apply p-4 rounded-lg shadow-md bg-white;
}

.analysis-card__title {
  @apply text-lg font-semibold text-gray-800;
}

.analysis-card--highlighted {
  @apply border-2 border-blue-500;
}

/* ❌ Bad: 불명확한 클래스명 */
.card1 { padding: 10px; }
.title { font-size: 16px; }
```

**규칙:**
- Tailwind CSS 클래스 우선 사용
- 커스텀 CSS 필요 시 BEM 명명법 사용
- !important 사용 지양
- 색상값: Tailwind 팔레트 사용 (하드코딩 지양)

### 1.5 SQL/Database

```sql
-- ✅ Good: 명확한 쿼리, 파라미터 바인딩
SELECT u.id, u.email, u.name, s.plan_type
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = $1
  AND u.deleted_at IS NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- ❌ Bad: SQL Injection 취약, 불명확한 구조
SELECT * FROM users WHERE email = '${email}';
```

**규칙:**
- 테이블명: snake_case, 복수형 (예: `users`, `scan_reports`)
- 컬럼명: snake_case
- 파라미터 바인딩 필수 (SQL Injection 방지)
- SELECT * 지양, 필요한 컬럼만 명시
- 인덱스 고려한 쿼리 작성

---

## 2. 파일/폴더 구조 규칙

### Backend 구조

```
backend/
├── config/           # 설정 파일 (DB, 환경변수)
├── routes/           # API 라우트 (엔드포인트별 분리)
│   ├── auth.js       # /api/auth/*
│   ├── reports.js    # /api/reports/*
│   └── payments.js   # /api/payments/*
├── services/         # 비즈니스 로직 (재사용 가능한 모듈)
│   ├── crawler.js
│   ├── analyzer.js
│   └── pdf-generator.js
├── middlewares/      # Express 미들웨어
├── utils/            # 유틸리티 함수
└── server.js         # 앱 진입점
```

### Frontend 구조

```
frontend/src/
├── components/       # 재사용 컴포넌트
│   ├── ui/           # 기본 UI (Button, Card, Modal)
│   └── features/     # 기능별 컴포넌트
├── pages/            # 페이지 컴포넌트
├── hooks/            # 커스텀 훅
├── services/         # API 호출
├── utils/            # 유틸리티 함수
├── styles/           # 글로벌 스타일
└── App.jsx           # 앱 진입점
```

---

## 3. Git 커밋 규칙

### 3.1 커밋 메시지 형식

```
<type>: <subject>

[optional body]

[optional footer]
```

### 3.2 커밋 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 추가 | `feat: 바이럴 모니터링 기능 추가` |
| `fix` | 버그 수정 | `fix: 로그인 토큰 만료 오류 수정` |
| `refactor` | 코드 리팩토링 | `refactor: analyzer 모듈 구조 개선` |
| `style` | 코드 포맷팅 (기능 변화 없음) | `style: ESLint 오류 수정` |
| `docs` | 문서 수정 | `docs: README 설치 가이드 업데이트` |
| `test` | 테스트 추가/수정 | `test: 결제 API 단위 테스트 추가` |
| `chore` | 빌드, 설정 변경 | `chore: package.json 의존성 업데이트` |
| `perf` | 성능 개선 | `perf: 크롤링 속도 최적화` |

### 3.3 커밋 메시지 예시

```bash
# ✅ Good
feat: AEO 분석에 Schema.org 검사 항목 추가

- MED007 Schema.org 누락 검사 로직 구현
- 프론트엔드 결과 표시 UI 추가
- 관련 테스트 케이스 작성

Closes #42

# ❌ Bad
코드 수정
fix
업데이트
```

### 3.4 커밋 원칙

- **원자적 커밋**: 하나의 커밋은 하나의 논리적 변경만 포함
- **자주 커밋**: 작은 단위로 자주 커밋
- **의미있는 메시지**: 무엇을, 왜 변경했는지 명확하게

---

## 4. Pull Request 규칙

### 4.1 PR 생성 전 체크리스트

```
□ 코드가 로컬에서 정상 동작하는가?
□ ESLint/Prettier 오류가 없는가?
□ 불필요한 console.log가 제거되었는가?
□ 환경변수가 .env.example에 문서화되었는가?
□ 관련 테스트가 통과하는가?
□ 기존 기능에 영향이 없는가?
```

### 4.2 PR 템플릿

```markdown
## 변경 사항
- [ ] 새 기능
- [ ] 버그 수정
- [ ] 리팩토링
- [ ] 문서 수정

## 설명
<!-- 변경 내용을 간략히 설명해주세요 -->

## 테스트 방법
<!-- 변경 사항을 어떻게 테스트할 수 있는지 설명해주세요 -->

## 스크린샷 (UI 변경 시)
<!-- UI 변경이 있다면 스크린샷을 첨부해주세요 -->

## 관련 이슈
<!-- 관련 이슈 번호를 적어주세요 (예: Closes #123) -->
```

### 4.3 PR 제목 규칙

```
<type>: <간략한 설명>

예시:
feat: 의료광고 위반 모니터링 시스템 구축
fix: 네이버 API 오류 처리 개선
refactor: Dashboard 컴포넌트 Tailwind 마이그레이션
```

### 4.4 PR 병합 규칙

| 조건 | 필수 여부 |
|------|----------|
| 최소 1명의 리뷰 승인 | 권장 |
| CI 빌드 통과 | 필수 |
| 충돌 해결 | 필수 |
| 커밋 메시지 규칙 준수 | 필수 |

---

## 5. 코드 리뷰 기준

### 5.1 리뷰어 체크리스트

**기능성**
- [ ] 요구사항을 충족하는가?
- [ ] 엣지 케이스가 처리되었는가?
- [ ] 에러 처리가 적절한가?

**보안**
- [ ] SQL Injection 취약점이 없는가?
- [ ] XSS 취약점이 없는가?
- [ ] 민감 정보가 노출되지 않는가?
- [ ] 인증/인가가 적절한가?

**성능**
- [ ] 불필요한 연산이 없는가?
- [ ] N+1 쿼리 문제가 없는가?
- [ ] 메모리 누수 가능성이 없는가?

**가독성**
- [ ] 코드가 이해하기 쉬운가?
- [ ] 변수/함수명이 명확한가?
- [ ] 복잡한 로직에 주석이 있는가?

**유지보수성**
- [ ] 중복 코드가 없는가?
- [ ] 적절히 모듈화되었는가?
- [ ] 테스트가 작성되었는가?

### 5.2 리뷰 코멘트 예시

```
# ✅ Good (구체적, 건설적)
이 함수는 너무 많은 책임을 가지고 있습니다.
`validateInput()`과 `processData()`로 분리하면
테스트하기도 쉽고 재사용성도 높아질 것 같습니다.

# ❌ Bad (모호함)
이거 이상해요.
코드 수정해주세요.
```

### 5.3 리뷰 우선순위

| 우선순위 | 레이블 | 설명 |
|---------|--------|------|
| 🔴 필수 | `blocker` | 반드시 수정 필요 (보안, 버그) |
| 🟡 권장 | `suggestion` | 수정하면 좋음 (성능, 가독성) |
| 🟢 선택 | `nit` | 사소한 개선점 |
| 💬 질문 | `question` | 이해가 필요한 부분 |

---

## 6. 브랜치 전략

### 6.1 브랜치 명명 규칙

```
<type>/<description>

예시:
feat/viral-monitoring
fix/login-token-expiry
refactor/dashboard-tailwind
docs/api-documentation
```

### 6.2 브랜치 흐름

```
main (production)
  └── develop (개발 통합)
        ├── feat/feature-a
        ├── feat/feature-b
        └── fix/bug-fix
```

### 6.3 브랜치 보호 규칙

| 브랜치 | 직접 푸시 | PR 필수 | 리뷰 필수 |
|--------|----------|---------|----------|
| `main` | ❌ | ✅ | ✅ |
| `develop` | ❌ | ✅ | 권장 |
| `feat/*` | ✅ | - | - |

---

## 7. 버전 관리

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH

예시: 1.2.3
- MAJOR: 호환되지 않는 API 변경
- MINOR: 하위 호환되는 기능 추가
- PATCH: 하위 호환되는 버그 수정
```

### 버전 업데이트 시점

| 변경 유형 | 버전 | 예시 |
|----------|------|------|
| 주요 기능 추가 | MINOR | 1.2.0 → 1.3.0 |
| 버그 수정 | PATCH | 1.2.0 → 1.2.1 |
| API 변경 (breaking) | MAJOR | 1.2.0 → 2.0.0 |

---

## 8. 문서화 규칙

### 8.1 코드 주석

```javascript
// ✅ Good: 복잡한 로직에 대한 설명
// 의료법 제56조에 따른 위반 패턴 검사
// MED001: 환자 후기 - "~한 경험", "치료 후" 등의 패턴
// MED002: 전후 사진 - "전/후", "before/after" 등의 패턴
const violationPatterns = {
  MED001: /치료.*경험|후기|환자.*말씀/,
  MED002: /전.*후|before.*after|비포.*애프터/i,
};

// ❌ Bad: 불필요하거나 명확한 코드에 대한 주석
// i를 1 증가시킴
i++;

// 사용자 가져오기
const user = getUser();
```

### 8.2 API 문서화

새로운 API 엔드포인트 추가 시 README.md 또는 CLAUDE.md에 문서화 필수:

```markdown
### POST /api/viral/scan
바이럴 콘텐츠 위반 검사

**Request:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| keyword | string | Yes | 검색 키워드 |
| platforms | array | No | 검색 플랫폼 (기본: 전체) |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| results | array | 검색 결과 목록 |
| total | number | 총 결과 수 |
```

---

## 9. 보안 정책

### 9.1 금지 사항

- 하드코딩된 API 키, 비밀번호 커밋 금지
- 프로덕션 DB 정보 코드에 포함 금지
- 사용자 비밀번호 평문 저장 금지
- 민감 정보 로그 출력 금지

### 9.2 필수 사항

- 환경변수로 민감 정보 관리
- bcrypt로 비밀번호 해싱
- JWT 토큰 만료 시간 설정
- CORS 화이트리스트 설정
- Rate Limiting 적용

### 9.3 .env 파일 관리

```bash
# .env 파일은 절대 커밋하지 않음
# .env.example 파일로 필요한 환경변수 문서화

# .env.example
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-here
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 10. 긴급 핫픽스 절차

프로덕션 버그 발생 시:

1. `main`에서 `hotfix/<description>` 브랜치 생성
2. 최소한의 수정으로 버그 해결
3. 테스트 후 `main`으로 직접 PR
4. 배포 후 `develop`에도 병합

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix
# 수정 작업
git commit -m "fix: 긴급 버그 수정"
git push origin hotfix/critical-bug-fix
# PR 생성 → 리뷰 → 병합 → 배포
```

---

*마지막 업데이트: 2026-01-22*
