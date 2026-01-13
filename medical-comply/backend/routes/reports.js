const express = require('express');
const { query } = require('../config/database');
const { authMiddleware } = require('../middlewares/auth');
const { crawlWebsite } = require('../services/crawler');
const { analyzeViolations } = require('../services/analyzer');

const router = express.Router();

// 새 검사 요청
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    const userId = req.user.userId;

    if (!url) {
      return res.status(400).json({ error: 'URL을 입력해주세요.' });
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: '유효한 URL을 입력해주세요.' });
    }

    // 구독 상태 확인
    const userResult = await query(
      'SELECT subscription_status, subscription_end_date FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // 무료 사용자는 일일 1회 제한 (간단한 체크)
    if (user.subscription_status === 'free') {
      const todayReports = await query(
        `SELECT COUNT(*) FROM reports
         WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [userId]
      );

      if (parseInt(todayReports.rows[0].count) >= 1) {
        return res.status(403).json({
          error: '무료 사용자는 하루 1회만 검사할 수 있습니다. 구독하시면 무제한 검사가 가능합니다.'
        });
      }
    }

    // 리포트 생성 (pending 상태)
    const reportResult = await query(
      `INSERT INTO reports (user_id, url, status)
       VALUES ($1, $2, 'processing')
       RETURNING id, url, status, created_at`,
      [userId, url]
    );

    const report = reportResult.rows[0];

    // 비동기로 크롤링 및 분석 시작
    processReport(report.id, url).catch(err => {
      console.error('리포트 처리 오류:', err);
    });

    res.status(201).json({
      message: '검사가 시작되었습니다.',
      report
    });
  } catch (error) {
    console.error('검사 요청 오류:', error);
    res.status(500).json({ error: '검사 요청 중 오류가 발생했습니다.' });
  }
});

// 리포트 처리 함수
async function processReport(reportId, url) {
  try {
    // 1. 웹사이트 크롤링
    console.log(`크롤링 시작: ${url}`);
    const crawlData = await crawlWebsite(url);

    // 2. 위반 분석
    console.log(`분석 시작: ${url}`);
    const analysisResult = await analyzeViolations(crawlData);

    // 3. 위반 항목 저장
    for (const violation of analysisResult.violations) {
      await query(
        `INSERT INTO violations (report_id, category, severity, rule_code, rule_name, description, location, evidence, recommendation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reportId, violation.category, violation.severity, violation.ruleCode, violation.ruleName,
         violation.description, violation.location, violation.evidence, violation.recommendation]
      );
    }

    // 4. 리포트 업데이트
    await query(
      `UPDATE reports
       SET status = 'completed',
           total_score = $1,
           violation_count = $2,
           warning_count = $3,
           pass_count = $4,
           report_data = $5,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        analysisResult.score,
        analysisResult.violations.filter(v => v.severity === 'critical').length,
        analysisResult.violations.filter(v => v.severity === 'warning').length,
        analysisResult.passCount,
        JSON.stringify(analysisResult),
        reportId
      ]
    );

    console.log(`분석 완료: ${url}, 점수: ${analysisResult.score}`);
  } catch (error) {
    console.error(`리포트 처리 실패 (${reportId}):`, error);
    await query(
      `UPDATE reports SET status = 'failed', report_data = $1 WHERE id = $2`,
      [JSON.stringify({ error: error.message }), reportId]
    );
  }
}

// 리포트 목록 조회
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, url, status, total_score, violation_count, warning_count, created_at, completed_at
       FROM reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM reports WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('리포트 목록 조회 오류:', error);
    res.status(500).json({ error: '리포트 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 리포트 상세 조회
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const reportResult = await query(
      `SELECT * FROM reports WHERE id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: '리포트를 찾을 수 없습니다.' });
    }

    const violationsResult = await query(
      'SELECT * FROM violations WHERE report_id = $1 ORDER BY severity, created_at',
      [id]
    );

    res.json({
      report: reportResult.rows[0],
      violations: violationsResult.rows
    });
  } catch (error) {
    console.error('리포트 상세 조회 오류:', error);
    res.status(500).json({ error: '리포트 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
