/**
 * AI Provider 통합 모듈
 * 
 * Gemini (저비용, 1차 검증) + Claude (고정밀, 복잡한 케이스)
 * 
 * 비용 최적화 전략:
 * - 대부분의 케이스: Gemini Flash (거의 무료)
 * - 복잡한 법률 판단: Claude Sonnet (필요 시에만)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Gemini AI Provider
 * 저비용, 빠른 응답 - 1차 AI 검증에 사용
 */
class GeminiProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.costPerMillion = 0.075; // $0.075 per 1M input tokens (Flash)
  }

  /**
   * 텍스트 분석
   */
  async analyze(prompt) {
    const startTime = Date.now();
    
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,  // 낮은 temperature로 일관된 판단
          maxOutputTokens: 1000,
        },
      });

      const response = result.response;
      const text = response.text();
      
      // JSON 파싱 시도
      let parsed;
      try {
        // JSON 블록 추출
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                         text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        // JSON 파싱 실패 시 텍스트 분석
        parsed = this.parseTextResponse(text);
      }

      // 토큰 사용량 추정 (대략적)
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(text.length / 4);
      const cost = ((inputTokens + outputTokens) / 1000000) * this.costPerMillion;

      return {
        ...parsed,
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        cost,
        latencyMs: Date.now() - startTime,
        rawResponse: text,
      };
    } catch (error) {
      console.error('[GeminiProvider] Error:', error);
      throw error;
    }
  }

  /**
   * 텍스트 응답을 구조화된 형태로 파싱
   */
  parseTextResponse(text) {
    const lowerText = text.toLowerCase();
    
    return {
      isViolation: lowerText.includes('위반') && !lowerText.includes('위반 아님') && !lowerText.includes('위반이 아'),
      confidence: 0.6,
      reasoning: text.substring(0, 500),
    };
  }

  /**
   * 의료광고 위반 특화 분석
   */
  async analyzeMedicalAd(text, context, ruleInfo) {
    const prompt = `당신은 한국 의료법 전문가입니다. 다음 텍스트가 의료광고 위반에 해당하는지 정확하게 판단해주세요.

## 검사 규칙
- 규칙명: ${ruleInfo.name}
- 설명: ${ruleInfo.description}
- 법적 근거: ${ruleInfo.legalBasis || '의료법 제56조'}

## 판단 시 주의사항
1. 단순히 키워드가 있다고 위반이 아닙니다
2. 문맥을 파악하세요:
   - "100% 완치를 보장하지 않습니다" → 위반 아님 (부정문)
   - "개인차가 있을 수 있습니다" → 면책조항으로 감경
   - "논문/학회 발표 근거" → 객관적 근거로 감경
3. 의료/병원 맥락이 아니면 위반 아님

## 분석 대상
매칭된 텍스트: "${text}"
주변 문맥: "${context}"

## 응답 형식 (JSON)
{
  "isViolation": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거를 1-2문장으로",
  "mitigatingFactors": ["감경 요소들"],
  "aggravatingFactors": ["가중 요소들"]
}`;

    return this.analyze(prompt);
  }
}

/**
 * Claude AI Provider
 * 고정밀, 복잡한 법률 판단 - 2차 검증에 사용
 */
class ClaudeProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = 'claude-sonnet-4-20250514';
    this.costPerMillionInput = 3.0;   // $3 per 1M input tokens
    this.costPerMillionOutput = 15.0; // $15 per 1M output tokens
  }

  /**
   * 텍스트 분석
   */
  async analyze(prompt) {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      
      // JSON 파싱
      let parsed;
      try {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                         text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        parsed = this.parseTextResponse(text);
      }

      // 비용 계산
      const inputTokens = response.usage?.input_tokens || Math.ceil(prompt.length / 4);
      const outputTokens = response.usage?.output_tokens || Math.ceil(text.length / 4);
      const cost = (inputTokens / 1000000) * this.costPerMillionInput + 
                   (outputTokens / 1000000) * this.costPerMillionOutput;

      return {
        ...parsed,
        provider: 'claude',
        model: this.model,
        cost,
        latencyMs: Date.now() - startTime,
        rawResponse: text,
      };
    } catch (error) {
      console.error('[ClaudeProvider] Error:', error);
      throw error;
    }
  }

  parseTextResponse(text) {
    const lowerText = text.toLowerCase();
    return {
      isViolation: lowerText.includes('위반') && !lowerText.includes('위반 아님'),
      confidence: 0.6,
      reasoning: text.substring(0, 500),
    };
  }

  /**
   * 의료광고 문맥 분석 (핵심 기능)
   */
  async analyzeMedicalAdContext(text, context, ruleInfo) {
    const prompt = `당신은 대한민국 의료법 및 의료광고 규제 전문 변호사입니다.

## 배경
의료광고는 의료법 제56조에 의해 엄격히 규제됩니다. 특히 다음 사항이 금지됩니다:
1. 치료 효과를 보장하는 광고
2. 전후사진 무단 게시
3. 과대/허위 광고
4. 미승인 시술 광고
5. 유명인 추천 광고

## 검사할 규칙
- 규칙: ${ruleInfo.name}
- 설명: ${ruleInfo.description}
- 법적 근거: ${ruleInfo.legalBasis || '의료법 제56조'}
- 벌칙: ${ruleInfo.penalty || '1년 이하의 징역 또는 1천만원 이하의 벌금'}

## 판단 기준
1. **문맥 분석이 핵심입니다**
   - "100% 완치 보장" → 위반
   - "100% 완치를 보장하지 않습니다" → 적법 (부정문)
   - "개인차가 있을 수 있습니다" → 면책조항으로 감경
2. 의료/병원 맥락이 아니면 위반 아님
3. 경계선 케이스는 보수적으로 판단

## 분석 대상
매칭 텍스트: "${text}"
주변 문맥: "${context}"

## 응답 (JSON)
{
  "isViolation": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거 (2-3문장)",
  "contextAnalysis": "문맥 분석 결과",
  "mitigatingFactors": ["감경 요소"],
  "aggravatingFactors": ["가중 요소"],
  "riskLevel": "high|medium|low"
}`;

    return this.analyze(prompt);
  }

  /**
   * 복잡한 의료법 해석 (미승인 시술, 법적 경계선 케이스)
   */
  async analyzeComplexCase(text, context, ruleInfo) {
    const prompt = `당신은 대한민국 의료법 및 의료광고 규제 전문 변호사입니다.

## 배경
의료광고는 의료법 제56조에 의해 엄격히 규제됩니다. 특히 다음 사항이 금지됩니다:
1. 치료 효과를 보장하는 광고
2. 전후사진 무단 게시
3. 과대/허위 광고
4. 미승인 시술 광고
5. 유명인 추천 광고

## 검사할 규칙
- 규칙: ${ruleInfo.name}
- 법적 근거: ${ruleInfo.legalBasis}
- 벌칙: ${ruleInfo.penalty}

## 분석 대상
텍스트: "${text}"
문맥: "${context}"

## 판단 요청
1. 이 텍스트가 위 규칙 위반인지 법적 관점에서 판단해주세요
2. 면책조항, 부정문, 객관적 근거 등 감경 요소를 고려하세요
3. 경계선 케이스라면 보수적으로 판단하되 그 이유를 설명하세요

## 응답 (JSON)
{
  "isViolation": boolean,
  "confidence": 0.0-1.0,
  "legalAnalysis": "법적 분석",
  "reasoning": "판단 근거",
  "riskLevel": "high|medium|low",
  "recommendation": "권고사항"
}`;

    return this.analyze(prompt);
  }
}

/**
 * AI Provider Manager
 * 비용 최적화를 위한 자동 라우팅 + 자동 Fallback
 */
class AIProviderManager {
  constructor(config = {}) {
    this.providers = {};
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      geminiCalls: 0,
      claudeCalls: 0,
      geminiFallbacks: 0,  // Gemini 실패 후 Claude로 fallback한 횟수
    };
    
    // Fallback 상태 관리
    this.fallbackState = {
      geminiDisabled: false,           // Gemini 일시 비활성화
      geminiDisabledUntil: null,       // 비활성화 해제 시간
      consecutiveGeminiFailures: 0,    // 연속 Gemini 실패 횟수
      maxConsecutiveFailures: 3,       // 연속 실패 임계값
      disableDurationMs: 30 * 60 * 1000,  // 30분간 비활성화
    };

    // Gemini 초기화
    if (config.geminiApiKey) {
      try {
        this.providers.gemini = new GeminiProvider(config.geminiApiKey);
      } catch (e) {
        console.warn('[AIProviderManager] Gemini 초기화 실패:', e.message);
      }
    }

    // Claude 초기화
    if (config.claudeApiKey) {
      try {
        this.providers.claude = new ClaudeProvider(config.claudeApiKey);
      } catch (e) {
        console.warn('[AIProviderManager] Claude 초기화 실패:', e.message);
      }
    }
  }
  
  /**
   * Gemini 사용 가능 여부 체크
   */
  isGeminiAvailable() {
    if (!this.providers.gemini) return false;
    
    // 비활성화 상태이면 시간 체크
    if (this.fallbackState.geminiDisabled) {
      if (Date.now() > this.fallbackState.geminiDisabledUntil) {
        // 비활성화 해제
        this.fallbackState.geminiDisabled = false;
        this.fallbackState.consecutiveGeminiFailures = 0;
        console.log('[AIProviderManager] Gemini 재활성화됨');
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  /**
   * Gemini 에러 처리
   */
  handleGeminiError(error) {
    const errorMsg = error.message?.toLowerCase() || '';
    const isQuotaError = errorMsg.includes('quota') || 
                        errorMsg.includes('rate limit') || 
                        errorMsg.includes('exceeded') ||
                        errorMsg.includes('429') ||
                        errorMsg.includes('resource exhausted');
    
    if (isQuotaError) {
      this.fallbackState.consecutiveGeminiFailures++;
      console.warn(`[AIProviderManager] Gemini 한도 오류 (연속 ${this.fallbackState.consecutiveGeminiFailures}회)`);
      
      // 연속 실패 임계값 도달 시 Gemini 비활성화
      if (this.fallbackState.consecutiveGeminiFailures >= this.fallbackState.maxConsecutiveFailures) {
        this.fallbackState.geminiDisabled = true;
        this.fallbackState.geminiDisabledUntil = Date.now() + this.fallbackState.disableDurationMs;
        const minutes = this.fallbackState.disableDurationMs / 60000;
        console.warn(`[AIProviderManager] Gemini ${minutes}분간 비활성화, Claude로 전환`);
      }
      
      return true;  // fallback 필요
    }
    
    return false;  // 다른 종류의 오류
  }
  
  /**
   * Gemini 성공 처리
   */
  handleGeminiSuccess() {
    this.fallbackState.consecutiveGeminiFailures = 0;
  }

  /**
   * 분석 수행 (자동 라우팅 + 자동 Fallback)
   */
  async analyze(prompt, options = {}) {
    const {
      preferredProvider = 'claude',  // Claude를 기본으로 (Gemini 한도 이슈)
      requireHighPrecision = false,
      enableFallback = true,         // 자동 fallback 활성화
      forceClaudeOnly = true,        // Gemini 완전 비활성화
    } = options;
    
    // forceClaudeOnly가 true면 무조건 Claude 사용
    if (forceClaudeOnly && this.providers.claude) {
      const result = await this.providers.claude.analyze(prompt);
      this.stats.totalCalls++;
      this.stats.totalCost += result.cost || 0;
      this.stats.claudeCalls++;
      return result;
    }

    // Provider 선택 로직
    let provider;
    if (requireHighPrecision && this.providers.claude) {
      provider = 'claude';
    } else if (preferredProvider === 'gemini' && this.isGeminiAvailable()) {
      provider = 'gemini';
    } else if (this.providers[preferredProvider]) {
      provider = preferredProvider;
    } else if (this.providers.claude) {
      provider = 'claude';
    } else if (this.isGeminiAvailable()) {
      provider = 'gemini';
    } else {
      throw new Error('No AI provider available');
    }

    // Gemini 시도 + 자동 fallback
    if (provider === 'gemini' && enableFallback && this.providers.claude) {
      try {
        const result = await this.providers.gemini.analyze(prompt);
        
        // 성공 시 연속 실패 카운터 리셋
        this.handleGeminiSuccess();
        
        // 통계 업데이트
        this.stats.totalCalls++;
        this.stats.totalCost += result.cost || 0;
        this.stats.geminiCalls++;
        
        return result;
      } catch (error) {
        const shouldFallback = this.handleGeminiError(error);
        
        if (shouldFallback) {
          console.log('[AIProviderManager] Claude로 fallback 실행');
          this.stats.geminiFallbacks++;
          
          // Claude로 재시도
          const result = await this.providers.claude.analyze(prompt);
          
          this.stats.totalCalls++;
          this.stats.totalCost += result.cost || 0;
          this.stats.claudeCalls++;
          result.fallbackFrom = 'gemini';
          
          return result;
        }
        
        throw error;  // 한도 오류가 아니면 그대로 throw
      }
    }
    
    // 일반 실행 (fallback 없이)
    const result = await this.providers[provider].analyze(prompt);

    // 통계 업데이트
    this.stats.totalCalls++;
    this.stats.totalCost += result.cost || 0;
    if (provider === 'gemini') {
      this.stats.geminiCalls++;
      this.handleGeminiSuccess();
    }
    if (provider === 'claude') this.stats.claudeCalls++;

    return result;
  }

  /**
   * 의료광고 분석 (라우팅 + Fallback)
   */
  async analyzeMedicalAd(text, context, ruleInfo, options = {}) {
    const { enableFallback = true, forceClaudeOnly = true } = options;
    
    // forceClaudeOnly가 true면 무조건 Claude 사용
    if (forceClaudeOnly && this.providers.claude) {
      const prompt = this.buildMedicalAdPrompt(text, context, ruleInfo);
      const result = await this.providers.claude.analyze(prompt);
      this.stats.totalCalls++;
      this.stats.totalCost += result.cost || 0;
      this.stats.claudeCalls++;
      return result;
    }
    
    // Gemini 사용 가능하면 시도
    if (this.isGeminiAvailable() && enableFallback && this.providers.claude) {
      try {
        const result = await this.providers.gemini.analyzeMedicalAd(text, context, ruleInfo);
        this.handleGeminiSuccess();
        
        this.stats.totalCalls++;
        this.stats.totalCost += result.cost || 0;
        this.stats.geminiCalls++;
        
        return result;
      } catch (error) {
        const shouldFallback = this.handleGeminiError(error);
        
        if (shouldFallback) {
          console.log('[AIProviderManager] MedicalAd 분석: Claude로 fallback');
          this.stats.geminiFallbacks++;
          
          const prompt = this.buildMedicalAdPrompt(text, context, ruleInfo);
          const result = await this.providers.claude.analyze(prompt);
          
          this.stats.totalCalls++;
          this.stats.totalCost += result.cost || 0;
          this.stats.claudeCalls++;
          result.fallbackFrom = 'gemini';
          
          return result;
        }
        
        throw error;
      }
    }
    
    // Gemini 사용 불가 시 Claude 사용
    if (this.providers.claude) {
      const prompt = this.buildMedicalAdPrompt(text, context, ruleInfo);
      const result = await this.providers.claude.analyze(prompt);
      
      this.stats.totalCalls++;
      this.stats.totalCost += result.cost || 0;
      this.stats.claudeCalls++;
      
      return result;
    }
    
    // Gemini만 있는 경우
    if (this.providers.gemini) {
      const result = await this.providers.gemini.analyzeMedicalAd(text, context, ruleInfo);
      
      this.stats.totalCalls++;
      this.stats.totalCost += result.cost || 0;
      this.stats.geminiCalls++;
      
      return result;
    }
    
    throw new Error('No AI provider available');
  }

  /**
   * 의료광고 분석 프롬프트 생성
   */
  buildMedicalAdPrompt(text, context, ruleInfo) {
    return `당신은 한국 의료법 전문가입니다. 다음 텍스트가 의료광고 위반에 해당하는지 정확하게 판단해주세요.

## 검사 규칙
- 규칙명: ${ruleInfo.name}
- 설명: ${ruleInfo.description || ''}
- 법적 근거: ${ruleInfo.legalBasis || '의료법 제56조'}

## 분석 대상 텍스트
"${text}"

## 주변 문맥
${context}

## 판단 기준
1. 단순 키워드 매칭이 아닌, 문맥을 고려한 실질적 판단
2. 부정문, 조건문, 면책 문구가 있으면 위반이 아닐 수 있음
3. 메뉴명, UI 요소, 일반적인 정보 제공은 광고가 아님

## 응답 형식 (JSON)
{
  "isViolation": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거 설명"
}`;
  }

  /**
   * 사용 가능한 provider 목록
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * 통계 조회
   */
  getStats() {
    return { 
      ...this.stats,
      geminiStatus: {
        available: this.isGeminiAvailable(),
        disabled: this.fallbackState.geminiDisabled,
        disabledUntil: this.fallbackState.geminiDisabledUntil 
          ? new Date(this.fallbackState.geminiDisabledUntil).toISOString()
          : null,
        consecutiveFailures: this.fallbackState.consecutiveGeminiFailures,
      }
    };
  }
  
  /**
   * Fallback 상태 리셋 (수동)
   */
  resetFallbackState() {
    this.fallbackState.geminiDisabled = false;
    this.fallbackState.geminiDisabledUntil = null;
    this.fallbackState.consecutiveGeminiFailures = 0;
    console.log('[AIProviderManager] Fallback 상태 리셋됨');
  }
}

module.exports = {
  GeminiProvider,
  ClaudeProvider,
  AIProviderManager,
};
