/**
 * AI API 연동 테스트
 * 
 * Gemini와 Claude API가 정상 작동하는지 테스트
 */

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

// 테스트할 텍스트
const testText = `
우리 병원은 100% 완치를 보장합니다! 
신의 손을 가진 명의가 직접 진료합니다.
줄기세포 주사로 관절 통증을 완벽하게 해결해 드립니다.
`;

async function testGeminiAPI() {
  console.log('\n========================================');
  console.log('🔵 Gemini API 테스트');
  console.log('========================================\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    console.log('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    return false;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `다음 의료광고 텍스트에서 의료법 위반 가능성이 있는 표현을 찾아주세요.
위반 유형과 해당 표현을 JSON 형식으로 응답해주세요.

텍스트:
${testText}

응답 형식:
{
  "violations": [
    {
      "type": "위반 유형",
      "text": "문제 표현",
      "reason": "위반 사유"
    }
  ]
}`;

    console.log('📤 요청 전송 중...');
    const startTime = Date.now();
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const endTime = Date.now();
    
    console.log(`✅ 응답 수신 (${endTime - startTime}ms)`);
    console.log('\n📥 응답 내용:');
    console.log('----------------------------------------');
    console.log(text);
    console.log('----------------------------------------');
    
    return true;
  } catch (error) {
    console.log(`❌ Gemini API 오류: ${error.message}`);
    if (error.message.includes('API_KEY')) {
      console.log('   → API 키가 유효하지 않습니다.');
    }
    return false;
  }
}

async function testClaudeAPI() {
  console.log('\n========================================');
  console.log('🟣 Claude API 테스트');
  console.log('========================================\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-claude-api-key') {
    console.log('❌ ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    return false;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const prompt = `다음 의료광고 텍스트에서 의료법 위반 가능성이 있는 표현을 분석해주세요.
특히 미승인 시술, 치료효과 보장, 과대광고 여부를 중점적으로 확인해주세요.

텍스트:
${testText}

JSON 형식으로 응답해주세요:
{
  "violations": [
    {
      "type": "위반 유형",
      "severity": "critical/warning/info",
      "text": "문제 표현",
      "legalBasis": "관련 법조항",
      "recommendation": "수정 권고"
    }
  ],
  "overallRisk": "high/medium/low"
}`;

    console.log('📤 요청 전송 중...');
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',  // 테스트용으로 저렴한 모델 사용
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const endTime = Date.now();

    console.log(`✅ 응답 수신 (${endTime - startTime}ms)`);
    console.log('\n📥 응답 내용:');
    console.log('----------------------------------------');
    console.log(message.content[0].text);
    console.log('----------------------------------------');
    
    // 사용량 정보
    console.log('\n📊 토큰 사용량:');
    console.log(`   - 입력: ${message.usage.input_tokens} tokens`);
    console.log(`   - 출력: ${message.usage.output_tokens} tokens`);
    
    return true;
  } catch (error) {
    console.log(`❌ Claude API 오류: ${error.message}`);
    if (error.message.includes('authentication') || error.message.includes('api_key')) {
      console.log('   → API 키가 유효하지 않습니다.');
    }
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     MEDCHECKER AI API 연동 테스트      ║');
  console.log('╚════════════════════════════════════════╝');
  
  console.log('\n📋 테스트할 텍스트:');
  console.log('----------------------------------------');
  console.log(testText.trim());
  console.log('----------------------------------------');

  const results = {
    gemini: false,
    claude: false,
  };

  // Gemini 테스트
  results.gemini = await testGeminiAPI();

  // Claude 테스트
  results.claude = await testClaudeAPI();

  // 결과 요약
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║            테스트 결과 요약            ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`Gemini API: ${results.gemini ? '✅ 성공' : '❌ 실패'}`);
  console.log(`Claude API: ${results.claude ? '✅ 성공' : '❌ 실패'}`);
  
  if (results.gemini && results.claude) {
    console.log('\n🎉 모든 API 연동이 정상 작동합니다!');
  } else {
    console.log('\n⚠️ 일부 API에 문제가 있습니다. 위의 오류를 확인해주세요.');
  }
}

main().catch(console.error);
