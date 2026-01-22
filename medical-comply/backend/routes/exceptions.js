const express = require('express');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middlewares/auth');
const { getExceptionRules, reloadExceptionRules } = require('../services/analyzer');

const router = express.Router();

const EXCEPTION_RULES_PATH = path.join(__dirname, '../config/exception-rules.json');

/**
 * 예외사례집 전체 조회
 * GET /api/exceptions
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rules = getExceptionRules();
    if (!rules) {
      return res.status(500).json({ error: '예외사례집을 로드할 수 없습니다.' });
    }

    res.json({
      version: rules._meta.version,
      lastUpdated: rules._meta.lastUpdated,
      rules: Object.keys(rules).filter(k => k.startsWith('MED')).map(code => ({
        code,
        name: rules[code].name,
        allowedPatternsCount: rules[code].allowedPatterns?.length || 0,
        falsePositiveExamplesCount: rules[code].falsePositiveExamples?.length || 0
      }))
    });
  } catch (error) {
    console.error('예외사례 조회 오류:', error);
    res.status(500).json({ error: '예외사례 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * 특정 규칙의 예외사례 상세 조회
 * GET /api/exceptions/:ruleCode
 */
router.get('/:ruleCode', authMiddleware, async (req, res) => {
  try {
    const { ruleCode } = req.params;
    const rules = getExceptionRules();

    if (!rules) {
      return res.status(500).json({ error: '예외사례집을 로드할 수 없습니다.' });
    }

    const ruleException = rules[ruleCode.toUpperCase()];
    if (!ruleException) {
      return res.status(404).json({ error: `${ruleCode} 규칙을 찾을 수 없습니다.` });
    }

    res.json({
      code: ruleCode.toUpperCase(),
      ...ruleException
    });
  } catch (error) {
    console.error('예외사례 상세 조회 오류:', error);
    res.status(500).json({ error: '예외사례 상세 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * 오탐지 사례 추가
 * POST /api/exceptions/:ruleCode/false-positive
 */
router.post('/:ruleCode/false-positive', authMiddleware, async (req, res) => {
  try {
    const { ruleCode } = req.params;
    const { text, imageUrl, context, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: '사유(reason)는 필수입니다.' });
    }

    // 현재 예외사례집 읽기
    const data = fs.readFileSync(EXCEPTION_RULES_PATH, 'utf-8');
    const rules = JSON.parse(data);

    const code = ruleCode.toUpperCase();
    if (!rules[code]) {
      return res.status(404).json({ error: `${code} 규칙을 찾을 수 없습니다.` });
    }

    // 오탐지 사례 추가
    if (!rules[code].falsePositiveExamples) {
      rules[code].falsePositiveExamples = [];
    }

    const newExample = {
      addedAt: new Date().toISOString(),
      addedBy: req.user?.userId || 'system',
      reason
    };

    if (text) newExample.text = text;
    if (imageUrl) newExample.imageUrl = imageUrl;
    if (context) newExample.context = context;

    rules[code].falsePositiveExamples.push(newExample);

    // 메타데이터 업데이트
    rules._meta.lastUpdated = new Date().toISOString().split('T')[0];
    rules._meta.version = incrementVersion(rules._meta.version);

    // 파일 저장
    fs.writeFileSync(EXCEPTION_RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');

    // 메모리 리로드
    reloadExceptionRules();

    res.status(201).json({
      message: '오탐지 사례가 추가되었습니다.',
      ruleCode: code,
      newExample,
      newVersion: rules._meta.version
    });
  } catch (error) {
    console.error('오탐지 사례 추가 오류:', error);
    res.status(500).json({ error: '오탐지 사례 추가 중 오류가 발생했습니다.' });
  }
});

/**
 * 허용 패턴 추가
 * POST /api/exceptions/:ruleCode/allowed-pattern
 */
router.post('/:ruleCode/allowed-pattern', authMiddleware, async (req, res) => {
  try {
    const { ruleCode } = req.params;
    const { pattern, reason, example } = req.body;

    if (!pattern || !reason) {
      return res.status(400).json({ error: 'pattern과 reason은 필수입니다.' });
    }

    // 정규표현식 유효성 검사
    try {
      new RegExp(pattern, 'gi');
    } catch (e) {
      return res.status(400).json({ error: `유효하지 않은 정규표현식: ${e.message}` });
    }

    // 현재 예외사례집 읽기
    const data = fs.readFileSync(EXCEPTION_RULES_PATH, 'utf-8');
    const rules = JSON.parse(data);

    const code = ruleCode.toUpperCase();
    if (!rules[code]) {
      return res.status(404).json({ error: `${code} 규칙을 찾을 수 없습니다.` });
    }

    // 허용 패턴 추가
    if (!rules[code].allowedPatterns) {
      rules[code].allowedPatterns = [];
    }

    const newPattern = {
      pattern,
      reason,
      example: example || '',
      addedAt: new Date().toISOString(),
      addedBy: req.user?.userId || 'system'
    };

    rules[code].allowedPatterns.push(newPattern);

    // 메타데이터 업데이트
    rules._meta.lastUpdated = new Date().toISOString().split('T')[0];
    rules._meta.version = incrementVersion(rules._meta.version);

    // 파일 저장
    fs.writeFileSync(EXCEPTION_RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');

    // 메모리 리로드
    reloadExceptionRules();

    res.status(201).json({
      message: '허용 패턴이 추가되었습니다.',
      ruleCode: code,
      newPattern,
      newVersion: rules._meta.version
    });
  } catch (error) {
    console.error('허용 패턴 추가 오류:', error);
    res.status(500).json({ error: '허용 패턴 추가 중 오류가 발생했습니다.' });
  }
});

/**
 * 예외사례 삭제
 * DELETE /api/exceptions/:ruleCode/false-positive/:index
 */
router.delete('/:ruleCode/false-positive/:index', authMiddleware, async (req, res) => {
  try {
    const { ruleCode, index } = req.params;
    const idx = parseInt(index);

    const data = fs.readFileSync(EXCEPTION_RULES_PATH, 'utf-8');
    const rules = JSON.parse(data);

    const code = ruleCode.toUpperCase();
    if (!rules[code]?.falsePositiveExamples) {
      return res.status(404).json({ error: '해당 규칙의 오탐지 사례가 없습니다.' });
    }

    if (idx < 0 || idx >= rules[code].falsePositiveExamples.length) {
      return res.status(404).json({ error: '유효하지 않은 인덱스입니다.' });
    }

    const removed = rules[code].falsePositiveExamples.splice(idx, 1);

    // 메타데이터 업데이트
    rules._meta.lastUpdated = new Date().toISOString().split('T')[0];
    rules._meta.version = incrementVersion(rules._meta.version);

    fs.writeFileSync(EXCEPTION_RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');
    reloadExceptionRules();

    res.json({
      message: '오탐지 사례가 삭제되었습니다.',
      removed: removed[0]
    });
  } catch (error) {
    console.error('오탐지 사례 삭제 오류:', error);
    res.status(500).json({ error: '오탐지 사례 삭제 중 오류가 발생했습니다.' });
  }
});

/**
 * 허용 패턴 삭제
 * DELETE /api/exceptions/:ruleCode/allowed-pattern/:index
 */
router.delete('/:ruleCode/allowed-pattern/:index', authMiddleware, async (req, res) => {
  try {
    const { ruleCode, index } = req.params;
    const idx = parseInt(index);

    const data = fs.readFileSync(EXCEPTION_RULES_PATH, 'utf-8');
    const rules = JSON.parse(data);

    const code = ruleCode.toUpperCase();
    if (!rules[code]?.allowedPatterns) {
      return res.status(404).json({ error: '해당 규칙의 허용 패턴이 없습니다.' });
    }

    if (idx < 0 || idx >= rules[code].allowedPatterns.length) {
      return res.status(404).json({ error: '유효하지 않은 인덱스입니다.' });
    }

    const removed = rules[code].allowedPatterns.splice(idx, 1);

    rules._meta.lastUpdated = new Date().toISOString().split('T')[0];
    rules._meta.version = incrementVersion(rules._meta.version);

    fs.writeFileSync(EXCEPTION_RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');
    reloadExceptionRules();

    res.json({
      message: '허용 패턴이 삭제되었습니다.',
      removed: removed[0]
    });
  } catch (error) {
    console.error('허용 패턴 삭제 오류:', error);
    res.status(500).json({ error: '허용 패턴 삭제 중 오류가 발생했습니다.' });
  }
});

/**
 * 예외사례집 리로드
 * POST /api/exceptions/reload
 */
router.post('/reload', authMiddleware, async (req, res) => {
  try {
    const rules = reloadExceptionRules();
    if (!rules) {
      return res.status(500).json({ error: '예외사례집 리로드 실패' });
    }

    res.json({
      message: '예외사례집이 리로드되었습니다.',
      version: rules._meta.version,
      lastUpdated: rules._meta.lastUpdated
    });
  } catch (error) {
    console.error('예외사례집 리로드 오류:', error);
    res.status(500).json({ error: '예외사례집 리로드 중 오류가 발생했습니다.' });
  }
});

/**
 * 버전 증가 (1.0.0 -> 1.0.1)
 */
function incrementVersion(version) {
  const parts = version.split('.');
  parts[2] = parseInt(parts[2]) + 1;
  return parts.join('.');
}

module.exports = router;
