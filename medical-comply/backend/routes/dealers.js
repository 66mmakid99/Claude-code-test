const express = require('express');
const { query } = require('../config/database');
const { authMiddleware, dealerMiddleware } = require('../middlewares/auth');

const router = express.Router();

// 딜러 대시보드 통계
router.get('/dashboard', authMiddleware, dealerMiddleware, async (req, res) => {
  try {
    const dealerId = req.user.userId;

    // 총 추천 고객 수
    const customersResult = await query(
      'SELECT COUNT(*) FROM users WHERE referred_by = $1',
      [dealerId]
    );

    // 총 수수료 (전체)
    const totalCommissionResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM dealer_commissions WHERE dealer_id = $1',
      [dealerId]
    );

    // 이번 달 수수료
    const monthlyCommissionResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM dealer_commissions
       WHERE dealer_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [dealerId]
    );

    // 대기 중인 수수료
    const pendingCommissionResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM dealer_commissions
       WHERE dealer_id = $1 AND status = 'pending'`,
      [dealerId]
    );

    // 지급 완료된 수수료
    const paidCommissionResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM dealer_commissions
       WHERE dealer_id = $1 AND status = 'paid'`,
      [dealerId]
    );

    // 딜러 쿠폰 코드 조회
    const dealerResult = await query(
      'SELECT coupon_code FROM users WHERE id = $1',
      [dealerId]
    );

    res.json({
      couponCode: dealerResult.rows[0]?.coupon_code,
      totalCustomers: parseInt(customersResult.rows[0].count),
      totalCommission: parseInt(totalCommissionResult.rows[0].total),
      monthlyCommission: parseInt(monthlyCommissionResult.rows[0].total),
      pendingCommission: parseInt(pendingCommissionResult.rows[0].total),
      paidCommission: parseInt(paidCommissionResult.rows[0].total)
    });
  } catch (error) {
    console.error('딜러 대시보드 오류:', error);
    res.status(500).json({ error: '대시보드 조회 중 오류가 발생했습니다.' });
  }
});

// 추천 고객 목록
router.get('/customers', authMiddleware, dealerMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT u.id, u.email, u.name, u.company_name, u.subscription_status, u.created_at,
              COALESCE(SUM(dc.amount), 0) as total_commission
       FROM users u
       LEFT JOIN dealer_commissions dc ON dc.customer_id = u.id AND dc.dealer_id = $1
       WHERE u.referred_by = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM users WHERE referred_by = $1',
      [req.user.userId]
    );

    res.json({
      customers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('고객 목록 조회 오류:', error);
    res.status(500).json({ error: '고객 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 수수료 내역
router.get('/commissions', authMiddleware, dealerMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT dc.*, u.email as customer_email, u.name as customer_name, p.order_id
      FROM dealer_commissions dc
      JOIN users u ON u.id = dc.customer_id
      JOIN payments p ON p.id = dc.payment_id
      WHERE dc.dealer_id = $1
    `;
    const params = [req.user.userId];

    if (status) {
      queryText += ` AND dc.status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ` ORDER BY dc.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countQuery = status
      ? 'SELECT COUNT(*) FROM dealer_commissions WHERE dealer_id = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM dealer_commissions WHERE dealer_id = $1';
    const countParams = status ? [req.user.userId, status] : [req.user.userId];
    const countResult = await query(countQuery, countParams);

    res.json({
      commissions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('수수료 내역 조회 오류:', error);
    res.status(500).json({ error: '수수료 내역 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
