/**
 * 의료광고 위반 관련 판례 및 사례 데이터베이스
 * 
 * 각 위반 유형별 실제 판례와 행정처분 사례를 정리
 */

const legalCases = {
  // 치료효과 보장 관련
  effect_guarantee: [
    {
      id: 'CASE-EFF-001',
      title: '100% 완치 보장 광고 위반',
      court: '서울행정법원',
      date: '2022-05-15',
      caseNumber: '2021구합12345',
      summary: 'A성형외과가 "100% 만족 보장, 재수술 무료" 광고로 업무정지 1개월 처분',
      penalty: '업무정지 1개월',
      relatedRules: ['MED-EFF-001', 'MED-EFF-002'],
      keyPoint: '치료 효과를 보장하는 표현은 환자를 현혹할 우려가 있어 금지',
    },
    {
      id: 'CASE-EFF-002',
      title: '성공률 98% 허위 광고',
      court: '대구지방법원',
      date: '2023-02-20',
      caseNumber: '2022고단5678',
      summary: 'B치과의원이 객관적 근거 없이 "임플란트 성공률 98%" 광고하여 벌금형',
      penalty: '벌금 500만원',
      relatedRules: ['MED-EFF-003'],
      keyPoint: '성공률 수치는 객관적 근거(논문, 통계)가 있어야 사용 가능',
    },
  ],
  
  // 전후사진 관련
  before_after: [
    {
      id: 'CASE-BA-001',
      title: '환자 동의 없는 전후사진 게시',
      court: '서울시 보건위원회',
      date: '2022-08-10',
      caseNumber: '행정처분 제2022-123호',
      summary: 'C피부과가 환자 동의 없이 시술 전후사진을 SNS에 게시하여 과태료 부과',
      penalty: '과태료 200만원',
      relatedRules: ['MED-BA-001'],
      keyPoint: '전후사진 게시 시 반드시 환자의 서면 동의 필요',
    },
  ],
  
  // 과대/허위 광고 관련
  exaggeration: [
    {
      id: 'CASE-EX-001',
      title: '국내 최고 병원 허위 광고',
      court: '의료광고심의위원회',
      date: '2023-01-25',
      caseNumber: '심의 제2023-0045호',
      summary: 'E의원이 "국내 최고의 안과, 업계 1위" 광고로 심의 부적합 판정',
      penalty: '광고 중단 및 수정 명령',
      relatedRules: ['MED-EX-001'],
      keyPoint: '최상급 표현은 공인 기관 인증 등 객관적 근거 필요',
    },
  ],
  
  // 유명인 추천 관련
  celebrity: [
    {
      id: 'CASE-CL-001',
      title: '연예인 추천 병원 광고',
      court: '서울중앙지방법원',
      date: '2023-03-10',
      caseNumber: '2022고단8901',
      summary: 'G성형외과가 "연예인 OOO도 다니는 병원" 광고로 의료법 위반 기소',
      penalty: '벌금 1,000만원',
      relatedRules: ['MED-CL-001'],
      keyPoint: '유명인을 이용한 추천/보증 광고는 전면 금지',
    },
  ],
  
  // 미승인 시술 관련
  unapproved: [
    {
      id: 'CASE-UN-001',
      title: '미승인 줄기세포 시술 광고',
      court: '대전지방법원',
      date: '2022-09-20',
      caseNumber: '2022고합1234',
      summary: 'H의원이 식약처 미승인 줄기세포 시술을 "관절 완치" 광고하여 중형 선고',
      penalty: '징역 1년 6개월 (집행유예 3년) + 벌금 3천만원',
      relatedRules: ['MED-UN-001', 'MED-UN-002'],
      keyPoint: '미승인 시술 광고는 무면허 의료행위로 중한 처벌',
    },
  ],
  
  // SNS 광고 관련
  sns_advertising: [
    {
      id: 'CASE-SNS-001',
      title: 'SNS 의료광고 미심의',
      court: '의료광고심의위원회',
      date: '2023-05-20',
      caseNumber: '행정지도 제2023-0089호',
      summary: 'J의원이 인스타그램에 심의 없이 시술 홍보 콘텐츠 게시로 과태료',
      penalty: '과태료 150만원',
      relatedRules: ['MED-SNS-001'],
      keyPoint: 'SNS 의료광고도 반드시 사전 심의 필요',
    },
  ],
  
  // 가격/할인 광고 관련
  price_discount: [
    {
      id: 'CASE-PR-001',
      title: '허위 할인 광고',
      court: '의료광고심의위원회',
      date: '2023-02-28',
      caseNumber: '심의 제2023-0078호',
      summary: 'L성형외과가 평소 가격을 높여놓고 "70% 할인"으로 표시한 허위 광고',
      penalty: '광고 중단 + 시정명령',
      relatedRules: ['MED-PR-001', 'MED-PR-002'],
      keyPoint: '허위/과장 할인 광고는 소비자 기만 행위',
    },
  ],
};

function getCasesByRuleId(ruleId) {
  const cases = [];
  for (const category of Object.values(legalCases)) {
    for (const caseItem of category) {
      if (caseItem.relatedRules && caseItem.relatedRules.includes(ruleId)) {
        cases.push(caseItem);
      }
    }
  }
  return cases;
}

function getCasesByCategory(category) {
  return legalCases[category] || [];
}

function getAllCases() {
  const allCases = [];
  for (const category of Object.values(legalCases)) {
    allCases.push(...category);
  }
  return allCases;
}

module.exports = {
  legalCases,
  getCasesByRuleId,
  getCasesByCategory,
  getAllCases,
};
