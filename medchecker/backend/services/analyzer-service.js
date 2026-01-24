/**
 * MEDCHECKER 통합 분석 서비스
 * 
 * 문맥 기반 규칙 엔진 + AI 검증을 결합한 고정밀 분석
 * 
 * 분석 흐름:
 * 1. 콘텐츠 수집 (크롤링/API)
 * 2. 규칙 기반 1차 분석 (문맥 고려)
 * 3. 불확실한 케이스 AI 검증 (Gemini)
 * 4. 복잡한 케이스 정밀 분석 (Claude, 선택적)
 * 5. 결과 종합 및 리포트 생성
 */

const RuleEngine = require('./rule-engine');
const { AIProviderManager } = require('./ai-providers');
const ScreenshotCapturer = require('./screenshot-capturer');
const HtmlContextAnalyzer = require('./html-context-analyzer');
const ErrorCollector = require('./error-collector');
const ImageOCR = require('./image-ocr');
const { 
  activeMedicalAdRules, 
  activeViralRules,
  stats: ruleStats 
} = require('../rules');

// 가이드라인 데이터 로드
let officialGuidelines = null;
let legalCases = null;
try {
  officialGuidelines = require('../data/official-guidelines').officialGuidelines;
  legalCases = require('../data/legal-cases');
} catch (e) {
  console.warn('[AnalyzerService] 가이드라인/판례 데이터 로드 실패');
}

class AnalyzerService {
  constructor(config = {}) {
    // 규칙 엔진 초기화
    this.ruleEngine = new RuleEngine({
      enableAI: config.enableAI !== false,
      debug: config.debug || false,
    });

    // AI Provider 초기화
    this.aiManager = new AIProviderManager({
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      claudeApiKey: config.claudeApiKey || process.env.ANTHROPIC_API_KEY,
    });

    // 규칙 엔진에 AI Provider 연결
    this.ruleEngine.aiProviders = {
      gemini: {
        analyze: async (prompt) => this.aiManager.analyze(prompt, { preferredProvider: 'gemini' }),
      },
      claude: {
        analyze: async (prompt) => this.aiManager.analyze(prompt, { preferredProvider: 'claude' }),
      },
    };

    // 규칙 로드
    this.loadAllRules();

    // 스크린샷 캡처 서비스 초기화
    this.screenshotCapturer = new ScreenshotCapturer({
      headless: config.headless !== false,
      debug: config.debug || false,
    });

    // HTML 컨텍스트 분석기 초기화
    this.htmlContextAnalyzer = new HtmlContextAnalyzer({
      debug: config.debug || false,
    });

    // 오탐 자동 수집기 초기화
    this.errorCollector = new ErrorCollector({
      debug: config.debug || false,
      aiProviders: this.ruleEngine.aiProviders,
    });

    // 이미지 OCR 초기화
    this.imageOcr = new ImageOCR({
      apiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      model: config.ocrModel || 'gemini-2.0-flash',
      debug: config.debug || false,
    });

    console.log('[AnalyzerService] 초기화 완료');
    console.log(`  - 의료광고 규칙: ${ruleStats.medicalAd.total}개`);
    console.log(`  - 바이럴 모니터링 규칙: ${ruleStats.viralMonitoring.total}개`);
    console.log(`  - AI Providers: ${this.aiManager.getAvailableProviders().join(', ')}`);
    console.log(`  - 스크린샷 캡처: ${this.screenshotCapturer.isAvailable ? '활성화' : '비활성화 (Playwright 미설치)'}`);
  }

  /**
   * 모든 규칙 로드
   */
  loadAllRules() {
    const allRules = [
      ...activeMedicalAdRules,
      // 바이럴 모니터링 규칙은 별도 엔진에서 처리 (구조가 다름)
      // TODO: SEO/AEO 규칙 추가
    ];

    this.ruleEngine.loadRules(allRules);
    
    // 바이럴 규칙 저장 (별도 처리용)
    this.viralRules = activeViralRules;
  }

  /**
   * 웹사이트 분석
   */
  async analyzeWebsite(url, options = {}) {
    const {
      analysisTypes = ['medical_ad'],  // 분석 유형
      enableAI = true,                  // AI 사용 여부
      enableImageOcr = true,            // 이미지 OCR 사용 여부
      crawlOptions = {},                // 크롤링 옵션
      ocrOptions = {},                  // OCR 옵션
    } = options;

    const startTime = Date.now();

    // 1. 콘텐츠 크롤링
    let content;
    try {
      content = await this.crawlWebsite(url, crawlOptions);
    } catch (error) {
      return {
        success: false,
        error: '웹사이트 크롤링 실패',
        detail: error.message,
      };
    }

    // 2. 이미지 OCR (배너, 이벤트 이미지에서 텍스트 추출)
    let ocrResult = null;
    if (enableImageOcr) {
      try {
        ocrResult = await this.imageOcr.extractTextFromHtml(content.html, url, {
          maxImages: ocrOptions.maxImages || 5,
          ...ocrOptions,
        });
        
        if (ocrResult.combinedText) {
          // OCR로 추출된 텍스트를 본문에 추가
          content.textContent += '\n\n[이미지 텍스트]\n' + ocrResult.combinedText;
          console.log(`[AnalyzerService] 이미지 OCR 완료: ${ocrResult.successfulOcr}개 이미지에서 ${ocrResult.totalWords}단어 추출`);
        }
      } catch (error) {
        console.warn('[AnalyzerService] 이미지 OCR 실패:', error.message);
      }
    }

    // 3. HTML 구조 분석 (메뉴/네비게이션 컨텍스트 추출)
    let htmlContext = null;
    try {
      htmlContext = this.htmlContextAnalyzer.analyzeHtml(content.html);
      console.log('[AnalyzerService] HTML 컨텍스트 분석 완료:', {
        menuTexts: htmlContext.stats.menuTextsCount,
        footerTexts: htmlContext.stats.footerTextsCount,
        hasLoginProtection: htmlContext.hasLoginProtection,
      });
    } catch (error) {
      console.warn('[AnalyzerService] HTML 컨텍스트 분석 실패:', error.message);
    }

    // 4. 규칙 기반 분석 (HTML 컨텍스트 전달)
    const analysisResult = await this.ruleEngine.analyze(content.textContent, {
      categories: analysisTypes,
      skipAI: !enableAI,
      targetUrl: url,
      targetType: 'website',
      htmlContext,  // HTML 컨텍스트 전달
    });

    // 5. HTML 컨텍스트 기반 후처리 필터링
    if (htmlContext) {
      this.postFilterByHtmlContext(analysisResult, htmlContext);
    }

    // 6. 오탐 자동 수집 및 검증
    let errorCollectorResult = null;
    try {
      errorCollectorResult = await this.errorCollector.verifyResults(analysisResult, {
        url,
        html: content.html,
        htmlContext,
        enableAIVerification: options.enableAIVerification !== false,
      });
      
      // 오탐으로 판정된 항목 제거
      if (errorCollectorResult.falsePositives.length > 0) {
        analysisResult.violations = errorCollectorResult.verifiedViolations.filter(v => v.type !== 'warning');
        analysisResult.warnings = [
          ...errorCollectorResult.verifiedWarnings,
          ...errorCollectorResult.verifiedViolations.filter(v => v.type === 'warning'),
        ];
        
        // 점수 재계산 - 100점에서 시작하여 남은 violations/warnings 점수 차감
        let recalculatedScore = 100;
        
        // 남은 violations 점수 차감
        for (const v of analysisResult.violations) {
          recalculatedScore -= (v.riskScore || 10);
        }
        
        // 남은 warnings 점수 차감 (절반)
        for (const w of analysisResult.warnings) {
          recalculatedScore -= Math.floor((w.riskScore || 10) / 2);
        }
        
        analysisResult.totalScore = Math.max(0, recalculatedScore);
        analysisResult.riskLevel = this.recalculateRiskLevel(analysisResult);
      }
    } catch (error) {
      console.warn('[AnalyzerService] 오탐 수집 실패:', error.message);
    }

    // 7. 결과 종합
    return {
      success: true,
      url,
      analyzedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      
      // 메타 정보
      metadata: {
        title: content.title,
        description: content.description,
      },
      
      // 분석 결과
      ...analysisResult,
      
      // 필터링 통계
      filterStats: analysisResult.filterStats,
      
      // 오탐 수집 결과
      errorCollectorStats: errorCollectorResult ? {
        autoFiltered: errorCollectorResult.autoFiltered,
        aiVerified: errorCollectorResult.aiVerified,
        falsePositivesFound: errorCollectorResult.falsePositives.length,
        falsePositives: errorCollectorResult.falsePositives.map(fp => ({
          matchedText: fp.matchedText,
          ruleId: fp.ruleId,
          reason: fp.fpReason,
          source: fp.fpSource,
        })),
      } : null,
      
      // 이미지 OCR 결과
      ocrStats: ocrResult ? {
        totalImages: ocrResult.totalImages,
        processedImages: ocrResult.processedImages,
        successfulOcr: ocrResult.successfulOcr,
        totalWords: ocrResult.totalWords,
        extractedTexts: ocrResult.extractedTexts?.map(t => ({
          imageUrl: t.imageUrl,
          preview: t.text?.substring(0, 100) + (t.text?.length > 100 ? '...' : ''),
          wordCount: t.wordCount,
        })),
      } : null,
      
      // AI 사용 통계
      aiStats: this.aiManager.getStats(),
      ocrApiStats: this.imageOcr.getStats(),
    };
  }

  /**
   * 오탐 수집기 진단 리포트 가져오기
   */
  getErrorCollectorReport() {
    return this.errorCollector.generateDiagnosticReport();
  }

  /**
   * 사용자 오탐 피드백 기록
   */
  recordFalsePositiveFeedback(item, reason, url) {
    const domain = this.errorCollector.extractDomain(url);
    this.errorCollector.recordUserFeedback(item, true, reason, domain);
  }

  /**
   * HTML 컨텍스트 기반 후처리 필터링
   * 메뉴명, 로그인 보호 콘텐츠 등 오탐 제거
   */
  postFilterByHtmlContext(analysisResult, htmlContext) {
    const filterStats = {
      violationsFiltered: 0,
      warningsFiltered: 0,
      filterReasons: [],
    };

    // 위반 항목 필터링
    const originalViolations = analysisResult.violations || [];
    analysisResult.violations = originalViolations.filter(v => {
      const filterResult = this.shouldFilterByContext(v, htmlContext);
      if (filterResult.shouldFilter) {
        filterStats.violationsFiltered++;
        filterStats.filterReasons.push({
          ruleId: v.ruleId,
          matchedText: v.matchedText,
          reason: filterResult.reason,
        });
        // 점수 복원
        analysisResult.totalScore = Math.min(100, analysisResult.totalScore + (v.riskScore || 10));
        return false;
      }
      return true;
    });

    // 경고 항목 필터링
    const originalWarnings = analysisResult.warnings || [];
    analysisResult.warnings = originalWarnings.filter(w => {
      const filterResult = this.shouldFilterByContext(w, htmlContext);
      if (filterResult.shouldFilter) {
        filterStats.warningsFiltered++;
        filterStats.filterReasons.push({
          ruleId: w.ruleId,
          matchedText: w.matchedText,
          reason: filterResult.reason,
        });
        // 점수 복원
        analysisResult.totalScore = Math.min(100, analysisResult.totalScore + Math.floor((w.riskScore || 10) / 2));
        return false;
      }
      return true;
    });

    // 위험도 재계산
    analysisResult.riskLevel = this.recalculateRiskLevel(analysisResult);
    analysisResult.filterStats = filterStats;

    if (filterStats.violationsFiltered > 0 || filterStats.warningsFiltered > 0) {
      console.log('[AnalyzerService] 컨텍스트 기반 필터링 적용:', filterStats);
    }
  }

  /**
   * 항목이 필터링되어야 하는지 판단
   */
  shouldFilterByContext(item, htmlContext) {
    const matchedText = item.matchedText?.trim();
    if (!matchedText) return { shouldFilter: false };

    // 1. 메뉴 텍스트 체크 (정확히 일치)
    if (htmlContext.menuTexts.has(matchedText)) {
      return { 
        shouldFilter: true, 
        reason: 'menu_text_exact_match',
        detail: `"${matchedText}"는 메뉴/네비게이션 텍스트입니다.`,
      };
    }

    // 2. 로그인 보호 콘텐츠 체크
    if (htmlContext.loginProtectedTexts.has(matchedText)) {
      return {
        shouldFilter: true,
        reason: 'login_protected_content',
        detail: `"${matchedText}"는 로그인 보호 영역의 콘텐츠입니다.`,
      };
    }

    // 3. 메뉴 텍스트 부분 일치 체크
    for (const menuText of htmlContext.menuTexts) {
      // 매칭된 텍스트가 메뉴 텍스트의 일부이거나 그 반대인 경우
      if (menuText.includes(matchedText) && matchedText.length <= 10) {
        return {
          shouldFilter: true,
          reason: 'menu_text_partial_match',
          detail: `"${matchedText}"는 메뉴 "${menuText}"의 일부입니다.`,
        };
      }
    }

    // 4. HTML 컨텍스트 분석기의 isAdContext 사용
    const adContext = this.htmlContextAnalyzer.isAdContext(matchedText, htmlContext);
    if (!adContext.isAd && adContext.confidence > 0.8) {
      return {
        shouldFilter: true,
        reason: adContext.reason,
        detail: `"${matchedText}"는 ${adContext.reason} 컨텍스트입니다. (신뢰도: ${(adContext.confidence * 100).toFixed(0)}%)`,
      };
    }

    // 5. 로그인 보호가 있고, "후기" 관련 키워드인 경우
    if (htmlContext.hasLoginProtection) {
      const reviewKeywords = ['후기', '리뷰', '체험', '경험담', '전후', '비포', '애프터'];
      const lowerText = matchedText.toLowerCase();
      if (reviewKeywords.some(kw => lowerText.includes(kw))) {
        // 메뉴명 패턴인지 추가 확인
        if (this.htmlContextAnalyzer.isLikelyMenuText(matchedText)) {
          return {
            shouldFilter: true,
            reason: 'review_menu_with_login_protection',
            detail: `"${matchedText}"는 로그인 보호된 사이트의 메뉴명입니다.`,
          };
        }
      }
    }

    return { shouldFilter: false };
  }

  /**
   * 위험도 재계산
   */
  recalculateRiskLevel(results) {
    const criticalCount = (results.violations || []).filter(v => v.severity === 'critical').length;
    const warningCount = ((results.violations || []).filter(v => v.severity === 'warning').length) + 
                         (results.warnings || []).length;

    if (criticalCount >= 2 || results.totalScore < 50) {
      return 'high';
    } else if (criticalCount >= 1 || warningCount >= 3 || results.totalScore < 70) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 텍스트 직접 분석 (바이럴 모니터링용)
   */
  async analyzeText(text, options = {}) {
    const {
      analysisTypes = ['medical_ad', 'viral'],
      enableAI = true,
      sourceUrl = null,
      sourceType = 'text',
    } = options;

    const startTime = Date.now();

    // 규칙 기반 분석
    const analysisResult = await this.ruleEngine.analyze(text, {
      categories: analysisTypes,
      skipAI: !enableAI,
      targetUrl: sourceUrl,
      targetType: sourceType,
    });

    return {
      success: true,
      sourceUrl,
      sourceType,
      analyzedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      ...analysisResult,
      aiStats: this.aiManager.getStats(),
    };
  }

  /**
   * 바이럴 콘텐츠 배치 분석 (네이버 검색 결과 등)
   */
  async analyzeViralContents(contents, options = {}) {
    const {
      analysisTypes = ['medical_ad', 'viral'],
      enableAI = true,
      concurrency = 5,
    } = options;

    const startTime = Date.now();
    const results = [];

    // 병렬 처리 (동시 실행 제한)
    for (let i = 0; i < contents.length; i += concurrency) {
      const batch = contents.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (content) => {
          try {
            const text = `${content.title || ''} ${content.description || ''}`;
            const result = await this.ruleEngine.analyze(text, {
              categories: analysisTypes,
              skipAI: !enableAI,
              targetUrl: content.url,
              targetType: content.platform || 'social',
            });

            return {
              ...content,
              analysis: result,
            };
          } catch (error) {
            return {
              ...content,
              analysis: {
                success: false,
                error: error.message,
              },
            };
          }
        })
      );
      results.push(...batchResults);
    }

    // 통계 계산
    const stats = this.calculateBatchStats(results);

    return {
      success: true,
      totalItems: contents.length,
      analyzedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      stats,
      items: results,
      aiStats: this.aiManager.getStats(),
    };
  }

  /**
   * 배치 분석 통계 계산
   */
  calculateBatchStats(results) {
    const stats = {
      totalAnalyzed: results.length,
      violationsCount: 0,
      warningsCount: 0,
      passedCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      violationsByCategory: {},
      averageScore: 0,
    };

    let totalScore = 0;

    for (const result of results) {
      const analysis = result.analysis;
      if (!analysis || !analysis.success === false) continue;

      totalScore += analysis.totalScore || 0;
      stats.violationsCount += (analysis.violations || []).length;
      stats.warningsCount += (analysis.warnings || []).length;
      stats.passedCount += (analysis.passed || []).length;

      // 위험도별 카운트
      switch (analysis.riskLevel) {
        case 'high': stats.highRiskCount++; break;
        case 'medium': stats.mediumRiskCount++; break;
        case 'low': stats.lowRiskCount++; break;
      }

      // 카테고리별 위반 카운트
      for (const violation of (analysis.violations || [])) {
        const cat = violation.subcategory || violation.category;
        stats.violationsByCategory[cat] = (stats.violationsByCategory[cat] || 0) + 1;
      }
    }

    stats.averageScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

    return stats;
  }

  /**
   * 간단한 웹 크롤링 (Axios 기반)
   */
  async crawlWebsite(url, options = {}) {
    const axios = require('axios');
    const https = require('https');
    const http = require('http');
    const cheerio = require('cheerio');

    // SSL 인증서 검증 비활성화 (self-signed 인증서 지원)
    // 반드시 axios 호출 전에 설정
    const originalTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
      });
      
      const httpAgent = new http.Agent({
        keepAlive: true,
      });

      const response = await axios.get(url, {
        timeout: options.timeout || 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        httpsAgent,
        httpAgent,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

      // 불필요한 요소 제거
      $('script, style, noscript, iframe').remove();

      return {
        url,
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        textContent: $('body').text().replace(/\s+/g, ' ').trim(),
        html: response.data,
      };
    } finally {
      // 원래 값 복원
      if (originalTLS !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLS;
      }
    }
  }

  /**
   * 분석 결과를 읽기 쉬운 리포트로 변환 (상세 버전)
   */
  formatReport(analysisResult, options = {}) {
    const { includeScreenshots = false } = options;
    
    const report = {
      summary: {
        score: analysisResult.totalScore,
        riskLevel: analysisResult.riskLevel,
        riskLabel: this.getRiskLabel(analysisResult.riskLevel),
        violationsCount: analysisResult.violations?.length || 0,
        warningsCount: analysisResult.warnings?.length || 0,
      },
      
      violations: (analysisResult.violations || []).map(v => this.formatViolation(v, includeScreenshots)),
      
      warnings: (analysisResult.warnings || []).map(w => ({
        ruleId: w.ruleId,
        ruleName: w.ruleName,
        severity: w.severity,
        description: w.recommendation?.action,
        evidence: w.matchedText,
        context: w.contextWindow?.substring(0, 200),
        extendedContext: w.extendedContext,
      })),
      
      passed: analysisResult.passed?.length || 0,
      
      aiUsage: {
        calls: analysisResult.aiCalls || 0,
        cost: analysisResult.aiCost || 0,
      },
    };

    return report;
  }

  /**
   * 위반 항목 상세 포맷팅
   */
  formatViolation(violation, includeScreenshot = false) {
    // 관련 판례/사례 조회
    const relatedCases = this.getRelatedCases(violation.ruleId, violation.subcategory);
    
    // 가이드라인 기반 수정 가이드 조회
    const fixGuide = this.getFixGuide(violation);
    
    return {
      // 기본 정보
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      category: violation.category,
      subcategory: violation.subcategory,
      severity: violation.severity,
      severityLabel: this.getSeverityLabel(violation.severity),
      
      // 매칭된 텍스트
      evidence: {
        matchedText: violation.matchedText,
        contextWindow: violation.contextWindow,
        // 확장된 문맥 (앞뒤 문장 포함)
        extendedContext: violation.extendedContext ? {
          before: violation.extendedContext.before,
          matched: violation.extendedContext.matched,
          after: violation.extendedContext.after,
          full: violation.extendedContext.full,
        } : null,
      },
      
      // 판단 근거
      analysis: {
        confidence: violation.confidence,
        finalScore: violation.finalScore,
        triggerMatches: violation.evidence?.triggerMatches?.map(t => t.text) || [],
        mitigatingFactors: violation.evidence?.mitigatingMatches?.map(m => ({
          text: m.text,
          source: m.source || '규칙 정의',
        })) || [],
        aggravatingFactors: violation.evidence?.aggravatingMatches?.map(a => a.text) || [],
        aiVerification: violation.aiVerification?.performed ? {
          provider: violation.aiVerification.provider,
          reasoning: violation.aiVerification.reasoning,
          confidence: violation.aiVerification.confidence,
        } : null,
      },
      
      // 법적 정보
      legal: {
        basis: violation.legal?.basis,
        penalty: violation.legal?.penalty,
        article: violation.legal?.article,
      },
      
      // 관련 판례/사례
      relatedCases: relatedCases.slice(0, 3), // 최대 3개
      
      // 수정/대처 가이드
      howToFix: fixGuide,
      
      // 스크린샷 (있는 경우)
      screenshot: includeScreenshot && violation.screenshot ? {
        data: violation.screenshot,
        mimeType: violation.screenshotMimeType || 'image/png',
      } : null,
    };
  }

  /**
   * 관련 판례/사례 조회
   */
  getRelatedCases(ruleId, subcategory) {
    if (!legalCases) return [];
    
    const cases = [];
    
    // 규칙 ID로 직접 매칭
    const allCategories = Object.values(legalCases);
    for (const categoryArray of allCategories) {
      if (!Array.isArray(categoryArray)) continue;
      
      for (const caseItem of categoryArray) {
        if (caseItem.relatedRules?.includes(ruleId)) {
          cases.push({
            id: caseItem.id,
            title: caseItem.title,
            court: caseItem.court,
            date: caseItem.date,
            penalty: caseItem.penalty,
            summary: caseItem.summary,
            keyPoint: caseItem.keyPoint,
          });
        }
      }
    }
    
    // subcategory로 매칭
    if (cases.length === 0 && subcategory && legalCases[subcategory]) {
      const categoryCases = legalCases[subcategory];
      if (Array.isArray(categoryCases)) {
        cases.push(...categoryCases.slice(0, 3).map(c => ({
          id: c.id,
          title: c.title,
          court: c.court,
          date: c.date,
          penalty: c.penalty,
          summary: c.summary,
          keyPoint: c.keyPoint,
        })));
      }
    }
    
    return cases;
  }

  /**
   * 수정/대처 가이드 조회
   */
  getFixGuide(violation) {
    // 규칙 자체의 recommendation이 있으면 사용
    if (violation.recommendation) {
      return {
        action: violation.recommendation.action,
        badExample: violation.recommendation.example?.bad,
        goodExample: violation.recommendation.example?.good,
        tips: violation.recommendation.tips || [],
      };
    }
    
    // 가이드라인에서 관련 정보 조회
    if (officialGuidelines?.categories) {
      const category = officialGuidelines.categories.find(
        c => c.id === violation.ruleId || 
             c.name.includes(violation.ruleName) ||
             violation.ruleName?.includes(c.name)
      );
      
      if (category?.violationExamples?.[0]) {
        const example = category.violationExamples[0];
        return {
          action: example.correction,
          badExample: example.phrase,
          goodExample: category.legalExamples?.[0]?.phrase,
          tips: category.aiJudgmentCriteria?.slice(0, 3) || [],
        };
      }
    }
    
    // 기본 가이드
    return {
      action: '해당 표현을 삭제하거나 수정하세요.',
      tips: [
        '면책 문구를 추가하세요 (예: 개인차가 있을 수 있습니다)',
        '객관적인 근거가 있는 표현만 사용하세요',
        '의료광고 심의를 받으세요',
      ],
    };
  }

  /**
   * 스크린샷 포함 분석 (위반 영역 캡처)
   */
  async analyzeWebsiteWithScreenshots(url, options = {}) {
    // 기본 분석 실행
    const analysisResult = await this.analyzeWebsite(url, options);
    
    if (!analysisResult.success) {
      return analysisResult;
    }
    
    // 스크린샷 캡처가 활성화되어 있고 위반이 있는 경우
    if (options.captureScreenshots !== false && 
        this.screenshotCapturer.isAvailable &&
        analysisResult.violations?.length > 0) {
      
      try {
        // 위반 항목들의 스크린샷 캡처
        const violationsWithScreenshots = await this.screenshotCapturer.captureMultipleViolations(
          url,
          analysisResult.violations.map(v => ({
            ...v,
            text: v.matchedText,
          }))
        );
        
        // 결과 병합
        analysisResult.violations = violationsWithScreenshots;
        
      } catch (error) {
        console.error('[AnalyzerService] 스크린샷 캡처 실패:', error.message);
        // 스크린샷 실패해도 분석 결과는 유지
      }
    }
    
    // 상세 리포트 포맷팅
    analysisResult.report = this.formatReport(analysisResult, {
      includeScreenshots: options.captureScreenshots !== false,
    });
    
    return analysisResult;
  }

  /**
   * 스크린샷 캡처 서비스 종료
   */
  async close() {
    if (this.screenshotCapturer) {
      await this.screenshotCapturer.close();
    }
  }

  getRiskLabel(level) {
    const labels = {
      high: '고위험 - 즉시 조치 필요',
      medium: '주의 필요 - 검토 권장',
      low: '양호',
    };
    return labels[level] || level;
  }

  getSeverityLabel(severity) {
    const labels = {
      critical: '심각',
      warning: '주의',
      info: '참고',
    };
    return labels[severity] || severity;
  }
}

module.exports = AnalyzerService;
