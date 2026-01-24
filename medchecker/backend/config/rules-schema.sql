-- MEDCHECKER 규칙 기반 분석 시스템 스키마
-- 의료광고 위반 탐지 / 바이럴 모니터링 / SEO-AEO 분석

-- ============================================
-- 1. 규칙 카테고리 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS rule_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,          -- 예: 'MEDICAL_AD', 'VIRAL', 'SEO'
    name VARCHAR(100) NOT NULL,                -- 예: '의료광고 위반'
    description TEXT,
    parent_id INTEGER REFERENCES rule_categories(id),  -- 하위 카테고리 지원
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 규칙 정의 테이블 (핵심)
-- ============================================
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(50) UNIQUE NOT NULL,       -- 예: 'MED-V-001'
    category_id INTEGER REFERENCES rule_categories(id),
    
    -- 기본 정보
    name VARCHAR(200) NOT NULL,                -- 규칙 이름
    description TEXT,                          -- 상세 설명
    
    -- 탐지 조건 (JSON)
    conditions JSONB NOT NULL,
    /*
    {
        "keywords": ["100% 완치", "완치 보장"],
        "patterns": ["100\\s*%\\s*(완치|치료)"],
        "context": {
            "mustInclude": ["치료", "시술"],
            "mustExclude": ["아닙니다", "보장하지 않"],
            "windowSize": 50
        },
        "caseSensitive": false
    }
    */
    
    -- 법적 근거
    legal_basis VARCHAR(200),                  -- 예: '의료법 제56조 제2항 제3호'
    penalty_info TEXT,                         -- 벌칙 정보
    
    -- 심각도 및 점수
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',  -- critical, warning, info
    deduct_points INTEGER DEFAULT 10,          -- 감점 점수
    
    -- AI 검증 설정
    requires_ai_verification BOOLEAN DEFAULT false,
    ai_verification_prompt TEXT,               -- AI에게 전달할 프롬프트
    confidence_threshold DECIMAL(3,2) DEFAULT 0.70,  -- AI 검증 필요 신뢰도 임계값
    
    -- 개선 권고
    recommendation TEXT,
    recommendation_example TEXT,               -- 개선 예시
    
    -- 적용 범위
    applies_to VARCHAR(50)[] DEFAULT ARRAY['website', 'blog', 'social'],
    
    -- 메타데이터
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,              -- 실행 우선순위 (낮을수록 먼저)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    
    -- 인덱스용
    tags VARCHAR(50)[]
);

-- ============================================
-- 3. 규칙 실행 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS rule_execution_logs (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(50) REFERENCES rules(rule_id),
    
    -- 분석 대상
    target_url TEXT,
    target_type VARCHAR(50),                   -- 'website', 'blog_post', 'social_post'
    content_hash VARCHAR(64),                  -- 중복 분석 방지용
    
    -- 실행 결과
    matched BOOLEAN NOT NULL,
    confidence DECIMAL(3,2),                   -- 0.00 ~ 1.00
    matched_text TEXT,                         -- 매칭된 텍스트
    matched_location TEXT,                     -- 매칭 위치 (예: 'header', 'body')
    
    -- AI 검증 결과 (있는 경우)
    ai_verified BOOLEAN,
    ai_provider VARCHAR(50),                   -- 'gemini', 'claude'
    ai_response JSONB,
    ai_cost DECIMAL(10,6),                     -- API 비용 추적
    
    -- 메타데이터
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,                           -- 분석 요청 사용자
    session_id VARCHAR(100)                    -- 분석 세션 ID
);

-- ============================================
-- 4. 분석 리포트 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) UNIQUE NOT NULL,    -- UUID
    
    -- 분석 대상
    target_url TEXT NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    
    -- 분석 유형
    analysis_types VARCHAR(50)[] NOT NULL,     -- ['medical_ad', 'viral', 'seo']
    
    -- 결과 요약
    total_score INTEGER,                       -- 100점 만점
    risk_level VARCHAR(20),                    -- 'high', 'medium', 'low'
    
    violations_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    passed_count INTEGER DEFAULT 0,
    
    -- 상세 결과 (JSON)
    results JSONB NOT NULL,
    /*
    {
        "medical_ad": {
            "score": 70,
            "violations": [...],
            "recommendations": [...]
        },
        "viral": {...},
        "seo": {...}
    }
    */
    
    -- AI 사용 통계
    ai_calls_count INTEGER DEFAULT 0,
    ai_total_cost DECIMAL(10,6) DEFAULT 0,
    
    -- 메타데이터
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    
    -- 상태
    status VARCHAR(20) DEFAULT 'completed'     -- 'pending', 'processing', 'completed', 'failed'
);

-- ============================================
-- 5. 규칙 버전 히스토리 (규칙 변경 추적)
-- ============================================
CREATE TABLE IF NOT EXISTS rule_versions (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    changes JSONB,                             -- 변경 내역
    previous_conditions JSONB,
    new_conditions JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT
);

-- ============================================
-- 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category_id);
CREATE INDEX IF NOT EXISTS idx_rules_severity ON rules(severity);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(is_active);
CREATE INDEX IF NOT EXISTS idx_rules_tags ON rules USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_execution_logs_rule ON rule_execution_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created ON rule_execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_execution_logs_matched ON rule_execution_logs(matched);

CREATE INDEX IF NOT EXISTS idx_reports_created ON analysis_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_risk ON analysis_reports(risk_level);

-- ============================================
-- 기본 카테고리 데이터 삽입
-- ============================================
INSERT INTO rule_categories (code, name, description, display_order) VALUES
    ('MEDICAL_AD', '의료광고 위반', '의료법 제56조 기반 의료광고 위반 탐지', 1),
    ('VIRAL', '바이럴 모니터링', '온라인 콘텐츠 의료광고법 위반 탐지', 2),
    ('SEO', 'SEO 분석', '검색엔진 최적화 분석', 3),
    ('AEO', 'AEO/GEO 분석', 'AI 검색 최적화 분석', 4)
ON CONFLICT (code) DO NOTHING;

-- 하위 카테고리
INSERT INTO rule_categories (code, name, description, parent_id, display_order) 
SELECT 'MED_EFFECT', '치료효과 보장', '치료 효과를 보장하는 표현', id, 1 
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_BEFORE_AFTER', '전후사진', '치료 전후 사진 관련', id, 2
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_EXAGGERATION', '과대/허위 광고', '최상급 표현 및 허위 광고', id, 3
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_UNAPPROVED', '미승인 시술', '미승인 의료행위 광고', id, 4
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_DISCOUNT', '가격/할인', '과도한 할인 및 가격 광고', id, 5
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_TESTIMONIAL', '환자 후기', '환자 경험담 및 후기', id, 6
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_CELEBRITY', '유명인 추천', '유명인/연예인 추천', id, 7
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_COMPARISON', '비교 광고', '타 의료기관 비교', id, 8
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;

INSERT INTO rule_categories (code, name, description, parent_id, display_order)
SELECT 'MED_QUALIFICATION', '자격 과장', '의료인 자격 과장', id, 9
FROM rule_categories WHERE code = 'MEDICAL_AD'
ON CONFLICT (code) DO NOTHING;
