/**
 * MEDCHECKER 분석기 테스트 스크립트
 * 
 * 문맥 기반 규칙 엔진이 제대로 작동하는지 검증
 */

const AnalyzerService = require('./services/analyzer-service');

// 테스트 케이스들
const testCases = [
  // ========================================
  // 치료효과 보장 - 위반 케이스
  // ========================================
  {
    name: '치료효과 보장 - 명확한 위반',
    text: '저희 병원에서는 100% 완치를 보장합니다. 모든 환자분들이 만족하셨습니다.',
    expectedViolation: true,
    expectedRule: 'MED-EFF-001',
  },
  {
    name: '치료효과 보장 - 위반 (다른 표현)',
    text: '확실한 효과를 약속드립니다. 반드시 나으실 수 있습니다.',
    expectedViolation: true,
    expectedRule: 'MED-EFF-002',
  },
  
  // ========================================
  // 치료효과 보장 - 통과 케이스 (문맥 중요!)
  // ========================================
  {
    name: '치료효과 - 부정문 (통과해야 함)',
    text: '저희 병원은 100% 완치를 보장하지 않습니다. 개인에 따라 결과가 다를 수 있습니다.',
    expectedViolation: false,
    reason: '부정문 + 면책조항',
  },
  {
    name: '치료효과 - 면책조항 포함 (통과해야 함)',
    text: '최선의 치료를 위해 노력합니다. 다만, 치료 결과는 개인차가 있을 수 있습니다.',
    expectedViolation: false,
    reason: '보장 표현 없음 + 면책조항',
  },
  {
    name: '치료효과 - 목표 표현 (통과해야 함)',
    text: '완치를 목표로 최선의 치료를 제공합니다.',
    expectedViolation: false,
    reason: '"목표로"는 보장이 아님',
  },

  // ========================================
  // 전후사진 - 위반 케이스
  // ========================================
  {
    name: '전후사진 - 명확한 위반',
    text: '시술 전후 사진을 확인하세요! 놀라운 변화를 직접 보실 수 있습니다.',
    expectedViolation: true,
    expectedRule: 'MED-BA-001',
  },
  {
    name: '전후사진 - Before/After 표현',
    text: 'Before & After 비교! 리얼 변화를 확인하세요.',
    expectedViolation: true,
    expectedRule: 'MED-BA-001',
  },

  // ========================================
  // 전후사진 - 통과 케이스
  // ========================================
  {
    name: '전후사진 - 동의 명시 (통과해야 함)',
    text: '전후 사진은 환자의 서면 동의를 받아 게시되었습니다.',
    expectedViolation: false,
    reason: '동의 명시',
  },
  {
    name: '전후사진 - 모델 사진 (통과해야 함)',
    text: '본 이미지는 모델 사진이며, 실제 환자가 아닙니다.',
    expectedViolation: false,
    reason: '모델 사진 명시',
  },

  // ========================================
  // 과대광고 - 위반 케이스
  // ========================================
  {
    name: '과대광고 - 최상급 표현',
    text: '국내 최고의 성형외과! 업계 1위 기술력!',
    expectedViolation: true,
    expectedRule: 'MED-EX-001',
  },
  {
    name: '과대광고 - 혁신적 표현',
    text: '획기적인 신기술로 기적같은 치료 효과!',
    expectedViolation: true,
    expectedRule: 'MED-EX-002',
  },

  // ========================================
  // 과대광고 - 통과 케이스
  // ========================================
  {
    name: '과대광고 - 인증 근거 있음 (통과해야 함)',
    text: '2023년 보건복지부 인증 우수 의료기관으로 선정되었습니다.',
    expectedViolation: false,
    reason: '객관적 인증 근거',
  },
  {
    name: '과대광고 - 특허 근거 (통과해야 함)',
    text: '특허 등록된 기술로 치료합니다. (특허번호: 10-1234567)',
    expectedViolation: false,
    reason: '특허 근거 명시',
  },

  // ========================================
  // 환자 후기 - 위반 케이스
  // ========================================
  {
    name: '환자 후기 - 과장된 후기',
    text: '실제 환자 생생 후기! 완전 나았어요~ 인생병원 찾았습니다!',
    expectedViolation: true,
    expectedRule: 'MED-TM-001',
  },

  // ========================================
  // 환자 후기 - 통과 케이스
  // ========================================
  {
    name: '환자 후기 - 광고 표기 있음 (통과해야 함)',
    text: '[광고] 체험단으로 참여한 솔직 후기입니다. 개인의 경험이며 결과는 다를 수 있습니다.',
    expectedViolation: false,
    reason: '광고 표기 + 면책조항',
  },

  // ========================================
  // 가격 광고 - 위반 케이스
  // ========================================
  {
    name: '가격 광고 - 과도한 할인',
    text: '70% 파격 할인! 오늘만 특가! 선착순 10명!',
    expectedViolation: true,
    expectedRule: 'MED-PR-001',
  },

  // ========================================
  // 미승인 시술 - 위반 케이스 (심각)
  // ========================================
  {
    name: '미승인 시술 - 줄기세포',
    text: '줄기세포 주사로 관절 통증을 완치하세요!',
    expectedViolation: true,
    expectedRule: 'MED-UN-001',
  },

  // ========================================
  // 미승인 시술 - 통과 케이스
  // ========================================
  {
    name: '미승인 시술 - 임상시험 명시 (통과해야 함)',
    text: '현재 줄기세포 치료에 대한 임상시험이 진행 중입니다. 식약처 승인 후 제공 예정입니다.',
    expectedViolation: false,
    reason: '임상시험/승인 대기 명시',
  },
];

async function runTests() {
  console.log('========================================');
  console.log('MEDCHECKER 분석기 테스트 시작');
  console.log('========================================\n');

  // Gemini API 키 설정 (테스트용)
  const analyzer = new AnalyzerService({
    geminiApiKey: process.env.GEMINI_API_KEY,
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    enableAI: false,  // 규칙 기반만 테스트
    debug: true,
  });

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n--- 테스트: ${testCase.name} ---`);
    console.log(`입력: "${testCase.text.substring(0, 60)}..."`);

    const result = await analyzer.analyzeText(testCase.text, {
      analysisTypes: ['medical_ad'],
      enableAI: false,
    });

    const hasViolation = result.violations && result.violations.length > 0;
    const matchedRule = result.violations?.[0]?.ruleId;

    const isCorrect = hasViolation === testCase.expectedViolation;

    if (isCorrect) {
      console.log(`✅ 통과: 예상대로 ${hasViolation ? '위반 탐지' : '통과'}`);
      if (hasViolation) {
        console.log(`   - 탐지된 규칙: ${matchedRule}`);
        console.log(`   - 신뢰도: ${(result.violations[0].confidence * 100).toFixed(1)}%`);
      }
      passed++;
    } else {
      console.log(`❌ 실패: 예상=${testCase.expectedViolation ? '위반' : '통과'}, 실제=${hasViolation ? '위반' : '통과'}`);
      if (testCase.reason) {
        console.log(`   - 예상 이유: ${testCase.reason}`);
      }
      if (hasViolation) {
        console.log(`   - 잘못 탐지된 규칙: ${matchedRule}`);
        console.log(`   - 매칭된 텍스트: ${result.violations[0].matchedText}`);
      }
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`테스트 결과: ${passed}/${testCases.length} 통과 (${failed} 실패)`);
  console.log('========================================\n');

  // AI 통계
  console.log('AI 사용 통계:', analyzer.aiManager.getStats());
}

// 실행
runTests().catch(console.error);
