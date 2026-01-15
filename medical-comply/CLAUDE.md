# MEDCHECKER 프로젝트 가이드

## 프로젝트 개요
MEDCHECKER는 의료기관 웹사이트의 AI 검색 최적화(AEO/GEO) 분석과 의료광고 법규 준수 검사를 제공하는 SaaS 서비스입니다.

## 기술 스택
- **백엔드**: Node.js, Express.js
- **프론트엔드**: React, Vite
- **데이터베이스**: PostgreSQL
- **배포**: Railway

## 디렉토리 구조
```
medical-comply/
├── backend/           # Express.js 백엔드 서버
│   ├── server.js      # 메인 서버 파일
│   ├── routes/        # API 라우트
│   ├── services/      # 비즈니스 로직
│   └── config/        # 설정 파일
├── frontend/          # React 프론트엔드
│   ├── src/
│   │   ├── pages/     # 페이지 컴포넌트
│   │   ├── components/# 공통 컴포넌트
│   │   └── services/  # API 호출
│   └── vite.config.js
├── scripts/           # 자동화 스크립트
└── CLAUDE.md          # 이 파일
```

---

## 자동화 스크립트 사용법

### 스크립트 위치
모든 스크립트는 `scripts/` 폴더에 있습니다.

### 1. 서버 상태 확인 (healthcheck.py)
서버가 정상 작동하는지 확인합니다.

```bash
cd scripts
python3 healthcheck.py
```

**환경변수 설정 (선택):**
```bash
export BACKEND_PORT=5000      # 백엔드 포트 (기본: 5000)
export FRONTEND_PORT=5173     # 프론트엔드 포트 (기본: 5173)
export BACKEND_HOST=localhost # 백엔드 호스트
export FRONTEND_HOST=localhost# 프론트엔드 호스트
```

### 2. 서버 자동 재시작 (auto_restart.py)
포트를 정리하고 서버를 재시작합니다.

```bash
# 모든 서버 재시작
python3 auto_restart.py

# 백엔드만 재시작
python3 auto_restart.py --backend-only

# 프론트엔드만 재시작
python3 auto_restart.py --frontend-only

# 프로세스만 종료 (재시작 안함)
python3 auto_restart.py --kill-only

# 특정 포트만 종료
python3 auto_restart.py --port 5000
```

### 3. 코드 품질 검사 (lint_and_fix.py)
ESLint, TypeScript 타입 검사, Python 문법 검사를 실행합니다.

```bash
# 전체 검사 + 자동 수정
python3 lint_and_fix.py

# 검사만 (수정 안함)
python3 lint_and_fix.py --no-fix

# Python만 검사
python3 lint_and_fix.py --python-only

# ESLint만 검사
python3 lint_and_fix.py --eslint-only

# TypeScript만 검사
python3 lint_and_fix.py --typescript-only
```

### 4. 배포 전 종합 검사 (deploy_check.py)
위 스크립트들을 순차적으로 실행하여 배포 전 상태를 확인합니다.

```bash
# 전체 검사 (린트 → 빌드 → 재시작 → 헬스체크)
python3 deploy_check.py

# 빠른 검사 (린트, 빌드 건너뛰기)
python3 deploy_check.py --quick

# 린트 검사만
python3 deploy_check.py --lint-only

# 특정 단계 건너뛰기
python3 deploy_check.py --skip-lint
python3 deploy_check.py --skip-build
python3 deploy_check.py --skip-restart
```

---

## 개발 환경 설정

### 로컬 개발 서버 실행
```bash
# 백엔드 (터미널 1)
cd backend
npm install
npm start

# 프론트엔드 (터미널 2)
cd frontend
npm install
npm run dev
```

### 환경변수 설정
`backend/.env` 파일 생성:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/medchecker
JWT_SECRET=your-secret-key
```

---

## API 엔드포인트

### 헬스 체크
- `GET /api/health` - 서버 상태 확인

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

### AEO 분석
- `POST /api/aeo/analyze` - AEO/GEO 분석 실행
- `GET /api/aeo/history` - 분석 기록 조회

### 의료광고 검사
- `POST /api/reports/scan` - 광고 검사 실행
- `GET /api/reports` - 검사 기록 조회

---

## 트러블슈팅

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :5000

# 포트 강제 종료
python3 scripts/auto_restart.py --port 5000
```

### 데이터베이스 연결 실패
1. DATABASE_URL 환경변수 확인
2. PostgreSQL 서버 실행 상태 확인
3. 네트워크 연결 확인

### 배포 실패
1. `python3 scripts/deploy_check.py` 실행
2. 빌드 오류 확인
3. 환경변수 설정 확인

---

## 소셜 로그인 설정 (OAuth)

MEDCHECKER는 Google, 네이버, 카카오 계정 연동 로그인을 지원합니다.

### 1. Google OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 또는 선택
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Authorized redirect URIs 추가:
   - 로컬: `http://localhost:5173/oauth/callback/google`
   - 프로덕션: `https://your-domain.com/oauth/callback/google`
6. Client ID와 Client Secret 복사

### 2. 네이버 OAuth 설정
1. [네이버 개발자 센터](https://developers.naver.com) 접속
2. **Application → 애플리케이션 등록**
3. 사용 API: **네이버 로그인** 선택
4. 서비스 URL 등록:
   - 로컬: `http://localhost:5173`
   - 프로덕션: `https://your-domain.com`
5. Callback URL 등록:
   - 로컬: `http://localhost:5173/oauth/callback/naver`
   - 프로덕션: `https://your-domain.com/oauth/callback/naver`
6. Client ID와 Client Secret 복사

### 3. 카카오 OAuth 설정
1. [카카오 개발자 센터](https://developers.kakao.com) 접속
2. **애플리케이션 추가**
3. **플랫폼 → Web → 사이트 도메인 등록**:
   - 로컬: `http://localhost:5173`
   - 프로덕션: `https://your-domain.com`
4. **카카오 로그인 → Redirect URI** 등록:
   - 로컬: `http://localhost:5173/oauth/callback/kakao`
   - 프로덕션: `https://your-domain.com/oauth/callback/kakao`
5. **앱 키 → REST API 키** 복사 (Client ID로 사용)
6. **카카오 로그인 → 보안 → Client Secret** 생성 (선택)

### 4. 환경변수 설정

**백엔드 (.env)**
```env
# Google
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Naver
NAVER_CLIENT_ID=your-client-id
NAVER_CLIENT_SECRET=your-client-secret

# Kakao
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
```

**프론트엔드 (.env)**
```env
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_NAVER_CLIENT_ID=your-client-id
VITE_KAKAO_CLIENT_ID=your-rest-api-key
```

### 5. Railway 환경변수 설정
Railway 대시보드 → Variables에서 위 환경변수들을 추가합니다.

### 6. DB 마이그레이션 (기존 DB 업데이트)
```bash
cd backend
node scripts/migrate-oauth.js
```
