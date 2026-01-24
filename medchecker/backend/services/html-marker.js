/**
 * HTML Marker Service
 * 
 * 원본 HTML에서 위반 텍스트를 찾아 하이라이트 마킹을 추가합니다.
 * 위험도에 따라 다른 색상으로 표시합니다.
 */

const cheerio = require('cheerio');

class HtmlMarker {
  constructor(options = {}) {
    this.debug = options.debug || false;
    
    // 위험도별 스타일 설정
    this.severityStyles = {
      critical: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',  // 빨간색
        borderColor: '#ef4444',
        label: '심각',
        priority: 3,
      },
      warning: {
        backgroundColor: 'rgba(245, 158, 11, 0.3)',  // 주황색
        borderColor: '#f59e0b',
        label: '주의',
        priority: 2,
      },
      info: {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',  // 파란색
        borderColor: '#3b82f6',
        label: '참고',
        priority: 1,
      },
    };
  }

  /**
   * HTML에 위반 영역 마킹 추가
   * @param {string} html - 원본 HTML
   * @param {Array} violations - 위반 목록
   * @param {string} baseUrl - 기본 URL (상대 경로 변환용)
   * @returns {string} 마킹된 HTML
   */
  markViolations(html, violations, baseUrl) {
    const $ = cheerio.load(html, {
      decodeEntities: false,
    });

    // 1. <base> 태그 추가 (상대 경로 리소스 로드용)
    if (baseUrl) {
      const baseTag = `<base href="${baseUrl}" target="_blank">`;
      if ($('head base').length === 0) {
        $('head').prepend(baseTag);
      }
    }

    // 2. 마킹용 스타일 주입
    const markerStyles = this.generateMarkerStyles();
    $('head').append(`<style id="medchecker-marker-styles">${markerStyles}</style>`);

    // 3. 각 위반 텍스트 마킹
    const markedTexts = new Set(); // 중복 마킹 방지
    
    // 우선순위 순으로 정렬 (critical > warning > info)
    const sortedViolations = [...violations].sort((a, b) => {
      const priorityA = this.severityStyles[a.severity]?.priority || 0;
      const priorityB = this.severityStyles[b.severity]?.priority || 0;
      return priorityB - priorityA;
    });

    for (const violation of sortedViolations) {
      const textToMark = violation.matchedText || violation.evidence?.matchedText;
      if (!textToMark || markedTexts.has(textToMark.toLowerCase())) continue;
      
      const severity = violation.severity || 'warning';
      const ruleId = violation.ruleId || '';
      const ruleName = violation.ruleName || '';
      
      this.markTextInHtml($, textToMark, severity, ruleId, ruleName);
      markedTexts.add(textToMark.toLowerCase());
    }

    // 4. 마킹 네비게이션 패널 추가
    const navPanel = this.generateNavigationPanel(sortedViolations);
    $('body').append(navPanel);

    // 5. 마킹 스크립트 추가
    const markerScript = this.generateMarkerScript();
    $('body').append(`<script id="medchecker-marker-script">${markerScript}</script>`);

    return $.html();
  }

  /**
   * HTML 내 텍스트 마킹
   */
  markTextInHtml($, text, severity, ruleId, ruleName) {
    if (!text || text.length < 2) return;

    const style = this.severityStyles[severity] || this.severityStyles.warning;
    const markerId = `mc-mark-${ruleId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // body 내의 텍스트 노드에서 검색
    const textNodes = [];
    
    const findTextNodes = (element) => {
      $(element).contents().each((i, node) => {
        if (node.type === 'text') {
          textNodes.push(node);
        } else if (node.type === 'tag' && !['script', 'style', 'noscript', 'iframe'].includes(node.name)) {
          findTextNodes(node);
        }
      });
    };
    
    findTextNodes($('body'));

    // 텍스트 노드에서 매칭 찾기 및 마킹
    let markCount = 0;
    const maxMarks = 5; // 같은 텍스트 최대 5번까지만 마킹

    for (const textNode of textNodes) {
      if (markCount >= maxMarks) break;
      
      const content = textNode.data;
      if (!content) continue;

      const lowerContent = content.toLowerCase();
      const lowerText = text.toLowerCase();
      const index = lowerContent.indexOf(lowerText);

      if (index !== -1) {
        // 텍스트 노드를 분할하여 마킹
        const before = content.substring(0, index);
        const matched = content.substring(index, index + text.length);
        const after = content.substring(index + text.length);

        const markHtml = `${this.escapeHtml(before)}<mark class="mc-violation-mark mc-severity-${severity}" id="${markerId}-${markCount}" data-rule-id="${ruleId}" data-rule-name="${this.escapeHtml(ruleName)}" title="${this.escapeHtml(ruleName)} (${style.label})">${this.escapeHtml(matched)}</mark>${this.escapeHtml(after)}`;

        $(textNode).replaceWith(markHtml);
        markCount++;
      }
    }

    if (this.debug && markCount > 0) {
      console.log(`[HtmlMarker] "${text}" - ${markCount}개 마킹 완료 (${severity})`);
    }
  }

  /**
   * 마커 스타일 생성
   */
  generateMarkerStyles() {
    return `
      /* MedChecker 위반 마킹 스타일 */
      .mc-violation-mark {
        position: relative;
        padding: 2px 4px;
        border-radius: 3px;
        border-bottom: 3px solid;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: inherit;
      }
      
      .mc-violation-mark:hover {
        filter: brightness(0.9);
      }
      
      .mc-severity-critical {
        background-color: ${this.severityStyles.critical.backgroundColor};
        border-bottom-color: ${this.severityStyles.critical.borderColor};
      }
      
      .mc-severity-warning {
        background-color: ${this.severityStyles.warning.backgroundColor};
        border-bottom-color: ${this.severityStyles.warning.borderColor};
      }
      
      .mc-severity-info {
        background-color: ${this.severityStyles.info.backgroundColor};
        border-bottom-color: ${this.severityStyles.info.borderColor};
      }
      
      /* 포커스된 마킹 - 더 강한 시각적 피드백 */
      .mc-violation-mark.mc-focused {
        animation: mc-pulse 0.8s ease-in-out 3;
        outline: 4px solid #00d4ff !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 30px rgba(0, 212, 255, 0.8), 0 0 60px rgba(0, 212, 255, 0.4) !important;
        z-index: 999998 !important;
        position: relative !important;
      }
      
      @keyframes mc-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      
      /* 네비게이션 패널 - 드래그 가능, 좌측 하단 기본 위치 */
      #mc-nav-panel {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 340px;
        max-height: 60vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
        resize: both;
      }
      
      #mc-nav-panel.mc-minimized {
        width: 56px;
        height: 56px;
        border-radius: 28px;
        cursor: pointer;
        max-height: 56px;
      }
      
      #mc-nav-panel.mc-minimized .mc-nav-content,
      #mc-nav-panel.mc-minimized .mc-nav-summary {
        display: none;
      }
      
      #mc-nav-panel.mc-minimized .mc-nav-header {
        padding: 14px;
        justify-content: center;
        cursor: pointer;
      }
      
      #mc-nav-panel.mc-minimized .mc-nav-title,
      #mc-nav-panel.mc-minimized .mc-nav-toggle {
        display: none;
      }
      
      #mc-nav-panel.mc-minimized .mc-nav-icon {
        display: block;
        font-size: 24px;
      }
      
      .mc-nav-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.4);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        cursor: move;
        user-select: none;
      }
      
      .mc-nav-title {
        color: #00d4ff;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .mc-nav-icon {
        display: none;
        color: #00d4ff;
      }
      
      .mc-nav-controls {
        display: flex;
        gap: 8px;
      }
      
      .mc-nav-toggle, .mc-nav-position-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .mc-nav-toggle:hover, .mc-nav-position-btn:hover {
        background: rgba(255,255,255,0.2);
        color: #fff;
      }
      
      .mc-nav-content {
        max-height: calc(60vh - 100px);
        overflow-y: auto;
        padding: 8px;
      }
      
      .mc-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        margin-bottom: 6px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-left: 3px solid transparent;
      }
      
      .mc-nav-item:hover {
        background: rgba(0, 212, 255, 0.15);
        transform: translateX(3px);
      }
      
      .mc-nav-item.mc-active {
        background: rgba(0, 212, 255, 0.2);
        border-left-color: #00d4ff !important;
      }
      
      .mc-nav-item.mc-severity-critical {
        border-left-color: ${this.severityStyles.critical.borderColor};
      }
      
      .mc-nav-item.mc-severity-warning {
        border-left-color: ${this.severityStyles.warning.borderColor};
      }
      
      .mc-nav-item.mc-severity-info {
        border-left-color: ${this.severityStyles.info.borderColor};
      }
      
      .mc-nav-item-index {
        background: rgba(255,255,255,0.1);
        color: #94a3b8;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        min-width: 20px;
        text-align: center;
      }
      
      .mc-nav-item-text {
        flex: 1;
        color: #e2e8f0;
        font-size: 12px;
        line-height: 1.4;
        overflow: hidden;
      }
      
      .mc-nav-item-matched {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .mc-nav-item-rule {
        color: #64748b;
        font-size: 10px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .mc-nav-badge {
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
      }
      
      .mc-nav-badge.mc-critical {
        background: ${this.severityStyles.critical.borderColor};
      }
      
      .mc-nav-badge.mc-warning {
        background: ${this.severityStyles.warning.borderColor};
      }
      
      .mc-nav-badge.mc-info {
        background: ${this.severityStyles.info.borderColor};
      }
      
      .mc-nav-summary {
        display: flex;
        gap: 12px;
        padding: 10px 14px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        flex-wrap: wrap;
      }
      
      .mc-summary-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #94a3b8;
      }
      
      .mc-summary-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      
      .mc-summary-dot.mc-critical { background: ${this.severityStyles.critical.borderColor}; }
      .mc-summary-dot.mc-warning { background: ${this.severityStyles.warning.borderColor}; }
      .mc-summary-dot.mc-info { background: ${this.severityStyles.info.borderColor}; }

      /* 스크롤바 스타일 */
      .mc-nav-content::-webkit-scrollbar {
        width: 5px;
      }
      
      .mc-nav-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
      }
      
      .mc-nav-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      
      .mc-nav-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      /* 스크롤 타겟 마커 - 고정 헤더 오프셋용 */
      .mc-scroll-anchor {
        position: relative;
        top: -150px;
        visibility: hidden;
        height: 0;
        pointer-events: none;
      }
      
      /* 검색 실패 시 표시 */
      .mc-not-found-toast {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(239, 68, 68, 0.95);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        animation: mc-toast-in 0.3s ease;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      }
      
      @keyframes mc-toast-in {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
    `;
  }

  /**
   * 네비게이션 패널 HTML 생성
   */
  generateNavigationPanel(violations) {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    const infoCount = violations.filter(v => v.severity === 'info').length;
    const totalCount = violations.length;

    const items = violations.map((v, i) => {
      const text = v.matchedText || v.evidence?.matchedText || '';
      const severity = v.severity || 'warning';
      const ruleId = v.ruleId || '';
      const ruleName = v.ruleName || '';
      const markerId = `mc-mark-${ruleId.replace(/[^a-zA-Z0-9]/g, '-')}-0`;
      const style = this.severityStyles[severity] || this.severityStyles.warning;
      
      // 검색용 텍스트 (특수문자 이스케이프)
      const searchText = text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ');

      return `
        <div class="mc-nav-item mc-severity-${severity}" data-index="${i}" data-target="${markerId}" data-search-text="${this.escapeHtml(text)}" onclick="window.mcNavigateTo(${i}, '${searchText}', '${markerId}')">
          <span class="mc-nav-item-index">${i + 1}</span>
          <div class="mc-nav-item-text">
            <div class="mc-nav-item-matched">"${this.escapeHtml(text.substring(0, 25))}${text.length > 25 ? '...' : ''}"</div>
            <div class="mc-nav-item-rule">${this.escapeHtml(ruleName)}</div>
          </div>
          <span class="mc-nav-badge mc-${severity}">${style.label}</span>
        </div>
      `;
    }).join('');

    return `
      <div id="mc-nav-panel">
        <div class="mc-nav-header" id="mc-nav-drag-handle">
          <span class="mc-nav-title">
            <span>🔍</span>
            <span>MEDCHECKER</span>
            <span style="color:#94a3b8;font-weight:400">(${totalCount}건)</span>
          </span>
          <span class="mc-nav-icon">🔍</span>
          <div class="mc-nav-controls">
            <button class="mc-nav-position-btn" onclick="window.mcMovePanel()" title="위치 변경">⇄</button>
            <button class="mc-nav-toggle" onclick="window.mcTogglePanel()" title="최소화">−</button>
          </div>
        </div>
        <div class="mc-nav-content">
          ${items || '<div style="color: #64748b; padding: 20px; text-align: center;">위반 사항 없음</div>'}
        </div>
        <div class="mc-nav-summary">
          ${criticalCount > 0 ? `<div class="mc-summary-item"><span class="mc-summary-dot mc-critical"></span>${criticalCount} 심각</div>` : ''}
          ${warningCount > 0 ? `<div class="mc-summary-item"><span class="mc-summary-dot mc-warning"></span>${warningCount} 주의</div>` : ''}
          ${infoCount > 0 ? `<div class="mc-summary-item"><span class="mc-summary-dot mc-info"></span>${infoCount} 참고</div>` : ''}
          ${totalCount === 0 ? '<div class="mc-summary-item" style="color:#22c55e">✓ 위반 없음</div>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * 마커 스크립트 생성
   */
  generateMarkerScript() {
    return `
      // MedChecker Marker Script v2
      (function() {
        'use strict';
        
        let currentIndex = -1;
        let panelPosition = 'bottom-left'; // bottom-left, bottom-right, top-left, top-right
        
        // 고정 헤더 높이 감지
        function getFixedHeaderHeight() {
          let maxHeight = 0;
          const candidates = document.querySelectorAll('header, nav, [class*="header"], [class*="nav"], [class*="gnb"], [class*="top"]');
          
          candidates.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'sticky') {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 10 && rect.height > maxHeight) {
                maxHeight = rect.height;
              }
            }
          });
          
          return maxHeight + 20; // 여유 공간 추가
        }
        
        // 향상된 스크롤 함수
        function smoothScrollTo(element, headerOffset) {
          const rect = element.getBoundingClientRect();
          const absoluteTop = window.pageYOffset + rect.top - headerOffset;
          
          // 방법 1: scrollTo 사용
          window.scrollTo({
            top: absoluteTop,
            behavior: 'smooth'
          });
          
          // 방법 2: 실패 시 직접 스크롤 (백업)
          setTimeout(() => {
            const newRect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            // 요소가 화면 중앙에 오지 않았으면 재시도
            if (newRect.top < headerOffset || newRect.top > viewportHeight * 0.6) {
              const retryTop = window.pageYOffset + newRect.top - (viewportHeight / 3);
              window.scrollTo({ top: retryTop, behavior: 'smooth' });
            }
          }, 500);
        }
        
        // 모든 마킹 요소 캐시
        function getAllMarks() {
          return Array.from(document.querySelectorAll('.mc-violation-mark'));
        }
        
        // 텍스트로 마킹 찾기 (유사 매칭 포함)
        function findMarkByText(searchText) {
          const allMarks = getAllMarks();
          const normalizedSearch = searchText.toLowerCase().trim();
          
          // 1. 정확한 텍스트 일치
          for (const m of allMarks) {
            const markText = m.textContent?.toLowerCase().trim();
            if (markText === normalizedSearch) {
              return m;
            }
          }
          
          // 2. 포함 여부 확인
          for (const m of allMarks) {
            const markText = m.textContent?.toLowerCase().trim();
            if (markText && (markText.includes(normalizedSearch) || normalizedSearch.includes(markText))) {
              return m;
            }
          }
          
          // 3. 부분 매칭 (첫 10글자)
          const shortSearch = normalizedSearch.substring(0, 10);
          for (const m of allMarks) {
            const markText = m.textContent?.toLowerCase().trim();
            if (markText && markText.substring(0, 10) === shortSearch) {
              return m;
            }
          }
          
          return null;
        }
        
        // ID로 마킹 찾기
        function findMarkById(markerId) {
          // 정확한 ID
          let mark = document.getElementById(markerId);
          if (mark) return mark;
          
          // 부분 일치
          const baseId = markerId.replace(/-\\d+$/, '');
          const allMarks = getAllMarks();
          
          for (const m of allMarks) {
            if (m.id && m.id.startsWith(baseId)) {
              return m;
            }
          }
          
          // data-rule-id로 찾기
          const ruleId = markerId.replace('mc-mark-', '').replace(/-\\d+$/, '');
          for (const m of allMarks) {
            const dataRuleId = m.getAttribute('data-rule-id');
            if (dataRuleId && dataRuleId.includes(ruleId.replace(/-/g, ''))) {
              return m;
            }
          }
          
          return null;
        }
        
        // 네비게이션 항목 활성화
        function setActiveNavItem(index) {
          document.querySelectorAll('.mc-nav-item').forEach((item, i) => {
            item.classList.toggle('mc-active', i === index);
          });
        }
        
        // 찾기 실패 토스트
        function showNotFoundToast(text) {
          const existing = document.querySelector('.mc-not-found-toast');
          if (existing) existing.remove();
          
          const toast = document.createElement('div');
          toast.className = 'mc-not-found-toast';
          toast.innerHTML = '⚠️ "' + text.substring(0, 20) + '..." 를 찾을 수 없습니다.<br><small style="opacity:0.8">페이지 구조에 따라 위치를 찾지 못할 수 있습니다.</small>';
          document.body.appendChild(toast);
          
          setTimeout(() => toast.remove(), 3000);
        }
        
        // 마킹 하이라이트 및 스크롤
        window.mcHighlightMark = function(mark) {
          if (!mark) return false;
          
          // 기존 포커스 제거
          document.querySelectorAll('.mc-focused').forEach(el => {
            el.classList.remove('mc-focused');
          });
          
          // 헤더 높이 감지
          const headerOffset = getFixedHeaderHeight();
          
          // 스크롤
          smoothScrollTo(mark, headerOffset);
          
          // 포커스 클래스 추가 (애니메이션 트리거)
          setTimeout(() => {
            mark.classList.add('mc-focused');
          }, 300);
          
          // 4초 후 효과 제거
          setTimeout(() => {
            mark.classList.remove('mc-focused');
          }, 4000);
          
          return true;
        };
        
        // 인덱스로 네비게이션
        window.mcNavigateTo = function(index, searchText, fallbackId) {
          console.log('[MedChecker] 이동 시도 #' + index + ':', searchText?.substring(0, 20));
          
          currentIndex = index;
          setActiveNavItem(index);
          
          // 텍스트로 찾기
          let mark = findMarkByText(searchText);
          
          // 못 찾으면 ID로 찾기
          if (!mark) {
            mark = findMarkById(fallbackId);
          }
          
          // 못 찾으면 인덱스로 찾기
          if (!mark) {
            const allMarks = getAllMarks();
            if (allMarks[index]) {
              mark = allMarks[index];
            }
          }
          
          if (mark) {
            console.log('[MedChecker] 마킹 발견, 스크롤 실행');
            window.mcHighlightMark(mark);
          } else {
            console.log('[MedChecker] 마킹을 찾을 수 없음');
            showNotFoundToast(searchText || fallbackId);
          }
        };
        
        // 텍스트로 스크롤 (레거시 호환)
        window.mcScrollToMarkByText = function(searchText, fallbackId) {
          window.mcNavigateTo(-1, searchText, fallbackId);
        };
        
        // ID로 스크롤 (레거시 호환)
        window.mcScrollToMark = function(markerId) {
          const mark = findMarkById(markerId);
          if (mark) {
            window.mcHighlightMark(mark);
          }
        };
        
        // 패널 토글
        window.mcTogglePanel = function() {
          const panel = document.getElementById('mc-nav-panel');
          const toggle = panel.querySelector('.mc-nav-toggle');
          const isMinimized = panel.classList.toggle('mc-minimized');
          toggle.textContent = isMinimized ? '+' : '−';
        };
        
        // 패널 위치 변경
        window.mcMovePanel = function() {
          const panel = document.getElementById('mc-nav-panel');
          const positions = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
          const currentIdx = positions.indexOf(panelPosition);
          panelPosition = positions[(currentIdx + 1) % positions.length];
          
          // 위치 스타일 적용
          panel.style.top = panelPosition.includes('top') ? '20px' : 'auto';
          panel.style.bottom = panelPosition.includes('bottom') ? '20px' : 'auto';
          panel.style.left = panelPosition.includes('left') ? '20px' : 'auto';
          panel.style.right = panelPosition.includes('right') ? '20px' : 'auto';
        };
        
        // 드래그 기능
        function initDrag() {
          const panel = document.getElementById('mc-nav-panel');
          const handle = document.getElementById('mc-nav-drag-handle');
          
          let isDragging = false;
          let startX, startY, startLeft, startTop;
          
          handle.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            panel.style.transition = 'none';
            document.body.style.userSelect = 'none';
          });
          
          document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, startLeft + dx));
            const newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, startTop + dy));
            
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
          });
          
          document.addEventListener('mouseup', function() {
            if (isDragging) {
              isDragging = false;
              panel.style.transition = '';
              document.body.style.userSelect = '';
            }
          });
        }
        
        // 마킹 클릭 시 정보 표시
        function initMarkClickHandlers() {
          getAllMarks().forEach((mark, index) => {
            mark.addEventListener('click', function(e) {
              e.stopPropagation();
              const ruleName = this.getAttribute('data-rule-name') || '알 수 없음';
              const ruleId = this.getAttribute('data-rule-id') || '';
              
              // 간단한 툴팁 표시
              const existingTooltip = document.querySelector('.mc-mark-tooltip');
              if (existingTooltip) existingTooltip.remove();
              
              const tooltip = document.createElement('div');
              tooltip.className = 'mc-mark-tooltip';
              tooltip.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#fff;padding:20px;border-radius:12px;z-index:2147483647;font-family:sans-serif;box-shadow:0 10px 40px rgba(0,0,0,0.5);max-width:400px;';
              tooltip.innerHTML = '<div style="font-size:16px;font-weight:600;color:#00d4ff;margin-bottom:12px">위반 항목</div>' +
                '<div style="margin-bottom:8px"><strong>규칙:</strong> ' + ruleName + '</div>' +
                '<div style="color:#94a3b8;font-size:12px">ID: ' + ruleId + '</div>' +
                '<button onclick="this.parentElement.remove()" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px">×</button>';
              document.body.appendChild(tooltip);
              
              setTimeout(() => tooltip.remove(), 5000);
            });
          });
        }
        
        // 초기화
        function init() {
          const markCount = getAllMarks().length;
          console.log('[MedChecker] 위반 마킹 로드 완료 - ' + markCount + '개');
          
          initDrag();
          initMarkClickHandlers();
          
          // 마킹 목록 출력
          getAllMarks().forEach((m, i) => {
            console.log('[MedChecker] 마킹 #' + i + ':', m.id, '"' + m.textContent?.substring(0, 25) + '"');
          });
        }
        
        // DOM 로드 후 초기화
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      })();
    `;
  }

  /**
   * HTML 이스케이프
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = HtmlMarker;
