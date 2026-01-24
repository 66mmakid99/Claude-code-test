/**
 * MEDCHECKER 규칙 스키마 정의
 * 
 * 핵심 원칙: 단순 키워드 매칭이 아닌, 문맥 기반 위반 판단
 * 
 * 판단 프로세스:
 * 1. 키워드/패턴으로 후보 텍스트 추출
 * 2. 주변 문맥 분석 (부정어, 조건문, 면책 표현 등)
 * 3. 문맥 점수 계산으로 실제 위반 여부 판단
 * 4. 불확실한 경우만 AI 검증
 */

/**
 * 규칙 스키마 타입 정의
 */
const RuleSchema = {
  // 규칙 식별자
  id: String,           // 예: 'MED-EFF-001'
  version: String,      // 예: '1.0.0'
  
  // 분류
  category: String,     // 'medical_ad' | 'viral' | 'seo' | 'aeo'
  subcategory: String,  // 'effect_guarantee' | 'before_after' | ...
  
  // 기본 정보
  name: String,
  description: String,
  
  // ========================================
  // 핵심: 문맥 기반 탐지 조건
  // ========================================
  detection: {
    // 1단계: 후보 추출 (이 중 하나라도 매칭되면 2단계로)
    triggers: {
      keywords: Array,      // 트리거 키워드
      patterns: Array,      // 정규식 패턴
      semantic: Array,      // 의미적 유사 표현 (AI 활용 시)
    },
    
    // 2단계: 문맥 분석 조건
    context: {
      // 주변 텍스트 분석 범위 (글자 수)
      windowSize: Number,   // 기본 100자
      
      // 위반 확정 조건 (이것들이 있으면 위반 가능성 높음)
      aggravating: {
        keywords: Array,    // 예: ['보장', '확실', '반드시', '무조건']
        patterns: Array,
        weight: Number,     // 가중치 (0.1 ~ 1.0)
      },
      
      // 위반 제외 조건 (이것들이 있으면 위반 아닐 가능성 높음)
      mitigating: {
        keywords: Array,    // 예: ['않습니다', '아닙니다', '개인차', '결과는 다를 수']
        patterns: Array,
        weight: Number,     // 감점 가중치
      },
      
      // 필수 동반 조건 (이것이 함께 있어야만 위반)
      required: {
        keywords: Array,    // 예: 치료효과 보장은 ['치료', '시술', '효과'] 중 하나 필요
        patterns: Array,
        logic: String,      // 'AND' | 'OR'
      },
      
      // 제외 패턴 (이 패턴이면 무조건 제외)
      exclusions: {
        patterns: Array,    // 예: 면책조항 패턴
        contexts: Array,    // 예: '개인차가 있을 수 있습니다'
      },
    },
    
    // 3단계: 최종 판단 임계값
    thresholds: {
      confirmViolation: Number,   // 이 점수 이상이면 확정 위반 (기본 0.8)
      requiresAI: Number,         // 이 범위면 AI 검증 필요 (0.4 ~ 0.8)
      dismiss: Number,            // 이 점수 이하면 통과 (기본 0.4)
    },
  },
  
  // ========================================
  // 법적 근거 및 제재
  // ========================================
  legal: {
    basis: String,          // 법적 근거 (예: '의료법 제56조 제2항 제3호')
    article: String,        // 조항 전문
    penalty: String,        // 벌칙
    caseExamples: Array,    // 실제 제재 사례
  },
  
  // 심각도
  severity: String,         // 'critical' | 'warning' | 'info'
  riskScore: Number,        // 위험 점수 (1-100)
  
  // 개선 권고
  recommendation: {
    action: String,         // 권고 조치
    example: {
      bad: String,          // 위반 예시
      good: String,         // 개선 예시
    },
    references: Array,      // 참고 자료 링크
  },
  
  // AI 검증 설정
  aiVerification: {
    enabled: Boolean,
    prompt: String,         // AI에게 전달할 프롬프트 템플릿
    provider: String,       // 'gemini' | 'claude' | 'auto'
  },
  
  // 메타데이터
  metadata: {
    isActive: Boolean,
    priority: Number,       // 실행 우선순위
    tags: Array,
    createdAt: Date,
    updatedAt: Date,
    author: String,
  },
};

/**
 * 문맥 분석 결과 스키마
 */
const ContextAnalysisResult = {
  ruleId: String,
  
  // 매칭 정보
  matched: Boolean,
  matchedText: String,          // 매칭된 원본 텍스트
  matchedPosition: {
    start: Number,
    end: Number,
  },
  
  // 문맥 분석 결과
  contextWindow: String,        // 분석된 주변 텍스트
  
  contextScores: {
    triggerScore: Number,       // 트리거 매칭 점수
    aggravatingScore: Number,   // 가중 점수
    mitigatingScore: Number,    // 감경 점수
    requiredScore: Number,      // 필수조건 충족 점수
  },
  
  // 최종 판단
  finalScore: Number,           // 0.0 ~ 1.0
  decision: String,             // 'violation' | 'warning' | 'pass' | 'needs_ai'
  confidence: Number,           // 판단 신뢰도
  
  // AI 검증 (있는 경우)
  aiVerification: {
    performed: Boolean,
    provider: String,
    result: String,
    reasoning: String,
    cost: Number,
  },
  
  // 증거
  evidence: {
    triggerMatches: Array,      // 트리거 매칭 목록
    aggravatingMatches: Array,  // 가중 요소 매칭
    mitigatingMatches: Array,   // 감경 요소 매칭
  },
};

module.exports = {
  RuleSchema,
  ContextAnalysisResult,
};
