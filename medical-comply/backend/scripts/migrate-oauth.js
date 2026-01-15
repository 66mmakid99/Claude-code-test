// OAuth 컬럼 추가 마이그레이션 스크립트
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrationSQL = `
-- OAuth 관련 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
  -- oauth_provider 컬럼
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='oauth_provider') THEN
    ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(20);
  END IF;

  -- oauth_id 컬럼
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='oauth_id') THEN
    ALTER TABLE users ADD COLUMN oauth_id VARCHAR(255);
  END IF;

  -- profile_image 컬럼
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_image') THEN
    ALTER TABLE users ADD COLUMN profile_image TEXT;
  END IF;
END $$;

-- email을 NULL 허용으로 변경 (카카오는 이메일 미제공 가능)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- OAuth 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
`;

async function migrate() {
  try {
    console.log('🔄 OAuth 마이그레이션 시작...');

    await pool.query(migrationSQL);

    console.log('✅ OAuth 컬럼 추가 완료!');

    // 컬럼 확인
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 users 테이블 구조:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : ''}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    process.exit(1);
  }
}

migrate();
