/**
 * MEDCHECKER 월간 이메일 리포트 서비스
 * 
 * 기능:
 * 1. 월간 분석 요약 리포트 생성
 * 2. HTML 이메일 템플릿 렌더링
 * 3. 병원별 위반 현황 및 개선 권고
 * 4. 이메일 발송 (nodemailer)
 */

const fs = require('fs');
const path = require('path');

// 경로 설정
const DATA_DIR = path.join(__dirname, '..', 'data');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis-results');
const HOSPITALS_FILE = path.join(DATA_DIR, 'hospitals', 'hospitals.json');

/**
 * 월간 리포트 데이터 생성
 */
class ReportGenerator {
  constructor() {
    this.hospitals = this.loadHospitals();
  }

  loadHospitals() {
    try {
      const data = JSON.parse(fs.readFileSync(HOSPITALS_FILE, 'utf-8'));
      return data.hospitals || [];
    } catch (e) {
      return [];
    }
  }

  loadAnalysisResults(startDate, endDate) {
    const results = [];
    if (!fs.existsSync(ANALYSIS_DIR)) return results;

    const files = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const filepath = path.join(ANALYSIS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        
        const analyzedAt = new Date(data.analyzedAt);
        if (analyzedAt >= startDate && analyzedAt <= endDate) {
          results.push(data);
        }
      } catch (e) {}
    }

    return results;
  }

  /**
   * 월간 리포트 데이터 생성
   */
  generateMonthlyReport(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const results = this.loadAnalysisResults(startDate, endDate);
    
    // 점수 분포
    const scoreDistribution = {
      excellent: results.filter(r => r.totalScore >= 90).length,
      good: results.filter(r => r.totalScore >= 70 && r.totalScore < 90).length,
      warning: results.filter(r => r.totalScore >= 50 && r.totalScore < 70).length,
      critical: results.filter(r => r.totalScore < 50).length,
    };

    // 위반 통계
    const violationStats = {};
    const allViolations = [];
    
    for (const result of results) {
      for (const v of (result.violations || [])) {
        violationStats[v.ruleId] = violationStats[v.ruleId] || {
          ruleId: v.ruleId,
          ruleName: v.ruleName,
          count: 0,
          severity: v.severity,
        };
        violationStats[v.ruleId].count++;
        allViolations.push({
          ...v,
          hospitalName: result.hospitalName,
          url: result.url,
        });
      }
    }

    // 상위 위반 규칙
    const topViolations = Object.values(violationStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 위험 병원 (점수 70 미만)
    const riskyHospitals = results
      .filter(r => r.totalScore < 70)
      .sort((a, b) => a.totalScore - b.totalScore)
      .slice(0, 10)
      .map(r => ({
        name: r.hospitalName,
        url: r.url,
        score: r.totalScore,
        riskLevel: r.riskLevel,
        violationCount: r.violations?.length || 0,
      }));

    // 개선된 병원 (이전 대비)
    const improvedHospitals = [];
    // TODO: 이전 달 데이터와 비교 로직

    return {
      period: {
        year,
        month,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalAnalyzed: results.length,
        averageScore: results.length > 0 
          ? Math.round(results.reduce((sum, r) => sum + (r.totalScore || 0), 0) / results.length)
          : 0,
        totalViolations: allViolations.length,
        totalWarnings: results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0),
      },
      scoreDistribution,
      topViolations,
      riskyHospitals,
      improvedHospitals,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * HTML 이메일 템플릿 렌더링
 */
class EmailTemplateRenderer {
  /**
   * 월간 리포트 HTML 생성
   */
  renderMonthlyReport(reportData) {
    const { period, summary, scoreDistribution, topViolations, riskyHospitals } = reportData;
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const monthName = monthNames[period.month - 1];

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MEDCHECKER ${period.year}년 ${monthName} 리포트</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background-color: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header .period {
      font-size: 16px;
      opacity: 0.9;
    }
    .section {
      padding: 24px;
      border-bottom: 1px solid #eee;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .summary-card {
      background: #f8f9fc;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
    }
    .summary-card .label {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }
    .score-bar {
      display: flex;
      height: 24px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .score-bar .segment {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .score-bar .excellent { background: #10b981; }
    .score-bar .good { background: #3b82f6; }
    .score-bar .warning { background: #f59e0b; }
    .score-bar .critical { background: #ef4444; }
    .score-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      color: #666;
    }
    .score-legend .item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .score-legend .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .violation-list {
      list-style: none;
    }
    .violation-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .violation-item:last-child {
      border-bottom: none;
    }
    .violation-name {
      font-size: 14px;
      color: #333;
    }
    .violation-count {
      background: #fee2e2;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 12px;
    }
    .hospital-list {
      list-style: none;
    }
    .hospital-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #fef2f2;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .hospital-item:last-child {
      margin-bottom: 0;
    }
    .hospital-name {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
    .hospital-score {
      font-size: 14px;
      font-weight: 700;
      color: #dc2626;
    }
    .footer {
      background: #f8f9fc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #888;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 16px;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: #888;
      font-size: 14px;
    }
    @media (max-width: 480px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>MEDCHECKER</h1>
      <div class="period">${period.year}년 ${monthName} 월간 리포트</div>
    </div>

    <!-- Summary Section -->
    <div class="section">
      <div class="section-title">📊 이번 달 요약</div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="value">${summary.totalAnalyzed}</div>
          <div class="label">분석된 병원</div>
        </div>
        <div class="summary-card">
          <div class="value">${summary.averageScore}<span style="font-size: 16px;">점</span></div>
          <div class="label">평균 점수</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color: #ef4444;">${summary.totalViolations}</div>
          <div class="label">총 위반 건수</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color: #f59e0b;">${summary.totalWarnings}</div>
          <div class="label">총 경고 건수</div>
        </div>
      </div>
    </div>

    <!-- Score Distribution -->
    <div class="section">
      <div class="section-title">📈 점수 분포</div>
      ${this.renderScoreBar(scoreDistribution, summary.totalAnalyzed)}
      <div class="score-legend">
        <div class="item"><span class="dot" style="background: #10b981;"></span> 우수 (90+): ${scoreDistribution.excellent}개</div>
        <div class="item"><span class="dot" style="background: #3b82f6;"></span> 양호 (70-89): ${scoreDistribution.good}개</div>
        <div class="item"><span class="dot" style="background: #f59e0b;"></span> 주의 (50-69): ${scoreDistribution.warning}개</div>
        <div class="item"><span class="dot" style="background: #ef4444;"></span> 위험 (0-49): ${scoreDistribution.critical}개</div>
      </div>
    </div>

    <!-- Top Violations -->
    <div class="section">
      <div class="section-title">⚠️ 주요 위반 유형</div>
      ${topViolations.length > 0 ? `
      <ul class="violation-list">
        ${topViolations.slice(0, 5).map(v => `
        <li class="violation-item">
          <span class="violation-name">${v.ruleName}</span>
          <span class="violation-count">${v.count}건</span>
        </li>
        `).join('')}
      </ul>
      ` : '<div class="empty-state">위반 사항이 없습니다 👏</div>'}
    </div>

    <!-- Risky Hospitals -->
    <div class="section">
      <div class="section-title">🏥 주의가 필요한 병원</div>
      ${riskyHospitals.length > 0 ? `
      <ul class="hospital-list">
        ${riskyHospitals.slice(0, 5).map(h => `
        <li class="hospital-item">
          <span class="hospital-name">${h.name}</span>
          <span class="hospital-score">${h.score}점</span>
        </li>
        `).join('')}
      </ul>
      ` : '<div class="empty-state">모든 병원이 양호합니다 ✨</div>'}
    </div>

    <!-- CTA -->
    <div class="section" style="text-align: center;">
      <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
        자세한 분석 결과와 개선 방안을 확인하세요
      </div>
      <a href="https://medchecker.co.kr/dashboard" class="cta-button">
        대시보드 바로가기 →
      </a>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>본 리포트는 MEDCHECKER에서 자동 생성되었습니다.</p>
      <p style="margin-top: 8px;">
        문의: <a href="mailto:support@medchecker.co.kr">support@medchecker.co.kr</a>
      </p>
      <p style="margin-top: 16px; font-size: 11px;">
        수신을 원치 않으시면 <a href="#">여기</a>를 클릭하세요.
      </p>
    </div>
  </div>
</body>
</html>
`;
  }

  renderScoreBar(distribution, total) {
    if (total === 0) return '<div class="score-bar"><div class="segment" style="width: 100%; background: #ddd;">데이터 없음</div></div>';
    
    const segments = [];
    if (distribution.excellent > 0) {
      const pct = Math.round((distribution.excellent / total) * 100);
      segments.push(`<div class="segment excellent" style="width: ${pct}%;">${pct}%</div>`);
    }
    if (distribution.good > 0) {
      const pct = Math.round((distribution.good / total) * 100);
      segments.push(`<div class="segment good" style="width: ${pct}%;">${pct}%</div>`);
    }
    if (distribution.warning > 0) {
      const pct = Math.round((distribution.warning / total) * 100);
      segments.push(`<div class="segment warning" style="width: ${pct}%;">${pct}%</div>`);
    }
    if (distribution.critical > 0) {
      const pct = Math.round((distribution.critical / total) * 100);
      segments.push(`<div class="segment critical" style="width: ${pct}%;">${pct}%</div>`);
    }
    
    return `<div class="score-bar">${segments.join('')}</div>`;
  }

  /**
   * 개별 병원 리포트 HTML 생성
   */
  renderHospitalReport(analysisResult) {
    const { hospitalName, url, totalScore, riskLevel, violations, warnings, analyzedAt } = analysisResult;
    
    const scoreColor = totalScore >= 90 ? '#10b981' : 
                       totalScore >= 70 ? '#3b82f6' : 
                       totalScore >= 50 ? '#f59e0b' : '#ef4444';
    
    const riskText = riskLevel === 'low' ? '양호' : 
                     riskLevel === 'medium' ? '주의' : '위험';

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hospitalName} 분석 리포트</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background-color: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px 24px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header .url {
      font-size: 13px;
      opacity: 0.8;
      word-break: break-all;
    }
    .score-section {
      padding: 24px;
      text-align: center;
      border-bottom: 1px solid #eee;
    }
    .score-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: ${scoreColor}15;
      border: 4px solid ${scoreColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .score-circle .value {
      font-size: 36px;
      font-weight: 700;
      color: ${scoreColor};
    }
    .score-circle .label {
      font-size: 12px;
      color: #666;
    }
    .risk-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      background: ${scoreColor}15;
      color: ${scoreColor};
    }
    .section {
      padding: 24px;
      border-bottom: 1px solid #eee;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
    }
    .violation-card {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 12px;
    }
    .violation-card:last-child {
      margin-bottom: 0;
    }
    .violation-card .rule {
      font-size: 14px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 4px;
    }
    .violation-card .text {
      font-size: 13px;
      color: #666;
      background: white;
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
      word-break: break-all;
    }
    .warning-card {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 12px;
    }
    .warning-card .rule {
      font-size: 14px;
      font-weight: 600;
      color: #d97706;
      margin-bottom: 4px;
    }
    .recommendation {
      background: #f0fdf4;
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      color: #166534;
    }
    .recommendation .title {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .footer {
      background: #f8f9fc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #888;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: #10b981;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${hospitalName}</h1>
      <div class="url">${url}</div>
    </div>

    <div class="score-section">
      <div class="score-circle">
        <span class="value">${totalScore}</span>
        <span class="label">점</span>
      </div>
      <span class="risk-badge">${riskText}</span>
    </div>

    <div class="section">
      <div class="section-title">⚠️ 위반 사항 (${violations?.length || 0}건)</div>
      ${violations && violations.length > 0 ? violations.map(v => `
      <div class="violation-card">
        <div class="rule">${v.ruleName}</div>
        <div class="text">"${v.matchedText}"</div>
      </div>
      `).join('') : '<div class="empty-state">위반 사항이 없습니다 ✨</div>'}
    </div>

    <div class="section">
      <div class="section-title">💡 개선 권고</div>
      ${violations && violations.length > 0 ? `
      <div class="recommendation">
        <div class="title">다음 사항을 검토하세요:</div>
        <ul style="margin-left: 16px; margin-top: 8px;">
          ${[...new Set(violations.map(v => v.recommendation?.action || '해당 내용을 수정하세요.'))].slice(0, 3).map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : '<div class="empty-state">현재 개선이 필요한 사항이 없습니다.</div>'}
    </div>

    <div class="footer">
      <p>분석일: ${new Date(analyzedAt).toLocaleDateString('ko-KR')}</p>
      <p style="margin-top: 8px;">MEDCHECKER - 의료광고 위반 탐지 서비스</p>
    </div>
  </div>
</body>
</html>
`;
  }
}

/**
 * 이메일 발송 서비스 (nodemailer 사용)
 * 실제 발송 시 nodemailer 패키지 필요
 */
class EmailSender {
  constructor(config = {}) {
    this.config = {
      host: config.smtpHost || process.env.SMTP_HOST,
      port: config.smtpPort || process.env.SMTP_PORT || 587,
      user: config.smtpUser || process.env.SMTP_USER,
      pass: config.smtpPass || process.env.SMTP_PASS,
      from: config.fromEmail || process.env.FROM_EMAIL || 'noreply@medchecker.co.kr',
    };
  }

  /**
   * 이메일 발송 (실제 구현 시 nodemailer 사용)
   */
  async send(to, subject, html) {
    // nodemailer가 설치되어 있지 않으면 로깅만
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });

      const result = await transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        html,
      });

      console.log(`[EmailSender] 발송 완료: ${to}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('[EmailSender] nodemailer 미설치 - 로깅만 수행');
        console.log(`  To: ${to}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  HTML Length: ${html.length} bytes`);
        return { success: false, reason: 'nodemailer not installed', logged: true };
      }
      console.error('[EmailSender] 발송 실패:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  
  const generator = new ReportGenerator();
  const renderer = new EmailTemplateRenderer();
  
  if (args.includes('--preview')) {
    // 이번 달 리포트 미리보기
    const now = new Date();
    const report = generator.generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
    const html = renderer.renderMonthlyReport(report);
    
    // HTML 파일로 저장
    const previewPath = path.join(DATA_DIR, 'report-preview.html');
    fs.writeFileSync(previewPath, html, 'utf-8');
    console.log(`리포트 미리보기 저장: ${previewPath}`);
    console.log('\n리포트 데이터:');
    console.log(JSON.stringify(report, null, 2));
  } else if (args.includes('--send')) {
    // 실제 발송 (테스트용)
    const email = args.find(a => a.startsWith('--to='))?.split('=')[1];
    if (!email) {
      console.log('사용법: node email-report.js --send --to=email@example.com');
      return;
    }
    
    const now = new Date();
    const report = generator.generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
    const html = renderer.renderMonthlyReport(report);
    
    const sender = new EmailSender();
    const result = await sender.send(email, `[MEDCHECKER] ${now.getFullYear()}년 ${now.getMonth() + 1}월 월간 리포트`, html);
    console.log('발송 결과:', result);
  } else {
    console.log('MEDCHECKER 이메일 리포트 서비스');
    console.log('');
    console.log('사용법:');
    console.log('  node email-report.js --preview           # 리포트 미리보기 (HTML 파일 생성)');
    console.log('  node email-report.js --send --to=EMAIL   # 이메일 발송');
  }
}

module.exports = {
  ReportGenerator,
  EmailTemplateRenderer,
  EmailSender,
};

if (require.main === module) {
  main().catch(console.error);
}
