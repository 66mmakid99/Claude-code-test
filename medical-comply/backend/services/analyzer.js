const { query } = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Claude API 클라이언트 (선택적)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 예외사례집 로드
let exceptionRules = null;
const EXCEPTION_RULES_PATH = path.join(__dirname, '../config/exception-rules.json');

function loadExceptionRules() {
  try {
    const data = fs.readFileSync(EXCEPTION_RULES_PATH, 'utf-8');
    exceptionRules = JSON.parse(data);
    console.log(`✅ 예외사례집 로드 완료 (v${exceptionRules._meta.version})`);
    return exceptionRules;
  } catch (error) {
    console.error('❌ 예외사례집 로드 실패:', error.message);
    return null;
  }
}

// 서버 시작 시 로드
loadExceptionRules();

// 예외사례집 핫 리로드 (파일 변경 감지)
fs.watch(EXCEPTION_RULES_PATH, (eventType) => {
  if (eventType === 'change') {
    console.log('🔄 예외사례집 변경 감지, 리로드 중...');
    loadExceptionRules();
  }
});

/**
 * 예외사례집 강제 리로드
 */
function reloadExceptionRules() {
  return loadExceptionRules();
}

/**
 * 현재 예외사례집 반환
 */
function getExceptionRules() {
  if (!exceptionRules) {
    loadExceptionRules();
  }
  return exceptionRules;
}

/**
 * 의료법 위반 분석
 * @param {Object} crawlData - 크롤링 데이터
 * @returns {Object} 분석 결과
 */
async function analyzeViolations(crawlData) {
  const violations = [];
  let passCount = 0;

  // 예외사례집 확인
  if (!exceptionRules) {
    loadExceptionRules();
  }

  // 1. 규칙 기반 분석 (예외사례 적용)
  const ruleBasedViolations = await analyzeWithRules(crawlData);
  violations.push(...ruleBasedViolations);

  // 2. AI 기반 분석 (Claude API가 설정된 경우)
  if (anthropic) {
    try {
      const aiViolations = await analyzeWithAI(crawlData);
      violations.push(...aiViolations);
    } catch (error) {
      console.error('AI 분석 오류:', error);
    }
  }

  // 중복 제거
  const uniqueViolations = removeDuplicates(violations);

  // 점수 계산 (100점 만점에서 위반마다 감점)
  const score = calculateScore(uniqueViolations);

  // 통과 항목 계산
  const rulesResult = await query('SELECT COUNT(*) FROM violation_rules WHERE is_active = true');
  const totalRules = parseInt(rulesResult.rows[0].count);
  passCount = Math.max(0, totalRules - uniqueViolations.length);

  return {
    score,
    violations: uniqueViolations,
    passCount,
    analyzedAt: new Date().toISOString()
  };
}

/**
 * 규칙 기반 위반 분석 (예외사례 적용)
 */
async function analyzeWithRules(crawlData) {
  const violations = [];

  // DB에서 활성화된 규칙 조회
  const rulesResult = await query(
    'SELECT * FROM violation_rules WHERE is_active = true'
  );
  const rules = rulesResult.rows;

  const textToAnalyze = crawlData.textContent.fullText.toLowerCase();
  const pageContext = detectPageContext(crawlData);

  for (const rule of rules) {
    const keywords = rule.keywords || [];
    const patterns = rule.patterns || [];
    const ruleCode = rule.code;

    // 예외사례 규칙 가져오기
    const exceptionRule = exceptionRules?.[ruleCode];

    // 키워드 검사
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        // 예외사례 체크
        const exceptionCheck = checkExceptions(
          textToAnalyze,
          keyword,
          ruleCode,
          pageContext,
          crawlData
        );

        if (exceptionCheck.isException) {
          console.log(`⚪ 예외 적용 (${ruleCode}): ${exceptionCheck.reason}`);
          continue; // 예외에 해당하면 위반으로 추가하지 않음
        }

        // Confidence 계산
        const confidence = calculateConfidence(
          textToAnalyze,
          keyword,
          ruleCode,
          exceptionCheck
        );

        // Confidence가 임계값 미만이면 '검토 필요'로 표시
        const threshold = exceptionRules?.confidenceAdjustments?.thresholds?.violation || 70;

        if (confidence < threshold) {
          console.log(`🟡 낮은 확신도 (${ruleCode}): ${confidence}% - 검토 필요로 표시`);
        }

        const location = findKeywordLocation(crawlData, keyword);
        violations.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          category: rule.category,
          severity: confidence >= threshold ? rule.severity : 'review',
          description: rule.description,
          legalBasis: rule.legal_basis,
          location: location,
          evidence: extractEvidence(textToAnalyze, keyword),
          recommendation: getRecommendation(rule.code),
          confidence: confidence,
          exceptionApplied: exceptionCheck.partialMatch ? exceptionCheck.reason : null
        });
        break; // 같은 규칙으로 중복 탐지 방지
      }
    }

    // 정규표현식 패턴 검사
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        const match = textToAnalyze.match(regex);
        if (match) {
          // 이미 키워드로 발견된 경우 스킵
          if (!violations.find(v => v.ruleCode === rule.code)) {
            // 예외사례 체크
            const exceptionCheck = checkExceptions(
              textToAnalyze,
              match[0],
              ruleCode,
              pageContext,
              crawlData
            );

            if (exceptionCheck.isException) {
              console.log(`⚪ 예외 적용 (${ruleCode}): ${exceptionCheck.reason}`);
              continue;
            }

            const confidence = calculateConfidence(
              textToAnalyze,
              match[0],
              ruleCode,
              exceptionCheck
            );

            const threshold = exceptionRules?.confidenceAdjustments?.thresholds?.violation || 70;

            violations.push({
              ruleCode: rule.code,
              ruleName: rule.name,
              category: rule.category,
              severity: confidence >= threshold ? rule.severity : 'review',
              description: rule.description,
              legalBasis: rule.legal_basis,
              location: 'Pattern match',
              evidence: match[0].substring(0, 100),
              recommendation: getRecommendation(rule.code),
              confidence: confidence,
              exceptionApplied: exceptionCheck.partialMatch ? exceptionCheck.reason : null
            });
          }
          break;
        }
      } catch (e) {
        console.error('정규표현식 오류:', pattern, e);
      }
    }
  }

  // 이미지 분석 (전후 사진) - 예외사례 적용
  const imageViolations = analyzeImages(crawlData, rules, pageContext);
  violations.push(...imageViolations);

  return violations;
}

/**
 * 이미지 분석 (예외사례 적용)
 */
function analyzeImages(crawlData, rules, pageContext) {
  const violations = [];
  const suspiciousImages = crawlData.images.filter(img => {
    // 기본 suspicious 체크
    if (!img.isSuspicious) return false;

    // 예외사례 적용
    const exceptionRule = exceptionRules?.MED002;
    if (!exceptionRule) return true;

    // URL 기반 제외
    const urlLower = img.src.toLowerCase();
    const urlExclusions = exceptionRule.imageUrlExclusions || [];
    for (const exclusion of urlExclusions) {
      if (urlLower.includes(exclusion.toLowerCase())) {
        console.log(`⚪ 이미지 예외 (URL): ${exclusion} - ${img.src}`);
        return false;
      }
    }

    // 컨텍스트 기반 제외
    const contextExclusions = exceptionRule.imageContextExclusions || [];
    for (const ctx of contextExclusions) {
      const sectionKeywords = ctx.sectionKeywords || [];
      for (const keyword of sectionKeywords) {
        if (pageContext.currentSection?.toLowerCase().includes(keyword.toLowerCase())) {
          console.log(`⚪ 이미지 예외 (컨텍스트): ${ctx.reason}`);
          return false;
        }
      }
    }

    // 의료진 소개 페이지 제외
    if (pageContext.pageType === 'staff' || pageContext.pageType === 'about') {
      console.log(`⚪ 이미지 예외 (페이지 타입): ${pageContext.pageType}`);
      return false;
    }

    return true;
  });

  if (suspiciousImages.length > 0) {
    const beforeAfterRule = rules.find(r => r.code === 'MED002');
    if (beforeAfterRule && !violations.find(v => v.ruleCode === 'MED002')) {
      // 이미지에 대한 confidence 계산
      let confidence = 50; // 기본값

      // 명시적인 before/after 패턴이 있으면 confidence 증가
      for (const img of suspiciousImages) {
        const text = `${img.alt} ${img.title} ${img.src}`.toLowerCase();
        if (/before.*after|전.*후|비교/.test(text)) {
          confidence += 20;
        }
      }

      const threshold = exceptionRules?.confidenceAdjustments?.thresholds?.violation || 70;

      violations.push({
        ruleCode: 'MED002',
        ruleName: beforeAfterRule.name,
        category: beforeAfterRule.category,
        severity: confidence >= threshold ? beforeAfterRule.severity : 'review',
        description: beforeAfterRule.description,
        legalBasis: beforeAfterRule.legal_basis,
        location: `${suspiciousImages.length}개의 의심 이미지 발견`,
        evidence: suspiciousImages.map(img => img.src).slice(0, 3).join(', '),
        recommendation: getRecommendation('MED002'),
        confidence: Math.min(100, confidence)
      });
    }
  }

  return violations;
}

/**
 * 페이지 컨텍스트 감지
 */
function detectPageContext(crawlData) {
  const url = crawlData.url.toLowerCase();
  const title = crawlData.metadata?.title?.toLowerCase() || '';
  const fullText = crawlData.textContent?.fullText?.toLowerCase() || '';

  let pageType = 'general';
  let currentSection = '';

  // URL 기반 페이지 타입 감지
  if (/staff|doctor|team|의료진|원장/.test(url)) {
    pageType = 'staff';
  } else if (/about|소개|인사말|연혁/.test(url)) {
    pageType = 'about';
  } else if (/facility|시설|장비|인테리어/.test(url)) {
    pageType = 'facility';
  } else if (/location|오시는|찾아오|위치|contact/.test(url)) {
    pageType = 'location';
  } else if (/faq|자주|질문/.test(url)) {
    pageType = 'faq';
  } else if (/privacy|개인정보|이용약관/.test(url)) {
    pageType = 'legal';
  }

  // 제목 기반 보완
  if (pageType === 'general') {
    if (/의료진|원장|전문의/.test(title)) {
      pageType = 'staff';
    } else if (/시설|장비/.test(title)) {
      pageType = 'facility';
    }
  }

  // 섹션 감지 (crawlData.textContent.sections 활용)
  const sections = crawlData.textContent?.sections || [];
  for (const section of sections) {
    if (/의료진|원장|doctor|staff/.test(section.section)) {
      currentSection = 'staff';
      break;
    } else if (/시설|facility/.test(section.section)) {
      currentSection = 'facility';
      break;
    }
  }

  return { pageType, currentSection, url, title };
}

/**
 * 예외사례 체크
 */
function checkExceptions(text, keyword, ruleCode, pageContext, crawlData) {
  const result = {
    isException: false,
    partialMatch: false,
    reason: null,
    matchedPattern: null
  };

  const exceptionRule = exceptionRules?.[ruleCode];
  if (!exceptionRule) return result;

  // 1. 허용 패턴 체크
  const allowedPatterns = exceptionRule.allowedPatterns || [];
  for (const ap of allowedPatterns) {
    try {
      const regex = new RegExp(ap.pattern, 'gi');
      if (regex.test(text)) {
        result.isException = true;
        result.reason = ap.reason;
        result.matchedPattern = ap.pattern;
        return result;
      }
    } catch (e) {
      console.error('허용 패턴 정규식 오류:', ap.pattern, e);
    }
  }

  // 2. 제외 컨텍스트 체크
  const excludedContexts = exceptionRule.excludedContexts || [];
  if (excludedContexts.includes(pageContext.pageType)) {
    result.isException = true;
    result.reason = `제외 컨텍스트: ${pageContext.pageType}`;
    return result;
  }

  // 3. 전역 제외 체크
  const globalExclusions = exceptionRules?.globalExclusions?.pageTypes || [];
  for (const ge of globalExclusions) {
    for (const pattern of ge.patterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(crawlData.url) || regex.test(crawlData.metadata?.title || '')) {
          result.isException = true;
          result.reason = ge.reason;
          return result;
        }
      } catch (e) {}
    }
  }

  // 4. 오탐지 사례 유사도 체크
  const falsePositives = exceptionRule.falsePositiveExamples || [];
  for (const fp of falsePositives) {
    const fpText = fp.text?.toLowerCase();
    if (fpText && text.includes(fpText.substring(0, 30))) {
      result.partialMatch = true;
      result.reason = `오탐지 사례 유사: ${fp.reason}`;
      // 완전 제외는 아니지만 confidence 감소에 사용
    }
  }

  return result;
}

/**
 * Confidence 점수 계산
 */
function calculateConfidence(text, keyword, ruleCode, exceptionCheck) {
  let confidence = 60; // 기본 confidence

  const adjustments = exceptionRules?.confidenceAdjustments;
  if (!adjustments) return confidence;

  // Confidence 감소 요인
  if (exceptionCheck.partialMatch) {
    confidence -= 40; // 오탐지 사례와 유사
  }

  // 위반 지표 패턴 체크 (confidence 증가)
  const exceptionRule = exceptionRules?.[ruleCode];
  const violationIndicators = exceptionRule?.violationIndicators || [];
  for (const vi of violationIndicators) {
    try {
      const regex = new RegExp(vi.pattern, 'gi');
      if (regex.test(text)) {
        confidence += 25;
        break;
      }
    } catch (e) {}
  }

  // 복수 키워드 동시 존재 시 confidence 증가
  const keywords = ['후기', '전후', '100%', '최고', '무료'];
  let keywordCount = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) keywordCount++;
  }
  if (keywordCount >= 2) {
    confidence += 15;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * AI 기반 위반 분석 (Claude API) - 예외사례 컨텍스트 포함
 */
async function analyzeWithAI(crawlData) {
  const violations = [];

  // 예외사례집 요약을 프롬프트에 포함
  const exceptionSummary = generateExceptionSummary();

  const prompt = `당신은 한국 의료법 전문가입니다. 다음 병원/의료기관 웹사이트 콘텐츠를 분석하여 의료법 위반 사항을 찾아주세요.

## 주요 검사 항목 (의료법 제56조)
1. 환자 후기/치료 후기 게시 (제56조 제2항 제3호)
2. 치료 전후 사진 게시 (제56조 제2항 제4호)
3. 치료 성공률/효과 보장 표현 (제56조 제2항 제1호)
4. 유명인/연예인 추천 (제56조 제2항 제5호)
5. 과도한 할인/이벤트 광고 (제56조 제2항 제9호)
6. 최상급/비교 표현 (최고, 최초, 1위 등) (제56조 제2항 제2호)

## 중요: 예외사례 (위반이 아닌 것)
${exceptionSummary}

## 웹사이트 콘텐츠
URL: ${crawlData.url}
제목: ${crawlData.metadata.title}

본문:
${crawlData.textContent.fullText.substring(0, 10000)}

## 응답 형식
위반 사항이 있으면 다음 JSON 배열 형식으로 응답하세요:
[
  {
    "ruleCode": "MED00X",
    "category": "카테고리명",
    "severity": "critical|warning|review",
    "evidence": "위반 증거 텍스트",
    "location": "발견 위치",
    "confidence": 0-100
  }
]

위반 사항이 없으면 빈 배열 []을 반환하세요.
JSON만 반환하고 다른 설명은 포함하지 마세요.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    // JSON 파싱
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const aiResults = JSON.parse(jsonMatch[0]);

      for (const result of aiResults) {
        violations.push({
          ruleCode: result.ruleCode || 'AI_DETECT',
          ruleName: 'AI 분석 탐지',
          category: result.category,
          severity: result.severity || 'warning',
          description: 'AI 분석을 통해 탐지된 잠재적 위반 사항',
          legalBasis: '의료법 제56조',
          location: result.location,
          evidence: result.evidence,
          recommendation: getRecommendation(result.ruleCode),
          confidence: result.confidence || 70
        });
      }
    }
  } catch (error) {
    console.error('Claude API 오류:', error);
  }

  return violations;
}

/**
 * 예외사례 요약 생성 (AI 프롬프트용)
 */
function generateExceptionSummary() {
  if (!exceptionRules) return '(예외사례집 로드 실패)';

  const summaries = [];

  for (const [code, rule] of Object.entries(exceptionRules)) {
    if (code.startsWith('MED') && rule.falsePositiveExamples) {
      const examples = rule.falsePositiveExamples.slice(0, 2);
      if (examples.length > 0) {
        summaries.push(`- ${code}: ${examples.map(e => e.reason || e.text?.substring(0, 50)).join(', ')}`);
      }
    }
  }

  return summaries.join('\n') || '(예외사례 없음)';
}

/**
 * 키워드 위치 찾기
 */
function findKeywordLocation(crawlData, keyword) {
  for (const section of crawlData.textContent.sections) {
    if (section.text.toLowerCase().includes(keyword.toLowerCase())) {
      return `${section.section} 섹션`;
    }
  }
  return '본문';
}

/**
 * 증거 텍스트 추출
 */
function extractEvidence(text, keyword) {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) return keyword;

  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + keyword.length + 30);

  return '...' + text.substring(start, end) + '...';
}

/**
 * 개선 권고사항 반환
 */
function getRecommendation(ruleCode) {
  const recommendations = {
    'MED001': '환자 후기나 치료 경험담을 삭제하거나, 객관적인 의료 정보로 대체하세요.',
    'MED002': '치료 전후 비교 사진을 즉시 삭제하세요. 대신 일반적인 시술 설명 이미지를 사용하세요.',
    'MED003': '성공률, 치료율 등의 수치 표현을 삭제하세요. "개인차가 있을 수 있습니다" 문구로 대체하세요.',
    'MED004': '유명인/연예인 관련 추천 콘텐츠를 삭제하세요.',
    'MED005': '과도한 할인이나 이벤트 문구를 수정하세요. 할인율을 명확히 표시하고 조건을 명시하세요.',
    'MED006': '최고, 최초, 1위 등의 최상급 표현을 삭제하거나 객관적인 근거를 제시하세요.',
    'MED007': '검증되지 않은 의료기기/기술에 대한 과장 표현을 삭제하세요.',
    'MED008': '전문의 자격을 정확히 표시하세요. 비전문의인 경우 전문의 표현을 삭제하세요.'
  };

  return recommendations[ruleCode] || '해당 콘텐츠를 검토하고 의료법에 맞게 수정하세요.';
}

/**
 * 중복 위반 제거
 */
function removeDuplicates(violations) {
  const seen = new Set();
  return violations.filter(v => {
    const key = `${v.ruleCode}-${v.evidence?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 점수 계산
 */
function calculateScore(violations) {
  let score = 100;

  for (const v of violations) {
    if (v.severity === 'critical') {
      score -= 15;
    } else if (v.severity === 'warning') {
      score -= 8;
    } else if (v.severity === 'review') {
      score -= 3; // 검토 필요 항목은 적은 감점
    } else {
      score -= 3;
    }
  }

  return Math.max(0, score);
}

module.exports = {
  analyzeViolations,
  getExceptionRules,
  reloadExceptionRules
};
