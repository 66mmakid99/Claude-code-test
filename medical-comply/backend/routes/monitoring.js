const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// 네이버 API 설정
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 네이버 검색 API 호출
async function searchNaver(query, type = 'blog', display = 20, start = 1, sort = 'sim') {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
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
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
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

    // 네이버 API 키 확인
    const hasNaverApi = NAVER_CLIENT_ID && NAVER_CLIENT_SECRET;

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
          if (postDate) {
            formattedDate = `${postDate.slice(0, 4)}-${postDate.slice(4, 6)}-${postDate.slice(6, 8)}`;
          } else {
            // 날짜 없으면 현재 날짜 기준 랜덤 (임시)
            const d = new Date();
            d.setDate(d.getDate() - Math.floor(Math.random() * 30));
            formattedDate = d.toISOString().split('T')[0];
          }

          results.items.push({
            id: id++,
            title,
            description,
            url,
            platform: platformName,
            author,
            date: formattedDate,
            sentiment,
            sentimentConfidence: confidence,
            isAd,
            // 네이버 API는 조회수/좋아요 정보 미제공, 추후 크롤링 필요
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

      // 정렬
      if (sort === 'recent') {
        results.items.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

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
    const positiveCount = results.items.filter(i => i.sentiment === 'positive').length;
    const negativeCount = results.items.filter(i => i.sentiment === 'negative').length;
    const adCount = results.items.filter(i => i.isAd).length;

    results.totalCount = results.items.length;
    results.stats = {
      blogCount,
      cafeCount,
      kinCount,
      positiveCount,
      negativeCount,
      neutralCount: results.items.length - positiveCount - negativeCount,
      positiveRatio: results.items.length > 0 ? Math.round((positiveCount / results.items.length) * 100) : 0,
      negativeRatio: results.items.length > 0 ? Math.round((negativeCount / results.items.length) * 100) : 0,
      adCount,
      adRatio: results.items.length > 0 ? Math.round((adCount / results.items.length) * 100) : 0
    };
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
    naverApiConfigured: !!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET),
    message: NAVER_CLIENT_ID && NAVER_CLIENT_SECRET
      ? '네이버 API가 설정되어 있습니다.'
      : '네이버 API 키가 설정되지 않았습니다. 실제 검색을 위해 환경변수를 설정해주세요.'
  });
});

module.exports = router;
