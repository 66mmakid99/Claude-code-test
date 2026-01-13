const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, companyName, couponCode } = req.body;

    // 이메일 중복 확인
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 10);

    // 쿠폰 코드로 추천인 찾기
    let referredBy = null;
    if (couponCode) {
      const dealer = await query('SELECT id FROM users WHERE coupon_code = $1', [couponCode]);
      if (dealer.rows.length > 0) {
        referredBy = dealer.rows[0].id;
      }
    }

    // 사용자 생성
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, company_name, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, subscription_status`,
      [email, passwordHash, name, phone, companyName, referredBy]
    );

    const user = result.rows[0];

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user,
      token
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 사용자 조회
    const result = await query(
      'SELECT id, email, password_hash, name, role, subscription_status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];

    // 비밀번호 확인
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    res.json({
      message: '로그인 성공',
      user,
      token
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보 조회
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, phone, company_name, role, subscription_status,
              subscription_end_date, coupon_code, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
});

// 딜러 신청 (쿠폰 코드 생성)
router.post('/apply-dealer', authMiddleware, async (req, res) => {
  try {
    // 고유 쿠폰 코드 생성
    const couponCode = `MC${uuidv4().substring(0, 8).toUpperCase()}`;

    await query(
      'UPDATE users SET role = $1, coupon_code = $2 WHERE id = $3',
      ['dealer', couponCode, req.user.userId]
    );

    res.json({
      message: '딜러 신청이 완료되었습니다.',
      couponCode
    });
  } catch (error) {
    console.error('딜러 신청 오류:', error);
    res.status(500).json({ error: '딜러 신청 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
