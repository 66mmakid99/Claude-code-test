const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

/**
 * 웹사이트를 크롤링하여 HTML, 텍스트, 이미지 정보를 추출
 * @param {string} url - 크롤링할 URL
 * @returns {Object} 크롤링 결과
 */
async function crawlWebsite(url) {
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
    console.error('크롤링 오류:', error);
    throw new Error(`웹사이트 크롤링 실패: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
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
 * 이미지 정보 추출
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

      images.push({
        src: fullUrl,
        alt,
        title,
        // 전후 사진 관련 키워드 체크
        isSuspicious: checkSuspiciousImage(alt, title, src)
      });
    }
  });

  return images;
}

/**
 * 의심스러운 이미지 체크 (전후 사진 등)
 */
function checkSuspiciousImage(alt, title, src) {
  const text = `${alt} ${title} ${src}`.toLowerCase();
  const suspiciousKeywords = [
    'before', 'after', '전', '후', '비포', '애프터',
    'result', '결과', 'comparison', '비교'
  ];

  return suspiciousKeywords.some(keyword => text.includes(keyword));
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
