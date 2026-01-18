const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// Gemini AI 초기화
let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  console.log('✅ Gemini API 초기화 완료');
}

/**
 * Claude API 호출 함수
 * @param {string} prompt - 분석 프롬프트
 * @param {object} data - 크롤링 데이터
 * @returns {object} 분석 결과
 */
async function callClaudeAPI(prompt, data) {
  const startTime = Date.now();

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt + '\n\n[크롤링 데이터]\n' + JSON.stringify(data, null, 2) }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  });

  const text = response.data.content
    .filter(i => i.type === 'text')
    .map(i => i.text)
    .join('');

  const result = parseJSONFromText(text);
  const responseTime = Date.now() - startTime;

  // 토큰 사용량 추정 (Claude 응답에서 가져오기)
  const inputTokens = response.data.usage?.input_tokens || 0;
  const outputTokens = response.data.usage?.output_tokens || 0;

  return {
    result,
    metadata: {
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      responseTime,
      inputTokens,
      outputTokens,
      estimatedCost: calculateClaudeCost(inputTokens, outputTokens)
    }
  };
}

/**
 * Gemini API 호출 함수
 * @param {string} prompt - 분석 프롬프트
 * @param {object} data - 크롤링 데이터
 * @returns {object} 분석 결과
 */
async function callGeminiAPI(prompt, data) {
  if (!geminiModel) {
    throw new Error('Gemini API가 설정되지 않았습니다.');
  }

  const startTime = Date.now();
  const fullPrompt = prompt + '\n\n[크롤링 데이터]\n' + JSON.stringify(data, null, 2);

  const response = await geminiModel.generateContent(fullPrompt);
  const text = response.response.text();

  const result = parseJSONFromText(text);
  const responseTime = Date.now() - startTime;

  // 토큰 사용량 (Gemini는 usageMetadata에서 제공)
  const usageMetadata = response.response.usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;

  return {
    result,
    metadata: {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      responseTime,
      inputTokens,
      outputTokens,
      estimatedCost: calculateGeminiCost(inputTokens, outputTokens)
    }
  };
}

/**
 * 텍스트에서 JSON 파싱
 */
function parseJSONFromText(text) {
  let jsonStr = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    jsonStr = match[1];
  } else {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) jsonStr = text.substring(start, end + 1);
  }
  return JSON.parse(jsonStr);
}

/**
 * Claude 비용 계산 (USD)
 * Claude 3.5 Sonnet: $3/1M input, $15/1M output
 */
function calculateClaudeCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1000000) * 3;
  const outputCost = (outputTokens / 1000000) * 15;
  return {
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: (inputCost + outputCost).toFixed(6),
    currency: 'USD'
  };
}

/**
 * Gemini 비용 계산 (USD)
 * Gemini 2.0 Flash: $0.10/1M input, $0.40/1M output
 */
function calculateGeminiCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1000000) * 0.10;
  const outputCost = (outputTokens / 1000000) * 0.40;
  return {
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: (inputCost + outputCost).toFixed(6),
    currency: 'USD'
  };
}

/**
 * AI 제공자 선택 함수
 * @param {string} provider - 'claude', 'gemini', 또는 'auto'
 * @returns {string} 실제 사용할 provider
 */
function selectProvider(provider = 'auto') {
  if (provider === 'gemini' && geminiModel) return 'gemini';
  if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude';

  // auto: 환경변수 AI_PROVIDER 확인, 없으면 Claude 우선
  if (provider === 'auto') {
    const envProvider = process.env.AI_PROVIDER?.toLowerCase();
    if (envProvider === 'gemini' && geminiModel) return 'gemini';
    if (process.env.ANTHROPIC_API_KEY) return 'claude';
    if (geminiModel) return 'gemini';
  }

  return null; // API 키가 없음
}

// AEO/GEO 분석 API
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { url, prompt } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL을 입력해주세요.' });
    }

    // URL 정규화
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl;
    }

    // 분석 타입 감지 (prompt 내용으로 SEO 여부 판단)
    const isSEO = prompt && (prompt.includes('SEO') || prompt.includes('seositecheckup'));

    // 웹사이트 크롤링 (상세)
    let crawlData = {};
    let responseTime = 0;
    try {
      const startTime = Date.now();
      const response = await axios.get(targetUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MedicalComplyBot/1.0; +https://medicalcomply.com)'
        }
      });
      responseTime = Date.now() - startTime;

      const $ = cheerio.load(response.data);
      const html = response.data;

      // 기본 정보
      crawlData = {
        title: $('title').text().trim(),
        titleLength: $('title').text().trim().length,
        description: $('meta[name="description"]').attr('content') || '',
        descriptionLength: ($('meta[name="description"]').attr('content') || '').length,
        keywords: $('meta[name="keywords"]').attr('content') || '',
        viewport: $('meta[name="viewport"]').attr('content') || '',
        charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || '',
        language: $('html').attr('lang') || '',
        canonical: $('link[rel="canonical"]').attr('href') || '',

        // 헤딩 구조
        h1: $('h1').first().text().trim(),
        h1Count: $('h1').length,
        h2Count: $('h2').length,
        h3Count: $('h3').length,

        // 구조화 데이터
        hasSchema: $('script[type="application/ld+json"]').length > 0,
        schemaTypes: [],

        // Open Graph
        hasOG: $('meta[property^="og:"]').length > 0,
        ogTitle: $('meta[property="og:title"]').attr('content') || '',
        ogDescription: $('meta[property="og:description"]').attr('content') || '',
        ogImage: $('meta[property="og:image"]').attr('content') || '',
        ogUrl: $('meta[property="og:url"]').attr('content') || '',
        ogType: $('meta[property="og:type"]').attr('content') || '',

        // Twitter
        twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
        twitterTitle: $('meta[name="twitter:title"]').attr('content') || '',
        twitterImage: $('meta[name="twitter:image"]').attr('content') || '',

        // 기타
        hasFAQ: $('*:contains("FAQ")').length > 0 || $('*:contains("자주 묻는")').length > 0,
        hasSitemap: false,
        hasRobotsTxt: false,
        ssl: targetUrl.startsWith('https'),
        favicon: $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || '',

        // 성능 관련
        responseTime: responseTime,
        htmlSize: html.length,

        // 이미지 분석
        totalImages: $('img').length,
        imagesWithAlt: $('img[alt]').filter((i, el) => $(el).attr('alt').trim() !== '').length,
        imagesWithoutAlt: $('img').filter((i, el) => !$(el).attr('alt') || $(el).attr('alt').trim() === '').length,

        // 링크 분석
        internalLinks: $('a[href^="/"], a[href^="' + targetUrl + '"]').length,
        externalLinks: $('a[href^="http"]').filter((i, el) => !$(el).attr('href').includes(new URL(targetUrl).hostname)).length,

        bodyText: $('body').text().slice(0, 5000)
      };

      // Schema.org 타입 추출
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($(el).html());
          if (json['@type']) crawlData.schemaTypes.push(json['@type']);
        } catch (e) {}
      });

      // sitemap 확인
      try {
        const sitemapRes = await axios.get(targetUrl.replace(/\/$/, '') + '/sitemap.xml', { timeout: 5000 });
        crawlData.hasSitemap = sitemapRes.status === 200;
      } catch (e) {
        crawlData.hasSitemap = false;
      }

      // robots.txt 확인
      try {
        const robotsRes = await axios.get(new URL(targetUrl).origin + '/robots.txt', { timeout: 5000 });
        crawlData.hasRobotsTxt = robotsRes.status === 200;
        crawlData.robotsTxtContent = robotsRes.data.slice(0, 500);
      } catch (e) {
        crawlData.hasRobotsTxt = false;
      }

    } catch (crawlError) {
      console.log('크롤링 실패, 기본 분석 진행:', crawlError.message);
      crawlData.crawlError = crawlError.message;
    }

    // Claude API가 설정되어 있으면 사용
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicResponse = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt + '\n\n[크롤링 데이터]\n' + JSON.stringify(crawlData, null, 2) }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        });

        const text = anthropicResponse.data.content
          .filter(i => i.type === 'text')
          .map(i => i.text)
          .join('');

        let jsonStr = text;
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonStr = match[1];
        } else {
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start !== -1 && end !== -1) jsonStr = text.substring(start, end + 1);
        }

        const result = JSON.parse(jsonStr);
        return res.json({ result });
      } catch (apiError) {
        console.log('Claude API 오류, 규칙 기반 분석으로 대체:', apiError.message);
      }
    }

    // 규칙 기반 분석 (API 키 없거나 실패 시)
    const result = isSEO ? analyzeSEOWithRules(targetUrl, crawlData) : analyzeWithRules(targetUrl, crawlData);
    res.json({ result });

  } catch (error) {
    console.error('AEO 분석 오류:', error);
    res.status(500).json({ error: 'AEO 분석 중 오류가 발생했습니다.', detail: error.message });
  }
});

// 규칙 기반 분석 함수
function analyzeWithRules(url, data) {
  const hostname = new URL(url).hostname;

  // 구조 분석
  const structureItems = [
    {
      id: 'schema',
      name: 'Schema.org 구조화 데이터',
      points: data.hasSchema ? 7 : 2,
      status: data.hasSchema ? 'pass' : 'fail',
      detail: data.hasSchema ? 'JSON-LD 형식의 구조화 데이터가 있습니다.' : '구조화 데이터가 없습니다. Schema.org 마크업 추가를 권장합니다.'
    },
    {
      id: 'heading',
      name: 'H1-H6 헤딩 구조',
      points: data.h1 ? 5 : 2,
      status: data.h1 ? 'pass' : 'warning',
      detail: data.h1 ? `H1 태그가 있습니다: "${data.h1.slice(0, 50)}"` : 'H1 태그가 없거나 비어있습니다.'
    },
    {
      id: 'meta',
      name: '메타 타이틀/디스크립션',
      points: (data.title && data.description) ? 5 : (data.title ? 3 : 1),
      status: (data.title && data.description) ? 'pass' : 'warning',
      detail: data.description ? `메타 설명: "${data.description.slice(0, 60)}..."` : '메타 디스크립션이 없습니다.'
    },
    {
      id: 'og',
      name: 'Open Graph 태그',
      points: data.hasOG ? 4 : 1,
      status: data.hasOG ? 'pass' : 'fail',
      detail: data.hasOG ? 'Open Graph 태그가 설정되어 있습니다.' : 'OG 태그가 없습니다. SNS 공유 최적화를 위해 추가하세요.'
    }
  ];

  // 콘텐츠 분석
  const bodyText = data.bodyText || '';
  const hasFAQ = data.hasFAQ || bodyText.includes('FAQ') || bodyText.includes('자주 묻는');
  const hasStats = /\d+%|\d+명|\d+건|\d+원/.test(bodyText);

  const contentItems = [
    {
      id: 'faq',
      name: 'FAQ/Q&A 형식',
      points: hasFAQ ? 7 : 2,
      status: hasFAQ ? 'pass' : 'warning',
      detail: hasFAQ ? 'FAQ 또는 Q&A 섹션이 발견되었습니다.' : 'FAQ 섹션이 없습니다. AI가 답변을 찾기 쉽도록 Q&A 형식 추가를 권장합니다.'
    },
    {
      id: 'definition',
      name: '명확한 정의/설명',
      points: data.h2Count >= 3 ? 6 : 3,
      status: data.h2Count >= 3 ? 'pass' : 'warning',
      detail: `${data.h2Count}개의 H2 섹션이 있습니다. ${data.h2Count >= 3 ? '콘텐츠가 잘 구조화되어 있습니다.' : '더 많은 섹션으로 콘텐츠를 나누세요.'}`
    },
    {
      id: 'data',
      name: '통계/수치 데이터',
      points: hasStats ? 4 : 1,
      status: hasStats ? 'pass' : 'warning',
      detail: hasStats ? '통계 및 수치 데이터가 포함되어 있습니다.' : '구체적인 통계나 수치 데이터 추가를 권장합니다.'
    },
    {
      id: 'update',
      name: '업데이트 날짜',
      points: 3,
      status: 'warning',
      detail: '콘텐츠 업데이트 날짜 표시를 권장합니다.'
    }
  ];

  // 기술 분석
  const technicalItems = [
    {
      id: 'speed',
      name: '페이지 로딩 속도',
      points: 5,
      status: 'warning',
      detail: '로딩 속도는 실제 측정이 필요합니다. Google PageSpeed Insights 사용을 권장합니다.'
    },
    {
      id: 'mobile',
      name: '모바일 최적화',
      points: 5,
      status: 'warning',
      detail: '모바일 반응형 디자인 적용을 확인하세요.'
    },
    {
      id: 'robots',
      name: 'AI 크롤러 허용',
      points: 4,
      status: 'warning',
      detail: 'robots.txt에서 AI 크롤러(GPTBot, ClaudeBot 등) 허용 여부를 확인하세요.'
    },
    {
      id: 'sitemap',
      name: 'Sitemap.xml',
      points: data.hasSitemap ? 4 : 1,
      status: data.hasSitemap ? 'pass' : 'fail',
      detail: data.hasSitemap ? 'sitemap.xml이 있습니다.' : 'sitemap.xml이 없습니다. 검색엔진 인덱싱을 위해 추가하세요.'
    }
  ];

  // 신뢰도 분석
  const hasContact = bodyText.includes('연락처') || bodyText.includes('전화') || bodyText.includes('이메일') || /\d{2,3}-\d{3,4}-\d{4}/.test(bodyText);

  const trustItems = [
    {
      id: 'author',
      name: '저자/전문가 정보',
      points: 4,
      status: 'warning',
      detail: '의료 콘텐츠의 경우 전문 의료진 정보를 명시하세요.'
    },
    {
      id: 'source',
      name: '출처/참고문헌',
      points: 3,
      status: 'warning',
      detail: '의학적 주장에 대한 출처와 참고문헌을 추가하세요.'
    },
    {
      id: 'contact',
      name: '연락처/회사 정보',
      points: hasContact ? 5 : 2,
      status: hasContact ? 'pass' : 'warning',
      detail: hasContact ? '연락처 정보가 있습니다.' : '연락처 정보를 명확히 표시하세요.'
    },
    {
      id: 'ssl',
      name: 'SSL 인증서',
      points: data.ssl ? 5 : 0,
      status: data.ssl ? 'pass' : 'fail',
      detail: data.ssl ? 'HTTPS가 적용되어 있습니다.' : 'HTTPS가 적용되지 않았습니다. SSL 인증서를 설치하세요.'
    }
  ];

  const categories = {
    structure: {
      score: structureItems.reduce((s, i) => s + i.points, 0),
      items: structureItems
    },
    content: {
      score: contentItems.reduce((s, i) => s + i.points, 0),
      items: contentItems
    },
    technical: {
      score: technicalItems.reduce((s, i) => s + i.points, 0),
      items: technicalItems
    },
    trust: {
      score: trustItems.reduce((s, i) => s + i.points, 0),
      items: trustItems
    }
  };

  // 주요 이슈 및 권고사항
  const topIssues = [];
  const recommendations = [];

  if (!data.hasSchema) topIssues.push('Schema.org 구조화 데이터가 없어 AI가 콘텐츠를 이해하기 어렵습니다.');
  if (!data.hasOG) topIssues.push('Open Graph 태그가 없어 SNS 공유 시 미리보기가 제대로 표시되지 않습니다.');
  if (!data.hasSitemap) topIssues.push('sitemap.xml이 없어 검색엔진 인덱싱이 원활하지 않을 수 있습니다.');

  recommendations.push('Schema.org의 MedicalBusiness 또는 Hospital 타입 구조화 데이터를 추가하세요.');
  recommendations.push('FAQ 페이지를 만들고 FAQPage 스키마를 적용하세요.');
  recommendations.push('의료진 프로필에 Person 스키마를 적용하세요.');
  recommendations.push('진료과목별 상세 페이지를 만들어 콘텐츠를 풍부하게 하세요.');
  recommendations.push('블로그나 건강정보 섹션을 추가하여 전문성을 보여주세요.');

  return {
    siteName: data.title || hostname,
    siteDescription: data.description || `${hostname} 웹사이트 AEO/GEO 분석 결과`,
    categories,
    topIssues,
    recommendations,
    analyzedAt: new Date().toISOString()
  };
}

// SEO 규칙 기반 분석 함수 (seositecheckup.com 스타일)
function analyzeSEOWithRules(url, data) {
  const hostname = new URL(url).hostname;

  // 점수 계산 헬퍼
  const calcScore = (condition, max, partial = 0) => condition ? max : partial;

  // 1. Common SEO Issues (20점)
  const commonItems = [
    {
      id: 'title_tag',
      name: 'Title 태그',
      maxPoints: 5,
      points: data.title ? (data.titleLength >= 30 && data.titleLength <= 60 ? 5 : 3) : 0,
      status: data.title ? (data.titleLength >= 30 && data.titleLength <= 60 ? 'pass' : 'warning') : 'fail',
      value: data.title || null,
      detail: data.title
        ? `Title 태그가 있습니다. (${data.titleLength}자) ${data.titleLength < 30 ? '너무 짧습니다.' : data.titleLength > 60 ? '권장 길이(50-60자)를 초과합니다.' : '적절한 길이입니다.'}`
        : 'Title 태그가 없습니다.',
      impact: 'Title 태그는 검색 순위와 CTR에 가장 큰 영향을 미치는 요소입니다. 최적화되지 않으면 클릭률이 15-25% 감소할 수 있습니다.',
      solution: data.title
        ? '핵심 키워드를 앞에 배치하고 50-60자 이내로 작성하세요.'
        : '<title>페이지 제목 | 브랜드명</title> 형태로 title 태그를 추가하세요.',
      learnMore: 'Title 태그는 검색 결과의 제목으로 표시되며, 사용자의 첫인상을 결정합니다.'
    },
    {
      id: 'meta_description',
      name: 'Meta Description',
      maxPoints: 5,
      points: data.description ? (data.descriptionLength >= 120 && data.descriptionLength <= 160 ? 5 : 3) : 0,
      status: data.description ? (data.descriptionLength >= 120 && data.descriptionLength <= 160 ? 'pass' : 'warning') : 'fail',
      value: data.description || null,
      detail: data.description
        ? `Meta Description이 있습니다. (${data.descriptionLength}자) ${data.descriptionLength < 120 ? '너무 짧습니다.' : data.descriptionLength > 160 ? '권장 길이(150-160자)를 초과합니다.' : '적절한 길이입니다.'}`
        : 'Meta Description이 없습니다.',
      impact: 'Meta Description이 없으면 검색엔진이 페이지 내용을 임의로 추출하여 표시하며, CTR이 최대 30% 감소합니다.',
      solution: data.description
        ? '클릭을 유도하는 문구와 핵심 키워드를 포함하여 150-160자로 작성하세요.'
        : '<meta name="description" content="페이지 설명..."> 형태로 추가하세요.',
      learnMore: 'Meta Description은 검색 결과의 스니펫으로 표시되어 클릭을 유도합니다.'
    },
    {
      id: 'heading_tags',
      name: 'H1 태그',
      maxPoints: 4,
      points: data.h1Count === 1 ? 4 : (data.h1Count > 1 ? 2 : 0),
      status: data.h1Count === 1 ? 'pass' : (data.h1Count > 1 ? 'warning' : 'fail'),
      value: data.h1 || null,
      detail: data.h1Count === 1
        ? `H1 태그가 1개 있습니다: "${data.h1?.slice(0, 50)}"`
        : data.h1Count > 1
          ? `H1 태그가 ${data.h1Count}개 있습니다. 페이지당 1개만 사용하세요.`
          : 'H1 태그가 없습니다.',
      impact: 'H1 태그는 페이지의 주제를 검색엔진에 알려주는 중요한 요소입니다. 없거나 여러 개면 SEO에 부정적입니다.',
      solution: data.h1Count === 0
        ? '<h1>페이지 주요 제목</h1> 형태로 H1 태그를 추가하세요.'
        : data.h1Count > 1
          ? '가장 중요한 제목만 H1으로 남기고 나머지는 H2로 변경하세요.'
          : null,
      learnMore: 'H1 태그는 페이지당 1개만 사용하며, 페이지의 주요 주제를 나타내야 합니다.'
    },
    {
      id: 'robots_txt',
      name: 'Robots.txt',
      maxPoints: 3,
      points: data.hasRobotsTxt ? 3 : 0,
      status: data.hasRobotsTxt ? 'pass' : 'fail',
      value: data.hasRobotsTxt ? '발견됨' : null,
      detail: data.hasRobotsTxt
        ? 'robots.txt 파일이 있습니다.'
        : 'robots.txt 파일이 없습니다.',
      impact: 'robots.txt가 없으면 검색엔진이 불필요한 페이지까지 크롤링하여 크롤링 예산을 낭비합니다.',
      solution: 'User-agent: *\nDisallow: /admin/\nSitemap: https://yoursite.com/sitemap.xml 형태로 robots.txt를 추가하세요.',
      learnMore: 'robots.txt는 검색엔진 크롤러의 접근을 제어하는 파일입니다.'
    },
    {
      id: 'sitemap_xml',
      name: 'XML Sitemap',
      maxPoints: 3,
      points: data.hasSitemap ? 3 : 0,
      status: data.hasSitemap ? 'pass' : 'fail',
      value: data.hasSitemap ? '발견됨' : null,
      detail: data.hasSitemap
        ? 'sitemap.xml이 있습니다.'
        : 'sitemap.xml이 없습니다.',
      impact: 'Sitemap이 없으면 검색엔진이 모든 페이지를 찾기 어려워 인덱싱이 느려집니다.',
      solution: 'sitemap.xml을 생성하고 Google Search Console에 등록하세요.',
      learnMore: 'XML Sitemap은 검색엔진에 사이트의 모든 페이지를 알려주는 파일입니다.'
    }
  ];

  // 2. Meta Tags (15점)
  const metaItems = [
    {
      id: 'meta_viewport',
      name: 'Viewport 설정',
      maxPoints: 3,
      points: data.viewport ? 3 : 0,
      status: data.viewport ? 'pass' : 'fail',
      value: data.viewport || null,
      detail: data.viewport
        ? `Viewport가 설정되어 있습니다: ${data.viewport}`
        : 'Viewport 메타 태그가 없습니다.',
      impact: 'Viewport가 없으면 모바일에서 페이지가 제대로 표시되지 않아 모바일 순위가 하락합니다.',
      solution: '<meta name="viewport" content="width=device-width, initial-scale=1.0">를 추가하세요.',
      learnMore: 'Viewport는 모바일 반응형 웹사이트의 필수 요소입니다.'
    },
    {
      id: 'meta_charset',
      name: 'Character Encoding',
      maxPoints: 2,
      points: data.charset ? 2 : 0,
      status: data.charset ? 'pass' : 'fail',
      value: data.charset || null,
      detail: data.charset
        ? `문자 인코딩이 설정되어 있습니다: ${data.charset}`
        : '문자 인코딩이 설정되지 않았습니다.',
      impact: '인코딩이 없으면 한글 등이 깨져 보일 수 있습니다.',
      solution: '<meta charset="UTF-8">를 <head> 최상단에 추가하세요.',
      learnMore: 'UTF-8은 전 세계 모든 문자를 지원하는 표준 인코딩입니다.'
    },
    {
      id: 'meta_language',
      name: 'Language 설정',
      maxPoints: 2,
      points: data.language ? 2 : 0,
      status: data.language ? 'pass' : 'fail',
      value: data.language || null,
      detail: data.language
        ? `언어가 설정되어 있습니다: ${data.language}`
        : 'HTML lang 속성이 없습니다.',
      impact: '언어 설정이 없으면 검색엔진이 콘텐츠 언어를 파악하기 어렵습니다.',
      solution: '<html lang="ko"> 형태로 언어를 지정하세요.',
      learnMore: 'lang 속성은 스크린 리더와 검색엔진이 콘텐츠 언어를 파악하는 데 사용됩니다.'
    },
    {
      id: 'canonical_url',
      name: 'Canonical URL',
      maxPoints: 3,
      points: data.canonical ? 3 : 0,
      status: data.canonical ? 'pass' : 'warning',
      value: data.canonical || null,
      detail: data.canonical
        ? `Canonical URL이 설정되어 있습니다: ${data.canonical}`
        : 'Canonical URL이 설정되지 않았습니다.',
      impact: 'Canonical이 없으면 중복 콘텐츠로 인해 검색 순위가 분산될 수 있습니다.',
      solution: '<link rel="canonical" href="https://yoursite.com/page">를 추가하세요.',
      learnMore: 'Canonical URL은 여러 URL이 같은 콘텐츠를 가리킬 때 대표 URL을 지정합니다.'
    },
    {
      id: 'favicon',
      name: 'Favicon',
      maxPoints: 2,
      points: data.favicon ? 2 : 0,
      status: data.favicon ? 'pass' : 'warning',
      value: data.favicon || null,
      detail: data.favicon
        ? `Favicon이 설정되어 있습니다.`
        : 'Favicon이 없습니다.',
      impact: 'Favicon이 없으면 브라우저 탭과 북마크에서 사이트를 구분하기 어렵습니다.',
      solution: '<link rel="icon" href="/favicon.ico">를 추가하세요.',
      learnMore: 'Favicon은 브랜드 인지도를 높이고 사용자 경험을 개선합니다.'
    },
    {
      id: 'meta_keywords',
      name: 'Meta Keywords',
      maxPoints: 3,
      points: data.keywords ? 2 : 1,
      status: data.keywords ? 'pass' : 'warning',
      value: data.keywords || '설정되지 않음 (참고용)',
      detail: data.keywords
        ? `Meta Keywords가 있습니다: ${data.keywords.slice(0, 50)}...`
        : 'Meta Keywords가 없습니다. (SEO 영향 낮음)',
      impact: '대부분의 검색엔진은 meta keywords를 무시하지만, 일부 서비스에서는 참고할 수 있습니다.',
      solution: '필수는 아니지만, 주요 키워드를 콤마로 구분하여 추가할 수 있습니다.',
      learnMore: 'Meta Keywords는 과거에 중요했으나 현재 Google은 무시합니다.'
    }
  ];

  // 3. Social Media (15점)
  const socialItems = [
    {
      id: 'og_title',
      name: 'OG:Title',
      maxPoints: 3,
      points: data.ogTitle ? 3 : 0,
      status: data.ogTitle ? 'pass' : 'fail',
      value: data.ogTitle || null,
      detail: data.ogTitle
        ? `Open Graph 제목이 설정되어 있습니다: ${data.ogTitle}`
        : 'OG:Title이 없습니다.',
      impact: 'SNS 공유 시 제목이 제대로 표시되지 않아 클릭률이 감소합니다.',
      solution: '<meta property="og:title" content="페이지 제목">를 추가하세요.',
      learnMore: 'Open Graph는 Facebook, LinkedIn 등에서 공유 시 미리보기를 결정합니다.'
    },
    {
      id: 'og_description',
      name: 'OG:Description',
      maxPoints: 3,
      points: data.ogDescription ? 3 : 0,
      status: data.ogDescription ? 'pass' : 'fail',
      value: data.ogDescription || null,
      detail: data.ogDescription
        ? `Open Graph 설명이 설정되어 있습니다.`
        : 'OG:Description이 없습니다.',
      impact: 'SNS 공유 시 설명이 없거나 부적절하게 표시됩니다.',
      solution: '<meta property="og:description" content="페이지 설명">를 추가하세요.',
      learnMore: 'OG Description은 SNS에서 공유될 때 표시되는 설명입니다.'
    },
    {
      id: 'og_image',
      name: 'OG:Image',
      maxPoints: 3,
      points: data.ogImage ? 3 : 0,
      status: data.ogImage ? 'pass' : 'fail',
      value: data.ogImage || null,
      detail: data.ogImage
        ? `Open Graph 이미지가 설정되어 있습니다.`
        : 'OG:Image가 없습니다.',
      impact: '이미지가 없으면 SNS 공유 시 클릭률이 40% 이상 감소합니다.',
      solution: '1200x630px 크기의 이미지를 준비하고 <meta property="og:image" content="URL">를 추가하세요.',
      learnMore: 'OG Image는 SNS에서 가장 눈에 띄는 요소이며, 1200x630px이 권장됩니다.'
    },
    {
      id: 'og_url',
      name: 'OG:URL',
      maxPoints: 2,
      points: data.ogUrl ? 2 : 0,
      status: data.ogUrl ? 'pass' : 'warning',
      value: data.ogUrl || null,
      detail: data.ogUrl
        ? `OG URL이 설정되어 있습니다: ${data.ogUrl}`
        : 'OG:URL이 없습니다.',
      impact: 'OG URL이 없으면 공유 URL이 일관되지 않을 수 있습니다.',
      solution: '<meta property="og:url" content="https://yoursite.com/page">를 추가하세요.',
      learnMore: 'OG URL은 공유될 때 표시되는 정식 URL입니다.'
    },
    {
      id: 'twitter_card',
      name: 'Twitter Card',
      maxPoints: 2,
      points: data.twitterCard ? 2 : 0,
      status: data.twitterCard ? 'pass' : 'fail',
      value: data.twitterCard || null,
      detail: data.twitterCard
        ? `Twitter Card가 설정되어 있습니다: ${data.twitterCard}`
        : 'Twitter Card가 없습니다.',
      impact: 'Twitter에서 공유 시 카드 형태로 표시되지 않아 클릭률이 감소합니다.',
      solution: '<meta name="twitter:card" content="summary_large_image">를 추가하세요.',
      learnMore: 'Twitter Card는 Twitter에서 링크 공유 시 표시 형태를 결정합니다.'
    },
    {
      id: 'twitter_image',
      name: 'Twitter Image',
      maxPoints: 2,
      points: data.twitterImage ? 2 : 0,
      status: data.twitterImage ? 'pass' : 'warning',
      value: data.twitterImage || null,
      detail: data.twitterImage
        ? `Twitter 이미지가 설정되어 있습니다.`
        : 'Twitter Image가 없습니다.',
      impact: 'Twitter 공유 시 이미지가 제대로 표시되지 않습니다.',
      solution: '<meta name="twitter:image" content="이미지URL">를 추가하세요.',
      learnMore: 'Twitter Image가 없으면 OG Image를 대신 사용합니다.'
    }
  ];

  // 4. Speed & Performance (15점)
  const speedItems = [
    {
      id: 'page_load_time',
      name: '서버 응답 시간',
      maxPoints: 5,
      points: data.responseTime ? (data.responseTime < 1000 ? 5 : data.responseTime < 2000 ? 3 : 1) : 2,
      status: data.responseTime ? (data.responseTime < 1000 ? 'pass' : data.responseTime < 2000 ? 'warning' : 'fail') : 'warning',
      value: data.responseTime ? `${data.responseTime}ms` : '측정 실패',
      detail: data.responseTime
        ? `서버 응답 시간: ${data.responseTime}ms ${data.responseTime < 1000 ? '(양호)' : data.responseTime < 2000 ? '(보통)' : '(느림)'}`
        : '응답 시간을 측정할 수 없습니다.',
      impact: '서버 응답이 2초를 초과하면 이탈률이 32% 증가합니다.',
      solution: data.responseTime > 1000 ? '서버 성능 최적화, CDN 사용, 캐싱 적용을 권장합니다.' : '현재 응답 시간이 양호합니다.',
      learnMore: 'Google은 TTFB(Time To First Byte) 200ms 이하를 권장합니다.'
    },
    {
      id: 'html_size',
      name: 'HTML 크기',
      maxPoints: 3,
      points: data.htmlSize ? (data.htmlSize < 100000 ? 3 : data.htmlSize < 200000 ? 2 : 1) : 2,
      status: data.htmlSize ? (data.htmlSize < 100000 ? 'pass' : data.htmlSize < 200000 ? 'warning' : 'fail') : 'warning',
      value: data.htmlSize ? `${Math.round(data.htmlSize / 1024)}KB` : '측정 실패',
      detail: data.htmlSize
        ? `HTML 크기: ${Math.round(data.htmlSize / 1024)}KB ${data.htmlSize < 100000 ? '(양호)' : '(최적화 권장)'}`
        : 'HTML 크기를 측정할 수 없습니다.',
      impact: 'HTML이 너무 크면 파싱 시간이 길어져 렌더링이 지연됩니다.',
      solution: '불필요한 공백 제거, HTML 압축, 인라인 스타일 최소화를 권장합니다.',
      learnMore: 'HTML은 100KB 이하가 권장되며, gzip 압축 사용이 필수입니다.'
    },
    {
      id: 'image_optimization',
      name: '이미지 최적화',
      maxPoints: 4,
      points: data.totalImages > 0 ? (data.imagesWithAlt >= data.totalImages * 0.8 ? 4 : 2) : 3,
      status: data.totalImages > 0 ? (data.imagesWithAlt >= data.totalImages * 0.8 ? 'pass' : 'warning') : 'pass',
      value: `${data.imagesWithAlt || 0}/${data.totalImages || 0} 이미지에 alt 속성`,
      detail: data.totalImages > 0
        ? `총 ${data.totalImages}개 이미지 중 ${data.imagesWithAlt}개에 alt 속성이 있습니다.`
        : '이미지가 없거나 감지되지 않았습니다.',
      impact: 'alt 속성이 없으면 이미지 검색에서 제외되고 접근성이 떨어집니다.',
      solution: '모든 이미지에 설명적인 alt 텍스트를 추가하세요.',
      learnMore: 'alt 속성은 SEO와 웹 접근성 모두에 중요합니다.'
    },
    {
      id: 'compression',
      name: '리소스 압축',
      maxPoints: 3,
      points: 2,
      status: 'warning',
      value: '직접 확인 필요',
      detail: 'CSS/JS 압축 및 gzip 사용 여부는 개발자 도구에서 확인하세요.',
      impact: '압축하지 않은 리소스는 다운로드 시간을 2-3배 늘립니다.',
      solution: 'gzip/brotli 압축을 활성화하고, CSS/JS를 minify하세요.',
      learnMore: 'gzip은 텍스트 리소스를 70-90% 압축할 수 있습니다.'
    }
  ];

  // 5. Security (15점)
  const securityItems = [
    {
      id: 'https_enabled',
      name: 'HTTPS',
      maxPoints: 6,
      points: data.ssl ? 6 : 0,
      status: data.ssl ? 'pass' : 'fail',
      value: data.ssl ? 'HTTPS 활성화됨' : 'HTTP만 사용',
      detail: data.ssl
        ? 'HTTPS가 적용되어 있습니다.'
        : 'HTTPS가 적용되지 않았습니다.',
      impact: 'HTTPS가 없으면 "안전하지 않음" 경고가 표시되고 Google 순위가 하락합니다.',
      solution: 'SSL 인증서를 설치하고 HTTPS로 리다이렉트하세요. Let\'s Encrypt는 무료입니다.',
      learnMore: 'Google은 2014년부터 HTTPS를 순위 요소로 사용하고 있습니다.'
    },
    {
      id: 'ssl_certificate',
      name: 'SSL 인증서',
      maxPoints: 4,
      points: data.ssl ? 4 : 0,
      status: data.ssl ? 'pass' : 'fail',
      value: data.ssl ? '유효함' : '없음',
      detail: data.ssl
        ? 'SSL 인증서가 유효합니다.'
        : 'SSL 인증서가 없습니다.',
      impact: '유효하지 않은 SSL은 브라우저 경고를 발생시켜 이탈률을 높입니다.',
      solution: 'SSL 인증서 만료일을 확인하고 자동 갱신을 설정하세요.',
      learnMore: 'SSL 인증서는 데이터 암호화와 신뢰성을 보장합니다.'
    },
    {
      id: 'mixed_content',
      name: 'Mixed Content',
      maxPoints: 3,
      points: data.ssl ? 3 : 0,
      status: data.ssl ? 'pass' : 'warning',
      value: data.ssl ? '확인 필요' : 'HTTPS 미적용',
      detail: 'HTTPS 페이지에서 HTTP 리소스 로드 여부를 확인하세요.',
      impact: 'Mixed Content는 보안 경고를 발생시키고 일부 리소스가 차단됩니다.',
      solution: '모든 리소스(이미지, 스크립트, CSS)를 HTTPS로 로드하세요.',
      learnMore: 'Mixed Content는 브라우저에서 차단되거나 경고가 표시됩니다.'
    },
    {
      id: 'security_headers',
      name: '보안 헤더',
      maxPoints: 2,
      points: 1,
      status: 'warning',
      value: '확인 필요',
      detail: 'X-Frame-Options, CSP 등 보안 헤더를 확인하세요.',
      impact: '보안 헤더가 없으면 XSS, 클릭재킹 등의 공격에 취약합니다.',
      solution: 'Content-Security-Policy, X-Frame-Options 등을 설정하세요.',
      learnMore: '보안 헤더는 웹 애플리케이션 보안의 기본 요소입니다.'
    }
  ];

  // 6. Mobile (10점)
  const mobileItems = [
    {
      id: 'mobile_responsive',
      name: '반응형 디자인',
      maxPoints: 4,
      points: data.viewport ? 4 : 0,
      status: data.viewport ? 'pass' : 'fail',
      value: data.viewport ? 'Viewport 설정됨' : 'Viewport 미설정',
      detail: data.viewport
        ? '모바일 반응형 기본 설정이 되어 있습니다.'
        : 'Viewport가 없어 모바일 최적화가 안 되어 있습니다.',
      impact: '모바일 최적화가 안 되면 모바일 검색에서 순위가 크게 하락합니다.',
      solution: 'Viewport 메타 태그와 반응형 CSS를 적용하세요.',
      learnMore: 'Google은 모바일 우선 인덱싱(Mobile-First Indexing)을 사용합니다.'
    },
    {
      id: 'touch_elements',
      name: '터치 요소 크기',
      maxPoints: 2,
      points: 1,
      status: 'warning',
      value: '직접 확인 필요',
      detail: '터치 대상(버튼, 링크)이 48x48px 이상인지 확인하세요.',
      impact: '터치 요소가 너무 작으면 모바일 사용자 경험이 저하됩니다.',
      solution: '버튼과 링크의 최소 크기를 48x48px로 설정하세요.',
      learnMore: 'Google은 터치 대상 최소 크기를 48x48px로 권장합니다.'
    },
    {
      id: 'font_legibility',
      name: '폰트 가독성',
      maxPoints: 2,
      points: 1,
      status: 'warning',
      value: '직접 확인 필요',
      detail: '모바일에서 폰트 크기가 16px 이상인지 확인하세요.',
      impact: '폰트가 너무 작으면 확대해야 해서 사용자 경험이 나빠집니다.',
      solution: '본문 폰트를 최소 16px로 설정하세요.',
      learnMore: '모바일에서는 16px 이상의 폰트가 권장됩니다.'
    },
    {
      id: 'mobile_viewport_config',
      name: 'Viewport 설정',
      maxPoints: 2,
      points: data.viewport?.includes('width=device-width') ? 2 : 0,
      status: data.viewport?.includes('width=device-width') ? 'pass' : 'warning',
      value: data.viewport || '미설정',
      detail: data.viewport?.includes('width=device-width')
        ? 'Viewport가 올바르게 설정되어 있습니다.'
        : 'Viewport 설정을 확인하세요.',
      impact: '잘못된 Viewport 설정은 모바일 레이아웃 문제를 일으킵니다.',
      solution: 'width=device-width, initial-scale=1.0을 포함하세요.',
      learnMore: '올바른 Viewport 설정은 모바일 반응형의 핵심입니다.'
    }
  ];

  // 7. Advanced (10점)
  const advancedItems = [
    {
      id: 'schema_markup',
      name: 'Schema.org 구조화 데이터',
      maxPoints: 4,
      points: data.hasSchema ? 4 : 0,
      status: data.hasSchema ? 'pass' : 'fail',
      value: data.schemaTypes?.length > 0 ? data.schemaTypes.join(', ') : null,
      detail: data.hasSchema
        ? `구조화 데이터가 있습니다: ${data.schemaTypes?.join(', ') || 'JSON-LD 감지됨'}`
        : '구조화 데이터가 없습니다.',
      impact: '구조화 데이터가 있으면 리치 스니펫으로 표시되어 CTR이 30% 증가합니다.',
      solution: 'Schema.org의 Organization, LocalBusiness 등 스키마를 추가하세요.',
      learnMore: '구조화 데이터는 검색 결과에서 별점, FAQ 등을 표시할 수 있게 합니다.'
    },
    {
      id: 'heading_hierarchy',
      name: '헤딩 구조',
      maxPoints: 2,
      points: data.h1Count === 1 && data.h2Count > 0 ? 2 : 1,
      status: data.h1Count === 1 && data.h2Count > 0 ? 'pass' : 'warning',
      value: `H1: ${data.h1Count}, H2: ${data.h2Count}, H3: ${data.h3Count}`,
      detail: `H1 ${data.h1Count}개, H2 ${data.h2Count}개, H3 ${data.h3Count}개가 있습니다.`,
      impact: '적절한 헤딩 구조는 검색엔진이 콘텐츠를 이해하는 데 도움이 됩니다.',
      solution: 'H1 → H2 → H3 순서로 논리적인 계층 구조를 만드세요.',
      learnMore: '헤딩 태그는 콘텐츠의 계층 구조를 나타냅니다.'
    },
    {
      id: 'internal_links',
      name: '내부 링크',
      maxPoints: 2,
      points: data.internalLinks > 5 ? 2 : (data.internalLinks > 0 ? 1 : 0),
      status: data.internalLinks > 5 ? 'pass' : (data.internalLinks > 0 ? 'warning' : 'fail'),
      value: `${data.internalLinks || 0}개 발견`,
      detail: `내부 링크가 ${data.internalLinks || 0}개 있습니다.`,
      impact: '내부 링크는 페이지 권위를 분배하고 크롤링을 돕습니다.',
      solution: '관련 페이지로 연결되는 내부 링크를 추가하세요.',
      learnMore: '내부 링크는 사이트 구조와 SEO에 중요한 역할을 합니다.'
    },
    {
      id: 'hreflang',
      name: 'Hreflang (다국어)',
      maxPoints: 2,
      points: 1,
      status: 'warning',
      value: '단일 언어 사이트로 추정',
      detail: '다국어 사이트라면 hreflang 태그가 필요합니다.',
      impact: '다국어 사이트에서 hreflang이 없으면 중복 콘텐츠로 처리됩니다.',
      solution: '다국어 지원 시 <link rel="alternate" hreflang="en" href="...">를 추가하세요.',
      learnMore: 'hreflang은 같은 콘텐츠의 다른 언어 버전을 지정합니다.'
    }
  ];

  // 카테고리별 점수 계산
  const calcCategory = (items, maxScore) => ({
    score: items.reduce((s, i) => s + i.points, 0),
    maxScore,
    passed: items.filter(i => i.status === 'pass').length,
    failed: items.filter(i => i.status === 'fail').length,
    items
  });

  const categories = {
    common: calcCategory(commonItems, 20),
    meta: calcCategory(metaItems, 15),
    social: calcCategory(socialItems, 15),
    speed: calcCategory(speedItems, 15),
    security: calcCategory(securityItems, 15),
    mobile: calcCategory(mobileItems, 10),
    advanced: calcCategory(advancedItems, 10)
  };

  // 전체 점수 계산
  const totalScore = Object.values(categories).reduce((s, c) => s + c.score, 0);
  const totalPassed = Object.values(categories).reduce((s, c) => s + c.passed, 0);
  const totalFailed = Object.values(categories).reduce((s, c) => s + c.failed, 0);
  const totalWarnings = Object.values(categories)
    .flatMap(c => c.items)
    .filter(i => i.status === 'warning').length;

  // 등급 계산
  const getGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  };

  // Critical Issues
  const criticalIssues = [];
  if (!data.ssl) criticalIssues.push({ category: 'security', issue: 'HTTPS 미적용', impact: '검색 순위 하락 및 보안 경고', priority: 'high' });
  if (!data.title) criticalIssues.push({ category: 'common', issue: 'Title 태그 누락', impact: '검색 결과에 제목 표시 불가', priority: 'high' });
  if (!data.description) criticalIssues.push({ category: 'common', issue: 'Meta Description 누락', impact: 'CTR 30% 감소 예상', priority: 'high' });
  if (data.h1Count === 0) criticalIssues.push({ category: 'common', issue: 'H1 태그 누락', impact: '페이지 주제 파악 어려움', priority: 'high' });
  if (!data.viewport) criticalIssues.push({ category: 'mobile', issue: 'Viewport 미설정', impact: '모바일 검색 순위 하락', priority: 'high' });
  if (!data.hasOG) criticalIssues.push({ category: 'social', issue: 'Open Graph 태그 누락', impact: 'SNS 공유 시 미리보기 없음', priority: 'medium' });

  // Quick Wins
  const quickWins = [];
  if (!data.description) quickWins.push({ action: 'Meta Description 추가', effort: '5분', impact: 'CTR 20-30% 개선', howTo: '<meta name="description" content="..."> 추가' });
  if (!data.ogTitle) quickWins.push({ action: 'Open Graph 태그 추가', effort: '10분', impact: 'SNS 공유 최적화', howTo: 'og:title, og:description, og:image 태그 추가' });
  if (!data.canonical) quickWins.push({ action: 'Canonical URL 설정', effort: '5분', impact: '중복 콘텐츠 방지', howTo: '<link rel="canonical" href="..."> 추가' });
  if (!data.hasSitemap) quickWins.push({ action: 'XML Sitemap 생성', effort: '15분', impact: '인덱싱 속도 향상', howTo: 'sitemap.xml 생성 후 Search Console 등록' });
  if (!data.hasSchema) quickWins.push({ action: '구조화 데이터 추가', effort: '30분', impact: '리치 스니펫 표시 가능', howTo: 'JSON-LD 형식으로 Organization 또는 LocalBusiness 스키마 추가' });

  return {
    siteName: data.title || hostname,
    siteDescription: data.description || `${hostname} 웹사이트 SEO 분석 결과`,
    url,
    analyzedAt: new Date().toISOString(),
    overallScore: totalScore,
    grade: getGrade(totalScore),
    summary: {
      passed: totalPassed,
      warnings: totalWarnings,
      failed: totalFailed,
      totalChecks: totalPassed + totalWarnings + totalFailed
    },
    categories,
    criticalIssues,
    quickWins
  };
}

// ==========================================
// 이미지 기반 사이트 분석 API
// ==========================================

// 이미지 기반 사이트 분석
router.post('/analyze-image-site', authMiddleware, async (req, res) => {
  try {
    const { url, manualContent } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL을 입력해주세요.' });
    }

    // URL 정규화
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl;
    }

    // 웹사이트 크롤링
    let crawlData = {};
    let responseTime = 0;

    try {
      const startTime = Date.now();
      const response = await axios.get(targetUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MedicalComplyBot/1.0; +https://medicalcomply.com)'
        }
      });
      responseTime = Date.now() - startTime;

      const $ = cheerio.load(response.data);
      const html = response.data;

      // 이미지 분석
      const images = [];
      $('img').each((i, el) => {
        const src = $(el).attr('src') || '';
        const alt = $(el).attr('alt') || '';
        const width = $(el).attr('width') || '';
        const height = $(el).attr('height') || '';

        images.push({
          src: src.substring(0, 200),
          alt: alt.trim(),
          hasAlt: alt.trim().length > 0,
          isDecorativeAlt: alt.trim().length > 0 && alt.trim().length < 3,
          dimensions: width && height ? `${width}x${height}` : 'unknown'
        });
      });

      // 텍스트 콘텐츠 추출
      $('script, style, noscript, iframe').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

      // 의미있는 텍스트 vs 네비게이션/버튼 텍스트 구분
      const meaningfulSelectors = 'p, h1, h2, h3, h4, h5, h6, article, section, main, .content, .description';
      const meaningfulText = $(meaningfulSelectors).text().replace(/\s+/g, ' ').trim();

      // 네비게이션/메뉴 텍스트
      const navText = $('nav, .nav, .menu, .header, footer').text().replace(/\s+/g, ' ').trim();

      // 배경 이미지 탐지 (style 속성에서)
      const bgImages = [];
      $('[style*="background"]').each((i, el) => {
        const style = $(el).attr('style') || '';
        const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (match) {
          bgImages.push(match[1]);
        }
      });

      // CSS에서 배경 이미지
      $('style').each((i, el) => {
        const css = $(el).html() || '';
        const matches = css.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g);
        for (const match of matches) {
          if (match[1] && !match[1].startsWith('data:')) {
            bgImages.push(match[1]);
          }
        }
      });

      crawlData = {
        // 기본 메타
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',

        // 텍스트 분석
        totalTextLength: bodyText.length,
        meaningfulTextLength: meaningfulText.length,
        navTextLength: navText.length,

        // 이미지 분석
        totalImages: images.length,
        imagesWithAlt: images.filter(i => i.hasAlt).length,
        imagesWithoutAlt: images.filter(i => !i.hasAlt).length,
        decorativeAltCount: images.filter(i => i.isDecorativeAlt).length,
        backgroundImages: bgImages.length,
        images: images.slice(0, 50), // 최대 50개만

        // 구조 분석
        h1Count: $('h1').length,
        h2Count: $('h2').length,
        h1Text: $('h1').first().text().trim(),
        hasSchema: $('script[type="application/ld+json"]').length > 0,
        hasOG: $('meta[property^="og:"]').length > 0,

        // HTML 분석
        htmlSize: html.length,
        responseTime
      };

    } catch (crawlError) {
      console.log('크롤링 실패:', crawlError.message);
      crawlData.crawlError = crawlError.message;
    }

    // 이미지 기반 사이트 진단
    const diagnosis = analyzeImageBasedSite(targetUrl, crawlData, manualContent);

    res.json({
      success: true,
      diagnosis,
      crawlData: {
        title: crawlData.title,
        description: crawlData.description,
        totalImages: crawlData.totalImages,
        totalTextLength: crawlData.totalTextLength,
        meaningfulTextLength: crawlData.meaningfulTextLength
      }
    });

  } catch (error) {
    console.error('이미지 사이트 분석 오류:', error);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.', detail: error.message });
  }
});

// 이미지 기반 사이트 진단 함수
function analyzeImageBasedSite(url, data, manualContent = null) {
  const hostname = new URL(url).hostname;

  // 이미지 vs 텍스트 비율 계산
  const imageScore = data.totalImages || 0;
  const textScore = Math.floor((data.meaningfulTextLength || 0) / 100); // 100자당 1점
  const totalScore = imageScore + textScore;

  const imageRatio = totalScore > 0 ? Math.round((imageScore / totalScore) * 100) : 50;
  const textRatio = 100 - imageRatio;

  // 사이트 유형 판정
  let siteType = 'balanced';
  let siteTypeLabel = '균형잡힌 사이트';
  let siteTypeDesc = '이미지와 텍스트가 적절히 혼합되어 있습니다.';

  if (imageRatio >= 70) {
    siteType = 'image-heavy';
    siteTypeLabel = '이미지 중심 사이트';
    siteTypeDesc = '콘텐츠 대부분이 이미지로 구성되어 있어 검색엔진이 내용을 파악하기 어렵습니다.';
  } else if (imageRatio >= 50) {
    siteType = 'image-dominant';
    siteTypeLabel = '이미지 우세 사이트';
    siteTypeDesc = '이미지 비중이 높아 SEO 최적화가 필요합니다.';
  } else if (textRatio >= 70) {
    siteType = 'text-heavy';
    siteTypeLabel = '텍스트 중심 사이트';
    siteTypeDesc = '텍스트가 풍부하여 검색엔진 최적화에 유리합니다.';
  }

  // SEO 점수 계산 (100점 만점)
  let seoScore = 0;
  const scoreDetails = [];

  // 1. 텍스트 콘텐츠 (30점)
  const textPoints = Math.min(30, Math.floor((data.meaningfulTextLength || 0) / 50));
  seoScore += textPoints;
  scoreDetails.push({
    category: 'text',
    name: '텍스트 콘텐츠',
    points: textPoints,
    maxPoints: 30,
    status: textPoints >= 20 ? 'pass' : textPoints >= 10 ? 'warning' : 'fail',
    detail: `${data.meaningfulTextLength || 0}자의 의미있는 텍스트 발견`,
    recommendation: textPoints < 20 ? '이미지 내 텍스트를 HTML 텍스트로 전환하세요' : null
  });

  // 2. 이미지 Alt 속성 (20점)
  const altRatio = data.totalImages > 0 ? (data.imagesWithAlt / data.totalImages) : 1;
  const altPoints = Math.round(altRatio * 20);
  seoScore += altPoints;
  scoreDetails.push({
    category: 'alt',
    name: '이미지 Alt 속성',
    points: altPoints,
    maxPoints: 20,
    status: altRatio >= 0.9 ? 'pass' : altRatio >= 0.5 ? 'warning' : 'fail',
    detail: `${data.imagesWithAlt || 0}/${data.totalImages || 0} 이미지에 alt 속성 있음`,
    recommendation: altRatio < 0.9 ? '모든 이미지에 설명적인 alt 텍스트를 추가하세요' : null
  });

  // 3. 헤딩 구조 (15점)
  const hasH1 = (data.h1Count || 0) === 1;
  const hasH2 = (data.h2Count || 0) >= 2;
  const headingPoints = (hasH1 ? 10 : 0) + (hasH2 ? 5 : 0);
  seoScore += headingPoints;
  scoreDetails.push({
    category: 'heading',
    name: '헤딩 태그 구조',
    points: headingPoints,
    maxPoints: 15,
    status: headingPoints >= 12 ? 'pass' : headingPoints >= 5 ? 'warning' : 'fail',
    detail: `H1: ${data.h1Count || 0}개, H2: ${data.h2Count || 0}개`,
    recommendation: !hasH1 ? 'H1 태그를 추가하세요 (페이지당 1개)' : !hasH2 ? 'H2 태그로 섹션을 구분하세요' : null
  });

  // 4. 메타 태그 (15점)
  const hasTitle = (data.title || '').length > 10;
  const hasDesc = (data.description || '').length > 50;
  const metaPoints = (hasTitle ? 8 : 0) + (hasDesc ? 7 : 0);
  seoScore += metaPoints;
  scoreDetails.push({
    category: 'meta',
    name: '메타 태그',
    points: metaPoints,
    maxPoints: 15,
    status: metaPoints >= 12 ? 'pass' : metaPoints >= 5 ? 'warning' : 'fail',
    detail: `Title: ${hasTitle ? '있음' : '없음'}, Description: ${hasDesc ? '있음' : '없음'}`,
    recommendation: !hasTitle ? 'Title 태그를 추가하세요' : !hasDesc ? 'Meta Description을 추가하세요' : null
  });

  // 5. 구조화 데이터 (10점)
  const schemaPoints = data.hasSchema ? 10 : 0;
  seoScore += schemaPoints;
  scoreDetails.push({
    category: 'schema',
    name: '구조화 데이터',
    points: schemaPoints,
    maxPoints: 10,
    status: schemaPoints > 0 ? 'pass' : 'fail',
    detail: data.hasSchema ? 'JSON-LD 구조화 데이터 발견' : '구조화 데이터 없음',
    recommendation: !data.hasSchema ? 'LocalBusiness 또는 MedicalBusiness 스키마를 추가하세요' : null
  });

  // 6. Open Graph (10점)
  const ogPoints = data.hasOG ? 10 : 0;
  seoScore += ogPoints;
  scoreDetails.push({
    category: 'og',
    name: 'Open Graph 태그',
    points: ogPoints,
    maxPoints: 10,
    status: ogPoints > 0 ? 'pass' : 'fail',
    detail: data.hasOG ? 'OG 태그 발견' : 'OG 태그 없음',
    recommendation: !data.hasOG ? 'og:title, og:description, og:image 태그를 추가하세요' : null
  });

  // 이미지 → 텍스트 전환 권고
  const conversionRecommendations = [];

  if (siteType === 'image-heavy' || siteType === 'image-dominant') {
    conversionRecommendations.push({
      priority: 'critical',
      title: '메인 시술/서비스 소개',
      current: '이미지 배너로 표시됨',
      recommended: 'HTML 텍스트 + 이미지 조합으로 변경',
      impact: '검색엔진이 서비스 내용을 인식하여 관련 검색어 노출 가능',
      effort: '중간',
      example: `
<section>
  <h2>레이저 토닝</h2>
  <p>멜라닌 색소를 선택적으로 파괴하여 피부 톤을 균일하게 만드는 시술입니다.</p>
  <ul>
    <li>시술 시간: 약 20분</li>
    <li>회복 기간: 즉시 일상 복귀</li>
  </ul>
  <img src="laser-toning.jpg" alt="레이저 토닝 시술 전후 비교">
</section>`
    });

    conversionRecommendations.push({
      priority: 'high',
      title: '가격표/메뉴판',
      current: '이미지 파일로 제공',
      recommended: 'HTML 테이블 또는 리스트로 변경',
      impact: '가격 관련 검색어 노출, 구조화 데이터 적용 가능',
      effort: '낮음',
      example: `
<table>
  <tr><th>시술명</th><th>가격</th></tr>
  <tr><td>레이저 토닝</td><td>50,000원</td></tr>
  <tr><td>피코 토닝</td><td>80,000원</td></tr>
</table>`
    });

    conversionRecommendations.push({
      priority: 'high',
      title: 'FAQ/자주 묻는 질문',
      current: '이미지 또는 없음',
      recommended: 'FAQPage 스키마 적용된 HTML',
      impact: 'Google 검색 결과에 FAQ 리치 스니펫 표시, AI 답변 인용',
      effort: '낮음',
      example: `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "레이저 토닝 시술 후 세안은 언제 가능한가요?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "시술 당일부터 가벼운 세안이 가능합니다."
    }
  }]
}
</script>`
    });

    conversionRecommendations.push({
      priority: 'medium',
      title: '의료진 소개',
      current: '이미지 프로필',
      recommended: 'HTML 텍스트 + Person 스키마',
      impact: '의료진 이름 검색 시 병원 노출, 신뢰도 향상',
      effort: '중간'
    });

    conversionRecommendations.push({
      priority: 'medium',
      title: '이벤트/프로모션',
      current: '배너 이미지',
      recommended: 'HTML + Event 스키마',
      impact: '이벤트 검색 노출, 소셜 미디어 공유 최적화',
      effort: '낮음'
    });
  }

  // AEO/GEO 준비도
  let aeoReadiness = 'low';
  let aeoReadinessLabel = 'AI 검색 대응 미흡';
  let aeoScore = 0;

  // AEO 점수 계산
  if (data.meaningfulTextLength >= 1000) aeoScore += 25;
  else if (data.meaningfulTextLength >= 500) aeoScore += 15;

  if (data.hasSchema) aeoScore += 25;
  if (data.h1Count === 1 && data.h2Count >= 2) aeoScore += 20;
  if (altRatio >= 0.8) aeoScore += 15;
  if (data.hasOG) aeoScore += 15;

  if (aeoScore >= 70) {
    aeoReadiness = 'high';
    aeoReadinessLabel = 'AI 검색 대응 우수';
  } else if (aeoScore >= 40) {
    aeoReadiness = 'medium';
    aeoReadinessLabel = 'AI 검색 대응 보통';
  }

  // 수동 입력 콘텐츠가 있는 경우 분석
  let manualContentAnalysis = null;
  if (manualContent && Object.keys(manualContent).length > 0) {
    manualContentAnalysis = analyzeManualContent(manualContent);
  }

  return {
    url,
    hostname,
    analyzedAt: new Date().toISOString(),

    // 이미지/텍스트 비율
    ratio: {
      imageRatio,
      textRatio,
      imageCount: data.totalImages || 0,
      textLength: data.meaningfulTextLength || 0,
      backgroundImageCount: data.backgroundImages || 0
    },

    // 사이트 유형
    siteType: {
      type: siteType,
      label: siteTypeLabel,
      description: siteTypeDesc
    },

    // SEO 점수
    seoScore,
    seoGrade: seoScore >= 80 ? 'A' : seoScore >= 60 ? 'B' : seoScore >= 40 ? 'C' : 'D',
    scoreDetails,

    // AEO 준비도
    aeoReadiness: {
      level: aeoReadiness,
      label: aeoReadinessLabel,
      score: aeoScore
    },

    // 이미지 상세
    imageAnalysis: {
      total: data.totalImages || 0,
      withAlt: data.imagesWithAlt || 0,
      withoutAlt: data.imagesWithoutAlt || 0,
      decorativeAlt: data.decorativeAltCount || 0,
      altCoverage: Math.round(altRatio * 100)
    },

    // 전환 권고
    conversionRecommendations,

    // 수동 콘텐츠 분석
    manualContentAnalysis,

    // 개선 우선순위
    priorities: generatePriorities(scoreDetails, siteType)
  };
}

// 수동 입력 콘텐츠 분석
function analyzeManualContent(content) {
  const analysis = {
    services: [],
    keywords: [],
    schemaRecommendations: [],
    contentSuggestions: []
  };

  // 서비스/시술 분석
  if (content.services && Array.isArray(content.services)) {
    analysis.services = content.services.map(service => ({
      name: service.name,
      hasDescription: service.description && service.description.length > 50,
      hasPrice: !!service.price,
      keywords: extractKeywords(service.name + ' ' + (service.description || '')),
      schemaType: 'Service',
      htmlSuggestion: generateServiceHTML(service)
    }));

    // 키워드 추출
    const allKeywords = analysis.services.flatMap(s => s.keywords);
    analysis.keywords = [...new Set(allKeywords)].slice(0, 20);

    // 스키마 권고
    analysis.schemaRecommendations.push({
      type: 'Service',
      reason: '시술/서비스 정보가 있어 Service 스키마를 적용하면 검색 노출에 유리합니다',
      example: generateServiceSchema(content.services[0])
    });
  }

  // FAQ 분석
  if (content.faqs && Array.isArray(content.faqs)) {
    analysis.schemaRecommendations.push({
      type: 'FAQPage',
      reason: 'FAQ가 있어 FAQPage 스키마를 적용하면 검색 결과에 FAQ가 표시됩니다',
      example: generateFAQSchema(content.faqs)
    });
  }

  // 의료진 분석
  if (content.doctors && Array.isArray(content.doctors)) {
    analysis.schemaRecommendations.push({
      type: 'Person + MedicalBusiness',
      reason: '의료진 정보가 있어 Person 스키마를 적용하면 신뢰도가 향상됩니다',
      example: generateDoctorSchema(content.doctors[0])
    });
  }

  return analysis;
}

// 키워드 추출
function extractKeywords(text) {
  const medicalKeywords = [
    '레이저', '토닝', '필링', '보톡스', '필러', '리프팅', '슈링크', '울쎄라',
    '피부', '여드름', '주름', '탄력', '미백', '흉터', '튼살', '제모',
    '피부과', '성형', '시술', '치료', '관리', '효과', '전문'
  ];

  return medicalKeywords.filter(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

// 서비스 HTML 생성
function generateServiceHTML(service) {
  return `<article itemscope itemtype="https://schema.org/Service">
  <h2 itemprop="name">${service.name}</h2>
  <p itemprop="description">${service.description || '서비스 설명을 추가하세요'}</p>
  ${service.price ? `<p>가격: <span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span itemprop="price">${service.price}</span>원
  </span></p>` : ''}
</article>`;
}

// 서비스 스키마 생성
function generateServiceSchema(service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": service?.name || "서비스명",
    "description": service?.description || "서비스 설명",
    "provider": {
      "@type": "MedicalBusiness",
      "name": "병원명"
    },
    "offers": service?.price ? {
      "@type": "Offer",
      "price": service.price,
      "priceCurrency": "KRW"
    } : undefined
  };
}

// FAQ 스키마 생성
function generateFAQSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (faqs || []).slice(0, 3).map(faq => ({
      "@type": "Question",
      "name": faq.question || "질문",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer || "답변"
      }
    }))
  };
}

// 의료진 스키마 생성
function generateDoctorSchema(doctor) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": doctor?.name || "의료진명",
    "jobTitle": doctor?.title || "전문의",
    "worksFor": {
      "@type": "MedicalBusiness",
      "name": "병원명"
    }
  };
}

// 개선 우선순위 생성
function generatePriorities(scoreDetails, siteType) {
  const priorities = [];

  // 점수가 낮은 항목부터 우선순위
  const sortedDetails = [...scoreDetails]
    .filter(d => d.recommendation)
    .sort((a, b) => (a.points / a.maxPoints) - (b.points / b.maxPoints));

  sortedDetails.forEach((detail, idx) => {
    priorities.push({
      rank: idx + 1,
      category: detail.category,
      name: detail.name,
      currentScore: `${detail.points}/${detail.maxPoints}`,
      recommendation: detail.recommendation,
      impact: idx < 2 ? 'high' : idx < 4 ? 'medium' : 'low'
    });
  });

  // 이미지 중심 사이트의 경우 추가 우선순위
  if (siteType === 'image-heavy' || siteType === 'image-dominant') {
    priorities.unshift({
      rank: 0,
      category: 'critical',
      name: '이미지 텍스트화',
      currentScore: 'N/A',
      recommendation: '이미지 내 텍스트를 HTML로 전환하세요. 검색엔진은 이미지 내 텍스트를 읽을 수 없습니다.',
      impact: 'critical'
    });
  }

  return priorities;
}

// 이메일 발송 API
router.post('/send-email', authMiddleware, async (req, res) => {
  try {
    const { email, result } = req.body;

    if (!email || !result) {
      return res.status(400).json({ error: '이메일과 분석 결과가 필요합니다.' });
    }

    // 등급 계산
    const getGrade = (score) => {
      if (score >= 90) return 'A+';
      if (score >= 80) return 'A';
      if (score >= 70) return 'B+';
      if (score >= 60) return 'B';
      if (score >= 50) return 'C';
      return 'D';
    };

    const gradeInfo = {
      'A+': { label: '최우수', desc: 'AI 검색에 최적화됨' },
      'A': { label: '우수', desc: 'AI 친화적 구조' },
      'B+': { label: '양호', desc: '일부 개선 필요' },
      'B': { label: '보통', desc: '개선 권고' },
      'C': { label: '미흡', desc: '즉시 개선 필요' },
      'D': { label: '매우미흡', desc: '전면 개편 필요' }
    };

    const grade = getGrade(result.overallScore);
    const gradeData = gradeInfo[grade];

    // HTML 이메일 본문 생성
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border-radius: 10px; }
    .score-box { text-align: center; padding: 30px; background: #f8fafc; border-radius: 10px; margin: 20px 0; }
    .score { font-size: 48px; font-weight: 800; color: #2563eb; }
    .grade { font-size: 24px; font-weight: 700; color: #059669; }
    .category { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .cat-header { display: flex; justify-content: space-between; font-weight: 600; }
    .issue { background: #fef2f2; padding: 10px; border-left: 3px solid #dc2626; margin: 5px 0; }
    .rec { background: #eff6ff; padding: 10px; border-left: 3px solid #2563eb; margin: 5px 0; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AEO/GEO 분석 리포트</h1>
    <p>${result.siteName}</p>
  </div>

  <div class="score-box">
    <div class="score">${result.overallScore}</div>
    <div class="grade">${grade} - ${gradeData?.label}</div>
    <p>${gradeData?.desc}</p>
  </div>

  <h3>카테고리별 점수</h3>
  ${Object.entries(result.categories || {}).map(([key, cat]) => `
    <div class="category">
      <div class="cat-header">
        <span>${{structure:'구조',content:'콘텐츠',technical:'기술',trust:'신뢰도'}[key] || key}</span>
        <span>${cat.score}/25점</span>
      </div>
    </div>
  `).join('')}

  ${result.topIssues?.length > 0 ? `
    <h3>주요 문제점</h3>
    ${result.topIssues.map(issue => `<div class="issue">${issue}</div>`).join('')}
  ` : ''}

  <h3>개선 권고사항</h3>
  ${(result.recommendations || []).slice(0, 5).map(rec => `
    <div class="rec">${typeof rec === 'string' ? rec : rec.title}</div>
  `).join('')}

  <div class="footer">
    <p>MedicalComply AEO/GEO Analyzer</p>
    <p>${new Date().toLocaleString('ko-KR')}</p>
  </div>
</body>
</html>
    `;

    // Resend API 사용 (설정되어 있으면)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'MedicalComply <onboarding@resend.dev>',
        to: email,
        subject: `[AEO 분석] ${result.siteName} - ${result.overallScore}점 (${grade})`,
        html: htmlContent
      });

      return res.json({ success: true, message: '이메일이 발송되었습니다.' });
    }

    // API 키가 없으면 테스트 모드
    console.log('📧 이메일 발송 (테스트 모드):', email);
    console.log('제목:', `[AEO 분석] ${result.siteName} - ${result.overallScore}점 (${grade})`);

    res.json({
      success: true,
      message: '이메일 발송 완료 (테스트 모드)',
      testMode: true
    });

  } catch (error) {
    console.error('이메일 발송 오류:', error);
    res.status(500).json({ error: '이메일 발송 중 오류가 발생했습니다.', detail: error.message });
  }
});

// ============================================================
// AI 품질 비교 테스트 API
// ============================================================

/**
 * Claude vs Gemini 비교 테스트 엔드포인트
 * 동일한 프롬프트로 두 API를 호출하여 결과 비교
 */
router.post('/compare-ai', authMiddleware, async (req, res) => {
  try {
    const { url, testType = 'aeo' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL을 입력해주세요.' });
    }

    // API 키 확인
    const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
    const hasGeminiKey = !!geminiModel;

    if (!hasClaudeKey && !hasGeminiKey) {
      return res.status(400).json({ error: 'Claude 또는 Gemini API 키가 필요합니다.' });
    }

    // URL 정규화
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl;
    }

    // 웹사이트 크롤링
    let crawlData = {};
    try {
      const startTime = Date.now();
      const response = await axios.get(targetUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MedicalComplyBot/1.0; +https://medicalcomply.com)'
        }
      });
      const responseTime = Date.now() - startTime;

      const $ = cheerio.load(response.data);

      crawlData = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        keywords: $('meta[name="keywords"]').attr('content') || '',
        h1: $('h1').first().text().trim(),
        h1Count: $('h1').length,
        h2Count: $('h2').length,
        hasSchema: $('script[type="application/ld+json"]').length > 0,
        hasOG: $('meta[property^="og:"]').length > 0,
        ogTitle: $('meta[property="og:title"]').attr('content') || '',
        ogDescription: $('meta[property="og:description"]').attr('content') || '',
        totalImages: $('img').length,
        imagesWithAlt: $('img[alt]').filter((i, el) => $(el).attr('alt').trim() !== '').length,
        responseTime,
        bodyText: $('body').text().slice(0, 3000)
      };
    } catch (crawlError) {
      return res.status(400).json({ error: '웹사이트 크롤링 실패', detail: crawlError.message });
    }

    // 테스트 프롬프트 생성
    const prompt = generateCompareTestPrompt(testType, targetUrl);

    const results = {
      url: targetUrl,
      testType,
      crawlData: {
        title: crawlData.title,
        hasSchema: crawlData.hasSchema,
        hasOG: crawlData.hasOG,
        totalImages: crawlData.totalImages,
        imagesWithAlt: crawlData.imagesWithAlt
      },
      claude: null,
      gemini: null,
      comparison: null,
      testedAt: new Date().toISOString()
    };

    // Claude API 테스트
    if (hasClaudeKey) {
      try {
        console.log('🔵 Claude API 테스트 시작...');
        results.claude = await callClaudeAPI(prompt, crawlData);
        console.log(`✅ Claude 완료 (${results.claude.metadata.responseTime}ms)`);
      } catch (claudeError) {
        results.claude = {
          error: claudeError.message,
          metadata: { provider: 'claude', model: 'claude-sonnet-4-20250514' }
        };
        console.log('❌ Claude 오류:', claudeError.message);
      }
    }

    // Gemini API 테스트
    if (hasGeminiKey) {
      try {
        console.log('🟡 Gemini API 테스트 시작...');
        results.gemini = await callGeminiAPI(prompt, crawlData);
        console.log(`✅ Gemini 완료 (${results.gemini.metadata.responseTime}ms)`);
      } catch (geminiError) {
        results.gemini = {
          error: geminiError.message,
          metadata: { provider: 'gemini', model: 'gemini-2.0-flash' }
        };
        console.log('❌ Gemini 오류:', geminiError.message);
      }
    }

    // 비교 분석
    if (results.claude?.result && results.gemini?.result) {
      results.comparison = compareResults(results.claude, results.gemini);
    }

    res.json(results);

  } catch (error) {
    console.error('AI 비교 테스트 오류:', error);
    res.status(500).json({ error: 'AI 비교 테스트 중 오류가 발생했습니다.', detail: error.message });
  }
});

/**
 * AI 제공자 상태 확인 API
 */
router.get('/ai-status', authMiddleware, (req, res) => {
  const status = {
    claude: {
      available: !!process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
      pricing: {
        input: '$3.00 / 1M tokens',
        output: '$15.00 / 1M tokens'
      }
    },
    gemini: {
      available: !!geminiModel,
      model: 'gemini-2.0-flash',
      pricing: {
        input: '$0.10 / 1M tokens',
        output: '$0.40 / 1M tokens'
      }
    },
    currentProvider: selectProvider('auto'),
    envProvider: process.env.AI_PROVIDER || 'auto'
  };

  res.json(status);
});

/**
 * 비교 테스트용 프롬프트 생성
 */
function generateCompareTestPrompt(testType, url) {
  if (testType === 'seo') {
    return `다음 웹사이트의 SEO 상태를 분석하고 JSON 형식으로 결과를 반환하세요.

분석 대상: ${url}

다음 형식으로 응답하세요:
{
  "overallScore": 0-100,
  "categories": {
    "technical": { "score": 0-100, "issues": ["이슈1", "이슈2"] },
    "content": { "score": 0-100, "issues": [] },
    "meta": { "score": 0-100, "issues": [] }
  },
  "topPriorities": ["우선 개선 사항 1", "2", "3"],
  "summary": "한줄 요약"
}`;
  }

  // AEO 기본 분석
  return `다음 웹사이트의 AEO(Answer Engine Optimization) 상태를 분석하고 JSON 형식으로 결과를 반환하세요.

분석 대상: ${url}

AI 검색엔진(ChatGPT, Perplexity, Google AI Overview 등)에서 답변으로 인용되기 적합한지 평가하세요.

다음 형식으로 응답하세요:
{
  "overallScore": 0-100,
  "categories": {
    "structure": { "score": 0-100, "items": [{"name": "항목", "status": "pass/fail/warning", "detail": "설명"}] },
    "content": { "score": 0-100, "items": [] },
    "authority": { "score": 0-100, "items": [] }
  },
  "recommendations": ["개선 권장사항 1", "2", "3"],
  "summary": "한줄 요약"
}`;
}

/**
 * Claude와 Gemini 결과 비교
 */
function compareResults(claudeResult, geminiResult) {
  const claudeScore = claudeResult.result?.overallScore || 0;
  const geminiScore = geminiResult.result?.overallScore || 0;

  return {
    scoreDifference: Math.abs(claudeScore - geminiScore),
    claudeScore,
    geminiScore,
    responseTime: {
      claude: claudeResult.metadata.responseTime,
      gemini: geminiResult.metadata.responseTime,
      faster: claudeResult.metadata.responseTime < geminiResult.metadata.responseTime ? 'claude' : 'gemini',
      difference: Math.abs(claudeResult.metadata.responseTime - geminiResult.metadata.responseTime)
    },
    cost: {
      claude: claudeResult.metadata.estimatedCost,
      gemini: geminiResult.metadata.estimatedCost,
      cheaper: 'gemini', // Gemini is always cheaper
      savingsPercent: ((parseFloat(claudeResult.metadata.estimatedCost.totalCost) - parseFloat(geminiResult.metadata.estimatedCost.totalCost)) / parseFloat(claudeResult.metadata.estimatedCost.totalCost) * 100).toFixed(1)
    },
    tokens: {
      claude: { input: claudeResult.metadata.inputTokens, output: claudeResult.metadata.outputTokens },
      gemini: { input: geminiResult.metadata.inputTokens, output: geminiResult.metadata.outputTokens }
    },
    qualityNotes: generateQualityNotes(claudeResult.result, geminiResult.result)
  };
}

/**
 * 품질 비교 노트 생성
 */
function generateQualityNotes(claudeResult, geminiResult) {
  const notes = [];

  // 점수 차이 평가
  const scoreDiff = Math.abs((claudeResult?.overallScore || 0) - (geminiResult?.overallScore || 0));
  if (scoreDiff <= 5) {
    notes.push('✅ 점수 차이가 5점 이내로 유사한 평가');
  } else if (scoreDiff <= 15) {
    notes.push('⚠️ 점수 차이가 ' + scoreDiff + '점으로 약간의 차이 있음');
  } else {
    notes.push('❌ 점수 차이가 ' + scoreDiff + '점으로 상당한 차이');
  }

  // 권장사항 개수 비교
  const claudeRecs = claudeResult?.recommendations?.length || 0;
  const geminiRecs = geminiResult?.recommendations?.length || 0;
  notes.push(`📋 권장사항: Claude ${claudeRecs}개 vs Gemini ${geminiRecs}개`);

  return notes;
}

module.exports = router;
