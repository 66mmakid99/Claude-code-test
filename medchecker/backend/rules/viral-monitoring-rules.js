/**
 * 바이럴 모니터링 규칙 정의
 * 
 * 목적: 대행사 성과 검증 및 리스크 관리
 * 
 * 핵심 기능:
 * 1. 대행사 보고서 검증 (게시물 존재 여부, 삭제 여부)
 * 2. 바이럴 품질 분석 (광고티, 자연스러움)
 * 3. 과잉 바이럴 탐지 (동일 커뮤니티 과다 게시)
 * 4. 경쟁사 바이럴 모니터링
 * 5. ROI 분석 (유입 추적)
 */

const viralMonitoringRules = [
  // ============================================
  // 카테고리 1: 게시물 검증 (Verification)
  // ============================================
  {
    id: 'VRL-VRF-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'verification',
    name: '게시물 존재 확인',
    description: '대행사 보고서에 명시된 게시물이 실제로 존재하는지 확인',
    
    checkType: 'url_exists',
    
    detection: {
      // URL 패턴 (네이버 블로그, 카페, 지식인 등)
      urlPatterns: [
        /blog\.naver\.com\/[a-zA-Z0-9_]+\/\d+/gi,
        /cafe\.naver\.com\/[a-zA-Z0-9_]+\/\d+/gi,
        /kin\.naver\.com\/qna\/detail\.nhn\?d1id=\d+/gi,
        /m\.blog\.naver\.com\/[a-zA-Z0-9_]+\/\d+/gi,
      ],
      
      // HTTP 응답 코드 체크
      successCodes: [200, 301, 302],
      failureCodes: [404, 410, 403],
      
      // 삭제된 게시물 패턴
      deletedPatterns: [
        /삭제된\s*(글|게시물|포스트)/gi,
        /존재하지\s*않는\s*(글|게시물)/gi,
        /비공개\s*(글|게시물|처리)/gi,
        /이웃공개\s*게시물/gi,
      ],
    },
    
    verification: {
      method: 'http_check',
      timeout: 10000,  // 10초
      retryCount: 2,
      
      // 결과 분류
      results: {
        exists: { status: 'verified', score: 100 },
        deleted: { status: 'deleted', score: 0, alert: true },
        private: { status: 'private', score: 50, warning: true },
        error: { status: 'error', score: -1, retry: true },
      },
    },
    
    alerting: {
      onDeleted: {
        severity: 'high',
        message: '대행사 보고서의 게시물이 삭제되었습니다',
        action: '대행사에 확인 요청 필요',
      },
      onPrivate: {
        severity: 'medium',
        message: '게시물이 비공개 처리되었습니다',
        action: '대행사에 공개 설정 요청',
      },
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['검증', '존재확인', 'critical'],
    },
  },

  {
    id: 'VRL-VRF-002',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'verification',
    name: '게시물 삭제 추적',
    description: '이전에 확인된 게시물이 삭제되었는지 정기적으로 추적',
    
    checkType: 'deletion_tracking',
    
    tracking: {
      // 추적 주기
      schedule: {
        frequency: 'daily',  // daily, weekly
        time: '09:00',
      },
      
      // 추적 기간
      duration: {
        minDays: 7,   // 최소 7일간 추적
        maxDays: 90,  // 최대 90일간 추적
      },
      
      // 상태 변화 감지
      statusChanges: {
        'exists_to_deleted': { severity: 'high', alert: true },
        'exists_to_private': { severity: 'medium', alert: true },
        'private_to_exists': { severity: 'info', alert: false },
      },
    },
    
    reporting: {
      // 삭제율 계산
      deletionRate: {
        threshold: 0.1,  // 10% 이상 삭제시 경고
        period: 'monthly',
      },
      
      // 리포트 포함 정보
      includeInReport: [
        'totalPosts',
        'deletedPosts',
        'deletionRate',
        'deletedUrls',
        'deletionTimeline',
      ],
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['추적', '삭제', 'monitoring'],
    },
  },

  {
    id: 'VRL-VRF-003',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'verification',
    name: '보고서 메트릭 검증',
    description: '대행사 보고서의 조회수, 댓글수 등 메트릭이 실제와 일치하는지 검증',
    
    checkType: 'metric_verification',
    
    metrics: {
      // 검증할 메트릭 목록
      verifiable: [
        { name: 'viewCount', tolerance: 0.1 },     // 조회수 (10% 오차 허용)
        { name: 'commentCount', tolerance: 0.05 }, // 댓글수 (5% 오차 허용)
        { name: 'likeCount', tolerance: 0.1 },     // 좋아요수
        { name: 'shareCount', tolerance: 0.2 },    // 공유수
      ],
      
      // 의심 패턴
      suspiciousPatterns: {
        // 조회수 대비 댓글이 너무 많음 (구매 의심)
        highCommentRatio: {
          formula: 'commentCount / viewCount > 0.1',
          severity: 'warning',
          message: '조회수 대비 댓글수가 비정상적으로 높습니다 (댓글 구매 의심)',
        },
        // 조회수가 급격히 증가 (어뷰징 의심)
        spikeDetection: {
          formula: 'dailyViewIncrease > avgDailyView * 5',
          severity: 'warning',
          message: '조회수가 비정상적으로 급증했습니다 (어뷰징 의심)',
        },
      },
    },
    
    alerting: {
      onMismatch: {
        severity: 'medium',
        message: '보고서 메트릭과 실제 메트릭이 일치하지 않습니다',
        action: '대행사에 설명 요청',
      },
      onSuspicious: {
        severity: 'high',
        message: '의심스러운 메트릭 패턴이 감지되었습니다',
        action: '상세 분석 필요',
      },
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['메트릭', '검증', 'verification'],
    },
  },

  // ============================================
  // 카테고리 2: 품질 분석 (Quality)
  // ============================================
  {
    id: 'VRL-QLT-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'quality',
    name: '광고티 분석',
    description: '바이럴 콘텐츠가 너무 광고같은지 분석 (적발 리스크)',
    
    checkType: 'content_analysis',
    
    detection: {
      // 광고티 나는 패턴
      adLikePatterns: {
        // 과도한 키워드 반복
        keywordStuffing: {
          patterns: [
            /(.{2,10})\s*\1{2,}/gi,  // 같은 단어 3회 이상 반복
          ],
          weight: 0.3,
        },
        
        // 전형적인 광고 문구
        adPhrases: {
          keywords: [
            '강력 추천', '적극 추천', '완전 추천', '인생 병원',
            '대박', '미쳤다', '레알', '찐', '갓',
            '꼭 가보세요', '무조건 가세요', '여기밖에 없어요'
          ],
          weight: 0.25,
        },
        
        // 병원 정보 과다 노출
        excessiveInfo: {
          patterns: [
            /주소\s*[:：]?\s*[가-힣]+\s*(시|도|구|동|로|길)/gi,
            /전화\s*[:：]?\s*\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}/gi,
            /예약\s*[:：]?\s*(전화|문의|상담)/gi,
          ],
          weight: 0.2,
        },
        
        // 불자연스러운 칭찬
        unnaturalPraise: {
          keywords: [
            '완전 만족', '200% 만족', '기대 이상',
            '역대급', '인생 최고', '완벽했어요'
          ],
          weight: 0.25,
        },
      },
      
      // 점수 계산
      scoring: {
        thresholds: {
          natural: { max: 0.3, label: '자연스러움' },
          moderate: { max: 0.6, label: '보통' },
          adLike: { max: 0.8, label: '광고티 남' },
          obvious: { max: 1.0, label: '노골적 광고' },
        },
      },
    },
    
    risks: {
      // 적발 리스크 레벨
      levels: {
        natural: { risk: 'low', action: '유지' },
        moderate: { risk: 'medium', action: '모니터링' },
        adLike: { risk: 'high', action: '수정 권고' },
        obvious: { risk: 'critical', action: '삭제 권고' },
      },
    },
    
    recommendation: {
      improve: [
        '개인적인 경험담 위주로 작성',
        '구체적인 시술 과정/느낌 묘사',
        '단점이나 아쉬운 점도 함께 언급',
        '병원 정보는 자연스럽게 한 번만',
        '과도한 칭찬 표현 자제',
      ],
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['품질', '광고티', 'quality'],
    },
  },

  {
    id: 'VRL-QLT-002',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'quality',
    name: '자연스러움 점수',
    description: '바이럴 콘텐츠가 일반 후기처럼 자연스러운지 평가',
    
    checkType: 'naturalness_score',
    
    detection: {
      // 자연스러운 요소
      naturalElements: {
        // 개인적 스토리
        personalStory: {
          patterns: [
            /제가\s*(처음|원래|평소)/gi,
            /솔직히\s*(말하면|말해서)/gi,
            /개인적으로/gi,
          ],
          weight: 0.2,
        },
        
        // 구체적 경험
        specificExperience: {
          patterns: [
            /\d+\s*(분|시간|일|주|개월)\s*(걸|지나|후)/gi,
            /(아프|따가|불편|부었)/gi,
            /(상담|진료|시술)\s*(시간|과정)/gi,
          ],
          weight: 0.25,
        },
        
        // 균형잡힌 평가 (장단점)
        balancedReview: {
          keywords: [
            '아쉬운 점', '단점', '불편한 점', '개선',
            '그래도', '다만', '하지만'
          ],
          weight: 0.3,
        },
        
        // 일상적 표현
        casualTone: {
          patterns: [
            /ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ/gi,
            /~요|~용|~당|~랑/gi,
          ],
          weight: 0.15,
        },
        
        // 시간 경과 후기
        followUp: {
          patterns: [
            /(\d+)\s*(일|주|개월)\s*(차|후)\s*후기/gi,
            /경과\s*(보고|후기)/gi,
          ],
          weight: 0.1,
        },
      },
      
      scoring: {
        // 자연스러움 점수 (0-100)
        formula: 'sum(matchedWeights) * 100',
        thresholds: {
          excellent: { min: 80, label: '매우 자연스러움' },
          good: { min: 60, label: '자연스러움' },
          average: { min: 40, label: '보통' },
          poor: { min: 20, label: '부자연스러움' },
          artificial: { min: 0, label: '인위적' },
        },
      },
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['품질', '자연스러움', 'quality'],
    },
  },

  {
    id: 'VRL-QLT-003',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'quality',
    name: '콘텐츠 다양성 분석',
    description: '바이럴 콘텐츠가 다양한지, 복붙 수준인지 분석',
    
    checkType: 'diversity_analysis',
    
    detection: {
      // 유사도 체크
      similarity: {
        // 텍스트 유사도 임계값
        thresholds: {
          duplicate: 0.95,    // 95% 이상: 복사본
          similar: 0.7,       // 70% 이상: 유사
          related: 0.4,       // 40% 이상: 관련
          unique: 0.0,        // 40% 미만: 고유
        },
        
        // 비교 대상
        compareWith: [
          'same_hospital_posts',   // 같은 병원 다른 게시물
          'same_author_posts',     // 같은 작성자 다른 게시물
          'template_database',     // 알려진 템플릿 DB
        ],
      },
      
      // 템플릿 패턴 감지
      templatePatterns: {
        // 구조적 템플릿
        structuralTemplates: [
          /^안녕하세요.*후기.*남겨요/gi,
          /^저도.*받았는데요/gi,
          /마지막으로.*추천.*드려요$/gi,
        ],
        
        // 복사된 문구
        copiedPhrases: {
          minLength: 30,    // 30자 이상
          minOccurrence: 3, // 3회 이상 발견시 템플릿으로 간주
        },
      },
    },
    
    alerting: {
      onDuplicate: {
        severity: 'high',
        message: '동일한 콘텐츠가 여러 번 게시되었습니다',
        action: '대행사에 고유 콘텐츠 작성 요청',
      },
      onTemplate: {
        severity: 'medium',
        message: '템플릿 기반 콘텐츠로 의심됩니다',
        action: '콘텐츠 다양화 요청',
      },
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['품질', '다양성', '중복', 'quality'],
    },
  },

  // ============================================
  // 카테고리 3: 과잉 탐지 (Quantity)
  // ============================================
  {
    id: 'VRL-QTY-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'quantity',
    name: '과잉 바이럴 탐지',
    description: '동일 커뮤니티에 과도한 게시물이 있는지 탐지',
    
    checkType: 'overflow_detection',
    
    detection: {
      // 플랫폼별 임계값
      platformLimits: {
        'blog.naver.com': {
          daily: 3,     // 일 3개 이상이면 과잉
          weekly: 10,   // 주 10개 이상이면 과잉
          monthly: 30,  // 월 30개 이상이면 과잉
        },
        'cafe.naver.com': {
          daily: 2,
          weekly: 7,
          monthly: 20,
          perCafe: 5,   // 단일 카페에 월 5개 이상이면 과잉
        },
        'instagram.com': {
          daily: 5,
          weekly: 20,
          monthly: 50,
        },
      },
      
      // 집중도 분석
      concentration: {
        // 특정 커뮤니티 집중도
        singleCommunityRatio: {
          threshold: 0.5,  // 50% 이상이 한 커뮤니티면 경고
          message: '바이럴이 특정 커뮤니티에 집중되어 있습니다',
        },
        
        // 시간대 집중도
        timeConcentration: {
          threshold: 0.7,  // 70% 이상이 특정 시간대면 경고
          message: '게시 시간대가 비정상적으로 집중되어 있습니다',
        },
      },
    },
    
    risks: {
      overflow: {
        consequences: [
          '커뮤니티 관리자에 의한 일괄 삭제',
          '어뷰징으로 신고',
          '병원 이미지 하락',
          '플랫폼 제재 (계정 정지)',
        ],
        severity: 'high',
      },
    },
    
    recommendation: {
      optimal: {
        'blog.naver.com': '주 3-5개, 월 15개 이내',
        'cafe.naver.com': '카페당 월 2-3개, 다양한 카페 활용',
        'instagram.com': '주 10개 이내, 다양한 해시태그 활용',
      },
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['수량', '과잉', 'critical'],
    },
  },

  {
    id: 'VRL-QTY-002',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'quantity',
    name: '집중 게시 패턴 탐지',
    description: '단시간 대량 게시 패턴 탐지 (의심 패턴)',
    
    checkType: 'burst_detection',
    
    detection: {
      // 버스트 패턴 정의
      burstPatterns: {
        // 동시 게시
        simultaneousPosting: {
          window: '1hour',    // 1시간 이내
          threshold: 5,       // 5개 이상
          severity: 'high',
          message: '1시간 내 5개 이상의 게시물이 동시에 게시되었습니다',
        },
        
        // 연속 게시
        consecutivePosting: {
          window: '24hours',  // 24시간 이내
          threshold: 10,      // 10개 이상
          severity: 'medium',
          message: '24시간 내 10개 이상의 게시물이 연속 게시되었습니다',
        },
        
        // 정각 게시
        scheduledPosting: {
          pattern: /:\d{2}:00$/,  // 정각에 게시
          threshold: 0.5,         // 50% 이상이 정각이면
          severity: 'low',
          message: '자동 예약 게시 패턴이 감지되었습니다',
        },
      },
      
      // 작성자 분석
      authorAnalysis: {
        // 동일 작성자 다중 게시
        sameAuthor: {
          daily: 2,
          weekly: 5,
          message: '동일 작성자가 과도하게 게시하고 있습니다',
        },
        
        // 신규 계정 게시
        newAccount: {
          ageThreshold: 30,  // 30일 미만 계정
          severity: 'medium',
          message: '신규 생성된 계정에서 게시되었습니다',
        },
      },
    },
    
    alerting: {
      onBurst: {
        severity: 'high',
        message: '비정상적인 집중 게시 패턴이 감지되었습니다',
        action: '대행사에 게시 분산 요청',
      },
    },
    
    metadata: {
      isActive: true,
      priority: 10,
      tags: ['수량', '패턴', '집중', 'warning'],
    },
  },

  // ============================================
  // 카테고리 4: 경쟁사 분석 (Competition)
  // ============================================
  {
    id: 'VRL-CMP-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'competition',
    name: '경쟁사 바이럴 탐지',
    description: '경쟁 병원의 바이럴 동향 모니터링',
    
    checkType: 'competitor_monitoring',
    
    monitoring: {
      // 경쟁사 정의
      competitors: {
        definitionMethods: [
          'manual',           // 수동 등록
          'geo_based',        // 지역 기반 자동 탐지
          'specialty_based',  // 진료과목 기반 자동 탐지
        ],
        
        // 자동 탐지 기준
        autoDetection: {
          radius: 3,          // 반경 3km 이내
          sameSpecialty: true,// 같은 진료과목
          minReviews: 10,     // 최소 리뷰 10개 이상
        },
      },
      
      // 모니터링 항목
      trackingItems: [
        {
          name: 'postCount',
          label: '바이럴 게시물 수',
          comparison: 'monthly',
        },
        {
          name: 'platforms',
          label: '활동 플랫폼',
          comparison: 'list',
        },
        {
          name: 'keywords',
          label: '주요 키워드',
          comparison: 'list',
        },
        {
          name: 'sentiment',
          label: '전반적 톤',
          comparison: 'score',
        },
      ],
    },
    
    reporting: {
      // 비교 리포트
      comparison: {
        metrics: [
          'totalPosts',
          'avgEngagement',
          'platformDistribution',
          'keywordOverlap',
        ],
        period: 'monthly',
      },
      
      // 인사이트
      insights: [
        '경쟁사가 집중하는 플랫폼',
        '경쟁사가 사용하는 키워드',
        '경쟁사 바이럴 증감 추이',
        '우리 병원 대비 포지셔닝',
      ],
    },
    
    metadata: {
      isActive: true,
      priority: 20,
      tags: ['경쟁', '모니터링', 'analysis'],
    },
  },

  // ============================================
  // 카테고리 5: ROI 분석 (ROI)
  // ============================================
  {
    id: 'VRL-ROI-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'roi',
    name: '유입 추적',
    description: '바이럴 콘텐츠를 통한 실제 유입 추적',
    
    checkType: 'traffic_tracking',
    
    tracking: {
      // UTM 파라미터
      utmParameters: {
        source: 'viral',
        medium: 'blog|cafe|sns',
        campaign: 'hospital_name_date',
      },
      
      // 추적 가능한 메트릭
      trackableMetrics: [
        {
          name: 'clicks',
          label: '클릭수',
          source: 'utm_tracking',
        },
        {
          name: 'pageViews',
          label: '페이지뷰',
          source: 'analytics',
        },
        {
          name: 'inquiries',
          label: '문의수',
          source: 'crm',
        },
        {
          name: 'appointments',
          label: '예약수',
          source: 'booking_system',
        },
      ],
      
      // 전환 퍼널
      conversionFunnel: [
        { stage: 'view', label: '콘텐츠 조회' },
        { stage: 'click', label: '링크 클릭' },
        { stage: 'visit', label: '사이트 방문' },
        { stage: 'inquiry', label: '문의' },
        { stage: 'appointment', label: '예약' },
        { stage: 'visit_hospital', label: '내원' },
      ],
    },
    
    calculation: {
      // ROI 계산
      roi: {
        formula: '(revenue - cost) / cost * 100',
        inputs: {
          cost: '바이럴 대행 비용',
          revenue: '바이럴 유입 환자 매출',
        },
      },
      
      // CPA (Cost Per Acquisition)
      cpa: {
        formula: 'cost / conversions',
        target: 50000,  // 목표 CPA: 5만원
      },
      
      // CPM (Cost Per Mille)
      cpm: {
        formula: 'cost / impressions * 1000',
        benchmark: 5000,  // 벤치마크: 5천원
      },
    },
    
    reporting: {
      // 주간 리포트
      weekly: [
        '총 바이럴 게시물 수',
        '총 조회수',
        '클릭수 및 클릭률',
        '문의/예약 전환수',
        'CPA 및 ROI',
      ],
      
      // 월간 리포트
      monthly: [
        '플랫폼별 성과 비교',
        '콘텐츠 유형별 성과',
        '키워드별 성과',
        'ROI 추이',
        '경쟁사 대비 성과',
      ],
    },
    
    metadata: {
      isActive: true,
      priority: 15,
      tags: ['ROI', '유입', '전환', 'analysis'],
    },
  },

  // ============================================
  // 카테고리 6: 대행사 평가 (Agency)
  // ============================================
  {
    id: 'VRL-AGN-001',
    version: '1.0.0',
    category: 'viral_monitoring',
    subcategory: 'agency',
    name: '대행사 성과 평가',
    description: '대행사의 전반적인 성과를 평가하는 종합 점수',
    
    checkType: 'agency_evaluation',
    
    evaluation: {
      // 평가 항목 및 가중치
      criteria: [
        {
          name: 'deliveryRate',
          label: '게시물 이행률',
          weight: 0.25,
          formula: 'actualPosts / promisedPosts * 100',
          target: 100,
        },
        {
          name: 'survivalRate',
          label: '게시물 생존율',
          weight: 0.20,
          formula: 'activePosts / totalPosts * 100',
          target: 90,
        },
        {
          name: 'qualityScore',
          label: '콘텐츠 품질 점수',
          weight: 0.20,
          formula: 'avgNaturalnessScore',
          target: 70,
        },
        {
          name: 'diversityScore',
          label: '콘텐츠 다양성 점수',
          weight: 0.10,
          formula: 'uniqueContentRatio * 100',
          target: 80,
        },
        {
          name: 'conversionRate',
          label: '전환 기여율',
          weight: 0.15,
          formula: 'viralConversions / totalConversions * 100',
          target: 20,
        },
        {
          name: 'reportAccuracy',
          label: '보고서 정확도',
          weight: 0.10,
          formula: 'verifiedMetrics / reportedMetrics * 100',
          target: 95,
        },
      ],
      
      // 등급 기준
      grading: {
        A: { min: 90, label: '우수', action: '계약 유지/확대' },
        B: { min: 75, label: '양호', action: '계약 유지' },
        C: { min: 60, label: '보통', action: '개선 요청' },
        D: { min: 40, label: '미흡', action: '경고 및 개선 계획' },
        F: { min: 0, label: '불량', action: '계약 해지 검토' },
      },
    },
    
    reporting: {
      // 평가 리포트
      period: 'monthly',
      includeInReport: [
        '종합 점수 및 등급',
        '항목별 점수',
        '전월 대비 변화',
        '개선 필요 항목',
        '권고 사항',
      ],
    },
    
    metadata: {
      isActive: true,
      priority: 5,
      tags: ['대행사', '평가', 'critical'],
    },
  },
];

module.exports = viralMonitoringRules;
