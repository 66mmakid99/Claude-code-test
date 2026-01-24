/**
 * HTML 구조 기반 문맥 분석기
 * 
 * 핵심 기능:
 * 1. 메뉴/네비게이션 요소 탐지 - 광고가 아닌 UI 요소 식별
 * 2. 로그인 보호 콘텐츠 판별 - 비공개 콘텐츠 필터링
 * 3. 광고성 컨텍스트 vs UI 컨텍스트 구분
 * 
 * 오탐 방지 원칙:
 * - 메뉴명, 네비게이션 링크 텍스트는 광고가 아님
 * - 로그인해야 보이는 콘텐츠는 공개 광고가 아님
 * - 푸터의 회사 정보는 광고가 아님
 * - 버튼/링크의 CTA 텍스트는 문맥 고려 필요
 */

const cheerio = require('cheerio');

class HtmlContextAnalyzer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    
    // 메뉴/네비게이션 컨테이너 셀렉터
    this.menuContainerSelectors = [
      'nav',
      'header',
      '[role="navigation"]',
      '[role="menubar"]',
      '.nav', '.navbar', '.navigation', '.menu',
      '.gnb', '.lnb', '.snb',  // 한국식 네이밍
      '#nav', '#menu', '#gnb', '#lnb',
      '.header-menu', '.main-menu', '.top-menu',
      '.site-nav', '.site-menu',
    ];
    
    // 푸터 컨테이너 셀렉터
    this.footerContainerSelectors = [
      'footer',
      '[role="contentinfo"]',
      '.footer', '#footer',
      '.site-footer', '.page-footer',
    ];
    
    // 로그인 보호 표시 키워드
    this.loginProtectedKeywords = [
      '로그인', 'login', '로그인이 필요', '로그인 후',
      '회원만', '회원 전용', '회원에게만',
      '비회원', '비공개', '열람 불가',
      '권한이 필요', '접근 권한',
      '본인 인증', '인증이 필요',
    ];
    
    // 메뉴명으로 자주 사용되는 패턴 (확장)
    this.commonMenuPatterns = [
      // 일반 메뉴
      /^(홈|home|메인|main)$/i,
      /^(병원|의원|클리닉)\s*(안내|소개|정보)?$/i,
      /^(의료진|원장|전문의|의사)\s*(소개|안내)?$/i,
      /^(진료|시술|수술|치료)\s*(안내|과목|분야|정보)?$/i,
      /^(오시는|찾아오시는)\s*(길|방법)?$/i,
      /^(예약|상담|문의)\s*(안내|하기)?$/i,
      /^(공지|이벤트|소식|뉴스)\s*(사항)?$/i,
      /^(갤러리|포토|사진|영상)$/i,
      /^(비용|가격|요금)\s*(안내)?$/i,
      /^(커뮤니티|게시판|자료실)$/i,
      
      // 인증/회원
      /^(로그인|회원가입|마이페이지|내정보)$/i,
      /^(login|sign\s*in|sign\s*up|my\s*page)$/i,
      
      // 시술 카테고리 메뉴명 (단독 단어)
      /^(피부|성형|치과|안과|내과|외과)$/i,
      /^(보톡스|필러|리프팅|레이저)$/i,
      /^(임플란트|교정|미백|스케일링)$/i,
      /^(시술후기|치료후기|전후사진)$/i,  // 메뉴명으로 사용되는 경우
      
      // 브랜드/서비스명 패턴 (짧은 단어)
      /^(no\.?\s*1|넘버원|올인원|all\s*in\s*one)$/i,
      /^(프리미엄|vip|스페셜|special)$/i,
      
      // CTA 버튼
      /^(바로가기|자세히|더보기|view|more)$/i,
    ];
    
    // HTML 요소별 광고 가능성 가중치
    this.elementWeights = {
      // 광고 가능성 낮음 (메뉴/네비게이션)
      nav: -0.8,
      header: -0.5,
      footer: -0.6,
      menu: -0.8,
      
      // 광고 가능성 높음 (콘텐츠 영역)
      main: 0.3,
      article: 0.4,
      section: 0.2,
      
      // 중립
      div: 0,
      span: 0,
      p: 0.1,
    };
  }

  /**
   * HTML 분석 - 모든 텍스트의 컨텍스트 정보 추출
   * @param {string} html - 원본 HTML
   * @returns {Object} 컨텍스트 분석 결과
   */
  analyzeHtml(html) {
    const $ = cheerio.load(html);
    
    const result = {
      // 메뉴/네비게이션 텍스트들
      menuTexts: new Set(),
      
      // 로그인 보호 영역의 텍스트들
      loginProtectedTexts: new Set(),
      
      // 푸터 텍스트들
      footerTexts: new Set(),
      
      // 각 텍스트의 컨텍스트 맵 (텍스트 -> 컨텍스트 정보)
      textContextMap: new Map(),
      
      // 페이지에 로그인 보호 콘텐츠가 있는지
      hasLoginProtection: false,
      
      // 분석 통계
      stats: {
        totalTextNodes: 0,
        menuTextsCount: 0,
        footerTextsCount: 0,
        protectedTextsCount: 0,
      },
    };

    // 1. 메뉴/네비게이션 텍스트 추출
    this.extractMenuTexts($, result);
    
    // 2. 푸터 텍스트 추출
    this.extractFooterTexts($, result);
    
    // 3. 로그인 보호 콘텐츠 탐지
    this.detectLoginProtectedContent($, result);
    
    // 4. 모든 텍스트 노드의 컨텍스트 분석
    this.analyzeAllTextContexts($, result);
    
    // 통계 업데이트
    result.stats.menuTextsCount = result.menuTexts.size;
    result.stats.footerTextsCount = result.footerTexts.size;
    result.stats.protectedTextsCount = result.loginProtectedTexts.size;

    if (this.debug) {
      console.log('[HtmlContextAnalyzer] 분석 완료:', result.stats);
    }

    return result;
  }

  /**
   * 메뉴/네비게이션 텍스트 추출
   */
  extractMenuTexts($, result) {
    // 메뉴 컨테이너에서 텍스트 추출
    for (const selector of this.menuContainerSelectors) {
      $(selector).each((_, container) => {
        // 메뉴 컨테이너 내의 모든 링크와 텍스트
        $(container).find('a, button, [role="menuitem"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length <= 30) {  // 메뉴명은 보통 짧음
            result.menuTexts.add(text);
            result.textContextMap.set(text, {
              type: 'menu',
              element: el.tagName?.toLowerCase(),
              isNavigational: true,
              adProbability: 0.05,  // 매우 낮은 광고 가능성
            });
          }
        });
        
        // li > a 구조의 메뉴
        $(container).find('li').each((_, li) => {
          const linkText = $(li).find('a').first().text().trim();
          if (linkText && linkText.length <= 30) {
            result.menuTexts.add(linkText);
          }
        });
      });
    }

    // 명시적 메뉴 클래스를 가진 ul/li 구조
    $('ul.menu, ul.nav, ol.menu, ol.nav').find('li > a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length <= 30) {
        result.menuTexts.add(text);
      }
    });

    // 패턴 기반 메뉴명 탐지 (전체 페이지)
    $('a, button').each((_, el) => {
      const text = $(el).text().trim();
      if (this.isLikelyMenuText(text)) {
        result.menuTexts.add(text);
        if (!result.textContextMap.has(text)) {
          result.textContextMap.set(text, {
            type: 'menu_pattern',
            element: el.tagName?.toLowerCase(),
            isNavigational: true,
            adProbability: 0.1,
          });
        }
      }
    });
  }

  /**
   * 푸터 텍스트 추출
   */
  extractFooterTexts($, result) {
    for (const selector of this.footerContainerSelectors) {
      $(selector).each((_, footer) => {
        const footerText = $(footer).text();
        
        // 푸터의 개별 요소들
        $(footer).find('*').each((_, el) => {
          const text = $(el).clone().children().remove().end().text().trim();
          if (text && text.length > 0 && text.length <= 100) {
            result.footerTexts.add(text);
            result.textContextMap.set(text, {
              type: 'footer',
              element: el.tagName?.toLowerCase(),
              isNavigational: false,
              adProbability: 0.05,  // 푸터는 광고 가능성 낮음
            });
          }
        });
      });
    }
  }

  /**
   * 로그인 보호 콘텐츠 탐지
   */
  detectLoginProtectedContent($, result) {
    const bodyText = $('body').text().toLowerCase();
    
    // 로그인 보호 키워드 확인
    for (const keyword of this.loginProtectedKeywords) {
      if (bodyText.includes(keyword.toLowerCase())) {
        result.hasLoginProtection = true;
        break;
      }
    }

    // 로그인 폼이나 보호 메시지 찾기
    const loginSelectors = [
      '.login-required',
      '.members-only',
      '.login-notice',
      '[class*="login"]',
      '[class*="member"]',
    ];

    for (const selector of loginSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          result.loginProtectedTexts.add(text);
          result.textContextMap.set(text, {
            type: 'login_protected',
            element: el.tagName?.toLowerCase(),
            isNavigational: false,
            adProbability: 0,  // 보호된 콘텐츠는 광고 아님
          });
        }
      });
    }

    // "로그인이 필요합니다", "회원만 열람 가능" 등의 메시지 근처 콘텐츠
    $('*').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      for (const keyword of this.loginProtectedKeywords) {
        if (text.includes(keyword) && text.length < 200) {
          // 이 요소와 인접 요소들의 텍스트를 보호된 것으로 표시
          const siblingTexts = $(el).siblings().map((_, sib) => $(sib).text().trim()).get();
          siblingTexts.forEach(t => {
            if (t.length < 200) {
              result.loginProtectedTexts.add(t);
            }
          });
          break;
        }
      }
    });
  }

  /**
   * 모든 텍스트 노드의 컨텍스트 분석
   */
  analyzeAllTextContexts($, result) {
    // 주요 콘텐츠 영역의 텍스트 분석
    $('body *').each((_, el) => {
      const $el = $(el);
      
      // 직접 텍스트만 (자식 요소 텍스트 제외)
      const directText = $el.clone().children().remove().end().text().trim();
      if (!directText || directText.length === 0) return;
      
      result.stats.totalTextNodes++;
      
      // 이미 분석된 텍스트는 스킵
      if (result.textContextMap.has(directText)) return;
      
      // 컨텍스트 정보 수집
      const context = this.getElementContext($, $el, directText, result);
      result.textContextMap.set(directText, context);
    });
  }

  /**
   * 요소의 컨텍스트 정보 수집
   */
  getElementContext($, $el, text, result) {
    const tagName = $el[0].tagName?.toLowerCase() || 'unknown';
    const className = $el.attr('class') || '';
    const id = $el.attr('id') || '';
    
    // 부모 요소들 분석
    const parents = $el.parents().map((_, p) => p.tagName?.toLowerCase()).get();
    
    // 메뉴/네비게이션 내부인지 확인
    const isInMenu = parents.some(p => 
      ['nav', 'header'].includes(p) ||
      this.menuContainerSelectors.some(sel => $(sel).has($el).length > 0)
    );
    
    // 푸터 내부인지 확인
    const isInFooter = parents.includes('footer') ||
      this.footerContainerSelectors.some(sel => $(sel).has($el).length > 0);
    
    // 광고 가능성 계산
    let adProbability = 0.5;  // 기본값
    
    // 메뉴/네비게이션 내부면 광고 가능성 낮음
    if (isInMenu) {
      adProbability = 0.1;
    }
    
    // 푸터 내부면 광고 가능성 낮음
    if (isInFooter) {
      adProbability = 0.1;
    }
    
    // 메뉴 텍스트 세트에 있으면 광고 가능성 매우 낮음
    if (result.menuTexts.has(text)) {
      adProbability = 0.05;
    }
    
    // 로그인 보호 텍스트면 광고 아님
    if (result.loginProtectedTexts.has(text)) {
      adProbability = 0;
    }
    
    // 메뉴명 패턴에 해당하면 광고 가능성 낮음
    if (this.isLikelyMenuText(text)) {
      adProbability = Math.min(adProbability, 0.15);
    }
    
    // 링크/버튼 내부의 짧은 텍스트는 CTA일 가능성 (메뉴명)
    if (['a', 'button'].includes(tagName) && text.length <= 20) {
      adProbability = Math.min(adProbability, 0.2);
    }
    
    // 콘텐츠 영역 (main, article) 내부면 광고 가능성 높음
    if (parents.includes('main') || parents.includes('article')) {
      adProbability = Math.max(adProbability, 0.6);
      
      // 단, 메뉴 패턴이면 여전히 낮음
      if (this.isLikelyMenuText(text)) {
        adProbability = 0.2;
      }
    }

    return {
      type: this.getContextType(isInMenu, isInFooter, tagName),
      element: tagName,
      isInMenu,
      isInFooter,
      isNavigational: isInMenu || tagName === 'a' || tagName === 'button',
      parents: parents.slice(0, 5),  // 가까운 부모 5개만
      className,
      adProbability,
    };
  }

  /**
   * 컨텍스트 타입 결정
   */
  getContextType(isInMenu, isInFooter, tagName) {
    if (isInMenu) return 'menu';
    if (isInFooter) return 'footer';
    if (tagName === 'a') return 'link';
    if (tagName === 'button') return 'button';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'heading';
    if (tagName === 'p') return 'paragraph';
    return 'content';
  }

  /**
   * 텍스트가 메뉴명으로 보이는지 판별
   */
  isLikelyMenuText(text) {
    if (!text || text.length > 30) return false;
    
    const trimmed = text.trim();
    
    // 패턴 매칭
    for (const pattern of this.commonMenuPatterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }
    
    // 짧은 단어 (1-4글자) + 특정 키워드 조합
    if (trimmed.length <= 4) {
      const menuKeywords = ['후기', '안내', '소개', '정보', '상담', '예약'];
      if (menuKeywords.some(kw => trimmed.includes(kw))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 특정 텍스트가 광고성 컨텍스트인지 판별
   * @param {string} text - 확인할 텍스트
   * @param {Object} htmlContext - analyzeHtml() 결과
   * @returns {Object} 판별 결과
   */
  isAdContext(text, htmlContext) {
    const trimmed = text.trim();
    
    // 1. 메뉴 텍스트 세트에 있으면 광고 아님
    if (htmlContext.menuTexts.has(trimmed)) {
      return {
        isAd: false,
        reason: 'menu_text',
        confidence: 0.95,
        adProbability: 0.05,
      };
    }
    
    // 2. 로그인 보호 텍스트면 광고 아님
    if (htmlContext.loginProtectedTexts.has(trimmed)) {
      return {
        isAd: false,
        reason: 'login_protected',
        confidence: 0.99,
        adProbability: 0,
      };
    }
    
    // 3. 푸터 텍스트면 광고 아님
    if (htmlContext.footerTexts.has(trimmed)) {
      return {
        isAd: false,
        reason: 'footer_text',
        confidence: 0.9,
        adProbability: 0.1,
      };
    }
    
    // 4. 텍스트 컨텍스트 맵 확인
    const context = htmlContext.textContextMap.get(trimmed);
    if (context) {
      if (context.adProbability < 0.3) {
        return {
          isAd: false,
          reason: context.type,
          confidence: 1 - context.adProbability,
          adProbability: context.adProbability,
          context,
        };
      }
    }
    
    // 5. 메뉴 패턴 체크
    if (this.isLikelyMenuText(trimmed)) {
      return {
        isAd: false,
        reason: 'menu_pattern',
        confidence: 0.85,
        adProbability: 0.15,
      };
    }
    
    // 6. 기본값: 컨텍스트에서 판단 불가, 광고 가능성 있음
    return {
      isAd: true,  // 기본적으로 광고로 가정 (보수적)
      reason: 'content',
      confidence: context ? context.adProbability : 0.5,
      adProbability: context ? context.adProbability : 0.5,
      context,
    };
  }

  /**
   * 텍스트 부분 문자열에 대한 컨텍스트 확인
   * (정확히 일치하지 않아도 포함 여부로 판단)
   */
  isTextInNonAdContext(text, htmlContext) {
    const trimmed = text.trim().toLowerCase();
    
    // 메뉴 텍스트에 포함되어 있는지
    for (const menuText of htmlContext.menuTexts) {
      if (menuText.toLowerCase().includes(trimmed) || 
          trimmed.includes(menuText.toLowerCase())) {
        return {
          isNonAd: true,
          reason: 'partial_menu_match',
          matchedMenuText: menuText,
        };
      }
    }
    
    // 푸터 텍스트에 포함되어 있는지
    for (const footerText of htmlContext.footerTexts) {
      if (footerText.toLowerCase().includes(trimmed)) {
        return {
          isNonAd: true,
          reason: 'partial_footer_match',
          matchedFooterText: footerText,
        };
      }
    }
    
    return {
      isNonAd: false,
    };
  }
}

module.exports = HtmlContextAnalyzer;
