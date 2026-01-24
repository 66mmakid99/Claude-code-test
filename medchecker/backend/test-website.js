/**
 * 실제 병원 웹사이트 분석 테스트
 * 
 * 실제 병원 웹사이트를 크롤링하여 분석
 */

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const AnalyzerService = require('./services/analyzer-service');

// 테스트할 병원 웹사이트 (공개된 병원 웹사이트)
const testUrls = [
  // 성형외과/피부과 등 광고가 많은 분야
  // 실제 테스트 시 원하는 병원 URL을 입력하세요
];

// 웹사이트 크롤링 함수
async function crawlWebsite(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // 불필요한 요소 제거
    $('script, style, noscript, iframe, nav, footer, header').remove();

    // 메타 정보 추출
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    // 본문 텍스트 추출
    const textContent = $('body').text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return {
      success: true,
      url,
      title,
      description,
      keywords,
      textContent,
      textLength: textContent.length,
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error.message,
    };
  }
}

// 샘플 텍스트로 테스트 (실제 병원 웹사이트 대신)
const sampleHospitalTexts = [
  {
    name: '샘플 성형외과 A',
    text: `
      ○○성형외과에 오신 것을 환영합니다.
      
      국내 최고의 성형외과! 대한민국 No.1 성형전문 클리닉
      
      15년 경력의 전문의가 직접 상담부터 수술까지 책임집니다.
      
      [인기 시술]
      - 눈 성형: 자연스러운 쌍꺼풀, 눈매교정
      - 코 성형: 맞춤형 코 디자인, 자연스러운 코끝
      - 안면윤곽: V라인, 사각턱 교정
      
      [이벤트]
      지금 예약하시면 50% 특별 할인!
      선착순 20명 한정! 이번 달만!
      
      전후사진을 확인하세요! 놀라운 변화!
      
      100% 만족 보장! 재수술 걱정 없는 완벽한 결과!
      
      유명 연예인들도 찾는 병원!
      
      상담 예약: 02-XXX-XXXX
    `,
  },
  {
    name: '샘플 피부과 B',
    text: `
      ○○피부과
      
      피부 전문의 2인 진료
      
      [진료 안내]
      - 여드름/흉터 치료
      - 기미/잡티 레이저
      - 보톡스/필러
      - 리프팅 시술
      
      FDA 승인 레이저 장비 보유
      2023년 대한피부과학회 정회원
      
      시술 후 개인에 따라 결과가 다를 수 있습니다.
      부작용이 발생할 수 있으니 전문의와 상담하세요.
      
      진료시간: 평일 10:00-19:00 / 토요일 10:00-14:00
      
      * 비급여 항목입니다. 자세한 비용은 상담 시 안내드립니다.
    `,
  },
  {
    name: '샘플 치과 C',
    text: `
      ○○치과
      
      무통 임플란트! 전혀 안 아픈 시술!
      
      임플란트 성공률 99.9%!
      10년 보증! 재시술 걱정 NO!
      
      [특별 이벤트]
      임플란트 1+1 이벤트!
      지금 상담하면 80% 할인!
      마감 임박! 놓치면 후회!
      
      최첨단 3D CT 보유
      국내 최초 도입 독일산 임플란트
      
      원장 프로필:
      - 신의 손을 가진 명의
      - 30년 경력 임플란트 전문의
      - 10만 케이스 이상 시술
      
      전화: 02-XXX-XXXX
    `,
  },
  {
    name: '샘플 한의원 D (적법한 광고)',
    text: `
      ○○한의원
      
      한의학 박사, 한방내과 전문의
      
      [진료 과목]
      - 소화기 질환
      - 호흡기 질환
      - 통증 클리닉
      - 체질 개선
      
      [의료진 소개]
      김○○ 원장
      - 경희대학교 한의과대학 졸업
      - 대한한방내과학회 정회원
      - 한의학 박사
      
      개인의 체질과 증상에 따라 치료 효과는 다를 수 있습니다.
      
      진료시간: 평일 09:00-18:00
      점심시간: 12:30-14:00
      토요일: 09:00-13:00
      
      주소: 서울시 ○○구 ○○동
      전화: 02-XXX-XXXX
    `,
  },
];

async function runWebsiteTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           MEDCHECKER 병원 웹사이트 분석 테스트               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Analyzer 초기화
  console.log('🔧 AnalyzerService 초기화 중...\n');
  const analyzer = new AnalyzerService({
    enableAI: false,  // AI 비용 절감을 위해 비활성화
    debug: false,
  });

  console.log('\n📝 샘플 병원 텍스트 분석:\n');
  console.log('━'.repeat(70));

  for (const sample of sampleHospitalTexts) {
    console.log(`\n🏥 ${sample.name}`);
    console.log('─'.repeat(50));

    try {
      const result = await analyzer.analyzeText(sample.text, {
        analysisTypes: ['medical_ad'],
        enableAI: false,
      });

      // 결과 요약
      const report = analyzer.formatReport(result);

      console.log(`\n📊 분석 결과:`);
      console.log(`   위험도: ${report.summary.riskLabel}`);
      console.log(`   총 점수: ${report.summary.score}점`);
      console.log(`   위반: ${report.summary.violationsCount}건`);
      console.log(`   경고: ${report.summary.warningsCount}건`);

      if (report.violations.length > 0) {
        console.log(`\n🚨 발견된 위반 사항:`);
        for (const v of report.violations) {
          console.log(`   ❌ [${v.severityLabel}] ${v.ruleName}`);
          console.log(`      증거: "${v.evidence?.substring(0, 60)}..."`);
          if (v.legalBasis) {
            console.log(`      법적 근거: ${v.legalBasis}`);
          }
        }
      }

      if (report.warnings.length > 0 && report.warnings.length <= 3) {
        console.log(`\n⚠️ 경고 사항:`);
        for (const w of report.warnings) {
          console.log(`   ⚠️ ${w.ruleName}`);
        }
      } else if (report.warnings.length > 3) {
        console.log(`\n⚠️ 경고 사항: ${report.warnings.length}건 (상세 생략)`);
      }

      if (report.violations.length === 0 && report.warnings.length === 0) {
        console.log(`\n✅ 발견된 위반/경고 사항 없음`);
      }

    } catch (error) {
      console.log(`   ❌ 분석 오류: ${error.message}`);
    }
  }

  // 실제 URL이 있으면 테스트
  if (testUrls.length > 0) {
    console.log('\n\n' + '━'.repeat(70));
    console.log('\n📡 실제 웹사이트 크롤링 테스트:\n');

    for (const url of testUrls) {
      console.log(`\n🌐 ${url}`);
      console.log('─'.repeat(50));

      const crawlResult = await crawlWebsite(url);

      if (!crawlResult.success) {
        console.log(`   ❌ 크롤링 실패: ${crawlResult.error}`);
        continue;
      }

      console.log(`   제목: ${crawlResult.title}`);
      console.log(`   텍스트 길이: ${crawlResult.textLength}자`);

      const result = await analyzer.analyzeText(crawlResult.textContent, {
        analysisTypes: ['medical_ad'],
        enableAI: false,
      });

      const report = analyzer.formatReport(result);

      console.log(`\n📊 분석 결과:`);
      console.log(`   위험도: ${report.summary.riskLabel}`);
      console.log(`   위반: ${report.summary.violationsCount}건`);
      console.log(`   경고: ${report.summary.warningsCount}건`);
    }
  }

  console.log('\n\n' + '━'.repeat(70));
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    테스트 완료                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // AI 통계
  const aiStats = analyzer.aiManager.getStats();
  console.log('📊 AI 사용 통계:');
  console.log(`   - 총 호출: ${aiStats.totalCalls}회`);
  console.log(`   - 예상 비용: $${aiStats.estimatedCost?.toFixed(4) || '0.0000'}`);
}

runWebsiteTest().catch(console.error);
