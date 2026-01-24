/**
 * 의료광고 위반 규칙 확장 정의
 * 
 * 기존 medical-ad-rules.js의 13개 규칙에 추가되는 확장 규칙
 * 총 50개+ 규칙으로 확장
 */

const extendedMedicalAdRules = [
  // ============================================
  // 카테고리 1: 치료효과 보장 (추가 규칙)
  // ============================================
  {
    id: 'MED-EFF-004',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '부작용 없음 보장',
    description: '부작용이 없다고 보장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '부작용 없', '부작용 전혀', '부작용 제로', '부작용 걱정 없',
          '안전 100%', '완전 안전', '무부작용', '부작용 zero'
        ],
        patterns: [
          /부작용\s*(이|이\s*)?(없|전혀|제로|zero|걱정)/gi,
          /(100%|완전|완벽)\s*안전/gi,
          /안전\s*(을|를)?\s*(보장|확신)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['보장', '확실', '절대', '단언'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '드물게', '일부', '개인차', '가능성',
            '발생할 수', '있을 수', '나타날 수'
          ],
          patterns: [
            /부작용.*있을\s*수/gi,
            /개인에\s*따라/gi,
          ],
          weight: -0.5,
        },
        
        required: {
          keywords: ['시술', '치료', '수술', '약', '주사', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,
        requiresAI: 0.45,
        dismiss: 0.3,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 85,
    
    recommendation: {
      action: '"부작용 없음" 표현을 삭제하고, "부작용이 발생할 수 있으며 개인차가 있습니다"로 수정하세요.',
      example: {
        bad: '부작용 걱정 없는 안전한 시술',
        good: '검증된 시술이지만 개인에 따라 부작용이 있을 수 있습니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['부작용', '안전', 'critical'],
    },
  },

  {
    id: 'MED-EFF-005',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '무통증 보장',
    description: '통증이 없다고 보장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '무통', '통증 없', '통증 제로', '아프지 않',
          '전혀 안 아파', '하나도 안 아파', '통증 걱정 없'
        ],
        patterns: [
          /무통\s*(시술|치료|수술|주사)/gi,
          /통증\s*(이|이\s*)?(없|전혀|제로|zero)/gi,
          /(전혀|하나도)\s*(안|않)\s*아파/gi,
        ],
      },
      
      context: {
        windowSize: 80,
        
        aggravating: {
          keywords: ['보장', '100%', '완전', '절대'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '최소화', '줄인', '덜한', '적은',
            '개인차', '민감도', '느낄 수'
          ],
          patterns: [
            /통증.*최소화/gi,
            /개인.*차이/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['시술', '치료', '수술', '주사', '마취'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '"무통" 표현을 "통증 최소화" 또는 "마취를 통한 통증 관리"로 수정하세요.',
      example: {
        bad: '무통 시술로 전혀 안 아파요!',
        good: '국소마취를 통해 통증을 최소화합니다. (개인차가 있을 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['무통', '통증', 'warning'],
    },
  },

  {
    id: 'MED-EFF-006',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '재발 없음 보장',
    description: '재발이 없다고 보장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '재발 없', '재발 방지', '재발 0%', '다시 안',
          '영구적', '평생', '두 번 다시', '재발률 0'
        ],
        patterns: [
          /재발\s*(이|이\s*)?(없|방지|0%|zero)/gi,
          /(영구적|평생)\s*(효과|치료|해결)/gi,
          /두\s*번\s*다시\s*(안|없)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['보장', '확실', '절대', '단언', '약속'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '가능성', '줄이', '낮추', '예방',
            '관리', '주의', '재발할 수'
          ],
          patterns: [
            /재발.*가능성.*있/gi,
            /재발.*줄이/gi,
          ],
          weight: -0.45,
        },
        
        required: {
          keywords: ['치료', '시술', '수술', '병원', '질환', '증상'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 80,
    
    recommendation: {
      action: '"재발 없음" 표현을 "재발 가능성을 낮추기 위해 노력합니다"로 수정하세요.',
      example: {
        bad: '재발 걱정 없는 영구적 치료',
        good: '철저한 사후 관리로 재발 가능성을 낮춥니다. (완전한 재발 방지를 보장하지 않습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['재발', '영구', 'critical'],
    },
  },

  {
    id: 'MED-EFF-007',
    version: '1.1.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '즉각적/빠른 효과 보장',
    description: '즉각적이거나 빠른 효과를 보장하는 표현 - 의료법상 절대 금지',
    
    // ⚠️ 절대 금지 규칙: 맥락과 무관하게 위반
    // 의료법 제56조 제2항 제3호: "객관적으로 인정되지 아니하거나 근거가 없는 내용"
    // - 즉시, 즉각, 당일 등의 시간적 확정 표현은 의학적으로 보장 불가
    // - 개인차가 존재하므로 어떤 맥락에서도 허용되지 않음
    
    detection: {
      triggers: {
        // 절대 금지 키워드 - 단독 사용도 위반
        keywords: [
          '즉시', '즉각', '당일', '바로',  // 시간적 확정 표현 (단독도 위반)
          '즉시 효과', '당일 효과', '바로 효과', '즉각 효과',
          '즉각 개선', '즉시 개선', '바로 개선',
          '하루 만에', '단 1회', '한 번에', '1회 시술로'
        ],
        patterns: [
          /(즉시|당일|바로|즉각)\s*(효과|개선|호전|변화|회복)/gi,
          /(하루|1일|단\s*1회|한\s*번)\s*(만에|로|에)\s*(효과|개선|완료)/gi,
          /1회\s*(시술|치료)\s*(로|만으로)\s*(완료|해결|개선)/gi,
        ],
      },
      
      context: {
        windowSize: 80,
        
        aggravating: {
          keywords: ['확실', '보장', '100%', '완벽', '틀림없'],
          weight: 0.3,
        },
        
        // 절대 금지 규칙이므로 mitigating 효과 대폭 축소
        mitigating: {
          keywords: [],  // 어떤 면책 표현도 이 위반을 상쇄할 수 없음
          patterns: [],
          weight: 0,  // 감경 효과 없음
        },
        
        required: {
          keywords: ['치료', '시술', '효과', '개선', '병원', '피부', '의원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.50,  // 낮춰서 확실히 위반 처리
        requiresAI: 1.0,         // AI 검증 불필요 (절대 금지)
        dismiss: 0.10,           // 거의 dismiss 안 함
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      article: '객관적으로 인정되지 아니하거나 근거가 없는 내용을 광고하는 행위 금지. 즉각적/즉시 효과는 의학적으로 보장 불가능하며, 개인차가 존재하므로 어떤 맥락에서도 사용 금지.',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',  // 위반 심각도 상향
    riskScore: 80,         // 리스크 점수 상향
    
    recommendation: {
      action: '"즉시", "즉각", "당일", "바로" 등 시간적 확정 표현은 의료법상 절대 금지입니다. 해당 표현을 삭제하고 "개인차가 있을 수 있습니다"를 추가하세요.',
      example: {
        bad: '단 1회 시술로 즉시 효과!',
        good: '시술 후 개선 효과가 나타나며, 개인에 따라 차이가 있을 수 있습니다.',
      },
    },
    
    // ⚠️ AI 검증 비활성화 - 절대 금지 규칙은 문맥 판단 불필요
    aiVerification: {
      enabled: false,
    },
    
    // ⚠️ 오탐 학습 제외 - 절대 금지 규칙은 오탐으로 학습되면 안 됨
    bypassFPLearning: true,
    
    metadata: {
      isActive: true,
      priority: 5,  // 최우선 순위
      tags: ['즉시', '즉각', '효과', 'critical', '절대금지'],
      absoluteProhibition: true,  // 절대 금지 표시
    },
  },

  // ============================================
  // 카테고리 2: 전후사진 (추가 규칙)
  // ============================================
  {
    id: 'MED-BA-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'before_after',
    name: '전후 동영상 게시',
    description: '환자의 치료 전후 비교 동영상을 게시한 경우',
    
    detection: {
      triggers: {
        keywords: [
          '전후 영상', '전후 동영상', '시술 영상', '수술 영상',
          '비포애프터 영상', '변화 영상', '결과 영상'
        ],
        patterns: [
          /전\s*후\s*(영상|동영상|비디오|video)/gi,
          /(시술|수술|치료)\s*(영상|동영상)/gi,
          /before\s*(&|and)?\s*after\s*(video|영상)/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: ['실제', '생생한', '리얼', '놀라운'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: ['동의', '모델', '재연', 'CG', '시뮬레이션'],
          weight: -0.4,
        },
        
        required: {
          keywords: ['영상', '동영상', '비디오', 'video', '시술', '수술'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 시행령 제23조 제1항',
      penalty: '300만원 이하의 과태료',
    },
    
    severity: 'critical',
    riskScore: 80,
    
    recommendation: {
      action: '전후 동영상 사용 시 환자 서면 동의 필수. 동의 사실 명시 또는 모델/시뮬레이션 영상 사용.',
      example: {
        bad: '실제 시술 전후 영상 공개!',
        good: '* 본 영상은 환자의 서면 동의 하에 게시되었습니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['전후영상', '동영상', 'critical'],
    },
  },

  {
    id: 'MED-BA-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'before_after',
    name: '타인 전후사진 무단 사용',
    description: '인터넷에서 가져온 타인의 전후사진을 무단 사용',
    
    detection: {
      triggers: {
        keywords: [
          '인터넷 사진', '해외 사례', '외국 케이스', '참고 사진',
          '예시 사진', '이미지 출처'
        ],
        patterns: [
          /(인터넷|해외|외국)\s*(사진|이미지|사례)/gi,
          /출처[:：]?\s*(인터넷|구글|pinterest)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['본원', '우리 병원', '저희', '직접'],
          weight: 0.4,
        },
        
        mitigating: {
          keywords: ['참고용', '예시', '실제 아님', '이미지 출처'],
          patterns: [
            /참고\s*(용|이미지)/gi,
            /실제.*아닙니다/gi,
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['사진', '이미지', '전후', '케이스', '사례'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제1호, 저작권법',
      penalty: '의료법 위반 + 저작권 침해 손해배상',
    },
    
    severity: 'critical',
    riskScore: 85,
    
    recommendation: {
      action: '타인의 전후사진 사용 금지. 자체 촬영 + 환자 동의 사진만 사용하세요.',
      example: {
        bad: '(인터넷에서 가져온 전후사진을 본원 사례처럼 게시)',
        good: '본원 실제 사례입니다. (환자 서면 동의 완료)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['무단사용', '저작권', 'critical'],
    },
  },

  // ============================================
  // 카테고리 3: 과대/허위 광고 (추가 규칙)
  // ============================================
  {
    id: 'MED-EX-003',
    version: '1.1.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '검증 불가 수상/인증 표시',
    description: '출처가 불명확하거나 자체적으로 만든 수상/인증 표시 (공인 기관 인증은 허용)',
    
    detection: {
      triggers: {
        // 검증 불가한 표현만 탐지 (일반적인 "수상", "인증"은 제외)
        keywords: [
          '자체 인증', '내부 선정', '자체 선정', '비공식 인증',
          '대한민국 대표', '올해의 병원', '올해의 의사',
          '고객 만족 1위', '소비자 선정', '네티즌 선정'
        ],
        patterns: [
          /자체\s*(인증|선정|수상)/gi,
          /(올해|금년)의\s*(병원|의사|의원)/gi,
          /(고객|소비자|네티즌)\s*(만족|선정)\s*(1위|대상)/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: ['자체', '내부', '비공식', '협회명 불명확', '출처 없음'],
          weight: 0.4,
        },
        
        mitigating: {
          // 공인 기관 인증은 정당함
          keywords: [
            '보건복지부', '대한의사협회', '대한병원협회', '대한피부과학회',
            '식약처', '정부', '공인', '공식', 'JCI', 'ISO',
            '대한의학회', '학회 인증', '정부 인증'
          ],
          patterns: [
            /(보건복지부|대한의사협회|식약처|대한\w+학회)/gi,
            /(공인|정부|학회)\s*(기관|인증)/gi,
            /(JCI|ISO)\s*인증/gi,
          ],
          weight: -0.6,  // 공인 기관이면 강하게 감경
        },
        
        required: {
          keywords: ['병원', '의원', '클리닉', '의료', '의사'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,  // 상향 - 더 명확한 경우만
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제1호, 제2호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',  // critical → warning (공인 인증 구분 필요)
    riskScore: 70,  // 85 → 70
    
    recommendation: {
      action: '수상/인증 표시 시 공인된 수여 기관과 연도를 명확히 기재하세요.',
      example: {
        bad: '2023년 최우수 병원 선정 (출처 불명)',
        good: '2023년 보건복지부 의료서비스 품질 인증 획득',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['수상', '인증', '검증불가', 'warning'],
    },
  },

  {
    id: 'MED-EX-004',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '시설/장비 과장',
    description: '시설이나 장비를 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '최신 장비', '최첨단 시설', '세계적 수준', '국내 유일 장비',
          '특급 호텔급', '5성급', 'VIP 시설', '럭셔리'
        ],
        patterns: [
          /(최신|최첨단|세계적)\s*(장비|시설|기기)/gi,
          /(국내|아시아|세계)\s*유일\s*(장비|기기)/gi,
          /(특급|5성급|럭셔리)\s*(호텔|시설)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['유일', '단독', '독점', '최초 도입'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            'FDA', '식약처', '인증', '승인',
            '년식', '모델명', '제조사'
          ],
          patterns: [
            /(FDA|식약처)\s*인증/gi,
            /\d{4}년\s*(도입|설치)/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['장비', '시설', '기기', '병원', '의원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제2호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '장비/시설 홍보 시 구체적인 정보(제조사, 모델명, 인증)를 명시하세요.',
      example: {
        bad: '국내 유일 최첨단 장비 보유!',
        good: 'OO사 XX레이저 (FDA 승인, 2023년 도입)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['시설', '장비', '과장', 'warning'],
    },
  },

  {
    id: 'MED-EX-005',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '경험/실적 과장',
    description: '시술 건수나 경험을 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '만 건', '만건', '만 케이스', '10000', '50000',
          '수만 건', '수천 건', '업계 최다'
        ],
        patterns: [
          /\d+\s*(만|천)\s*(건|케이스|례|회)/gi,
          /(수만|수천|수백)\s*(건|케이스)/gi,
          /(업계|국내)\s*최다\s*(경험|실적|시술)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['돌파', '달성', '기록', '자랑'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '누적', '기준', '통계', '데이터',
            '년간', '기간'
          ],
          patterns: [
            /\d{4}년\s*(기준|까지)/gi,
            /누적\s*기준/gi,
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['시술', '수술', '치료', '케이스', '경험'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제2호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '시술 건수 표기 시 기간과 기준을 명확히 밝히세요.',
      example: {
        bad: '10만 건 시술 돌파!',
        good: '2010년~2023년 누적 시술 건수 (내부 통계 기준)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['경험', '실적', '과장', 'warning'],
    },
  },

  {
    id: 'MED-EX-006',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '진료시간 과장',
    description: '24시간, 365일 등 진료시간을 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '24시간', '365일', '무휴', '연중무휴', '야간 진료',
          '주말 진료', '공휴일 진료', '언제든'
        ],
        patterns: [
          /24\s*시간\s*(진료|운영|상담)/gi,
          /365\s*일\s*(진료|운영)/gi,
          /(연중|연중무휴|무휴)\s*(진료|운영)/gi,
        ],
      },
      
      context: {
        windowSize: 80,
        
        aggravating: {
          keywords: ['항상', '언제나', '쉬지 않고'],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '응급', '당직', '사전 예약', '전화 상담',
            '일부 진료', '응급실'
          ],
          patterns: [
            /응급\s*(실|진료)/gi,
            /사전\s*예약\s*필수/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['진료', '병원', '의원', '클리닉', '운영'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.55,
        requiresAI: 0.35,
        dismiss: 0.20,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제1호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'info',
    riskScore: 50,
    
    recommendation: {
      action: '실제 운영 시간을 정확히 표기하고, 야간/주말은 별도 안내하세요.',
      example: {
        bad: '24시간 365일 진료',
        good: '평일 09:00-18:00 / 토요일 09:00-13:00 (야간, 공휴일은 응급실 운영)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: false,  // 비활성화: 운영시간은 판단 대상 아님 (검증 불가, 병원 운영 정책)
      priority: 25,
      tags: ['진료시간', '24시간', 'info'],
    },
  },

  // ============================================
  // 카테고리 4: 환자 후기 (추가 규칙)
  // ============================================
  {
    id: 'MED-TM-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'testimonial',
    name: '가짜/조작 후기',
    description: '병원이 작성한 가짜 환자 후기',
    
    detection: {
      triggers: {
        keywords: [
          '환자분 후기', '고객님 후기', '후기 공유', '감사 후기',
          '실제 후기', '진짜 후기'
        ],
        patterns: [
          /(환자|고객)\s*(분|님)?\s*(의|이|가)?\s*후기/gi,
          /(실제|진짜|리얼)\s*후기/gi,
        ],
      },
      
      context: {
        windowSize: 150,
        
        aggravating: {
          keywords: [
            '익명', '닉네임', 'OOO님', '○○○',
            '초성', '***'
          ],
          patterns: [
            /[가-힣]\*+[가-힣]?/gi,  // 김*수, 이**
            /[ㄱ-ㅎ]{2,3}/gi,  // ㄱㅎㅅ (초성)
          ],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '직접 작성', '본인 작성', '작성자 확인',
            '실명', '환자 동의'
          ],
          patterns: [
            /환자\s*동의.*작성/gi,
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['후기', '리뷰', '경험담', '치료', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제1호, 표시광고법',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 85,
    
    recommendation: {
      action: '가짜 후기 작성 금지. 실제 환자 후기만 게시하고, 광고임을 명시하세요.',
      example: {
        bad: '(병원이 작성한 가짜 후기를 환자 후기처럼 게시)',
        good: '[광고] 환자 인터뷰 (본인 동의 하에 게시, 개인차가 있을 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude',  // 조작 여부 판단은 복잡하므로 Claude
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['가짜후기', '조작', 'critical'],
    },
  },

  {
    id: 'MED-TM-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'testimonial',
    name: '블로그/카페 체험단 후기',
    description: '대가를 받고 작성한 블로그/카페 후기에 광고 표기 누락',
    
    detection: {
      triggers: {
        keywords: [
          '체험단', '서포터즈', '원고료', '소정의 원고료',
          '무상 제공', '할인 제공', '협찬'
        ],
        patterns: [
          /(체험단|서포터즈)\s*(활동|참여|선정)/gi,
          /(원고료|협찬)\s*(을|를)?\s*(받|지급)/gi,
          /(무상|할인)\s*(제공|시술)/gi,
        ],
      },
      
      context: {
        windowSize: 200,
        
        aggravating: {
          keywords: ['솔직', '리얼', '직접 경험', '강추'],
          weight: 0.15,
        },
        
        mitigating: {
          keywords: [
            '#광고', '#협찬', '[광고]', '(광고)',
            '광고입니다', '이 글은 광고'
          ],
          patterns: [
            /#\s*(광고|ad|협찬)/gi,
            /\[(광고|ad)\]/gi,
            /광고\s*(입니다|임|포함)/gi,
          ],
          weight: -0.7,
        },
        
        required: {
          keywords: ['병원', '의원', '시술', '치료', '후기'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '표시광고법 제3조',
      penalty: '과태료 500만원 이하',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '체험단/협찬 콘텐츠에는 반드시 "#광고" 또는 "[광고]"를 명확히 표기하세요.',
      example: {
        bad: '체험단으로 시술받고 작성하는 솔직 후기~',
        good: '[광고] 체험단 참여 후기입니다. (시술 협찬, 개인 경험이며 결과는 개인차가 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['체험단', '블로그', '광고표기', 'warning'],
    },
  },

  // ============================================
  // 카테고리 5: 유명인 추천 (추가 규칙)
  // ============================================
  {
    id: 'MED-CL-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'celebrity',
    name: '의사/전문가 추천 가장',
    description: '전문가나 의사의 추천인 것처럼 가장하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '의사들이 추천', '전문가 추천', '의료진 추천',
          '원장님이 추천', '동료 의사', '의사도 받는'
        ],
        patterns: [
          /(의사|전문가|의료진)\s*(들이|도|이|가)\s*추천/gi,
          /(의사|전문가)\s*(도)?\s*(받는|선택한)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['입소문', '소문', '유명', '알려진'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '실명', '인터뷰', '공식', '학회',
            '논문', '발표'
          ],
          patterns: [
            /[가-힣]{2,4}\s*(교수|박사|원장)/gi,  // 실명 + 직함
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['추천', '병원', '시술', '치료', '의사'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제5호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 80,
    
    recommendation: {
      action: '전문가 추천 표현 사용 시 실명과 소속을 명확히 밝히거나, 삭제하세요.',
      example: {
        bad: '의사들 사이에서 입소문난 시술',
        good: '(전문가 추천 광고 사용 금지)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['전문가추천', '의사추천', 'critical'],
    },
  },

  {
    id: 'MED-CL-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'celebrity',
    name: '방송/언론 출연 과장',
    description: '방송이나 언론 출연을 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '방송 출연', 'TV 출연', '언론 보도', '뉴스 소개',
          '방영', '보도된', '방송에 나온', '미디어 소개'
        ],
        patterns: [
          /(방송|TV|뉴스|언론)\s*(출연|보도|소개|방영)/gi,
          /[가-힣]+\s*(방송|뉴스).*출연/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: ['유명', '화제', '난리', '대박'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '방송명', '방영일', '년 월', '출처',
            'KBS', 'MBC', 'SBS', 'JTBC', 'TVN'
          ],
          patterns: [
            /\d{4}년\s*\d{1,2}월.*방영/gi,
            /(KBS|MBC|SBS|JTBC|tvN)/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['방송', '출연', '보도', '병원', '의원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제2호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '방송 출연 홍보 시 방송명, 방영일 등 구체적 정보를 명시하세요.',
      example: {
        bad: 'TV 방송에 소개된 병원!',
        good: '2023년 5월 KBS 생로병사의 비밀 출연 (방영일: 2023.05.15)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['방송출연', '언론', 'warning'],
    },
  },

  // ============================================
  // 카테고리 6: 비교 광고 (추가 규칙)
  // ============================================
  {
    id: 'MED-CP-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'comparison',
    name: '가격 비교 광고',
    description: '타 병원과 가격을 비교하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '타병원 대비', '다른 병원보다', '경쟁사 대비',
          '평균 가격', '시세보다', '일반 병원'
        ],
        patterns: [
          /(타|다른|경쟁)\s*(병원|의원)\s*(대비|보다)/gi,
          /(평균|시세|일반)\s*(가격|비용)\s*(대비|보다)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['저렴', '싸다', '절감', '할인'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '비급여', '실비', '보험 적용',
            '정가 안내', '비용 문의'
          ],
          weight: -0.25,
        },
        
        required: {
          keywords: ['가격', '비용', '병원', '시술', '치료'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제5호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '타 병원과의 가격 비교 표현을 삭제하고, 자사 비용만 안내하세요.',
      example: {
        bad: '타병원 대비 50% 저렴!',
        good: '시술 비용 안내: 상담 후 개별 안내드립니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['가격비교', '비교광고', 'warning'],
    },
  },

  {
    id: 'MED-CP-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'comparison',
    name: '암묵적 비교 광고',
    description: '직접 언급 없이 타 병원을 암시적으로 비교/비하하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '아무 병원', '아무 곳', '일반 병원', '다른 곳',
          '그런 곳', '여기저기', '막 하는'
        ],
        patterns: [
          /(아무|일반|다른)\s*(병원|곳|데)\s*(과|와|에서)/gi,
          /(여기저기|이곳저곳)\s*(에서|다니)/gi,
          /(막|대충|아무렇게)\s*(하는|시술)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['위험', '부작용', '후회', '실패', '재수술'],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: ['주의', '신중', '선택', '비교'],
          weight: -0.2,
        },
        
        required: {
          keywords: ['병원', '시술', '치료', '선택'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제5호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '암시적 비교 표현을 삭제하고, 자사의 장점만 안내하세요.',
      example: {
        bad: '아무 병원에서 막 하면 부작용 위험!',
        good: '숙련된 전문의가 안전하게 시술합니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['암묵비교', '비하', 'warning'],
    },
  },

  // ============================================
  // 카테고리 7: 가격/할인 (추가 규칙)
  // ============================================
  {
    id: 'MED-PR-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'price_discount',
    name: '미끼 가격 광고',
    description: '실제로는 적용되지 않는 미끼 가격 광고',
    
    detection: {
      triggers: {
        keywords: [
          '~부터', '최저', '최저가', '~원부터',
          '기본 가격', '시작 가격'
        ],
        patterns: [
          /\d+\s*(만)?\s*원\s*(부터|~)/gi,
          /(최저|최저가)\s*\d+/gi,
          /기본\s*(가격|비용).*\d+/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['한정', '선착순', '특별가', '이벤트'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '상담 후', '개인별', '부위별', '시술 범위',
            '정확한 비용', '견적'
          ],
          patterns: [
            /상담.*후.*결정/gi,
            /개인별.*상이/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['가격', '비용', '원', '시술', '치료'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.55,
        requiresAI: 0.35,
        dismiss: 0.20,
      },
    },
    
    legal: {
      basis: '표시광고법 제3조 (기만적 광고)',
      penalty: '과태료 및 시정명령',
    },
    
    severity: 'warning',
    riskScore: 55,
    
    recommendation: {
      action: '가격 표기 시 조건을 명확히 밝히세요.',
      example: {
        bad: '눈 성형 50만원부터~',
        good: '눈 성형 비용은 시술 범위에 따라 다르며, 상담 후 정확한 견적을 안내드립니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['미끼가격', '기만광고', 'warning'],
    },
  },

  {
    id: 'MED-PR-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'price_discount',
    name: '긴급/마감 임박 유도',
    description: '긴급함이나 마감 임박을 강조하여 즉각 결정을 유도하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '마감 임박', '조기 마감', '선착순', '한정 수량',
          '오늘만', '이번 주만', '놓치면 후회', '마지막 기회'
        ],
        patterns: [
          /(마감|조기)\s*(임박|예정|곧)/gi,
          /(오늘|이번\s*주|이번\s*달)\s*만/gi,
          /(선착순|한정)\s*\d+\s*(명|분)/gi,
          /(마지막|놓치면|지금\s*아니면)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['서두르', '급해', '빨리', '지금 바로', '당장'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: ['예약', '상담', '문의', '안내'],
          weight: -0.2,
        },
        
        required: {
          keywords: ['시술', '치료', '이벤트', '할인', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '표시광고법 제3조, 의료광고 심의기준',
      penalty: '심의 부적합, 시정명령',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '긴급/마감 임박 표현을 삭제하세요. 의료 결정은 신중하게 이루어져야 합니다.',
      example: {
        bad: '마감 임박! 선착순 10명만! 놓치면 후회!',
        good: '이벤트 진행 중입니다. 자세한 내용은 상담을 통해 안내드립니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['마감임박', '긴급유도', 'warning'],
    },
  },

  {
    id: 'MED-PR-004',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'price_discount',
    name: '패키지/번들 과장',
    description: '패키지나 번들 상품을 과장하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '올인원', '풀패키지', '토탈 케어', '통합 관리',
          '세트 할인', '묶음 할인', '1+1', '2+1'
        ],
        patterns: [
          /(올인원|풀패키지|토탈|통합)\s*(케어|관리|패키지)/gi,
          /(\d+)\s*\+\s*(\d+)/gi,  // 1+1, 2+1
          /(세트|묶음)\s*(할인|특가)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['공짜', '무료', '덤', '서비스'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: ['개별 선택', '상담 후', '맞춤', '필요에 따라'],
          weight: -0.3,
        },
        
        required: {
          keywords: ['시술', '치료', '패키지', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.55,
        requiresAI: 0.35,
        dismiss: 0.20,
      },
    },
    
    legal: {
      basis: '의료광고 심의기준',
      penalty: '심의 부적합',
    },
    
    severity: 'info',
    riskScore: 50,
    
    recommendation: {
      action: '패키지 광고 시 개별 항목의 필요성과 비용을 명확히 안내하세요.',
      example: {
        bad: '토탈 케어 패키지 1+1 이벤트!',
        good: '맞춤 치료 프로그램 - 상담을 통해 필요한 시술만 선택하세요.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 25,
      tags: ['패키지', '번들', 'info'],
    },
  },

  // ============================================
  // 카테고리 8: 미승인 시술 (추가 규칙)
  // ============================================
  {
    id: 'MED-UN-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'unapproved',
    name: '오프라벨 사용 광고',
    description: '승인된 적응증 외 사용(오프라벨)을 광고하는 경우',
    
    detection: {
      triggers: {
        keywords: [
          '적응증 외', '오프라벨', 'off-label', '허가 외',
          '다른 용도', '새로운 효과', '숨겨진 효과'
        ],
        patterns: [
          /(적응증|허가)\s*(외|밖)/gi,
          /off\s*-?\s*label/gi,
          /(다른|새로운|숨겨진)\s*(용도|효과|활용)/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: ['비밀', '알려지지 않은', '특별한', '숨은'],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: [
            '연구', '논문', '학회', '발표',
            'FDA', '식약처', '승인'
          ],
          patterns: [
            /임상\s*(연구|시험)/gi,
            /학회\s*발표/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['시술', '치료', '약물', '주사', '효과'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '의료법 제27조, 약사법',
      penalty: '최대 5년 이하의 징역 또는 5천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 90,
    
    recommendation: {
      action: '오프라벨 사용은 광고할 수 없습니다. 승인된 적응증만 안내하세요.',
      example: {
        bad: '보톡스의 숨겨진 효과! (승인 외 적응증 광고)',
        good: '(승인된 적응증만 안내)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude',
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['오프라벨', '미승인', 'critical'],
    },
  },

  {
    id: 'MED-UN-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'unapproved',
    name: '해외 직구 의약품/기기 광고',
    description: '국내 미승인된 해외 직구 의약품이나 기기 광고',
    
    detection: {
      triggers: {
        keywords: [
          '해외 직구', '해외 직수입', '미국 직수입', '독일 직수입',
          '국내 미판매', '프리미엄 수입품'
        ],
        patterns: [
          /(해외|미국|독일|일본)\s*직(구|수입)/gi,
          /국내\s*(미|비)\s*(판매|승인|허가)/gi,
          /프리미엄\s*수입/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['고급', '프리미엄', '최신', '신제품'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '국내 승인', '식약처 허가', '정식 수입',
            '공식 수입', 'MFDS'
          ],
          patterns: [
            /(식약처|MFDS)\s*(승인|허가)/gi,
            /정식\s*수입/gi,
          ],
          weight: -0.5,
        },
        
        required: {
          keywords: ['의약품', '약', '기기', '장비', '시술', '주사'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '약사법 제68조, 의료기기법',
      penalty: '5년 이하의 징역 또는 5천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 95,
    
    recommendation: {
      action: '국내 미승인 해외 의약품/기기는 광고할 수 없습니다.',
      example: {
        bad: '해외 직수입 프리미엄 필러!',
        good: '(식약처 승인 제품만 사용 및 광고)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude',
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['해외직구', '미승인', 'critical'],
    },
  },

  {
    id: 'MED-UN-004',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'unapproved',
    name: '민간요법/대체의학 광고',
    description: '검증되지 않은 민간요법이나 대체의학을 광고하는 경우',
    
    detection: {
      triggers: {
        keywords: [
          '민간요법', '대체의학', '자연치료', '천연 치료',
          '약 없이', '수술 없이', '자가치유', '자연치유'
        ],
        patterns: [
          /(민간|대체|자연|천연)\s*(요법|의학|치료)/gi,
          /(약|수술|시술)\s*없이\s*(치료|완치)/gi,
          /자(가|연)\s*치유/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: ['기적', '놀라운', '비밀', '전통'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '보조', '보완', '병행', '의사 상담',
            '의학적 근거', '연구'
          ],
          patterns: [
            /보조\s*(요법|치료)/gi,
            /의사.*상담.*후/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['치료', '요법', '효과', '완치', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제27조 (무면허 의료행위)',
      penalty: '5년 이하의 징역 또는 5천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 85,
    
    recommendation: {
      action: '검증되지 않은 민간요법/대체의학 광고는 삭제하세요.',
      example: {
        bad: '약 없이 자연치유로 완치!',
        good: '(검증된 의학적 치료만 안내)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['민간요법', '대체의학', 'critical'],
    },
  },

  // ============================================
  // 카테고리 9: 자격/경력 (추가 규칙)
  // ============================================
  {
    id: 'MED-QU-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'qualification',
    name: '학력/경력 허위 표기',
    description: '학력이나 경력을 허위로 표기하는 경우 (AI 검증 필수)',
    
    detection: {
      triggers: {
        // 허위 여부는 단순 키워드로 판단 불가
        // 과장된 표현이 함께 있는 경우에만 트리거
        // 주의: '국내 유일'은 MED-EX-001 (과장 광고)에서 처리하므로 여기서 제외
        keywords: [
          '최초 도입', '세계적', '아시아 최초',
          '수천 건', '수만 건', '업계 최다 경력'
        ],
        patterns: [
          /\d+만?\s*(건|케이스|례)\s*(이상)?\s*(경험|경력|시술)/gi,
          /(국내|아시아|세계)\s*(최초|유일|최고)\s*(도입|수련|전문)/gi,
        ],
      },
      
      context: {
        windowSize: 150,
        
        aggravating: {
          keywords: ['최초', '유일', '최고', '독점', '단독'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '의사면허', '전문의 자격', '수련 증명',
            '확인 가능', '학회 정회원', '대학교', '졸업',
            '정회원', '이사', '회장'
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['경력', '경험', '시술', '수술', '케이스'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.80,  // AI 검증이 필요하므로 높은 임계값
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제4호, 제1호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '학력/경력은 사실에 기반하여 정확하게 표기하세요.',
      example: {
        bad: '국내 최초 도입! 10만 건 시술 경력!',
        good: 'OO대학교 의과대학 졸업 / OO전문의 자격 취득 (20년 경력)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 25,  // 우선순위 낮춤
      tags: ['학력', '경력', '허위', 'warning'],
    },
  },

  {
    id: 'MED-QU-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'qualification',
    name: '가짜 자격증/인증 표시',
    description: '공인되지 않은 자격증이나 인증을 표시하는 경우',
    
    detection: {
      triggers: {
        // 주의: "전문가"는 의료인에게 정당한 표현이므로 제외
        // 의심스러운 비공인 자격 표현만 트리거
        keywords: [
          '마스터 자격', '스페셜리스트 자격', 'certified specialist',
          '독자 인증', '자체 인증', '내부 자격',
          '비공식 자격'
        ],
        patterns: [
          // 구체적인 비공인 자격 패턴만
          /[가-힣]+\s*마스터\s*자격/gi,
          /[가-힣]+\s*스페셜리스트\s*자격/gi,
          /(독자|자체|내부)\s*(개발|인증|자격)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['독자', '자체 개발', '내부', '비공식', '사설'],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: [
            '대한', '학회', '협회', '정부', '전문의',
            '보건복지부', '국가 공인', '의사 면허',
            '피부과 전문의', '성형외과 전문의'
          ],
          patterns: [
            /대한[가-힣]+학회/gi,
            /국가\s*공인/gi,
            /[가-힣]+\s*전문의/gi,
          ],
          weight: -0.5,
        },
        
        required: {
          // 더 구체적인 조건: 자격/인증 단어와 함께 사용
          keywords: ['자격', '인증', '수료증', '마스터'],
          logic: 'OR',
        },
        
        // 의료인의 정당한 표현 제외
        exclusions: {
          contexts: [
            '전문의 자격',
            '의사 자격',
            '학회 정회원',
            '피부 전문가',  // 의료인의 정당한 표현
            '치료 전문가',
            '피부과 전문',
            '성형외과 전문',
          ],
          patterns: [
            /[가-힣]+과\s*전문의/gi,  // "피부과 전문의" 등
            /전문의\s*자격/gi,
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,  // 상향 - 더 확실한 경우만
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제4호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',  // critical → warning (오탐 위험 고려)
    riskScore: 65,  // 80 → 65
    
    recommendation: {
      action: '공인된 기관의 자격/인증만 표시하세요.',
      example: {
        bad: 'OO시술 마스터 자격 보유 (자체 인증)',
        good: '대한OO학회 정회원 / OO전문의 자격',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,  // 우선순위 낮춤 (오탐 위험)
      tags: ['가짜자격', '인증', 'warning'],
    },
  },

  // ============================================
  // 카테고리 10: SNS 광고 관련
  // ============================================
  {
    id: 'MED-SNS-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'sns_advertising',
    name: 'SNS 의료광고 미심의',
    description: 'SNS에 심의 없이 게시된 의료광고',
    
    detection: {
      triggers: {
        keywords: [
          '인스타', '인스타그램', '페이스북', '유튜브', '틱톡',
          'SNS', '소셜', '팔로우', '좋아요'
        ],
        patterns: [
          /(인스타|페북|유튜브|틱톡|SNS)/gi,
          // @계정명 - 이메일 주소 제외 (example@domain.com 형태)
          // 뒤에 .com, .net, .co.kr 등이 오면 이메일로 간주하여 제외
          /@[a-zA-Z0-9_.]+(?![a-zA-Z0-9_.]*\.(com|net|co\.kr|org|kr|io|me|info|biz|or\.kr|re\.kr|ne\.kr|pe\.kr|go\.kr|ac\.kr|hs\.kr|ms\.kr|es\.kr|sc\.kr|seoul\.kr))/gi,
          /#[가-힣a-zA-Z0-9_]+/gi,  // 해시태그
        ],
      },
      
      context: {
        windowSize: 200,
        
        aggravating: {
          keywords: ['시술', '치료', '수술', '효과', '전후'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '심의필', '심의번호', '광고심의',
            '의료광고심의위원회'
          ],
          patterns: [
            /심의\s*(필|번호|완료)/gi,
            /의료광고심의/gi,
          ],
          weight: -0.6,
        },
        
        required: {
          keywords: ['병원', '의원', '시술', '치료', '성형', '피부과'],
          logic: 'OR',
        },
        
        // 이메일 주소 패턴 제외 (SNS 계정으로 오탐 방지)
        exclusions: {
          patterns: [
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,  // 이메일 주소 패턴
          ],
          contexts: [
            '@naver.com', '@gmail.com', '@daum.net', '@kakao.com',
            '@hanmail.net', '@nate.com', '@yahoo.com', '@outlook.com',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.55,
        requiresAI: 0.35,
        dismiss: 0.20,
      },
    },
    
    legal: {
      basis: '의료법 제57조 (의료광고의 심의)',
      penalty: '300만원 이하의 과태료',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: 'SNS 의료광고도 반드시 사전 심의를 받아야 합니다.',
      example: {
        bad: '(심의 없이 SNS에 의료광고 게시)',
        good: '[의료광고심의필] 심의번호: 제2023-XXXXXX호',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['SNS', '미심의', 'warning'],
    },
  },

  {
    id: 'MED-SNS-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'sns_advertising',
    name: '인플루언서 협찬 미표기',
    description: '인플루언서의 의료 협찬 콘텐츠에 광고 표기가 없는 경우',
    
    detection: {
      triggers: {
        keywords: [
          '인플루언서', '유튜버', '블로거', '크리에이터',
          '팔로워', '구독자', '조회수'
        ],
        patterns: [
          /(인플루언서|유튜버|블로거|크리에이터)/gi,
          /(\d+\s*(만|천))?\s*(팔로워|구독자)/gi,
        ],
      },
      
      context: {
        windowSize: 200,
        
        aggravating: {
          keywords: ['추천', '소개', '경험', '후기', '리뷰'],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '#광고', '#협찬', '#유료광고',
            'ad', 'sponsored', '광고포함'
          ],
          patterns: [
            /#\s*(광고|ad|협찬|sponsored)/gi,
            /\[(광고|ad)\]/gi,
          ],
          weight: -0.7,
        },
        
        required: {
          keywords: ['병원', '의원', '시술', '치료', '의료'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '표시광고법 제3조',
      penalty: '과태료 500만원 이하',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '인플루언서 협찬 콘텐츠에는 반드시 "#광고" 표기를 해야 합니다.',
      example: {
        bad: '(광고 표기 없이 인플루언서가 병원 홍보)',
        good: '#광고 #협찬 OO병원에서 시술 협찬을 받았습니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['인플루언서', '협찬', '미표기', 'warning'],
    },
  },

  // ============================================
  // 카테고리 11: 의료법 기본 위반
  // ============================================
  {
    id: 'MED-BS-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'basic_violation',
    name: '의료인 아닌 자의 의료광고',
    description: '의료인 또는 의료기관이 아닌 자가 의료광고를 하는 경우',
    
    detection: {
      triggers: {
        // 주의: 병원 홈페이지의 "병원안내", "병원소개" 메뉴는 정당한 표현
        // 제3자가 병원을 추천하는 패턴만 감지
        keywords: [
          '이 병원 추천', '여기 추천', '추천드려요', '추천합니다',
          '가보세요', '여기 가세요', '이 병원 좋아요'
        ],
        patterns: [
          // 제3자 추천 패턴
          /제가\s*(추천|소개)\s*(드리|하는|할)/gi,
          /여기\s*(병원|의원)\s*(추천|좋아)/gi,
          /이\s*병원\s*(추천|좋아|강추)/gi,
        ],
      },
      
      context: {
        windowSize: 150,
        
        aggravating: {
          keywords: ['연락처', '전화번호', '예약하세요', '문의하세요', '소개비', '커미션'],
          weight: 0.35,
        },
        
        mitigating: {
          // 병원 자체 홈페이지의 표현
          keywords: [
            '본원', '저희 병원', '당원', '저희 의원',
            '의료광고', '심의필', '대표원장', '의료진 소개',
            '병원안내', '병원 안내', '의원안내', '클리닉 소개'
          ],
          patterns: [
            /(본원|저희\s*병원|당원)/gi,
            /(병원|의원|클리닉)\s*(안내|소개|정보)/gi,  // 메뉴명
          ],
          weight: -0.6,  // 감경 가중치 강화
        },
        
        required: {
          keywords: ['추천', '소개', '가보', '좋아'],  // 추천 성격의 키워드 필수
          logic: 'OR',
        },
        
        // 병원 자체 홈페이지 컨텐츠 제외
        exclusions: {
          contexts: [
            '병원안내',
            '병원 안내',
            '의원 안내',
            '병원 소개',
            '의료진 소개',
            '진료 안내',
            '오시는 길',
          ],
          patterns: [
            /^(병원|의원|클리닉)\s*(안내|소개)$/gi,  // 단독 메뉴명
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,  // 상향 - 더 확실한 경우만
        requiresAI: 0.50,
        dismiss: 0.35,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제1항',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',  // critical → warning (오탐 방지)
    riskScore: 70,  // 80 → 70
    
    recommendation: {
      action: '의료광고는 의료인 또는 의료기관만 할 수 있습니다.',
      example: {
        bad: '(블로거/인플루언서가 특정 병원을 광고성으로 추천)',
        good: '(의료기관 자체 광고만 가능)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude',
    },
    
    metadata: {
      isActive: true,
      priority: 15,  // 우선순위 낮춤
      tags: ['비의료인', '광고주체', 'warning'],
    },
  },

  {
    id: 'MED-BS-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'basic_violation',
    name: '수술 장면 공개',
    description: '수술 장면이나 시술 장면을 적나라하게 공개하는 경우',
    
    detection: {
      triggers: {
        keywords: [
          '수술 장면', '시술 장면', '수술 영상', '시술 영상',
          '라이브 수술', '실시간 시술', '수술실'
        ],
        patterns: [
          /(수술|시술)\s*(장면|영상|과정|현장)/gi,
          /(라이브|실시간)\s*(수술|시술)/gi,
          /수술실\s*(공개|영상)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['생생', '리얼', '직접', '실제', '적나라'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '교육용', '학술', '모자이크', '가림',
            '시뮬레이션', 'CG'
          ],
          patterns: [
            /(교육|학술)\s*목적/gi,
            /모자이크.*처리/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['수술', '시술', '장면', '영상', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료광고 심의기준',
      penalty: '심의 부적합, 시정명령',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '수술/시술 장면은 광고에 사용할 수 없습니다.',
      example: {
        bad: '실시간 수술 장면 공개!',
        good: '(수술 장면 대신 시술 설명 일러스트 사용)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['수술장면', '시술영상', 'warning'],
    },
  },

  {
    id: 'MED-BS-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'basic_violation',
    name: '공포/불안 조장',
    description: '건강에 대한 공포나 불안을 조장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '방치하면', '늦으면', '지금 안하면', '위험',
          '심각', '악화', '돌이킬 수 없', '후회'
        ],
        patterns: [
          /(방치|지금\s*안)\s*(하면|했다간)/gi,
          /(늦으면|늦기\s*전에)/gi,
          /(돌이킬\s*수\s*없|후회\s*합니다)/gi,
          /(위험|심각|악화)\s*(합니다|할\s*수)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['암', '사망', '마비', '장애', '불임'],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: [
            '상담', '검진', '진단', '의사',
            '전문의 상담', '정확한 진단'
          ],
          patterns: [
            /전문의.*상담/gi,
            /정확한\s*진단/gi,
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['치료', '시술', '건강', '질환', '병원'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '공포/불안 조장 표현을 삭제하고, 객관적인 정보를 제공하세요.',
      example: {
        bad: '지금 안하면 돌이킬 수 없습니다! 늦기 전에!',
        good: '정기적인 검진을 통해 건강을 관리하세요.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['공포', '불안', '조장', 'warning'],
    },
  },

  // ============================================
  // 카테고리 12: 특정 진료과목 관련
  // ============================================
  {
    id: 'MED-SP-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'specialty',
    name: '성형수술 과장 광고',
    description: '성형수술 결과를 과장하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '동안', '연예인 느낌', '연예인 라인', '자연스러운 변화',
          '티 안남', '티 안나', '자연스러움', '감쪽같이'
        ],
        patterns: [
          /(동안|연예인)\s*(느낌|라인|얼굴)/gi,
          /티\s*(안|않)\s*(남|나)/gi,
          /감쪽같(이|은)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['보장', '확실', '100%', '무조건'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '개인차', '상담', '결과는 다를 수',
            '자연스러운 결과를 위해 노력'
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['성형', '수술', '시술', '코', '눈', '턱', '가슴'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.60,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '성형수술 결과를 과장하지 마시고, 개인차가 있음을 명시하세요.',
      example: {
        bad: '연예인 느낌 100% 보장! 티 안남!',
        good: '자연스러운 결과를 위해 최선을 다합니다. (개인차가 있을 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['성형', '과장', 'warning'],
    },
  },

  {
    id: 'MED-SP-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'specialty',
    name: '다이어트 시술 과장',
    description: '체중 감량 시술의 효과를 과장하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '몇 kg 감량', '살 빠짐', '요요 없', '쏙 빠지',
          '날씬', '체중 감량 보장', '다이어트 성공'
        ],
        patterns: [
          /\d+\s*(kg|킬로)\s*(감량|빠짐|감소)/gi,
          /요요\s*(없|방지|걱정)/gi,
          /(쏙|싹|확)\s*빠지/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['보장', '100%', '확실', '단기간'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '개인차', '생활습관', '식이요법', '운동 병행',
            '의료 상담', '건강한 감량'
          ],
          patterns: [
            /개인.*차이/gi,
            /운동.*병행/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['다이어트', '체중', '감량', '살', '시술'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '다이어트 시술 광고 시 개인차와 생활습관 관리의 중요성을 명시하세요.',
      example: {
        bad: '2주 만에 10kg 감량 보장!',
        good: '의료진과의 상담을 통한 건강한 체중 관리 (개인차가 있으며, 식이/운동 병행 필요)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['다이어트', '체중감량', 'warning'],
    },
  },

  {
    id: 'MED-SP-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'specialty',
    name: '탈모 치료 과장',
    description: '탈모 치료 효과를 과장하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '모발 재생', '머리카락 재생', '탈모 완치', '탈모 해결',
          '풍성한 머리', '숱 많아', '발모', '모발 이식 성공'
        ],
        patterns: [
          /(모발|머리카락)\s*재생/gi,
          /탈모\s*(완치|해결|치료|극복)/gi,
          /(풍성|숱\s*많)/gi,
          /발모\s*(성공|효과)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['보장', '100%', '확실', '영구적'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '개인차', '진행 억제', '관리', '유지',
            '지속적인 치료', '전문의 상담'
          ],
          patterns: [
            /개인.*차이/gi,
            /지속적.*치료/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['탈모', '모발', '두피', '머리', '치료', '이식'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '탈모 치료 광고 시 완치 보장 표현을 삭제하고 개인차를 명시하세요.',
      example: {
        bad: '탈모 완치! 풍성한 머리카락 되찾기!',
        good: '전문의와의 상담을 통한 맞춤 탈모 관리 (개인차가 있으며, 지속적 관리 필요)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['탈모', '모발', 'warning'],
    },
  },

  // ============================================
  // 카테고리 15: 우려 수준 표현 (info/주의 권고)
  // ============================================
  {
    id: 'MED-INFO-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'soft_warning',
    name: '일반적 홍보성 최상급 표현',
    description: '"최상의", "최고의" 등 일반적인 홍보 표현 - 위반은 아니나 주의 권고',
    
    detection: {
      triggers: {
        keywords: [
          '최상의', '최상위', '최고의', '가장 좋은', '최선의',
          '뛰어난', '우수한', '탁월한'
        ],
        patterns: [
          /(최상|최고|최선)\s*(의|인|위)\s*(효과|결과|서비스|치료)?/gi,
          /가장\s*(좋은|뛰어난|우수한|최상위)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['확실', '보장', '틀림없', '100%'],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '노력', '추구', '목표', '위해',
            '개인차', '다를 수 있', '최선을 다'
          ],
          patterns: [
            /최선을\s*다/gi,
            /목표로\s*합니다/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['효과', '결과', '서비스', '치료', '시술', '병원'],
          logic: 'OR',
        },
        
        // 면책조항이 있으면 제외
        exclusions: {
          contexts: [
            '개인차가 있을 수 있습니다',
            '결과는 다를 수 있습니다',
            '최선을 다하겠습니다',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.80,  // 높게 설정 - 잘 위반으로 안 감
        requiresAI: 0.55,
        dismiss: 0.40,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 (주의 권고)',
      article: '과장 광고에 해당할 수 있으나, 일반적 홍보 표현으로 인정될 여지 있음',
      penalty: '경미한 위반 시 시정 권고',
    },
    
    severity: 'info',  // 가장 낮은 심각도
    riskScore: 40,  // 낮은 리스크 점수
    
    recommendation: {
      action: '"최상의/최고의" 표현 사용 시 객관적 근거를 함께 명시하거나, 면책 문구를 추가하는 것이 안전합니다.',
      example: {
        bad: '최상의 효과를 보장합니다',
        good: '최상의 결과를 위해 노력합니다. (개인차가 있을 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: false,  // AI 검증 불필요 (info 레벨)
    },
    
    metadata: {
      isActive: true,
      priority: 30,  // 낮은 우선순위
      tags: ['최상의', '최고의', '홍보', 'info'],
    },
  },
];

module.exports = extendedMedicalAdRules;
