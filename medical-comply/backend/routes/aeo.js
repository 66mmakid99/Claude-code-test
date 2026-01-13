const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

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

    // 웹사이트 크롤링
    let crawlData = {};
    try {
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MedicalComplyBot/1.0; +https://medicalcomply.com)'
        }
      });

      const $ = cheerio.load(response.data);

      crawlData = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        h1: $('h1').first().text().trim(),
        h2Count: $('h2').length,
        hasSchema: $('script[type="application/ld+json"]').length > 0,
        hasOG: $('meta[property^="og:"]').length > 0,
        hasFAQ: $('*:contains("FAQ")').length > 0 || $('*:contains("자주 묻는")').length > 0,
        hasSitemap: false,
        ssl: targetUrl.startsWith('https'),
        bodyText: $('body').text().slice(0, 5000)
      };

      // sitemap 확인
      try {
        const sitemapRes = await axios.get(targetUrl.replace(/\/$/, '') + '/sitemap.xml', { timeout: 5000 });
        crawlData.hasSitemap = sitemapRes.status === 200;
      } catch (e) {
        crawlData.hasSitemap = false;
      }

    } catch (crawlError) {
      console.log('크롤링 실패, 기본 분석 진행:', crawlError.message);
    }

    // Claude API가 설정되어 있으면 사용, 아니면 규칙 기반 분석
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicResponse = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
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

    // 규칙 기반 AEO 분석 (API 키 없을 때)
    const result = analyzeWithRules(targetUrl, crawlData);
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

module.exports = router;
