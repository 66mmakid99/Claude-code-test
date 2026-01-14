-- MedicalComply 데이터베이스 스키마
-- PostgreSQL

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    company_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'dealer', 'admin')),
    subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'expired', 'cancelled')),
    subscription_end_date TIMESTAMP,
    referred_by UUID REFERENCES users(id),
    coupon_code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 웹사이트 검사 리포트 테이블
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_score INTEGER,
    violation_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    report_data JSONB,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 위반 항목 테이블
CREATE TABLE IF NOT EXISTS violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'warning', 'info')),
    rule_code VARCHAR(50) NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    location TEXT,
    evidence TEXT,
    recommendation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 의료법 위반 규칙 테이블
CREATE TABLE IF NOT EXISTS violation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    legal_basis VARCHAR(200),
    severity VARCHAR(20) CHECK (severity IN ('critical', 'warning', 'info')),
    keywords JSONB,
    patterns JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 결제 테이블
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    payment_key VARCHAR(200),
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50),
    subscription_months INTEGER DEFAULT 1,
    coupon_code VARCHAR(20),
    dealer_id UUID REFERENCES users(id),
    dealer_commission INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- 딜러 수수료 테이블
CREATE TABLE IF NOT EXISTS dealer_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id),
    amount INTEGER NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 50.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_coupon_code ON users(coupon_code);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_violations_report_id ON violations(report_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_dealer_id ON payments(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_commissions_dealer_id ON dealer_commissions(dealer_id);

-- 기본 의료법 위반 규칙 데이터 삽입
INSERT INTO violation_rules (code, category, name, description, legal_basis, severity, keywords, patterns) VALUES
('MED001', 'patient_review', '환자 후기/치료 후기 게시', '환자의 치료 경험담이나 후기를 광고에 사용하는 것은 의료법 위반입니다.', '의료법 제56조 제2항 제3호', 'critical',
 '["환자 후기", "치료 후기", "수술 후기", "시술 후기", "치료 경험", "고객 후기", "환자 리뷰", "체험담"]',
 '["후기.*만족", "치료.*받고.*좋아", "수술.*후.*결과"]'),

('MED002', 'before_after', '치료 전후 사진 게시', '치료 전후 비교 사진을 광고에 사용하는 것은 의료법 위반입니다.', '의료법 제56조 제2항 제4호', 'critical',
 '["전후 사진", "비포 애프터", "before after", "전후 비교", "시술 전후", "수술 전후", "치료 전후"]',
 '["전.*후", "before.*after", "비포.*애프터"]'),

('MED003', 'success_rate', '치료 성공률/효과 보장', '특정 치료의 성공률이나 효과를 보장하는 표현은 의료법 위반입니다.', '의료법 제56조 제2항 제1호', 'critical',
 '["성공률", "치료율", "완치율", "효과 보장", "100%", "확실한 효과", "guaranteed"]',
 '["\\d+%.*성공", "\\d+%.*치료", "\\d+%.*완치", "100%.*효과"]'),

('MED004', 'celebrity_endorsement', '유명인 추천/보증', '연예인이나 유명인이 특정 의료기관을 추천하는 형태의 광고는 의료법 위반입니다.', '의료법 제56조 제2항 제5호', 'critical',
 '["추천", "애용", "단골", "선택한 병원", "셀럽", "연예인", "유명인"]',
 '["연예인.*추천", "셀럽.*선택", "스타.*병원"]'),

('MED005', 'price_discount', '과도한 할인/이벤트 광고', '의료 서비스에 대한 과도한 할인이나 경품 제공 광고는 의료법 위반 소지가 있습니다.', '의료법 제56조 제2항 제9호', 'warning',
 '["할인", "특가", "이벤트", "무료", "경품", "사은품", "50% off", "반값"]',
 '["\\d+%.*할인", "무료.*시술", "특가.*이벤트"]'),

('MED006', 'superlative', '최상급/비교 표현 사용', '최고, 최초, 유일 등 객관적으로 검증할 수 없는 최상급 표현은 의료법 위반입니다.', '의료법 제56조 제2항 제2호', 'warning',
 '["최고", "최초", "유일", "1등", "1위", "best", "No.1", "독보적", "압도적"]',
 '["국내.*최초", "세계.*최고", "업계.*1위"]'),

('MED007', 'unverified_equipment', '검증되지 않은 장비/기술 홍보', '인증되지 않은 의료기기나 검증되지 않은 시술법을 광고하는 것은 위반입니다.', '의료법 제56조 제2항 제1호', 'warning',
 '["신기술", "최신 장비", "독자 개발", "특허 기술", "혁신적"]',
 '["세계.*최초.*도입", "국내.*유일.*장비"]'),

('MED008', 'false_specialist', '전문의 자격 허위 표시', '전문의 자격이 없는 의사를 전문의로 표시하는 것은 의료법 위반입니다.', '의료법 제56조 제2항 제1호', 'critical',
 '["전문의", "전문 의료진", "스페셜리스트", "specialist"]',
 '[]')
ON CONFLICT (code) DO NOTHING;
