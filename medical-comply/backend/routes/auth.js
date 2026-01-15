const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { query } = require('../config/database');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// OAuth 설정
const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
  },
  naver: {
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    userInfoUrl: 'https://openapi.naver.com/v1/nid/me'
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me'
  }
};

// JWT 토큰 생성 헬퍼
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 소셜 로그인/회원가입 처리 헬퍼
const handleSocialAuth = async (provider, oauthId, email, name, profileImage) => {
  // 기존 OAuth 연동 계정 확인
  let result = await query(
    'SELECT id, email, name, role, subscription_status FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    [provider, oauthId]
  );

  if (result.rows.length > 0) {
    // 기존 연동 계정 - 로그인
    return { user: result.rows[0], isNew: false };
  }

  // 이메일로 기존 계정 확인
  if (email) {
    result = await query('SELECT id, email, name, role, subscription_status, oauth_provider FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const existingUser = result.rows[0];

      // 기존 계정에 OAuth 연동
      if (!existingUser.oauth_provider) {
        await query(
          'UPDATE users SET oauth_provider = $1, oauth_id = $2, profile_image = COALESCE(profile_image, $3) WHERE id = $4',
          [provider, oauthId, profileImage, existingUser.id]
        );
      }

      return { user: existingUser, isNew: false };
    }
  }

  // 신규 회원가입
  const newUser = await query(
    `INSERT INTO users (email, name, oauth_provider, oauth_id, profile_image, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, name, role, subscription_status`,
    [email, name, provider, oauthId, profileImage, 'OAUTH_USER']
  );

  return { user: newUser.rows[0], isNew: true };
};

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
    res.status(500).json({
      error: '회원가입 중 오류가 발생했습니다.',
      detail: error.message // 디버깅용 상세 오류
    });
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

// ==================== 소셜 로그인 ====================

// Google OAuth 콜백
router.post('/oauth/google', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    const config = OAUTH_CONFIG.google;

    if (!config.clientId || !config.clientSecret) {
      return res.status(500).json({ error: 'Google OAuth가 설정되지 않았습니다.' });
    }

    // 액세스 토큰 요청
    const tokenResponse = await axios.post(config.tokenUrl, {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    // 사용자 정보 요청
    const userResponse = await axios.get(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, email, name, picture } = userResponse.data;

    // 로그인/회원가입 처리
    const { user, isNew } = await handleSocialAuth('google', id, email, name, picture);
    const token = generateToken(user);

    res.json({
      message: isNew ? '구글 계정으로 회원가입이 완료되었습니다.' : '구글 로그인 성공',
      user,
      token,
      isNew
    });
  } catch (error) {
    console.error('Google OAuth 오류:', error.response?.data || error.message);
    res.status(500).json({ error: '구글 로그인 중 오류가 발생했습니다.' });
  }
});

// Naver OAuth 콜백
router.post('/oauth/naver', async (req, res) => {
  try {
    const { code, state, redirectUri } = req.body;
    const config = OAUTH_CONFIG.naver;

    if (!config.clientId || !config.clientSecret) {
      return res.status(500).json({ error: 'Naver OAuth가 설정되지 않았습니다.' });
    }

    // 액세스 토큰 요청
    const tokenResponse = await axios.get(config.tokenUrl, {
      params: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        state
      }
    });

    const { access_token } = tokenResponse.data;

    // 사용자 정보 요청
    const userResponse = await axios.get(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, email, name, profile_image } = userResponse.data.response;

    // 로그인/회원가입 처리
    const { user, isNew } = await handleSocialAuth('naver', id, email, name, profile_image);
    const token = generateToken(user);

    res.json({
      message: isNew ? '네이버 계정으로 회원가입이 완료되었습니다.' : '네이버 로그인 성공',
      user,
      token,
      isNew
    });
  } catch (error) {
    console.error('Naver OAuth 오류:', error.response?.data || error.message);
    res.status(500).json({ error: '네이버 로그인 중 오류가 발생했습니다.' });
  }
});

// Kakao OAuth 콜백
router.post('/oauth/kakao', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    const config = OAUTH_CONFIG.kakao;

    if (!config.clientId) {
      return res.status(500).json({ error: 'Kakao OAuth가 설정되지 않았습니다.' });
    }

    // 액세스 토큰 요청
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      code
    });

    if (config.clientSecret) {
      tokenParams.append('client_secret', config.clientSecret);
    }

    const tokenResponse = await axios.post(config.tokenUrl, tokenParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token } = tokenResponse.data;

    // 사용자 정보 요청
    const userResponse = await axios.get(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, kakao_account, properties } = userResponse.data;
    const email = kakao_account?.email;
    const name = properties?.nickname || kakao_account?.profile?.nickname;
    const profileImage = properties?.profile_image || kakao_account?.profile?.profile_image_url;

    // 로그인/회원가입 처리
    const { user, isNew } = await handleSocialAuth('kakao', String(id), email, name, profileImage);
    const token = generateToken(user);

    res.json({
      message: isNew ? '카카오 계정으로 회원가입이 완료되었습니다.' : '카카오 로그인 성공',
      user,
      token,
      isNew
    });
  } catch (error) {
    console.error('Kakao OAuth 오류:', error.response?.data || error.message);
    res.status(500).json({ error: '카카오 로그인 중 오류가 발생했습니다.' });
  }
});

// OAuth 설정 상태 확인 (클라이언트에서 어떤 소셜 로그인 사용 가능한지)
router.get('/oauth/providers', (req, res) => {
  res.json({
    google: !!OAUTH_CONFIG.google.clientId,
    naver: !!OAUTH_CONFIG.naver.clientId,
    kakao: !!OAUTH_CONFIG.kakao.clientId
  });
});

module.exports = router;
