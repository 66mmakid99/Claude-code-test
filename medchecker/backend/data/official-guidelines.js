/**
 * 보건복지부 의료광고 가이드라인 기반 문맥 판단 학습 데이터
 * 
 * 출처: 건강한 의료광고, 우리가 함께 만들어요(2판) - 보건복지부 2024.12
 * 
 * 핵심 원칙:
 * 1. 단순 키워드 매칭이 아닌 문맥 기반 판단
 * 2. 같은 표현도 문맥에 따라 위반/적법이 달라짐
 * 3. 부정어, 면책 표현, 조건문 고려
 * 4. 소비자 오인 가능성 기준 판단
 */

const officialGuidelines = {
  // 메타정보
  meta: {
    source: '보건복지부 의료광고 가이드라인 2판',
    version: '2024.12',
    lastUpdated: '2026-01-23',
  },

  // ============================================
  // 카테고리별 위반 유형 및 판단 기준
  // ============================================
  categories: [
    // ============================================
    // 1. 전문병원 명칭 사용
    // ============================================
    {
      id: 'GUIDELINE-001',
      name: '전문병원 명칭 사용',
      legalBasis: '의료법 제3조의5, 제42조제1항',
      description: '보건복지부 지정 전문병원이 아님에도 전문병원 명칭 사용',
      
      // 위반 사례 (문맥 포함)
      violationExamples: [
        {
          phrase: '관절 전문병원 OOO',
          context: '병원 명칭이나 광고에서 사용',
          whyViolation: '보건복지부 지정을 받지 않은 상태에서 "전문병원" 명칭 사용',
          correction: '보건복지부 지정 전문병원인 경우에만 사용 가능',
        },
        {
          phrase: '#성형 #전문병원',
          context: 'SNS 해시태그에서 사용',
          whyViolation: '해시태그도 광고의 일부로 보아 전문병원 명칭 위반',
          correction: '해시태그에서도 전문병원 명칭 사용 금지',
        },
        {
          phrase: '관절전문 OOO병원',
          context: '의료기관 명칭과 함께 "전문" 용어 사용',
          whyViolation: '소비자를 오인하게 만드는 표현',
          correction: '보건복지부 지정 관절전문병원 OOO병원',
        },
      ],
      
      // 적법 사례
      legalExamples: [
        {
          phrase: '보건복지부 지정 관절전문병원',
          context: '실제로 지정받은 경우',
          whyLegal: '법적 근거가 있는 명칭 사용',
        },
        {
          phrase: '노인전문병원',
          context: '노인복지법 종전 규정에 따라 허가된 경우 (2011.6월 이전 설립)',
          whyLegal: '법 개정 전 허가받은 기관은 사용 가능',
        },
      ],
      
      // 경계 사례 (문맥에 따라 달라지는 경우)
      boundaryCases: [
        {
          phrase: '전문 클리닉',
          violationContext: '의료기관 명칭과 함께 사용하여 전문병원으로 오인 유도',
          legalContext: '단순히 특정 진료에 집중한다는 의미로 사용 (명확한 맥락 필요)',
          judgmentCriteria: '소비자가 보건복지부 지정 전문병원으로 오인할 수 있는지 여부',
        },
        {
          phrase: '전문 치료',
          violationContext: '전문병원 명칭과 결합하여 사용',
          legalContext: '특정 질환에 대한 진료 역량을 설명하는 문맥',
          judgmentCriteria: '전문병원 지정과 무관하게 진료 역량 설명인지 여부',
        },
      ],
      
      // AI 판단 시 고려사항
      aiJudgmentCriteria: [
        '보건복지부 지정 전문병원 여부 확인 필요',
        '지정 분야와 광고 분야 일치 여부',
        '소비자 오인 가능성 평가',
        '"전문" 단어의 사용 맥락 분석',
      ],
      
      mitigatingPhrases: [],
      aggravatingPhrases: ['전문병원', '○○전문', '전문 클리닉'],
    },

    // ============================================
    // 2. 환자 유인행위
    // ============================================
    {
      id: 'GUIDELINE-002',
      name: '환자 유인행위',
      legalBasis: '의료법 제27조 제3항',
      description: '영리를 목적으로 환자를 소개·알선·유인하는 행위',
      penalty: '3년 이하의 징역 또는 3천만원 이하의 벌금',
      
      violationExamples: [
        {
          phrase: '진료비 15-20% 수수료',
          context: '중개 플랫폼이 의료기관으로부터 환자 유치 대가로 수수료 수령',
          whyViolation: '환자 소개·알선의 대가로 금품 수수',
          correction: '수수료 기반 환자 유치 시스템 금지',
        },
        {
          phrase: '시술 쿠폰 판매',
          context: '인터넷 쇼핑몰 형태로 의료 시술 상품 판매',
          whyViolation: '치료위임계약 체결을 중개하고 대가 수령',
          correction: '의료 서비스의 통신판매 형태 금지',
        },
        {
          phrase: '구매 후기 조작',
          context: '구매 건수나 후기를 허위로 부풀려 게시',
          whyViolation: '기망·유혹 수단으로 치료계약 유도',
          correction: '진실한 정보만 제공',
        },
      ],
      
      legalExamples: [
        {
          phrase: '비급여 진료비 할인',
          context: '대상·기간·범위 및 할인 폭을 명확히 명시',
          whyLegal: '비급여 항목은 본인부담금에 해당하지 않음 (대법원 2007도10542)',
          conditions: ['할인 대상 명확', '기간 제한', '범위 특정', '의료시장 질서 해치지 않는 범위'],
        },
        {
          phrase: '의료기관 정보 제공 서비스',
          context: '건강보험심사평가원 정보 활용, 소비자 편익 차원',
          whyLegal: '단순 정보 제공은 유인·알선에 해당하지 않음',
          conditions: ['수수료 수령 없음', '특정 의료기관 유도 없음'],
        },
      ],
      
      boundaryCases: [
        {
          phrase: '청소년 50% 할인',
          violationContext: '의료시장 질서를 해칠 정도의 과당경쟁 유발',
          legalContext: '경제적 여력 부족한 대상 한정, 기간·시술 제한, 의료시장 질서 훼손 없음',
          judgmentCriteria: '할인 대상의 합리적 한정, 의료시장 질서 영향',
          caseReference: '대법원 2007도10542',
        },
      ],
      
      aiJudgmentCriteria: [
        '금품 제공 또는 수수료 관계 존재 여부',
        '대상이 합리적으로 한정되어 있는지',
        '의료시장의 공정한 경쟁질서 왜곡 여부',
        '제3자 개입에 의한 유인·알선인지 자체 마케팅인지',
      ],
      
      mitigatingPhrases: ['할인 기간', '대상 한정', '비급여 항목'],
      aggravatingPhrases: ['수수료', '커미션', '유치 대가', '무료 시술'],
    },

    // ============================================
    // 3. 치료경험담 등 치료효과 오인 우려 광고
    // ============================================
    {
      id: 'GUIDELINE-003',
      name: '치료경험담 등 치료효과 오인 광고',
      legalBasis: '의료법 제56조 제2항 제2호',
      description: '환자의 치료경험담 또는 치료 후기 형태의 광고로 치료효과 오인 우려',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
      
      violationExamples: [
        {
          phrase: '시술 후기 (협찬)',
          context: '협찬, 비용지원 문구 표기되어 있거나 대가 관계 있음',
          whyViolation: '의료인 등이 긍정적 치료경험담 작성을 유도',
          correction: '대가성 후기 전면 금지',
        },
        {
          phrase: '로그인 없이 열람 가능한 치료 후기',
          context: '불특정 다수에게 치료경험담 노출',
          whyViolation: '불특정 다수가 볼 수 있는 공간에 게시된 치료경험담',
          correction: '로그인 등 절차로 열람 제한',
        },
        {
          phrase: '치료 전후 사진 (보정됨)',
          context: '전후 사진에서 조명, 화장, 스튜디오 촬영 등 조건이 다름',
          whyViolation: '성형 효과를 지나치게 부풀림',
          correction: '동일 조건에서 촬영된 사진 사용',
        },
        {
          phrase: '직원이 작성한 환자 후기',
          context: '근무 직원이 소속 의료기관 홍보 목적으로 작성',
          whyViolation: '의료기관 측 작성 홍보글임을 밝히지 않음',
          correction: '의료기관 공식 블로그에 게시하거나 관계 명시',
        },
      ],
      
      legalExamples: [
        {
          phrase: '일반 방문 후기',
          context: '의료기관 이용 만족도, 의료인 친절도 등 단순 경험 공유',
          whyLegal: '전문적 의료행위 내용 없이 일반적 이용경험만 기술',
          conditions: ['의료행위 상세 내용 없음', '수술 예후 없음', '치료 효과 언급 없음'],
        },
        {
          phrase: '치료 전후 사진',
          context: '적법한 조건을 모두 충족한 경우',
          whyLegal: '조건을 충족하면 게시 가능',
          conditions: [
            '해당 의료기관에서 진료한 환자의 사진',
            '전후 사진의 인물이 동일인',
            '촬영시기 명시',
            '동일 조건에서 촬영 (보정 없음)',
            '부작용 명시',
          ],
        },
      ],
      
      boundaryCases: [
        {
          phrase: '블로그 체험 후기',
          violationContext: '대가를 받고 작성, 경제적 이해관계 미표시',
          legalContext: '순수 자발적 후기, 의료행위 상세 내용 없음',
          judgmentCriteria: '경제적 대가 관계, 치료효과 오인 가능성',
        },
        {
          phrase: '치료 과정 사진 나열',
          violationContext: '치료단계별 사진·영상 나열로 치료효과 암시',
          legalContext: '교육 목적, 부작용 명시, 동의 획득',
          judgmentCriteria: '치료 또는 수술예후 광고 목적 여부',
        },
      ],
      
      aiJudgmentCriteria: [
        '대가성 여부 (협찬, 비용지원, 무료시술 등)',
        '경제적 이해관계 표시 여부',
        '불특정 다수 열람 가능 여부',
        '치료 효과에 대한 구체적 언급 여부',
        '전후 사진의 동일 조건 촬영 여부',
        '부작용 정보 포함 여부',
      ],
      
      mitigatingPhrases: [
        '개인차가 있을 수 있습니다',
        '개인적인 경험입니다',
        '부작용이 발생할 수 있습니다',
        '효과를 보장하지 않습니다',
        '협찬',
        '광고',
        '소정의 원고료',
      ],
      aggravatingPhrases: [
        '완치',
        '100%',
        '효과 보장',
        '확실한 효과',
        '놀라운 변화',
        '기적',
      ],
    },

    // ============================================
    // 4. 거짓 광고
    // ============================================
    {
      id: 'GUIDELINE-004',
      name: '거짓 광고',
      legalBasis: '의료법 제56조 제2항 제3호',
      description: '객관적 사실과 다르거나 객관적으로 증명이 어려운 배타적 표현',
      
      violationExamples: [
        {
          phrase: '보톡스 시술 경험이 많아 많은 분들이 찾아주고 계십니다',
          context: '실제로 해당 시술을 한 적이 없는 경우',
          whyViolation: '객관적 사실과 다른 허위 내용',
          correction: '실제 시술 내역에 기반한 광고만 가능',
          caseReference: '헌법재판소 2012헌마685',
        },
        {
          phrase: '거짓 경력 명패 사진',
          context: '거짓 내용이 기재된 명패를 촬영하여 블로그에 게시',
          whyViolation: '허위 경력 광고',
          correction: '실제 경력만 기재',
          caseReference: '대법원 2016도556',
        },
        {
          phrase: '국내 최고의 안과, 업계 1위',
          context: '객관적 근거 없이 최상급 표현 사용',
          whyViolation: '배타적 표현의 객관적 증명 불가',
          correction: '공인 기관 인증 등 객관적 근거 필요',
        },
      ],
      
      legalExamples: [
        {
          phrase: '풍부한 시술 경험',
          context: '실제 다수의 시술 경험이 있는 경우',
          whyLegal: '객관적 사실에 부합',
        },
      ],
      
      boundaryCases: [
        {
          phrase: '지역 최고',
          violationContext: '객관적 근거 없이 사용',
          legalContext: '공인된 평가 기준에 의한 순위가 있는 경우',
          judgmentCriteria: '객관적 증명 가능 여부',
        },
      ],
      
      aiJudgmentCriteria: [
        '객관적 사실과의 부합 여부',
        '배타적 표현(최고, 최초, 유일 등) 사용 여부',
        '객관적 증명 가능성',
        '소비자 오인·혼동 가능성',
      ],
      
      mitigatingPhrases: [],
      aggravatingPhrases: [
        '국내 최초',
        '세계 최고',
        '업계 1위',
        '유일한',
        '독보적',
        '최고의',
        '최다',
      ],
    },

    // ============================================
    // 5. 비교 광고
    // ============================================
    {
      id: 'GUIDELINE-005',
      name: '비교 광고',
      legalBasis: '의료법 제56조 제2항 제4호',
      description: '다른 의료인의 기능 또는 진료방법과 비교하는 광고',
      
      violationExamples: [
        {
          phrase: 'A병원보다 더 나은 결과',
          context: '특정 의료기관 명시하여 비교',
          whyViolation: '다른 의료인의 기능과 직접 비교',
          correction: '다른 의료기관과의 비교 표현 삭제',
        },
        {
          phrase: '타 병원 대비 우수한 성공률',
          context: '특정되지 않아도 비교 우위 주장',
          whyViolation: '비교 대상 불명확하나 우수성 주장',
          correction: '비교 표현 삭제',
        },
      ],
      
      legalExamples: [
        {
          phrase: '일반적인 진료방법과 비교하여',
          context: '특정 의료인이나 기관을 지목하지 않고 일반적 방법과 비교',
          whyLegal: '특정 의료인 등을 지목하지 않은 일반적 비교는 허용 가능',
          conditions: ['특정 의료인·기관 미지목', '우월성 과장 없음'],
        },
      ],
      
      boundaryCases: [
        {
          phrase: '기존 방법 대비 개선된',
          violationContext: '특정 진료방법이 다른 의료인 대비 우월하다고 인식 유도',
          legalContext: '의학적 발전에 따른 일반적 기술 발전 설명',
          judgmentCriteria: '특정 의료인 등을 비교 대상으로 인식 가능한지 여부',
        },
      ],
      
      aiJudgmentCriteria: [
        '특정 의료인 또는 의료기관 지목 여부',
        '비교 우위 주장 여부',
        '일반적 기술 설명인지 비교 광고인지',
      ],
      
      mitigatingPhrases: ['일반적인 방법과 비교하여', '기존 기술 대비'],
      aggravatingPhrases: ['타 병원 대비', 'A병원보다', '경쟁사 대비', '○○보다 우수'],
    },

    // ============================================
    // 6. 부작용 정보 누락 광고
    // ============================================
    {
      id: 'GUIDELINE-006',
      name: '부작용 정보 누락 광고',
      legalBasis: '의료법 제56조 제2항 제7호',
      description: '심각한 부작용 등 중요한 정보를 누락하거나 눈에 띄지 않게 광고',
      
      violationExamples: [
        {
          phrase: '부작용 정보 작은 글씨',
          context: '부작용 정보를 눈에 잘 띄지 않게 표시',
          whyViolation: '중요 정보를 효과적으로 전달하지 않음',
          correction: '부작용 정보를 눈에 잘 띄게 표시',
        },
        {
          phrase: '효과만 강조, 부작용 미표기',
          context: '시술 효과만 강조하고 부작용 정보 전혀 없음',
          whyViolation: '심각한 부작용 등 중요 정보 누락',
          correction: '예견 가능한 부작용 정보 필수 표기',
        },
        {
          phrase: '부작용 정보 다른 페이지에만',
          context: '부작용 정보를 광고와 다른 페이지에 별도 게시',
          whyViolation: '제한사항이 주된 광고와 근접하지 않음',
          correction: '광고 내용과 함께 부작용 정보 표시',
        },
      ],
      
      legalExamples: [
        {
          phrase: '통증이 적은 시술 (개인차 있음)',
          context: '장점 설명 시 개인차 명시',
          whyLegal: '불확정적 개념 사용 시 개인차 명시로 오인 방지',
        },
      ],
      
      boundaryCases: [
        {
          phrase: '통증이 거의 없습니다',
          violationContext: '부작용(통증) 가능성을 은폐',
          legalContext: '객관적 사실 기반, 개인차 명시, 부작용 정보 함께 표기',
          judgmentCriteria: '객관적 사실 기반 여부, 개인차·부작용 표기 여부',
        },
      ],
      
      aiJudgmentCriteria: [
        '부작용 정보 존재 여부',
        '부작용 정보의 가시성 (글씨 크기, 위치, 색상 대비)',
        '주된 광고와의 근접성',
        '불확정적 개념 사용 시 개인차 명시 여부',
      ],
      
      // 부작용 표기 필수 시술 목록 (예시)
      requiresSideEffectDisclosure: [
        '보톡스', '필러', '레이저', '리프팅', '지방흡입',
        '쌍꺼풀', '코성형', '안면윤곽', '임플란트', '치아교정',
      ],
      
      mitigatingPhrases: [
        '부작용이 발생할 수 있습니다',
        '개인차가 있을 수 있습니다',
        '담당 의사와 상담하세요',
        '시술 전 충분한 상담 필요',
      ],
      aggravatingPhrases: [
        '부작용 없음',
        '안전 100%',
        '부작용 걱정 없는',
        '완전 안전',
      ],
    },

    // ============================================
    // 7. 과장 광고
    // ============================================
    {
      id: 'GUIDELINE-007',
      name: '과장 광고',
      legalBasis: '의료법 제56조 제2항 제8호',
      description: '객관적인 사실을 과장하는 내용의 광고',
      
      violationExamples: [
        {
          phrase: '100% 만족 보장',
          context: '치료 효과나 서비스에 대한 절대적 보장',
          whyViolation: '객관적으로 보장할 수 없는 내용 과장',
          correction: '만족 보장 표현 삭제',
        },
        {
          phrase: '단 1회로 영구적 효과',
          context: '효과의 지속성을 과장',
          whyViolation: '의학적으로 증명되지 않은 과장',
          correction: '실제 효과 지속 기간 명시',
        },
        {
          phrase: '기적의 치료법',
          context: '치료 효과를 기적에 비유',
          whyViolation: '막연한 의학적 기대를 갖게 하는 과장',
          correction: '과학적 근거에 기반한 표현 사용',
        },
      ],
      
      legalExamples: [
        {
          phrase: '높은 만족도',
          context: '설문조사 등 객관적 근거에 기반',
          whyLegal: '객관적 사실에 부합하는 표현',
        },
      ],
      
      aiJudgmentCriteria: [
        '객관적 사실 과장 여부',
        '절대적 표현 사용 여부 (100%, 완전, 영구 등)',
        '의학적 근거 존재 여부',
        '소비자 오인·혼동 가능성',
      ],
      
      mitigatingPhrases: [
        '개인차가 있습니다',
        '효과는 다를 수 있습니다',
        '~인 경우가 많습니다',
      ],
      aggravatingPhrases: [
        '100%',
        '완벽한',
        '영구적',
        '기적',
        '혁명적',
        '절대적',
        '확실한',
        '보장',
      ],
    },

    // ============================================
    // 8. 법적 근거 없는 자격·명칭 표방 광고
    // ============================================
    {
      id: 'GUIDELINE-008',
      name: '법적 근거 없는 자격·명칭 표방 광고',
      legalBasis: '의료법 제56조 제2항 제9호',
      description: '법적 근거가 없는 자격이나 명칭을 표방하는 광고',
      
      violationExamples: [
        {
          phrase: 'OOO 박사 (법적 근거 없음)',
          context: '학위가 아닌 임의 칭호 사용',
          whyViolation: '법적 근거 없는 자격 표방',
          correction: '실제 학위나 자격만 표기',
        },
        {
          phrase: '피부 전문의 (일반의 자격)',
          context: '전문의 자격 없이 전문의 표방',
          whyViolation: '거짓·과장 광고 및 자격 표방 위반',
          correction: '실제 전문의 자격만 표기',
        },
        {
          phrase: '○○기기 마스터 인증',
          context: '의료기기 회사가 부여한 임의 명칭',
          whyViolation: '법령상 근거 없는 명칭',
          correction: '의료기기 업체 부여 명칭임을 명확히 표시',
        },
      ],
      
      legalExamples: [
        {
          phrase: '피부과 전문의',
          context: '실제 전문의 자격 보유',
          whyLegal: '법적 근거 있는 자격',
        },
        {
          phrase: '○○기기 교육 이수 (제조사 인증)',
          context: '의료기기 업체 부여 명칭임을 명시',
          whyLegal: '법적 근거 아님을 명확히 표시하여 오인 방지',
        },
      ],
      
      boundaryCases: [
        {
          phrase: '○○ 전문가',
          violationContext: '전문의 자격으로 오인 가능한 맥락',
          legalContext: '특정 진료 경험이 많음을 설명하는 맥락 (전문의와 구분)',
          judgmentCriteria: '법적 자격으로 오인 가능한지 여부',
        },
      ],
      
      aiJudgmentCriteria: [
        '법적 근거 있는 자격인지 여부',
        '전문의 자격 오인 가능성',
        '임의 명칭인 경우 출처 명시 여부',
      ],
      
      mitigatingPhrases: ['제조사 인증', '교육 이수', '~에서 부여'],
      aggravatingPhrases: ['박사', '전문의', '마스터', '스페셜리스트', '전문가'],
    },

    // ============================================
    // 9. 신문 등 전문가 의견형태 광고
    // ============================================
    {
      id: 'GUIDELINE-009',
      name: '신문 등 전문가 의견형태 광고',
      legalBasis: '의료법 제56조 제2항 제10호',
      description: '신문, 방송, 잡지 등에 기사나 전문가 의견 형태로 표현되는 광고',
      
      violationExamples: [
        {
          phrase: '기사형 광고 (광고 표시 없음)',
          context: '광고주로부터 대가를 받고 기사 형태로 게재',
          whyViolation: '광고임을 표시하지 않아 소비자 오인',
          correction: '광고임을 명확히 표시',
        },
        {
          phrase: '전문의 인터뷰 (연락처 포함)',
          context: '특정 의료기관의 연락처, 약도 정보 포함',
          whyViolation: '기사 형태 + 연락처 정보 = 기사형 광고',
          correction: '연락처, 약도 정보 삭제 또는 광고 표시',
        },
      ],
      
      legalExamples: [
        {
          phrase: '언론 취재 기사',
          context: '순수 취재 목적, 대가 없음, 연락처 미포함',
          whyLegal: '순수 보도 목적의 기사',
          conditions: ['대가 없음', '광고 효과 의도 없음', '연락처 미포함'],
        },
      ],
      
      aiJudgmentCriteria: [
        '기사 게재 경위 (대가 관계)',
        '연락처, 약도 등 정보 포함 여부',
        '광고 효과 의도 여부',
        '광고 표시 여부',
      ],
      
      mitigatingPhrases: ['광고', 'AD', 'Advertorial'],
      aggravatingPhrases: ['문의', '상담', '연락처', '전화', '예약'],
    },

    // ============================================
    // 10. 미심의 광고
    // ============================================
    {
      id: 'GUIDELINE-010',
      name: '미심의 광고',
      legalBasis: '의료법 제56조 제2항 제11호, 제57조',
      description: '심의를 받아야 하는 광고임에도 심의를 받지 않거나 심의 내용과 다르게 광고',
      
      // 심의 대상 매체 목록
      reviewRequiredMedia: [
        '신문',
        '인터넷신문',
        '정기간행물',
        '현수막',
        '벽보',
        '전단',
        '교통시설',
        '교통수단',
        '전광판',
        '인터넷뉴스서비스',
        '방송사업자 인터넷 홈페이지',
        '일일 평균 이용자 10만명 이상 인터넷 매체',
        'SNS (일일 평균 이용자 10만명 이상)',
      ],
      
      // 심의 면제 (기본정보만으로 구성된 광고)
      reviewExemptContent: [
        '의료기관의 명칭·소재지·전화번호',
        '의료기관이 설치·운영하는 진료과목',
        '의료인의 성명·성별 및 면허의 종류',
      ],
      
      violationExamples: [
        {
          phrase: '신문 광고 (미심의)',
          context: '심의 대상 매체에 심의 없이 광고',
          whyViolation: '심의를 받지 않은 광고',
          correction: '의료광고 자율심의기구 통해 사전 심의',
        },
      ],
    },

    // ============================================
    // 11. 상장·감사장 이용, 인증·보증·추천 광고
    // ============================================
    {
      id: 'GUIDELINE-011',
      name: '상장·감사장 이용, 인증·보증·추천 광고',
      legalBasis: '의료법 제56조 제2항 제14호',
      description: '각종 상장·감사장 이용 또는 인증·보증·추천 광고',
      
      violationExamples: [
        {
          phrase: '○○협회 우수병원 인증',
          context: '법령 근거 없는 민간 인증',
          whyViolation: '법적 근거 없는 인증 광고',
          correction: '법령 근거 있는 인증만 표시',
        },
        {
          phrase: '환자 감사장 전시',
          context: '환자로부터 받은 감사장을 광고에 활용',
          whyViolation: '상장·감사장 이용 광고',
          correction: '감사장 광고 활용 금지',
        },
      ],
      
      legalExamples: [
        {
          phrase: '의료기관평가인증원 인증',
          context: '법령에 따른 의료기관 인증',
          whyLegal: '의료법 제58조에 따른 인증',
        },
        {
          phrase: '보건복지부 인증',
          context: '중앙행정기관으로부터 받은 인증',
          whyLegal: '공공기관 인증은 예외적으로 허용',
        },
        {
          phrase: 'JCI 인증',
          context: 'WHO 협력 국제평가기구 인증',
          whyLegal: '세계보건기구 협력 국제평가기구 인증 허용',
        },
      ],
      
      // 허용되는 인증·보증
      allowedCertifications: [
        '의료기관평가인증원 인증',
        '중앙행정기관·지방자치단체·공공기관 인증',
        '법령에 따른 인증',
        'WHO 협력 국제평가기구 인증 (JCI 등)',
      ],
    },
  ],

  // ============================================
  // 문맥 판단을 위한 면책 표현 사전
  // ============================================
  mitigatingExpressions: {
    // 효과 보장 완화
    effectDisclaimer: [
      '개인차가 있을 수 있습니다',
      '개인에 따라 다를 수 있습니다',
      '효과는 개인마다 다릅니다',
      '모든 환자에게 동일한 효과를 보장하지 않습니다',
      '효과를 보장하지 않습니다',
      '결과는 개인에 따라 달라질 수 있습니다',
    ],
    
    // 부작용 고지
    sideEffectDisclaimer: [
      '부작용이 발생할 수 있습니다',
      '부작용 가능성이 있습니다',
      '개인에 따라 부작용이 나타날 수 있습니다',
      '시술 후 붓기, 멍, 통증 등이 있을 수 있습니다',
      '담당 의사와 충분한 상담 후 결정하세요',
    ],
    
    // 상담 권유
    consultationAdvice: [
      '담당 의사와 상담하세요',
      '전문의와 상담 후 결정하세요',
      '시술 전 충분한 상담이 필요합니다',
      '자세한 내용은 병원에 문의하세요',
    ],
    
    // 광고/협찬 표시
    adDisclosure: [
      '광고',
      'AD',
      '협찬',
      '유료광고',
      '소정의 원고료를 받았습니다',
      '광고성 정보',
    ],
  },

  // ============================================
  // 고위험 표현 사전 (문맥과 무관하게 위험)
  // ============================================
  highRiskExpressions: {
    // 절대적 보장 표현
    absoluteGuarantee: [
      '100% 완치',
      '100% 효과 보장',
      '100% 성공',
      '절대 안전',
      '부작용 제로',
      '부작용 없음',
      '완전 무통',
      '영구적 효과',
    ],
    
    // 최상급 표현
    superlative: [
      '국내 최초',
      '세계 최초',
      '국내 유일',
      '업계 1위',
      '최고의',
      '독보적',
      '유일한',
    ],
    
    // 환자 유인 의심 표현
    patientSolicitation: [
      '무료 시술',
      '공짜',
      '100% 할인',
      '전액 지원',
      '수수료',
      '커미션',
    ],
  },

  // ============================================
  // 처벌 기준
  // ============================================
  penalties: {
    patientSolicitation: {
      basis: '의료법 제27조제3항',
      criminal: '3년 이하의 징역 또는 3천만원 이하의 벌금',
      administrative: '자격정지 2개월',
    },
    illegalAdvertising: {
      basis: '의료법 제56조',
      criminal: '1년 이하의 징역 또는 1천만원 이하의 벌금',
      administrative: '업무정지 1~2개월',
    },
    fairTradeViolation: {
      basis: '표시광고법 제3조',
      criminal: '2년 이하의 징역 또는 1억5천만원 이하의 벌금',
      administrative: '과징금 매출액의 2% 이내',
    },
  },
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 카테고리 ID로 가이드라인 조회
 */
function getGuidelineById(id) {
  return officialGuidelines.categories.find(c => c.id === id);
}

/**
 * 위반 유형명으로 가이드라인 조회
 */
function getGuidelineByName(name) {
  return officialGuidelines.categories.find(c => 
    c.name.includes(name) || name.includes(c.name)
  );
}

/**
 * 면책 표현 확인
 */
function hasMitigatingExpression(text, category = 'all') {
  const expressions = category === 'all' 
    ? Object.values(officialGuidelines.mitigatingExpressions).flat()
    : officialGuidelines.mitigatingExpressions[category] || [];
  
  return expressions.some(expr => text.includes(expr));
}

/**
 * 고위험 표현 확인
 */
function hasHighRiskExpression(text, category = 'all') {
  const expressions = category === 'all'
    ? Object.values(officialGuidelines.highRiskExpressions).flat()
    : officialGuidelines.highRiskExpressions[category] || [];
  
  return expressions.filter(expr => text.includes(expr));
}

/**
 * 문맥 기반 위반 가능성 평가
 * @param {string} text - 분석할 텍스트
 * @param {string} matchedPhrase - 매칭된 문구
 * @returns {Object} 평가 결과
 */
function evaluateContextualRisk(text, matchedPhrase) {
  const result = {
    phrase: matchedPhrase,
    hasMitigation: false,
    mitigatingFactors: [],
    aggravatingFactors: [],
    riskLevel: 'medium',
    recommendation: '',
  };
  
  // 면책 표현 확인
  const allMitigations = Object.entries(officialGuidelines.mitigatingExpressions);
  for (const [category, expressions] of allMitigations) {
    for (const expr of expressions) {
      if (text.includes(expr)) {
        result.hasMitigation = true;
        result.mitigatingFactors.push({ category, expression: expr });
      }
    }
  }
  
  // 고위험 표현 확인
  const highRiskMatches = hasHighRiskExpression(text);
  if (highRiskMatches.length > 0) {
    result.aggravatingFactors = highRiskMatches;
  }
  
  // 위험도 평가
  if (result.aggravatingFactors.length > 0 && !result.hasMitigation) {
    result.riskLevel = 'high';
    result.recommendation = '위반 가능성 높음. 표현 수정 또는 면책 문구 추가 권장.';
  } else if (result.aggravatingFactors.length > 0 && result.hasMitigation) {
    result.riskLevel = 'medium';
    result.recommendation = '면책 문구가 있으나 고위험 표현 포함. 추가 검토 필요.';
  } else if (result.hasMitigation) {
    result.riskLevel = 'low';
    result.recommendation = '면책 문구로 인해 위반 가능성 낮음.';
  }
  
  return result;
}

module.exports = {
  officialGuidelines,
  getGuidelineById,
  getGuidelineByName,
  hasMitigatingExpression,
  hasHighRiskExpression,
  evaluateContextualRisk,
};
