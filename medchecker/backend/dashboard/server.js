/**
 * MEDCHECKER Dashboard Server
 * Monarch Money-inspired UI with hospital detail pages
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOSPITALS_FILE = path.join(DATA_DIR, 'hospitals', 'hospitals.json');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis-results');
const BATCH_LOG_FILE = path.join(DATA_DIR, 'batch-analysis-log.json');
const TIMEOUT_LOG_FILE = path.join(DATA_DIR, 'timeout-hospitals.json');
const FP_DB_FILE = path.join(DATA_DIR, 'false-positive-db.json');
const IMPROVEMENT_LOG_FILE = path.join(DATA_DIR, 'improvement-log.json');

const PORT = process.env.DASHBOARD_PORT || 3456;

function loadJSON(filepath, defaultValue = {}) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error loading ${filepath}:`, e.message);
  }
  return defaultValue;
}

// Get all analysis results
function getAllAnalyses() {
  const files = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
  const results = [];
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ANALYSIS_DIR, file), 'utf-8'));
      results.push({
        id: data.hospitalId,
        hospitalName: data.hospitalName,
        url: data.url,
        score: data.totalScore,
        riskLevel: data.riskLevel,
        violations: data.violations || [],
        warnings: data.warnings || [],
        analyzedAt: data.analyzedAt,
        processingTimeMs: data.processingTimeMs,
        ocrStats: data.ocrStats,
        filterStats: data.filterStats,
        file: file
      });
    } catch (e) {}
  }
  
  return results.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
}

// Get single hospital analysis by ID
function getHospitalAnalysis(hospitalId) {
  const files = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ANALYSIS_DIR, file), 'utf-8'));
      if (data.hospitalId === hospitalId) {
        return data;
      }
    } catch (e) {}
  }
  return null;
}

// Dashboard summary data
function getDashboardData() {
  const hospitals = loadJSON(HOSPITALS_FILE, { hospitals: [] });
  const batchLog = loadJSON(BATCH_LOG_FILE, {});
  const timeoutLog = loadJSON(TIMEOUT_LOG_FILE, { timeoutHospitals: [] });
  const fpDb = loadJSON(FP_DB_FILE, { menuTexts: [], globalExclusions: [], fpHistory: [] });
  const improvementLog = loadJSON(IMPROVEMENT_LOG_FILE, { iterations: [] });
  
  const analyses = getAllAnalyses();
  
  const totalViolations = analyses.reduce((sum, a) => sum + a.violations.length, 0);
  const totalWarnings = analyses.reduce((sum, a) => sum + a.warnings.length, 0);
  const totalFiltered = analyses.reduce((sum, a) => sum + (a.filterStats?.violationsFiltered || 0), 0);
  
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
      totalHospitals: hospitals.hospitals?.length || 0,
      withUrl: hospitals.hospitals?.filter(h => h.homepageUrl).length || 0,
      analyzed: analyses.length,
      totalViolations,
      totalWarnings,
      totalFiltered,
      avgScore: analyses.length > 0 ? (analyses.reduce((sum, a) => sum + (a.score || 0), 0) / analyses.length).toFixed(1) : 0
    },
    scoreDistribution,
    ruleViolationCount,
    recentAnalyses: analyses.slice(0, 10),
    timeouts: timeoutLog.timeoutHospitals || [],
    fpPatterns: (fpDb.menuTexts?.length || 0) + (fpDb.globalExclusions?.length || 0),
    improvements: improvementLog.iterations?.length || 0
  };
}

// Main HTML
function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MEDCHECKER</title>
  <style>
    :root {
      --bg-dark: #0c1222;
      --bg-card: #151d2e;
      --bg-hover: #1a2539;
      --border: #2a3548;
      --text: #e8eaed;
      --text-secondary: #9aa0a6;
      --text-muted: #5f6368;
      --accent: #8ab4f8;
      --accent-green: #81c995;
      --accent-yellow: #fdd663;
      --accent-red: #f28b82;
      --accent-purple: #c58af9;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-dark);
      color: var(--text);
      min-height: 100vh;
      display: flex;
    }
    
    /* Sidebar */
    .sidebar {
      width: 240px;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      padding: 20px 0;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }
    
    .logo {
      padding: 0 20px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
    }
    
    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent), var(--accent-purple));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .nav-section {
      padding: 16px 12px 8px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
    
    .nav-item.active {
      background: rgba(138, 180, 248, 0.1);
      color: var(--accent);
      border-right: 3px solid var(--accent);
    }
    
    .nav-item .icon { font-size: 18px; width: 24px; text-align: center; }
    .nav-item .badge {
      margin-left: auto;
      background: var(--accent-red);
      color: #000;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    /* Main Content */
    .main {
      margin-left: 240px;
      flex: 1;
      padding: 24px 32px;
      min-height: 100vh;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: 500;
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(129, 201, 149, 0.15);
      border: 1px solid rgba(129, 201, 149, 0.3);
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      color: var(--accent-green);
    }
    
    .live-dot {
      width: 6px;
      height: 6px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    
    .stat-card .label {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .stat-card .value {
      font-size: 28px;
      font-weight: 600;
    }
    
    .stat-card .value.blue { color: var(--accent); }
    .stat-card .value.green { color: var(--accent-green); }
    .stat-card .value.yellow { color: var(--accent-yellow); }
    .stat-card .value.red { color: var(--accent-red); }
    
    .stat-card .sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    
    /* Score Distribution */
    .score-bars {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }
    
    .score-bar-item {
      flex: 1;
      text-align: center;
      padding: 12px 8px;
      border-radius: 8px;
      transition: transform 0.2s;
      cursor: pointer;
    }
    
    .score-bar-item:hover { transform: scale(1.05); }
    .score-bar-item.excellent { background: rgba(129, 201, 149, 0.15); }
    .score-bar-item.good { background: rgba(138, 180, 248, 0.15); }
    .score-bar-item.warning { background: rgba(253, 214, 99, 0.15); }
    .score-bar-item.critical { background: rgba(242, 139, 130, 0.15); }
    
    .score-bar-item .num {
      font-size: 20px;
      font-weight: 600;
    }
    .score-bar-item.excellent .num { color: var(--accent-green); }
    .score-bar-item.good .num { color: var(--accent); }
    .score-bar-item.warning .num { color: var(--accent-yellow); }
    .score-bar-item.critical .num { color: var(--accent-red); }
    
    .score-bar-item .lbl {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    
    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .card-header h2 {
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .card-body {
      padding: 16px 20px;
    }
    
    /* Hospital List */
    .hospital-list {
      display: flex;
      flex-direction: column;
    }
    
    .hospital-row {
      display: grid;
      grid-template-columns: 1fr 100px 80px 100px 120px;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
      align-items: center;
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .hospital-row:hover {
      background: var(--bg-hover);
      margin: 0 -20px;
      padding-left: 20px;
      padding-right: 20px;
    }
    
    .hospital-row:last-child { border-bottom: none; }
    
    .hospital-name {
      font-size: 14px;
      font-weight: 500;
    }
    
    .hospital-url {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      font-size: 16px;
      font-weight: 600;
    }
    
    .score-badge.excellent { background: rgba(129, 201, 149, 0.2); color: var(--accent-green); }
    .score-badge.good { background: rgba(138, 180, 248, 0.2); color: var(--accent); }
    .score-badge.warning { background: rgba(253, 214, 99, 0.2); color: var(--accent-yellow); }
    .score-badge.critical { background: rgba(242, 139, 130, 0.2); color: var(--accent-red); }
    
    .violation-count {
      font-size: 14px;
      color: var(--accent-red);
      font-weight: 500;
    }
    
    .violation-count.zero { color: var(--accent-green); }
    
    .risk-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .risk-badge.low { background: rgba(129, 201, 149, 0.2); color: var(--accent-green); }
    .risk-badge.medium { background: rgba(253, 214, 99, 0.2); color: var(--accent-yellow); }
    .risk-badge.high { background: rgba(242, 139, 130, 0.2); color: var(--accent-red); }
    
    .date-text {
      font-size: 12px;
      color: var(--text-muted);
    }
    
    /* Search & Filter */
    .search-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .search-input {
      flex: 1;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      color: var(--text);
      font-size: 14px;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .search-input::placeholder { color: var(--text-muted); }
    
    .filter-btn {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .filter-btn:hover { border-color: var(--accent); color: var(--text); }
    .filter-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(138, 180, 248, 0.1); }
    
    .filter-select {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      min-width: 150px;
    }
    
    .filter-select:focus { outline: none; border-color: var(--accent); }
    .filter-select option { background: var(--bg-card); color: var(--text); }
    
    /* Rule Chart */
    .rule-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }
    
    .rule-id {
      font-size: 12px;
      color: var(--text-secondary);
      width: 100px;
      font-family: monospace;
    }
    
    .rule-bar {
      flex: 1;
      height: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .rule-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-red), var(--accent-yellow));
      border-radius: 4px;
    }
    
    .rule-count {
      font-size: 13px;
      font-weight: 500;
      width: 32px;
      text-align: right;
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
    
    /* Detail Page */
    .detail-header {
      display: flex;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 32px;
    }
    
    .detail-score {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      flex-shrink: 0;
    }
    
    .detail-info h1 {
      font-size: 24px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    
    .detail-info .url {
      color: var(--accent);
      font-size: 14px;
      text-decoration: none;
    }
    
    .detail-info .url:hover { text-decoration: underline; }
    
    .detail-meta {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .detail-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    /* Violation Detail */
    .violation-item {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    
    .violation-rule {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .violation-rule .id {
      font-family: monospace;
      font-size: 12px;
      color: var(--accent);
      background: rgba(138, 180, 248, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .violation-rule .name {
      font-size: 14px;
      font-weight: 500;
    }
    
    .severity-badge {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .severity-badge.high { background: var(--accent-red); color: #000; }
    .severity-badge.medium { background: var(--accent-yellow); color: #000; }
    .severity-badge.low { background: var(--accent-green); color: #000; }
    
    .violation-text {
      background: var(--bg-card);
      border-left: 3px solid var(--accent-red);
      padding: 12px 16px;
      font-size: 13px;
      border-radius: 0 4px 4px 0;
      margin-bottom: 12px;
    }
    
    .violation-text .label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .violation-context {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    
    .violation-context .highlight {
      background: rgba(242, 139, 130, 0.3);
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    /* Back Button */
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 24px;
      padding: 8px 0;
    }
    
    .back-btn:hover { color: var(--accent); }
    
    /* Tabs */
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    
    .tab {
      padding: 12px 20px;
      font-size: 14px;
      color: var(--text-secondary);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all 0.15s;
    }
    
    .tab:hover { color: var(--text); }
    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-dark); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
    
    /* Violation Detail Card */
    .violation-detail-card {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    
    .violation-detail-card .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .confidence-badge {
      background: rgba(138, 180, 248, 0.2);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .violation-section {
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .matched-text-box {
      background: rgba(242, 139, 130, 0.15);
      border-left: 4px solid var(--accent-red);
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 500;
      color: var(--accent-red);
      border-radius: 0 8px 8px 0;
    }
    
    .context-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    
    .context-sentence {
      font-size: 14px;
      line-height: 1.7;
      color: var(--text);
    }
    
    .context-sentence .highlight,
    mark.highlight {
      background: rgba(242, 139, 130, 0.3);
      color: var(--accent-red);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    
    .extended-context {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      line-height: 1.6;
    }
    
    .context-before, .context-after {
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .context-matched {
      color: var(--text);
      padding: 8px 0;
      font-weight: 500;
    }
    
    .ctx-label {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      margin-right: 8px;
    }
    
    .legal-box {
      background: rgba(197, 138, 249, 0.1);
      border: 1px solid rgba(197, 138, 249, 0.3);
      border-radius: 8px;
      padding: 16px;
    }
    
    .legal-basis {
      font-size: 14px;
      color: var(--text);
      margin-bottom: 8px;
    }
    
    .legal-penalty {
      font-size: 13px;
      color: var(--accent-red);
    }
    
    .recommendation-box {
      background: rgba(129, 201, 149, 0.1);
      border: 1px solid rgba(129, 201, 149, 0.3);
      border-radius: 8px;
      padding: 16px;
    }
    
    .rec-action {
      font-size: 14px;
      color: var(--text);
      margin-bottom: 12px;
    }
    
    .rec-examples {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .rec-example {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    
    .rec-example.bad {
      background: rgba(242, 139, 130, 0.1);
    }
    
    .rec-example.good {
      background: rgba(129, 201, 149, 0.1);
    }
    
    .ex-label {
      flex-shrink: 0;
      font-weight: 500;
    }
    
    .ex-text {
      color: var(--text-secondary);
    }
    
    .evidence-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    
    .evidence-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .evidence-item:last-child {
      border-bottom: none;
    }
    
    .ev-type {
      background: rgba(138, 180, 248, 0.2);
      color: var(--accent);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .ev-text {
      font-size: 13px;
      color: var(--text);
    }
    
    .ev-pattern {
      font-family: monospace;
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-dark);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    /* Warning variants */
    .warning-card .violation-header {
      border-bottom-color: rgba(253, 214, 99, 0.3);
    }
    
    .matched-text-box.warning {
      background: rgba(253, 214, 99, 0.15);
      border-left-color: var(--accent-yellow);
      color: var(--accent-yellow);
    }
    
    mark.highlight.warning {
      background: rgba(253, 214, 99, 0.3);
      color: var(--accent-yellow);
    }
    
    .legal-box.warning {
      background: rgba(253, 214, 99, 0.1);
      border-color: rgba(253, 214, 99, 0.3);
    }
    
    .legal-article {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    
    /* FP Patterns Styles */
    .fp-type-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .fp-type-item:last-child { border-bottom: none; }
    
    .fp-type-name {
      font-size: 13px;
      color: var(--text);
      width: 120px;
      flex-shrink: 0;
    }
    
    .fp-type-bar {
      flex: 1;
      height: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .fp-type-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-purple));
      border-radius: 4px;
    }
    
    .fp-type-count {
      font-size: 13px;
      font-weight: 500;
      width: 40px;
      text-align: right;
      color: var(--text-secondary);
    }
    
    .pattern-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .pattern-tag {
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .pattern-tag.menu {
      background: rgba(138, 180, 248, 0.15);
      color: var(--accent);
      border: 1px solid rgba(138, 180, 248, 0.3);
    }
    
    .pattern-tag.global {
      background: rgba(129, 201, 149, 0.15);
      color: var(--accent-green);
      border: 1px solid rgba(129, 201, 149, 0.3);
    }
    
    .fp-history-item {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 10px;
    }
    
    .fp-history-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .fp-history-text {
      font-size: 14px;
      font-weight: 500;
      color: var(--accent-yellow);
    }
    
    .fp-history-meta {
      display: flex;
      gap: 8px;
    }
    
    .fp-rule-badge {
      font-family: monospace;
      font-size: 10px;
      padding: 3px 8px;
      background: rgba(138, 180, 248, 0.2);
      color: var(--accent);
      border-radius: 4px;
    }
    
    .fp-reason-badge {
      font-size: 10px;
      padding: 3px 8px;
      background: rgba(129, 201, 149, 0.2);
      color: var(--accent-green);
      border-radius: 4px;
    }
    
    .fp-reason-badge.info_only { background: rgba(253, 214, 99, 0.2); color: var(--accent-yellow); }
    .fp-reason-badge.menu_text { background: rgba(138, 180, 248, 0.2); color: var(--accent); }
    .fp-reason-badge.global_exclusion { background: rgba(129, 201, 149, 0.2); color: var(--accent-green); }
    .fp-reason-badge.login_protected { background: rgba(197, 138, 249, 0.2); color: var(--accent-purple); }
    
    .fp-history-details {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    
    .fp-domain {
      color: var(--text-secondary);
    }
    
    .fp-context {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      background: var(--bg-card);
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid var(--border);
    }
    
    /* FP Rule Items with Names */
    .fp-rule-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .fp-rule-item:last-child { border-bottom: none; }
    
    .fp-rule-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 200px;
    }
    
    .fp-rule-id {
      font-family: monospace;
      font-size: 11px;
      color: var(--accent);
    }
    
    .fp-rule-name {
      font-size: 12px;
      color: var(--text);
    }
    
    .fp-rule-bar {
      flex: 1;
      height: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .fp-rule-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-yellow), var(--accent-green));
      border-radius: 4px;
    }
    
    .fp-rule-count {
      font-size: 14px;
      font-weight: 600;
      width: 40px;
      text-align: right;
      color: var(--accent-yellow);
    }
    
    /* FP Explanation */
    .fp-explanation {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .fp-explain-item {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
    }
    
    .fp-explain-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 8px;
    }
    
    .fp-explain-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    
    /* View Toggle */
    .view-toggle {
      display: flex;
      gap: 4px;
      background: var(--bg-dark);
      padding: 4px;
      border-radius: 8px;
    }
    
    .view-btn {
      padding: 6px 12px;
      border: none;
      background: none;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      border-radius: 6px;
    }
    
    .view-btn.active {
      background: var(--bg-card);
      color: var(--text);
    }
    
    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
    }
    
    .page-btn {
      padding: 8px 14px;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    
    .page-btn:hover { border-color: var(--accent); color: var(--text); }
    .page-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    /* Violation Detail Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .modal-container {
      background: var(--bg-card);
      border-radius: 16px;
      width: 90%;
      max-width: 900px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: translateY(20px);
      transition: transform 0.3s ease;
    }
    
    .modal-overlay.active .modal-container {
      transform: translateY(0);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-dark);
    }
    
    .modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .modal-title .type-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .modal-title .type-badge.violation {
      background: rgba(242, 139, 130, 0.2);
      color: var(--accent-red);
    }
    
    .modal-title .type-badge.warning {
      background: rgba(253, 214, 99, 0.2);
      color: var(--accent-yellow);
    }
    
    .modal-nav {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .modal-nav-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    
    .modal-nav-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--text);
    }
    
    .modal-nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    
    .modal-counter {
      color: var(--text-muted);
      font-size: 13px;
      padding: 0 12px;
    }
    
    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      transition: color 0.2s;
    }
    
    .modal-close:hover {
      color: var(--text);
    }
    
    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    
    /* Clickable violation card */
    .violation-detail-card.clickable {
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .violation-detail-card.clickable:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .violation-card-index {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--bg-card);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .violation-detail-card {
      position: relative;
    }
    
    .click-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 12px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    }
    
    /* View Original Page Button */
    .view-original-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
      transition: all 0.2s;
    }
    
    .view-original-btn:hover {
      background: var(--bg-card);
      border-color: var(--accent);
      color: var(--accent);
    }
    
    .view-original-btn.highlight-btn {
      background: rgba(138, 180, 248, 0.1);
      border-color: rgba(138, 180, 248, 0.3);
    }
    
    .view-original-btn.highlight-btn:hover {
      background: rgba(138, 180, 248, 0.2);
      border-color: var(--accent);
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <nav class="sidebar">
    <div class="logo">
      <div class="logo-icon">M</div>
      MEDCHECKER
    </div>
    
    <div class="nav-section">Overview</div>
    <a class="nav-item active" href="/" data-page="dashboard">
      <span class="icon">📊</span>
      Dashboard
    </a>
    
    <div class="nav-section">Analysis</div>
    <a class="nav-item" href="/hospitals" data-page="hospitals">
      <span class="icon">🏥</span>
      Hospitals
      <span class="badge" id="navHospitalCount">0</span>
    </a>
    <a class="nav-item" href="/violations" data-page="violations">
      <span class="icon">⚠️</span>
      Violations
      <span class="badge" id="navViolationCount">0</span>
    </a>
    
    <div class="nav-section">Learning</div>
    <a class="nav-item" href="/patterns" data-page="patterns">
      <span class="icon">🎯</span>
      FP Patterns
    </a>
    <a class="nav-item" href="/timeouts" data-page="timeouts">
      <span class="icon">⏱️</span>
      Timeouts
    </a>
  </nav>

  <!-- Main Content -->
  <main class="main" id="mainContent">
    <!-- Content loaded dynamically -->
  </main>
  
  <!-- Violation Detail Modal -->
  <div class="modal-overlay" id="violationModal">
    <div class="modal-container">
      <div class="modal-header">
        <div class="modal-title">
          <span class="type-badge" id="modalTypeBadge">Violation</span>
          <span id="modalRuleId">MED-XXX</span>
        </div>
        <div class="modal-nav">
          <button class="modal-nav-btn" id="modalPrev" onclick="navigateViolation(-1)">← Prev</button>
          <span class="modal-counter" id="modalCounter">1 / 3</span>
          <button class="modal-nav-btn" id="modalNext" onclick="navigateViolation(1)">Next →</button>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
      </div>
      <div class="modal-body" id="modalBody">
        <!-- Content loaded dynamically -->
      </div>
    </div>
  </div>

  <script>
    // State
    let currentPage = 'dashboard';
    let dashboardData = null;
    let hospitalsData = [];
    let fpData = null;
    let currentHospitalId = null;
    let filters = { search: '', risk: '', score: '', hasViolation: '' };
    let pagination = { page: 1, perPage: 20 };
    
    // Modal State
    let modalItems = [];  // Array of violations or warnings
    let modalType = 'violation';  // 'violation' or 'warning'
    let modalCurrentIndex = 0;
    let modalHospitalUrl = '';  // Hospital URL for "View Original" link
    
    // Router
    function navigate(page, params = {}) {
      currentPage = page;
      currentHospitalId = params.id || null;
      
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
      });
      
      render();
      
      // Update URL without reload
      const url = params.id ? \`/hospital/\${params.id}\` : \`/\${page === 'dashboard' ? '' : page}\`;
      history.pushState({ page, params }, '', url);
    }
    
    // Fetch data
    async function fetchData() {
      try {
        const [dashboard, hospitals, fp] = await Promise.all([
          fetch('/api/dashboard').then(r => r.json()),
          fetch('/api/hospitals').then(r => r.json()),
          fetch('/api/fp-patterns').then(r => r.json())
        ]);
        
        dashboardData = dashboard;
        hospitalsData = hospitals;
        fpData = fp;
        
        // Update nav badges
        document.getElementById('navHospitalCount').textContent = hospitals.length;
        document.getElementById('navViolationCount').textContent = dashboard.summary.totalViolations;
        
        render();
      } catch (e) {
        console.error('Fetch error:', e);
      }
    }
    
    // Render current page
    function render() {
      const main = document.getElementById('mainContent');
      
      switch (currentPage) {
        case 'dashboard':
          main.innerHTML = renderDashboard();
          break;
        case 'hospitals':
          main.innerHTML = renderHospitals();
          break;
        case 'violations':
          main.innerHTML = renderViolations();
          break;
        case 'patterns':
          main.innerHTML = renderPatterns();
          break;
        case 'timeouts':
          main.innerHTML = renderTimeouts();
          break;
        case 'hospital-detail':
          main.innerHTML = renderHospitalDetail();
          break;
        default:
          main.innerHTML = renderDashboard();
      }
      
      // Bind events
      bindEvents();
    }
    
    // Dashboard View
    function renderDashboard() {
      if (!dashboardData) return '<div class="empty-state">Loading...</div>';
      
      const s = dashboardData.summary;
      const sd = dashboardData.scoreDistribution;
      const rules = Object.entries(dashboardData.ruleViolationCount || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      const maxRule = rules.length > 0 ? rules[0][1] : 1;
      
      return \`
        <div class="header">
          <h1>Dashboard</h1>
          <div class="header-actions">
            <div class="live-badge">
              <div class="live-dot"></div>
              Live
            </div>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Analyzed</div>
            <div class="value blue">\${s.analyzed}</div>
            <div class="sub">of \${s.withUrl} hospitals</div>
          </div>
          <div class="stat-card">
            <div class="label">Avg Score</div>
            <div class="value green">\${s.avgScore}</div>
            <div class="sub">out of 100</div>
          </div>
          <div class="stat-card">
            <div class="label">Violations</div>
            <div class="value red">\${s.totalViolations}</div>
            <div class="sub">\${s.totalFiltered} filtered</div>
          </div>
          <div class="stat-card">
            <div class="label">Warnings</div>
            <div class="value yellow">\${s.totalWarnings}</div>
            <div class="sub">minor issues</div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2>📈 Score Distribution</h2>
          </div>
          <div class="card-body">
            <div class="score-bars">
              <div class="score-bar-item excellent" onclick="filterByScore('excellent')">
                <div class="num">\${sd.excellent}</div>
                <div class="lbl">90+ Excellent</div>
              </div>
              <div class="score-bar-item good" onclick="filterByScore('good')">
                <div class="num">\${sd.good}</div>
                <div class="lbl">70-89 Good</div>
              </div>
              <div class="score-bar-item warning" onclick="filterByScore('warning')">
                <div class="num">\${sd.warning}</div>
                <div class="lbl">50-69 Warning</div>
              </div>
              <div class="score-bar-item critical" onclick="filterByScore('critical')">
                <div class="num">\${sd.critical}</div>
                <div class="lbl">&lt;50 Critical</div>
              </div>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="card">
            <div class="card-header">
              <h2>🚨 Top Violations</h2>
            </div>
            <div class="card-body">
              \${rules.map(([id, count]) => \`
                <div class="rule-item">
                  <span class="rule-id">\${id}</span>
                  <div class="rule-bar">
                    <div class="rule-bar-fill" style="width: \${(count / maxRule) * 100}%"></div>
                  </div>
                  <span class="rule-count">\${count}</span>
                </div>
              \`).join('')}
              \${rules.length === 0 ? '<div class="empty-state">No violations</div>' : ''}
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h2>🕐 Recent Analyses</h2>
              <a href="/hospitals" class="filter-btn" onclick="event.preventDefault(); navigate('hospitals')">View All</a>
            </div>
            <div class="card-body">
              \${dashboardData.recentAnalyses.slice(0, 5).map(h => \`
                <div class="hospital-row" onclick="viewHospital('\${h.id}')" style="grid-template-columns: 1fr 60px 80px;">
                  <div>
                    <div class="hospital-name">\${h.hospitalName || 'Unknown'}</div>
                    <div class="hospital-url">\${h.url || ''}</div>
                  </div>
                  <div class="score-badge \${getScoreClass(h.score)}">\${h.score || 0}</div>
                  <div class="violation-count \${h.violations.length === 0 ? 'zero' : ''}">\${h.violations.length} issues</div>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>
      \`;
    }
    
    // Hospitals List View
    function renderHospitals() {
      let filtered = hospitalsData;
      
      if (filters.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(h => 
          (h.hospitalName || '').toLowerCase().includes(q) ||
          (h.url || '').toLowerCase().includes(q)
        );
      }
      
      if (filters.score) {
        filtered = filtered.filter(h => getScoreClass(h.score) === filters.score);
      }
      
      if (filters.risk) {
        filtered = filtered.filter(h => h.riskLevel === filters.risk);
      }
      
      if (filters.hasViolation) {
        if (filters.hasViolation === 'has') {
          filtered = filtered.filter(h => h.violations.length > 0);
        } else if (filters.hasViolation === 'none') {
          filtered = filtered.filter(h => h.violations.length === 0);
        }
      }
      
      const total = filtered.length;
      const start = (pagination.page - 1) * pagination.perPage;
      const paged = filtered.slice(start, start + pagination.perPage);
      const totalPages = Math.ceil(total / pagination.perPage);
      
      return \`
        <div class="header">
          <h1>Hospitals</h1>
          <div class="header-actions">
            <span style="color: var(--text-muted); font-size: 14px;">\${total} hospitals</span>
          </div>
        </div>
        
        <div class="search-bar">
          <input type="text" class="search-input" id="searchInput" placeholder="Search hospitals..." value="\${filters.search}">
          <select class="filter-select" id="riskFilter" onchange="setRiskFilter(this.value)">
            <option value="">All Risk Levels</option>
            <option value="high" \${filters.risk === 'high' ? 'selected' : ''}>🔴 High Risk</option>
            <option value="medium" \${filters.risk === 'medium' ? 'selected' : ''}>🟡 Medium Risk</option>
            <option value="low" \${filters.risk === 'low' ? 'selected' : ''}>🟢 Low Risk</option>
          </select>
          <select class="filter-select" id="scoreFilter" onchange="setScoreFilter(this.value)">
            <option value="">All Scores</option>
            <option value="critical" \${filters.score === 'critical' ? 'selected' : ''}>🔴 Critical (&lt;50)</option>
            <option value="warning" \${filters.score === 'warning' ? 'selected' : ''}>🟡 Warning (50-69)</option>
            <option value="good" \${filters.score === 'good' ? 'selected' : ''}>🔵 Good (70-89)</option>
            <option value="excellent" \${filters.score === 'excellent' ? 'selected' : ''}>🟢 Excellent (90+)</option>
          </select>
          <select class="filter-select" id="violationFilter" onchange="setViolationFilter(this.value)">
            <option value="">All Violations</option>
            <option value="has" \${filters.hasViolation === 'has' ? 'selected' : ''}>⚠️ Has Violations</option>
            <option value="none" \${filters.hasViolation === 'none' ? 'selected' : ''}>✅ No Violations</option>
          </select>
          <button class="filter-btn" onclick="clearFilters()">Clear</button>
        </div>
        
        <div class="card">
          <div class="card-body" style="padding: 0 20px;">
            <div class="hospital-list">
              \${paged.map(h => \`
                <div class="hospital-row" onclick="viewHospital('\${h.id}')">
                  <div>
                    <div class="hospital-name">\${h.hospitalName || 'Unknown'}</div>
                    <div class="hospital-url">\${h.url || ''}</div>
                  </div>
                  <div class="score-badge \${getScoreClass(h.score)}">\${h.score !== undefined ? h.score : '-'}</div>
                  <div class="violation-count \${h.violations.length === 0 ? 'zero' : ''}">\${h.violations.length}</div>
                  <div class="risk-badge \${h.riskLevel || 'low'}">\${h.riskLevel || 'low'}</div>
                  <div class="date-text">\${formatDate(h.analyzedAt)}</div>
                </div>
              \`).join('')}
              \${paged.length === 0 ? '<div class="empty-state">No hospitals found</div>' : ''}
            </div>
          </div>
        </div>
        
        \${totalPages > 1 ? \`
          <div class="pagination">
            <button class="page-btn" onclick="changePage(\${pagination.page - 1})" \${pagination.page === 1 ? 'disabled' : ''}>← Prev</button>
            \${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const p = pagination.page <= 3 ? i + 1 : pagination.page - 2 + i;
              if (p > totalPages) return '';
              return \`<button class="page-btn \${p === pagination.page ? 'active' : ''}" onclick="changePage(\${p})">\${p}</button>\`;
            }).join('')}
            <button class="page-btn" onclick="changePage(\${pagination.page + 1})" \${pagination.page === totalPages ? 'disabled' : ''}>Next →</button>
          </div>
        \` : ''}
      \`;
    }
    
    // Hospital Detail View
    function renderHospitalDetail() {
      const hospital = hospitalsData.find(h => h.id === currentHospitalId);
      if (!hospital) return '<div class="empty-state">Hospital not found</div>';
      
      return \`
        <a href="/hospitals" class="back-btn" onclick="event.preventDefault(); navigate('hospitals')">← Back to Hospitals</a>
        
        <div class="detail-header">
          <div class="detail-score score-badge \${getScoreClass(hospital.score)}" style="width: 80px; height: 80px; font-size: 28px;">
            \${hospital.score !== undefined ? hospital.score : '-'}
          </div>
          <div class="detail-info">
            <h1>\${hospital.hospitalName || 'Unknown Hospital'}</h1>
            <a href="\${hospital.url}" target="_blank" class="url">\${hospital.url || 'No URL'}</a>
            <div class="detail-meta">
              <span>📅 \${formatDateTime(hospital.analyzedAt)}</span>
              <span>⏱️ \${((hospital.processingTimeMs || 0) / 1000).toFixed(1)}s</span>
              <span class="risk-badge \${hospital.riskLevel || 'low'}">\${hospital.riskLevel || 'low'} risk</span>
            </div>
          </div>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
          <div class="stat-card">
            <div class="label">Score</div>
            <div class="value \${getScoreClass(hospital.score) === 'excellent' || getScoreClass(hospital.score) === 'good' ? 'green' : 'red'}">\${hospital.score || 0}</div>
          </div>
          <div class="stat-card">
            <div class="label">Violations</div>
            <div class="value red">\${hospital.violations.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">Warnings</div>
            <div class="value yellow">\${hospital.warnings.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">Filtered</div>
            <div class="value green">\${hospital.filterStats?.violationsFiltered || 0}</div>
          </div>
        </div>
        
        <div class="tabs">
          <div class="tab active" data-tab="violations">Violations (\${hospital.violations.length})</div>
          <div class="tab" data-tab="warnings">Warnings (\${hospital.warnings.length})</div>
          <div class="tab" data-tab="info">Info</div>
        </div>
        
        <div id="tabContent">
          \${renderViolationsTab(hospital)}
        </div>
      \`;
    }
    
    function renderViolationsTab(hospital) {
      if (hospital.violations.length === 0) {
        return '<div class="empty-state">✅ No violations found</div>';
      }
      
      return hospital.violations.map((v, index) => {
        const legal = v.legal || {};
        const rec = v.recommendation || {};
        const ext = v.extendedContext || {};
        const evidence = v.evidence || {};
        
        // Highlight matched text in context
        const highlightText = (text, matched) => {
          if (!text || !matched) return escapeHtml(text || '');
          const escaped = escapeHtml(text);
          const escapedMatch = escapeHtml(matched);
          return escaped.replace(new RegExp(escapedMatch, 'gi'), '<mark class="highlight">' + escapedMatch + '</mark>');
        };
        
        return \`
        <div class="violation-detail-card clickable" onclick="openViolationModal('violation', \${index})">
          <span class="violation-card-index">#\${index + 1}</span>
          <!-- Header -->
          <div class="violation-header">
            <div class="violation-rule">
              <span class="id">\${v.ruleId || 'Unknown'}</span>
              <span class="name">\${v.ruleName || ''}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="severity-badge \${v.severity || 'medium'}">\${v.severity || 'medium'}</span>
              \${v.confidence ? \`<span class="confidence-badge">\${(v.confidence * 100).toFixed(0)}%</span>\` : ''}
            </div>
          </div>
          
          <!-- Matched Text -->
          <div class="violation-section">
            <div class="section-title">🎯 탐지된 표현</div>
            <div class="matched-text-box">"\${escapeHtml(v.matchedText || '')}"</div>
          </div>
          
          <!-- Context Window -->
          \${v.contextWindow || ext.matchedSentence ? \`
          <div class="violation-section">
            <div class="section-title">📄 문맥 (Context)</div>
            <div class="context-box">
              \${ext.matchedSentence ? \`
                <div class="context-sentence">\${highlightText(ext.matchedSentence, v.matchedText)}</div>
              \` : \`
                <div class="context-sentence">\${highlightText(v.contextWindow, v.matchedText)}</div>
              \`}
            </div>
          </div>
          \` : ''}
          
          <!-- Extended Context (Before/After) -->
          \${ext.before || ext.after ? \`
          <div class="violation-section">
            <div class="section-title">📖 전후 맥락</div>
            <div class="extended-context">
              \${ext.before ? \`<div class="context-before"><span class="ctx-label">이전:</span> \${escapeHtml(ext.before.substring(0, 200))}...</div>\` : ''}
              <div class="context-matched">➡️ <mark class="highlight">\${escapeHtml(v.matchedText || '')}</mark></div>
              \${ext.after ? \`<div class="context-after"><span class="ctx-label">이후:</span> \${escapeHtml(ext.after.substring(0, 200))}...</div>\` : ''}
            </div>
          </div>
          \` : ''}
          
          <!-- Legal Basis -->
          \${legal.basis ? \`
          <div class="violation-section">
            <div class="section-title">⚖️ 법적 근거</div>
            <div class="legal-box">
              <div class="legal-basis"><strong>근거:</strong> \${escapeHtml(legal.basis)}</div>
              \${legal.penalty ? \`<div class="legal-penalty"><strong>벌칙:</strong> \${escapeHtml(legal.penalty)}</div>\` : ''}
            </div>
          </div>
          \` : ''}
          
          <!-- Recommendation -->
          \${rec.action ? \`
          <div class="violation-section">
            <div class="section-title">💡 개선 권고</div>
            <div class="recommendation-box">
              <div class="rec-action">\${escapeHtml(rec.action)}</div>
              \${rec.example ? \`
              <div class="rec-examples">
                <div class="rec-example bad">
                  <span class="ex-label">❌ 위반 예시:</span>
                  <span class="ex-text">"\${escapeHtml(rec.example.bad || '')}"</span>
                </div>
                <div class="rec-example good">
                  <span class="ex-label">✅ 권장 예시:</span>
                  <span class="ex-text">"\${escapeHtml(rec.example.good || '')}"</span>
                </div>
              </div>
              \` : ''}
            </div>
          </div>
          \` : ''}
          
          <!-- Evidence -->
          \${evidence.triggerMatches && evidence.triggerMatches.length > 0 ? \`
          <div class="violation-section">
            <div class="section-title">🔍 탐지 근거</div>
            <div class="evidence-box">
              \${evidence.triggerMatches.map(t => \`
                <div class="evidence-item">
                  <span class="ev-type">\${t.type || 'match'}</span>
                  <span class="ev-text">"\${escapeHtml(t.text || t.keyword || '')}"</span>
                  \${t.pattern ? \`<span class="ev-pattern">\${escapeHtml(t.pattern)}</span>\` : ''}
                </div>
              \`).join('')}
            </div>
          </div>
          \` : ''}
          
          <div class="click-hint">
            <span>👆</span> 클릭하여 상세 보기 (←→ 키로 네비게이션)
          </div>
        </div>
      \`;
      }).join('');
    }
    
    function renderWarningsTab(hospital) {
      if (hospital.warnings.length === 0) {
        return '<div class="empty-state">✅ No warnings</div>';
      }
      
      return hospital.warnings.map((w, index) => {
        const legal = w.legal || {};
        const rec = w.recommendation || {};
        const ext = w.extendedContext || {};
        
        const highlightText = (text, matched) => {
          if (!text || !matched) return escapeHtml(text || '');
          const escaped = escapeHtml(text);
          const escapedMatch = escapeHtml(matched);
          return escaped.replace(new RegExp(escapedMatch, 'gi'), '<mark class="highlight warning">' + escapedMatch + '</mark>');
        };
        
        return \`
        <div class="violation-detail-card warning-card clickable" onclick="openViolationModal('warning', \${index})">
          <span class="violation-card-index">#\${index + 1}</span>
          <div class="violation-header">
            <div class="violation-rule">
              <span class="id">\${w.ruleId || 'Unknown'}</span>
              <span class="name">\${w.ruleName || ''}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="severity-badge low">Warning</span>
              \${w.confidence ? \`<span class="confidence-badge">\${(w.confidence * 100).toFixed(0)}%</span>\` : ''}
            </div>
          </div>
          
          <div class="violation-section">
            <div class="section-title">🎯 탐지된 표현</div>
            <div class="matched-text-box warning">"\${escapeHtml(w.matchedText || '')}"</div>
          </div>
          
          \${w.contextWindow || ext.matchedSentence ? \`
          <div class="violation-section">
            <div class="section-title">📄 문맥 (Context)</div>
            <div class="context-box">
              \${ext.matchedSentence ? \`
                <div class="context-sentence">\${highlightText(ext.matchedSentence, w.matchedText)}</div>
              \` : \`
                <div class="context-sentence">\${highlightText(w.contextWindow, w.matchedText)}</div>
              \`}
            </div>
          </div>
          \` : ''}
          
          \${legal.basis ? \`
          <div class="violation-section">
            <div class="section-title">⚖️ 법적 근거</div>
            <div class="legal-box warning">
              <div class="legal-basis"><strong>근거:</strong> \${escapeHtml(legal.basis)}</div>
              \${legal.article ? \`<div class="legal-article"><strong>설명:</strong> \${escapeHtml(legal.article)}</div>\` : ''}
            </div>
          </div>
          \` : ''}
          
          \${rec.action ? \`
          <div class="violation-section">
            <div class="section-title">💡 개선 권고</div>
            <div class="recommendation-box">
              <div class="rec-action">\${escapeHtml(rec.action)}</div>
              \${rec.example ? \`
              <div class="rec-examples">
                <div class="rec-example bad">
                  <span class="ex-label">❌ 위반 예시:</span>
                  <span class="ex-text">"\${escapeHtml(rec.example.bad || '')}"</span>
                </div>
                <div class="rec-example good">
                  <span class="ex-label">✅ 권장 예시:</span>
                  <span class="ex-text">"\${escapeHtml(rec.example.good || '')}"</span>
                </div>
              </div>
              \` : ''}
            </div>
          </div>
          \` : ''}
          
          <div class="click-hint">
            <span>👆</span> 클릭하여 상세 보기 (←→ 키로 네비게이션)
          </div>
        </div>
      \`;
      }).join('');
    }
    
    function renderInfoTab(hospital) {
      return \`
        <div class="card">
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 12px; font-size: 14px;">
              <div style="color: var(--text-muted);">Hospital ID</div>
              <div>\${hospital.id}</div>
              <div style="color: var(--text-muted);">URL</div>
              <div><a href="\${hospital.url}" target="_blank" style="color: var(--accent);">\${hospital.url}</a></div>
              <div style="color: var(--text-muted);">Analyzed At</div>
              <div>\${formatDateTime(hospital.analyzedAt)}</div>
              <div style="color: var(--text-muted);">Processing Time</div>
              <div>\${((hospital.processingTimeMs || 0) / 1000).toFixed(1)} seconds</div>
              <div style="color: var(--text-muted);">OCR Images</div>
              <div>\${hospital.ocrStats?.processed || 0} / \${hospital.ocrStats?.total || 0}</div>
            </div>
          </div>
        </div>
      \`;
    }
    
    // Violations View
    function renderViolations() {
      const allViolations = [];
      hospitalsData.forEach(h => {
        h.violations.forEach(v => {
          allViolations.push({
            ...v,
            hospitalName: h.hospitalName,
            hospitalId: h.id,
            hospitalUrl: h.url
          });
        });
      });
      
      return \`
        <div class="header">
          <h1>All Violations</h1>
          <div class="header-actions">
            <span style="color: var(--text-muted); font-size: 14px;">\${allViolations.length} violations</span>
          </div>
        </div>
        
        <div class="card">
          <div class="card-body">
            \${allViolations.slice(0, 50).map(v => \`
              <div class="violation-item" onclick="viewHospital('\${v.hospitalId}')" style="cursor: pointer;">
                <div class="violation-header">
                  <div class="violation-rule">
                    <span class="id">\${v.ruleId || 'Unknown'}</span>
                    <span class="name">\${v.hospitalName}</span>
                  </div>
                  <span class="severity-badge \${v.severity || 'medium'}">\${v.severity || 'medium'}</span>
                </div>
                <div class="violation-text">
                  <div class="label">Matched Text</div>
                  "\${escapeHtml((v.matchedText || '').substring(0, 100))}"
                </div>
              </div>
            \`).join('')}
            \${allViolations.length === 0 ? '<div class="empty-state">No violations found</div>' : ''}
          </div>
        </div>
      \`;
    }
    
    // Patterns View
    function renderPatterns() {
      const fp = fpData || {};
      const stats = fp.stats || {};
      const byType = stats.byType || {};
      const byRule = stats.byRule || {};
      
      const menuTexts = fp.menuTexts || [];
      const globalExclusions = fp.globalExclusions || [];
      const fpHistory = (fp.fpHistory || []).slice(0, 50); // Recent 50
      
      // Sort by rule count
      const rulesSorted = Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 15);
      const maxRuleCount = rulesSorted.length > 0 ? rulesSorted[0][1] : 1;
      
      // Sort by type count
      const typesSorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
      
      return \`
        <div class="header">
          <h1>False Positive Patterns</h1>
          <div class="header-actions">
            <span style="color: var(--text-muted); font-size: 14px;">\${stats.totalFalsePositives || 0} total FPs from \${stats.totalAnalyzed || 0} analyses</span>
          </div>
        </div>
        
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Menu Texts</div>
            <div class="value blue">\${menuTexts.length}</div>
            <div class="sub">자동 제외 메뉴 텍스트</div>
          </div>
          <div class="stat-card">
            <div class="label">Global Exclusions</div>
            <div class="value green">\${globalExclusions.length}</div>
            <div class="sub">전역 제외 패턴</div>
          </div>
          <div class="stat-card">
            <div class="label">Total FPs</div>
            <div class="value yellow">\${stats.totalFalsePositives || 0}</div>
            <div class="sub">오탐으로 판정됨</div>
          </div>
          <div class="stat-card">
            <div class="label">Improvements</div>
            <div class="value purple">\${dashboardData?.improvements || 0}</div>
            <div class="sub">개선 반복 횟수</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- FP by Type -->
          <div class="card">
            <div class="card-header">
              <h2>📊 FP by Type</h2>
            </div>
            <div class="card-body">
              \${typesSorted.map(([type, count]) => \`
                <div class="fp-type-item">
                  <span class="fp-type-name">\${formatFpType(type)}</span>
                  <div class="fp-type-bar">
                    <div class="fp-type-bar-fill" style="width: \${(count / (stats.totalFalsePositives || 1)) * 100}%"></div>
                  </div>
                  <span class="fp-type-count">\${count}</span>
                </div>
              \`).join('')}
            </div>
          </div>
          
          <!-- FP by Rule -->
          <div class="card">
            <div class="card-header">
              <h2>📋 Top Rules with FPs</h2>
            </div>
            <div class="card-body">
              \${rulesSorted.map(([ruleId, count]) => \`
                <div class="fp-rule-item">
                  <div class="fp-rule-info">
                    <span class="fp-rule-id">\${ruleId}</span>
                    <span class="fp-rule-name">\${getRuleName(ruleId)}</span>
                  </div>
                  <div class="fp-rule-bar">
                    <div class="fp-rule-bar-fill" style="width: \${(count / maxRuleCount) * 100}%"></div>
                  </div>
                  <span class="fp-rule-count">\${count}</span>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>
        
        <!-- Explanation -->
        <div class="card" style="margin-top: 20px;">
          <div class="card-header">
            <h2>📖 오탐 필터링 시스템 설명</h2>
          </div>
          <div class="card-body">
            <div class="fp-explanation">
              <div class="fp-explain-item">
                <div class="fp-explain-title">🌍 전역 제외 (Global Exclusions)</div>
                <div class="fp-explain-desc">
                  모든 규칙에서 공통으로 제외되는 패턴입니다. 예: "동안"(성형 시술명이 아닌 일반 표현), 
                  "24시간"(진료시간 과장이 아닌 일반 표현), "무료"(정보성 표현) 등 문맥에 관계없이 
                  오탐이 자주 발생하는 표현들을 미리 등록해 필터링합니다.
                </div>
              </div>
              <div class="fp-explain-item">
                <div class="fp-explain-title">🍔 메뉴 텍스트 (Menu Texts)</div>
                <div class="fp-explain-desc">
                  홈페이지 네비게이션/메뉴에서 발견된 텍스트입니다. "시술 후기", "전후사진", "치료 경험" 등은 
                  메뉴 항목일 때는 위반이 아니지만, 본문에서 체험담으로 사용되면 위반입니다. 
                  HTML 구조 분석으로 메뉴 영역을 판별합니다.
                </div>
              </div>
              <div class="fp-explain-item">
                <div class="fp-explain-title">📊 오탐 유형별 분포</div>
                <div class="fp-explain-desc">
                  <strong>전역 제외:</strong> 사전 등록된 패턴 매칭 | 
                  <strong>메뉴 텍스트:</strong> 네비게이션 영역 감지 | 
                  <strong>정보성 텍스트:</strong> 광고가 아닌 정보 제공 목적 | 
                  <strong>문맥상 부정:</strong> AI 검증 결과 위반 아님 판정
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pattern Lists -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
          <!-- Menu Texts -->
          <div class="card">
            <div class="card-header">
              <h2>🍔 Menu Texts (\${menuTexts.length})</h2>
              <span style="font-size: 11px; color: var(--text-muted);">메뉴/네비게이션에서 발견된 텍스트</span>
            </div>
            <div class="card-body" style="max-height: 300px; overflow-y: auto;">
              <div class="pattern-tags">
                \${menuTexts.map(t => \`<span class="pattern-tag menu">\${escapeHtml(t)}</span>\`).join('')}
              </div>
            </div>
          </div>
          
          <!-- Global Exclusions -->
          <div class="card">
            <div class="card-header">
              <h2>🌍 Global Exclusions (\${globalExclusions.length})</h2>
              <span style="font-size: 11px; color: var(--text-muted);">모든 규칙에서 제외되는 패턴</span>
            </div>
            <div class="card-body" style="max-height: 300px; overflow-y: auto;">
              <div class="pattern-tags">
                \${globalExclusions.map(t => \`<span class="pattern-tag global">\${escapeHtml(t)}</span>\`).join('')}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Recent FP History -->
        <div class="card" style="margin-top: 20px;">
          <div class="card-header">
            <h2>📜 Recent FP History (최근 50개)</h2>
          </div>
          <div class="card-body" style="max-height: 500px; overflow-y: auto;">
            \${fpHistory.length === 0 ? '<div class="empty-state">No FP history</div>' : ''}
            \${fpHistory.map(fp => \`
              <div class="fp-history-item">
                <div class="fp-history-header">
                  <div class="fp-history-text">"\${escapeHtml(fp.matchedText || '')}"</div>
                  <div class="fp-history-meta">
                    <span class="fp-rule-badge">\${fp.ruleId || ''}</span>
                    <span class="fp-reason-badge \${fp.reason || ''}">\${formatFpType(fp.reason || '')}</span>
                  </div>
                </div>
                <div class="fp-history-details">
                  <span class="fp-domain">\${fp.domain || ''}</span>
                  <span class="fp-date">\${formatDate(fp.timestamp)}</span>
                </div>
                \${fp.context ? \`<div class="fp-context">\${escapeHtml(fp.context.substring(0, 150))}...</div>\` : ''}
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }
    
    function formatFpType(type) {
      const typeMap = {
        'global_exclusion': '전역 제외',
        'menu_text': '메뉴 텍스트',
        'known_menu_text': '알려진 메뉴',
        'info_only': '정보성 텍스트',
        'login_protected': '로그인 보호',
        'context_negative': '문맥상 부정',
        'context_mismatch': '문맥 불일치',
        'common_menu_pattern': '공통 메뉴 패턴',
        'news_headline': '뉴스 헤드라인',
        'footer': '푸터',
        'test': '테스트',
        'real_violation': '실제 위반',
        'auto_learned': '자동 학습'
      };
      return typeMap[type] || type;
    }
    
    function getRuleName(ruleId) {
      const ruleMap = {
        'MED-UN-001': '미승인/불법 시술 광고',
        'MED-UN-002': '오프라벨 사용 광고',
        'MED-UN-003': '해외 직구 의약품/기기 광고',
        'MED-UN-004': '민간요법/대체의학 광고',
        'MED-TM-001': '치료 효과 체험 후기',
        'MED-TM-002': '가짜/조작 후기',
        'MED-TM-003': '블로그/카페 체험단 후기',
        'MED-EFF-001': '치료효과 100% 보장 표현',
        'MED-EFF-002': '완치/완벽 보장 표현',
        'MED-EFF-003': '성공률/치료율 수치 표현',
        'MED-EFF-004': '부작용 없음 보장',
        'MED-EFF-005': '무통증 보장',
        'MED-EFF-006': '재발 없음 보장',
        'MED-EFF-007': '즉각적/빠른 효과 보장',
        'MED-BA-001': '치료 전후 사진 게시',
        'MED-BA-002': '전후 동영상 게시',
        'MED-BA-003': '타인 전후사진 무단 사용',
        'MED-EX-001': '객관적 근거 없는 최상급 표현',
        'MED-EX-002': '신기술/혁신 과장 표현',
        'MED-EX-003': '가짜 수상/인증 표시',
        'MED-EX-004': '시설/장비 과장',
        'MED-EX-005': '경험/실적 과장',
        'MED-EX-006': '진료시간 과장',
        'MED-CL-001': '유명인/연예인 추천 광고',
        'MED-CL-002': '의사/전문가 추천 가장',
        'MED-CL-003': '방송/언론 출연 과장',
        'MED-CP-001': '타 의료기관 비교/비방 광고',
        'MED-CP-002': '가격 비교 광고',
        'MED-CP-003': '암묵적 비교 광고',
        'MED-PR-001': '과도한 할인/가격 광고',
        'MED-PR-002': '미끼 가격 광고',
        'MED-PR-003': '긴급/마감 임박 유도',
        'MED-PR-004': '패키지/번들 과장',
        'MED-QU-001': '의료인 자격/경력 과장',
        'MED-QU-002': '학력/경력 허위 표기',
        'MED-QU-003': '가짜 자격증/인증 표시',
        'MED-SNS-001': 'SNS 의료광고 미심의',
        'MED-SNS-002': '인플루언서 협찬 미표기',
        'MED-BS-001': '의료인 아닌 자의 의료광고',
        'MED-BS-002': '수술 장면 공개',
        'MED-BS-003': '공포/불안 조장',
        'MED-SP-001': '성형수술 과장 광고',
        'MED-SP-002': '다이어트 시술 과장',
        'MED-SP-003': '탈모 치료 과장',
        'MED-AD-001': '광고 표기 누락 (협찬/체험단)',
        'MED-INFO-001': '일반적 홍보성 최상급 표현'
      };
      return ruleMap[ruleId] || ruleId;
    }
    
    // Timeouts View
    function renderTimeouts() {
      const timeouts = dashboardData?.timeouts || [];
      
      return \`
        <div class="header">
          <h1>Timeout Hospitals</h1>
          <div class="header-actions">
            <span style="color: var(--text-muted); font-size: 14px;">\${timeouts.length} timeouts</span>
          </div>
        </div>
        
        <div class="card">
          <div class="card-body">
            \${timeouts.map(t => \`
              <div class="hospital-row" style="grid-template-columns: 1fr 100px 120px;">
                <div>
                  <div class="hospital-name">\${t.name || 'Unknown'}</div>
                  <div class="hospital-url">\${t.url || ''}</div>
                </div>
                <div class="violation-count">\${((t.elapsedMs || 0) / 1000).toFixed(1)}s</div>
                <div class="date-text">\${formatDate(t.timestamp)}</div>
              </div>
            \`).join('')}
            \${timeouts.length === 0 ? '<div class="empty-state">No timeouts</div>' : ''}
          </div>
        </div>
      \`;
    }
    
    // Helpers
    function getScoreClass(score) {
      if (score >= 90) return 'excellent';
      if (score >= 70) return 'good';
      if (score >= 50) return 'warning';
      return 'critical';
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('ko-KR');
    }
    
    function formatDateTime(dateStr) {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('ko-KR');
    }
    
    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    // Actions
    function viewHospital(id) {
      currentHospitalId = id;
      navigate('hospital-detail', { id });
    }
    
    function filterByScore(score) {
      filters.score = score;
      pagination.page = 1;
      navigate('hospitals');
    }
    
    function toggleFilter(type, value) {
      filters[type] = filters[type] === value ? '' : value;
      pagination.page = 1;
      render();
    }
    
    function clearFilters() {
      filters = { search: '', risk: '', score: '', hasViolation: '' };
      pagination.page = 1;
      render();
    }
    
    function setRiskFilter(value) {
      filters.risk = value;
      pagination.page = 1;
      render();
    }
    
    function setScoreFilter(value) {
      filters.score = value;
      pagination.page = 1;
      render();
    }
    
    function setViolationFilter(value) {
      filters.hasViolation = value;
      pagination.page = 1;
      render();
    }
    
    function changePage(page) {
      pagination.page = page;
      render();
      window.scrollTo(0, 0);
    }
    
    // Event binding
    function bindEvents() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          filters.search = e.target.value;
          pagination.page = 1;
          render();
        });
      }
      
      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          const hospital = hospitalsData.find(h => h.id === currentHospitalId);
          if (hospital) {
            const tabContent = document.getElementById('tabContent');
            switch (tab.dataset.tab) {
              case 'violations':
                tabContent.innerHTML = renderViolationsTab(hospital);
                break;
              case 'warnings':
                tabContent.innerHTML = renderWarningsTab(hospital);
                break;
              case 'info':
                tabContent.innerHTML = renderInfoTab(hospital);
                break;
            }
          }
        });
      });
    }
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state) {
        currentPage = e.state.page;
        currentHospitalId = e.state.params?.id;
        render();
      }
    });
    
    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });
    
    // Parse URL on load
    function parseUrl() {
      const path = window.location.pathname;
      if (path.startsWith('/hospital/')) {
        const id = path.split('/')[2];
        currentHospitalId = id;
        currentPage = 'hospital-detail';
      } else if (path === '/hospitals') {
        currentPage = 'hospitals';
      } else if (path === '/violations') {
        currentPage = 'violations';
      } else if (path === '/patterns') {
        currentPage = 'patterns';
      } else if (path === '/timeouts') {
        currentPage = 'timeouts';
      } else {
        currentPage = 'dashboard';
      }
    }
    
    // Modal Functions
    function openViolationModal(type, index) {
      const hospital = hospitalsData.find(h => h.id === currentHospitalId);
      if (!hospital) return;
      
      modalType = type;
      modalItems = type === 'violation' ? hospital.violations : hospital.warnings;
      modalCurrentIndex = index;
      modalHospitalUrl = hospital.url || '';
      
      updateModalContent();
      document.getElementById('violationModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
      document.getElementById('violationModal').classList.remove('active');
      document.body.style.overflow = '';
    }
    
    function navigateViolation(direction) {
      const newIndex = modalCurrentIndex + direction;
      if (newIndex >= 0 && newIndex < modalItems.length) {
        modalCurrentIndex = newIndex;
        updateModalContent();
      }
    }
    
    function updateModalContent() {
      const item = modalItems[modalCurrentIndex];
      if (!item) return;
      
      // Update header
      const typeBadge = document.getElementById('modalTypeBadge');
      typeBadge.textContent = modalType === 'violation' ? 'Violation' : 'Warning';
      typeBadge.className = 'type-badge ' + modalType;
      
      document.getElementById('modalRuleId').textContent = item.ruleId + ' - ' + (item.ruleName || '');
      document.getElementById('modalCounter').textContent = (modalCurrentIndex + 1) + ' / ' + modalItems.length;
      
      // Update nav buttons
      document.getElementById('modalPrev').disabled = modalCurrentIndex === 0;
      document.getElementById('modalNext').disabled = modalCurrentIndex === modalItems.length - 1;
      
      // Update body content
      document.getElementById('modalBody').innerHTML = renderModalItemContent(item);
    }
    
    function renderModalItemContent(item) {
      const legal = item.legal || {};
      const rec = item.recommendation || {};
      const ext = item.extendedContext || {};
      const evidence = item.evidence || {};
      const isWarning = modalType === 'warning';
      
      const highlightText = (text, matched) => {
        if (!text || !matched) return escapeHtml(text || '');
        const escaped = escapeHtml(text);
        const escapedMatch = escapeHtml(matched);
        const highlightClass = isWarning ? 'highlight warning' : 'highlight';
        return escaped.replace(new RegExp(escapedMatch, 'gi'), '<mark class="' + highlightClass + '">' + escapedMatch + '</mark>');
      };
      
      return \`
        <!-- Severity & Confidence -->
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <span class="severity-badge \${item.severity || 'medium'}">\${item.severity || 'medium'}</span>
          \${item.confidence ? \`<span class="confidence-badge">Confidence: \${(item.confidence * 100).toFixed(0)}%</span>\` : ''}
          \${item.riskScore ? \`<span class="confidence-badge">Risk Score: \${item.riskScore}</span>\` : ''}
        </div>
        
        <!-- Matched Text -->
        <div class="violation-section">
          <div class="section-title">🎯 탐지된 표현</div>
          <div class="matched-text-box \${isWarning ? 'warning' : ''}">"\${escapeHtml(item.matchedText || '')}"</div>
        </div>
        
        <!-- Context Window -->
        \${item.contextWindow || ext.matchedSentence ? \`
        <div class="violation-section">
          <div class="section-title">📄 문맥 (Context)</div>
          <div class="context-box">
            \${ext.matchedSentence ? \`
              <div class="context-sentence">\${highlightText(ext.matchedSentence, item.matchedText)}</div>
            \` : \`
              <div class="context-sentence">\${highlightText(item.contextWindow, item.matchedText)}</div>
            \`}
          </div>
        </div>
        \` : ''}
        
        <!-- Extended Context (Before/After) -->
        \${ext.before || ext.after ? \`
        <div class="violation-section">
          <div class="section-title">📖 전후 맥락</div>
          <div class="extended-context">
            \${ext.before ? \`<div class="context-before"><span class="ctx-label">이전:</span> \${escapeHtml(ext.before.substring(0, 300))}...</div>\` : ''}
            <div class="context-matched">➡️ <mark class="\${isWarning ? 'highlight warning' : 'highlight'}">\${escapeHtml(item.matchedText || '')}</mark></div>
            \${ext.after ? \`<div class="context-after"><span class="ctx-label">이후:</span> \${escapeHtml(ext.after.substring(0, 300))}...</div>\` : ''}
          </div>
        </div>
        \` : ''}
        
        <!-- Legal Basis -->
        \${legal.basis ? \`
        <div class="violation-section">
          <div class="section-title">⚖️ 법적 근거</div>
          <div class="legal-box \${isWarning ? 'warning' : ''}">
            <div class="legal-basis"><strong>근거:</strong> \${escapeHtml(legal.basis)}</div>
            \${legal.article ? \`<div class="legal-article">\${escapeHtml(legal.article)}</div>\` : ''}
            \${legal.penalty ? \`<div class="legal-penalty"><strong>벌칙:</strong> \${escapeHtml(legal.penalty)}</div>\` : ''}
          </div>
        </div>
        \` : ''}
        
        <!-- Recommendation -->
        \${rec.action ? \`
        <div class="violation-section">
          <div class="section-title">💡 개선 권고</div>
          <div class="recommendation-box">
            <div class="rec-action">\${escapeHtml(rec.action)}</div>
            \${rec.fixReason ? \`
            <div style="margin-top: 8px; padding: 10px; background: rgba(138, 180, 248, 0.1); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
              <strong>수정 근거:</strong> \${escapeHtml(rec.fixReason)}
            </div>
            \` : ''}
            \${rec.example ? \`
            <div class="rec-examples" style="margin-top: 12px;">
              <div class="rec-example bad">
                <span class="ex-label">📝 실제 위반 문장:</span>
                <span class="ex-text">"\${escapeHtml(rec.example.bad || '')}"</span>
              </div>
              <div class="rec-example good">
                <span class="ex-label">✅ 수정안 (권장):</span>
                <span class="ex-text">"\${escapeHtml(rec.example.good || '')}"</span>
              </div>
            </div>
            \` : ''}
          </div>
        </div>
        \` : ''}
        
        <!-- Evidence -->
        \${evidence.triggerMatches && evidence.triggerMatches.length > 0 ? \`
        <div class="violation-section">
          <div class="section-title">🔍 탐지 근거</div>
          <div class="evidence-box">
            \${evidence.triggerMatches.map(t => \`
              <div class="evidence-item">
                <span class="ev-type">\${t.type || 'match'}</span>
                <span class="ev-text">"\${escapeHtml(t.text || t.keyword || '')}"</span>
                \${t.pattern ? \`<span class="ev-pattern">\${escapeHtml(t.pattern)}</span>\` : ''}
              </div>
            \`).join('')}
          </div>
        </div>
        \` : ''}
        
        <!-- Context Scores -->
        \${item.contextScores ? \`
        <div class="violation-section">
          <div class="section-title">📊 컨텍스트 점수</div>
          <div class="evidence-box">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <div><strong>Trigger:</strong> \${item.contextScores.triggerScore?.toFixed(2) || 0}</div>
              <div><strong>Aggravating:</strong> \${item.contextScores.aggravatingScore?.toFixed(2) || 0}</div>
              <div><strong>Mitigating:</strong> \${item.contextScores.mitigatingScore?.toFixed(2) || 0}</div>
              <div><strong>Final:</strong> <span style="color: var(--accent-red); font-weight: 600;">\${item.finalScore?.toFixed(2) || 0}</span></div>
            </div>
          </div>
        </div>
        \` : ''}
        
        <!-- View Original Page Link -->
        \${modalHospitalUrl ? \`
        <div class="violation-section">
          <div class="section-title">🔗 원본 페이지에서 확인</div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <a href="\${modalHospitalUrl}" target="_blank" class="view-original-btn" onclick="event.stopPropagation();">
              🌐 원본 페이지 열기
            </a>
            <a href="\${modalHospitalUrl}#:~:text=\${encodeURIComponent(item.matchedText || '')}" target="_blank" class="view-original-btn highlight-btn" onclick="event.stopPropagation();">
              🎯 위반 부분으로 이동 (Chrome)
            </a>
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
            ※ Chrome에서 "위반 부분으로 이동" 클릭 시 해당 텍스트가 하이라이트 됩니다.
          </div>
        </div>
        \` : ''}
        
        <!-- Disclaimer -->
        \${rec.disclaimer ? \`
        <div class="violation-section">
          <div style="background: rgba(253, 214, 99, 0.1); border: 1px solid rgba(253, 214, 99, 0.3); border-radius: 8px; padding: 12px; font-size: 12px; color: var(--text-secondary);">
            \${escapeHtml(rec.disclaimer)}
          </div>
        </div>
        \` : ''}
      \`;
    }
    
    // Close modal on overlay click
    document.getElementById('violationModal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') navigateViolation(-1);
      if (e.key === 'ArrowRight') navigateViolation(1);
    });
    
    // Initialize
    parseUrl();
    fetchData();
    setInterval(fetchData, 10000); // Refresh every 10 seconds
  </script>
</body>
</html>`;
}

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // API endpoints
  if (pathname === '/api/dashboard') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(getDashboardData()));
  } else if (pathname === '/api/hospitals') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(getAllAnalyses()));
  } else if (pathname.startsWith('/api/hospital/')) {
    const id = pathname.split('/')[3];
    const hospital = getHospitalAnalysis(id);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(hospital ? 200 : 404);
    res.end(JSON.stringify(hospital || { error: 'Not found' }));
  } else if (pathname === '/api/fp-patterns') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(loadJSON(FP_DB_FILE, {})));
  } else {
    // All routes serve the SPA
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(getMainHTML());
  }
});

server.listen(PORT, () => {
  console.log(`
============================================================
MEDCHECKER Dashboard
============================================================
URL: http://localhost:${PORT}

Features:
  - Monarch Money-inspired UI
  - Hospital detail pages with full violation info
  - Search & filter
  - SPA navigation
  
============================================================
  `);
});

module.exports = { getDashboardData, getAllAnalyses };
