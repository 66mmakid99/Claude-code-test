# 예외사례집 관리 가이드

## 개요

MADMEDCHECK의 의료광고 위반 분석에서 **오탐지를 방지**하기 위한 예외사례집 시스템입니다.

허용되는 표현, 컨텍스트, 오탐지 사례를 기록하면 분석 시 자동으로 참조하여 정확도를 높입니다.

---

## 파일 위치

```
backend/config/exception-rules.json
```

---

## 구조

```json
{
  "_meta": {
    "version": "1.0.0",
    "lastUpdated": "2026-01-22",
    "description": "..."
  },
  "MED001": {
    "name": "환자 후기/치료 경험담",
    "allowedPatterns": [...],
    "excludedContexts": [...],
    "falsePositiveExamples": [...]
  },
  "MED002": { ... },
  ...
}
```

---

## 주요 개념

### 1. 허용 패턴 (allowedPatterns)

위반 키워드가 발견되어도 **이 패턴에 매칭되면 예외 처리**합니다.

```json
{
  "pattern": "의료진\\s*(소개|프로필|안내)",
  "reason": "의료진 소개 페이지의 경력/학력 설명은 환자 후기가 아님",
  "example": "의료진 소개: 00대학교 졸업"
}
```

| 필드 | 설명 |
|------|------|
| `pattern` | 정규표현식 (JavaScript RegExp) |
| `reason` | 예외로 처리하는 이유 |
| `example` | 실제 예시 텍스트 |

### 2. 제외 컨텍스트 (excludedContexts)

특정 페이지 타입에서는 해당 규칙을 **검사하지 않습니다**.

```json
"excludedContexts": ["staff", "about", "facility"]
```

| 컨텍스트 | 설명 |
|----------|------|
| `staff` | 의료진 소개 페이지 |
| `about` | 병원 소개/연혁 페이지 |
| `facility` | 시설/장비 안내 페이지 |
| `location` | 오시는 길 페이지 |
| `faq` | 자주 묻는 질문 페이지 |
| `legal` | 개인정보처리방침 등 |

### 3. 오탐지 사례 (falsePositiveExamples)

실제로 오탐지가 발생했던 사례를 기록합니다. **Confidence 점수를 낮추는 데 사용**됩니다.

```json
{
  "text": "환자분들의 편의를 위해 주차장을 운영합니다",
  "reason": "'환자'라는 단어가 있지만 후기가 아닌 시설 안내"
}
```

### 4. 위반 지표 (violationIndicators)

이 패턴이 발견되면 **Confidence가 증가**합니다 (실제 위반일 가능성 높음).

```json
{
  "pattern": "100%\\s*(만족|효과|성공)",
  "reason": "100% 보장 표현은 명백한 위반"
}
```

---

## API 엔드포인트

### 예외사례 조회

```bash
# 전체 조회
GET /api/exceptions

# 특정 규칙 상세 조회
GET /api/exceptions/MED005
```

### 오탐지 사례 추가

```bash
POST /api/exceptions/MED005/false-positive
Content-Type: application/json

{
  "text": "여름맞이 피부관리 이벤트 진행중",
  "reason": "시즌 이벤트 안내, 과도한 할인 표현 없음"
}
```

### 허용 패턴 추가

```bash
POST /api/exceptions/MED006/allowed-pattern
Content-Type: application/json

{
  "pattern": "최상(의|급)\\s*서비스",
  "reason": "서비스에 대한 표현은 의료 효과 주장이 아님",
  "example": "최상의 서비스를 제공하겠습니다"
}
```

### 삭제

```bash
# 오탐지 사례 삭제 (인덱스 0부터 시작)
DELETE /api/exceptions/MED005/false-positive/0

# 허용 패턴 삭제
DELETE /api/exceptions/MED006/allowed-pattern/0
```

### 리로드

```bash
# 파일 수정 후 메모리 리로드
POST /api/exceptions/reload
```

---

## Confidence 점수 시스템

### 점수 계산

| 조건 | 조정 |
|------|------|
| 기본값 | 60점 |
| 오탐지 사례 유사 | -40점 |
| 허용 패턴 매칭 | 예외 처리 (검사 제외) |
| 위반 지표 매칭 | +25점 |
| 복수 위반 키워드 | +15점 |

### 임계값

| Confidence | 결과 |
|------------|------|
| 70% 이상 | `violation` 또는 `warning` (위반으로 표시) |
| 40~69% | `review` (검토 필요로 표시) |
| 40% 미만 | 통과 (표시 안함) |

---

## 실제 사용 예시

### 문제 상황

스크린샷에서 **의료진 프로필 사진**이 MED002(치료 전후 사진)로 오탐지됨.

### 해결 방법

1. **이미지 URL 제외 패턴 추가**

```json
// exception-rules.json - MED002 섹션
"imageUrlExclusions": [
  "staff",
  "doctor",
  "team",
  "profile"
]
```

2. **컨텍스트 제외 추가**

```json
"imageContextExclusions": [
  {
    "sectionKeywords": ["의료진", "원장", "전문의"],
    "reason": "의료진 소개 섹션의 이미지"
  }
]
```

3. **오탐지 사례 기록** (API 사용)

```bash
curl -X POST http://localhost:5000/api/exceptions/MED002/false-positive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "imageUrl": "upload/20251017125455_doctor_profile.jpg",
    "context": "의료진 소개 페이지",
    "reason": "의료진 프로필 사진을 전후 사진으로 오인"
  }'
```

---

## 핫 리로드

예외사례집 파일(`exception-rules.json`)이 수정되면 **자동으로 리로드**됩니다.

서버 재시작 없이 즉시 반영됩니다.

```
🔄 예외사례집 변경 감지, 리로드 중...
✅ 예외사례집 로드 완료 (v1.0.1)
```

---

## 규칙별 예외사례 요약

### MED001: 환자 후기
- 허용: 의료진 소개, 병원 연혁
- 오탐지: "환자분들의 편의를 위해", "치료 후 주의사항"

### MED002: 치료 전후 사진
- 허용: 의료진 프로필, 시설 사진, 오시는 길
- 오탐지: 시설 리모델링 전후 사진

### MED003: 성공률/효과 보장
- 허용: "개인차가 있을 수 있습니다" 포함 시
- 오탐지: 부작용 고지 + 개인차 안내

### MED004: 유명인 추천
- 허용: 언론 보도 사실 안내
- 오탐지: "KBS 건강 프로그램 자문의 출연"

### MED005: 과도한 할인/이벤트
- 허용: 신규 고객 혜택, 예약 안내, 카드 할인
- 오탐지: "이벤트 진행중", "네이버 예약 시 주차권 무료"

### MED006: 최상급 표현
- 허용: "최선을 다하겠습니다", "최신 장비", "최상의 서비스"
- 오탐지: 진료 환경에 대한 표현

---

## 유지보수

### 정기 점검

1. 분석 결과 모니터링
2. 오탐지 리포트 수집
3. 예외사례집 업데이트
4. 버전 기록

### 버전 관리

```json
"_meta": {
  "version": "1.0.5",  // 자동 증가
  "lastUpdated": "2026-01-22"
}
```

---

*마지막 업데이트: 2026-01-22*
