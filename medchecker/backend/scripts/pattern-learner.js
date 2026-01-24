/**
 * MEDCHECKER 오탐 패턴 자동 학습기
 * 
 * 기능:
 * 1. 분석 결과에서 반복되는 위반 패턴 추출
 * 2. 오탐 가능성 높은 패턴 자동 식별
 * 3. false-positive-db.json 자동 업데이트
 * 4. 규칙별 오탐 통계 및 개선 제안
 * 
 * 오탐 판단 기준:
 * - 동일 텍스트가 3개 이상 병원에서 반복 (일반적인 표현)
 * - 메뉴/네비게이션 패턴과 매칭
 * - 짧은 텍스트 (5자 이하)
 * - 문맥 점수가 낮은 위반
 */

const fs = require('fs');
const path = require('path');

// 경로 설정
const DATA_DIR = path.join(__dirname, '..', 'data');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis-results');
const FP_DB_FILE = path.join(DATA_DIR, 'false-positive-db.json');

// 오탐 판단 설정
const CONFIG = {
  minOccurrences: 3,       // 오탐 후보로 판단할 최소 반복 횟수
  maxTextLength: 20,       // 짧은 텍스트 기준
  lowConfidenceThreshold: 0.5, // 낮은 신뢰도 임계값
  menuPatterns: [          // 메뉴 텍스트로 의심되는 패턴
    /^(홈|home|메인|main)$/i,
    /^(소개|안내|정보|about)$/i,
    /^(로그인|회원가입|마이페이지)$/i,
    /^(진료|시술|치료|수술)\s*(안내|과목)?$/i,
    /^(의료진|원장|전문의)\s*(소개)?$/i,
    /^(오시는\s*길|찾아오시는\s*길|위치|location)$/i,
    /^(문의|상담|예약|contact)$/i,
    /^(후기|리뷰|체험담)$/i,
    /^(전후|before|after)$/i,
    /^(갤러리|포토|사진|영상)$/i,
    /^(이벤트|공지|뉴스)$/i,
    /^(no\.?\s*1|넘버원|올인원)$/i,
    /^[a-z]{2,10}$/i,
    /^(전후사진|비포애프터)$/i,
    /^(인스타|유튜브|블로그|카페)$/i,
    /^(시술\s*후기|치료\s*후기)$/i,
  ],
  // 특정 규칙에서 자주 오탐이 발생하는 패턴
  ruleSpecificFalsePositives: {
    'MED-SNS-001': ['#', '인스타', '유튜브', '블로그'],  // SNS 링크/해시태그
    'MED-BA-001': ['전후사진', '비포애프터', 'before after'],  // 메뉴명
    'MED-BS-003': ['위험', '주의', '부작용'],  // 주의사항 안내
    'MED-EX-006': ['24시간', '365일'],  // 진료시간 안내
    'MED-PR-002': ['원~', '000원~'],  // 가격 표시
  },
};

class PatternLearner {
  constructor() {
    this.analysisResults = [];
    this.violationStats = new Map();  // { matchedText -> { count, ruleIds, domains, contexts } }
    this.ruleStats = new Map();       // { ruleId -> { totalViolations, uniqueTexts, texts } }
    this.fpDatabase = this.loadFPDatabase();
  }

  /**
   * 오탐 DB 로드
   */
  loadFPDatabase() {
    try {
      if (fs.existsSync(FP_DB_FILE)) {
        return JSON.parse(fs.readFileSync(FP_DB_FILE, 'utf-8'));
      }
    } catch (e) {}
    
    return {
      menuTexts: [],
      loginProtected: [],
      globalExclusions: [],
      domainSpecific: {},
      ruleAdjustments: {},
      stats: {
        totalAnalyzed: 0,
        totalFalsePositives: 0,
        byType: {},
        byRule: {},
        byDomain: {},
      },
      fpHistory: [],
      lastUpdated: null,
    };
  }

  /**
   * 오탐 DB 저장
   */
  saveFPDatabase() {
    this.fpDatabase.lastUpdated = new Date().toISOString();
    fs.writeFileSync(FP_DB_FILE, JSON.stringify(this.fpDatabase, null, 2), 'utf-8');
    console.log('[PatternLearner] 오탐 DB 저장 완료');
  }

  /**
   * 분석 결과 로드
   */
  loadAnalysisResults() {
    if (!fs.existsSync(ANALYSIS_DIR)) {
      console.log('[PatternLearner] 분석 결과 디렉토리 없음');
      return [];
    }

    const files = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
    console.log(`[PatternLearner] ${files.length}개 분석 결과 파일 발견`);

    const results = [];
    for (const file of files) {
      try {
        const filepath = path.join(ANALYSIS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        results.push(data);
      } catch (e) {
        console.warn(`[PatternLearner] 파일 로드 실패: ${file}`);
      }
    }

    this.analysisResults = results;
    console.log(`[PatternLearner] ${results.length}개 분석 결과 로드 완료`);
    return results;
  }

  /**
   * 위반 패턴 수집
   */
  collectViolationPatterns() {
    this.violationStats.clear();
    this.ruleStats.clear();

    for (const result of this.analysisResults) {
      if (!result.success) continue;

      const domain = this.extractDomain(result.url);
      const allViolations = [
        ...(result.violations || []),
        ...(result.warnings || []),
      ];

      for (const violation of allViolations) {
        const text = violation.matchedText?.trim().toLowerCase();
        if (!text) continue;

        // 위반 텍스트별 통계
        if (!this.violationStats.has(text)) {
          this.violationStats.set(text, {
            count: 0,
            ruleIds: new Set(),
            domains: new Set(),
            contexts: [],
            confidence: [],
          });
        }
        const stat = this.violationStats.get(text);
        stat.count++;
        stat.ruleIds.add(violation.ruleId);
        stat.domains.add(domain);
        if (violation.contextWindow) {
          stat.contexts.push(violation.contextWindow.substring(0, 200));
        }
        if (violation.confidence) {
          stat.confidence.push(violation.confidence);
        }

        // 규칙별 통계
        if (!this.ruleStats.has(violation.ruleId)) {
          this.ruleStats.set(violation.ruleId, {
            totalViolations: 0,
            uniqueTexts: new Set(),
            texts: [],
            ruleName: violation.ruleName,
          });
        }
        const ruleStat = this.ruleStats.get(violation.ruleId);
        ruleStat.totalViolations++;
        ruleStat.uniqueTexts.add(text);
        ruleStat.texts.push(text);
      }
    }

    console.log(`[PatternLearner] ${this.violationStats.size}개 고유 위반 텍스트 수집`);
    console.log(`[PatternLearner] ${this.ruleStats.size}개 규칙에서 위반 발생`);
  }

  /**
   * 오탐 후보 식별
   */
  identifyFalsePositiveCandidates() {
    const candidates = [];

    for (const [text, stat] of this.violationStats) {
      const reasons = [];
      let score = 0;

      // 1. 반복 횟수 체크 (여러 병원에서 동일 텍스트 = 일반적인 표현일 가능성)
      if (stat.count >= CONFIG.minOccurrences && stat.domains.size >= 2) {
        reasons.push(`반복 발생 (${stat.count}회, ${stat.domains.size}개 도메인)`);
        score += 0.3;
      }

      // 2. 메뉴 패턴 매칭
      if (this.isMenuPattern(text)) {
        reasons.push('메뉴/네비게이션 패턴');
        score += 0.4;
      }

      // 3. 짧은 텍스트 (맥락 없이 판단하기 어려움)
      if (text.length <= 5) {
        reasons.push(`짧은 텍스트 (${text.length}자)`);
        score += 0.2;
      }

      // 4. 낮은 신뢰도
      if (stat.confidence.length > 0) {
        const avgConfidence = stat.confidence.reduce((a, b) => a + b, 0) / stat.confidence.length;
        if (avgConfidence < CONFIG.lowConfidenceThreshold) {
          reasons.push(`낮은 신뢰도 (${(avgConfidence * 100).toFixed(1)}%)`);
          score += 0.2;
        }
      }

      // 5. 규칙별 알려진 오탐 패턴
      for (const ruleId of stat.ruleIds) {
        const knownFPs = CONFIG.ruleSpecificFalsePositives[ruleId] || [];
        for (const fp of knownFPs) {
          if (text.includes(fp.toLowerCase())) {
            reasons.push(`규칙 ${ruleId} 알려진 오탐 패턴: ${fp}`);
            score += 0.3;
            break;
          }
        }
      }

      // 6. 이미 globalExclusions에 있는지 확인
      if (this.fpDatabase.globalExclusions.includes(text)) {
        continue;  // 이미 등록됨
      }
      if (this.fpDatabase.menuTexts.includes(text)) {
        continue;  // 이미 등록됨
      }

      // 점수가 임계값 이상이면 후보로 추가
      if (score >= 0.5 && reasons.length >= 2) {
        candidates.push({
          text,
          score,
          reasons,
          occurrences: stat.count,
          domains: Array.from(stat.domains),
          ruleIds: Array.from(stat.ruleIds),
          sampleContexts: stat.contexts.slice(0, 3),
        });
      }
    }

    // 점수 순으로 정렬
    candidates.sort((a, b) => b.score - a.score);

    console.log(`[PatternLearner] ${candidates.length}개 오탐 후보 식별`);
    return candidates;
  }

  /**
   * 메뉴 패턴 체크
   */
  isMenuPattern(text) {
    return CONFIG.menuPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 규칙별 분석 리포트
   */
  generateRuleReport() {
    const report = [];

    for (const [ruleId, stat] of this.ruleStats) {
      // 가장 빈번한 텍스트
      const textCounts = {};
      for (const text of stat.texts) {
        textCounts[text] = (textCounts[text] || 0) + 1;
      }
      const topTexts = Object.entries(textCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([text, count]) => ({ text, count }));

      // 고유 텍스트 비율 (낮으면 = 같은 텍스트가 반복 = 오탐 가능성)
      const uniqueRatio = stat.uniqueTexts.size / stat.totalViolations;

      report.push({
        ruleId,
        ruleName: stat.ruleName,
        totalViolations: stat.totalViolations,
        uniqueTexts: stat.uniqueTexts.size,
        uniqueRatio: (uniqueRatio * 100).toFixed(1) + '%',
        topTexts,
        // 낮은 uniqueRatio = 같은 텍스트가 반복 = 패턴 조정 필요 가능성
        needsReview: uniqueRatio < 0.3 && stat.totalViolations >= 3,
      });
    }

    // 위반 횟수 순으로 정렬
    report.sort((a, b) => b.totalViolations - a.totalViolations);

    return report;
  }

  /**
   * 오탐 패턴 자동 학습 (신규 패턴만 추가)
   */
  learnPatterns(candidates, options = {}) {
    const { autoApply = false, minScore = 0.7 } = options;
    const learned = [];

    for (const candidate of candidates) {
      if (candidate.score < minScore) continue;
      if (autoApply === false) continue;

      const text = candidate.text;

      // 유형 결정
      if (this.isMenuPattern(text)) {
        if (!this.fpDatabase.menuTexts.includes(text)) {
          this.fpDatabase.menuTexts.push(text);
          learned.push({ text, type: 'menuTexts', score: candidate.score });
        }
      } else {
        if (!this.fpDatabase.globalExclusions.includes(text)) {
          this.fpDatabase.globalExclusions.push(text);
          learned.push({ text, type: 'globalExclusions', score: candidate.score });
        }
      }

      // 히스토리 추가
      this.fpDatabase.fpHistory.push({
        id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        matchedText: text,
        normalizedText: text,
        reason: 'auto_learned',
        source: 'pattern_learner',
        score: candidate.score,
        reasons: candidate.reasons,
        occurrences: candidate.occurrences,
      });

      // 통계 업데이트
      this.fpDatabase.stats.totalFalsePositives++;
      this.fpDatabase.stats.byType['auto_learned'] = 
        (this.fpDatabase.stats.byType['auto_learned'] || 0) + 1;
    }

    // 히스토리 최근 500개만 유지
    if (this.fpDatabase.fpHistory.length > 500) {
      this.fpDatabase.fpHistory = this.fpDatabase.fpHistory.slice(-500);
    }

    console.log(`[PatternLearner] ${learned.length}개 패턴 자동 학습`);
    return learned;
  }

  /**
   * 도메인 추출
   */
  extractDomain(url) {
    if (!url) return 'unknown';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * 전체 분석 및 학습 실행
   */
  async run(options = {}) {
    const { autoApply = false, minScore = 0.7, verbose = true } = options;

    console.log('\n' + '='.repeat(60));
    console.log('MEDCHECKER 오탐 패턴 자동 학습기');
    console.log('='.repeat(60));

    // 1. 분석 결과 로드
    this.loadAnalysisResults();
    if (this.analysisResults.length === 0) {
      console.log('분석 결과가 없습니다.');
      return;
    }

    // 2. 위반 패턴 수집
    this.collectViolationPatterns();

    // 3. 오탐 후보 식별
    const candidates = this.identifyFalsePositiveCandidates();

    // 4. 규칙별 리포트
    const ruleReport = this.generateRuleReport();

    // 5. 패턴 학습
    const learned = this.learnPatterns(candidates, { autoApply, minScore });

    // 6. DB 저장
    if (learned.length > 0) {
      this.saveFPDatabase();
    }

    // 7. 리포트 출력
    if (verbose) {
      this.printReport(candidates, ruleReport, learned);
    }

    return {
      totalResults: this.analysisResults.length,
      uniqueViolations: this.violationStats.size,
      candidatesCount: candidates.length,
      learnedPatterns: learned.length,
      ruleReport,
      candidates: candidates.slice(0, 20),  // 상위 20개만
    };
  }

  /**
   * 리포트 출력
   */
  printReport(candidates, ruleReport, learned) {
    console.log('\n' + '-'.repeat(60));
    console.log('오탐 후보 (상위 10개)');
    console.log('-'.repeat(60));

    for (const candidate of candidates.slice(0, 10)) {
      console.log(`\n"${candidate.text}" (점수: ${(candidate.score * 100).toFixed(0)}%)`);
      console.log(`  - 발생: ${candidate.occurrences}회 (${candidate.domains.length}개 도메인)`);
      console.log(`  - 규칙: ${candidate.ruleIds.join(', ')}`);
      console.log(`  - 판단 근거: ${candidate.reasons.join(', ')}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('규칙별 분석 (검토 필요)');
    console.log('-'.repeat(60));

    for (const rule of ruleReport.filter(r => r.needsReview)) {
      console.log(`\n[${rule.ruleId}] ${rule.ruleName}`);
      console.log(`  - 총 위반: ${rule.totalViolations}건, 고유 텍스트: ${rule.uniqueTexts}개 (${rule.uniqueRatio})`);
      console.log(`  - 빈번한 텍스트:`);
      for (const t of rule.topTexts.slice(0, 3)) {
        console.log(`    * "${t.text}" (${t.count}회)`);
      }
    }

    if (learned.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log(`자동 학습된 패턴: ${learned.length}개`);
      console.log('-'.repeat(60));
      for (const l of learned) {
        console.log(`  - "${l.text}" → ${l.type}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const learner = new PatternLearner();

  const autoApply = args.includes('--apply');
  const verbose = !args.includes('--quiet');
  const minScoreArg = args.find(a => a.startsWith('--min-score='));
  const minScore = minScoreArg ? parseFloat(minScoreArg.split('=')[1]) : 0.7;

  if (args.includes('--help')) {
    console.log('사용법:');
    console.log('  node pattern-learner.js          # 분석만 (적용 안 함)');
    console.log('  node pattern-learner.js --apply  # 분석 + 자동 적용');
    console.log('  node pattern-learner.js --apply --min-score=0.8  # 높은 신뢰도만 적용');
    console.log('  node pattern-learner.js --quiet  # 조용한 모드');
    return;
  }

  await learner.run({ autoApply, minScore, verbose });
}

module.exports = PatternLearner;

if (require.main === module) {
  main().catch(console.error);
}
