# DEVELOPMENT.md - 개발 환경 설정 가이드

## 개요

MADMEDCHECK 프로젝트의 개발 환경 설정, 디버깅 방법, 문제 해결 가이드입니다.

---

## 1. 개발 환경 요구사항

### 1.1 필수 소프트웨어

| 소프트웨어 | 최소 버전 | 권장 버전 | 용도 |
|-----------|----------|----------|------|
| Node.js | 18.x | 20.x LTS | 런타임 환경 |
| npm | 9.x | 10.x | 패키지 관리 |
| PostgreSQL | 14.x | 16.x | 데이터베이스 |
| Git | 2.30+ | 최신 | 버전 관리 |
| Python | 3.9+ | 3.11+ | 자동화 스크립트 |

### 1.2 권장 도구

| 도구 | 용도 |
|------|------|
| VS Code | 코드 에디터 |
| Postman / Insomnia | API 테스트 |
| TablePlus / DBeaver | DB 관리 |
| Chrome DevTools | 프론트엔드 디버깅 |

### 1.3 VS Code 확장 프로그램

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-python.python",
    "prisma.prisma",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "usernamehw.errorlens"
  ]
}
```

---

## 2. 초기 설정

### 2.1 저장소 클론

```bash
git clone https://github.com/your-org/medical-comply.git
cd medical-comply
```

### 2.2 의존성 설치

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Python 스크립트 (선택)
cd ../scripts
pip install -r requirements.txt  # 있을 경우
```

### 2.3 환경변수 설정

**Backend (.env)**

```bash
cd backend
cp .env.example .env
```

```env
# 서버 설정
PORT=5000
NODE_ENV=development

# 데이터베이스
# Mock DB 모드: DATABASE_URL 미설정 시 자동 활성화
DATABASE_URL=postgresql://postgres:password@localhost:5432/medchecker_dev

# JWT 인증
JWT_SECRET=dev-secret-key-change-in-production

# 외부 API (선택 - 없으면 Mock 응답)
ANTHROPIC_API_KEY=sk-ant-api03-xxx
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret

# 결제 (테스트 모드)
TOSS_CLIENT_KEY=test_ck_xxx
TOSS_SECRET_KEY=test_sk_xxx

# 이메일 (선택)
RESEND_API_KEY=re_xxx

# OAuth (선택)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NAVER_OAUTH_CLIENT_ID=xxx
NAVER_OAUTH_CLIENT_SECRET=xxx
KAKAO_CLIENT_ID=xxx

# 프론트엔드 URL
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env)**

```bash
cd frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
VITE_NAVER_CLIENT_ID=xxx
VITE_KAKAO_CLIENT_ID=xxx
```

### 2.4 데이터베이스 설정

**옵션 1: PostgreSQL 로컬 설치**

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# DB 생성
createdb medchecker_dev
psql medchecker_dev < backend/config/schema.sql
```

**옵션 2: Docker 사용**

```bash
docker run -d \
  --name medchecker-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=medchecker_dev \
  -p 5432:5432 \
  postgres:16-alpine

# 스키마 적용
docker exec -i medchecker-postgres psql -U postgres -d medchecker_dev < backend/config/schema.sql
```

**옵션 3: Mock DB 모드 (DB 없이 개발)**

```bash
# DATABASE_URL 환경변수를 설정하지 않으면 자동으로 Mock DB 모드 활성화
# 메모리 내 데이터 저장 (서버 재시작 시 초기화)
```

---

## 3. 개발 서버 실행

### 3.1 스크립트 사용 (권장)

```bash
cd medical-comply

# 전체 서버 시작
./start-dev.sh

# 또는 Python 스크립트
python scripts/auto_restart.py
```

### 3.2 수동 실행

```bash
# 터미널 1: Backend
cd backend
npm run dev    # nodemon으로 핫 리로드

# 터미널 2: Frontend
cd frontend
npm run dev    # Vite 개발 서버
```

### 3.3 접속 주소

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| API Health | http://localhost:5000/api/health |

---

## 4. 개발 모드별 동작

### 4.1 Mock 모드 동작

| 기능 | 실제 연동 | Mock 모드 |
|------|----------|-----------|
| 데이터베이스 | PostgreSQL | 메모리 저장소 |
| AI 분석 | Claude API | 규칙 기반 분석 |
| 네이버 검색 | 네이버 API | 샘플 데이터 |
| 결제 | 토스페이먼츠 | 테스트 결제 |
| 이메일 | Resend | 콘솔 로그 출력 |

### 4.2 환경변수에 따른 모드 전환

```javascript
// Mock 모드 판별 로직
const isMockDb = !process.env.DATABASE_URL;
const isMockAI = !process.env.ANTHROPIC_API_KEY;
const isMockNaver = !process.env.NAVER_CLIENT_ID;

// 로그로 현재 모드 확인
console.log('=== MEDCHECKER Server ===');
console.log(`DB Mode: ${isMockDb ? 'Mock' : 'PostgreSQL'}`);
console.log(`AI Mode: ${isMockAI ? 'Rule-based' : 'Claude API'}`);
console.log(`Naver Mode: ${isMockNaver ? 'Mock' : 'Live API'}`);
```

---

## 5. 디버깅 가이드

### 5.1 Backend 디버깅

**VS Code 디버그 설정 (.vscode/launch.json)**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "express:*"
      }
    }
  ]
}
```

**로그 레벨 설정**

```javascript
// server.js에 로깅 미들웨어 추가
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});
```

**API 요청 디버깅**

```bash
# 터미널에서 직접 테스트
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123"}'

# 응답 확인
curl -X GET http://localhost:5000/api/health | jq
```

### 5.2 Frontend 디버깅

**React DevTools 사용**

1. Chrome 확장 프로그램 설치: React Developer Tools
2. F12 → Components 탭에서 컴포넌트 상태 확인
3. Profiler 탭에서 렌더링 성능 분석

**Vite 디버깅**

```javascript
// vite.config.js
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  // 소스맵 활성화
  build: {
    sourcemap: true
  }
});
```

**콘솔 로그 활용**

```javascript
// 개발 환경에서만 로그 출력
const isDev = import.meta.env.DEV;

function debugLog(...args) {
  if (isDev) {
    console.log('[DEBUG]', ...args);
  }
}

// API 호출 디버깅
debugLog('API Request:', { url, params });
debugLog('API Response:', response.data);
```

### 5.3 데이터베이스 디버깅

**쿼리 로깅**

```javascript
// config/database.js
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  console.log('Executed query:', {
    text,
    params,
    duration: `${duration}ms`,
    rows: res.rowCount
  });

  return res;
};
```

**psql 직접 접속**

```bash
# 로컬 DB 접속
psql -U postgres -d medchecker_dev

# 자주 쓰는 쿼리
\dt                        # 테이블 목록
\d users                   # 테이블 구조
SELECT * FROM users LIMIT 5;
SELECT * FROM scan_reports ORDER BY created_at DESC LIMIT 10;
```

---

## 6. 테스트

### 6.1 API 테스트 시나리오

```bash
# 1. 헬스체크
curl http://localhost:5000/api/health

# 2. 회원가입
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "테스트유저"
  }'

# 3. 로그인 → 토큰 획득
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.token')

# 4. 웹사이트 검사
curl -X POST http://localhost:5000/api/reports/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "https://example.com"}'

# 5. AEO 분석
curl -X POST http://localhost:5000/api/aeo/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "https://example.com"}'
```

### 6.2 자동화 테스트 스크립트

```bash
# 코드 품질 검사
python scripts/lint_and_fix.py

# 서버 헬스체크
python scripts/healthcheck.py

# 배포 전 종합 검사
python scripts/deploy_check.py
```

---

## 7. 문제 해결 (Troubleshooting)

### 7.1 포트 충돌

```bash
# 포트 5000 사용 중인 프로세스 확인
lsof -i :5000
netstat -tlnp | grep 5000

# 프로세스 종료
kill -9 <PID>

# 또는 스크립트 사용
python scripts/auto_restart.py --port 5000
```

### 7.2 npm 의존성 문제

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 정리
npm cache clean --force
```

### 7.3 데이터베이스 연결 실패

```bash
# PostgreSQL 서비스 상태 확인
brew services list | grep postgres   # macOS
systemctl status postgresql          # Linux

# 연결 테스트
psql -U postgres -h localhost -d medchecker_dev

# 환경변수 확인
echo $DATABASE_URL
```

### 7.4 CORS 오류

```javascript
// backend/server.js
const cors = require('cors');

// 개발 환경 CORS 설정
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
```

### 7.5 JWT 토큰 오류

```bash
# 토큰 디코딩 확인 (jwt.io에서 테스트)
# 또는 Node.js에서 확인
node -e "console.log(require('jsonwebtoken').decode('YOUR_TOKEN'))"

# 토큰 만료 확인
# exp 필드가 현재 시간보다 이전이면 만료
```

### 7.6 프론트엔드 빌드 오류

```bash
# Tailwind CSS 관련 오류
npm install -D tailwindcss postcss autoprefixer

# Vite 캐시 정리
rm -rf node_modules/.vite
npm run dev

# TypeScript 오류 (있을 경우)
npx tsc --noEmit
```

### 7.7 OAuth 로그인 실패

```bash
# 1. 콜백 URL 확인
# Google: https://console.cloud.google.com
# Naver: https://developers.naver.com
# Kakao: https://developers.kakao.com

# 2. 환경변수 확인
echo $GOOGLE_CLIENT_ID
echo $NAVER_OAUTH_CLIENT_ID
echo $KAKAO_CLIENT_ID

# 3. 프론트엔드 환경변수 확인
grep VITE_ frontend/.env
```

---

## 8. 성능 프로파일링

### 8.1 Backend 성능 측정

```javascript
// 요청 처리 시간 측정 미들웨어
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;

    if (duration > 1000) {
      console.warn(`[SLOW] ${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
    }
  });

  next();
});
```

### 8.2 메모리 사용량 모니터링

```javascript
// 주기적 메모리 로깅
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory:', {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(used.rss / 1024 / 1024) + 'MB'
  });
}, 60000); // 1분마다
```

### 8.3 DB 쿼리 성능

```sql
-- PostgreSQL 슬로우 쿼리 확인
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 테이블 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';
```

---

## 9. 로컬 HTTPS 설정 (선택)

OAuth 테스트 시 HTTPS가 필요한 경우:

```bash
# mkcert 설치 (macOS)
brew install mkcert
mkcert -install

# 인증서 생성
cd frontend
mkcert localhost

# vite.config.js 수정
import fs from 'fs';

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem')
    }
  }
});
```

---

## 10. 유용한 개발 명령어 모음

```bash
# === 서버 관리 ===
npm run dev                    # 개발 서버 (핫 리로드)
npm start                      # 프로덕션 서버

# === 코드 품질 ===
npm run lint                   # ESLint 검사
npm run lint:fix               # ESLint 자동 수정
npm run format                 # Prettier 포맷팅

# === 빌드 ===
npm run build                  # 프로덕션 빌드
npm run preview                # 빌드 결과 미리보기

# === 데이터베이스 ===
psql -U postgres -d medchecker_dev   # DB 접속
pg_dump medchecker_dev > backup.sql  # 백업
psql medchecker_dev < backup.sql     # 복원

# === Git ===
git status                     # 변경사항 확인
git diff                       # 변경 내용 상세
git log --oneline -10          # 최근 커밋 10개

# === 자동화 스크립트 ===
python scripts/healthcheck.py          # 헬스체크
python scripts/auto_restart.py         # 서버 재시작
python scripts/lint_and_fix.py         # 린트
python scripts/deploy_check.py         # 배포 전 검사
```

---

## 11. IDE 설정 권장사항

### VS Code settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "javascriptreact"],
  "tailwindCSS.includeLanguages": {
    "javascript": "javascript",
    "javascriptreact": "javascript"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

*마지막 업데이트: 2026-01-22*
