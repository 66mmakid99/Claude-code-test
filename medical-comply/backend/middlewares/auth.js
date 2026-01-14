const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

const dealerMiddleware = (req, res, next) => {
  if (req.user.role !== 'dealer' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '딜러 권한이 필요합니다.' });
  }
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};

module.exports = {
  authMiddleware,
  dealerMiddleware,
  adminMiddleware
};
