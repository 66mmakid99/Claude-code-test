// PostgreSQL 테이블 초기화 스크립트
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const initSQL = `
-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  company_name VARCHAR(200),
  role VARCHAR(20) DEFAULT 'user',
  subscription_status VARCHAR(20) DEFAULT 'free',
  subscription_end_date TIMESTAMP,
  referred_by INTEGER REFERENCES users(id),
  coupon_code VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 검사 리포트 테이블
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_score INTEGER,
  violation_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  report_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- 위반 사항 테이블
CREATE TABLE IF NOT EXISTS violations (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  category VARCHAR(100),
  severity VARCHAR(20),
  rule_code VARCHAR(50),
  rule_name VARCHAR(200),
  description TEXT,
  location TEXT,
  evidence TEXT,
  recommendation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 위반 규칙 테이블
CREATE TABLE IF NOT EXISTS violation_rules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  severity VARCHAR(20),
  description TEXT,
  legal_basis TEXT,
  keywords TEXT[],
  patterns TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 결제 테이블
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id VARCHAR(100) UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  subscription_months INTEGER,
  coupon_code VARCHAR(50),
  dealer_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  payment_key VARCHAR(200),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  dealer_commission INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 딜러 수수료 테이블
CREATE TABLE IF NOT EXISTS dealer_commissions (
  id SERIAL PRIMARY KEY,
  dealer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  commission_rate DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 위반 규칙 데이터 삽입
INSERT INTO violation_rules (code, name, category, severity, description, legal_basis, keywords, patterns, is_active)
VALUES
  ('MED001', '환자 후기 게시', '의료광고', 'critical', '환자의 치료 경험담이나 후기를 게시', '의료법 제56조 제2항 제3호', ARRAY['후기', '치료후기', '환자후기', '치료경험', '수술후기'], ARRAY[]::TEXT[], true),
  ('MED002', '치료 전후 사진', '의료광고', 'critical', '치료 전후 비교 사진 게시', '의료법 제56조 제2항 제4호', ARRAY['전후사진', '비포애프터', 'before', 'after'], ARRAY[]::TEXT[], true),
  ('MED003', '치료 성공률 표시', '의료광고', 'critical', '치료 성공률이나 효과를 보장하는 표현', '의료법 제56조 제2항 제1호', ARRAY['성공률', '치료율', '완치율', '효과보장', '100%'], ARRAY['\\d+%\\s*(성공|완치|효과)'], true),
  ('MED004', '유명인 추천', '의료광고', 'warning', '유명인이나 연예인의 추천/이용 표시', '의료법 제56조 제2항 제5호', ARRAY['연예인', '유명인', '셀럽', '스타'], ARRAY[]::TEXT[], true),
  ('MED005', '과도한 할인 광고', '의료광고', 'warning', '과도한 할인이나 이벤트 광고', '의료법 제56조 제2항 제9호', ARRAY['특가', '할인', '이벤트', '프로모션', '무료'], ARRAY['\\d+%\\s*할인'], true),
  ('MED006', '최상급 표현 사용', '의료광고', 'warning', '최고, 최초, 1위 등의 최상급 표현', '의료법 제56조 제2항 제2호', ARRAY['최고', '최초', '1위', '유일', '독보적', '최상'], ARRAY[]::TEXT[], true)
ON CONFLICT (code) DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_violations_report_id ON violations(report_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_dealer_commissions_dealer_id ON dealer_commissions(dealer_id);
`;

async function initDatabase() {
  try {
    console.log('🔄 데이터베이스 초기화 시작...');
    console.log('📡 연결 중:', process.env.DATABASE_URL ? 'DATABASE_URL 설정됨' : 'DATABASE_URL 없음');

    await pool.query(initSQL);

    console.log('✅ 데이터베이스 테이블 생성 완료!');

    // 테이블 확인
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log('📋 생성된 테이블:', result.rows.map(r => r.table_name).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error.message);
    process.exit(1);
  }
}

initDatabase();
