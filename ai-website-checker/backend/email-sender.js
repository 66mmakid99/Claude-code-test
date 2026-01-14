const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
function createTransporter() {
  // For development, you can use Gmail or other SMTP services
  // For production, use a service like SendGrid, AWS SES, etc.

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendReportEmail(recipientEmail, results, pdfPath) {
  try {
    const transporter = createTransporter();

    // Verify transporter configuration
    await transporter.verify();

    // Handle both single PDF path and array of PDF paths
    const pdfPaths = Array.isArray(pdfPath) ? pdfPath : [pdfPath];
    const isBulk = pdfPaths.length > 1;

    const attachments = pdfPaths.map((p, index) => ({
      filename: isBulk ? `website-report-${index + 1}.pdf` : `website-report-${Date.now()}.pdf`,
      path: p
    }));

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: isBulk
        ? `AI Website Checker - 대량 분석 결과 (${pdfPaths.length}개 사이트)`
        : `AI Website Checker Report - ${results.url}`,
      html: isBulk ? generateBulkEmailHTML(results, pdfPaths.length) : generateEmailHTML(results),
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

function generateEmailHTML(results) {
  const scoreColor = getScoreColor(results.score);
  const scoreLabel = getScoreLabel(results.score);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .score-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .score-number {
          font-size: 48px;
          font-weight: bold;
          color: ${scoreColor};
          margin: 10px 0;
        }
        .score-label {
          font-size: 20px;
          color: ${scoreColor};
          font-weight: bold;
        }
        .category {
          background: white;
          padding: 15px;
          margin: 15px 0;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        .category h3 {
          margin-top: 0;
          color: #667eea;
        }
        .category-score {
          font-weight: bold;
          margin: 10px 0;
        }
        .issues {
          color: #d32f2f;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          color: #999;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        ul {
          padding-left: 20px;
        }
        li {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤖 AI Website Checker Report</h1>
      </div>
      <div class="content">
        <p><strong>Website:</strong> ${results.url}</p>
        <p><strong>Analysis Date:</strong> ${new Date(results.timestamp).toLocaleString()}</p>

        <div class="score-card">
          <h2>Overall Score</h2>
          <div class="score-number">${results.score}</div>
          <p>out of ${results.maxScore}</p>
          <div class="score-label">${scoreLabel}</div>
        </div>

        <h2>Detailed Results</h2>
        ${Object.values(results.checks).map(check => `
          <div class="category">
            <h3>${check.category}</h3>
            <div class="category-score">Score: ${check.score} / ${check.maxScore}</div>
            ${check.issues.length > 0 ? `
              <div class="issues">
                <strong>Issues Found:</strong>
                <ul>
                  ${check.issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${check.recommendations.length > 0 ? `
              <div>
                <strong>Recommendations:</strong>
                <ul>
                  ${check.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}

        <p style="margin-top: 30px;">
          <strong>Note:</strong> A detailed PDF report is attached to this email.
        </p>
      </div>
      <div class="footer">
        <p>Generated by AI Website Checker v1.0</p>
        <p>This is an automated report. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
}

function generateBulkEmailHTML(summary, totalReports) {
  const scoreColor = getScoreColor(summary.score);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .score-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .score-number {
          font-size: 48px;
          font-weight: bold;
          color: ${scoreColor};
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          color: #999;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AI Website Checker</h1>
        <p>대량 분석 결과</p>
      </div>
      <div class="content">
        <p><strong>분석 날짜:</strong> ${new Date().toLocaleString('ko-KR')}</p>
        <p><strong>분석된 사이트 수:</strong> ${totalReports}개</p>

        <div class="score-card">
          <h2>평균 점수</h2>
          <div class="score-number">${summary.score}</div>
          <p>100점 만점</p>
        </div>

        <p style="margin-top: 30px;">
          <strong>참고:</strong> 각 웹사이트의 상세 PDF 리포트가 이 이메일에 첨부되어 있습니다.
        </p>
      </div>
      <div class="footer">
        <p>AI Website Checker v2.0</p>
        <p>회원가입 없이 이메일만으로 이용 가능한 서비스입니다.</p>
      </div>
    </body>
    </html>
  `;
}

function getScoreColor(score) {
  if (score >= 80) return '#4caf50';
  if (score >= 60) return '#ff9800';
  return '#f44336';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

module.exports = {
  sendReportEmail
};
