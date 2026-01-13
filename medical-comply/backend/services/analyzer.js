const { query } = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk');

// Claude API 클라이언트 (선택적)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * 의료법 위반 분석
 * @param {Object} crawlData - 크롤링 데이터
 * @returns {Object} 분석 결과
 */
async function analyzeViolations(crawlData) {
  const violations = [];
  let passCount = 0;

  // 1. 규칙 기반 분석
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
 * 규칙 기반 위반 분석
 */
async function analyzeWithRules(crawlData) {
  const violations = [];

  // DB에서 활성화된 규칙 조회
  const rulesResult = await query(
    'SELECT * FROM violation_rules WHERE is_active = true'
  );
  const rules = rulesResult.rows;

  const textToAnalyze = crawlData.textContent.fullText.toLowerCase();

  for (const rule of rules) {
    const keywords = rule.keywords || [];
    const patterns = rule.patterns || [];

    // 키워드 검사
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        const location = findKeywordLocation(crawlData, keyword);
        violations.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          legalBasis: rule.legal_basis,
          location: location,
          evidence: extractEvidence(textToAnalyze, keyword),
          recommendation: getRecommendation(rule.code)
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
            violations.push({
              ruleCode: rule.code,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              description: rule.description,
              legalBasis: rule.legal_basis,
              location: 'Pattern match',
              evidence: match[0].substring(0, 100),
              recommendation: getRecommendation(rule.code)
            });
          }
          break;
        }
      } catch (e) {
        console.error('정규표현식 오류:', pattern, e);
      }
    }
  }

  // 이미지 분석 (전후 사진)
  const suspiciousImages = crawlData.images.filter(img => img.isSuspicious);
  if (suspiciousImages.length > 0) {
    const beforeAfterRule = rules.find(r => r.code === 'MED002');
    if (beforeAfterRule && !violations.find(v => v.ruleCode === 'MED002')) {
      violations.push({
        ruleCode: 'MED002',
        ruleName: beforeAfterRule.name,
        category: beforeAfterRule.category,
        severity: beforeAfterRule.severity,
        description: beforeAfterRule.description,
        legalBasis: beforeAfterRule.legal_basis,
        location: `${suspiciousImages.length}개의 의심 이미지 발견`,
        evidence: suspiciousImages.map(img => img.src).slice(0, 3).join(', '),
        recommendation: getRecommendation('MED002')
      });
    }
  }

  return violations;
}

/**
 * AI 기반 위반 분석 (Claude API)
 */
async function analyzeWithAI(crawlData) {
  const violations = [];

  const prompt = `당신은 한국 의료법 전문가입니다. 다음 병원/의료기관 웹사이트 콘텐츠를 분석하여 의료법 위반 사항을 찾아주세요.

## 주요 검사 항목 (의료법 제56조)
1. 환자 후기/치료 후기 게시 (제56조 제2항 제3호)
2. 치료 전후 사진 게시 (제56조 제2항 제4호)
3. 치료 성공률/효과 보장 표현 (제56조 제2항 제1호)
4. 유명인/연예인 추천 (제56조 제2항 제5호)
5. 과도한 할인/이벤트 광고 (제56조 제2항 제9호)
6. 최상급/비교 표현 (최고, 최초, 1위 등) (제56조 제2항 제2호)

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
    "severity": "critical|warning",
    "evidence": "위반 증거 텍스트",
    "location": "발견 위치"
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
          recommendation: getRecommendation(result.ruleCode)
        });
      }
    }
  } catch (error) {
    console.error('Claude API 오류:', error);
  }

  return violations;
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
    } else {
      score -= 3;
    }
  }

  return Math.max(0, score);
}

module.exports = {
  analyzeViolations
};
