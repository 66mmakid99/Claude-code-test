const express = require('express');
const { query, getClient } = require('../config/database');
const { authMiddleware } = require('../middlewares/auth');
const { sendCommissionEmail } = require('../services/email-sender');

const router = express.Router();

const SUBSCRIPTION_PRICE = 99000; // 월 99,000원
const DEALER_COMMISSION_RATE = 0.5; // 50%

// 테스트 모드 확인
const isTestMode = !process.env.TOSS_SECRET_KEY;

if (isTestMode) {
  console.log('⚠️  토스페이먼츠 테스트 모드로 실행 중 (API 키 없음)');
}

// 결제 요청 생성
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { months = 1, couponCode } = req.body;
    const userId = req.user.userId;

    const amount = SUBSCRIPTION_PRICE * months;
    const orderId = `MC${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 쿠폰 코드로 딜러 찾기
    let dealerId = null;
    if (couponCode) {
      const dealerResult = await query(
        'SELECT id FROM users WHERE coupon_code = $1 AND role = $2',
        [couponCode, 'dealer']
      );
      if (dealerResult.rows.length > 0) {
        dealerId = dealerResult.rows[0].id;
      }
    }

    // 결제 레코드 생성
    const result = await query(
      `INSERT INTO payments (user_id, order_id, amount, subscription_months, coupon_code, dealer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_id, amount`,
      [userId, orderId, amount, months, couponCode, dealerId]
    );

    res.json({
      orderId: result.rows[0].order_id,
      amount: result.rows[0].amount,
      orderName: `MedicalComply ${months}개월 구독`,
      customerEmail: req.user.email,
      successUrl: `${process.env.FRONTEND_URL}/payment/success`,
      failUrl: `${process.env.FRONTEND_URL}/payment/fail`
    });
  } catch (error) {
    console.error('결제 요청 오류:', error);
    res.status(500).json({ error: '결제 요청 중 오류가 발생했습니다.' });
  }
});

// 결제 성공 처리 (토스페이먼츠 콜백)
router.post('/confirm', authMiddleware, async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { paymentKey, orderId, amount } = req.body;

    // 결제 정보 조회
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE order_id = $1 AND user_id = $2',
      [orderId, req.user.userId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('결제 정보를 찾을 수 없습니다.');
    }

    const payment = paymentResult.rows[0];

    if (payment.amount !== parseInt(amount)) {
      throw new Error('결제 금액이 일치하지 않습니다.');
    }

    let paymentMethod = 'card';

    // 테스트 모드가 아닐 때만 실제 토스 API 호출
    if (!isTestMode) {
      const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount) })
      });

      if (!tossResponse.ok) {
        const errorData = await tossResponse.json();
        throw new Error(errorData.message || '결제 승인 실패');
      }

      const tossData = await tossResponse.json();
      paymentMethod = tossData.method || 'card';
    } else {
      console.log(`🧪 테스트 모드: 결제 승인 시뮬레이션 - ${orderId}, ${amount}원`);
    }

    // 결제 상태 업데이트
    await client.query(
      `UPDATE payments
       SET status = 'completed', payment_key = $1, payment_method = $2, paid_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [paymentKey || `TEST_${Date.now()}`, paymentMethod, payment.id]
    );

    // 사용자 구독 상태 업데이트
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + payment.subscription_months);

    await client.query(
      `UPDATE users
       SET subscription_status = 'active', subscription_end_date = $1
       WHERE id = $2`,
      [subscriptionEndDate, req.user.userId]
    );

    // 딜러 수수료 처리
    if (payment.dealer_id) {
      const commissionAmount = Math.floor(payment.amount * DEALER_COMMISSION_RATE);

      await client.query(
        `INSERT INTO dealer_commissions (dealer_id, payment_id, customer_id, amount, commission_rate)
         VALUES ($1, $2, $3, $4, $5)`,
        [payment.dealer_id, payment.id, req.user.userId, commissionAmount, DEALER_COMMISSION_RATE * 100]
      );

      // 결제 레코드에 수수료 기록
      await client.query(
        'UPDATE payments SET dealer_commission = $1 WHERE id = $2',
        [commissionAmount, payment.id]
      );

      // 딜러에게 수수료 알림 이메일 발송 (비동기)
      const dealerResult = await client.query(
        'SELECT email, name FROM users WHERE id = $1',
        [payment.dealer_id]
      );

      const customerResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (dealerResult.rows.length > 0) {
        const dealer = dealerResult.rows[0];
        const customerName = customerResult.rows[0]?.name || '고객';

        // 비동기로 이메일 발송 (응답 지연 방지)
        sendCommissionEmail({
          to: dealer.email,
          name: dealer.name,
          amount: commissionAmount,
          customerName
        }).catch(err => console.error('딜러 수수료 이메일 발송 실패:', err));
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '결제가 완료되었습니다.',
      subscriptionEndDate,
      testMode: isTestMode
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('결제 확인 오류:', error);
    res.status(500).json({ error: error.message || '결제 처리 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 테스트 결제 (테스트 모드 전용)
router.post('/test-payment', authMiddleware, async (req, res) => {
  if (!isTestMode) {
    return res.status(400).json({ error: '테스트 모드에서만 사용할 수 있습니다.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { months = 1, couponCode } = req.body;
    const userId = req.user.userId;
    const amount = SUBSCRIPTION_PRICE * months;
    const orderId = `TEST_${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 쿠폰 코드로 딜러 찾기
    let dealerId = null;
    if (couponCode) {
      const dealerResult = await client.query(
        'SELECT id FROM users WHERE coupon_code = $1 AND role = $2',
        [couponCode, 'dealer']
      );
      if (dealerResult.rows.length > 0) {
        dealerId = dealerResult.rows[0].id;
      }
    }

    // 결제 레코드 생성 및 완료 처리
    const paymentResult = await client.query(
      `INSERT INTO payments (user_id, order_id, amount, subscription_months, coupon_code, dealer_id, status, payment_key, payment_method, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, 'test', CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, orderId, amount, months, couponCode, dealerId, `TEST_KEY_${Date.now()}`]
    );

    const paymentId = paymentResult.rows[0].id;

    // 사용자 구독 상태 업데이트
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);

    await client.query(
      `UPDATE users SET subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`,
      [subscriptionEndDate, userId]
    );

    // 딜러 수수료 처리
    let commissionAmount = 0;
    if (dealerId) {
      commissionAmount = Math.floor(amount * DEALER_COMMISSION_RATE);

      await client.query(
        `INSERT INTO dealer_commissions (dealer_id, payment_id, customer_id, amount, commission_rate)
         VALUES ($1, $2, $3, $4, $5)`,
        [dealerId, paymentId, userId, commissionAmount, DEALER_COMMISSION_RATE * 100]
      );

      await client.query(
        'UPDATE payments SET dealer_commission = $1 WHERE id = $2',
        [commissionAmount, paymentId]
      );
    }

    await client.query('COMMIT');

    console.log(`🧪 테스트 결제 완료: ${orderId}, ${amount}원, 딜러 수수료: ${commissionAmount}원`);

    res.json({
      success: true,
      message: '테스트 결제가 완료되었습니다.',
      orderId,
      amount,
      subscriptionEndDate,
      dealerCommission: commissionAmount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('테스트 결제 오류:', error);
    res.status(500).json({ error: error.message || '테스트 결제 처리 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 결제 내역 조회
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, order_id, amount, status, subscription_months, payment_method, created_at, paid_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error('결제 내역 조회 오류:', error);
    res.status(500).json({ error: '결제 내역 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
