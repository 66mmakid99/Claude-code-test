const cheerio = require('cheerio');
const axios = require('axios');

// Puppeteer 사용 가능 여부 확인
let puppeteer = null;
let usePuppeteer = false;

try {
  puppeteer = require('puppeteer');
  usePuppeteer = true;
} catch (e) {
  console.log('⚠️  Puppeteer를 사용할 수 없습니다. Axios로 대체합니다.');
}

/**
 * 웹사이트를 크롤링하여 HTML, 텍스트, 이미지 정보를 추출
 * @param {string} url - 크롤링할 URL
 * @returns {Object} 크롤링 결과
 */
async function crawlWebsite(url) {
  // Puppeteer가 없거나 실패하면 Axios 사용
  if (!usePuppeteer) {
    return crawlWithAxios(url);
  }

  let browser = null;

  try {
    // Puppeteer 브라우저 실행
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 타임아웃 설정
    await page.setDefaultNavigationTimeout(30000);

    // 페이지 로드
    await page.goto(url, { waitUntil: 'networkidle2' });

    // 스크롤하여 동적 콘텐츠 로드
    await autoScroll(page);

    // HTML 가져오기
    const html = await page.content();

    // Cheerio로 파싱
    const $ = cheerio.load(html);

    // 텍스트 추출
    const textContent = extractText($);

    // 이미지 추출
    const images = extractImages($, url);

    // 링크 추출
    const links = extractLinks($, url);

    // 메타 정보 추출
    const metadata = extractMetadata($);

    // 스크린샷 캡처 (Base64)
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false,
      type: 'jpeg',
      quality: 60
    });

    return {
      url,
      html,
      textContent,
      images,
      links,
      metadata,
      screenshot,
      crawledAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Puppeteer 크롤링 오류, Axios로 대체:', error.message);
    // Puppeteer 실패 시 Axios로 대체
    return crawlWithAxios(url);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Axios를 사용한 간단한 크롤링 (Puppeteer 대체)
 */
async function crawlWithAxios(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 텍스트 추출
    const textContent = extractText($);

    // 이미지 추출
    const images = extractImages($, url);

    // 링크 추출
    const links = extractLinks($, url);

    // 메타 정보 추출
    const metadata = extractMetadata($);

    return {
      url,
      html,
      textContent,
      images,
      links,
      metadata,
      screenshot: null, // Axios에서는 스크린샷 불가
      crawledAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Axios 크롤링 오류:', error.message);
    throw new Error(`웹사이트 크롤링 실패: ${error.message}`);
  }
}

/**
 * 페이지 자동 스크롤 (동적 콘텐츠 로드)
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const maxScrolls = 10;
      let scrollCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          window.scrollTo(0, 0); // 맨 위로 복귀
          resolve();
        }
      }, 200);
    });
  });
}

/**
 * 텍스트 콘텐츠 추출
 */
function extractText($) {
  // 불필요한 요소 제거
  $('script, style, noscript, iframe, svg').remove();

  const sections = [];

  // 주요 섹션별 텍스트 추출
  const selectors = [
    { name: 'header', selector: 'header, .header, #header' },
    { name: 'navigation', selector: 'nav, .nav, .menu, .navigation' },
    { name: 'main', selector: 'main, .main, #main, .content, #content, article' },
    { name: 'aside', selector: 'aside, .sidebar, .aside' },
    { name: 'footer', selector: 'footer, .footer, #footer' }
  ];

  for (const { name, selector } of selectors) {
    const text = $(selector).text().trim().replace(/\s+/g, ' ');
    if (text) {
      sections.push({ section: name, text });
    }
  }

  // 전체 body 텍스트
  const fullText = $('body').text().trim().replace(/\s+/g, ' ');

  // 특정 키워드가 포함된 요소 찾기
  const suspiciousElements = [];
  const keywords = ['후기', '전후', '성공률', '최고', '최초', '1위', '할인', '이벤트'];

  $('*').each((_, el) => {
    const text = $(el).text().trim();
    for (const keyword of keywords) {
      if (text.includes(keyword) && text.length < 500) {
        suspiciousElements.push({
          keyword,
          text: text.substring(0, 200),
          tag: el.tagName?.toLowerCase(),
          class: $(el).attr('class'),
          id: $(el).attr('id')
        });
        break;
      }
    }
  });

  return {
    sections,
    fullText: fullText.substring(0, 50000), // 최대 50KB
    suspiciousElements: suspiciousElements.slice(0, 100) // 최대 100개
  };
}

/**
 * 이미지 정보 추출 (문맥 기반 분석 포함)
 */
function extractImages($, baseUrl) {
  const images = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || '';
    const title = $(el).attr('title') || '';

    if (src) {
      // 상대 URL을 절대 URL로 변환
      let fullUrl = src;
      try {
        fullUrl = new URL(src, baseUrl).href;
      } catch {}

      // 부모 요소 컨텍스트 추출
      const parentContext = getImageContext($, el);

      // 전후 사진 관련 분석
      const suspicionResult = checkSuspiciousImage(alt, title, src, parentContext);

      images.push({
        src: fullUrl,
        alt,
        title,
        context: parentContext,
        isSuspicious: suspicionResult.isSuspicious,
        suspicionReason: suspicionResult.reason,
        suspicionScore: suspicionResult.score
      });
    }
  });

  return images;
}

/**
 * 이미지 주변 컨텍스트 추출
 */
function getImageContext($, imgElement) {
  const context = {
    parentClass: '',
    parentId: '',
    sectionType: '',
    nearbyText: '',
    isInStaffSection: false,
    isInGallerySection: false
  };

  try {
    // 부모 요소 정보
    const $parent = $(imgElement).parent();
    context.parentClass = $parent.attr('class') || '';
    context.parentId = $parent.attr('id') || '';

    // 상위 5단계까지 탐색하여 섹션 타입 감지
    let $current = $(imgElement);
    for (let i = 0; i < 5; i++) {
      $current = $current.parent();
      if (!$current.length) break;

      const cls = ($current.attr('class') || '').toLowerCase();
      const id = ($current.attr('id') || '').toLowerCase();
      const combined = `${cls} ${id}`;

      // 의료진/스태프 섹션 감지
      if (/staff|doctor|team|의료진|원장|전문의|profile|about/.test(combined)) {
        context.isInStaffSection = true;
        context.sectionType = 'staff';
      }

      // 갤러리/시설 섹션 감지
      if (/gallery|facility|시설|내부|인테리어/.test(combined)) {
        context.isInGallerySection = true;
        context.sectionType = 'facility';
      }

      // 후기/리뷰 섹션 감지
      if (/review|후기|testimonial|result|결과/.test(combined)) {
        context.sectionType = 'review';
      }
    }

    // 주변 텍스트 추출 (이미지 근처 100자)
    const siblingText = $(imgElement).siblings().text().substring(0, 100);
    const parentText = $parent.text().substring(0, 100);
    context.nearbyText = `${siblingText} ${parentText}`.trim().substring(0, 150);

  } catch (e) {
    // 에러 시 기본값 유지
  }

  return context;
}

/**
 * 의심스러운 이미지 체크 (문맥 기반 분석)
 * @returns {Object} { isSuspicious: boolean, reason: string, score: number }
 */
function checkSuspiciousImage(alt, title, src, context = {}) {
  const text = `${alt} ${title} ${src}`.toLowerCase();
  let suspicionScore = 0;
  let reasons = [];

  // 1. 명확한 제외 패턴 (프로필, 로고, 아이콘 등)
  const excludePatterns = [
    /logo|icon|avatar|profile|stamp|badge|seal/i,
    /원장|의사|doctor|staff|team|ceo/i,
    /favicon|thumbnail|banner|header/i,
    /kakao|naver|facebook|instagram|youtube|sns/i,
    /button|btn|arrow|menu|nav/i,
    /map|location|위치/i
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(text)) {
      return { isSuspicious: false, reason: '제외 패턴 매칭', score: 0 };
    }
  }

  // 2. 의료진 섹션의 이미지는 제외
  if (context.isInStaffSection) {
    return { isSuspicious: false, reason: '의료진 섹션 이미지', score: 0 };
  }

  // 3. 시설 갤러리 섹션의 이미지는 제외
  if (context.isInGallerySection) {
    return { isSuspicious: false, reason: '시설 갤러리 이미지', score: 0 };
  }

  // 4. 전후 비교 키워드 체크 (명시적)
  const beforeAfterPatterns = [
    /before.*after|전.*후|비포.*애프터/i,
    /시술\s*전|시술\s*후/i,
    /치료\s*전|치료\s*후/i,
    /전후\s*비교|비교\s*사진/i
  ];

  for (const pattern of beforeAfterPatterns) {
    if (pattern.test(text) || pattern.test(context.nearbyText || '')) {
      suspicionScore += 40;
      reasons.push('전후 비교 패턴 발견');
    }
  }

  // 5. 결과 관련 키워드 (의심도 증가)
  const resultKeywords = ['result', '결과', '효과', '변화'];
  for (const keyword of resultKeywords) {
    if (text.includes(keyword)) {
      suspicionScore += 15;
      reasons.push(`결과 키워드: ${keyword}`);
    }
  }

  // 6. 후기/리뷰 섹션 내 이미지
  if (context.sectionType === 'review') {
    suspicionScore += 25;
    reasons.push('후기 섹션 이미지');
  }

  // 7. 파일명 패턴 분석
  const filenamePatterns = [
    /ba\d|before_after/i,  // ba1, before_after
    /compare|comparison/i,
    /result\d|effect/i
  ];

  for (const pattern of filenamePatterns) {
    if (pattern.test(src)) {
      suspicionScore += 20;
      reasons.push('의심스러운 파일명');
    }
  }

  // 임계값 30 이상이면 의심
  const isSuspicious = suspicionScore >= 30;

  return {
    isSuspicious,
    reason: reasons.length > 0 ? reasons.join(', ') : '해당 없음',
    score: suspicionScore
  };
}

/**
 * 링크 추출
 */
function extractLinks($, baseUrl) {
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();

    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const fullUrl = new URL(href, baseUrl).href;
        links.push({ url: fullUrl, text: text.substring(0, 100) });
      } catch {}
    }
  });

  return links.slice(0, 200); // 최대 200개
}

/**
 * 메타데이터 추출
 */
function extractMetadata($) {
  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    keywords: $('meta[name="keywords"]').attr('content') || '',
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    ogDescription: $('meta[property="og:description"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || ''
  };
}

module.exports = {
  crawlWebsite
};
