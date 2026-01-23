const { Resend } = require('resend');

// Resend 클라이언트 초기화
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * 리포트 이메일 발송
 * @param {Object} options - 이메일 옵션
 * @returns {Object} 발송 결과
 */
async function sendReportEmail({ to, report, pdfBuffer, pdfFilename }) {
  if (!resend) {
    console.warn('Resend API 키가 설정되지 않았습니다.');
    return { success: false, error: 'Email service not configured' };
  }

  const scoreColor = report.total_score >= 80 ? '#10b981' :
                     report.total_score >= 50 ? '#f59e0b' : '#dc2626';

  const scoreText = report.total_score >= 80 ? '양호' :
                    report.total_score >= 50 ? '주의' : '위험';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">MedicalComply</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">의료법 준수 검사 리포트</p>
    </div>

    <!-- Score Section -->
    <div style="padding: 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">검사 결과</p>
      <div style="display: inline-block; background-color: ${scoreColor}; color: #ffffff; padding: 20px 40px; border-radius: 10px;">
        <span style="font-size: 48px; font-weight: bold;">${report.total_score}</span>
        <span style="font-size: 18px;">/ 100</span>
        <p style="margin: 5px 0 0 0; font-size: 14px;">${scoreText}</p>
      </div>
    </div>

    <!-- URL Info -->
    <div style="padding: 20px 30px; background-color: #f9fafb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">검사 URL</p>
      <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 14px; word-break: break-all;">${report.url}</p>
    </div>

    <!-- Summary -->
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0;">검사 요약</h2>

      <div style="display: flex; gap: 15px;">
        <div style="flex: 1; background-color: #fef2f2; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #dc2626; font-size: 24px; font-weight: bold;">${report.violation_count || 0}</p>
          <p style="margin: 5px 0 0 0; color: #991b1b; font-size: 12px;">위반</p>
        </div>
        <div style="flex: 1; background-color: #fffbeb; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: bold;">${report.warning_count || 0}</p>
          <p style="margin: 5px 0 0 0; color: #92400e; font-size: 12px;">경고</p>
        </div>
        <div style="flex: 1; background-color: #ecfdf5; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #10b981; font-size: 24px; font-weight: bold;">${report.pass_count || 0}</p>
          <p style="margin: 5px 0 0 0; color: #065f46; font-size: 12px;">통과</p>
        </div>
      </div>
    </div>

    <!-- Violations Preview -->
    ${report.violations && report.violations.length > 0 ? `
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">주요 위반 사항</h2>
      ${report.violations.slice(0, 3).map(v => `
        <div style="background-color: ${v.severity === 'critical' ? '#fef2f2' : '#fffbeb'}; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${v.severity === 'critical' ? '#dc2626' : '#f59e0b'};">
          <p style="margin: 0; color: #1f2937; font-weight: 600; font-size: 14px;">${v.rule_name || v.ruleName}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${v.category}</p>
        </div>
      `).join('')}
      ${report.violations.length > 3 ? `
        <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
          외 ${report.violations.length - 3}개 항목... 첨부된 PDF에서 전체 내용을 확인하세요.
        </p>
      ` : ''}
    </div>
    ` : ''}

    <!-- CTA -->
    <div style="padding: 30px; text-align: center; background-color: #f9fafb;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">자세한 내용은 첨부된 PDF 리포트를 확인하세요.</p>
      <a href="${process.env.FRONTEND_URL || 'https://medicalcomply.com'}/report/${report.id}"
         style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        온라인에서 리포트 보기
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        본 리포트는 참고용이며, 정확한 법적 판단은 전문 변호사와 상담하세요.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
        &copy; 2024 MedicalComply. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'MedicalComply <noreply@medicalcomply.com>',
      to: [to],
      subject: `[MedicalComply] 의료법 준수 검사 결과 - ${report.total_score}점`,
      html: htmlContent,
      attachments: pdfBuffer ? [
        {
          filename: pdfFilename || `report-${report.id}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf'
        }
      ] : []
    });

    if (error) {
      console.error('이메일 발송 오류:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data.id };

  } catch (error) {
    console.error('이메일 발송 예외:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 환영 이메일 발송
 */
async function sendWelcomeEmail({ to, name }) {
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">MedicalComply</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0;">환영합니다, ${name}님!</h2>
      <p style="color: #4b5563; line-height: 1.8; margin: 0 0 20px 0;">
        MedicalComply에 가입해 주셔서 감사합니다.<br>
        이제 병원 웹사이트의 의료법 준수 여부를 쉽게 검사할 수 있습니다.
      </p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">시작하기</h3>
        <ol style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 2;">
          <li>대시보드에서 검사할 URL을 입력하세요</li>
          <li>검사 결과와 위반 사항을 확인하세요</li>
          <li>PDF 리포트를 다운로드하세요</li>
        </ol>
      </div>
      <a href="${process.env.FRONTEND_URL || 'https://medicalcomply.com'}/dashboard"
         style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 10px;">
        대시보드로 이동
      </a>
    </div>
    <div style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        &copy; 2024 MedicalComply. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'MedicalComply <noreply@medicalcomply.com>',
      to: [to],
      subject: '[MedicalComply] 가입을 환영합니다!',
      html: htmlContent
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data.id };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 딜러 수수료 알림 이메일
 */
async function sendCommissionEmail({ to, name, amount, customerName }) {
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">수수료 발생!</h1>
    </div>
    <div style="padding: 40px 30px; text-align: center;">
      <p style="color: #6b7280; margin: 0 0 10px 0;">새로운 수수료가 적립되었습니다</p>
      <p style="color: #10b981; font-size: 48px; font-weight: bold; margin: 0;">
        ${amount.toLocaleString()}원
      </p>
      <p style="color: #6b7280; margin: 20px 0 0 0;">
        ${customerName}님이 구독 결제를 완료했습니다.
      </p>
    </div>
    <div style="padding: 0 30px 30px;">
      <a href="${process.env.FRONTEND_URL || 'https://medicalcomply.com'}/dealer"
         style="display: block; background-color: #6366f1; color: #ffffff; padding: 14px; border-radius: 6px; text-decoration: none; font-weight: 600; text-align: center;">
        딜러 대시보드 확인하기
      </a>
    </div>
    <div style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        &copy; 2024 MedicalComply. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'MedicalComply <noreply@medicalcomply.com>',
      to: [to],
      subject: `[MedicalComply] 수수료 ${amount.toLocaleString()}원이 적립되었습니다`,
      html: htmlContent
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data.id };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 이메일 서비스 사용 가능 여부 확인
 */
function isEmailServiceAvailable() {
  return !!resend;
}

/**
 * 이메일 서비스 상태 반환
 */
function getEmailServiceStatus() {
  if (!process.env.RESEND_API_KEY) {
    return {
      available: false,
      reason: 'RESEND_API_KEY 환경변수가 설정되지 않았습니다.',
      hint: 'Resend (https://resend.com)에서 API 키를 발급받아 설정하세요.'
    };
  }
  return {
    available: true,
    reason: null,
    hint: null
  };
}

module.exports = {
  sendReportEmail,
  sendWelcomeEmail,
  sendCommissionEmail,
  isEmailServiceAvailable,
  getEmailServiceStatus
};
