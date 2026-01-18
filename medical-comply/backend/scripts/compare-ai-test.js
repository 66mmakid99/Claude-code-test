#!/usr/bin/env node
/**
 * Claude vs Gemini 품질 비교 테스트 스크립트
 *
 * 사용법:
 *   node scripts/compare-ai-test.js https://example.com
 *   node scripts/compare-ai-test.js https://example.com seo
 */

require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');

const TEST_URL = process.argv[2] || 'https://www.samsung.com/sec/';
const TEST_TYPE = process.argv[3] || 'aeo';

// 색상 출력
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// 프롬프트 생성
function generatePrompt(testType, url) {
  if (testType === 'seo') {
    return `다음 웹사이트의 SEO 상태를 분석하고 JSON 형식으로 결과를 반환하세요.

분석 대상: ${url}

다음 형식으로 응답하세요:
{
  "overallScore": 0-100,
  "categories": {
    "technical": { "score": 0-100, "issues": ["이슈1", "이슈2"] },
    "content": { "score": 0-100, "issues": [] },
    "meta": { "score": 0-100, "issues": [] }
  },
  "topPriorities": ["우선 개선 사항 1", "2", "3"],
  "summary": "한줄 요약"
}`;
  }

  return `다음 웹사이트의 AEO(Answer Engine Optimization) 상태를 분석하고 JSON 형식으로 결과를 반환하세요.

분석 대상: ${url}

AI 검색엔진(ChatGPT, Perplexity, Google AI Overview 등)에서 답변으로 인용되기 적합한지 평가하세요.

다음 형식으로 응답하세요:
{
  "overallScore": 0-100,
  "categories": {
    "structure": { "score": 0-100, "items": [{"name": "항목", "status": "pass/fail/warning", "detail": "설명"}] },
    "content": { "score": 0-100, "items": [] },
    "authority": { "score": 0-100, "items": [] }
  },
  "recommendations": ["개선 권장사항 1", "2", "3"],
  "summary": "한줄 요약"
}`;
}

// JSON 파싱
function parseJSON(text) {
  let jsonStr = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    jsonStr = match[1];
  } else {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) jsonStr = text.substring(start, end + 1);
  }
  return JSON.parse(jsonStr);
}

// 웹사이트 크롤링
async function crawlWebsite(url) {
  log(colors.cyan, '\n📡 웹사이트 크롤링 중...');

  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TestBot/1.0)'
    }
  });

  const $ = cheerio.load(response.data);

  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    h1: $('h1').first().text().trim(),
    h1Count: $('h1').length,
    h2Count: $('h2').length,
    hasSchema: $('script[type="application/ld+json"]').length > 0,
    hasOG: $('meta[property^="og:"]').length > 0,
    totalImages: $('img').length,
    imagesWithAlt: $('img[alt]').filter((i, el) => $(el).attr('alt')?.trim() !== '').length,
    bodyText: $('body').text().slice(0, 3000)
  };
}

// Claude API 호출
async function callClaude(prompt, data) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY 없음' };
  }

  log(colors.blue, '\n🔵 Claude Sonnet 4 호출 중...');
  const startTime = Date.now();

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt + '\n\n[크롤링 데이터]\n' + JSON.stringify(data, null, 2) }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    const text = response.data.content
      .filter(i => i.type === 'text')
      .map(i => i.text)
      .join('');

    const result = parseJSON(text);
    const responseTime = Date.now() - startTime;
    const inputTokens = response.data.usage?.input_tokens || 0;
    const outputTokens = response.data.usage?.output_tokens || 0;

    return {
      result,
      responseTime,
      inputTokens,
      outputTokens,
      cost: ((inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15).toFixed(6)
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Gemini API 호출
async function callGemini(prompt, data) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY 없음' };
  }

  log(colors.yellow, '\n🟡 Gemini 2.5 Flash 호출 중...');
  const startTime = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const fullPrompt = prompt + '\n\n[크롤링 데이터]\n' + JSON.stringify(data, null, 2);
    const response = await model.generateContent(fullPrompt);
    const text = response.response.text();

    const result = parseJSON(text);
    const responseTime = Date.now() - startTime;
    const usageMetadata = response.response.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;

    return {
      result,
      responseTime,
      inputTokens,
      outputTokens,
      cost: ((inputTokens / 1000000) * 0.30 + (outputTokens / 1000000) * 2.50).toFixed(6)
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 결과 출력
function printResults(claude, gemini) {
  console.log('\n' + '='.repeat(60));
  log(colors.bright, '📊 비교 결과');
  console.log('='.repeat(60));

  // 점수 비교
  const claudeScore = claude.result?.overallScore || 'N/A';
  const geminiScore = gemini.result?.overallScore || 'N/A';

  console.log('\n📈 종합 점수:');
  log(colors.blue, `   Claude:  ${claudeScore}점`);
  log(colors.yellow, `   Gemini:  ${geminiScore}점`);
  if (claudeScore !== 'N/A' && geminiScore !== 'N/A') {
    const diff = Math.abs(claudeScore - geminiScore);
    log(diff <= 5 ? colors.green : colors.red, `   차이:    ${diff}점 ${diff <= 5 ? '✅ 유사' : '⚠️ 차이 있음'}`);
  }

  // 응답시간 비교
  console.log('\n⏱️  응답 시간:');
  log(colors.blue, `   Claude:  ${claude.responseTime || 'N/A'}ms`);
  log(colors.yellow, `   Gemini:  ${gemini.responseTime || 'N/A'}ms`);
  if (claude.responseTime && gemini.responseTime) {
    const faster = claude.responseTime < gemini.responseTime ? 'Claude' : 'Gemini';
    log(colors.green, `   승자:    ${faster} (${Math.abs(claude.responseTime - gemini.responseTime)}ms 빠름)`);
  }

  // 비용 비교
  console.log('\n💰 예상 비용:');
  log(colors.blue, `   Claude:  $${claude.cost || 'N/A'}`);
  log(colors.yellow, `   Gemini:  $${gemini.cost || 'N/A'}`);
  if (claude.cost && gemini.cost) {
    const savings = ((parseFloat(claude.cost) - parseFloat(gemini.cost)) / parseFloat(claude.cost) * 100).toFixed(1);
    log(colors.green, `   절감률:  ${savings}%`);
  }

  // 토큰 사용량
  console.log('\n🔢 토큰 사용량:');
  log(colors.blue, `   Claude:  입력 ${claude.inputTokens || 0} / 출력 ${claude.outputTokens || 0}`);
  log(colors.yellow, `   Gemini:  입력 ${gemini.inputTokens || 0} / 출력 ${gemini.outputTokens || 0}`);

  // 요약 비교
  console.log('\n📝 요약:');
  log(colors.blue, `   Claude:  ${claude.result?.summary || 'N/A'}`);
  log(colors.yellow, `   Gemini:  ${gemini.result?.summary || 'N/A'}`);

  // 권장사항 비교
  const claudeRecs = claude.result?.recommendations || claude.result?.topPriorities || [];
  const geminiRecs = gemini.result?.recommendations || gemini.result?.topPriorities || [];

  console.log('\n🎯 주요 권장사항:');
  log(colors.blue, '   [Claude]');
  claudeRecs.slice(0, 3).forEach((r, i) => console.log(`     ${i + 1}. ${r}`));
  log(colors.yellow, '   [Gemini]');
  geminiRecs.slice(0, 3).forEach((r, i) => console.log(`     ${i + 1}. ${r}`));

  console.log('\n' + '='.repeat(60));
}

// 메인 실행
async function main() {
  console.log('\n' + '='.repeat(60));
  log(colors.bright, '🔬 Claude vs Gemini 품질 비교 테스트');
  console.log('='.repeat(60));
  log(colors.cyan, `URL: ${TEST_URL}`);
  log(colors.cyan, `분석 타입: ${TEST_TYPE.toUpperCase()}`);

  try {
    // 크롤링
    const crawlData = await crawlWebsite(TEST_URL);
    log(colors.green, `✅ 크롤링 완료: "${crawlData.title}"`);

    // 프롬프트 생성
    const prompt = generatePrompt(TEST_TYPE, TEST_URL);

    // 양쪽 API 호출
    const [claudeResult, geminiResult] = await Promise.all([
      callClaude(prompt, crawlData),
      callGemini(prompt, crawlData)
    ]);

    // 에러 체크
    if (claudeResult.error) {
      log(colors.red, `❌ Claude 오류: ${claudeResult.error}`);
    } else {
      log(colors.green, `✅ Claude 완료 (${claudeResult.responseTime}ms)`);
    }

    if (geminiResult.error) {
      log(colors.red, `❌ Gemini 오류: ${geminiResult.error}`);
    } else {
      log(colors.green, `✅ Gemini 완료 (${geminiResult.responseTime}ms)`);
    }

    // 결과 출력
    printResults(claudeResult, geminiResult);

    // 상세 결과 파일 저장
    const fs = require('fs');
    const resultFile = `compare-result-${Date.now()}.json`;
    fs.writeFileSync(resultFile, JSON.stringify({
      url: TEST_URL,
      testType: TEST_TYPE,
      testedAt: new Date().toISOString(),
      claude: claudeResult,
      gemini: geminiResult
    }, null, 2));
    log(colors.cyan, `\n📄 상세 결과 저장: ${resultFile}`);

  } catch (error) {
    log(colors.red, `❌ 오류 발생: ${error.message}`);
  }
}

main();
