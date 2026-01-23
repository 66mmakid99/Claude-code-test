const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 리포트 저장 디렉토리
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// 디렉토리 생성
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 한글 폰트 경로 (Railway 배포 시 fonts 디렉토리에 폰트 파일 필요)
const KOREAN_FONT_PATH = path.join(FONTS_DIR, 'NanumGothic.ttf');
const KOREAN_FONT_BOLD_PATH = path.join(FONTS_DIR, 'NanumGothic-Bold.ttf');

// 폰트 사용 가능 여부 체크
const hasKoreanFont = fs.existsSync(KOREAN_FONT_PATH);

if (!hasKoreanFont) {
  console.log('⚠️  한글 폰트(NanumGothic.ttf)가 없습니다. PDF에서 한글이 깨질 수 있습니다.');
  console.log('   fonts/NanumGothic.ttf 파일을 추가하세요.');
}

/**
 * PDF 리포트 생성
 * @param {Object} report - 리포트 데이터
 * @returns {string} 생성된 PDF 파일 경로
 */
async function generatePDFReport(report) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `report-${report.id}-${Date.now()}.pdf`;
      const filepath = path.join(REPORTS_DIR, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `MADMEDCHECK Report - ${report.url}`,
          Author: 'MADMEDCHECK',
          Subject: 'Medical Advertisement Compliance Report'
        }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // 한글 폰트 등록 (있는 경우)
      if (hasKoreanFont) {
        doc.registerFont('Korean', KOREAN_FONT_PATH);
        if (fs.existsSync(KOREAN_FONT_BOLD_PATH)) {
          doc.registerFont('Korean-Bold', KOREAN_FONT_BOLD_PATH);
        }
        doc.font('Korean');
      }

      // 텍스트 헬퍼 (한글 폰트 없을 때 대체)
      const setText = (text, options = {}) => {
        if (!hasKoreanFont) {
          // 한글을 로마자로 대체하지 않고 그대로 출력 (깨질 수 있음)
          // 또는 영문 대체 텍스트 사용
        }
        return text;
      };

      // 헤더
      doc.rect(0, 0, doc.page.width, 120).fill('#6366f1');
      doc.fillColor('#ffffff')
         .fontSize(28)
         .text('MADMEDCHECK', 50, 40);
      doc.fontSize(14)
         .text(setText('Medical Compliance Report'), 50, 75);

      doc.moveDown(4);

      // 기본 정보
      doc.fillColor('#1f2937')
         .fontSize(12)
         .text(`URL: ${report.url}`, 50, 140);
      doc.text(`Date: ${new Date(report.created_at).toLocaleString('ko-KR')}`, 50, 160);
      doc.text(`Report ID: ${report.id}`, 50, 180);

      // 총점 박스
      const scoreColor = getScoreColor(report.total_score);
      doc.rect(400, 130, 140, 70).fill(scoreColor);
      doc.fillColor('#ffffff')
         .fontSize(10)
         .text('SCORE', 440, 140);
      doc.fontSize(36)
         .text(`${report.total_score}`, 440, 155);
      doc.fontSize(12)
         .text('/ 100', 480, 175);

      doc.moveDown(4);

      // 요약
      doc.fillColor('#1f2937')
         .fontSize(16)
         .text(setText('Summary'), 50, 230);

      doc.rect(50, 250, 495, 1).fill('#e5e7eb');

      doc.fontSize(11)
         .fillColor('#4b5563');

      const violationCount = report.violation_count || 0;
      const warningCount = report.warning_count || 0;
      const passCount = report.pass_count || 0;

      doc.text(`Violations: ${violationCount}`, 50, 265);
      doc.text(`Warnings: ${warningCount}`, 200, 265);
      doc.text(`Passed: ${passCount}`, 350, 265);

      // 위반 사항 상세
      let yPosition = 310;
      const violations = report.violations || [];

      if (violations.length > 0) {
        doc.fillColor('#1f2937')
           .fontSize(16)
           .text(setText('Violation Details'), 50, yPosition);

        yPosition += 25;

        for (const violation of violations) {
          // 페이지 넘김 체크
          if (yPosition > 700) {
            doc.addPage();
            if (hasKoreanFont) doc.font('Korean');
            yPosition = 50;
          }

          // 위반 박스
          const boxColor = violation.severity === 'critical' ? '#fef2f2' : '#fffbeb';
          const borderColor = violation.severity === 'critical' ? '#dc2626' : '#f59e0b';

          doc.rect(50, yPosition, 495, 80)
             .fill(boxColor)
             .stroke(borderColor);

          // 심각도 배지
          doc.rect(55, yPosition + 5, 60, 18)
             .fill(borderColor);
          doc.fillColor('#ffffff')
             .fontSize(9)
             .text(getSeverityText(violation.severity), 60, yPosition + 9);

          // 규칙명
          doc.fillColor('#1f2937')
             .fontSize(12)
             .text(violation.rule_name || violation.ruleName || 'Unknown', 125, yPosition + 8);

          // 규칙 코드
          doc.fillColor('#6b7280')
             .fontSize(9)
             .text(`(${violation.rule_code || violation.ruleCode || ''})`, 125, yPosition + 25);

          // 증거
          const evidenceText = (violation.evidence || '').substring(0, 80);
          doc.fillColor('#374151')
             .fontSize(10)
             .text(`Evidence: ${evidenceText}${evidenceText.length >= 80 ? '...' : ''}`, 55, yPosition + 45, {
               width: 480
             });

          // Confidence 표시 (있는 경우)
          if (violation.confidence) {
            doc.fillColor('#6b7280')
               .fontSize(9)
               .text(`Confidence: ${violation.confidence}%`, 400, yPosition + 8);
          }

          yPosition += 95;
        }
      }

      // 권고사항
      if (yPosition > 600) {
        doc.addPage();
        if (hasKoreanFont) doc.font('Korean');
        yPosition = 50;
      }

      doc.fillColor('#1f2937')
         .fontSize(16)
         .text(setText('Recommendations'), 50, yPosition);

      yPosition += 25;

      const recommendations = getRecommendations(violations);
      for (const rec of recommendations) {
        if (yPosition > 750) {
          doc.addPage();
          if (hasKoreanFont) doc.font('Korean');
          yPosition = 50;
        }

        doc.fillColor('#4b5563')
           .fontSize(10)
           .text(`• ${rec}`, 55, yPosition, { width: 480 });
        yPosition += 25;
      }

      // 푸터
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        if (hasKoreanFont) doc.font('Korean');
        doc.fillColor('#9ca3af')
           .fontSize(9)
           .text(
             `MADMEDCHECK | Page ${i + 1} / ${pageCount}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: 495 }
           );
      }

      // 면책 조항
      doc.addPage();
      if (hasKoreanFont) doc.font('Korean');

      doc.fillColor('#1f2937')
         .fontSize(14)
         .text('Disclaimer', 50, 50);

      doc.fillColor('#6b7280')
         .fontSize(10)
         .text(
           'This report is for reference purposes only and provides an analysis of website compliance with Korean Medical Service Act. ' +
           'For accurate legal judgment, please consult with a medical law specialist. ' +
           'MADMEDCHECK is not legally responsible for the contents of this report.',
           50, 80, { width: 495, lineGap: 5 }
         );

      doc.fillColor('#1f2937')
         .fontSize(14)
         .text('Legal Reference', 50, 150);

      doc.fillColor('#6b7280')
         .fontSize(10)
         .text(
           '• Medical Service Act Article 56 (Prohibition of Medical Advertising)\n' +
           '• Medical Service Act Enforcement Decree Article 23\n' +
           '• Medical Service Act Article 89 (Penalties)',
           50, 180, { width: 495, lineGap: 8 }
         );

      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });

      stream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 심각도 텍스트 반환
 */
function getSeverityText(severity) {
  const texts = {
    'critical': 'VIOLATION',
    'warning': 'WARNING',
    'review': 'REVIEW',
    'info': 'INFO'
  };
  return texts[severity] || 'INFO';
}

/**
 * 점수에 따른 색상 반환
 */
function getScoreColor(score) {
  if (score >= 80) return '#10b981'; // 녹색
  if (score >= 50) return '#f59e0b'; // 주황
  return '#dc2626'; // 빨강
}

/**
 * 위반 사항에 따른 권고사항 생성
 */
function getRecommendations(violations) {
  const recommendations = new Set();

  for (const v of violations) {
    const code = v.rule_code || v.ruleCode;

    switch (code) {
      case 'MED001':
        recommendations.add('Remove patient testimonials or replace with objective medical information.');
        break;
      case 'MED002':
        recommendations.add('Remove before/after treatment photos and replace with general procedure images.');
        break;
      case 'MED003':
        recommendations.add('Remove success rate claims and add "individual results may vary" disclaimer.');
        break;
      case 'MED004':
        recommendations.add('Remove celebrity endorsement content.');
        break;
      case 'MED005':
        recommendations.add('Modify excessive discount claims and clearly state conditions.');
        break;
      case 'MED006':
        recommendations.add('Remove superlative expressions or provide objective evidence.');
        break;
      default:
        recommendations.add('Consult with a medical law expert to review the content.');
    }
  }

  if (recommendations.size === 0) {
    recommendations.add('Your website is currently compliant. Continue regular monitoring.');
  }

  return Array.from(recommendations);
}

/**
 * PDF 파일 읽기 (Buffer)
 */
function getPDFBuffer(filepath) {
  return fs.readFileSync(filepath);
}

/**
 * PDF 파일 삭제
 */
function deletePDF(filepath) {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

/**
 * 한글 폰트 사용 가능 여부
 */
function isKoreanFontAvailable() {
  return hasKoreanFont;
}

module.exports = {
  generatePDFReport,
  getPDFBuffer,
  deletePDF,
  isKoreanFontAvailable,
  REPORTS_DIR
};
