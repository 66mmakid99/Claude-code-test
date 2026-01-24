/**
 * 의료광고 위반 규칙 정의
 * 
 * 의료법 제56조 (의료광고의 금지 등) 기반
 * 
 * 핵심: 단순 키워드가 아닌 문맥 기반 판단
 */

const medicalAdRules = [
  // ============================================
  // 카테고리 1: 치료효과 보장 (제56조 제2항 제3호)
  // ============================================
  {
    id: 'MED-EFF-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '치료효과 100% 보장 표현',
    description: '치료 효과를 100% 또는 확실하게 보장하는 표현',
    
    detection: {
      triggers: {
        keywords: ['100% 완치', '100%완치', '100% 치료', '100%치료', '100% 효과', '완벽한 치료'],
        patterns: [
          /100\s*%\s*(완치|치료|효과|성공|개선)/gi,
          /백\s*퍼센트\s*(완치|치료|효과)/gi,
        ],
      },
      
      context: {
        windowSize: 80,
        
        // 가중 요소: 이런 표현이 함께 있으면 위반 가능성 높음
        aggravating: {
          keywords: ['보장', '약속', '확실', '틀림없', '반드시', '꼭', '무조건', '확정'],
          patterns: [/(보장|약속)\s*(합니다|드립니다|해드립니다)/gi],
          weight: 0.3,
        },
        
        // 감경 요소: 이런 표현이 있으면 위반 아닐 가능성
        mitigating: {
          keywords: [
            '않습니다', '아닙니다', '아니며', '없습니다',
            '개인차', '결과는 다를 수', '차이가 있을 수',
            '목표로', '위해 노력', '최선을 다해'
          ],
          patterns: [
            /(보장|약속)\s*(하지|드리지)\s*(않|안)/gi,
            /개인\s*(마다|에 따라|별로)\s*(차이|다를)/gi,
            /결과는?\s*(개인|사람)\s*(마다|에 따라)/gi,
          ],
          weight: -0.5,
        },
        
        // 필수 조건: 의료 맥락이어야 함
        required: {
          keywords: ['치료', '시술', '수술', '진료', '효과', '완치', '개선', '호전', '병원', '의원', '클리닉'],
          logic: 'OR',
        },
        
        // 제외 패턴: 이 경우는 무조건 제외
        exclusions: {
          patterns: [
            /100%\s*(완치|치료).*보장.*않/gi,  // "100% 완치를 보장하지 않습니다"
            /개인차가?\s*있/gi,
          ],
          contexts: [
            '개인차가 있을 수 있습니다',
            '결과는 개인에 따라 다를 수 있습니다',
            '의료 결과를 보장하지 않습니다',
          ],
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
      article: '치료 효과를 보장하는 등 소비자를 현혹할 우려가 있는 내용의 광고',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금 (제87조)',
      caseExamples: [
        '2023년 A성형외과: "100% 만족 보장" 광고로 업무정지 1개월',
      ],
    },
    
    severity: 'critical',
    riskScore: 90,
    
    recommendation: {
      action: '해당 표현을 삭제하고 면책 문구를 추가하세요.',
      example: {
        bad: '100% 완치를 보장합니다',
        good: '최선의 치료를 위해 노력합니다. 결과는 개인에 따라 다를 수 있습니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      prompt: `다음 텍스트가 의료법상 "치료효과 보장" 위반인지 판단해주세요.
      
위반 기준: 치료 효과를 100% 또는 확실하게 보장하는 표현
단, 면책조항이 있거나 "보장하지 않습니다" 같은 부정 표현이 있으면 위반이 아닙니다.

텍스트: {text}
주변 문맥: {context}

판단 결과를 JSON으로 응답하세요:
{
  "isViolation": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거",
  "violatingPart": "위반 부분 (있는 경우)"
}`,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['치료효과', '보장', '100%', 'critical'],
    },
  },
  
  {
    id: 'MED-EFF-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '완치/완벽 보장 표현',
    description: '완치나 완벽한 결과를 보장하는 표현',
    
    detection: {
      triggers: {
        keywords: ['완치 보장', '완벽한 결과', '확실한 효과', '반드시 낫', '꼭 낫', '무조건 효과'],
        patterns: [
          /완치\s*(를)?\s*(보장|약속|확실)/gi,
          /(반드시|꼭|무조건)\s*(낫|치료|완치|효과)/gi,
          /확실\s*(한|히)\s*(효과|치료|완치)/gi,
        ],
      },
      
      context: {
        windowSize: 80,
        
        aggravating: {
          keywords: ['보장합니다', '약속합니다', '드립니다', '해드립니다', '책임집니다'],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '않습니다', '아닙니다', '없습니다',
            '목표', '위해', '노력', '최선',
            '개인차', '다를 수 있'
          ],
          patterns: [
            /(보장|약속).*않/gi,
            /개인.*차이/gi,
          ],
          weight: -0.5,
        },
        
        required: {
          keywords: ['치료', '시술', '수술', '효과', '결과', '병원', '의원'],
          logic: 'OR',
        },
        
        exclusions: {
          contexts: [
            '완치를 보장하지 않습니다',
            '개인에 따라 결과가 다를 수 있습니다',
          ],
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
      action: '보장/확실 표현을 삭제하고, 노력/최선 표현으로 수정하세요.',
      example: {
        bad: '완치를 보장합니다',
        good: '완치를 목표로 최선의 치료를 제공합니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['완치', '보장', 'critical'],
    },
  },
  
  {
    id: 'MED-EFF-003',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'effect_guarantee',
    name: '성공률/치료율 수치 표현',
    description: '구체적 수치로 성공률이나 치료율을 제시하는 표현',
    
    detection: {
      triggers: {
        keywords: ['성공률', '치료율', '완치율', '만족도', '재발률'],
        patterns: [
          /\d{2,3}\s*%\s*(성공|치료|완치|만족|개선)/gi,
          /(성공|치료|완치|만족)\s*(율|률)\s*\d{2,3}\s*%/gi,
          /(성공|치료|완치)\s*(율|률)이?\s*(높|최고)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['달성', '기록', '자랑', '높은', '최고', '업계 최고'],
          patterns: [/\d{2,3}\s*%\s*(이상|달성|기록)/gi],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            '논문', '연구', '학회', '발표', '통계', 'SCI',
            '출처', '근거', '데이터', '임상',
            '개인차', '다를 수 있'
          ],
          patterns: [
            /\(출처:.*\)/gi,
            /\[참고:.*\]/gi,
            /논문\s*(발표|게재)/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['치료', '시술', '수술', '환자', '케이스'],
          logic: 'OR',
        },
        
        exclusions: {
          contexts: [
            '객관적 근거에 따른',
            '학술 논문에 발표된',
            '임상 연구 결과',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,  // 근거 있으면 가능하므로 조금 낮춤
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      article: '객관적으로 인정되지 아니하거나 근거가 없는 내용의 광고는 금지',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '성공률 수치는 객관적 근거(논문, 학회 발표 등)가 있는 경우에만 사용하고, 출처를 명시하세요.',
      example: {
        bad: '성공률 98%!',
        good: '본원의 치료 결과는 2023년 대한OO학회에 발표되었습니다. (개인차가 있을 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      prompt: `다음 텍스트에서 성공률/치료율 수치 표현이 의료법 위반인지 판단해주세요.

판단 기준:
1. 객관적 근거(논문, 학회 발표, 임상 연구 등)가 명시되어 있으면 위반 아님
2. 근거 없이 수치만 제시하면 위반
3. "개인차가 있을 수 있습니다" 같은 면책조항이 있어도 근거 없으면 위반

텍스트: {text}
주변 문맥: {context}

JSON으로 응답:
{
  "isViolation": boolean,
  "hasObjectiveEvidence": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거"
}`,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['성공률', '치료율', '수치', 'warning'],
    },
  },

  // ============================================
  // 카테고리 2: 전후사진 (시행령 제23조)
  // ============================================
  {
    id: 'MED-BA-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'before_after',
    name: '치료 전후 사진 게시',
    description: '환자의 치료 전후 비교 사진을 게시한 경우',
    
    detection: {
      triggers: {
        keywords: [
          '전후사진', '전후 사진', '비포애프터', 'before after', 
          'before&after', 'before and after', '시술전후', '시술 전후',
          '전후비교', '변화사진', '결과사진'
        ],
        patterns: [
          /전\s*후\s*사진/gi,
          /before\s*(&|and|\/|,)?\s*after/gi,
          /시술\s*(전|후)\s*(사진|이미지|결과)/gi,
          /비포\s*(&|앤|,)?\s*애프터/gi,
          /(치료|시술|수술)\s*(전|후)\s*모습/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: [
            '실제 환자', '실제 사례', '생생한', '리얼',
            '놀라운 변화', '확인하세요', '비교해보세요',
            '직접 보세요', '증거'
          ],
          patterns: [
            /실제\s*(환자|사례|케이스)/gi,
            /(놀라운|놀랄만한|극적인)\s*(변화|결과)/gi,
          ],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '동의', '동의서', '서면 동의', '환자 동의',
            '개인정보', '비식별', '모자이크',
            '참고용', '예시', '일러스트', '모델'
          ],
          patterns: [
            /환자\s*(의)?\s*(서면)?\s*동의/gi,
            /개인정보\s*(보호|처리)/gi,
            /모델\s*(사진|이미지)/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['사진', '이미지', '결과', '변화', '비교', '전', '후'],
          logic: 'OR',
        },
        
        exclusions: {
          contexts: [
            '환자의 서면 동의를 받았습니다',
            '모델 사진입니다',
            '일러스트 이미지입니다',
            '실제 환자가 아닙니다',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.40,
        dismiss: 0.25,
      },
    },
    
    legal: {
      basis: '의료법 시행령 제23조 제1항',
      article: '치료 전·후의 사진 등을 광고에 사용하는 경우 환자의 서면 동의 필요',
      penalty: '300만원 이하의 과태료',
      caseExamples: [
        '2022년 B피부과: 환자 동의 없이 전후사진 게시로 과태료 200만원',
      ],
    },
    
    severity: 'critical',
    riskScore: 80,
    
    recommendation: {
      action: '전후사진 사용 시 반드시 환자의 서면 동의를 받고, 동의 사실을 명시하세요. 또는 모델/일러스트 이미지로 대체하세요.',
      example: {
        bad: '시술 전후 사진을 확인하세요!',
        good: '* 본 이미지는 환자의 서면 동의를 받아 게시되었습니다. 결과는 개인에 따라 다를 수 있습니다.',
      },
    },
    
    aiVerification: {
      enabled: true,
      prompt: `다음 텍스트가 의료법상 "전후사진 게시" 위반인지 판단해주세요.

위반 기준: 
1. 치료 전후 사진을 환자 동의 없이 게시
2. 동의를 받았다는 명시가 없으면 위반으로 추정

예외 (위반 아님):
1. "환자 동의를 받았습니다" 명시
2. "모델 사진", "일러스트" 명시
3. 전후사진이 아닌 일반 시술 설명 이미지

텍스트: {text}
주변 문맥: {context}

JSON으로 응답:
{
  "isViolation": boolean,
  "hasPatientConsent": boolean,
  "isModelImage": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거"
}`,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['전후사진', '비포애프터', 'critical'],
    },
  },

  // ============================================
  // 카테고리 3: 과대/허위 광고 (제56조 제2항 제1호, 제2호)
  // ============================================
  {
    id: 'MED-EX-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '객관적 근거 없는 최상급 표현',
    description: '최초, 유일, 최고, 1위 등 객관적 근거 없는 최상급 표현',
    
    detection: {
      triggers: {
        // "최상의"는 우려 수준이므로 별도 처리, 명확한 1위/최고 주장만 트리거
        keywords: [
          '국내 최초', '세계 최초', '업계 최초', '국내 유일', '세계 유일',
          '업계 1위', '국내 1위', '세계 1위', '넘버원', 'No.1', 'no.1',
          '최고의 병원', '최고의 의원', '독보적', '압도적', '유일무이'
        ],
        patterns: [
          /(국내|세계|아시아|업계)\s*(최초|유일|1위)/gi,
          /no\s*\.?\s*1/gi,
          /(독보적|압도적|유일무이)\s*(인|한)?/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['자부합니다', '자신합니다', '인정받은', '검증된', '확실'],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '인증', '수상', '선정', '평가', '조사',
            '협회', '학회', '기관', '정부',
            '특허', '논문', '발표',
            '년 기준', '조사 결과'
          ],
          patterns: [
            /\d{4}년\s*(기준|조사)/gi,
            /\(.*인증.*\)/gi,
            /\[.*수상.*\]/gi,
            /특허\s*(번호|등록)/gi,
          ],
          weight: -0.45,
        },
        
        required: {
          keywords: ['병원', '의원', '클리닉', '치료', '시술', '의료', '진료'],
          logic: 'OR',
        },
        
        exclusions: {
          contexts: [
            '공인 기관 인증',
            '특허 등록',
            '학회 인정',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.75,  // 상향 - 더 명확한 경우만 위반
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제1호, 제2호',
      article: '거짓이거나 과장된 내용의 광고, 객관적으로 인정되지 않는 내용의 광고 금지',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',  // critical → warning (우려 수준으로 하향)
    riskScore: 70,  // 85 → 70
    
    recommendation: {
      action: '최상급 표현은 객관적 근거(인증, 특허, 수상 등)가 있는 경우에만 사용하고, 근거를 명시하세요.',
      example: {
        bad: '국내 최고의 성형외과',
        good: '2023년 OO협회 선정 우수 의료기관 (환자 만족도 부문)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['최상급', '과대광고', 'critical'],
    },
  },
  
  {
    id: 'MED-EX-002',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'exaggeration',
    name: '신기술/혁신 과장 표현',
    description: '검증되지 않은 기술을 혁신적, 획기적 등으로 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '획기적인', '혁신적인', '혁명적인', '기적의', '꿈의',
          '신기술', '첨단 기술', '최첨단', '미래 기술',
          '마법같은', '놀라운 효과', '경이로운'
        ],
        patterns: [
          /(획기적|혁신적|혁명적)\s*(인|한)?\s*(기술|치료|시술|방법)/gi,
          /(기적|꿈)\s*(의|같은)\s*(치료|시술|효과)/gi,
          /(마법|마술)\s*(같은|처럼)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['처음', '세계 최초', '국내 도입', '단독', '독점'],
          weight: 0.25,
        },
        
        mitigating: {
          keywords: [
            'FDA', '식약처', '인증', '승인', '허가',
            '논문', '학회', '임상시험', '연구결과',
            '특허'
          ],
          patterns: [
            /(FDA|식약처)\s*(인증|승인|허가)/gi,
            /임상\s*(시험|연구|결과)/gi,
          ],
          weight: -0.4,
        },
        
        required: {
          keywords: ['기술', '치료', '시술', '장비', '기기', '방법'],
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
    riskScore: 70,
    
    recommendation: {
      action: '신기술 광고 시 FDA/식약처 승인, 학회 발표 등 객관적 근거를 명시하세요.',
      example: {
        bad: '획기적인 무통 시술!',
        good: 'FDA 승인 OO 레이저 시술 (식약처 의료기기 인증)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['신기술', '과장', 'warning'],
    },
  },

  // ============================================
  // 카테고리 4: 환자 후기 (제56조 제2항 제3호)
  // ============================================
  {
    id: 'MED-TM-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'testimonial',
    name: '치료 효과 체험 후기',
    description: '환자의 치료 효과에 대한 경험담/후기를 광고에 활용',
    
    detection: {
      triggers: {
        keywords: [
          '환자 후기', '치료 후기', '시술 후기', '수술 후기',
          '생생 후기', '리얼 후기', '솔직 후기', '체험 후기',
          '치료 경험', '시술 경험', '나았어요', '완치됐어요',
          '효과봤어요', '좋아졌어요', '없어졌어요'
        ],
        patterns: [
          /(환자|치료|시술|수술)\s*후기/gi,
          /(생생|리얼|솔직|체험)\s*후기/gi,
          /제가\s*직접\s*(경험|체험)/gi,
          /(나았|완치됐|좋아졌|효과봤)/gi,
        ],
      },
      
      context: {
        windowSize: 150,
        
        aggravating: {
          keywords: [
            '실제 환자', '진짜 후기', '직접 경험',
            '추천합니다', '추천해요', '강추',
            '대만족', '인생병원', '신세계'
          ],
          patterns: [
            /실제\s*(환자|분)\s*(의|이|가)/gi,
            /(강력|적극)\s*추천/gi,
          ],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '개인차', '결과는 다를 수', '광고', '협찬', 
            '원고료', '체험단', '제공받',
            '참고용', '개인 의견'
          ],
          patterns: [
            /#광고|#협찬|#체험단/gi,
            /광고\s*(입니다|임)/gi,
            /개인\s*(의견|경험|차이)/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['치료', '시술', '수술', '병원', '의원', '효과', '결과'],
          logic: 'OR',
        },
        
        exclusions: {
          contexts: [
            '개인의 경험이며 결과는 다를 수 있습니다',
            '광고입니다',
            '체험단으로 참여했습니다',
          ],
        },
      },
      
      thresholds: {
        confirmViolation: 0.70,
        requiresAI: 0.45,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '의료법 제56조 제2항 제3호',
      article: '신문, 방송, 잡지 등을 이용하여 기사나 전문가의 의견 형태로 광고하는 경우',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '환자 후기 게시 시 "광고" 표시와 함께 "개인차가 있을 수 있습니다" 면책 문구를 반드시 포함하세요.',
      example: {
        bad: '실제 환자 생생 후기! 완전 나았어요~',
        good: '[광고] 환자 인터뷰 (본 내용은 개인의 경험이며, 치료 결과는 개인에 따라 다를 수 있습니다)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['후기', '체험담', 'warning'],
    },
  },

  // ============================================
  // 카테고리 5: 유명인 추천 (제56조 제2항 제5호)
  // ============================================
  {
    id: 'MED-CL-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'celebrity',
    name: '유명인/연예인 추천 광고',
    description: '유명인이나 연예인을 이용한 추천/보증 광고',
    
    detection: {
      triggers: {
        keywords: [
          '연예인', '셀럽', '인플루언서', '유명인',
          '00 추천', '스타 병원', '셀럽 시술',
          '가 다니는', '이 선택한', '도 다니는'
        ],
        patterns: [
          /(연예인|셀럽|스타|유명인)\s*(이|가|도|들이)\s*(선택|추천|방문|다니)/gi,
          /[가-힣]{2,4}\s*(씨|님|배우|가수|아나운서)\s*(가|이|도)\s*(선택|추천|다니)/gi,
          /(이|가)\s*추천\s*(하는|한)\s*(병원|의원|클리닉)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: [
            '단골', '전담', '주치의', '애용',
            '가 밝힌', '인터뷰', '고백'
          ],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '허위', '거짓', '사칭', '아닙니다',
            '관련 없', '무관', '확인되지 않은'
          ],
          weight: -0.5,
        },
        
        required: {
          keywords: ['병원', '의원', '클리닉', '치료', '시술', '의료'],
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
      basis: '의료법 제56조 제2항 제5호',
      article: '유명인이나 전문가를 이용하여 추천, 보증하는 내용의 광고 금지',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 80,
    
    recommendation: {
      action: '유명인/연예인을 이용한 추천, 보증 광고를 삭제하세요.',
      example: {
        bad: '유명 배우 OOO도 다니는 병원',
        good: '(유명인 광고 없이 의료 서비스 내용만 안내)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['유명인', '연예인', '추천', 'critical'],
    },
  },

  // ============================================
  // 카테고리 6: 비교 광고 (제56조 제2항 제5호)
  // ============================================
  {
    id: 'MED-CP-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'comparison',
    name: '타 의료기관 비교/비방 광고',
    description: '다른 의료기관과 비교하거나 비방하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '타병원', '다른병원', '타 병원', '다른 병원',
          '경쟁 병원', '00보다', '00과 비교',
          '여기는 안그래요', '다르게'
        ],
        patterns: [
          /(타|다른|경쟁)\s*(병원|의원|클리닉)/gi,
          /[가-힣]+\s*(병원|의원)\s*(보다|과|와)\s*(비교|다르)/gi,
          /(우리|저희)\s*(는|만)\s*(다르|다릅니다)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: [
            '낫다', '좋다', '우수하다', '뛰어나다',
            '저렴하다', '빠르다', '안전하다',
            '실력', '기술력', '경험'
          ],
          patterns: [
            /보다\s*(더)?\s*(낫|좋|우수|뛰어|저렴|빠르|안전)/gi,
          ],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: [
            '일반적으로', '평균적으로', '업계 평균',
            '비교 아님', '특정 병원 아님'
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['병원', '의원', '클리닉', '의료', '치료', '시술'],
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
      article: '다른 의료기관의 기능이나 시설 등을 비방하는 내용의 광고 금지',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 70,
    
    recommendation: {
      action: '타 의료기관과의 비교/비방 표현을 삭제하고, 자사의 장점만 안내하세요.',
      example: {
        bad: '타병원보다 더 저렴합니다',
        good: '합리적인 가격으로 양질의 의료서비스를 제공합니다',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['비교', '비방', 'warning'],
    },
  },

  // ============================================
  // 카테고리 7: 가격/할인 광고 (의료광고 심의기준)
  // ============================================
  {
    id: 'MED-PR-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'price_discount',
    name: '과도한 할인/가격 광고',
    description: '과도한 할인율이나 가격 경쟁을 유도하는 광고',
    
    detection: {
      triggers: {
        keywords: [
          '50% 할인', '70% 할인', '80% 할인', '90% 할인',
          '반값', '반가격', '파격 할인', '최저가', '무료',
          '공짜', '특가', '땡처리', '가격 파괴'
        ],
        patterns: [
          /[5-9]0\s*%\s*(이상)?\s*할인/gi,
          /(반값|반가격|파격|최저가|가격\s*파괴)/gi,
          /(무료|공짜)\s*(시술|치료|상담)/gi,
          /\d+만?\s*원\s*(할인|깎|인하)/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: [
            '선착순', '한정', '마감 임박', '오늘만',
            '이번 달만', '특별 기회', '놓치면 후회'
          ],
          patterns: [
            /(선착순|한정)\s*\d+\s*(명|분)/gi,
            /(오늘|이번\s*주|이번\s*달)\s*만/gi,
          ],
          weight: 0.3,
        },
        
        mitigating: {
          keywords: [
            '건강보험', '의료보험', '보험 적용',
            '실손', '급여', '비급여 안내'
          ],
          patterns: [
            /건강\s*보험\s*(적용|가능)/gi,
          ],
          weight: -0.3,
        },
        
        required: {
          keywords: ['시술', '치료', '수술', '상담', '검진', '병원', '의원'],
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
      basis: '의료광고 심의기준 제4조',
      article: '의료의 신뢰성을 해치는 과도한 가격 경쟁 유도 광고 금지',
      penalty: '심의 부적합 판정, 시정명령',
    },
    
    severity: 'warning',
    riskScore: 60,
    
    recommendation: {
      action: '과도한 할인 표현을 자제하고, 비용에 대한 정확한 정보를 제공하세요.',
      example: {
        bad: '70% 파격 할인! 오늘만!',
        good: '비용 안내: 시술별 비용은 상담 후 안내드립니다. (비급여 항목)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['할인', '가격', '무료', 'warning'],
    },
  },

  // ============================================
  // 카테고리 8: 미승인 시술/치료 (의료법 제27조)
  // ============================================
  {
    id: 'MED-UN-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'unapproved',
    name: '미승인/불법 시술 광고',
    description: '식약처 미승인 시술이나 검증되지 않은 치료법 광고',
    
    detection: {
      triggers: {
        keywords: [
          '줄기세포 시술', '줄기세포 치료', '줄기세포 주사',
          'NK세포', '면역세포 치료', '면역세포 주사',
          '해외 직수입', '국내 미승인', '프리미엄 수입',
          '자가 혈액', 'PRP 시술'
        ],
        patterns: [
          /(줄기|면역|NK)\s*세포\s*(시술|치료|주사|요법)/gi,
          /미\s*승인\s*(시술|치료|의료기기)/gi,
          /해외\s*(직수입|도입)\s*(시술|치료|장비)/gi,
        ],
      },
      
      context: {
        windowSize: 120,
        
        aggravating: {
          keywords: [
            '기적', '놀라운', '혁명적',
            '해외에서만', '국내 최초 도입', '비밀'
          ],
          weight: 0.35,
        },
        
        mitigating: {
          keywords: [
            '식약처 승인', 'FDA 승인', '허가', '인증',
            '임상시험', '연구 중', '연구 목적'
          ],
          patterns: [
            /(식약처|FDA)\s*(승인|허가|인증)/gi,
            /임상\s*(시험|연구)\s*(진행|참여)/gi,
          ],
          weight: -0.5,
        },
        
        required: {
          keywords: ['시술', '치료', '주사', '요법', '병원', '의원'],
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
      basis: '의료법 제27조, 약사법 제68조',
      article: '무면허 의료행위 및 미승인 의료기기 사용 금지',
      penalty: '5년 이하의 징역 또는 5천만원 이하의 벌금',
    },
    
    severity: 'critical',
    riskScore: 95,
    
    recommendation: {
      action: '미승인 시술 광고를 즉시 삭제하세요. 식약처/FDA 승인 여부를 반드시 확인하세요.',
      example: {
        bad: '줄기세포 주사로 관절 완치!',
        good: '(미승인 시술 광고 불가 - 승인된 치료법만 안내)',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'claude', // 법적 판단이 복잡하므로 Claude 사용
    },
    
    metadata: {
      isActive: true,
      priority: 5,  // 가장 높은 우선순위
      tags: ['미승인', '불법', '줄기세포', 'critical'],
    },
  },

  // ============================================
  // 카테고리 9: 자격/경력 과장 (제56조 제2항 제4호)
  // ============================================
  {
    id: 'MED-QU-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'qualification',
    name: '의료인 자격/경력 과장',
    description: '의료인의 자격이나 경력을 과장하는 표현',
    
    detection: {
      triggers: {
        keywords: [
          '명의', '국내 최고 전문의', '대한민국 대표',
          '신의 손', '레전드', '대가', '거장',
          '카리스마 원장', '실력파', '달인'
        ],
        patterns: [
          /(국내|대한민국|아시아)\s*(최고|대표|유일)\s*(전문의|의사|원장)/gi,
          /(명의|대가|거장|레전드|달인)/gi,
          /신\s*(의|에)\s*손/gi,
        ],
      },
      
      context: {
        windowSize: 100,
        
        aggravating: {
          keywords: ['소문난', '유명한', '알아주는', '인정받는'],
          weight: 0.2,
        },
        
        mitigating: {
          keywords: [
            '전문의 자격', '수련', '경력',
            '학회', '논문', '발표', '교수',
            '년 경력', '건 이상'
          ],
          patterns: [
            /\d+\s*년\s*(경력|경험)/gi,
            /\d+\s*(건|케이스|례)\s*(이상)?\s*(수술|시술)/gi,
            /[가-힣]+\s*학회\s*(정회원|이사|회장)/gi,
          ],
          weight: -0.35,
        },
        
        required: {
          keywords: ['전문의', '의사', '원장', '선생님', '병원', '의원'],
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
      basis: '의료법 제56조 제2항 제4호',
      article: '의료인의 경력, 학력 등을 과장하는 내용의 광고 금지',
      penalty: '1년 이하의 징역 또는 1천만원 이하의 벌금',
    },
    
    severity: 'warning',
    riskScore: 65,
    
    recommendation: {
      action: '과장된 수식어를 삭제하고, 객관적인 자격/경력 정보만 안내하세요.',
      example: {
        bad: '신의 손을 가진 명의',
        good: 'OO과 전문의 / OO대학교 의과대학 교수 / 대한OO학회 정회원',
      },
    },
    
    aiVerification: {
      enabled: true,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['자격', '경력', '과장', 'warning'],
    },
  },

  // ============================================
  // 카테고리 10: 광고 미표기 (표시광고법)
  // ============================================
  {
    id: 'MED-AD-001',
    version: '1.0.0',
    category: 'medical_ad',
    subcategory: 'ad_disclosure',
    name: '광고 표기 누락 (협찬/체험단)',
    description: '협찬이나 체험단 콘텐츠에 광고 표기를 하지 않은 경우',
    
    detection: {
      triggers: {
        keywords: [
          '체험단', '협찬', '서포터즈', '원고료',
          '제공받았', '지원받았', '초대받았',
          '무료로 받', '제품 협찬'
        ],
        patterns: [
          /(체험단|서포터즈)\s*(으로|활동)/gi,
          /(제공|지원|협찬)\s*(받|을)/gi,
          /무료\s*(로)?\s*(제공|초대|시술)/gi,
        ],
      },
      
      context: {
        windowSize: 200,  // 광고 표기는 전체 텍스트 확인 필요
        
        aggravating: {
          keywords: ['솔직', '생생', '리얼', '직접 경험'],
          weight: 0.15,  // 가중치 낮음 (광고 표기 여부가 핵심)
        },
        
        // 핵심: 광고 표기 여부 확인
        mitigating: {
          keywords: [
            '#광고', '광고입니다', '광고임', '#ad',
            '유료광고', '광고 포함', '협찬 광고',
            '이 글은 광고', '광고 게시물'
          ],
          patterns: [
            /#\s*(광고|ad|협찬|sponsored)/gi,
            /광고\s*(입니다|임|포함)/gi,
            /\[광고\]|\(광고\)/gi,
          ],
          weight: -0.8,  // 광고 표기 있으면 크게 감경
        },
        
        required: {
          keywords: ['병원', '의원', '클리닉', '치료', '시술', '의료'],
          logic: 'OR',
        },
      },
      
      thresholds: {
        confirmViolation: 0.65,
        requiresAI: 0.40,
        dismiss: 0.30,
      },
    },
    
    legal: {
      basis: '표시광고법 제3조 (부당한 표시·광고 행위의 금지)',
      article: '광고임을 명확하게 표시하지 않은 경우 기만적 광고에 해당',
      penalty: '과태료 500만원 이하, 시정명령',
    },
    
    severity: 'warning',
    riskScore: 55,
    
    recommendation: {
      action: '협찬/체험단 콘텐츠에는 반드시 "#광고" 또는 "[광고]"를 명확히 표기하세요.',
      example: {
        bad: '체험단으로 시술받았어요~ 솔직후기!',
        good: '[광고] 체험단으로 참여한 솔직 후기입니다. (시술 협찬)',
      },
    },
    
    aiVerification: {
      enabled: true,
      prompt: `다음 텍스트에서 광고/협찬/체험단 콘텐츠인지, 그리고 광고 표기가 되어있는지 확인해주세요.

판단 기준:
1. 협찬, 체험단, 무료 제공 등의 표현이 있는가?
2. 있다면, "#광고", "[광고]", "광고입니다" 등 명확한 광고 표기가 있는가?
3. 광고 표기가 없으면 위반

텍스트: {text}
전체 문맥: {context}

JSON으로 응답:
{
  "isSponsoredContent": boolean,
  "hasAdDisclosure": boolean,
  "isViolation": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "판단 근거"
}`,
      provider: 'gemini',
    },
    
    metadata: {
      isActive: true,
      priority: 25,
      tags: ['광고표기', '협찬', '체험단', 'warning'],
    },
  },
];

module.exports = medicalAdRules;
