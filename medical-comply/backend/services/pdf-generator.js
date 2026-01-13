const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 리포트 저장 디렉토리
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// 디렉토리 생성
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
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
          Title: `MedicalComply 의료법 준수 리포트 - ${report.url}`,
          Author: 'MedicalComply',
          Subject: '의료법 준수 검사 결과'
        }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // 한글 폰트 설정 (기본 폰트 사용)
      // 실제 배포시 NanumGothic 등 한글 폰트 파일 필요

      // 헤더
      doc.rect(0, 0, doc.page.width, 120).fill('#6366f1');
      doc.fillColor('#ffffff')
         .fontSize(28)
         .text('MedicalComply', 50, 40);
      doc.fontSize(14)
         .text('의료법 준수 검사 리포트', 50, 75);

      doc.moveDown(4);

      // 기본 정보
      doc.fillColor('#1f2937')
         .fontSize(12)
         .text(`검사 URL: ${report.url}`, 50, 140);
      doc.text(`검사 일시: ${new Date(report.created_at).toLocaleString('ko-KR')}`, 50, 160);
      doc.text(`리포트 ID: ${report.id}`, 50, 180);

      // 총점 박스
      const scoreColor = getScoreColor(report.total_score);
      doc.rect(400, 130, 140, 70).fill(scoreColor);
      doc.fillColor('#ffffff')
         .fontSize(10)
         .text('총점', 440, 140);
      doc.fontSize(36)
         .text(`${report.total_score}`, 440, 155);
      doc.fontSize(12)
         .text('/ 100점', 480, 175);

      doc.moveDown(4);

      // 요약
      doc.fillColor('#1f2937')
         .fontSize(16)
         .text('검사 요약', 50, 230);

      doc.rect(50, 250, 495, 1).fill('#e5e7eb');

      doc.fontSize(11)
         .fillColor('#4b5563');

      const violationCount = report.violation_count || 0;
      const warningCount = report.warning_count || 0;
      const passCount = report.pass_count || 0;

      doc.text(`위반 항목: ${violationCount}개`, 50, 265);
      doc.text(`경고 항목: ${warningCount}개`, 200, 265);
      doc.text(`통과 항목: ${passCount}개`, 350, 265);

      // 위반 사항 상세
      let yPosition = 310;
      const violations = report.violations || [];

      if (violations.length > 0) {
        doc.fillColor('#1f2937')
           .fontSize(16)
           .text('위반 사항 상세', 50, yPosition);

        yPosition += 25;

        for (const violation of violations) {
          // 페이지 넘김 체크
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          // 위반 박스
          const boxColor = violation.severity === 'critical' ? '#fef2f2' : '#fffbeb';
          const borderColor = violation.severity === 'critical' ? '#dc2626' : '#f59e0b';

          doc.rect(50, yPosition, 495, 80)
             .fill(boxColor)
             .stroke(borderColor);

          // 심각도 배지
          doc.rect(55, yPosition + 5, 50, 18)
             .fill(borderColor);
          doc.fillColor('#ffffff')
             .fontSize(9)
             .text(violation.severity === 'critical' ? '위반' : '경고', 62, yPosition + 9);

          // 규칙명
          doc.fillColor('#1f2937')
             .fontSize(12)
             .text(violation.rule_name || violation.ruleName, 115, yPosition + 8);

          // 카테고리
          doc.fillColor('#6b7280')
             .fontSize(9)
             .text(violation.category, 115, yPosition + 25);

          // 증거
          doc.fillColor('#374151')
             .fontSize(10)
             .text(`증거: ${(violation.evidence || '').substring(0, 80)}...`, 55, yPosition + 45, {
               width: 480
             });

          // 법적 근거
          doc.fillColor('#6b7280')
             .fontSize(9)
             .text(violation.legal_basis || violation.legalBasis || '', 55, yPosition + 65);

          yPosition += 95;
        }
      }

      // 권고사항
      if (yPosition > 600) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fillColor('#1f2937')
         .fontSize(16)
         .text('개선 권고사항', 50, yPosition);

      yPosition += 25;

      const recommendations = getRecommendations(violations);
      for (const rec of recommendations) {
        if (yPosition > 750) {
          doc.addPage();
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
        doc.fillColor('#9ca3af')
           .fontSize(9)
           .text(
             `MedicalComply | 페이지 ${i + 1} / ${pageCount}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: 495 }
           );
      }

      // 면책 조항
      doc.addPage();
      doc.fillColor('#1f2937')
         .fontSize(14)
         .text('면책 조항', 50, 50);

      doc.fillColor('#6b7280')
         .fontSize(10)
         .text(
           '본 리포트는 웹사이트의 의료법 준수 여부를 참고용으로 분석한 것입니다. ' +
           '정확한 법적 판단을 위해서는 반드시 의료법 전문 변호사의 자문을 받으시기 바랍니다. ' +
           'MedicalComply는 본 리포트의 내용에 대해 법적 책임을 지지 않습니다.',
           50, 80, { width: 495, lineGap: 5 }
         );

      doc.fillColor('#1f2937')
         .fontSize(14)
         .text('관련 법률', 50, 150);

      doc.fillColor('#6b7280')
         .fontSize(10)
         .text(
           '• 의료법 제56조 (의료광고의 금지 등)\n' +
           '• 의료법 시행령 제23조 (의료광고의 범위)\n' +
           '• 의료법 제89조 (벌칙) - 1년 이하의 징역 또는 1천만원 이하의 벌금',
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
        recommendations.add('환자 후기, 치료 경험담을 삭제하거나 객관적인 의료 정보로 대체하세요.');
        break;
      case 'MED002':
        recommendations.add('치료 전후 비교 사진을 즉시 삭제하고, 일반적인 시술 설명 이미지로 대체하세요.');
        break;
      case 'MED003':
        recommendations.add('성공률, 치료율 등 수치 표현을 삭제하고 "개인차가 있을 수 있습니다" 문구를 추가하세요.');
        break;
      case 'MED004':
        recommendations.add('유명인/연예인 관련 추천 콘텐츠를 삭제하세요.');
        break;
      case 'MED005':
        recommendations.add('과도한 할인/이벤트 문구를 수정하고, 할인 조건을 명확히 표시하세요.');
        break;
      case 'MED006':
        recommendations.add('"최고", "최초", "1위" 등 최상급 표현을 삭제하거나 객관적 근거를 제시하세요.');
        break;
      default:
        recommendations.add('의료법 전문가와 상담하여 해당 콘텐츠를 검토하세요.');
    }
  }

  if (recommendations.size === 0) {
    recommendations.add('현재 웹사이트는 의료법을 잘 준수하고 있습니다. 지속적인 모니터링을 권장합니다.');
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

module.exports = {
  generatePDFReport,
  getPDFBuffer,
  deletePDF,
  REPORTS_DIR
};
