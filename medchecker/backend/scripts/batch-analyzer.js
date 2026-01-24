/**
 * MEDCHECKER 대량 병원 자동 분석 스케줄러
 * 
 * 기능:
 * - hospitals.json에서 병원 목록 로드
 * - URL이 있는 병원만 분석
 * - 일일 분석 한도 관리 (API 비용 제어)
 * - 분석 결과 저장 및 통계
 * - 오탐 자동 학습
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const AnalyzerService = require('../services/analyzer-service');
const PatternLearner = require('./pattern-learner');

// 경로 설정
const DATA_DIR = path.join(__dirname, '..', 'data');
const HOSPITALS_FILE = path.join(DATA_DIR, 'hospitals', 'hospitals.json');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis-results');
const BATCH_LOG_FILE = path.join(DATA_DIR, 'batch-analysis-log.json');

// 타임아웃 관리 파일
const TIMEOUT_LOG_FILE = path.join(DATA_DIR, 'timeout-hospitals.json');

// 설정
const CONFIG = {
  dailyLimit: 500,          // 하루 최대 분석 수 (300개 목표)
  delayBetweenAnalysis: 3000, // 분석 간 딜레이 (ms)
  enableImageOcr: true,     // 이미지 OCR 사용
  maxOcrImages: 3,          // 병원당 최대 OCR 이미지 수
  enableAI: true,           // AI 검증 사용
  skipAlreadyAnalyzed: true, // 이미 분석된 병원 스킵
  analyzeOlderThanDays: 7,  // N일 이전 분석은 재분석
  analysisTimeoutMs: 90000, // 분석 타임아웃 (90초 기본)
  timeoutBufferMs: 60000,   // 평균 + 1분 버퍼
};

class BatchAnalyzer {
  constructor(config = {}) {
    this.config = { ...CONFIG, ...config };
    this.analyzer = null;
    this.hospitals = [];
    this.batchLog = this.loadBatchLog();
    this.timeoutLog = this.loadTimeoutLog();
    
    // 오늘 분석 카운트
    this.todayCount = this.getTodayAnalysisCount();
    
    // 처리 시간 통계 (동적 타임아웃 계산용)
    this.processingTimes = [];
    this.avgProcessingTime = 30000; // 기본 30초
  }
  
  /**
   * 타임아웃 로그 로드
   */
  loadTimeoutLog() {
    try {
      if (fs.existsSync(TIMEOUT_LOG_FILE)) {
        return JSON.parse(fs.readFileSync(TIMEOUT_LOG_FILE, 'utf-8'));
      }
    } catch (e) {}
    
    return {
      timeoutHospitals: [],
      lastUpdated: null,
      totalTimeouts: 0,
      analysisForImprovement: [],
    };
  }
  
  /**
   * 타임아웃 로그 저장
   */
  saveTimeoutLog() {
    this.timeoutLog.lastUpdated = new Date().toISOString();
    fs.writeFileSync(TIMEOUT_LOG_FILE, JSON.stringify(this.timeoutLog, null, 2), 'utf-8');
  }
  
  /**
   * 처리 시간 업데이트 (동적 타임아웃 계산)
   */
  updateProcessingStats(timeMs) {
    this.processingTimes.push(timeMs);
    // 최근 20개만 유지
    if (this.processingTimes.length > 20) {
      this.processingTimes.shift();
    }
    // 평균 계산
    this.avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }
  
  /**
   * 현재 타임아웃 값 계산 (평균 + 버퍼)
   */
  getCurrentTimeout() {
    return Math.max(
      this.avgProcessingTime + this.config.timeoutBufferMs,
      this.config.analysisTimeoutMs
    );
  }
  
  /**
   * 타임아웃 병원 기록
   */
  recordTimeout(hospital, reason, details = {}) {
    const record = {
      id: hospital.id,
      name: hospital.name,
      url: hospital.homepageUrl,
      timestamp: new Date().toISOString(),
      reason,
      avgProcessingTimeAtTimeout: this.avgProcessingTime,
      timeoutThreshold: this.getCurrentTimeout(),
      ...details,
    };
    
    // 중복 제거 (같은 병원 ID)
    this.timeoutLog.timeoutHospitals = this.timeoutLog.timeoutHospitals.filter(
      h => h.id !== hospital.id
    );
    this.timeoutLog.timeoutHospitals.push(record);
    this.timeoutLog.totalTimeouts++;
    
    this.saveTimeoutLog();
    console.log(`  ⏱️ 타임아웃 기록: ${hospital.name} (${reason})`);
  }

  /**
   * 초기화
   */
  async initialize() {
    console.log('='.repeat(60));
    console.log('MEDCHECKER 배치 분석기 초기화');
    console.log('='.repeat(60));

    // AnalyzerService 초기화
    this.analyzer = new AnalyzerService({
      debug: false,
      enableAI: this.config.enableAI,
    });

    // 병원 데이터 로드
    this.hospitals = this.loadHospitals();
    console.log(`총 병원 수: ${this.hospitals.length}`);
    console.log(`URL 있는 병원: ${this.hospitals.filter(h => h.homepageUrl).length}`);
    console.log(`오늘 분석 완료: ${this.todayCount}/${this.config.dailyLimit}`);
    console.log('='.repeat(60));
  }

  /**
   * 병원 데이터 로드
   */
  loadHospitals() {
    try {
      const data = JSON.parse(fs.readFileSync(HOSPITALS_FILE, 'utf-8'));
      return data.hospitals || [];
    } catch (e) {
      console.error('병원 데이터 로드 실패:', e.message);
      return [];
    }
  }

  /**
   * 배치 로그 로드
   */
  loadBatchLog() {
    try {
      if (fs.existsSync(BATCH_LOG_FILE)) {
        return JSON.parse(fs.readFileSync(BATCH_LOG_FILE, 'utf-8'));
      }
    } catch (e) {}
    
    return {
      totalAnalyzed: 0,
      dailyStats: {},
      lastRun: null,
      errors: [],
    };
  }

  /**
   * 배치 로그 저장
   */
  saveBatchLog() {
    fs.writeFileSync(BATCH_LOG_FILE, JSON.stringify(this.batchLog, null, 2), 'utf-8');
  }

  /**
   * 오늘 분석 카운트
   */
  getTodayAnalysisCount() {
    const today = new Date().toISOString().split('T')[0];
    return this.batchLog.dailyStats[today]?.analyzed || 0;
  }

  /**
   * 분석 대상 병원 선택
   */
  selectHospitalsToAnalyze() {
    const today = new Date().toISOString().split('T')[0];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.analyzeOlderThanDays);

    const candidates = this.hospitals.filter(h => {
      // URL 필수
      if (!h.homepageUrl) return false;
      
      // YouTube, SNS 링크 제외
      if (h.homepageUrl.includes('youtube.com') || 
          h.homepageUrl.includes('instagram.com') ||
          h.homepageUrl.includes('facebook.com') ||
          h.homepageUrl.includes('pf.kakao.com') ||
          h.homepageUrl.includes('linktr.ee') ||
          h.homepageUrl.includes('booking.naver.com')) {
        return false;
      }
      
      // 이미 분석된 병원 처리
      if (this.config.skipAlreadyAnalyzed && h.lastAnalyzed) {
        const lastAnalyzed = new Date(h.lastAnalyzed);
        if (lastAnalyzed > cutoffDate) {
          return false;
        }
      }
      
      return true;
    });

    // 분석 횟수 적은 순으로 정렬
    candidates.sort((a, b) => (a.analysisCount || 0) - (b.analysisCount || 0));

    // 오늘 남은 한도만큼 선택
    const remaining = this.config.dailyLimit - this.todayCount;
    return candidates.slice(0, Math.max(0, remaining));
  }

  /**
   * 타임아웃을 적용한 Promise 래퍼
   */
  withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }

  /**
   * 단일 병원 분석 (타임아웃 적용)
   */
  async analyzeHospital(hospital) {
    const startTime = Date.now();
    const timeout = this.getCurrentTimeout();
    
    try {
      console.log(`\n[분석 중] ${hospital.name}`);
      console.log(`  URL: ${hospital.homepageUrl}`);
      console.log(`  타임아웃: ${(timeout / 1000).toFixed(0)}초 (평균: ${(this.avgProcessingTime / 1000).toFixed(0)}초)`);

      // 타임아웃 적용
      const result = await this.withTimeout(
        this.analyzer.analyzeWebsite(hospital.homepageUrl, {
          enableImageOcr: this.config.enableImageOcr,
          ocrOptions: {
            maxImages: this.config.maxOcrImages,
          },
          enableAI: this.config.enableAI,
        }),
        timeout,
        `Analysis timeout after ${(timeout / 1000).toFixed(0)}s`
      );

      const processingTime = Date.now() - startTime;
      
      // 처리 시간 통계 업데이트 (성공 시만)
      if (result.success) {
        this.updateProcessingStats(processingTime);
      }

      if (result.success) {
        console.log(`  ✓ 점수: ${result.totalScore}/100 (${result.riskLevel})`);
        console.log(`  위반: ${result.violations?.length || 0}건, 경고: ${result.warnings?.length || 0}건`);
        if (result.ocrStats) {
          console.log(`  OCR: ${result.ocrStats.successfulOcr}/${result.ocrStats.processedImages} 이미지`);
        }
        console.log(`  처리 시간: ${(processingTime / 1000).toFixed(1)}초`);
      } else {
        console.log(`  분석 실패: ${result.error}`);
      }

      return {
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        url: hospital.homepageUrl,
        ...result,
        processingTimeMs: processingTime,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const isTimeout = error.message.includes('timeout') || error.message.includes('Timeout');
      
      if (isTimeout) {
        // 타임아웃 병원 기록
        this.recordTimeout(hospital, 'analysis_timeout', {
          elapsedMs: processingTime,
          errorMessage: error.message,
        });
        console.log(`  ⏱️ 타임아웃 (${(processingTime / 1000).toFixed(1)}초) - 다음 병원으로 스킵`);
      } else {
        console.log(`  ✗ 오류: ${error.message}`);
      }
      
      return {
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        url: hospital.homepageUrl,
        success: false,
        error: error.message,
        isTimeout,
        analyzedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
      };
    }
  }

  /**
   * 분석 결과 저장
   */
  saveAnalysisResult(hospital, result) {
    // 결과 디렉토리 생성
    if (!fs.existsSync(ANALYSIS_DIR)) {
      fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
    }

    // 날짜별 파일로 저장
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${hospital.id}.json`;
    const filepath = path.join(ANALYSIS_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');

    // hospitals.json 업데이트
    const hospitalIndex = this.hospitals.findIndex(h => h.id === hospital.id);
    if (hospitalIndex >= 0) {
      this.hospitals[hospitalIndex].lastAnalyzed = result.analyzedAt;
      this.hospitals[hospitalIndex].analysisCount = (this.hospitals[hospitalIndex].analysisCount || 0) + 1;
      this.hospitals[hospitalIndex].lastScore = result.totalScore;
      this.hospitals[hospitalIndex].lastRiskLevel = result.riskLevel;
      
      // hospitals.json 저장
      const hospitalsData = JSON.parse(fs.readFileSync(HOSPITALS_FILE, 'utf-8'));
      hospitalsData.hospitals = this.hospitals;
      hospitalsData.lastUpdated = new Date().toISOString();
      fs.writeFileSync(HOSPITALS_FILE, JSON.stringify(hospitalsData, null, 2), 'utf-8');
    }
  }

  /**
   * 배치 분석 실행
   */
  async runBatch(options = {}) {
    const {
      limit = null,  // 이번 실행에서 분석할 최대 수 (null = 설정된 한도까지)
    } = options;

    await this.initialize();

    // 분석 대상 선택
    let targets = this.selectHospitalsToAnalyze();
    if (limit) {
      targets = targets.slice(0, limit);
    }

    if (targets.length === 0) {
      console.log('\n분석할 병원이 없습니다 (일일 한도 도달 또는 모두 분석 완료)');
      return { analyzed: 0, targets: [] };
    }

    console.log(`\n분석 대상: ${targets.length}개 병원`);
    console.log('-'.repeat(60));

    const results = [];
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘 통계 초기화
    if (!this.batchLog.dailyStats[today]) {
      this.batchLog.dailyStats[today] = {
        analyzed: 0,
        success: 0,
        failed: 0,
        totalScore: 0,
        violations: 0,
        warnings: 0,
      };
    }

    for (let i = 0; i < targets.length; i++) {
      const hospital = targets[i];
      
      // 분석 실행
      const result = await this.analyzeHospital(hospital);
      results.push(result);

      // 결과 저장
      this.saveAnalysisResult(hospital, result);

      // 통계 업데이트
      this.batchLog.dailyStats[today].analyzed++;
      this.batchLog.totalAnalyzed++;
      this.todayCount++;

      if (result.success) {
        this.batchLog.dailyStats[today].success++;
        this.batchLog.dailyStats[today].totalScore += result.totalScore || 0;
        this.batchLog.dailyStats[today].violations += result.violations?.length || 0;
        this.batchLog.dailyStats[today].warnings += result.warnings?.length || 0;
      } else {
        this.batchLog.dailyStats[today].failed++;
        this.batchLog.errors.push({
          hospitalId: hospital.id,
          error: result.error,
          time: result.analyzedAt,
        });
      }

      // 로그 저장
      this.batchLog.lastRun = new Date().toISOString();
      this.saveBatchLog();

      // 딜레이 (마지막 아닐 때만)
      if (i < targets.length - 1) {
        await this.delay(this.config.delayBetweenAnalysis);
      }
    }

    // 최종 결과 출력
    this.printSummary(results);

    // 오탐 패턴 자동 학습 (배치 분석 후 실행)
    await this.runPatternLearning();

    return { analyzed: results.length, results };
  }

  /**
   * 오탐 패턴 자동 학습
   */
  async runPatternLearning() {
    try {
      console.log('\n[배치 분석기] 오탐 패턴 자동 학습 시작...');
      const learner = new PatternLearner();
      const result = await learner.run({
        autoApply: true,      // 자동 적용
        minScore: 0.7,        // 70% 이상 신뢰도
        verbose: false,       // 조용한 모드
      });
      
      if (result.learned > 0) {
        console.log(`[배치 분석기] ${result.learned}개 오탐 패턴 자동 학습 완료`);
      } else {
        console.log(`[배치 분석기] 새로운 오탐 패턴 없음 (후보: ${result.candidates}개)`);
      }
    } catch (error) {
      console.error('[배치 분석기] 패턴 학습 실패:', error.message);
    }
  }

  /**
   * 요약 출력
   */
  printSummary(results) {
    const today = new Date().toISOString().split('T')[0];
    const stats = this.batchLog.dailyStats[today];
    
    console.log('\n' + '='.repeat(60));
    console.log('배치 분석 완료');
    console.log('='.repeat(60));
    console.log(`분석 완료: ${results.length}개`);
    console.log(`성공: ${stats.success}개, 실패: ${stats.failed}개`);
    
    if (stats.success > 0) {
      const avgScore = (stats.totalScore / stats.success).toFixed(1);
      console.log(`평균 점수: ${avgScore}/100`);
      console.log(`총 위반: ${stats.violations}건, 총 경고: ${stats.warnings}건`);
    }
    
    console.log(`\n오늘 총 분석: ${this.todayCount}/${this.config.dailyLimit}`);
    console.log(`누적 분석: ${this.batchLog.totalAnalyzed}개`);
    console.log('='.repeat(60));
  }

  /**
   * 딜레이 유틸리티
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 분석 현황 리포트
   */
  getStatusReport() {
    const analyzed = this.hospitals.filter(h => h.lastAnalyzed);
    const withUrl = this.hospitals.filter(h => h.homepageUrl);
    const pending = this.selectHospitalsToAnalyze();
    
    const scoreDistribution = {
      excellent: analyzed.filter(h => h.lastScore >= 90).length,
      good: analyzed.filter(h => h.lastScore >= 70 && h.lastScore < 90).length,
      warning: analyzed.filter(h => h.lastScore >= 50 && h.lastScore < 70).length,
      critical: analyzed.filter(h => h.lastScore < 50).length,
    };

    return {
      total: this.hospitals.length,
      withUrl: withUrl.length,
      analyzed: analyzed.length,
      pending: pending.length,
      todayRemaining: this.config.dailyLimit - this.todayCount,
      scoreDistribution,
      batchLog: this.batchLog,
      timeoutLog: this.timeoutLog,
    };
  }
  
  /**
   * 타임아웃 분석 리포트
   */
  analyzeTimeouts() {
    const timeouts = this.timeoutLog.timeoutHospitals;
    
    if (timeouts.length === 0) {
      console.log('\n타임아웃된 병원이 없습니다.');
      return { count: 0, analysis: null };
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('타임아웃 병원 분석 리포트');
    console.log('='.repeat(60));
    console.log(`총 타임아웃: ${timeouts.length}개`);
    
    // URL 패턴 분석
    const urlPatterns = {};
    for (const t of timeouts) {
      try {
        const url = new URL(t.url);
        const domain = url.hostname.replace(/^www\./, '');
        urlPatterns[domain] = (urlPatterns[domain] || 0) + 1;
      } catch (e) {
        urlPatterns['invalid_url'] = (urlPatterns['invalid_url'] || 0) + 1;
      }
    }
    
    // 타임아웃 원인 분류
    const reasons = {};
    for (const t of timeouts) {
      reasons[t.reason] = (reasons[t.reason] || 0) + 1;
    }
    
    console.log('\n[원인별 분류]');
    for (const [reason, count] of Object.entries(reasons)) {
      console.log(`  ${reason}: ${count}건`);
    }
    
    console.log('\n[타임아웃 병원 목록]');
    for (const t of timeouts.slice(0, 20)) {
      console.log(`  - ${t.name}`);
      console.log(`    URL: ${t.url}`);
      console.log(`    시간: ${t.timestamp}`);
      console.log(`    경과: ${(t.elapsedMs / 1000).toFixed(1)}초 / 임계: ${(t.timeoutThreshold / 1000).toFixed(0)}초`);
    }
    
    if (timeouts.length > 20) {
      console.log(`  ... 그 외 ${timeouts.length - 20}개`);
    }
    
    // 시스템 개선 제안
    const analysis = {
      totalTimeouts: timeouts.length,
      urlPatterns,
      reasons,
      suggestions: [],
    };
    
    // 제안 생성
    if (Object.keys(urlPatterns).length < timeouts.length * 0.5) {
      analysis.suggestions.push('특정 도메인에서 반복 타임아웃 발생 - 해당 사이트 특성 분석 필요');
    }
    if (reasons['analysis_timeout'] > timeouts.length * 0.8) {
      analysis.suggestions.push('분석 자체 타임아웃 다수 - AI 호출 최적화 또는 타임아웃 임계값 조정 필요');
    }
    
    console.log('\n[시스템 개선 제안]');
    if (analysis.suggestions.length === 0) {
      console.log('  - 특별한 패턴 발견되지 않음');
    } else {
      for (const s of analysis.suggestions) {
        console.log(`  - ${s}`);
      }
    }
    
    // 개선 자료로 저장
    this.timeoutLog.analysisForImprovement.push({
      timestamp: new Date().toISOString(),
      count: timeouts.length,
      urlPatterns,
      reasons,
      suggestions: analysis.suggestions,
    });
    this.saveTimeoutLog();
    
    console.log('='.repeat(60));
    
    return analysis;
  }
  
  /**
   * 타임아웃 병원 재시도
   */
  async retryTimeouts(options = {}) {
    const { limit = 10, clearAfterRetry = false } = options;
    
    const timeouts = this.timeoutLog.timeoutHospitals.slice(0, limit);
    if (timeouts.length === 0) {
      console.log('재시도할 타임아웃 병원이 없습니다.');
      return { retried: 0 };
    }
    
    console.log(`\n타임아웃 병원 ${timeouts.length}개 재시도...`);
    
    const results = [];
    for (const t of timeouts) {
      const hospital = this.hospitals.find(h => h.id === t.id);
      if (!hospital) continue;
      
      const result = await this.analyzeHospital(hospital);
      results.push(result);
      
      if (result.success) {
        // 성공 시 타임아웃 목록에서 제거
        this.timeoutLog.timeoutHospitals = this.timeoutLog.timeoutHospitals.filter(
          h => h.id !== t.id
        );
        this.saveTimeoutLog();
        this.saveAnalysisResult(hospital, result);
      }
      
      await this.delay(this.config.delayBetweenAnalysis);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n재시도 완료: ${successCount}/${results.length} 성공`);
    
    if (clearAfterRetry) {
      this.timeoutLog.timeoutHospitals = [];
      this.saveTimeoutLog();
    }
    
    return { retried: results.length, success: successCount, results };
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const batchAnalyzer = new BatchAnalyzer();

  if (args.includes('--status')) {
    await batchAnalyzer.initialize();
    const report = batchAnalyzer.getStatusReport();
    console.log('\n=== 분석 현황 리포트 ===');
    console.log(JSON.stringify(report, null, 2));
  } else if (args.includes('--learn')) {
    // 오탐 패턴 학습만 실행
    const apply = args.includes('--apply');
    const learner = new PatternLearner();
    await learner.run({
      autoApply: apply,
      minScore: 0.7,
      verbose: true,
    });
  } else if (args.includes('--run')) {
    const limitArg = args.find(a => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
    await batchAnalyzer.runBatch({ limit });
  } else if (args.includes('--test')) {
    // 테스트: 1개만 분석
    await batchAnalyzer.runBatch({ limit: 1 });
  } else if (args.includes('--timeouts')) {
    // 타임아웃 병원 분석
    await batchAnalyzer.initialize();
    batchAnalyzer.analyzeTimeouts();
  } else if (args.includes('--retry-timeouts')) {
    // 타임아웃 병원 재시도
    const limitArg = args.find(a => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
    await batchAnalyzer.initialize();
    await batchAnalyzer.retryTimeouts({ limit });
  } else {
    console.log('사용법:');
    console.log('  node batch-analyzer.js --status           # 분석 현황 조회');
    console.log('  node batch-analyzer.js --test             # 테스트 (1개만 분석)');
    console.log('  node batch-analyzer.js --run              # 배치 분석 실행');
    console.log('  node batch-analyzer.js --run --limit=10   # 최대 10개만 분석');
    console.log('  node batch-analyzer.js --learn            # 오탐 패턴 분석 (적용 안 함)');
    console.log('  node batch-analyzer.js --learn --apply    # 오탐 패턴 분석 + 자동 적용');
    console.log('  node batch-analyzer.js --timeouts         # 타임아웃 병원 분석 리포트');
    console.log('  node batch-analyzer.js --retry-timeouts   # 타임아웃 병원 재시도');
  }
}

module.exports = BatchAnalyzer;

if (require.main === module) {
  main().catch(console.error);
}
