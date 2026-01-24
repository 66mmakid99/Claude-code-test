/**
 * MEDCHECKER 통합 테스트
 * 
 * 규칙 엔진 + AI 분석 통합 테스트
 */

require('dotenv').config();

const AnalyzerService = require('./services/analyzer-service');
const { stats: ruleStats } = require('./rules');

// 테스트 케이스
const testCases = [
  {
    name: '치료효과 보장 (명확한 위반)',
    text: '우리 병원은 100% 완치를 보장합니다! 재발 걱정 없는 영구적 치료!',
    expectedViolations: ['MED-EFF-001', 'MED-EFF-006'],
  },
  {
    name: '치료효과 보장 (면책조항 있음 - 통과해야 함)',
    text: '최선의 치료를 위해 노력합니다. 결과는 개인에 따라 다를 수 있으며, 100% 완치를 보장하지 않습니다.',
    expectedViolations: [],
  },
  {
    name: '부작용/무통 보장 위반',
    text: '부작용 걱정 없는 안전한 시술! 무통 시술로 전혀 안 아파요!',
    expectedViolations: ['MED-EFF-004', 'MED-EFF-005'],
  },
  {
    name: '전후사진 (위반)',
    text: '실제 환자 전후 사진을 확인하세요! 놀라운 변화!',
    expectedViolations: ['MED-BA-001'],
  },
  {
    name: '전후사진 (동의 명시 - 통과해야 함)',
    text: '전후 사진입니다. 본 이미지는 환자의 서면 동의를 받아 게시되었습니다.',
    expectedViolations: [],
  },
  {
    name: '최상급 표현 (위반)',
    text: '국내 최고의 성형외과! 업계 1위 No.1 병원!',
    expectedViolations: ['MED-EX-001'],
  },
  {
    name: '최상급 표현 (인증 있음 - 통과해야 함)',
    text: '2023년 보건복지부 인증 우수 의료기관입니다.',
    expectedViolations: [],
  },
  {
    name: '신기술 과장 (위반)',
    text: '획기적인 신기술! 기적의 치료법으로 마법같은 효과!',
    expectedViolations: ['MED-EX-002'],
  },
  {
    name: '유명인 추천 (위반)',
    text: '유명 배우 OOO도 다니는 병원! 셀럽들이 선택한 클리닉!',
    expectedViolations: ['MED-CL-001'],
  },
  {
    name: '미승인 시술 (위반)',
    text: '줄기세포 주사로 관절 통증을 완벽하게 해결! 면역세포 치료로 암 완치!',
    expectedViolations: ['MED-UN-001'],
  },
  {
    name: '과도한 할인 (위반)',
    text: '70% 파격 할인! 선착순 10명만! 오늘만! 놓치면 후회!',
    expectedViolations: ['MED-PR-001', 'MED-PR-003'],
  },
  {
    name: '의료인 자격 과장 (위반)',
    text: '신의 손을 가진 명의! 국내 최고 전문의가 직접 시술!',
    expectedViolations: ['MED-QU-001'],
  },
  {
    name: '광고 미표기 (위반)',
    text: '체험단으로 시술받았어요~ 솔직 후기입니다. 완전 강추!',
    expectedViolations: ['MED-AD-001'],
  },
  {
    name: '광고 표기 있음 (통과해야 함)',
    text: '#광고 체험단으로 시술받았어요. 개인 경험이며 결과는 개인차가 있을 수 있습니다.',
    expectedViolations: [],
  },
  {
    name: '복합 위반 (여러 규칙)',
    text: `
      국내 최초 도입! 획기적인 줄기세포 시술!
      100% 완치 보장! 부작용 전혀 없음!
      유명 연예인도 다녀간 병원!
      오늘만 80% 할인! 선착순 5명!
    `,
    expectedViolations: ['MED-EX-001', 'MED-EX-002', 'MED-UN-001', 'MED-EFF-001', 'MED-EFF-004', 'MED-CL-001', 'MED-PR-001', 'MED-PR-003'],
  },
];

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           MEDCHECKER 통합 테스트 시작                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 규칙 통계 출력
  console.log('📊 로드된 규칙 통계:');
  console.log(`   - 의료광고 규칙: ${ruleStats.medicalAd.total}개`);
  console.log(`     카테고리별:`, JSON.stringify(ruleStats.medicalAd.byCategory, null, 2).replace(/\n/g, '\n     '));
  console.log(`   - 바이럴 모니터링 규칙: ${ruleStats.viralMonitoring.total}개`);
  console.log('');

  // Analyzer 초기화
  console.log('🔧 AnalyzerService 초기화 중...\n');
  const analyzer = new AnalyzerService({
    enableAI: false,  // 테스트에서는 AI 비활성화 (비용 절감)
    debug: false,
  });

  console.log('\n📝 테스트 케이스 실행:\n');
  console.log('━'.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n🧪 테스트: ${testCase.name}`);
    console.log(`   텍스트: "${testCase.text.substring(0, 80).replace(/\n/g, ' ')}..."`);

    try {
      const result = await analyzer.analyzeText(testCase.text, {
        analysisTypes: ['medical_ad'],
        enableAI: false,
      });

      const detectedRuleIds = [
        ...(result.violations || []).map(v => v.ruleId),
        ...(result.warnings || []).filter(w => w.confidence > 0.5).map(w => w.ruleId),
      ];

      // 예상된 위반 중 감지된 것
      const expectedDetected = testCase.expectedViolations.filter(
        id => detectedRuleIds.includes(id)
      );

      // 예상되지 않은 위반 감지 (False Positive)
      const unexpectedDetected = detectedRuleIds.filter(
        id => !testCase.expectedViolations.includes(id)
      );

      // 예상된 위반 중 놓친 것 (False Negative)
      const missed = testCase.expectedViolations.filter(
        id => !detectedRuleIds.includes(id)
      );

      // 결과 판정
      const isPass = missed.length === 0 && unexpectedDetected.length === 0;

      if (isPass) {
        console.log(`   ✅ 통과`);
        console.log(`      감지된 위반: ${detectedRuleIds.length > 0 ? detectedRuleIds.join(', ') : '없음'}`);
        passed++;
      } else {
        console.log(`   ❌ 실패`);
        if (missed.length > 0) {
          console.log(`      ⚠️ 놓친 위반: ${missed.join(', ')}`);
        }
        if (unexpectedDetected.length > 0) {
          console.log(`      ⚠️ 오탐지: ${unexpectedDetected.join(', ')}`);
        }
        console.log(`      감지됨: ${detectedRuleIds.join(', ') || '없음'}`);
        console.log(`      기대값: ${testCase.expectedViolations.join(', ') || '없음'}`);
        failed++;
      }

      // 상세 결과 (위반 케이스만)
      if (result.violations && result.violations.length > 0) {
        console.log(`      📋 상세:`);
        for (const v of result.violations.slice(0, 3)) {  // 최대 3개만
          console.log(`         - ${v.ruleId}: ${v.ruleName} (신뢰도: ${(v.confidence * 100).toFixed(0)}%)`);
        }
        if (result.violations.length > 3) {
          console.log(`         ... 외 ${result.violations.length - 3}개`);
        }
      }

    } catch (error) {
      console.log(`   ❌ 오류: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    테스트 결과 요약                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`총 테스트: ${testCases.length}개`);
  console.log(`✅ 통과: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`정확도: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 모든 테스트 통과!');
  } else {
    console.log('\n⚠️ 일부 테스트 실패. 규칙 조정이 필요합니다.');
  }

  // AI 통계
  const aiStats = analyzer.aiManager.getStats();
  console.log('\n📊 AI 사용 통계:');
  console.log(`   - 총 호출: ${aiStats.totalCalls}회`);
  console.log(`   - 예상 비용: $${aiStats.estimatedCost?.toFixed(4) || '0.0000'}`);
}

runTests().catch(console.error);
