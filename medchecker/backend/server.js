/**
 * MEDCHECKER 데모 서버
 * 
 * Express 기반 API 서버 + 데모 페이지
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const AnalyzerService = require('./services/analyzer-service');
const HtmlMarker = require('./services/html-marker');
const { stats: ruleStats } = require('./rules');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Analyzer Service 초기화
const analyzer = new AnalyzerService({
  enableAI: true,
  debug: true,  // 디버그 모드 활성화
});

// HTML Marker 초기화
const htmlMarker = new HtmlMarker({
  debug: true,
});

// ============================================
// API Routes
// ============================================

// 규칙 통계
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      medicalAdRules: ruleStats.medicalAd.total,
      viralMonitoringRules: ruleStats.viralMonitoring.total,
      totalRules: ruleStats.medicalAd.total + ruleStats.viralMonitoring.total,
      categories: ruleStats.medicalAd.byCategory,
      severities: ruleStats.medicalAd.bySeverity,
    },
    aiProviders: analyzer.aiManager.getAvailableProviders(),
  });
});

// 텍스트 분석 API
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, enableAI = false } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '분석할 텍스트를 입력해주세요.',
      });
    }

    const result = await analyzer.analyzeText(text, {
      analysisTypes: ['medical_ad'],
      enableAI,
    });

    const report = analyzer.formatReport(result);

    res.json({
      success: true,
      result: report,
      raw: result,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// URL 정규화 헬퍼 함수
function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  
  // 이미 프로토콜이 있으면 그대로 반환
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 프로토콜이 없으면 https:// 추가
  return 'https://' + url;
}

// URL 분석 API (스크린샷 캡처 포함)
app.post('/api/analyze-url', async (req, res) => {
  try {
    let { url, enableAI = false, captureScreenshots = true } = req.body;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URL을 입력해주세요.',
      });
    }
    
    // URL 정규화 (http:// 자동 추가)
    url = normalizeUrl(url);

    // 스크린샷 포함 분석 사용
    const result = await analyzer.analyzeWebsiteWithScreenshots(url, {
      analysisTypes: ['medical_ad'],
      enableAI,
      captureScreenshots,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const report = analyzer.formatReport(result, {
      includeScreenshots: captureScreenshots,
    });

    // violations와 warnings에 sourceUrl 추가
    const addSourceUrl = (items) => items.map(item => ({
      ...item,
      sourceUrl: url,
    }));

    // 분석 로그 추가 및 SSE 브로드캐스트
    const logEntry = {
      url,
      title: result.metadata?.title,
      totalScore: result.totalScore,
      riskLevel: result.riskLevel,
      violationsCount: result.violations?.length || 0,
      warningsCount: result.warnings?.length || 0,
      errorCollectorStats: result.errorCollectorStats,
      processingTimeMs: result.processingTimeMs,
    };
    addAnalysisLog(logEntry);
    broadcastToSSE({ type: 'analysis', data: logEntry });

    res.json({
      success: true,
      url,
      metadata: result.metadata,
      result: report,
      raw: {
        ...result,
        violations: addSourceUrl(result.violations || []),
        warnings: addSourceUrl(result.warnings || []),
      },
      errorCollectorStats: result.errorCollectorStats,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    console.error('URL Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 상세 분석 API (디버그 모드) - 분석 과정 상세 표시
app.post('/api/analyze-url-debug', async (req, res) => {
  try {
    const { url, enableAI = false } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: '올바른 URL을 입력해주세요.',
      });
    }

    // 1. 웹사이트 크롤링
    const crawlStart = Date.now();
    let crawledContent;
    try {
      crawledContent = await analyzer.crawlWebsite(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: '웹사이트 크롤링 실패',
        detail: error.message,
      });
    }
    const crawlTime = Date.now() - crawlStart;

    // 2. 규칙 기반 분석 (raw 결과 포함)
    const analysisStart = Date.now();
    const rawResult = await analyzer.ruleEngine.analyze(crawledContent.textContent, {
      categories: ['medical_ad'],
      skipAI: !enableAI,
      targetUrl: url,
      targetType: 'website',
    });
    const analysisTime = Date.now() - analysisStart;

    // 3. 리포트 생성
    const report = analyzer.formatReport(rawResult);

    // 4. 디버그 정보 포함하여 응답
    res.json({
      success: true,
      url,
      
      // 메타 정보
      metadata: {
        title: crawledContent.title,
        description: crawledContent.description,
      },
      
      // 분석 결과 요약
      result: report,
      
      // 디버그 정보
      debug: {
        // 크롤링 정보
        crawling: {
          timeMs: crawlTime,
          textLength: crawledContent.textContent.length,
          // 텍스트 미리보기 (처음 2000자)
          textPreview: crawledContent.textContent.substring(0, 2000),
          // 전체 텍스트 (디버그용)
          fullText: crawledContent.textContent,
        },
        
        // 분석 과정 상세
        analysis: {
          timeMs: analysisTime,
          totalRulesChecked: rawResult.passed.length + rawResult.violations.length + rawResult.warnings.length,
          
          // 통과한 규칙들
          passedRules: rawResult.passed.map(p => ({
            ruleId: p.ruleId,
            ruleName: p.ruleName,
          })),
          
          // 위반 상세 (raw 데이터)
          violations: rawResult.violations.map(v => ({
            ruleId: v.ruleId,
            ruleName: v.ruleName,
            severity: v.severity,
            matchedText: v.matchedText,
            contextWindow: v.contextWindow,
            confidence: v.confidence,
            contextScores: v.contextScores,
            evidence: v.evidence,
          })),
          
          // 경고 상세 (raw 데이터)
          warnings: rawResult.warnings.map(w => ({
            ruleId: w.ruleId,
            ruleName: w.ruleName,
            severity: w.severity,
            matchedText: w.matchedText,
            contextWindow: w.contextWindow,
            confidence: w.confidence,
            contextScores: w.contextScores,
            evidence: w.evidence,
          })),
        },
        
        // 점수 계산 과정
        scoring: {
          initialScore: 100,
          deductions: rawResult.violations.map(v => ({
            rule: v.ruleName,
            deduction: v.riskScore || 10,
          })),
          warningDeductions: rawResult.warnings.map(w => ({
            rule: w.ruleName,
            deduction: Math.floor((w.riskScore || 10) / 2),
          })),
          finalScore: rawResult.totalScore,
          riskLevel: rawResult.riskLevel,
        },
      },
      
      processingTimeMs: crawlTime + analysisTime,
    });
  } catch (error) {
    console.error('Debug Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// 디버그 페이지
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// 프록시 뷰어 페이지
app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'proxy-viewer.html'));
});

// 프록시 뷰어 API - 위반 마킹된 HTML 반환
app.get('/api/proxy-view', async (req, res) => {
  try {
    const { url, violations: violationsJson } = req.query;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: '올바른 URL을 입력해주세요.',
      });
    }

    // violations 파라미터 파싱
    let violations = [];
    if (violationsJson) {
      try {
        violations = JSON.parse(decodeURIComponent(violationsJson));
      } catch (e) {
        console.error('violations JSON 파싱 실패:', e);
      }
    }

    // violations가 없으면 분석 수행
    if (violations.length === 0) {
      const analysisResult = await analyzer.analyzeWebsite(url, {
        analysisTypes: ['medical_ad'],
        enableAI: false,
      });

      if (analysisResult.success) {
        violations = [
          ...(analysisResult.violations || []),
          ...(analysisResult.warnings || []),
        ];
      }
    }

    // 원본 HTML 가져오기
    const axios = require('axios');
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      responseType: 'text',
    });

    // HTML에 위반 마킹 추가
    const markedHtml = htmlMarker.markViolations(response.data, violations, url);

    // HTML 반환
    res.type('html').send(markedHtml);

  } catch (error) {
    console.error('Proxy view error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>오류</title></head>
      <body style="font-family: sans-serif; padding: 40px; background: #1a1a2e; color: #fff;">
        <h1 style="color: #ef4444;">페이지 로드 실패</h1>
        <p>${error.message}</p>
        <p style="color: #64748b;">일부 웹사이트는 외부 접근을 차단할 수 있습니다.</p>
      </body>
      </html>
    `);
  }
});

// 분석 + 프록시 뷰어 조합 API (분석 후 바로 뷰어용 데이터 반환)
app.post('/api/analyze-with-viewer', async (req, res) => {
  try {
    const { url, enableAI = false } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: '올바른 URL을 입력해주세요.',
      });
    }

    // 분석 수행
    const result = await analyzer.analyzeWebsite(url, {
      analysisTypes: ['medical_ad'],
      enableAI,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const allViolations = [
      ...(result.violations || []),
      ...(result.warnings || []),
    ];

    // 뷰어 URL 생성
    const violationsParam = encodeURIComponent(JSON.stringify(
      allViolations.map(v => ({
        matchedText: v.matchedText,
        severity: v.severity,
        ruleId: v.ruleId,
        ruleName: v.ruleName,
      }))
    ));
    
    const viewerUrl = `/api/proxy-view?url=${encodeURIComponent(url)}&violations=${violationsParam}`;

    const report = analyzer.formatReport(result);

    res.json({
      success: true,
      url,
      metadata: result.metadata,
      result: report,
      raw: {
        ...result,
        violations: (result.violations || []).map(v => ({ ...v, sourceUrl: url })),
        warnings: (result.warnings || []).map(v => ({ ...v, sourceUrl: url })),
      },
      viewerUrl,
      processingTimeMs: result.processingTimeMs,
    });

  } catch (error) {
    console.error('Analyze with viewer error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// 오탐 수집 및 진단 API
// ============================================

// 오탐 수집 현황 리포트
app.get('/api/error-collector/report', (req, res) => {
  try {
    const report = analyzer.getErrorCollectorReport();
    res.json({
      success: true,
      report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 오탐 피드백 등록
app.post('/api/error-collector/feedback', (req, res) => {
  try {
    const { matchedText, ruleId, ruleName, reason, url } = req.body;
    
    if (!matchedText || !ruleId) {
      return res.status(400).json({
        success: false,
        error: 'matchedText와 ruleId가 필요합니다.',
      });
    }
    
    analyzer.recordFalsePositiveFeedback(
      { matchedText, ruleId, ruleName },
      reason || 'user_feedback',
      url
    );
    
    res.json({
      success: true,
      message: '피드백이 등록되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 학습된 패턴 목록
app.get('/api/error-collector/patterns', (req, res) => {
  try {
    const patterns = analyzer.errorCollector.exportPatterns();
    res.json({
      success: true,
      patterns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 오탐 히스토리 조회
app.get('/api/error-collector/history', (req, res) => {
  try {
    const { limit = 100, domain, ruleId, reason } = req.query;
    let history = analyzer.errorCollector.fpHistory || [];
    
    // 필터링
    if (domain) {
      history = history.filter(h => h.domain === domain);
    }
    if (ruleId) {
      history = history.filter(h => h.ruleId === ruleId);
    }
    if (reason) {
      history = history.filter(h => h.reason === reason);
    }
    
    // 최신순 정렬 및 제한
    history = history.slice(-parseInt(limit)).reverse();
    
    // 통계 계산
    const allHistory = analyzer.errorCollector.fpHistory || [];
    const stats = {
      total: allHistory.length,
      byDomain: {},
      byRule: {},
      byReason: {},
    };
    
    for (const h of allHistory) {
      if (h.domain) {
        stats.byDomain[h.domain] = (stats.byDomain[h.domain] || 0) + 1;
      }
      if (h.ruleId) {
        stats.byRule[h.ruleId] = (stats.byRule[h.ruleId] || 0) + 1;
      }
      if (h.reason) {
        stats.byReason[h.reason] = (stats.byReason[h.reason] || 0) + 1;
      }
    }
    
    res.json({
      success: true,
      history,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 실시간 분석 로그 (SSE - Server Sent Events)
const analysisLogs = [];
const MAX_LOGS = 100;

function addAnalysisLog(log) {
  analysisLogs.unshift({
    ...log,
    timestamp: new Date().toISOString(),
  });
  if (analysisLogs.length > MAX_LOGS) {
    analysisLogs.pop();
  }
}

app.get('/api/error-collector/logs', (req, res) => {
  res.json({
    success: true,
    logs: analysisLogs,
  });
});

// SSE 엔드포인트 (실시간 업데이트)
const sseClients = new Set();

app.get('/api/error-collector/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  sseClients.add(res);
  
  // 연결 시 현재 상태 전송
  const report = analyzer.getErrorCollectorReport();
  res.write(`data: ${JSON.stringify({ type: 'init', report })}\n\n`);
  
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// SSE 브로드캐스트 함수
function broadcastToSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    client.write(message);
  });
}

// 분석 완료 시 로그 추가 및 브로드캐스트 (기존 analyze-url 수정)
const originalAnalyzeUrl = app._router.stack.find(r => r.route?.path === '/api/analyze-url');

// 샘플 데이터 API
app.get('/api/samples', (req, res) => {
  const samples = [
    {
      name: '적법한 피부과 광고',
      text: `○○피부과

피부 전문의 2인 진료

[진료 안내]
- 여드름/흉터 치료
- 기미/잡티 레이저
- 보톡스/필러
- 리프팅 시술

FDA 승인 레이저 장비 보유
2023년 대한피부과학회 정회원

시술 후 개인에 따라 결과가 다를 수 있습니다.
부작용이 발생할 수 있으니 전문의와 상담하세요.

진료시간: 평일 10:00-19:00 / 토요일 10:00-14:00

* 비급여 항목입니다. 자세한 비용은 상담 시 안내드립니다.`,
      expected: '위반 없음 (적법한 광고)',
    },
    {
      name: '문제 있는 성형외과 광고',
      text: `○○성형외과에 오신 것을 환영합니다.

국내 최고의 성형외과! 대한민국 No.1 성형전문 클리닉

15년 경력의 전문의가 직접 상담부터 수술까지 책임집니다.

[이벤트]
지금 예약하시면 50% 특별 할인!
선착순 20명 한정! 이번 달만!

전후사진을 확인하세요! 놀라운 변화!

100% 만족 보장! 재수술 걱정 없는 완벽한 결과!

유명 연예인들도 찾는 병원!`,
      expected: '여러 위반 감지 예상 (최상급 표현, 전후사진, 효과 보장 등)',
    },
    {
      name: '심각한 위반 - 치과 광고',
      text: `○○치과

무통 임플란트! 전혀 안 아픈 시술!

임플란트 성공률 99.9%!
10년 보증! 재시술 걱정 NO!

[특별 이벤트]
임플란트 1+1 이벤트!
지금 상담하면 80% 할인!
마감 임박! 놓치면 후회!

최첨단 3D CT 보유
국내 최초 도입 독일산 임플란트

원장 프로필:
- 신의 손을 가진 명의
- 30년 경력 임플란트 전문의
- 10만 케이스 이상 시술`,
      expected: '다수의 심각한 위반 감지 예상',
    },
    {
      name: '미승인 시술 광고',
      text: `줄기세포 주사로 관절 통증을 완벽하게 해결!
면역세포 치료로 암도 완치!

해외에서 인정받은 최신 기술!
국내 최초 도입!

부작용 전혀 없이 안전하게!
100% 완치 보장!`,
      expected: '미승인 시술 + 효과 보장 위반 감지 예상',
    },
  ];

  res.json({
    success: true,
    samples,
  });
});

// 데모 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              MEDCHECKER 데모 서버 시작                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 규칙 현황:');
  console.log(`   - 의료광고 규칙: ${ruleStats.medicalAd.total}개`);
  console.log(`   - 바이럴 모니터링 규칙: ${ruleStats.viralMonitoring.total}개`);
  console.log('');
  console.log('🔗 API 엔드포인트:');
  console.log('   - GET  /api/stats    - 규칙 통계');
  console.log('   - GET  /api/samples  - 샘플 데이터');
  console.log('   - POST /api/analyze  - 텍스트 분석');
  console.log('   - POST /api/analyze-url - URL 분석');
  console.log('');
});
