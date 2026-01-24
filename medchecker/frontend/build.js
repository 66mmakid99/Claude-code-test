/**
 * MEDCHECKER Build Script
 * Copies backend data to frontend for Cloudflare Pages deployment
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..', 'backend');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const analysesDir = path.join(DATA_DIR, 'analyses');
if (!fs.existsSync(analysesDir)) {
  fs.mkdirSync(analysesDir, { recursive: true });
}

console.log('📦 MEDCHECKER Build Script');
console.log('==========================');

// Load all analyses
function getAllAnalyses() {
  const analysisDir = path.join(BACKEND_DIR, 'data', 'analysis-results');
  if (!fs.existsSync(analysisDir)) {
    console.log('⚠️ No analysis-results directory found');
    return [];
  }
  
  const files = fs.readdirSync(analysisDir).filter(f => f.endsWith('.json'));
  const results = [];
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(analysisDir, file), 'utf-8'));
      results.push({
        id: data.hospitalId,
        hospitalName: data.hospitalName,
        url: data.url,
        score: data.totalScore,
        riskLevel: data.riskLevel,
        violations: data.violations || [],
        warnings: data.warnings || [],
        analyzedAt: data.analyzedAt,
        file: file
      });
    } catch (e) {
      console.log('⚠️ Error reading:', file);
    }
  }
  
  return results.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
}

// Build dashboard summary
function buildDashboard(analyses) {
  const totalViolations = analyses.reduce((sum, a) => sum + a.violations.length, 0);
  const totalWarnings = analyses.reduce((sum, a) => sum + a.warnings.length, 0);
  
  const ruleViolationCount = {};
  analyses.forEach(a => {
    a.violations.forEach(v => {
      ruleViolationCount[v.ruleId] = (ruleViolationCount[v.ruleId] || 0) + 1;
    });
  });
  
  const scoreDistribution = {
    excellent: analyses.filter(a => a.score >= 90).length,
    good: analyses.filter(a => a.score >= 70 && a.score < 90).length,
    warning: analyses.filter(a => a.score >= 50 && a.score < 70).length,
    critical: analyses.filter(a => a.score < 50).length
  };
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalHospitals: analyses.length,
      withUrl: analyses.length,
      analyzed: analyses.length,
      totalViolations,
      totalWarnings,
      avgScore: analyses.length > 0 ? (analyses.reduce((sum, a) => sum + (a.score || 0), 0) / analyses.length).toFixed(1) : 0
    },
    scoreDistribution,
    ruleViolationCount,
    recentAnalyses: analyses.slice(0, 10)
  };
}

// Main build
console.log('📂 Reading analyses from backend...');
const analyses = getAllAnalyses();
console.log('   Found', analyses.length, 'analyses');

console.log('📊 Building dashboard data...');
const dashboard = buildDashboard(analyses);
fs.writeFileSync(path.join(DATA_DIR, 'dashboard.json'), JSON.stringify(dashboard, null, 2));
console.log('   ✅ dashboard.json');

console.log('🏥 Building hospitals data...');
fs.writeFileSync(path.join(DATA_DIR, 'hospitals.json'), JSON.stringify(analyses, null, 2));
console.log('   ✅ hospitals.json');

// Copy FP patterns if exists
const fpDbPath = path.join(BACKEND_DIR, 'data', 'false-positive-db.json');
if (fs.existsSync(fpDbPath)) {
  const fpData = JSON.parse(fs.readFileSync(fpDbPath, 'utf-8'));
  fs.writeFileSync(path.join(DATA_DIR, 'fp-patterns.json'), JSON.stringify({
    menuTexts: fpData.menuTexts || [],
    globalExclusions: fpData.globalExclusions || []
  }, null, 2));
  console.log('   ✅ fp-patterns.json');
}

console.log('');
console.log('✅ Build complete!');
console.log('   Dashboard: ' + dashboard.summary.analyzed + ' hospitals');
console.log('   Violations: ' + dashboard.summary.totalViolations);
console.log('   Warnings: ' + dashboard.summary.totalWarnings);
console.log('');
console.log('📁 Output directory: ' + DATA_DIR);
