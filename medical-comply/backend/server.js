const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, isMockMode } = require('./config/database');

// 라우터 임포트
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const paymentRoutes = require('./routes/payments');
const dealerRoutes = require('./routes/dealers');

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

// 헬스 체크
app.get('/api/health', async (req, res) => {
  try {
    if (!isMockMode && pool) {
      await pool.query('SELECT 1');
    }
    res.json({
      status: 'ok',
      message: 'MedicalComply API 서버 정상 작동 중',
      database: isMockMode ? 'mock' : 'connected',
      mode: isMockMode ? 'mock' : 'production',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '데이터베이스 연결 실패',
      database: 'disconnected'
    });
  }
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
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🏥 MedicalComply API Server                     ║
║                                                   ║
║   포트: ${PORT}                                      ║
║   환경: ${process.env.NODE_ENV || 'development'}                          ║
║   시작: ${new Date().toLocaleString('ko-KR')}             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
