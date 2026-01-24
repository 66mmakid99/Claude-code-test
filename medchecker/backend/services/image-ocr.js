/**
 * MEDCHECKER 이미지 OCR 서비스
 * 
 * Gemini Vision API를 사용하여 이미지에서 텍스트 추출
 * 웹페이지 내 배너, 이벤트 이미지 등에서 의료광고 위반 텍스트 탐지
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');
const http = require('http');

class ImageOCR {
  constructor(config = {}) {
    this.geminiApiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.claudeApiKey = config.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    // 모델 설정: gemini-2.0-flash, gemini-1.5-flash, claude
    this.preferredModel = config.model || 'gemini-1.5-flash';
    this.debug = config.debug || false;
    
    // OCR 통계
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalImagesProcessed: 0,
      totalTextExtracted: 0,
    };
    
    // Fallback 순서: Gemini 1.5 Flash → Claude
    this.fallbackOrder = ['gemini-1.5-flash', 'claude'];
    
    console.log(`[ImageOCR] 초기화 완료 (선호 모델: ${this.preferredModel})`);
  }

  /**
   * 이미지 URL에서 텍스트 추출
   */
  async extractTextFromUrl(imageUrl, options = {}) {
    const {
      language = 'ko',  // 우선 언어
      maxTokens = 1000,
      timeout = 30000,
    } = options;

    this.stats.totalCalls++;

    try {
      // 이미지 다운로드
      const imageData = await this.downloadImage(imageUrl, timeout);
      
      // Vision API 호출 (fallback 지원)
      const result = await this.callVisionApi(imageData, {
        language,
        maxTokens,
      });

      this.stats.successCalls++;
      this.stats.totalImagesProcessed++;
      this.stats.totalTextExtracted += result.text?.length || 0;

      return {
        success: true,
        imageUrl,
        text: result.text,
        confidence: result.confidence,
        detectedLanguage: result.detectedLanguage,
        hasKorean: /[가-힣]/.test(result.text),
        wordCount: result.text?.split(/\s+/).filter(w => w).length || 0,
      };
    } catch (error) {
      this.stats.failedCalls++;
      
      if (this.debug) {
        console.error(`[ImageOCR] 텍스트 추출 실패: ${imageUrl}`, error.message);
      }
      
      return {
        success: false,
        imageUrl,
        error: error.message,
      };
    }
  }

  /**
   * 여러 이미지에서 텍스트 추출 (배치)
   */
  async extractTextFromUrls(imageUrls, options = {}) {
    const {
      concurrency = 3,  // 동시 처리 수
      ...extractOptions
    } = options;

    const results = [];
    
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.extractTextFromUrl(url, extractOptions))
      );
      results.push(...batchResults);
      
      // Rate limiting
      if (i + concurrency < imageUrls.length) {
        await this.delay(200);
      }
    }

    return results;
  }

  /**
   * HTML에서 이미지 URL 추출 후 OCR 수행
   */
  async extractTextFromHtml(html, baseUrl, options = {}) {
    const {
      maxImages = 10,  // 최대 처리할 이미지 수
      minWidth = 200,  // 최소 이미지 너비 (추정)
      excludePatterns = [
        /logo/i,
        /icon/i,
        /favicon/i,
        /button/i,
        /arrow/i,
        /sns/i,
        /social/i,
        /\.svg$/i,
        /\.gif$/i,
        /tracking/i,
        /pixel/i,
        /ad-/i,
        /banner-ad/i,
      ],
      ...extractOptions
    } = options;

    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // 이미지 URL 수집
    const imageUrls = new Set();
    
    // img 태그
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src) {
        const fullUrl = this.resolveUrl(src, baseUrl);
        if (fullUrl && !this.shouldExcludeImage(fullUrl, excludePatterns)) {
          imageUrls.add(fullUrl);
        }
      }
    });

    // background-image 스타일
    $('[style*="background"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (match && match[1]) {
        const fullUrl = this.resolveUrl(match[1], baseUrl);
        if (fullUrl && !this.shouldExcludeImage(fullUrl, excludePatterns)) {
          imageUrls.add(fullUrl);
        }
      }
    });

    // 배너, 이벤트, 프로모션 관련 이미지 우선 선택
    const prioritizedUrls = this.prioritizeImages(Array.from(imageUrls), html, $);
    const selectedUrls = prioritizedUrls.slice(0, maxImages);

    if (this.debug) {
      console.log(`[ImageOCR] 발견된 이미지: ${imageUrls.size}개, 선택: ${selectedUrls.length}개`);
    }

    if (selectedUrls.length === 0) {
      return {
        success: true,
        totalImages: 0,
        processedImages: 0,
        extractedTexts: [],
        combinedText: '',
      };
    }

    // OCR 수행
    const results = await this.extractTextFromUrls(selectedUrls, extractOptions);
    
    // 성공한 결과만 필터링
    const successResults = results.filter(r => r.success && r.text && r.text.trim());
    
    // 모든 텍스트 결합
    const combinedText = successResults
      .map(r => r.text.trim())
      .join('\n\n');

    return {
      success: true,
      totalImages: imageUrls.size,
      processedImages: selectedUrls.length,
      successfulOcr: successResults.length,
      extractedTexts: successResults.map(r => ({
        imageUrl: r.imageUrl,
        text: r.text,
        wordCount: r.wordCount,
      })),
      combinedText,
      totalWords: combinedText.split(/\s+/).filter(w => w).length,
    };
  }

  /**
   * 이미지 우선순위 결정 (배너, 이벤트 이미지 우선)
   */
  prioritizeImages(urls, html, $) {
    const scored = urls.map(url => {
      let score = 0;
      
      // URL 패턴 기반 점수
      if (/banner/i.test(url)) score += 10;
      if (/event/i.test(url)) score += 10;
      if (/promo/i.test(url)) score += 8;
      if (/main/i.test(url)) score += 5;
      if (/slide/i.test(url)) score += 5;
      if (/hero/i.test(url)) score += 5;
      if (/visual/i.test(url)) score += 5;
      if (/popup/i.test(url)) score += 7;
      
      // 파일 확장자
      if (/\.(jpg|jpeg|png|webp)$/i.test(url)) score += 3;
      
      // HTML 컨텍스트 확인
      const imgElement = $(`img[src="${url}"], img[data-src="${url}"]`);
      if (imgElement.length > 0) {
        const alt = imgElement.attr('alt') || '';
        const className = imgElement.attr('class') || '';
        const parentClass = imgElement.parent().attr('class') || '';
        
        if (/이벤트|event|프로모션|할인|특가/i.test(alt)) score += 15;
        if (/banner|slide|hero|main|event/i.test(className)) score += 10;
        if (/banner|slide|hero|main|event/i.test(parentClass)) score += 8;
      }
      
      return { url, score };
    });

    // 점수 높은 순으로 정렬
    scored.sort((a, b) => b.score - a.score);
    
    return scored.map(s => s.url);
  }

  /**
   * 이미지 제외 여부 확인
   */
  shouldExcludeImage(url, excludePatterns) {
    return excludePatterns.some(pattern => pattern.test(url));
  }

  /**
   * 상대 URL을 절대 URL로 변환
   */
  resolveUrl(src, baseUrl) {
    try {
      if (!src || src.startsWith('data:')) return null;
      
      const base = new URL(baseUrl);
      
      if (src.startsWith('//')) {
        return `${base.protocol}${src}`;
      }
      if (src.startsWith('/')) {
        return `${base.origin}${src}`;
      }
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return src;
      }
      
      // 상대 경로
      const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/'));
      return `${base.origin}${basePath}/${src}`;
    } catch (e) {
      return null;
    }
  }

  /**
   * 이미지 다운로드
   */
  async downloadImage(imageUrl, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const protocol = imageUrl.startsWith('https') ? https : http;
      
      const options = {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/*',
        },
        rejectUnauthorized: false,
      };

      const req = protocol.get(imageUrl, options, (res) => {
        // 리다이렉트 처리
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.downloadImage(res.headers.location, timeout).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'image/jpeg';
          const mimeType = contentType.split(';')[0].trim();
          
          resolve({
            buffer,
            base64: buffer.toString('base64'),
            mimeType,
            size: buffer.length,
          });
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Vision API 호출 (fallback 지원)
   */
  async callVisionApi(imageData, options = {}) {
    const models = [this.preferredModel, ...this.fallbackOrder.filter(m => m !== this.preferredModel)];
    
    for (const model of models) {
      try {
        if (model.startsWith('gemini')) {
          return await this.callGeminiVision(imageData, options, model);
        } else if (model === 'claude') {
          return await this.callClaudeVision(imageData, options);
        }
      } catch (error) {
        if (this.debug) {
          console.warn(`[ImageOCR] ${model} 실패, 다음 모델 시도:`, error.message);
        }
        // 다음 모델 시도
        continue;
      }
    }
    
    throw new Error('모든 Vision API 모델 실패');
  }

  /**
   * Gemini Vision API 호출
   */
  async callGeminiVision(imageData, options = {}, model = 'gemini-1.5-flash') {
    const {
      language = 'ko',
      maxTokens = 1000,
    } = options;

    const prompt = `이 이미지에서 모든 텍스트를 추출해주세요.
- 배너, 광고, 프로모션 텍스트를 포함해서 모든 글자를 정확히 읽어주세요.
- 한글, 영어, 숫자 모두 포함해주세요.
- 레이아웃 순서대로 읽어주세요.
- 추출된 텍스트만 출력하고, 설명이나 해석은 하지 마세요.
- 텍스트가 없으면 "텍스트 없음"이라고만 답해주세요.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.base64,
            },
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
      },
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const reqOptions = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 60000,
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(response.error.message || 'API Error'));
              return;
            }

            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            // "텍스트 없음" 응답 처리
            if (text.includes('텍스트 없음') || text.trim() === '') {
              resolve({
                text: '',
                confidence: 1.0,
                detectedLanguage: language,
                model,
              });
              return;
            }

            resolve({
              text: text.trim(),
              confidence: 0.9,
              detectedLanguage: /[가-힣]/.test(text) ? 'ko' : 'en',
              model,
            });
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Claude Vision API 호출
   */
  async callClaudeVision(imageData, options = {}) {
    const {
      language = 'ko',
      maxTokens = 1000,
    } = options;

    const prompt = `이 이미지에서 모든 텍스트를 추출해주세요.
- 배너, 광고, 프로모션 텍스트를 포함해서 모든 글자를 정확히 읽어주세요.
- 한글, 영어, 숫자 모두 포함해주세요.
- 레이아웃 순서대로 읽어주세요.
- 추출된 텍스트만 출력하고, 설명이나 해석은 하지 마세요.
- 텍스트가 없으면 "텍스트 없음"이라고만 답해주세요.`;

    // 이미지 media type 매핑
    const mediaTypeMap = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
    };
    
    const mediaType = mediaTypeMap[imageData.mimeType] || 'image/jpeg';

    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData.base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      }],
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const reqOptions = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 60000,
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(response.error.message || 'API Error'));
              return;
            }

            const text = response.content?.[0]?.text || '';
            
            // "텍스트 없음" 응답 처리
            if (text.includes('텍스트 없음') || text.trim() === '') {
              resolve({
                text: '',
                confidence: 1.0,
                detectedLanguage: language,
                model: 'claude',
              });
              return;
            }

            resolve({
              text: text.trim(),
              confidence: 0.95,  // Claude는 일반적으로 더 정확
              detectedLanguage: /[가-힣]/.test(text) ? 'ko' : 'en',
              model: 'claude',
            });
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 딜레이 유틸리티
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 통계 조회
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 통계 리셋
   */
  resetStats() {
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalImagesProcessed: 0,
      totalTextExtracted: 0,
    };
  }
}

module.exports = ImageOCR;
