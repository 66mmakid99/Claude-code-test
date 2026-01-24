/**
 * MEDCHECKER - 병원 데이터 수집기
 * 
 * 수집 대상:
 * 1. 피부과 전문 의원
 * 2. 피부과 진료를 하는 의원 (내과, 가정의학과 등 타 전공이지만 피부미용시술 제공)
 * 
 * 데이터 소스:
 * 1. 네이버 지역 검색 API - 병원 기본 정보 + URL
 * 2. 공공데이터포털 - 의료기관 인허가 정보 (보완용)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');
const fs = require('fs');
const path = require('path');

// 네이버 API 설정
const NAVER_CLIENT_ID = process.env.NAVER_SEARCH_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_SEARCH_SECRET;

// 수집 대상 지역 (전국)
const REGIONS = {
  seoul: [
    '강남구', '서초구', '송파구', '강동구', '강서구', '양천구', '구로구', '영등포구',
    '동작구', '관악구', '금천구', '마포구', '서대문구', '은평구', '종로구', '중구',
    '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구'
  ],
  gyeonggi: [
    '성남시', '용인시', '수원시', '화성시', '고양시', '부천시', '안양시', '안산시',
    '평택시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '하남시',
    '오산시', '이천시', '안성시', '의왕시', '양주시', '포천시', '여주시', '동두천시',
    '과천시', '구리시', '남양주시', '의정부시'
  ],
  incheon: [
    '중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'
  ],
  busan: [
    '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구',
    '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'
  ],
  ulsan: [
    '중구', '남구', '동구', '북구', '울주군'
  ],
  gyeongbuk: [
    '포항시', '경주시', '구미시', '김천시', '안동시', '영주시', '상주시'
  ],
  chungnam: [
    '천안시', '아산시', '서산시', '논산시', '공주시', '당진시', '보령시'
  ],
  chungbuk: [
    '청주시', '충주시', '제천시', '음성군'
  ],
  jeonnam: [
    '목포시', '여수시', '순천시', '나주시', '광양시'
  ],
  jeonbuk: [
    '전주시', '익산시', '군산시', '정읍시', '남원시'
  ],
  daejeon: [
    '동구', '중구', '서구', '유성구', '대덕구'
  ],
  gwangju: [
    '동구', '서구', '남구', '북구', '광산구'
  ]
};

// 검색 키워드 (피부과 + 피부미용 시술 의원 + 시술명)
// 타겟: 피부과 전문의원 + 피부미용시술 제공 의원 (내과, 가정의학과 등)
// 제외: 한의원, 네일샵, 스킨케어샵, 에스테틱(비의료)
const SEARCH_KEYWORDS = [
  // 기본 키워드
  '피부과',
  '피부과의원',
  '피부클리닉',
  '피부과진료',
  '보톡스의원',
  '필러의원',
  '리프팅의원',
  '레이저피부과',
  '미용의원',
  // 리프팅/탄력 시술
  '울쎄라',
  '슈링크',
  '써마지',
  '올리지오',
  '리프팅시술',
  // 스킨부스터/재생
  '리쥬란',
  '쥬베룩',
  '볼뉴머',
  '스킨부스터',
  // 레이저/광치료
  'IPL',
  '레이저토닝',
  '피코토닝',
  // 쁘띠시술
  '쁘띠시술',
  '보톡스',
  '필러',
];

// 제외 키워드 (한의원, 비의료기관, 타과)
const EXCLUDE_KEYWORDS = [
  '한의원',
  '한의학',
  '한방',
  '네일',
  '스킨케어',
  '에스테틱',
  '마사지',
  '스파',
  '왁싱',
  '태닝',
  '헤어',
  '미용실',
  '동물병원',
  '수의',
  '안과',
  '이비인후과',
  '치과',
  '정형외과',
  '신경외과',
  '정신과',
  '소아과',
  '산부인과',
  '비뇨기과'
];

// 결과 저장 경로
const DATA_DIR = path.join(__dirname, '..', 'data', 'hospitals');
const HOSPITALS_FILE = path.join(DATA_DIR, 'hospitals.json');
const COLLECTION_LOG_FILE = path.join(DATA_DIR, 'collection-log.json');

/**
 * 네이버 지역 검색 API 호출
 */
async function searchNaverLocal(query, display = 5, start = 1) {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'openapi.naver.com',
      path: `/v1/search/local.json?query=${encodedQuery}&display=${display}&start=${start}&sort=comment`,
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errorCode) {
            reject(new Error(`Naver API Error: ${result.errorMessage}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 네이버 웹 검색 API로 병원 홈페이지 URL 찾기
 */
async function searchNaverWeb(query, display = 3) {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query + ' 공식 홈페이지');
    const options = {
      hostname: 'openapi.naver.com',
      path: `/v1/search/webkr.json?query=${encodedQuery}&display=${display}`,
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * HTML 태그 제거
 */
function stripHtml(str) {
  return str ? str.replace(/<[^>]*>/g, '') : '';
}

/**
 * 제외 대상인지 확인
 */
function shouldExclude(title, category) {
  const lowerTitle = title.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  for (const exclude of EXCLUDE_KEYWORDS) {
    if (lowerTitle.includes(exclude) || lowerCategory.includes(exclude)) {
      return true;
    }
  }
  
  // 카테고리가 한의원인 경우 제외
  if (lowerCategory.includes('한의') || lowerCategory.includes('한방')) {
    return true;
  }
  
  return false;
}

/**
 * 유효한 의원인지 확인
 */
function isValidClinic(title, category) {
  const lowerTitle = title.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  // 의원/의료기관 카테고리 확인
  const isMedical = 
    lowerCategory.includes('피부과') ||
    lowerCategory.includes('성형외과') ||
    lowerCategory.includes('의원') ||
    lowerCategory.includes('병원') ||
    lowerCategory.includes('클리닉') ||
    lowerCategory.includes('내과') ||
    lowerCategory.includes('가정의학과') ||
    lowerCategory.includes('외과');
  
  // 이름에 의원/피부과 등 포함 확인
  const hasClinicName = 
    lowerTitle.includes('의원') ||
    lowerTitle.includes('피부과') ||
    lowerTitle.includes('클리닉') ||
    lowerTitle.includes('병원');
  
  return isMedical || hasClinicName;
}

/**
 * 병원 데이터 정규화
 */
function normalizeHospital(item, region, keyword) {
  const title = stripHtml(item.title);
  const address = stripHtml(item.address);
  const roadAddress = stripHtml(item.roadAddress);
  const category = item.category || '';
  
  // 제외 대상 체크
  if (shouldExclude(title, category)) {
    return null;
  }
  
  // 유효한 의원인지 체크
  if (!isValidClinic(title, category)) {
    return null;
  }
  
  // 피부과/피부미용 관련 여부 확인
  const isSkinRelated = 
    title.includes('피부') || 
    title.includes('더마') ||
    title.includes('레이저') ||
    category.includes('피부과') ||
    category.includes('성형외과');

  // 네이버 지역 API의 link 필드가 실제 병원 홈페이지인 경우가 많음
  // 카카오, 네이버 플레이스 링크는 제외
  const naverLink = item.link || '';
  const isOfficialSite = naverLink && 
    !naverLink.includes('pf.kakao.com') && 
    !naverLink.includes('place.naver.com') &&
    !naverLink.includes('map.naver.com') &&
    !naverLink.includes('blog.naver.com') &&
    !naverLink.includes('instagram.com') &&
    !naverLink.includes('facebook.com');

  return {
    id: `hosp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: title,
    address: roadAddress || address,
    oldAddress: address,
    telephone: item.telephone || '',
    category: category,
    naverLink: naverLink,  // 네이버 지역 API 원본 링크
    homepageUrl: isOfficialSite ? naverLink : null,  // 공식 홈페이지로 판단되면 사용
    mapx: item.mapx,
    mapy: item.mapy,
    region: region,
    searchKeyword: keyword,
    isSkinRelated: isSkinRelated,
    collectedAt: new Date().toISOString(),
    lastAnalyzed: null,
    analysisCount: 0
  };
}

/**
 * 중복 제거 (병원명 + 주소 기준)
 */
function deduplicateHospitals(hospitals) {
  const seen = new Map();
  
  return hospitals.filter(h => {
    // 이름과 주소 조합으로 중복 체크
    const key = `${h.name}-${h.address}`.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) {
      return false;
    }
    seen.set(key, true);
    return true;
  });
}

/**
 * 병원 홈페이지 URL 찾기
 */
async function findHomepageUrl(hospitalName, address) {
  try {
    // 병원명 + 지역으로 검색
    const region = address.match(/(서울|경기|인천)/)?.[0] || '';
    const district = address.match(/([가-힣]+[구시군])/)?.[0] || '';
    const query = `${hospitalName} ${district} ${region}`;
    
    const result = await searchNaverWeb(query);
    
    if (result.items && result.items.length > 0) {
      // 공식 홈페이지로 보이는 URL 찾기
      for (const item of result.items) {
        const link = item.link;
        // 네이버 블로그, 카페, 지식인 등 제외
        if (!link.includes('blog.naver') && 
            !link.includes('cafe.naver') && 
            !link.includes('kin.naver') &&
            !link.includes('youtube.com') &&
            !link.includes('instagram.com') &&
            !link.includes('facebook.com') &&
            !link.includes('gangnamunni.com') &&
            !link.includes('babitalk.com')) {
          return link;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`  홈페이지 URL 검색 실패: ${hospitalName}`, error.message);
    return null;
  }
}

/**
 * Rate limiting을 위한 딜레이
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 기존 데이터 로드
 */
function loadExistingData() {
  try {
    if (fs.existsSync(HOSPITALS_FILE)) {
      const data = fs.readFileSync(HOSPITALS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('기존 데이터 로드 실패:', e.message);
  }
  return { hospitals: [], collectionStats: {}, lastUpdated: null };
}

/**
 * 데이터 저장
 */
function saveData(data) {
  // 디렉토리 확인
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(HOSPITALS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n저장 완료: ${HOSPITALS_FILE}`);
  console.log(`총 병원 수: ${data.hospitals.length}`);
}

/**
 * 수집 로그 저장
 */
function saveCollectionLog(log) {
  const logs = [];
  if (fs.existsSync(COLLECTION_LOG_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(COLLECTION_LOG_FILE, 'utf-8'));
      logs.push(...existing);
    } catch (e) {}
  }
  logs.push(log);
  fs.writeFileSync(COLLECTION_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

/**
 * 메인 수집 함수
 */
async function collectHospitals(options = {}) {
  const {
    regions = ['seoul'],  // 수집할 지역
    keywords = SEARCH_KEYWORDS.slice(0, 3),  // 사용할 키워드
    findUrls = true,  // 홈페이지 URL 찾기 여부
    maxPerKeyword = 100,  // 키워드당 최대 수집 수
    targetUrlCount = 0  // URL 있는 병원 목표 개수 (0 = 무제한)
  } = options;
  
  // URL 목표 달성 체크 함수
  const checkTargetReached = (hospitals) => {
    if (targetUrlCount <= 0) return false;
    const urlCount = hospitals.filter(h => h.homepageUrl).length;
    return urlCount >= targetUrlCount;
  };

  console.log('='.repeat(60));
  console.log('MEDCHECKER 병원 데이터 수집 시작');
  console.log('='.repeat(60));
  console.log(`대상 지역: ${regions.join(', ')}`);
  console.log(`검색 키워드: ${keywords.join(', ')}`);
  console.log(`홈페이지 URL 수집: ${findUrls ? 'Yes' : 'No'}`);
  if (targetUrlCount > 0) {
    console.log(`목표 URL 개수: ${targetUrlCount}개 (달성 시 자동 중단)`);
  }
  console.log('='.repeat(60));

  // 기존 데이터 로드
  const existingData = loadExistingData();
  const existingNames = new Set(existingData.hospitals.map(h => h.name.toLowerCase()));
  
  const collectedHospitals = [];
  const collectionLog = {
    startedAt: new Date().toISOString(),
    regions: regions,
    keywords: keywords,
    results: {}
  };

  // 기존 데이터의 URL 수 계산
  const existingUrlCount = existingData.hospitals.filter(h => h.homepageUrl).length;
  let targetReached = false;

  // 지역별 수집
  for (const regionKey of regions) {
    if (targetReached) break;
    
    const districts = REGIONS[regionKey];
    if (!districts) {
      console.log(`알 수 없는 지역: ${regionKey}`);
      continue;
    }

    console.log(`\n[${regionKey.toUpperCase()}] 수집 시작 (${districts.length}개 구/시)`);
    collectionLog.results[regionKey] = { total: 0, new: 0, districts: {} };

    for (const district of districts) {
      if (targetReached) break;
      
      console.log(`\n  > ${district} 수집 중...`);
      collectionLog.results[regionKey].districts[district] = { total: 0, new: 0 };

      for (const keyword of keywords) {
        if (targetReached) break;
        // 지역별 쿼리 생성
        const regionNames = {
          seoul: '서울', gyeonggi: '경기', incheon: '인천',
          busan: '부산', ulsan: '울산', gyeongbuk: '경북',
          chungnam: '충남', chungbuk: '충북', jeonnam: '전남',
          jeonbuk: '전북', daejeon: '대전', gwangju: '광주'
        };
        const regionName = regionNames[regionKey] || regionKey;
        const query = `${regionName} ${district} ${keyword}`;

        try {
          // 네이버 지역 검색 (최대 5개씩, 여러 페이지)
          let collected = 0;
          for (let start = 1; start <= maxPerKeyword && collected < maxPerKeyword; start += 5) {
            const result = await searchNaverLocal(query, 5, start);
            
            if (!result.items || result.items.length === 0) break;

            for (const item of result.items) {
              const hospital = normalizeHospital(item, `${regionKey}-${district}`, keyword);
              
              // normalizeHospital에서 null 반환 시 (제외 대상)
              if (!hospital) {
                continue;
              }
              
              // 중복 체크 (기존 데이터 + 새 수집 데이터)
              const nameKey = hospital.name.toLowerCase();
              if (existingNames.has(nameKey)) {
                continue;
              }

              // 홈페이지 URL 찾기 (네이버 link가 없는 경우에만 웹 검색)
              if (findUrls && !hospital.homepageUrl) {
                console.log(`    - ${hospital.name} 홈페이지 검색...`);
                hospital.homepageUrl = await findHomepageUrl(hospital.name, hospital.address);
                await delay(100);  // Rate limiting
              }

              collectedHospitals.push(hospital);
              existingNames.add(nameKey);
              collected++;
              collectionLog.results[regionKey].total++;
              collectionLog.results[regionKey].new++;
              collectionLog.results[regionKey].districts[district].total++;
              collectionLog.results[regionKey].districts[district].new++;

              const urlStatus = hospital.homepageUrl ? hospital.homepageUrl : 'URL 없음';
              console.log(`    + ${hospital.name} [${hospital.category}] (${urlStatus})`);
              
              // 목표 달성 체크
              const totalUrlCount = existingUrlCount + collectedHospitals.filter(h => h.homepageUrl).length;
              if (checkTargetReached([...existingData.hospitals, ...collectedHospitals])) {
                console.log(`\n🎯 목표 달성! URL 있는 병원 ${totalUrlCount}개 수집 완료`);
                targetReached = true;
                break;
              }
            }
            
            if (targetReached) break;

            await delay(100);  // Rate limiting between pages
          }
        } catch (error) {
          console.error(`    ! 오류: ${query}`, error.message);
        }

        await delay(150);  // Rate limiting between keywords
      }
    }
  }

  // 중복 제거
  const dedupedNew = deduplicateHospitals(collectedHospitals);
  
  // 기존 데이터와 병합
  const mergedHospitals = [...existingData.hospitals, ...dedupedNew];
  const finalDeduped = deduplicateHospitals(mergedHospitals);

  // 저장
  const finalData = {
    hospitals: finalDeduped,
    collectionStats: {
      ...existingData.collectionStats,
      lastCollection: {
        date: new Date().toISOString(),
        newHospitals: dedupedNew.length,
        totalAfter: finalDeduped.length
      }
    },
    lastUpdated: new Date().toISOString()
  };

  saveData(finalData);

  // 수집 로그 저장
  collectionLog.completedAt = new Date().toISOString();
  collectionLog.totalNew = dedupedNew.length;
  collectionLog.totalAfter = finalDeduped.length;
  saveCollectionLog(collectionLog);

  // 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('수집 완료!');
  console.log('='.repeat(60));
  console.log(`새로 수집: ${dedupedNew.length}개`);
  console.log(`총 병원 수: ${finalDeduped.length}개`);
  console.log(`URL 있는 병원: ${finalDeduped.filter(h => h.homepageUrl).length}개`);
  console.log('='.repeat(60));

  return finalData;
}

/**
 * 테스트 실행 (소규모)
 */
async function testCollection() {
  console.log('\n[테스트 모드] 강남구 피부과만 수집\n');
  
  // 테스트용: 강남구, 서초구만 + 피부과 키워드만
  const testRegions = {
    seoul: ['강남구', '서초구']
  };
  
  // 임시로 REGIONS 덮어쓰기
  const originalRegions = { ...REGIONS };
  REGIONS.seoul = testRegions.seoul;
  
  const result = await collectHospitals({
    regions: ['seoul'],
    keywords: ['피부과', '피부과의원'],
    findUrls: true,
    maxPerKeyword: 20
  });
  
  // 복원
  Object.assign(REGIONS, originalRegions);
  
  return result;
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 기본 키워드 vs 전체 키워드 (시술명 포함)
  const basicKeywords = ['피부과', '피부과의원', '피부클리닉', '피부과진료'];
  const procedureKeywords = [
    '울쎄라', '슈링크', '써마지', '올리지오', '리프팅시술',
    '리쥬란', '쥬베룩', '볼뉴머', '스킨부스터',
    'IPL', '레이저토닝', '피코토닝',
    '쁘띠시술', '보톡스', '필러'
  ];
  
  if (args.includes('--test')) {
    await testCollection();
  } else if (args.includes('--seoul')) {
    // 서울: 핵심 키워드만, URL 웹검색 비활성화 (네이버 link 사용)
    await collectHospitals({
      regions: ['seoul'],
      keywords: basicKeywords,
      findUrls: false,  // 네이버 link만 사용, 웹검색 스킵
      maxPerKeyword: 30
    });
  } else if (args.includes('--seoul-full')) {
    // 서울 전체: 모든 키워드 (시술명 포함), URL 웹검색 포함
    await collectHospitals({
      regions: ['seoul'],
      keywords: SEARCH_KEYWORDS,
      findUrls: true,
      maxPerKeyword: 50
    });
  } else if (args.includes('--all')) {
    // 전체: 기본 키워드만
    await collectHospitals({
      regions: ['seoul', 'gyeonggi', 'incheon'],
      keywords: basicKeywords,
      findUrls: false,
      maxPerKeyword: 30
    });
  } else if (args.includes('--all-full')) {
    // 전체: 모든 키워드 (시술명 포함) - 시간 많이 소요
    await collectHospitals({
      regions: ['seoul', 'gyeonggi', 'incheon'],
      keywords: SEARCH_KEYWORDS,
      findUrls: false,
      maxPerKeyword: 30
    });
  } else if (args.includes('--procedures')) {
    // 시술 키워드로만 수집 (새로운 의원 발굴용)
    await collectHospitals({
      regions: ['seoul', 'gyeonggi', 'incheon'],
      keywords: procedureKeywords,
      findUrls: false,
      maxPerKeyword: 20
    });
  } else if (args.includes('--collect-300')) {
    // 전국 시술 키워드로 URL 있는 병원 300개까지 수집
    const allRegions = ['seoul', 'gyeonggi', 'busan', 'gyeongbuk', 'ulsan', 'chungnam', 'chungbuk', 'jeonnam', 'jeonbuk'];
    console.log('\n🎯 목표: URL 있는 병원 300개 수집\n');
    await collectHospitals({
      regions: allRegions,
      keywords: [...basicKeywords, ...procedureKeywords],
      findUrls: false,  // 네이버 link만 사용 (빠른 수집)
      maxPerKeyword: 50,
      targetUrlCount: 300
    });
  } else {
    console.log('사용법:');
    console.log('  node hospital-collector.js --test        # 테스트 (강남구, 서초구만)');
    console.log('  node hospital-collector.js --seoul       # 서울 빠른 수집 (기본 키워드)');
    console.log('  node hospital-collector.js --seoul-full  # 서울 전체 (모든 키워드, 느림)');
    console.log('  node hospital-collector.js --all         # 서울+경기+인천 (기본 키워드)');
    console.log('  node hospital-collector.js --all-full    # 서울+경기+인천 (모든 키워드, 매우 느림)');
    console.log('  node hospital-collector.js --procedures  # 시술명 키워드로 수집 (새 의원 발굴)');
    console.log('  node hospital-collector.js --collect-300 # 전국에서 URL 있는 병원 300개까지 수집');
    console.log('');
    console.log('키워드 목록:');
    console.log('  기본: ' + basicKeywords.join(', '));
    console.log('  시술: ' + procedureKeywords.join(', '));
  }
}

// 모듈 export
module.exports = {
  collectHospitals,
  testCollection,
  searchNaverLocal,
  searchNaverWeb,
  findHomepageUrl,
  loadExistingData,
  REGIONS,
  SEARCH_KEYWORDS
};

// 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}
