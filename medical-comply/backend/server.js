const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// JWT_SECRET 기본값 설정 (Mock 모드용)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'medical-comply-dev-secret-key-2024';
  console.log('⚠️  JWT_SECRET 환경변수 없음 - 기본값 사용 중');
}

const { pool, isMockMode } = require('./config/database');

// OAuth 컬럼 자동 마이그레이션 (서버 시작 시)
const runOAuthMigration = async () => {
  if (isMockMode || !pool) return;

  try {
    const migrationSQL = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='oauth_provider') THEN
          ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(20);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='oauth_id') THEN
          ALTER TABLE users ADD COLUMN oauth_id VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_image') THEN
          ALTER TABLE users ADD COLUMN profile_image TEXT;
        END IF;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
    `;
    await pool.query(migrationSQL);
    console.log('✅ OAuth 컬럼 마이그레이션 완료');
  } catch (error) {
    console.log('⚠️  OAuth 마이그레이션 스킵:', error.message);
  }
};

// 라우터 임포트
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const paymentRoutes = require('./routes/payments');
const dealerRoutes = require('./routes/dealers');
const aeoRoutes = require('./routes/aeo');
const monitoringRoutes = require('./routes/monitoring');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/aeo', aeoRoutes);
app.use('/api/monitoring', monitoringRoutes);

// 헬스 체크 (DB 상태와 무관하게 항상 200 반환)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    if (!isMockMode && pool) {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } else {
      dbStatus = 'mock';
    }
  } catch (error) {
    dbStatus = 'disconnected';
    console.log('DB 헬스체크 실패:', error.message);
  }

  // 서버는 정상이므로 항상 200 반환
  res.json({
    status: 'ok',
    message: 'MADMEDCHECK API 서버 정상 작동 중',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// 프론트엔드 정적 파일 서빙 (프로덕션)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));

  // SPA 라우팅 지원
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: '요청하신 경로를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    error: '서버 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 서버 시작
app.listen(PORT, async () => {
  // OAuth 마이그레이션 실행
  await runOAuthMigration();
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🏥 MedicalComply API Server                     ║
║                                                   ║
║   포트: ${PORT}                                      ║
║   환경: ${process.env.NODE_ENV || 'development'}                          ║
║   DB: ${isMockMode ? '❌ Mock 모드 (데이터 휘발성)' : '✅ PostgreSQL 연결됨'}     ║
║   시작: ${new Date().toLocaleString('ko-KR')}             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);

  if (isMockMode) {
    console.log('⚠️  경고: DATABASE_URL이 설정되지 않아 Mock 모드로 실행 중입니다.');
    console.log('⚠️  서버 재시작 시 모든 데이터가 초기화됩니다.');
    console.log('⚠️  Railway에서 DATABASE_URL 환경변수를 설정해주세요.');
  }
});

module.exports = app;
