/**
 * 단일 병원 재분석 스크립트
 * Usage: node scripts/analyze-single.js <hospital_id_or_url>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const AnalyzerService = require('../services/analyzer-service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOSPITALS_FILE = path.join(DATA_DIR, 'hospitals', 'hospitals.json');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis-results');

async function main() {
  const target = process.argv[2];
  
  if (!target) {
    console.error('Usage: node scripts/analyze-single.js <hospital_id_or_url>');
    process.exit(1);
  }
  
  // 병원 정보 로드
  const hospitalsData = JSON.parse(fs.readFileSync(HOSPITALS_FILE, 'utf-8'));
  let hospital = null;
  
  // ID로 검색
  hospital = hospitalsData.hospitals.find(h => h.id === target);
  
  // URL로 검색
  if (!hospital) {
    hospital = hospitalsData.hospitals.find(h => h.homepageUrl && h.homepageUrl.includes(target));
  }
  
  // 이름으로 검색
  if (!hospital) {
    hospital = hospitalsData.hospitals.find(h => h.name && h.name.includes(target));
  }
  
  if (!hospital) {
    console.error(`Hospital not found: ${target}`);
    process.exit(1);
  }
  
  console.log('\n====================================');
  console.log('MEDCHECKER - Single Hospital Analysis');
  console.log('====================================');
  console.log(`Hospital: ${hospital.name}`);
  console.log(`URL: ${hospital.homepageUrl}`);
  console.log(`ID: ${hospital.id}`);
  console.log('====================================\n');
  
  // 분석기 초기화
  const analyzer = new AnalyzerService();
  
  console.log('Starting analysis...\n');
  const startTime = Date.now();
  
  try {
    const result = await analyzer.analyzeWebsite(hospital.homepageUrl, {
      enableImageOcr: true,
      maxOcrImages: 5,
      enableAI: true,
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 결과에 병원 정보 추가
    result.hospitalId = hospital.id;
    result.hospitalName = hospital.name;
    
    // 결과 저장
    const today = new Date().toISOString().split('T')[0];
    const filename = `${today}-${hospital.id}.json`;
    const filepath = path.join(ANALYSIS_DIR, filename);
    
    // 기존 파일 백업
    const existingFiles = fs.readdirSync(ANALYSIS_DIR).filter(f => f.includes(hospital.id));
    if (existingFiles.length > 0) {
      console.log(`Found existing analysis: ${existingFiles[0]}`);
      const oldPath = path.join(ANALYSIS_DIR, existingFiles[0]);
      const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      console.log(`  Previous score: ${oldData.totalScore}`);
      console.log(`  Previous violations: ${oldData.violations?.length || 0}`);
      console.log(`  Previous warnings: ${oldData.warnings?.length || 0}`);
      
      // 기존 파일 삭제 (새 파일로 대체)
      if (existingFiles[0] !== filename) {
        fs.unlinkSync(oldPath);
      }
    }
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log('\n====================================');
    console.log('Analysis Complete');
    console.log('====================================');
    console.log(`Time: ${elapsed}s`);
    console.log(`Score: ${result.totalScore}`);
    console.log(`Risk Level: ${result.riskLevel}`);
    console.log(`Violations: ${result.violations?.length || 0}`);
    console.log(`Warnings: ${result.warnings?.length || 0}`);
    console.log(`Filtered: ${result.filterStats?.violationsFiltered || 0}`);
    console.log(`Saved to: ${filename}`);
    console.log('====================================\n');
    
    // 위반 사항 상세 출력
    if (result.violations && result.violations.length > 0) {
      console.log('VIOLATIONS:');
      result.violations.forEach((v, i) => {
        console.log(`\n[${i + 1}] ${v.ruleId} - ${v.ruleName}`);
        console.log(`    Matched: "${v.matchedText}"`);
        console.log(`    Severity: ${v.severity}`);
        console.log(`    Risk Score: ${v.riskScore}`);
        console.log(`    Context: ${v.contextWindow?.substring(0, 150)}...`);
      });
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\nWARNINGS:');
      result.warnings.forEach((w, i) => {
        console.log(`\n[${i + 1}] ${w.ruleId} - ${w.ruleName}`);
        console.log(`    Matched: "${w.matchedText}"`);
        console.log(`    Severity: ${w.severity}`);
      });
    }
    
    // 오탐 필터링 정보
    if (result.errorCollectorStats?.falsePositives?.length > 0) {
      console.log('\nFALSE POSITIVES (filtered):');
      result.errorCollectorStats.falsePositives.forEach(fp => {
        console.log(`  - "${fp.matchedText}" (${fp.ruleId}): ${fp.reason}`);
      });
    }
    
  } catch (error) {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
