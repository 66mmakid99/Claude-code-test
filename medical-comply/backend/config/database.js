const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 연결 테스트
pool.on('connect', () => {
  console.log('✅ PostgreSQL 데이터베이스 연결됨');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 연결 오류:', err);
  process.exit(-1);
});

// 쿼리 헬퍼 함수
const query = (text, params) => pool.query(text, params);

// 트랜잭션 헬퍼
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient
};
