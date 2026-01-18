const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// 네이버 검색 API 설정 (로그인 API와 별도)
const NAVER_SEARCH_ID = process.env.NAVER_SEARCH_ID;
const NAVER_SEARCH_SECRET = process.env.NAVER_SEARCH_SECRET;

// ============================================
// 의료광고법 위반 탐지 규칙 데이터베이스
// ============================================
const VIOLATION_RULES = {
  // 🔴 심각 (Critical) - 즉시 조치 필요
  critical: [
    {
      code: 'C01',
      name: '치료효과 보장 광고',
      description: '치료 효과를 확실하게 보장하는 표현은 의료법 위반입니다.',
      legalBasis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하 징역 또는 1천만원 이하 벌금',
      keywords: ['100% 완치', '100%완치', '완치 보장', '확실한 효과', '효과 보장', '무조건 효과', '반드시 낫', '꼭 낫', '완벽하게 치료', '확실히 치료', '틀림없이'],
      patterns: [/100\s*%\s*(완치|치료|효과|성공)/gi, /완치\s*(보장|약속|확실)/gi, /(반드시|꼭|무조건)\s*(낫|치료|완치)/gi]
    },
    {
      code: 'C02',
      name: '전후사진 무단 게시',
      description: '환자의 치료 전후 사진은 엄격한 규정 하에만 게시 가능합니다.',
      legalBasis: '의료법 시행령 제23조 제1항',
      penalty: '과태료 300만원',
      keywords: ['전후사진', '전후 사진', '비포애프터', 'before after', 'before&after', '시술전후', '시술 전후', '전후비교', '변화사진', '변화 사진'],
      patterns: [/전\s*후\s*사진/gi, /before\s*(&|and)?\s*after/gi, /시술\s*전\s*후/gi, /비포\s*애프터/gi]
    },
    {
      code: 'C03',
      name: '과대/허위 광고',
      description: '최초, 유일, 최고 등 객관적 근거 없는 최상급 표현은 금지됩니다.',
      legalBasis: '의료법 제56조 제2항 제1호',
      penalty: '1년 이하 징역 또는 1천만원 이하 벌금',
      keywords: ['국내 최초', '세계 최초', '국내 유일', '세계 유일', '업계 1위', '국내 1위', '최고의 기술', '독보적', '압도적 1위', '넘버원', 'No.1'],
      patterns: [/(국내|세계|업계)\s*(최초|유일|1위)/gi, /(독보적|압도적)/gi, /no\s*\.?\s*1/gi]
    },
    {
      code: 'C04',
      name: '미승인 시술/치료 광고',
      description: '식약처 미승인 시술이나 치료법 광고는 불법입니다.',
      legalBasis: '의료법 제27조, 약사법 제68조',
      penalty: '5년 이하 징역 또는 5천만원 이하 벌금',
      keywords: ['줄기세포 시술', '면역세포 치료', 'NK세포', '미승인 치료', '해외직수입'],
      patterns: [/(줄기세포|면역세포|NK세포)\s*(시술|치료|주사)/gi]
    }
  ],

  // 🟠 주의 (Warning) - 검토 필요
  warning: [
    {
      code: 'W01',
      name: '비교 광고',
      description: '다른 의료기관과 비교하는 광고는 원칙적으로 금지됩니다.',
      legalBasis: '의료법 제56조 제2항 제5호',
      penalty: '시정명령, 과태료 300만원',
      keywords: ['타병원', '다른병원', '타 병원', '다른 병원', '경쟁병원', 'OO보다', '비교하면', '보다 좋은', '보다 저렴'],
      patterns: [/(타|다른|경쟁)\s*병원/gi, /보다\s*(좋|나은|저렴|빠른)/gi]
    },
    {
      code: 'W02',
      name: '가격/할인 광고',
      description: '과도한 할인 광고는 의료의 신뢰성을 해칠 수 있습니다.',
      legalBasis: '의료광고 심의기준 제4조',
      penalty: '심의 부적합 판정, 시정명령',
      keywords: ['50% 할인', '70% 할인', '파격 할인', '반값', '무료 시술', '공짜', '특가', '최저가', '가격 파괴'],
      patterns: [/[5-9]0\s*%\s*할인/gi, /(파격|반값|무료|공짜|특가)/gi, /최저\s*가/gi]
    },
    {
      code: 'W03',
      name: '신의료기술 과장',
      description: '검증되지 않은 신기술을 과장 광고하면 안됩니다.',
      legalBasis: '의료법 제56조 제2항 제2호',
      penalty: '과태료 300만원',
      keywords: ['획기적인 기술', '혁신적 치료', '기적의 치료', '꿈의 치료', '신기술', '첨단 기술', '최신 기술'],
      patterns: [/(획기적|혁신적|기적의|꿈의)\s*(기술|치료|시술)/gi]
    },
    {
      code: 'W04',
      name: '광고 미표기 의심',
      description: '협찬/체험단 콘텐츠는 광고임을 명확히 표기해야 합니다.',
      legalBasis: '표시광고법 제3조',
      penalty: '과태료 500만원 이하',
      keywords: ['체험단', '협찬', '제공받았', '지원받았', '서포터즈', '원고료'],
      patterns: [/(체험단|협찬|서포터즈)/gi, /(제공|지원)\s*받/gi],
      checkAdDisclosure: true // 광고 표기 여부 추가 확인 필요
    },
    {
      code: 'W05',
      name: '의료인 자격 과장',
      description: '의료인의 자격이나 경력을 과장하면 안됩니다.',
      legalBasis: '의료법 제56조 제2항 제4호',
      penalty: '시정명령, 과태료',
      keywords: ['명의', '국내 최고 전문의', '대한민국 대표', '카리스마 원장', '레전드', '신의 손'],
      patterns: [/(명의|대가|거장|레전드)/gi, /(국내|대한민국)\s*(최고|대표)\s*(전문의|의사|원장)/gi]
    }
  ],

  // 🟡 참고 (Info) - 모니터링
  info: [
    {
      code: 'I01',
      name: '환자 후기 게시',
      description: '환자 후기는 객관성이 담보되어야 하며, 과장되면 안됩니다.',
      legalBasis: '의료광고 심의기준',
      keywords: ['솔직후기', '생생후기', '리얼후기', '체험후기', '시술후기', '방문후기'],
      patterns: [/(솔직|생생|리얼|체험|시술|방문)\s*후기/gi]
    },
    {
      code: 'I02',
      name: '과장된 만족 표현',
      description: '과도하게 과장된 만족 표현은 주의가 필요합니다.',
      legalBasis: '의료광고 심의기준',
      keywords: ['인생병원', '신세계', '대박', '미쳤다', '역대급', '찐이다', '레알 추천'],
      patterns: [/(인생|신세계|역대급)/gi, /대박/gi]
    }
  ]
};

// ============================================
// 의료광고 위반 탐지 함수
// ============================================
function detectViolations(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const originalText = title + ' ' + description;
  const violations = [];

  // 모든 규칙 카테고리 검사
  const categories = [
    { level: 'critical', severity: '심각', score: 30, color: 'red' },
    { level: 'warning', severity: '주의', score: 15, color: 'orange' },
    { level: 'info', severity: '참고', score: 5, color: 'yellow' }
  ];

  for (const category of categories) {
    const rules = VIOLATION_RULES[category.level] || [];

    for (const rule of rules) {
      const matchedKeywords = [];

      // 키워드 매칭
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }

      // 패턴 매칭
      if (rule.patterns) {
        for (const pattern of rule.patterns) {
          const matches = originalText.match(pattern);
          if (matches) {
            matchedKeywords.push(...matches);
          }
        }
      }

      // 중복 제거
      const uniqueMatches = [...new Set(matchedKeywords)];

      if (uniqueMatches.length > 0) {
        violations.push({
          code: rule.code,
          name: rule.name,
          level: category.level,
          severity: category.severity,
          score: category.score,
          color: category.color,
          description: rule.description,
          legalBasis: rule.legalBasis,
          penalty: rule.penalty,
          matchedKeywords: uniqueMatches,
          needsAdDisclosure: rule.checkAdDisclosure || false
        });
      }
    }
  }

  return violations;
}

// 광고 표기 여부 확인
function hasAdDisclosure(text) {
  const adDisclosureKeywords = ['#광고', '광고입니다', '광고임', '#ad', '유료광고', '광고 포함'];
  const lowerText = text.toLowerCase();
  return adDisclosureKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// 위험도 계산
function calculateRiskScore(violations) {
  let totalScore = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const v of violations) {
    totalScore += v.score;
    if (v.level === 'critical') criticalCount++;
    else if (v.level === 'warning') warningCount++;
    else infoCount++;
  }

  let riskLevel, riskLabel;
  if (totalScore >= 60 || criticalCount >= 2) {
    riskLevel = 'high';
    riskLabel = '고위험';
  } else if (totalScore >= 30 || criticalCount >= 1) {
    riskLevel = 'medium';
    riskLabel = '주의';
  } else {
    riskLevel = 'low';
    riskLabel = '양호';
  }

  return {
    totalScore,
    riskLevel,
    riskLabel,
    criticalCount,
    warningCount,
    infoCount
  };
}

// 네이버 검색 API 호출
async function searchNaver(query, type = 'blog', display = 20, start = 1, sort = 'sim') {
  if (!NAVER_SEARCH_ID || !NAVER_SEARCH_SECRET) {
    return null; // API 키 없으면 null 반환
  }

  const typeMap = {
    blog: 'blog',
    cafe: 'cafearticle',
    kin: 'kin'
  };

  const url = `https://openapi.naver.com/v1/search/${typeMap[type] || 'blog'}.json`;

  try {
    const response = await axios.get(url, {
      params: {
        query,
        display,
        start,
        sort // sim: 관련도순, date: 최신순
      },
      headers: {
        'X-Naver-Client-Id': NAVER_SEARCH_ID,
        'X-Naver-Client-Secret': NAVER_SEARCH_SECRET
      }
    });

    return response.data;
  } catch (error) {
    console.error(`네이버 ${type} 검색 API 오류:`, error.message);
    return null;
  }
}

// HTML 태그 제거
function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, '') || '';
}

// 간단한 감성 분석 (키워드 기반)
function analyzeSentiment(text) {
  const positiveWords = [
    '좋아', '만족', '추천', '최고', '감사', '친절', '깨끗', '전문', '믿음', '신뢰',
    '효과', '대박', '굿', '좋음', '맘에 들', '괜찮', '훌륭', '베스트', '짱', '최상',
    '강추', '재방문', '다시', '또', '편안', '쾌적', '정성', '꼼꼼', '세심', '만점'
  ];
  const negativeWords = [
    '별로', '실망', '후회', '최악', '불친절', '더러', '비추', '싫', '짜증', '화남',
    '비싸', '과대', '광고', '사기', '거짓', '불만', '아쉬', '부족', '불편', '문제',
    '엉망', '최저', '나쁨', '피해', '불성실', '무성의', '형편없', '비위생', '지저분'
  ];

  const lowerText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveScore++;
  });

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeScore++;
  });

  if (positiveScore > negativeScore + 1) return { sentiment: 'positive', confidence: Math.min((positiveScore - negativeScore) * 20, 100) };
  if (negativeScore > positiveScore + 1) return { sentiment: 'negative', confidence: Math.min((negativeScore - positiveScore) * 20, 100) };
  return { sentiment: 'neutral', confidence: 50 };
}

// 광고성 콘텐츠 판별
function isLikelyAd(title, description) {
  const adIndicators = [
    '체험단', '협찬', '광고', '제공', '원고료', '소정', '지원',
    '#ad', '#협찬', '리뷰어', '서포터즈', '제휴', '이벤트 당첨'
  ];

  const text = (title + ' ' + description).toLowerCase();
  return adIndicators.some(indicator => text.includes(indicator));
}

// 바이럴 모니터링 검색 API
router.post('/search', authMiddleware, async (req, res) => {
  try {
    const { keyword, platform = 'all', period = '7d', sort = 'recent' } = req.body;

    if (!keyword?.trim()) {
      return res.status(400).json({ error: '검색 키워드를 입력해주세요.' });
    }

    const naverSort = sort === 'recent' ? 'date' : 'sim';
    const results = { keyword, items: [], stats: {} };

    // 네이버 검색 API 키 확인
    const hasNaverApi = NAVER_SEARCH_ID && NAVER_SEARCH_SECRET;

    if (hasNaverApi) {
      // 네이버 API로 실제 검색
      const searchPromises = [];

      if (platform === 'all' || platform === 'blog') {
        searchPromises.push(
          searchNaver(keyword, 'blog', 30, 1, naverSort)
            .then(data => ({ type: 'blog', data }))
        );
      }

      if (platform === 'all' || platform === 'cafe') {
        searchPromises.push(
          searchNaver(keyword, 'cafe', 30, 1, naverSort)
            .then(data => ({ type: 'cafe', data }))
        );
      }

      if (platform === 'all' || platform === 'kin') {
        searchPromises.push(
          searchNaver(keyword, 'kin', 20, 1, naverSort)
            .then(data => ({ type: 'kin', data }))
        );
      }

      const searchResults = await Promise.all(searchPromises);

      // API 호출 성공 여부 확인
      const successfulResults = searchResults.filter(r => r.data !== null);
      if (successfulResults.length === 0 && searchPromises.length > 0) {
        // 모든 API 호출이 실패한 경우
        return res.status(503).json({
          error: '네이버 API 호출에 실패했습니다.',
          message: 'API 키가 올바르지 않거나 네이버 API 서버에 문제가 있습니다.',
          apiError: true
        });
      }

      // 결과 통합 및 변환
      let id = 1;
      for (const { type, data } of searchResults) {
        if (!data?.items) continue;

        for (const item of data.items) {
          const title = stripHtml(item.title);
          const description = stripHtml(item.description);
          const { sentiment, confidence } = analyzeSentiment(title + ' ' + description);
          const isAd = isLikelyAd(title, description);

          // 플랫폼별 데이터 매핑
          let platformName, url, author, postDate;

          if (type === 'blog') {
            platformName = '네이버 블로그';
            url = item.link;
            author = item.bloggername || '익명';
            postDate = item.postdate; // YYYYMMDD 형식
          } else if (type === 'cafe') {
            platformName = '네이버 카페';
            url = item.link;
            author = item.cafename || '익명';
            postDate = null; // 카페는 날짜 정보 없음
          } else if (type === 'kin') {
            platformName = '네이버 지식인';
            url = item.link;
            author = '질문자';
            postDate = null;
          }

          // 날짜 형식 변환
          let formattedDate = '';
          if (postDate && postDate.length === 8) {
            formattedDate = `${postDate.slice(0, 4)}-${postDate.slice(4, 6)}-${postDate.slice(6, 8)}`;
          } else {
            // 날짜 없으면 현재 날짜 사용 (카페, 지식인은 날짜 정보 미제공)
            formattedDate = new Date().toISOString().split('T')[0];
          }

          // 의료광고 위반 탐지
          const violations = detectViolations(title, description);
          const riskInfo = calculateRiskScore(violations);

          // 광고 표기 누락 추가 확인
          const adDisclosed = hasAdDisclosure(title + ' ' + description);
          const finalViolations = violations.map(v => {
            if (v.needsAdDisclosure && adDisclosed) {
              return null; // 광고 표기가 있으면 W04 위반 제외
            }
            return v;
          }).filter(Boolean);

          const finalRiskInfo = calculateRiskScore(finalViolations);

          results.items.push({
            id: id++,
            title,
            description,
            url,
            platform: platformName,
            author,
            date: formattedDate,
            // 위반 탐지 결과
            violations: finalViolations,
            riskScore: finalRiskInfo.totalScore,
            riskLevel: finalRiskInfo.riskLevel,
            riskLabel: finalRiskInfo.riskLabel,
            // 기존 필드 유지
            sentiment,
            sentimentConfidence: confidence,
            isAd,
            adDisclosed,
            views: null,
            likes: null,
            comments: null
          });
        }
      }

      // 기간 필터링
      if (period !== 'all') {
        const now = new Date();
        const periodDays = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }[period] || 7;
        const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

        results.items = results.items.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff;
        });
      }

      // 정렬 (위험도순 우선, 같으면 최신순)
      results.items.sort((a, b) => {
        // 위험도 우선 정렬
        const riskOrder = { high: 0, medium: 1, low: 2 };
        const riskDiff = (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2);
        if (riskDiff !== 0) return riskDiff;
        // 같은 위험도면 최신순
        return new Date(b.date) - new Date(a.date);
      });

    } else {
      // 네이버 API 키가 없으면 에러 반환 (목업 데이터 제공 안 함)
      return res.status(503).json({
        error: '네이버 API가 설정되지 않았습니다.',
        message: '관리자에게 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수 설정을 요청해주세요.',
        apiRequired: true
      });
    }

    // 통계 계산
    const blogCount = results.items.filter(i => i.platform.includes('블로그')).length;
    const cafeCount = results.items.filter(i => i.platform.includes('카페')).length;
    const kinCount = results.items.filter(i => i.platform.includes('지식인')).length;
    const adCount = results.items.filter(i => i.isAd).length;

    // 위반 통계
    const highRiskCount = results.items.filter(i => i.riskLevel === 'high').length;
    const mediumRiskCount = results.items.filter(i => i.riskLevel === 'medium').length;
    const lowRiskCount = results.items.filter(i => i.riskLevel === 'low').length;
    const hasViolation = results.items.filter(i => i.violations && i.violations.length > 0).length;

    // 전체 위험도 점수 합산
    const totalRiskScore = results.items.reduce((sum, i) => sum + (i.riskScore || 0), 0);

    // 위반 유형별 카운트
    const violationTypeCounts = {};
    results.items.forEach(item => {
      (item.violations || []).forEach(v => {
        violationTypeCounts[v.code] = (violationTypeCounts[v.code] || 0) + 1;
      });
    });

    results.totalCount = results.items.length;
    results.stats = {
      // 플랫폼별
      blogCount,
      cafeCount,
      kinCount,
      // 위반 통계 (핵심!)
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      hasViolationCount: hasViolation,
      cleanCount: results.items.length - hasViolation,
      totalRiskScore,
      violationTypeCounts,
      // 기타
      adCount,
      adRatio: results.items.length > 0 ? Math.round((adCount / results.items.length) * 100) : 0
    };

    // 전체 위험 등급 계산
    let overallRiskLevel, overallRiskLabel;
    if (highRiskCount >= 3 || totalRiskScore >= 150) {
      overallRiskLevel = 'high';
      overallRiskLabel = '고위험';
    } else if (highRiskCount >= 1 || mediumRiskCount >= 3 || totalRiskScore >= 60) {
      overallRiskLevel = 'medium';
      overallRiskLabel = '주의 필요';
    } else {
      overallRiskLevel = 'low';
      overallRiskLabel = '양호';
    }
    results.overallRisk = { level: overallRiskLevel, label: overallRiskLabel, score: totalRiskScore };
    results.analyzedAt = new Date().toISOString();
    results.apiUsed = hasNaverApi;

    res.json(results);

  } catch (error) {
    console.error('모니터링 검색 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.', detail: error.message });
  }
});

// 개별 콘텐츠 상세 정보 가져오기 (크롤링)
router.post('/detail', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다.' });
    }

    // 네이버 블로그/카페 페이지 크롤링
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // 블로그 본문 추출 시도
    let content = '';
    let viewCount = null;
    let likeCount = null;
    let commentCount = null;

    // 네이버 블로그 구조 파싱
    if (url.includes('blog.naver.com')) {
      // iframe 내부 콘텐츠는 직접 크롤링 어려움
      content = $('div.se-main-container').text() || $('div#postViewArea').text() || '';

      // 메타 정보 추출 시도
      const metaText = $('span.sympathyCount').text();
      if (metaText) likeCount = parseInt(metaText) || null;
    }

    res.json({
      url,
      content: content.slice(0, 2000),
      viewCount,
      likeCount,
      commentCount,
      crawledAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('상세 정보 크롤링 오류:', error);
    res.status(500).json({ error: '상세 정보를 가져올 수 없습니다.', detail: error.message });
  }
});

// 감성 분석 API (별도 호출용)
router.post('/analyze-sentiment', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: '분석할 텍스트가 필요합니다.' });
    }

    const result = analyzeSentiment(text);
    res.json(result);

  } catch (error) {
    res.status(500).json({ error: '감성 분석 오류', detail: error.message });
  }
});

// API 상태 확인
router.get('/status', (req, res) => {
  res.json({
    naverApiConfigured: !!(NAVER_SEARCH_ID && NAVER_SEARCH_SECRET),
    message: NAVER_SEARCH_ID && NAVER_SEARCH_SECRET
      ? '네이버 검색 API가 설정되어 있습니다.'
      : '네이버 검색 API 키가 설정되지 않았습니다. NAVER_SEARCH_ID, NAVER_SEARCH_SECRET 환경변수를 설정해주세요.'
  });
});

module.exports = router;
