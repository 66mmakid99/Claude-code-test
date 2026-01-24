/**
 * MEDCHECKER - 개선 루프 스크립트
 * 
 * 목적:
 * 1. 기존 분석 결과에서 오탐 패턴 학습
 * 2. 학습된 패턴 적용하여 재분석
 * 3. 개선률 측정 및 로그 기록
 * 4. 반복 (수렴할 때까지)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

// 경로
const RESULTS_DIR = path.join(__dirname, '..', 'data', 'analysis-results');
const FALSE_POSITIVE_DB = path.join(__dirname, '..', 'data', 'false-positive-db.json');
const IMPROVEMENT_LOG = path.join(__dirname, '..', 'data', 'improvement-log.json');
const HOSPITALS_FILE = path.join(__dirname, '..', 'data', 'hospitals', 'hospitals.json');

// 서비스 로드
const AnalyzerService = require('../services/analyzer-service');
const PatternLearner = require('./pattern-learner');

class ImprovementLoop {
  constructor() {
    this.analyzer = new AnalyzerService();
    this.patternLearner = new PatternLearner();
    this.loopLog = this.loadLog();
  }

  loadLog() {
    try {
      if (fs.existsSync(IMPROVEMENT_LOG)) {
        return JSON.parse(fs.readFileSync(IMPROVEMENT_LOG, 'utf-8'));
      }
    } catch (e) {}
    return {
      iterations: [],
      startedAt: new Date().toISOString(),
      lastUpdated: null
    };
  }

  saveLog() {
    this.loopLog.lastUpdated = new Date().toISOString();
    fs.writeFileSync(IMPROVEMENT_LOG, JSON.stringify(this.loopLog, null, 2));
  }

  /**
   * 현재 분석 결과 통계 수집
   */
  getAnalysisStats() {
    const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
    
    let totalViolations = 0;
    let totalWarnings = 0;
    let totalFiltered = 0;
    let analyzedCount = 0;
    const ruleViolationCount = {};
    
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
        
        // 새 구조: violations가 최상위에 있음
        if (!data.violations && !data.analysis) continue;
        
        analyzedCount++;
        const violations = data.violations || data.analysis?.violations || [];
        const warnings = data.warnings || data.analysis?.warnings || [];
        
        totalViolations += violations.length;
        totalWarnings += warnings.length;
        
        // 필터링된 항목 (오탐 방지로 제거된 항목)
        const filterStats = data.filterStats || data.analysis?.contextFiltering;
        if (filterStats) {
          totalFiltered += filterStats.violationsFiltered || 0;
        }
        
        // 규칙별 위반 수
        for (const v of violations) {
          const ruleId = v.ruleId || 'unknown';
          ruleViolationCount[ruleId] = (ruleViolationCount[ruleId] || 0) + 1;
        }
      } catch (e) {}
    }
    
    return {
      analyzedCount,
      totalViolations,
      totalWarnings,
      totalFiltered,
      avgViolationsPerSite: analyzedCount > 0 ? (totalViolations / analyzedCount).toFixed(2) : 0,
      ruleViolationCount
    };
  }

  /**
   * 오탐 패턴 DB 통계
   */
  getFalsePositiveStats() {
    try {
      if (fs.existsSync(FALSE_POSITIVE_DB)) {
        const db = JSON.parse(fs.readFileSync(FALSE_POSITIVE_DB, 'utf-8'));
        return {
          totalPatterns: db.patterns?.length || 0,
          aiVerified: (db.patterns || []).filter(p => p.source === 'ai_verified').length,
          autoLearned: (db.patterns || []).filter(p => p.source === 'auto_learned').length,
          menuPatterns: (db.patterns || []).filter(p => p.source === 'menu_pattern').length
        };
      }
    } catch (e) {}
    return { totalPatterns: 0, aiVerified: 0, autoLearned: 0, menuPatterns: 0 };
  }

  /**
   * 단일 루프 실행
   */
  async runIteration(options = {}) {
    const {
      reanalyzeLimit = 10,  // 재분석할 최대 병원 수
      forceReanalyze = false  // 이미 분석된 것도 재분석
    } = options;

    const iterationNumber = this.loopLog.iterations.length + 1;
    console.log('\n' + '='.repeat(60));
    console.log(`개선 루프 #${iterationNumber} 시작`);
    console.log('='.repeat(60));

    // 1. 현재 상태 기록
    const beforeStats = this.getAnalysisStats();
    const beforeFP = this.getFalsePositiveStats();
    
    console.log('\n[BEFORE] 현재 상태:');
    console.log(`  분석 완료: ${beforeStats.analyzedCount}개`);
    console.log(`  총 위반: ${beforeStats.totalViolations}건`);
    console.log(`  총 경고: ${beforeStats.totalWarnings}건`);
    console.log(`  필터링됨(오탐방지): ${beforeStats.totalFiltered}건`);
    console.log(`  평균 위반/사이트: ${beforeStats.avgViolationsPerSite}건`);
    console.log(`  오탐 패턴 DB: ${beforeFP.totalPatterns}개`);

    // 2. 패턴 학습 실행
    console.log('\n[STEP 1] 오탐 패턴 학습 중...');
    const learnResult = await this.patternLearner.run({ autoApply: true, minScore: 0.6 });
    const learnedCount = learnResult?.learnedPatterns || 0;
    console.log(`  학습된 패턴: ${learnedCount}개`);
    console.log(`  오탐 후보: ${learnResult?.candidatesCount || 0}개`);

    // 3. 위반이 많은 병원 재분석
    console.log(`\n[STEP 2] 위반 병원 재분석 (최대 ${reanalyzeLimit}개)...`);
    
    // 위반이 있는 분석 결과 찾기
    const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
    const toReanalyze = [];
    
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
        // 새 구조: violations가 최상위에 있음
        const violations = data.violations || data.analysis?.violations || [];
        const url = data.url || data.targetUrl;
        
        if (violations.length > 0 || forceReanalyze) {
          toReanalyze.push({
            file,
            url: url,
            hospitalId: data.hospitalId,
            violations: violations.length
          });
        }
      } catch (e) {}
    }
    
    // 위반 수로 정렬
    toReanalyze.sort((a, b) => b.violations - a.violations);
    const reanalyzeTargets = toReanalyze.slice(0, reanalyzeLimit);
    
    console.log(`  재분석 대상: ${reanalyzeTargets.length}개`);
    
    let reanalyzedCount = 0;
    let improvedCount = 0;
    
    for (const target of reanalyzeTargets) {
      try {
        console.log(`  - ${target.url} (기존 위반: ${target.violations}건)`);
        
        // 기존 결과 백업
        const oldPath = path.join(RESULTS_DIR, target.file);
        const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
        
        // 재분석
        const newResult = await this.analyzer.analyzeWebsite(target.url);
        
        if (newResult && newResult.violations) {
          const newViolations = newResult.violations.length;
          const improvement = target.violations - newViolations;
          
          if (improvement > 0) {
            improvedCount++;
            console.log(`    ✓ 개선됨: ${target.violations} → ${newViolations} (${improvement}건 감소)`);
          } else if (improvement < 0) {
            console.log(`    ! 증가: ${target.violations} → ${newViolations}`);
          } else {
            console.log(`    - 변화 없음`);
          }
          
          // 새 결과 저장
          fs.writeFileSync(oldPath, JSON.stringify({
            ...oldData,
            analysis: newResult,
            reanalyzedAt: new Date().toISOString(),
            previousViolations: target.violations
          }, null, 2));
          
          reanalyzedCount++;
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (e) {
        console.log(`    ! 오류: ${e.message}`);
      }
    }

    // 4. 결과 수집
    const afterStats = this.getAnalysisStats();
    const afterFP = this.getFalsePositiveStats();
    
    console.log('\n[AFTER] 개선 후 상태:');
    console.log(`  총 위반: ${afterStats.totalViolations}건 (${beforeStats.totalViolations - afterStats.totalViolations >= 0 ? '-' : '+'}${Math.abs(beforeStats.totalViolations - afterStats.totalViolations)})`);
    console.log(`  필터링됨(오탐방지): ${afterStats.totalFiltered}건`);
    console.log(`  평균 위반/사이트: ${afterStats.avgViolationsPerSite}건`);
    console.log(`  오탐 패턴 DB: ${afterFP.totalPatterns}개 (+${afterFP.totalPatterns - beforeFP.totalPatterns})`);
    
    // 5. 루프 로그 저장
    const iteration = {
      number: iterationNumber,
      timestamp: new Date().toISOString(),
      before: {
        violations: beforeStats.totalViolations,
        warnings: beforeStats.totalWarnings,
        filtered: beforeStats.totalFiltered,
        avgViolations: parseFloat(beforeStats.avgViolationsPerSite),
        fpPatterns: beforeFP.totalPatterns
      },
      after: {
        violations: afterStats.totalViolations,
        warnings: afterStats.totalWarnings,
        filtered: afterStats.totalFiltered,
        avgViolations: parseFloat(afterStats.avgViolationsPerSite),
        fpPatterns: afterFP.totalPatterns
      },
      improvement: {
        violationsReduced: beforeStats.totalViolations - afterStats.totalViolations,
        patternsLearned: learnedCount,
        reanalyzed: reanalyzedCount,
        improved: improvedCount
      }
    };
    
    this.loopLog.iterations.push(iteration);
    this.saveLog();
    
    console.log('\n[SUMMARY]');
    console.log(`  위반 감소: ${iteration.improvement.violationsReduced}건`);
    console.log(`  패턴 학습: ${iteration.improvement.patternsLearned}개`);
    console.log(`  재분석: ${iteration.improvement.reanalyzed}개 중 ${iteration.improvement.improved}개 개선`);
    console.log('='.repeat(60));
    
    this.saveLog();
    return iteration;
  }

  /**
   * 수렴할 때까지 루프 실행
   */
  async runUntilConvergence(options = {}) {
    const {
      maxIterations = 5,
      minImprovement = 1,  // 최소 개선량 (이 이하면 수렴으로 판단)
      reanalyzeLimit = 10
    } = options;

    console.log('='.repeat(60));
    console.log('MEDCHECKER 개선 루프 시작');
    console.log(`최대 반복: ${maxIterations}회`);
    console.log(`최소 개선량: ${minImprovement}건`);
    console.log('='.repeat(60));

    let converged = false;
    let iteration = 0;

    while (!converged && iteration < maxIterations) {
      iteration++;
      
      const result = await this.runIteration({
        reanalyzeLimit,
        forceReanalyze: false
      });
      
      // 수렴 체크
      if (result.improvement.violationsReduced <= minImprovement && 
          result.improvement.patternsLearned === 0) {
        console.log('\n✓ 수렴 완료! 더 이상의 개선이 없습니다.');
        converged = true;
      }
      
      // 다음 루프 전 대기
      if (!converged && iteration < maxIterations) {
        console.log('\n다음 루프까지 5초 대기...\n');
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // 최종 리포트
    console.log('\n' + '='.repeat(60));
    console.log('최종 개선 리포트');
    console.log('='.repeat(60));
    
    const totalViolationsReduced = this.loopLog.iterations.reduce(
      (sum, i) => sum + i.improvement.violationsReduced, 0
    );
    const totalPatternsLearned = this.loopLog.iterations.reduce(
      (sum, i) => sum + i.improvement.patternsLearned, 0
    );
    
    console.log(`총 반복: ${this.loopLog.iterations.length}회`);
    console.log(`총 위반 감소: ${totalViolationsReduced}건`);
    console.log(`총 패턴 학습: ${totalPatternsLearned}개`);
    
    if (this.loopLog.iterations.length > 0) {
      const first = this.loopLog.iterations[0];
      const last = this.loopLog.iterations[this.loopLog.iterations.length - 1];
      const improvementRate = first.before.violations > 0 
        ? ((first.before.violations - last.after.violations) / first.before.violations * 100).toFixed(1)
        : 0;
      console.log(`오탐률 개선: ${improvementRate}%`);
    }
    
    console.log('='.repeat(60));
    console.log(`로그 저장: ${IMPROVEMENT_LOG}`);
    
    return this.loopLog;
  }

  /**
   * 현재 상태 리포트
   */
  showReport() {
    console.log('='.repeat(60));
    console.log('MEDCHECKER 개선 루프 리포트');
    console.log('='.repeat(60));
    
    const stats = this.getAnalysisStats();
    const fpStats = this.getFalsePositiveStats();
    
    console.log('\n현재 분석 상태:');
    console.log(`  분석 완료: ${stats.analyzedCount}개`);
    console.log(`  총 위반: ${stats.totalViolations}건`);
    console.log(`  평균 위반/사이트: ${stats.avgViolationsPerSite}건`);
    
    console.log('\n오탐 패턴 DB:');
    console.log(`  총 패턴: ${fpStats.totalPatterns}개`);
    console.log(`  AI 검증: ${fpStats.aiVerified}개`);
    console.log(`  자동 학습: ${fpStats.autoLearned}개`);
    console.log(`  메뉴 패턴: ${fpStats.menuPatterns}개`);
    
    if (this.loopLog.iterations.length > 0) {
      console.log('\n개선 루프 히스토리:');
      for (const i of this.loopLog.iterations) {
        console.log(`  #${i.number}: 위반 ${i.before.violations}→${i.after.violations} (${i.improvement.violationsReduced >= 0 ? '-' : '+'}${Math.abs(i.improvement.violationsReduced)}), 패턴 +${i.improvement.patternsLearned}`);
      }
    }
    
    console.log('='.repeat(60));
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const loop = new ImprovementLoop();
  
  if (args.includes('--run')) {
    // 단일 루프 실행
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
    await loop.runIteration({ reanalyzeLimit: limit });
  } else if (args.includes('--converge')) {
    // 수렴까지 실행
    const maxIter = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '5');
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
    await loop.runUntilConvergence({ 
      maxIterations: maxIter, 
      reanalyzeLimit: limit 
    });
  } else if (args.includes('--report')) {
    loop.showReport();
  } else {
    console.log('사용법:');
    console.log('  node improvement-loop.js --run [--limit=N]     # 단일 개선 루프 실행');
    console.log('  node improvement-loop.js --converge [--max=N]  # 수렴까지 반복');
    console.log('  node improvement-loop.js --report              # 현재 상태 리포트');
  }
}

module.exports = ImprovementLoop;

if (require.main === module) {
  main().catch(console.error);
}
