/**
 * MEDCHECKER 위반 영역 스크린샷 캡처 서비스
 * 
 * Playwright를 사용하여 웹페이지의 위반 영역을 캡처
 * 
 * 기능:
 * 1. 전체 페이지 스크린샷
 * 2. 특정 텍스트 영역 하이라이트 스크린샷
 * 3. 위반 텍스트 주변 영역만 크롭 캡처
 */

let playwright = null;

// Playwright 동적 로드 시도
try {
  playwright = require('playwright');
} catch (e) {
  console.warn('[ScreenshotCapturer] Playwright 미설치 - 스크린샷 기능 비활성화');
}

class ScreenshotCapturer {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      viewport: config.viewport || { width: 1280, height: 800 },
      deviceScaleFactor: config.deviceScaleFactor || 1,
      highlightColor: config.highlightColor || 'rgba(255, 0, 0, 0.3)',
      highlightBorderColor: config.highlightBorderColor || '#ff0000',
      padding: config.padding || 50, // 캡처 영역 패딩
      maxRetries: config.maxRetries || 2,
      debug: config.debug || false,
    };
    
    this.browser = null;
    this.isAvailable = !!playwright;
  }

  /**
   * Playwright 사용 가능 여부 확인
   */
  checkAvailability() {
    if (!this.isAvailable) {
      console.warn('[ScreenshotCapturer] Playwright가 설치되지 않아 스크린샷을 캡처할 수 없습니다.');
      console.warn('설치: npm install playwright && npx playwright install chromium');
      return false;
    }
    return true;
  }

  /**
   * 브라우저 초기화
   */
  async initBrowser() {
    if (!this.checkAvailability()) return false;
    
    if (!this.browser) {
      try {
        this.browser = await playwright.chromium.launch({
          headless: this.config.headless,
        });
        return true;
      } catch (error) {
        console.error('[ScreenshotCapturer] 브라우저 초기화 실패:', error.message);
        this.isAvailable = false;
        return false;
      }
    }
    return true;
  }

  /**
   * 전체 페이지 스크린샷 캡처
   * @param {string} url - 캡처할 URL
   * @returns {Object} { success, screenshot (base64), error }
   */
  async captureFullPage(url) {
    if (!await this.initBrowser()) {
      return { success: false, error: 'Browser not available' };
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setViewportSize(this.config.viewport);
      
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // 팝업 닫기 시도
      await this.tryClosePopups(page);

      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        mimeType: 'image/png',
      };
    } catch (error) {
      console.error('[ScreenshotCapturer] 전체 페이지 캡처 실패:', error.message);
      return { success: false, error: error.message };
    } finally {
      await page.close();
    }
  }

  /**
   * 특정 텍스트 영역을 하이라이트하여 스크린샷 캡처
   * @param {string} url - 캡처할 URL
   * @param {string} targetText - 하이라이트할 텍스트
   * @param {Object} options - 추가 옵션
   * @returns {Object} { success, screenshot (base64), boundingBox, error }
   */
  async captureWithHighlight(url, targetText, options = {}) {
    if (!await this.initBrowser()) {
      return { success: false, error: 'Browser not available' };
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setViewportSize(this.config.viewport);
      
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // 팝업 닫기 시도
      await this.tryClosePopups(page);

      // 대상 텍스트 찾기 및 하이라이트
      const highlightResult = await page.evaluate(({ text, highlightColor, borderColor }) => {
        // TreeWalker를 사용하여 텍스트 노드 검색
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        let found = false;
        let boundingBox = null;

        while (node = walker.nextNode()) {
          if (node.textContent.includes(text)) {
            const parent = node.parentElement;
            if (parent) {
              // 하이라이트 스타일 적용
              const originalBg = parent.style.backgroundColor;
              const originalBorder = parent.style.border;
              const originalPosition = parent.style.position;
              
              parent.style.backgroundColor = highlightColor;
              parent.style.border = `3px solid ${borderColor}`;
              parent.style.position = 'relative';
              
              // 라벨 추가
              const label = document.createElement('div');
              label.textContent = '⚠️ 위반 의심';
              label.style.cssText = `
                position: absolute;
                top: -25px;
                left: 0;
                background: ${borderColor};
                color: white;
                padding: 2px 8px;
                font-size: 12px;
                font-weight: bold;
                border-radius: 3px;
                z-index: 10000;
              `;
              label.className = 'medchecker-violation-label';
              parent.insertBefore(label, parent.firstChild);

              // 위치 정보 저장
              const rect = parent.getBoundingClientRect();
              boundingBox = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
              };

              // 해당 위치로 스크롤
              parent.scrollIntoView({ behavior: 'instant', block: 'center' });

              found = true;
              break; // 첫 번째 매칭만 처리
            }
          }
        }

        return { found, boundingBox };
      }, {
        text: targetText,
        highlightColor: this.config.highlightColor,
        borderColor: this.config.highlightBorderColor,
      });

      if (!highlightResult.found) {
        // 텍스트를 찾지 못한 경우 전체 페이지 캡처
        const fullScreenshot = await page.screenshot({
          fullPage: true,
          type: 'png',
        });

        return {
          success: true,
          screenshot: fullScreenshot.toString('base64'),
          mimeType: 'image/png',
          textFound: false,
          note: '대상 텍스트를 찾지 못해 전체 페이지를 캡처했습니다.',
        };
      }

      // 잠시 대기 (렌더링 완료)
      await page.waitForTimeout(300);

      // 크롭 영역 계산
      const padding = options.padding || this.config.padding;
      const clip = highlightResult.boundingBox ? {
        x: Math.max(0, highlightResult.boundingBox.x - padding),
        y: Math.max(0, highlightResult.boundingBox.y - padding),
        width: Math.min(
          this.config.viewport.width,
          highlightResult.boundingBox.width + (padding * 2)
        ),
        height: Math.min(
          800, // 최대 높이 제한
          highlightResult.boundingBox.height + (padding * 2)
        ),
      } : null;

      // 스크린샷 캡처
      const screenshot = await page.screenshot({
        type: 'png',
        clip: options.cropToElement !== false && clip ? clip : undefined,
        fullPage: options.cropToElement === false,
      });

      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        mimeType: 'image/png',
        textFound: true,
        boundingBox: highlightResult.boundingBox,
      };
    } catch (error) {
      console.error('[ScreenshotCapturer] 하이라이트 캡처 실패:', error.message);
      return { success: false, error: error.message };
    } finally {
      await page.close();
    }
  }

  /**
   * 여러 위반 영역을 한 번에 캡처
   * @param {string} url - 캡처할 URL
   * @param {Array} violations - 위반 목록 [{ text, ruleId, ... }]
   * @returns {Array} 캡처 결과 배열
   */
  async captureMultipleViolations(url, violations) {
    if (!await this.initBrowser()) {
      return violations.map(v => ({
        ...v,
        screenshot: null,
        screenshotError: 'Browser not available',
      }));
    }

    const page = await this.browser.newPage();
    const results = [];
    
    try {
      await page.setViewportSize(this.config.viewport);
      
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // 팝업 닫기 시도
      await this.tryClosePopups(page);

      // 각 위반에 대해 캡처
      for (const violation of violations) {
        try {
          // 이전 하이라이트 제거
          await page.evaluate(() => {
            document.querySelectorAll('.medchecker-violation-label').forEach(el => el.remove());
            document.querySelectorAll('[data-medchecker-highlight]').forEach(el => {
              el.style.backgroundColor = el.dataset.originalBg || '';
              el.style.border = el.dataset.originalBorder || '';
              delete el.dataset.medcheckerHighlight;
            });
          });

          // 텍스트 하이라이트
          const highlightResult = await this.highlightTextOnPage(page, violation.matchedText || violation.text);

          if (highlightResult.found) {
            await page.waitForTimeout(200);

            // 크롭 영역 계산
            const padding = this.config.padding;
            const clip = highlightResult.boundingBox ? {
              x: Math.max(0, highlightResult.boundingBox.x - padding),
              y: Math.max(0, highlightResult.boundingBox.y - padding),
              width: Math.min(this.config.viewport.width, highlightResult.boundingBox.width + (padding * 2)),
              height: Math.min(600, highlightResult.boundingBox.height + (padding * 2)),
            } : null;

            const screenshot = await page.screenshot({
              type: 'png',
              clip: clip || undefined,
            });

            results.push({
              ...violation,
              screenshot: screenshot.toString('base64'),
              screenshotMimeType: 'image/png',
              boundingBox: highlightResult.boundingBox,
            });
          } else {
            results.push({
              ...violation,
              screenshot: null,
              screenshotNote: '텍스트를 찾지 못함',
            });
          }
        } catch (error) {
          results.push({
            ...violation,
            screenshot: null,
            screenshotError: error.message,
          });
        }
      }
    } catch (error) {
      console.error('[ScreenshotCapturer] 다중 캡처 실패:', error.message);
      return violations.map(v => ({
        ...v,
        screenshot: null,
        screenshotError: error.message,
      }));
    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * 페이지 내 텍스트 하이라이트
   */
  async highlightTextOnPage(page, text) {
    return await page.evaluate(({ text, highlightColor, borderColor }) => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      let found = false;
      let boundingBox = null;

      while (node = walker.nextNode()) {
        if (node.textContent.includes(text)) {
          const parent = node.parentElement;
          if (parent) {
            // 원본 스타일 저장
            parent.dataset.originalBg = parent.style.backgroundColor;
            parent.dataset.originalBorder = parent.style.border;
            parent.dataset.medcheckerHighlight = 'true';
            
            // 하이라이트 적용
            parent.style.backgroundColor = highlightColor;
            parent.style.border = `3px solid ${borderColor}`;
            
            // 라벨 추가
            const label = document.createElement('div');
            label.textContent = '⚠️ 위반 의심';
            label.className = 'medchecker-violation-label';
            label.style.cssText = `
              position: absolute;
              top: -25px;
              left: 0;
              background: ${borderColor};
              color: white;
              padding: 2px 8px;
              font-size: 12px;
              font-weight: bold;
              border-radius: 3px;
              z-index: 10000;
            `;
            
            const computedStyle = window.getComputedStyle(parent);
            if (computedStyle.position === 'static') {
              parent.style.position = 'relative';
            }
            parent.insertBefore(label, parent.firstChild);

            const rect = parent.getBoundingClientRect();
            boundingBox = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
            };

            parent.scrollIntoView({ behavior: 'instant', block: 'center' });
            found = true;
            break;
          }
        }
      }

      return { found, boundingBox };
    }, {
      text,
      highlightColor: this.config.highlightColor,
      borderColor: this.config.highlightBorderColor,
    });
  }

  /**
   * 팝업/모달 닫기 시도
   */
  async tryClosePopups(page) {
    try {
      // 일반적인 팝업 닫기 버튼 클릭
      const closeSelectors = [
        '[class*="close"]',
        '[class*="Close"]',
        '[aria-label="close"]',
        '[aria-label="닫기"]',
        'button:has-text("닫기")',
        'button:has-text("Close")',
        '.popup-close',
        '.modal-close',
        '.layer-close',
      ];

      for (const selector of closeSelectors) {
        try {
          const closeBtn = await page.$(selector);
          if (closeBtn) {
            const isVisible = await closeBtn.isVisible();
            if (isVisible) {
              await closeBtn.click();
              await page.waitForTimeout(300);
            }
          }
        } catch (e) {
          // 무시
        }
      }

      // ESC 키 누르기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (error) {
      // 팝업 닫기 실패해도 계속 진행
      if (this.config.debug) {
        console.log('[ScreenshotCapturer] 팝업 닫기 실패 (무시):', error.message);
      }
    }
  }

  /**
   * 브라우저 종료
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Playwright 없이도 기본 정보 제공하는 폴백 클래스
class ScreenshotCapturerFallback {
  constructor() {
    this.isAvailable = false;
  }

  checkAvailability() {
    console.warn('[ScreenshotCapturer] Playwright가 설치되지 않았습니다.');
    console.warn('설치: npm install playwright && npx playwright install chromium');
    return false;
  }

  async captureFullPage() {
    return {
      success: false,
      error: 'Playwright not installed. Run: npm install playwright && npx playwright install chromium',
      installCommand: 'npm install playwright && npx playwright install chromium',
    };
  }

  async captureWithHighlight() {
    return {
      success: false,
      error: 'Playwright not installed. Run: npm install playwright && npx playwright install chromium',
      installCommand: 'npm install playwright && npx playwright install chromium',
    };
  }

  async captureMultipleViolations(url, violations) {
    return violations.map(v => ({
      ...v,
      screenshot: null,
      screenshotError: 'Playwright not installed',
    }));
  }

  async close() {}
}

// Playwright 설치 여부에 따라 적절한 클래스 내보내기
module.exports = playwright ? ScreenshotCapturer : ScreenshotCapturerFallback;
module.exports.ScreenshotCapturer = ScreenshotCapturer;
module.exports.ScreenshotCapturerFallback = ScreenshotCapturerFallback;
