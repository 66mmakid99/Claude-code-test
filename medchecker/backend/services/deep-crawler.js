/**
 * MEDCHECKER 심층 크롤링 서비스
 * 
 * 병원 사이트의 특수한 구조를 처리하기 위한 고급 크롤링 기능
 * 
 * 핵심 기능:
 * 1. Playwright 기반 동적 렌더링
 * 2. 팝업/모달/플로팅 배너 감지
 * 3. 이미지 OCR (Google Vision API)
 * 4. 서브페이지 자동 탐색
 * 5. 스크린샷 기반 분석
 */

const axios = require('axios');
const cheerio = require('cheerio');

class DeepCrawler {
  constructor(config = {}) {
    this.config = {
      // Playwright 설정
      usePuppeteer: config.usePuppeteer || false,
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      
      // OCR 설정
      enableOCR: config.enableOCR || false,
      ocrProvider: config.ocrProvider || 'google', // 'google' | 'tesseract'
      googleVisionApiKey: config.googleVisionApiKey || process.env.GOOGLE_VISION_API_KEY,
      
      // 크롤링 범위
      maxSubpages: config.maxSubpages || 10,
      maxDepth: config.maxDepth || 2,
      
      // 팝업 감지
      detectPopups: config.detectPopups !== false,
      popupWaitTime: config.popupWaitTime || 3000,
      
      debug: config.debug || false,
    };
    
    this.browser = null;
    this.crawledUrls = new Set();
  }

  /**
   * 전체 사이트 심층 크롤링
   */
  async crawlSite(url, options = {}) {
    const startTime = Date.now();
    const results = {
      url,
      success: true,
      pages: [],
      images: [],
      popups: [],
      floatingElements: [],
      metadata: {},
      errors: [],
      stats: {
        totalPages: 0,
        totalImages: 0,
        totalPopups: 0,
        ocrProcessed: 0,
        processingTimeMs: 0,
      },
    };

    try {
      // 1. 메인 페이지 크롤링
      const mainPage = await this.crawlPage(url, options);
      results.pages.push(mainPage);
      results.metadata = mainPage.metadata;

      // 2. 서브페이지 수집 및 크롤링
      if (options.crawlSubpages !== false) {
        const subpageUrls = this.extractSubpageUrls(mainPage, url);
        
        for (const subUrl of subpageUrls.slice(0, this.config.maxSubpages)) {
          if (this.crawledUrls.has(subUrl)) continue;
          
          try {
            const subPage = await this.crawlPage(subUrl, { ...options, depth: 1 });
            results.pages.push(subPage);
          } catch (error) {
            results.errors.push({
              url: subUrl,
              error: error.message,
            });
          }
        }
      }

      // 3. 이미지 OCR 처리 (활성화된 경우)
      if (this.config.enableOCR && options.processImages !== false) {
        for (const page of results.pages) {
          for (const image of page.images || []) {
            if (this.shouldProcessImage(image)) {
              try {
                const ocrResult = await this.processImageOCR(image.src);
                if (ocrResult.text) {
                  results.images.push({
                    ...image,
                    ocrText: ocrResult.text,
                    ocrConfidence: ocrResult.confidence,
                  });
                  results.stats.ocrProcessed++;
                }
              } catch (error) {
                if (this.config.debug) {
                  console.log(`[DeepCrawler] OCR 실패: ${image.src}`, error.message);
                }
              }
            }
          }
        }
      }

      // 4. 통계 계산
      results.stats.totalPages = results.pages.length;
      results.stats.totalImages = results.images.length;
      results.stats.totalPopups = results.popups.length;
      results.stats.processingTimeMs = Date.now() - startTime;

    } catch (error) {
      results.success = false;
      results.errors.push({
        url,
        error: error.message,
      });
    } finally {
      await this.closeBrowser();
    }

    return results;
  }

  /**
   * 단일 페이지 크롤링
   */
  async crawlPage(url, options = {}) {
    this.crawledUrls.add(url);
    
    const result = {
      url,
      title: '',
      description: '',
      textContent: '',
      htmlContent: '',
      images: [],
      links: [],
      popups: [],
      floatingElements: [],
      metadata: {},
    };

    if (this.config.usePuppeteer) {
      // Playwright/Puppeteer 기반 동적 크롤링
      return await this.crawlWithBrowser(url, options);
    } else {
      // Axios + Cheerio 기반 정적 크롤링
      return await this.crawlStatic(url, options);
    }
  }

  /**
   * 정적 크롤링 (Axios + Cheerio)
   */
  async crawlStatic(url, options = {}) {
    const response = await axios.get(url, {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // 불필요한 요소 제거
    $('script, style, noscript, iframe, svg').remove();

    // 메타데이터 추출
    const metadata = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
    };

    // 텍스트 콘텐츠 추출
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();

    // 이미지 추출 (광고성 이미지 필터링)
    const images = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const alt = $(el).attr('alt') || '';
      
      if (src && this.isRelevantImage(src, alt)) {
        images.push({
          src: this.resolveUrl(src, url),
          alt,
          width: $(el).attr('width'),
          height: $(el).attr('height'),
        });
      }
    });

    // 배경 이미지 추출 (CSS)
    $('[style*="background"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
      if (bgMatch && bgMatch[1]) {
        images.push({
          src: this.resolveUrl(bgMatch[1], url),
          alt: 'background-image',
          type: 'background',
        });
      }
    });

    // 링크 추출 (서브페이지용)
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (href && this.isInternalLink(href, url)) {
        links.push({
          href: this.resolveUrl(href, url),
          text,
        });
      }
    });

    // 팝업/모달 감지 (정적 분석)
    const popups = this.detectStaticPopups($);

    // 플로팅 요소 감지
    const floatingElements = this.detectFloatingElements($);

    return {
      url,
      ...metadata,
      textContent,
      htmlContent: response.data,
      images,
      links,
      popups,
      floatingElements,
      metadata,
    };
  }

  /**
   * 동적 크롤링 (Playwright)
   * TODO: Playwright 설치 후 구현
   */
  async crawlWithBrowser(url, options = {}) {
    // Playwright가 설치되지 않은 경우 정적 크롤링으로 폴백
    console.log('[DeepCrawler] Playwright 미설치 - 정적 크롤링으로 대체');
    return await this.crawlStatic(url, options);
    
    /*
    // Playwright 구현 (향후)
    const { chromium } = require('playwright');
    
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.config.headless,
      });
    }
    
    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });
      
      // 팝업 대기 및 감지
      if (this.config.detectPopups) {
        await page.waitForTimeout(this.config.popupWaitTime);
        
        // 모달/팝업 감지
        const popups = await page.evaluate(() => {
          const popupSelectors = [
            '[class*="popup"]', '[class*="modal"]', '[class*="layer"]',
            '[class*="overlay"]', '[class*="dialog"]', '[class*="alert"]',
            '[id*="popup"]', '[id*="modal"]', '[id*="layer"]',
          ];
          
          const popups = [];
          for (const selector of popupSelectors) {
            document.querySelectorAll(selector).forEach(el => {
              const style = window.getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                popups.push({
                  selector,
                  text: el.innerText?.substring(0, 500),
                  html: el.outerHTML?.substring(0, 1000),
                });
              }
            });
          }
          return popups;
        });
      }
      
      // 스크린샷 캡처 (선택적)
      if (options.captureScreenshot) {
        const screenshot = await page.screenshot({
          fullPage: true,
          type: 'png',
        });
      }
      
      // 콘텐츠 추출
      const content = await page.evaluate(() => {
        return {
          title: document.title,
          textContent: document.body.innerText,
          // ... 기타 추출
        };
      });
      
      return content;
      
    } finally {
      await page.close();
    }
    */
  }

  /**
   * 이미지 OCR 처리
   */
  async processImageOCR(imageUrl) {
    if (this.config.ocrProvider === 'google') {
      return await this.googleVisionOCR(imageUrl);
    } else {
      return await this.tesseractOCR(imageUrl);
    }
  }

  /**
   * Google Vision API OCR
   */
  async googleVisionOCR(imageUrl) {
    if (!this.config.googleVisionApiKey) {
      throw new Error('Google Vision API key not configured');
    }

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${this.config.googleVisionApiKey}`;

    // 이미지 URL에서 base64로 변환하거나 URL 직접 사용
    let imageSource;
    if (imageUrl.startsWith('data:')) {
      // Base64 이미지
      const base64Data = imageUrl.split(',')[1];
      imageSource = { content: base64Data };
    } else {
      // URL 이미지
      imageSource = { source: { imageUri: imageUrl } };
    }

    const response = await axios.post(endpoint, {
      requests: [{
        image: imageSource,
        features: [
          { type: 'TEXT_DETECTION', maxResults: 10 },
        ],
        imageContext: {
          languageHints: ['ko', 'en'],
        },
      }],
    });

    const result = response.data.responses[0];
    
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      return {
        text: result.textAnnotations[0].description,
        confidence: result.fullTextAnnotation?.pages?.[0]?.confidence || 0.8,
        words: result.textAnnotations.slice(1).map(a => ({
          text: a.description,
          bounds: a.boundingPoly,
        })),
      };
    }

    return { text: '', confidence: 0 };
  }

  /**
   * Tesseract OCR (로컬)
   * TODO: tesseract.js 설치 후 구현
   */
  async tesseractOCR(imageUrl) {
    // const Tesseract = require('tesseract.js');
    // const result = await Tesseract.recognize(imageUrl, 'kor+eng');
    // return {
    //   text: result.data.text,
    //   confidence: result.data.confidence / 100,
    // };
    
    throw new Error('Tesseract OCR not implemented yet');
  }

  /**
   * 정적 팝업/모달 감지
   */
  detectStaticPopups($) {
    const popups = [];
    const popupSelectors = [
      '[class*="popup"]', '[class*="modal"]', '[class*="layer"]',
      '[class*="overlay"]', '[class*="dialog"]', '[class*="banner"]',
      '[id*="popup"]', '[id*="modal"]', '[id*="layer"]',
    ];

    for (const selector of popupSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 10 && text.length < 2000) {
          popups.push({
            selector,
            text: text.substring(0, 500),
            type: 'static',
          });
        }
      });
    }

    return popups;
  }

  /**
   * 플로팅 요소 감지
   */
  detectFloatingElements($) {
    const floating = [];
    
    // position: fixed 요소 찾기 (스타일 속성에서)
    $('[style*="position"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      if (style.includes('fixed') || style.includes('sticky')) {
        const text = $(el).text().trim();
        if (text.length > 5) {
          floating.push({
            type: 'fixed',
            text: text.substring(0, 200),
          });
        }
      }
    });

    // 일반적인 플로팅 배너 클래스명
    const floatingSelectors = [
      '[class*="float"]', '[class*="sticky"]', '[class*="fixed"]',
      '[class*="quick"]', '[class*="side-banner"]', '[class*="top-banner"]',
    ];

    for (const selector of floatingSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 5) {
          floating.push({
            selector,
            text: text.substring(0, 200),
            type: 'class-based',
          });
        }
      });
    }

    return floating;
  }

  /**
   * 서브페이지 URL 추출
   */
  extractSubpageUrls(page, baseUrl) {
    const urls = new Set();
    const baseHost = new URL(baseUrl).host;

    for (const link of page.links || []) {
      try {
        const linkUrl = new URL(link.href);
        
        // 같은 도메인인지 확인
        if (linkUrl.host === baseHost) {
          // 의미있는 페이지인지 확인
          const path = linkUrl.pathname.toLowerCase();
          
          // 제외할 패턴
          const excludePatterns = [
            /\.(jpg|jpeg|png|gif|pdf|doc|zip|css|js)$/i,
            /\/(login|logout|signin|signup|member|cart|order)/i,
            /#/,
          ];
          
          const shouldExclude = excludePatterns.some(p => p.test(link.href));
          
          // 포함할 패턴 (의료 관련)
          const includePatterns = [
            /(about|intro|hospital|clinic|doctor|staff|service|treatment|surgery|procedure)/i,
            /(시술|치료|수술|진료|의료진|병원소개|클리닉|전문)/i,
            /(gallery|photo|case|review|event|notice)/i,
          ];
          
          const shouldInclude = includePatterns.some(p => p.test(link.href) || p.test(link.text));
          
          if (!shouldExclude && (shouldInclude || path.length < 30)) {
            urls.add(link.href);
          }
        }
      } catch (e) {
        // 잘못된 URL 무시
      }
    }

    return Array.from(urls);
  }

  /**
   * 관련 이미지인지 확인 (광고/아이콘 제외)
   */
  isRelevantImage(src, alt) {
    // 제외할 패턴
    const excludePatterns = [
      /icon|logo|btn|button|arrow|bg-|background/i,
      /\.gif$/i,
      /1x1|transparent|spacer/i,
      /ad|banner|sponsor/i,
      /facebook|twitter|instagram|kakao|naver|google/i,
    ];

    if (excludePatterns.some(p => p.test(src) || p.test(alt))) {
      return false;
    }

    // 포함할 패턴 (전후사진, 시술 이미지 등)
    const includePatterns = [
      /before|after|전후|비포|애프터/i,
      /case|사례|케이스|결과/i,
      /surgery|시술|수술|치료/i,
      /gallery|갤러리|사진/i,
    ];

    // 크기 기반 필터링 (작은 이미지 제외) - 속성이 있는 경우
    // 실제로는 이미지 로드 후 크기 확인 필요

    return true; // 기본적으로 포함
  }

  /**
   * OCR 처리 대상 이미지인지 확인
   */
  shouldProcessImage(image) {
    // 전후사진, 배너 등 텍스트가 포함될 가능성이 높은 이미지
    const ocrTargetPatterns = [
      /before|after|전후|비포|애프터/i,
      /banner|배너|event|이벤트/i,
      /notice|공지|popup|팝업/i,
      /price|가격|비용|할인/i,
    ];

    const src = image.src || '';
    const alt = image.alt || '';

    return ocrTargetPatterns.some(p => p.test(src) || p.test(alt));
  }

  /**
   * 내부 링크인지 확인
   */
  isInternalLink(href, baseUrl) {
    if (!href) return false;
    if (href.startsWith('#')) return false;
    if (href.startsWith('javascript:')) return false;
    if (href.startsWith('mailto:')) return false;
    if (href.startsWith('tel:')) return false;

    try {
      const baseHost = new URL(baseUrl).host;
      
      if (href.startsWith('/')) return true;
      if (href.startsWith('./')) return true;
      
      const linkHost = new URL(href, baseUrl).host;
      return linkHost === baseHost;
    } catch {
      return false;
    }
  }

  /**
   * 상대 URL을 절대 URL로 변환
   */
  resolveUrl(href, baseUrl) {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return 'https:' + href;
    
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  /**
   * 브라우저 종료
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 전체 텍스트 합치기 (분석용)
   */
  combineAllText(crawlResult) {
    const texts = [];

    // 페이지 텍스트
    for (const page of crawlResult.pages || []) {
      if (page.textContent) {
        texts.push(page.textContent);
      }
    }

    // OCR 텍스트
    for (const image of crawlResult.images || []) {
      if (image.ocrText) {
        texts.push(`[이미지 OCR] ${image.ocrText}`);
      }
    }

    // 팝업 텍스트
    for (const popup of crawlResult.popups || []) {
      if (popup.text) {
        texts.push(`[팝업] ${popup.text}`);
      }
    }

    // 플로팅 요소 텍스트
    for (const floating of crawlResult.floatingElements || []) {
      if (floating.text) {
        texts.push(`[플로팅] ${floating.text}`);
      }
    }

    return texts.join('\n\n');
  }
}

module.exports = DeepCrawler;
