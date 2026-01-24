/**
 * 오탐 자동 수집 및 학습 시스템
 * 
 * 핵심 기능:
 * 1. AI 자동 검증: 분석 결과를 AI가 재검증하여 오탐 식별
 * 2. 패턴 DB: 오탐 패턴을 저장하고 다음 분석에 자동 적용
 * 3. 사용자 피드백: 사용자가 "오탐" 표시하면 학습
 * 4. 자가 진단: 축적된 데이터로 규칙 개선 제안
 * 
 * 오탐 유형:
 * - MENU: 메뉴명/네비게이션 텍스트
 * - LOGIN_PROTECTED: 로그인 필요 콘텐츠
 * - FOOTER: 푸터/회사 정보
 * - CONTEXT_MISMATCH: 문맥상 광고 아님
 * - FALSE_PATTERN: 패턴 자체가 잘못됨
 */

const fs = require('fs');
const path = require('path');

class ErrorCollector {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.aiProviders = options.aiProviders || null;
    
    // 오탐 패턴 DB 파일 경로
    this.dbPath = options.dbPath || path.join(__dirname, '../data/false-positive-db.json');
    
    // 메모리 캐시
    this.falsePositivePatterns = {
      menuTexts: new Set(),           // 메뉴명으로 확인된 텍스트
      loginProtected: new Set(),       // 로그인 보호 텍스트
      domainSpecific: new Map(),       // 도메인별 특수 패턴 { domain -> Set }
      globalExclusions: new Set(),     // 전역 제외 패턴
      ruleAdjustments: new Map(),      // 규칙별 조정 사항 { ruleId -> { threshold, exclusions } }
    };
    
    // 통계
    this.stats = {
      totalAnalyzed: 0,
      totalFalsePositives: 0,
      byType: {},
      byRule: {},
      byDomain: {},
    };
    
    // 오탐 히스토리 (상세 기록)
    this.fpHistory = [];
    
    // DB 로드
    this.loadDatabase();
  }

  /**
   * DB 파일에서 패턴 로드
   */
  loadDatabase() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        
        // Set/Map으로 복원
        this.falsePositivePatterns.menuTexts = new Set(data.menuTexts || []);
        this.falsePositivePatterns.loginProtected = new Set(data.loginProtected || []);
        this.falsePositivePatterns.globalExclusions = new Set(data.globalExclusions || []);
        
        // 도메인별 패턴 복원
        if (data.domainSpecific) {
          for (const [domain, patterns] of Object.entries(data.domainSpecific)) {
            this.falsePositivePatterns.domainSpecific.set(domain, new Set(patterns));
          }
        }
        
        // 규칙 조정 사항 복원
        if (data.ruleAdjustments) {
          for (const [ruleId, adjustments] of Object.entries(data.ruleAdjustments)) {
            this.falsePositivePatterns.ruleAdjustments.set(ruleId, adjustments);
          }
        }
        
        // 통계 복원
        if (data.stats) {
          this.stats = { ...this.stats, ...data.stats };
        }
        
        // 오탐 히스토리 복원
        if (data.fpHistory) {
          this.fpHistory = data.fpHistory;
        }
        
        if (this.debug) {
          console.log('[ErrorCollector] DB 로드 완료:', {
            menuTexts: this.falsePositivePatterns.menuTexts.size,
            globalExclusions: this.falsePositivePatterns.globalExclusions.size,
            domains: this.falsePositivePatterns.domainSpecific.size,
          });
        }
      } else {
        // 초기 DB 생성
        this.saveDatabase();
      }
    } catch (error) {
      console.error('[ErrorCollector] DB 로드 실패:', error.message);
    }
  }

  /**
   * DB 파일에 패턴 저장
   */
  saveDatabase() {
    try {
      // Set/Map을 JSON 직렬화 가능 형태로 변환
      const data = {
        menuTexts: Array.from(this.falsePositivePatterns.menuTexts),
        loginProtected: Array.from(this.falsePositivePatterns.loginProtected),
        globalExclusions: Array.from(this.falsePositivePatterns.globalExclusions),
        domainSpecific: {},
        ruleAdjustments: {},
        stats: this.stats,
        fpHistory: this.fpHistory.slice(-500), // 최근 500개만 유지
        lastUpdated: new Date().toISOString(),
      };
      
      // 도메인별 패턴 변환
      for (const [domain, patterns] of this.falsePositivePatterns.domainSpecific) {
        data.domainSpecific[domain] = Array.from(patterns);
      }
      
      // 규칙 조정 사항 변환
      for (const [ruleId, adjustments] of this.falsePositivePatterns.ruleAdjustments) {
        data.ruleAdjustments[ruleId] = adjustments;
      }
      
      // 디렉토리 확인
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
      
      if (this.debug) {
        console.log('[ErrorCollector] DB 저장 완료');
      }
    } catch (error) {
      console.error('[ErrorCollector] DB 저장 실패:', error.message);
    }
  }

  /**
   * 분석 결과 자동 검증 (AI 사용)
   * @param {Object} analysisResult - 분석 결과
   * @param {Object} context - 추가 컨텍스트 (URL, HTML 등)
   * @returns {Object} 검증된 결과 + 오탐 목록
   */
  async verifyResults(analysisResult, context = {}) {
    const { url, html, htmlContext } = context;
    const domain = this.extractDomain(url);
    
    const verification = {
      originalViolations: analysisResult.violations?.length || 0,
      originalWarnings: analysisResult.warnings?.length || 0,
      falsePositives: [],
      verifiedViolations: [],
      verifiedWarnings: [],
      autoFiltered: 0,
      aiVerified: 0,
    };

    // 1. 패턴 DB 기반 자동 필터링
    const allItems = [
      ...(analysisResult.violations || []).map(v => ({ ...v, type: 'violation' })),
      ...(analysisResult.warnings || []).map(w => ({ ...w, type: 'warning' })),
    ];

    for (const item of allItems) {
      // ⚠️ 절대 금지 규칙은 오탐 학습/필터링 제외
      if (item.bypassFPLearning || item.metadata?.absoluteProhibition) {
        // 절대 금지 규칙은 무조건 위반으로 처리
        if (item.type === 'violation') {
          verification.verifiedViolations.push(item);
        } else {
          verification.verifiedWarnings.push(item);
        }
        continue;
      }
      
      const autoCheck = this.checkAgainstPatternDB(item, domain);
      
      if (autoCheck.isFalsePositive) {
        verification.falsePositives.push({
          ...item,
          fpReason: autoCheck.reason,
          fpSource: 'pattern_db',
          fpConfidence: autoCheck.confidence,
        });
        verification.autoFiltered++;
        continue;
      }
      
      // 자동 필터링 통과 → AI 검증 대상
      if (item.type === 'violation') {
        verification.verifiedViolations.push(item);
      } else {
        verification.verifiedWarnings.push(item);
      }
    }

    // 2. AI 재검증 (선택적, 비용 고려)
    if (this.aiProviders && context.enableAIVerification) {
      const aiResults = await this.aiVerifyBatch(verification.verifiedViolations, context);
      
      for (const result of aiResults) {
        if (result.isFalsePositive) {
          // AI가 오탐으로 판정
          verification.falsePositives.push({
            ...result.item,
            fpReason: result.reason,
            fpSource: 'ai_verification',
            fpConfidence: result.confidence,
            aiReasoning: result.reasoning,
          });
          
          // 패턴 DB에 학습
          this.learnFromFalsePositive(result.item, result.reason, domain);
          
          // verifiedViolations에서 제거
          const idx = verification.verifiedViolations.findIndex(v => v.ruleId === result.item.ruleId && v.matchedText === result.item.matchedText);
          if (idx !== -1) {
            verification.verifiedViolations.splice(idx, 1);
          }
          
          verification.aiVerified++;
        }
      }
    }

    // 3. 통계 업데이트
    this.updateStats(verification, domain);

    // 4. 매번 저장 (자동화 루프 완성)
    this.saveDatabase();

    return verification;
  }

  /**
   * 패턴 DB와 대조
   */
  checkAgainstPatternDB(item, domain) {
    const matchedText = item.matchedText?.trim().toLowerCase();
    if (!matchedText) return { isFalsePositive: false };

    // 1. 전역 제외 패턴 체크
    if (this.falsePositivePatterns.globalExclusions.has(matchedText)) {
      return {
        isFalsePositive: true,
        reason: 'global_exclusion',
        confidence: 0.95,
      };
    }

    // 2. 메뉴 텍스트 체크
    if (this.falsePositivePatterns.menuTexts.has(matchedText)) {
      return {
        isFalsePositive: true,
        reason: 'known_menu_text',
        confidence: 0.9,
      };
    }

    // 3. 도메인별 패턴 체크
    const domainPatterns = this.falsePositivePatterns.domainSpecific.get(domain);
    if (domainPatterns && domainPatterns.has(matchedText)) {
      return {
        isFalsePositive: true,
        reason: 'domain_specific',
        confidence: 0.85,
      };
    }

    // 4. 규칙별 조정 체크
    const ruleAdjustment = this.falsePositivePatterns.ruleAdjustments.get(item.ruleId);
    if (ruleAdjustment) {
      if (ruleAdjustment.exclusions?.includes(matchedText)) {
        return {
          isFalsePositive: true,
          reason: 'rule_exclusion',
          confidence: 0.85,
        };
      }
      
      // 임계값 조정 체크
      if (ruleAdjustment.threshold && item.confidence < ruleAdjustment.threshold) {
        return {
          isFalsePositive: true,
          reason: 'below_adjusted_threshold',
          confidence: 0.7,
        };
      }
    }

    // 5. 공통 메뉴 패턴 체크 (동적)
    if (this.isCommonMenuPattern(matchedText)) {
      return {
        isFalsePositive: true,
        reason: 'common_menu_pattern',
        confidence: 0.8,
      };
    }

    return { isFalsePositive: false };
  }

  /**
   * 공통 메뉴 패턴 동적 체크
   */
  isCommonMenuPattern(text) {
    const menuPatterns = [
      /^(홈|home|메인|main)$/i,
      /^(소개|안내|정보|about)$/i,
      /^(로그인|회원가입|마이페이지)$/i,
      /^(진료|시술|치료|수술)\s*(안내|과목)?$/i,
      /^(의료진|원장|전문의)\s*(소개)?$/i,
      /^(오시는\s*길|찾아오시는\s*길|위치|location)$/i,
      /^(문의|상담|예약|contact)$/i,
      /^(후기|리뷰|체험담)$/i,  // 메뉴명으로 사용되는 경우
      /^(전후|before|after)$/i,
      /^(갤러리|포토|사진|영상)$/i,
      /^(이벤트|공지|뉴스)$/i,
      /^(no\.?\s*1|넘버원|올인원)$/i,  // 브랜드명/메뉴명
      /^[a-z]{2,10}$/i,  // 짧은 영문 (메뉴명 가능성)
    ];

    return menuPatterns.some(p => p.test(text));
  }

  /**
   * AI 배치 검증
   */
  async aiVerifyBatch(items, context) {
    if (!this.aiProviders || items.length === 0) return [];

    const results = [];
    
    // 비용 최적화: 한 번에 여러 항목 검증
    const prompt = this.buildBatchVerificationPrompt(items, context);
    
    try {
      const response = await this.aiProviders.gemini.analyze(prompt);
      
      // 응답 파싱 강화
      let parsedResponse = response;
      
      // 문자열 응답이면 JSON 추출 시도
      if (typeof response === 'string') {
        // JSON 블록 추출 시도
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                          response.match(/\{[\s\S]*"items"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch (e) {
            console.warn('[ErrorCollector] JSON 파싱 실패, 원본 응답 사용');
          }
        }
      }
      
      // items 배열 유연하게 매칭
      const aiItems = parsedResponse?.items || parsedResponse?.results || 
                      (Array.isArray(parsedResponse) ? parsedResponse : []);
      
      for (const aiItem of aiItems) {
        // 텍스트 매칭 (대소문자 무시, 공백 정규화)
        const normalizeText = (t) => (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const aiText = normalizeText(aiItem.text || aiItem.matchedText);
        
        const originalItem = items.find(i => normalizeText(i.matchedText) === aiText);
        if (originalItem) {
          results.push({
            item: originalItem,
            isFalsePositive: aiItem.isFalsePositive === true || aiItem.is_false_positive === true,
            reason: aiItem.reason || aiItem.fp_reason || 'ai_detected',
            confidence: aiItem.confidence || aiItem.conf || 0.8,
            reasoning: aiItem.reasoning || aiItem.explanation || '',
          });
        }
      }
      
      // AI가 오탐으로 판정한 항목들 즉시 학습 및 DB 저장
      const falsePositives = results.filter(r => r.isFalsePositive);
      if (falsePositives.length > 0) {
        const domain = this.extractDomain(context.url);
        for (const fp of falsePositives) {
          this.learnFromFalsePositive(fp.item, fp.reason, domain);
        }
        this.saveDatabase();  // 즉시 저장
        console.log(`[ErrorCollector] AI 검증 완료: ${falsePositives.length}건 오탐 학습 및 저장`);
      }
      
    } catch (error) {
      console.error('[ErrorCollector] AI 검증 실패:', error.message);
    }

    return results;
  }

  /**
   * AI 검증 프롬프트 생성
   */
  buildBatchVerificationPrompt(items, context) {
    const itemsList = items.map((item, i) => 
      `${i + 1}. "${item.matchedText}" (규칙: ${item.ruleName})`
    ).join('\n');

    return `당신은 의료광고 위반 분석 결과를 검증하는 전문가입니다.

## 분석 대상 웹사이트
URL: ${context.url || '알 수 없음'}

## 검증할 위반 항목들
${itemsList}

## 오탐(False Positive) 판단 기준
다음 경우는 오탐입니다:
1. **메뉴명/네비게이션**: 웹사이트 메뉴, 버튼, 링크 텍스트
2. **로그인 보호 콘텐츠**: 로그인해야 보이는 내용 (공개 광고 아님)
3. **푸터/회사 정보**: 사업자 정보, 연락처 등
4. **문맥상 부정 표현**: "~하지 않습니다", "~가 아닙니다" 형태
5. **단순 정보 제공**: 광고 목적이 아닌 정보 안내

## 응답 형식 (JSON)
{
  "items": [
    {
      "text": "검증한 텍스트",
      "isFalsePositive": true/false,
      "reason": "menu_text|login_protected|footer|context_negative|info_only|real_violation",
      "confidence": 0.0-1.0,
      "reasoning": "판단 근거 한 줄"
    }
  ]
}`;
  }

  /**
   * 오탐으로부터 학습
   */
  learnFromFalsePositive(item, reason, domain) {
    // 한글 인코딩 보정: Buffer를 통해 UTF-8 정규화
    let text = item.matchedText?.trim().toLowerCase();
    if (!text) return;
    
    // UTF-8로 명시적 변환 (Windows 인코딩 문제 해결)
    try {
      text = Buffer.from(text, 'utf8').toString('utf8');
    } catch (e) {
      // 변환 실패 시 원본 사용
    }

    // 유형별 저장
    switch (reason) {
      case 'menu_text':
      case 'known_menu_text':
      case 'common_menu_pattern':
        this.falsePositivePatterns.menuTexts.add(text);
        break;
        
      case 'login_protected':
        this.falsePositivePatterns.loginProtected.add(text);
        break;
        
      case 'domain_specific':
        if (!this.falsePositivePatterns.domainSpecific.has(domain)) {
          this.falsePositivePatterns.domainSpecific.set(domain, new Set());
        }
        this.falsePositivePatterns.domainSpecific.get(domain).add(text);
        break;
        
      case 'rule_exclusion':
        // 규칙별 제외 패턴 추가
        if (!this.falsePositivePatterns.ruleAdjustments.has(item.ruleId)) {
          this.falsePositivePatterns.ruleAdjustments.set(item.ruleId, { exclusions: [] });
        }
        const adj = this.falsePositivePatterns.ruleAdjustments.get(item.ruleId);
        if (!adj.exclusions) adj.exclusions = [];
        if (!adj.exclusions.includes(text)) {
          adj.exclusions.push(text);
        }
        break;
        
      default:
        // 기타는 전역 제외에 추가
        this.falsePositivePatterns.globalExclusions.add(text);
    }

    // 히스토리에 상세 기록 추가
    this.fpHistory.push({
      id: `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      matchedText: item.matchedText,
      normalizedText: text,
      ruleId: item.ruleId,
      ruleName: item.ruleName || '',
      reason: reason,
      domain: domain,
      context: item.contextWindow?.substring(0, 200) || '',
      source: item.fpSource || 'manual',
      confidence: item.fpConfidence || 1.0,
    });

    if (this.debug) {
      console.log(`[ErrorCollector] 학습: "${text}" → ${reason}`);
    }
  }

  /**
   * 사용자 피드백 처리
   */
  recordUserFeedback(item, isFalsePositive, reason, domain) {
    if (isFalsePositive) {
      this.learnFromFalsePositive(item, reason || 'user_feedback', domain);
      this.stats.totalFalsePositives++;
      this.stats.byType[reason] = (this.stats.byType[reason] || 0) + 1;
    }
    
    this.saveDatabase();
  }

  /**
   * 통계 업데이트
   */
  updateStats(verification, domain) {
    this.stats.totalAnalyzed++;
    
    for (const fp of verification.falsePositives) {
      this.stats.totalFalsePositives++;
      
      // 유형별 통계
      const reason = fp.fpReason || 'unknown';
      this.stats.byType[reason] = (this.stats.byType[reason] || 0) + 1;
      
      // 규칙별 통계
      this.stats.byRule[fp.ruleId] = (this.stats.byRule[fp.ruleId] || 0) + 1;
      
      // 도메인별 통계
      if (domain) {
        this.stats.byDomain[domain] = (this.stats.byDomain[domain] || 0) + 1;
      }
    }
  }

  /**
   * 도메인 추출
   */
  extractDomain(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  /**
   * 자가 진단 리포트 생성
   */
  generateDiagnosticReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAnalyzed: this.stats.totalAnalyzed,
        totalFalsePositives: this.stats.totalFalsePositives,
        falsePositiveRate: this.stats.totalAnalyzed > 0 
          ? ((this.stats.totalFalsePositives / this.stats.totalAnalyzed) * 100).toFixed(2) + '%'
          : '0%',
      },
      patternDbSize: {
        menuTexts: this.falsePositivePatterns.menuTexts.size,
        loginProtected: this.falsePositivePatterns.loginProtected.size,
        globalExclusions: this.falsePositivePatterns.globalExclusions.size,
        domains: this.falsePositivePatterns.domainSpecific.size,
        ruleAdjustments: this.falsePositivePatterns.ruleAdjustments.size,
      },
      topFalsePositiveReasons: this.getTopItems(this.stats.byType, 5),
      topProblematicRules: this.getTopItems(this.stats.byRule, 5),
      topProblematicDomains: this.getTopItems(this.stats.byDomain, 5),
      recommendations: this.generateRecommendations(),
    };

    return report;
  }

  /**
   * 상위 항목 추출
   */
  getTopItems(obj, limit) {
    return Object.entries(obj || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }

  /**
   * 개선 권장 사항 생성
   */
  generateRecommendations() {
    const recommendations = [];

    // 오탐율이 높은 규칙 식별
    for (const [ruleId, count] of Object.entries(this.stats.byRule || {})) {
      if (count >= 5) {
        recommendations.push({
          type: 'rule_adjustment',
          ruleId,
          message: `규칙 ${ruleId}에서 ${count}건의 오탐 발생. 임계값 상향 또는 제외 패턴 추가 권장.`,
          priority: count >= 10 ? 'high' : 'medium',
        });
      }
    }

    // 자주 발생하는 오탐 유형
    const menuFP = this.stats.byType?.menu_text || 0;
    if (menuFP >= 10) {
      recommendations.push({
        type: 'pattern_enhancement',
        message: `메뉴 텍스트 오탐이 ${menuFP}건 발생. HTML 구조 분석 로직 강화 권장.`,
        priority: 'high',
      });
    }

    return recommendations;
  }

  /**
   * 패턴 DB 내보내기
   */
  exportPatterns() {
    return {
      menuTexts: Array.from(this.falsePositivePatterns.menuTexts),
      loginProtected: Array.from(this.falsePositivePatterns.loginProtected),
      globalExclusions: Array.from(this.falsePositivePatterns.globalExclusions),
      stats: this.stats,
    };
  }

  /**
   * 패턴 가져오기
   */
  importPatterns(data) {
    if (data.menuTexts) {
      data.menuTexts.forEach(t => this.falsePositivePatterns.menuTexts.add(t));
    }
    if (data.loginProtected) {
      data.loginProtected.forEach(t => this.falsePositivePatterns.loginProtected.add(t));
    }
    if (data.globalExclusions) {
      data.globalExclusions.forEach(t => this.falsePositivePatterns.globalExclusions.add(t));
    }
    
    this.saveDatabase();
  }
}

module.exports = ErrorCollector;
