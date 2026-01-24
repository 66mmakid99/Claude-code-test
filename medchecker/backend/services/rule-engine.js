/**
 * MEDCHECKER 문맥 기반 규칙 엔진
 * 
 * 핵심 원리:
 * 1. 단순 키워드 매칭이 아닌, 문맥을 분석하여 실제 위반 여부 판단
 * 2. 부정어, 면책 표현, 조건문 등을 고려
 * 3. 불확실한 경우만 AI 검증 호출 (비용 최적화)
 * 4. 웹사이트 UI/메뉴 요소는 광고로 오인하지 않음
 * 5. 보건복지부 가이드라인 기반 판단 기준 적용
 * 
 * 판단 프로세스:
 * Step 1: 트리거 매칭 (후보 추출)
 * Step 2: UI/메뉴 요소 필터링 (오탐 방지)
 * Step 2.5: 확장된 문맥 추출 (앞뒤 문장 단위)
 * Step 3: 컨텍스트 윈도우 추출
 * Step 4: 가중/감경 요소 분석 (가이드라인 면책 표현 참조)
 * Step 5: 최종 점수 계산 및 판단
 * Step 6: 필요 시 AI 검증
 */

// 보건복지부 가이드라인 데이터 로드
let officialGuidelines = null;
try {
  const guidelinesModule = require('../data/official-guidelines');
  officialGuidelines = guidelinesModule.officialGuidelines;
} catch (e) {
  console.warn('[RuleEngine] 가이드라인 데이터 로드 실패, 기본 설정 사용');
}

class RuleEngine {
  constructor(options = {}) {
    this.rules = [];
    this.aiProviders = options.aiProviders || {};
    this.enableAI = options.enableAI !== false;
    this.debug = options.debug || false;
    
    // 웹사이트 UI/메뉴 요소로 간주되어 제외할 패턴
    this.uiMenuPatterns = [
      // 일반 메뉴명
      /^(병원|의원|클리닉)\s*(안내|소개|정보)$/i,
      /^(의료진|원장|의사)\s*(소개|안내)$/i,
      /^(진료|시술)\s*(안내|과목|시간)$/i,
      /^(오시는|찾아오시는)\s*길$/i,
      /^(예약|상담|문의)\s*(안내|하기)?$/i,
      /^(공지|이벤트|소식)\s*(사항)?$/i,
      /^(갤러리|사진|영상)$/i,
      /^(로그인|회원가입|마이페이지)$/i,
      /^(홈|메인|HOME)$/i,
      // 네비게이션 문구
      /^(바로가기|더보기|자세히)$/i,
      // 푸터 정보
      /^(대표|원장|전화|주소|사업자)/i,
    ];
    
    // 의료인이 사용 가능한 정당한 표현들
    this.legitimateMedicalTerms = [
      '전문의', '피부과 전문의', '성형외과 전문의', '피부 전문가',
      '의료진', '의사', '원장', '대표원장',
      '전문 클리닉', '전문 병원', '전문 치료',
    ];
  }

  /**
   * 규칙 로드
   */
  loadRules(rules) {
    this.rules = rules.filter(rule => rule.metadata?.isActive !== false);
    // 우선순위 정렬 (낮은 숫자가 먼저 실행)
    this.rules.sort((a, b) => (a.metadata?.priority || 100) - (b.metadata?.priority || 100));
    
    if (this.debug) {
      console.log(`[RuleEngine] ${this.rules.length}개 규칙 로드됨`);
    }
  }

  /**
   * 텍스트 분석 실행
   * @param {string} text - 분석할 텍스트
   * @param {Object} options - 분석 옵션
   * @returns {Object} 분석 결과
   */
  async analyze(text, options = {}) {
    const {
      categories = ['medical_ad', 'viral', 'seo', 'aeo'],
      skipAI = false,
      targetUrl = null,
      targetType = 'website',
    } = options;

    const results = {
      targetUrl,
      targetType,
      analyzedAt: new Date().toISOString(),
      totalScore: 100,
      riskLevel: 'low',
      violations: [],
      warnings: [],
      passed: [],
      aiCalls: 0,
      aiCost: 0,
      processingTimeMs: 0,
    };

    const startTime = Date.now();

    // 텍스트 전처리
    const normalizedText = this.normalizeText(text);

    // 각 규칙 실행
    for (const rule of this.rules) {
      // 카테고리 필터
      if (!categories.includes(rule.category)) continue;

      try {
        const ruleResult = await this.executeRule(rule, normalizedText, text, {
          skipAI: skipAI || !this.enableAI,
        });

        if (ruleResult.decision === 'violation') {
          results.violations.push(ruleResult);
          results.totalScore -= rule.riskScore || 10;
        } else if (ruleResult.decision === 'warning') {
          results.warnings.push(ruleResult);
          results.totalScore -= Math.floor((rule.riskScore || 10) / 2);
        } else {
          results.passed.push({
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }

        // AI 호출 통계
        if (ruleResult.aiVerification?.performed) {
          results.aiCalls++;
          results.aiCost += ruleResult.aiVerification.cost || 0;
        }
      } catch (error) {
        console.error(`[RuleEngine] 규칙 ${rule.id} 실행 오류:`, error);
      }
    }

    // 최종 점수 및 위험도 계산
    results.totalScore = Math.max(0, results.totalScore);
    results.riskLevel = this.calculateRiskLevel(results);
    results.processingTimeMs = Date.now() - startTime;

    return results;
  }

  /**
   * 단일 규칙 실행
   */
  async executeRule(rule, normalizedText, originalText, options = {}) {
    const result = {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      subcategory: rule.subcategory,
      severity: rule.severity,
      riskScore: rule.riskScore || 10,  // 점수 계산용 riskScore 포함
      legal: rule.legal,
      recommendation: rule.recommendation,
      matched: false,
      matchedText: null,
      contextWindow: null,
      contextScores: {
        triggerScore: 0,
        aggravatingScore: 0,
        mitigatingScore: 0,
        requiredScore: 0,
      },
      finalScore: 0,
      decision: 'pass',
      confidence: 0,
      evidence: {
        triggerMatches: [],
        aggravatingMatches: [],
        mitigatingMatches: [],
      },
      aiVerification: {
        performed: false,
      },
    };

    // Step 1: 트리거 매칭
    const triggerMatches = this.findTriggerMatches(rule.detection.triggers, normalizedText, originalText);
    
    if (triggerMatches.length === 0) {
      // 트리거 매칭 없으면 통과
      result.decision = 'pass';
      result.confidence = 1.0;
      return result;
    }

    // Step 1.5: UI/메뉴 요소 필터링 (오탐 방지)
    const filteredMatches = this.filterUIMenuMatches(triggerMatches, originalText);
    
    if (filteredMatches.length === 0) {
      // 모든 매칭이 UI/메뉴 요소로 필터링됨 - 통과
      result.decision = 'pass';
      result.confidence = 0.95;
      if (this.debug) {
        console.log(`[RuleEngine] ${rule.id}: UI/메뉴 요소로 필터링됨`);
      }
      return result;
    }

    result.matched = true;
    result.evidence.triggerMatches = filteredMatches;
    result.matchedText = filteredMatches[0].text;
    result.contextScores.triggerScore = 0.5; // 기본 트리거 점수

    // Step 2: 컨텍스트 윈도우 추출
    const windowSize = rule.detection.context?.windowSize || 100;
    result.contextWindow = this.extractContextWindow(
      originalText, 
      triggerMatches[0].position, 
      windowSize
    );

    // Step 2.5: 확장된 문맥 추출 (문장 단위)
    result.extendedContext = this.extractExtendedContext(
      originalText,
      triggerMatches[0].position,
      filteredMatches[0].text,
      {
        sentencesBefore: 2,
        sentencesAfter: 2,
        maxLength: 500,
      }
    );

    // Step 3: 필수 조건 확인
    if (rule.detection.context?.required) {
      const requiredCheck = this.checkRequiredConditions(
        rule.detection.context.required,
        result.contextWindow
      );
      
      if (!requiredCheck.satisfied) {
        // 필수 조건 불충족 - 의료 맥락이 아님
        result.decision = 'pass';
        result.confidence = 0.8;
        return result;
      }
      result.contextScores.requiredScore = 0.2;
    }

    // Step 4: 제외 패턴 확인
    if (rule.detection.context?.exclusions) {
      const excluded = this.checkExclusions(
        rule.detection.context.exclusions,
        result.contextWindow
      );
      
      if (excluded) {
        // 제외 패턴 매칭 - 위반 아님
        result.decision = 'pass';
        result.confidence = 0.9;
        return result;
      }
    }

    // Step 5: 가중 요소 분석
    if (rule.detection.context?.aggravating) {
      const aggravating = this.findContextMatches(
        rule.detection.context.aggravating,
        result.contextWindow
      );
      result.evidence.aggravatingMatches = aggravating.matches;
      result.contextScores.aggravatingScore = aggravating.score;
    }

    // Step 6: 감경 요소 분석 (가이드라인 면책 표현 포함)
    if (rule.detection.context?.mitigating) {
      const mitigating = this.findContextMatches(
        rule.detection.context.mitigating,
        result.extendedContext?.full || result.contextWindow,
        true // isMitigating = true로 가이드라인 면책 표현 검사 활성화
      );
      result.evidence.mitigatingMatches = mitigating.matches;
      result.contextScores.mitigatingScore = mitigating.score;
    } else {
      // 규칙에 mitigating 설정이 없어도 가이드라인 면책 표현은 검사
      const mitigating = this.findContextMatches(
        { keywords: [], weight: -0.3 },
        result.extendedContext?.full || result.contextWindow,
        true
      );
      if (mitigating.matches.length > 0) {
        result.evidence.mitigatingMatches = mitigating.matches;
        result.contextScores.mitigatingScore = mitigating.score;
      }
    }

    // Step 7: 최종 점수 계산
    result.finalScore = this.calculateFinalScore(result.contextScores);

    // Step 8: 판단
    const thresholds = rule.detection.thresholds || {
      confirmViolation: 0.75,
      requiresAI: 0.45,
      dismiss: 0.30,
    };

    if (result.finalScore >= thresholds.confirmViolation) {
      result.decision = 'violation';
      result.confidence = result.finalScore;
    } else if (result.finalScore <= thresholds.dismiss) {
      result.decision = 'pass';
      result.confidence = 1 - result.finalScore;
    } else if (!options.skipAI && rule.aiVerification?.enabled) {
      // AI 검증 필요
      result.decision = 'needs_ai';
      
      try {
        const aiResult = await this.performAIVerification(rule, result, originalText);
        result.aiVerification = aiResult;
        
        if (aiResult.isViolation) {
          result.decision = 'violation';
          result.confidence = aiResult.confidence;
        } else {
          result.decision = aiResult.confidence > 0.7 ? 'pass' : 'warning';
          result.confidence = aiResult.confidence;
        }
      } catch (error) {
        console.error(`[RuleEngine] AI 검증 실패:`, error);
        // AI 실패 시 보수적으로 warning 처리
        result.decision = 'warning';
        result.confidence = result.finalScore;
      }
    } else {
      // AI 없이 경고 처리
      result.decision = 'warning';
      result.confidence = result.finalScore;
    }

    // 동적 개선권고 생성 (실제 위반 문장 기반)
    if (result.decision !== 'pass' && result.extendedContext?.matchedSentence) {
      result.recommendation = this.generateDynamicRecommendation(
        rule,
        result.matchedText,
        result.extendedContext.matchedSentence
      );
    }

    return result;
  }

  /**
   * 실제 위반 문장 기반 동적 개선권고 생성
   */
  generateDynamicRecommendation(rule, matchedText, matchedSentence) {
    const baseRecommendation = rule.recommendation || {};
    
    // 실제 위반 문장에서 수정안 생성
    let suggestedFix = matchedSentence;
    let fixReason = '';
    
    // 규칙별 수정 로직
    switch (rule.id) {
      case 'MED-EFF-007': // 즉각적/빠른 효과 보장
        suggestedFix = matchedSentence
          .replace(/즉각\s*(효과|개선|호전)/gi, '시술 후 점진적 개선')
          .replace(/바로\s*(효과|개선)/gi, '개인에 따라 효과')
          .replace(/즉시\s*(효과|개선)/gi, '시술 후 효과');
        fixReason = '의료법 제56조 제2항 제3호에 따라 즉각적/확정적 효과 표현은 소비자를 오인하게 할 수 있어 삭제 또는 완화 표현으로 수정이 필요합니다.';
        break;
        
      case 'MED-INFO-001': // 일반적 홍보성 최상급 표현
        suggestedFix = matchedSentence
          .replace(/최상위/gi, '높은 수준의')
          .replace(/최상의/gi, '최선의')
          .replace(/최고의/gi, '우수한')
          .replace(/가장\s+최상/gi, '높은 수준');
        fixReason = '객관적 근거 없는 최상급 표현은 과장광고에 해당할 수 있습니다. 면책 문구를 추가하거나 완화된 표현으로 수정을 권장합니다.';
        break;
        
      case 'MED-EX-001': // 객관적 근거 없는 최상급 표현
        suggestedFix = matchedSentence
          .replace(/국내\s*(최초|유일|1위)/gi, '')
          .replace(/세계\s*(최초|유일)/gi, '')
          .replace(/독보적/gi, '차별화된')
          .replace(/압도적/gi, '뛰어난');
        fixReason = '의료법 제56조 제2항에 따라 객관적 근거 없는 최상급/유일 표현은 과대광고에 해당합니다. 해당 표현 삭제 또는 공인된 근거 명시가 필요합니다.';
        break;
        
      case 'MED-EFF-005': // 무통증 보장
        suggestedFix = matchedSentence
          .replace(/무통/gi, '통증 최소화')
          .replace(/안\s*아픈/gi, '통증이 적은')
          .replace(/통증\s*없/gi, '통증 완화');
        fixReason = '통증 여부는 개인차가 있어 무통증 보장 표현은 허위/과장 광고에 해당할 수 있습니다.';
        break;
        
      case 'MED-PR-001': // 과도한 할인/가격 광고
        suggestedFix = matchedSentence
          .replace(/(\d+)%\s*(할인|세일|특가)/gi, '가격 문의')
          .replace(/특가/gi, '합리적 가격')
          .replace(/파격/gi, '');
        fixReason = '의료광고 심의기준에 따라 과도한 할인/가격 강조는 의료의 신뢰성을 훼손할 수 있어 주의가 필요합니다.';
        break;
        
      default:
        // 기본: 매칭된 텍스트만 표시하고 삭제 권고
        suggestedFix = matchedSentence.replace(new RegExp(matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[삭제 권장]');
        fixReason = baseRecommendation.action || '해당 표현의 수정 또는 삭제를 권장합니다.';
    }
    
    return {
      action: baseRecommendation.action || fixReason,
      example: {
        bad: matchedSentence.length > 150 ? matchedSentence.substring(0, 150) + '...' : matchedSentence,
        good: suggestedFix.length > 150 ? suggestedFix.substring(0, 150) + '...' : suggestedFix,
      },
      fixReason: fixReason,
      // 책임 면제 주석
      disclaimer: '※ 본 수정안은 AI 기반 자동 생성으로, 최종 판단은 법률 전문가 검토를 권장합니다. 실제 적용 시 맥락에 맞게 조정이 필요할 수 있습니다.',
    };
  }

  /**
   * 트리거 매칭 찾기
   */
  findTriggerMatches(triggers, normalizedText, originalText) {
    const matches = [];

    // 키워드 매칭
    if (triggers.keywords) {
      for (const keyword of triggers.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        let index = normalizedText.indexOf(lowerKeyword);
        
        while (index !== -1) {
          matches.push({
            type: 'keyword',
            keyword,
            text: originalText.substring(index, index + keyword.length),
            position: index,
          });
          index = normalizedText.indexOf(lowerKeyword, index + 1);
        }
      }
    }

    // 패턴 매칭
    if (triggers.patterns) {
      for (const pattern of triggers.patterns) {
        let regex;
        if (typeof pattern === 'string') {
          regex = new RegExp(pattern, 'gi');
        } else {
          regex = pattern;
        }

        let match;
        while ((match = regex.exec(originalText)) !== null) {
          matches.push({
            type: 'pattern',
            pattern: pattern.toString(),
            text: match[0],
            position: match.index,
          });
        }
      }
    }

    // 중복 제거 (위치 기준)
    return this.deduplicateMatches(matches);
  }

  /**
   * 컨텍스트 윈도우 추출 (문자 기반)
   */
  extractContextWindow(text, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  /**
   * 확장된 문맥 추출 (문장 단위)
   * 위반 텍스트 앞뒤 문장을 포함하여 더 정확한 판단 맥락 제공
   * 
   * @param {string} text - 전체 텍스트
   * @param {number} position - 매칭된 위치
   * @param {string} matchedText - 매칭된 텍스트
   * @param {Object} options - 옵션 {sentencesBefore: 1, sentencesAfter: 1}
   * @returns {Object} 확장된 문맥 정보
   */
  extractExtendedContext(text, position, matchedText, options = {}) {
    const {
      sentencesBefore = 2,
      sentencesAfter = 2,
      maxLength = 500,
    } = options;

    // 문장 종결 패턴 (한국어 + 영어)
    const sentenceEndPattern = /[.!?。！？]\s*|\n+/g;
    
    // 텍스트를 문장으로 분리
    const sentences = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceEndPattern.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push({
          text: sentence,
          start: lastIndex,
          end: match.index + match[0].length,
        });
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 마지막 문장 (종결 없는 경우)
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push({
          text: remaining,
          start: lastIndex,
          end: text.length,
        });
      }
    }
    
    // 매칭 위치가 포함된 문장 찾기
    let targetSentenceIndex = -1;
    for (let i = 0; i < sentences.length; i++) {
      if (position >= sentences[i].start && position < sentences[i].end) {
        targetSentenceIndex = i;
        break;
      }
    }
    
    // 문장을 찾지 못한 경우 기본 윈도우 사용
    if (targetSentenceIndex === -1) {
      return {
        before: '',
        matched: matchedText,
        after: '',
        full: this.extractContextWindow(text, position, maxLength / 2),
        sentenceContext: false,
      };
    }
    
    // 앞뒤 문장 추출
    const startIndex = Math.max(0, targetSentenceIndex - sentencesBefore);
    const endIndex = Math.min(sentences.length - 1, targetSentenceIndex + sentencesAfter);
    
    const beforeSentences = sentences.slice(startIndex, targetSentenceIndex);
    const targetSentence = sentences[targetSentenceIndex];
    const afterSentences = sentences.slice(targetSentenceIndex + 1, endIndex + 1);
    
    const beforeText = beforeSentences.map(s => s.text).join(' ');
    const afterText = afterSentences.map(s => s.text).join(' ');
    
    // 최대 길이 제한
    let fullContext = [...beforeSentences, targetSentence, ...afterSentences]
      .map(s => s.text)
      .join(' ');
    
    if (fullContext.length > maxLength) {
      fullContext = fullContext.substring(0, maxLength) + '...';
    }
    
    // 매칭된 텍스트 하이라이트 위치 계산
    const highlightStart = beforeText.length > 0 ? beforeText.length + 1 : 0;
    const matchStartInSentence = targetSentence.text.indexOf(matchedText);
    
    return {
      before: beforeText,
      matched: matchedText,  // 실제 매칭된 텍스트만 저장
      matchedSentence: targetSentence.text,  // 매칭이 포함된 전체 문장
      matchedHighlight: {
        text: matchedText,
        startInSentence: matchStartInSentence,
      },
      after: afterText,
      full: fullContext,
      sentenceContext: true,
      sentenceCount: {
        before: beforeSentences.length,
        after: afterSentences.length,
        total: endIndex - startIndex + 1,
      },
    };
  }

  /**
   * 필수 조건 확인
   */
  checkRequiredConditions(required, contextWindow) {
    const normalizedContext = contextWindow.toLowerCase();
    let satisfied = false;

    if (required.keywords) {
      const matchedKeywords = required.keywords.filter(kw => 
        normalizedContext.includes(kw.toLowerCase())
      );

      if (required.logic === 'AND') {
        satisfied = matchedKeywords.length === required.keywords.length;
      } else {
        // OR (기본)
        satisfied = matchedKeywords.length > 0;
      }
    }

    if (required.patterns && !satisfied) {
      for (const pattern of required.patterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        if (regex.test(contextWindow)) {
          satisfied = true;
          break;
        }
      }
    }

    return { satisfied };
  }

  /**
   * 제외 패턴 확인
   */
  checkExclusions(exclusions, contextWindow) {
    const normalizedContext = contextWindow.toLowerCase();

    // 패턴 제외
    if (exclusions.patterns) {
      for (const pattern of exclusions.patterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        if (regex.test(contextWindow)) {
          return true;
        }
      }
    }

    // 컨텍스트 문장 제외
    if (exclusions.contexts) {
      for (const ctx of exclusions.contexts) {
        if (normalizedContext.includes(ctx.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 컨텍스트 매칭 (가중/감경)
   * 가이드라인의 면책 표현도 함께 검사
   */
  findContextMatches(config, contextWindow, isMitigating = false) {
    const matches = [];
    let score = 0;
    const normalizedContext = contextWindow.toLowerCase();

    // 키워드 매칭
    if (config.keywords) {
      for (const keyword of config.keywords) {
        if (normalizedContext.includes(keyword.toLowerCase())) {
          matches.push({ type: 'keyword', text: keyword });
        }
      }
    }

    // 패턴 매칭
    if (config.patterns) {
      for (const pattern of config.patterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        const match = contextWindow.match(regex);
        if (match) {
          matches.push({ type: 'pattern', text: match[0] });
        }
      }
    }

    // 감경 요소 분석 시 가이드라인의 면책 표현도 검사
    if (isMitigating && officialGuidelines?.mitigatingExpressions) {
      const allMitigations = [
        ...(officialGuidelines.mitigatingExpressions.effectDisclaimer || []),
        ...(officialGuidelines.mitigatingExpressions.sideEffectDisclaimer || []),
        ...(officialGuidelines.mitigatingExpressions.consultationAdvice || []),
      ];
      
      for (const phrase of allMitigations) {
        if (normalizedContext.includes(phrase.toLowerCase())) {
          // 이미 매칭된 것과 중복되지 않으면 추가
          if (!matches.some(m => m.text.toLowerCase() === phrase.toLowerCase())) {
            matches.push({ 
              type: 'guideline_mitigation', 
              text: phrase,
              source: '보건복지부 가이드라인',
            });
          }
        }
      }
    }

    // 점수 계산 (매칭 개수와 가중치 기반)
    if (matches.length > 0) {
      const weight = config.weight || 0.2;
      // 가이드라인 면책 표현은 더 강한 감경 효과
      const guidelineMatches = matches.filter(m => m.type === 'guideline_mitigation').length;
      const regularMatches = matches.length - guidelineMatches;
      
      score = Math.min(0.5, regularMatches * Math.abs(weight)) * Math.sign(weight);
      // 가이드라인 면책 표현은 추가 감경
      if (guidelineMatches > 0 && weight < 0) {
        score += guidelineMatches * -0.15; // 강한 감경
      }
    }

    return { matches, score };
  }

  /**
   * 최종 점수 계산
   */
  calculateFinalScore(scores) {
    const {
      triggerScore,
      aggravatingScore,
      mitigatingScore,
      requiredScore,
    } = scores;

    let finalScore = triggerScore + requiredScore + aggravatingScore + mitigatingScore;
    
    // 0~1 범위로 정규화
    finalScore = Math.max(0, Math.min(1, finalScore));
    
    return finalScore;
  }

  /**
   * AI 검증 수행
   */
  async performAIVerification(rule, result, originalText) {
    const aiConfig = rule.aiVerification;
    const provider = aiConfig.provider || 'gemini';

    if (!this.aiProviders[provider]) {
      throw new Error(`AI provider '${provider}' not configured`);
    }

    // 확장된 문맥 정보 준비
    const extendedContextText = result.extendedContext?.full || result.contextWindow;

    // 프롬프트 생성
    const prompt = (aiConfig.prompt || this.getDefaultAIPrompt(rule))
      .replace('{text}', result.matchedText)
      .replace('{context}', result.contextWindow)
      .replace('{extendedContext}', extendedContextText);

    // AI 호출
    const aiResponse = await this.aiProviders[provider].analyze(prompt);

    return {
      performed: true,
      provider,
      isViolation: aiResponse.isViolation,
      confidence: aiResponse.confidence || 0.7,
      reasoning: aiResponse.reasoning,
      mitigatingFactorsFound: aiResponse.mitigatingFactorsFound || [],
      aggravatingFactorsFound: aiResponse.aggravatingFactorsFound || [],
      cost: aiResponse.cost || 0,
    };
  }

  /**
   * 기본 AI 프롬프트 (가이드라인 기반 강화)
   */
  getDefaultAIPrompt(rule) {
    // 가이드라인에서 관련 면책 표현 가져오기
    const mitigatingExamples = officialGuidelines?.mitigatingExpressions?.effectDisclaimer?.slice(0, 3).join(', ') || '개인차가 있을 수 있습니다, 효과를 보장하지 않습니다';
    
    return `당신은 의료광고 위반 여부를 판단하는 전문가입니다.
보건복지부 의료광고 가이드라인에 따라 다음 텍스트를 분석해주세요.

## 규칙 정보
- 규칙명: ${rule.name}
- 설명: ${rule.description}
- 법적 근거: ${rule.legal?.basis || 'N/A'}
- 처벌: ${rule.legal?.penalty || 'N/A'}

## 분석 대상
- 의심 텍스트: {text}
- 앞뒤 문맥: {context}
- 확장 문맥: {extendedContext}

## 판단 기준
1. 단순 키워드 매칭이 아닌 **문맥**을 고려하세요.
2. 다음과 같은 면책 표현이 있으면 위반이 아닐 수 있습니다: ${mitigatingExamples}
3. "~을 보장하지 않습니다", "개인차가 있습니다" 등 부정/면책 표현 확인
4. 메뉴명, UI 요소, 단순 정보 제공은 광고가 아닙니다.
5. 의료 맥락에서 사용된 것인지 확인하세요.

## 응답 형식 (JSON)
{
  "isViolation": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거를 2-3문장으로 설명",
  "mitigatingFactorsFound": ["발견된 면책 표현들"],
  "aggravatingFactorsFound": ["발견된 가중 요소들"]
}`;
  }

  /**
   * 위험도 계산
   */
  calculateRiskLevel(results) {
    const criticalCount = results.violations.filter(v => v.severity === 'critical').length;
    const warningCount = results.violations.filter(v => v.severity === 'warning').length + results.warnings.length;

    if (criticalCount >= 2 || results.totalScore < 50) {
      return 'high';
    } else if (criticalCount >= 1 || warningCount >= 3 || results.totalScore < 70) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 텍스트 정규화
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')  // 연속 공백 제거
      .trim();
  }

  /**
   * 매칭 중복 제거
   */
  deduplicateMatches(matches) {
    const seen = new Set();
    return matches.filter(match => {
      const key = `${match.position}-${match.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * UI/메뉴 요소 필터링
   * 웹사이트의 메뉴명, 네비게이션 등 광고가 아닌 요소를 제외
   */
  filterUIMenuMatches(matches, originalText) {
    return matches.filter(match => {
      // 매칭된 텍스트 주변 컨텍스트 확인
      const contextStart = Math.max(0, match.position - 30);
      const contextEnd = Math.min(originalText.length, match.position + match.text.length + 30);
      const nearbyText = originalText.substring(contextStart, contextEnd);
      
      // 1. 짧은 단독 키워드인 경우 (메뉴명 가능성 높음)
      const trimmedMatch = match.text.trim();
      
      // UI/메뉴 패턴 체크
      for (const pattern of this.uiMenuPatterns) {
        if (pattern.test(trimmedMatch)) {
          if (this.debug) {
            console.log(`[RuleEngine] UI 필터: "${trimmedMatch}" - 메뉴/UI 요소로 제외`);
          }
          return false; // 제외
        }
      }
      
      // 2. 메뉴 구조 컨텍스트 확인 (여러 짧은 단어가 연속)
      if (this.isMenuContext(nearbyText, trimmedMatch)) {
        if (this.debug) {
          console.log(`[RuleEngine] UI 필터: "${trimmedMatch}" - 메뉴 컨텍스트로 제외`);
        }
        return false;
      }
      
      // 3. 의료인의 정당한 표현 체크
      if (this.isLegitimateMedicalTerm(trimmedMatch, nearbyText)) {
        if (this.debug) {
          console.log(`[RuleEngine] 정당한 의료 표현: "${trimmedMatch}" - 제외`);
        }
        return false;
      }
      
      return true; // 유지
    });
  }

  /**
   * 메뉴 컨텍스트 판별
   * 웹사이트의 네비게이션/메뉴 영역인지 판단 (더 엄격한 기준 적용)
   */
  isMenuContext(nearbyText, matchedText) {
    // 메뉴 구분자 패턴 - 명확한 구분자만 사용
    const menuSeparators = /[|·•>]/g;
    const parts = nearbyText.split(menuSeparators).map(p => p.trim()).filter(p => p.length > 0);
    
    // 짧은 단어(2-6글자)가 4개 이상이고, 구분자가 있는 경우에만 메뉴 구조로 판단
    const hasMenuSeparators = menuSeparators.test(nearbyText);
    const shortParts = parts.filter(p => p.length <= 6 && p.length >= 2);
    
    if (hasMenuSeparators && shortParts.length >= 4) {
      // 매칭된 텍스트가 짧은 파트 중 하나이고, 정확히 일치하는 경우에만
      const matchedIsShort = matchedText.length <= 6;
      const exactMatch = shortParts.some(p => p === matchedText.trim());
      if (matchedIsShort && exactMatch) {
        return true;
      }
    }
    
    // 헤더/푸터 네비게이션 패턴 (매우 엄격하게)
    // "로그인 | 회원가입 | 마이페이지" 같은 패턴
    const navPattern = /(로그인|회원가입|마이페이지|홈|메뉴)\s*[|·•]\s*(로그인|회원가입|마이페이지|홈|메뉴)/i;
    if (navPattern.test(nearbyText)) {
      // 매칭된 텍스트가 네비게이션 키워드 중 하나인 경우에만
      const navKeywords = ['로그인', '회원가입', '마이페이지', '홈', '메뉴', '바로가기'];
      if (navKeywords.includes(matchedText.trim())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 의료인의 정당한 표현인지 확인
   */
  isLegitimateMedicalTerm(matchedText, contextText) {
    const lowerMatched = matchedText.toLowerCase();
    const lowerContext = contextText.toLowerCase();
    
    // "전문가" 표현이 의료 맥락에서 사용된 경우
    if (lowerMatched.includes('전문가') || lowerMatched.includes('전문')) {
      // 의료 전문 분야와 함께 사용된 경우 정당함
      const medicalContextKeywords = [
        '피부', '성형', '치과', '내과', '외과', '안과', '이비인후과',
        '정형외과', '신경과', '비뇨기과', '산부인과', '소아과',
        '의료진', '의사', '원장', '전문의', '진료'
      ];
      
      for (const keyword of medicalContextKeywords) {
        if (lowerContext.includes(keyword)) {
          // "피부 전문가", "치료 전문가" 등 - 정당한 표현
          return true;
        }
      }
    }
    
    // 공인된 자격 표현
    for (const term of this.legitimateMedicalTerms) {
      if (lowerMatched.includes(term.toLowerCase()) || 
          lowerContext.includes(term.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
}

module.exports = RuleEngine;
