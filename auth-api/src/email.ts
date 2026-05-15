import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_NAMES: Record<string, string> = {
  kwizzo: 'Kwizzo',
  tutiq: 'Tutiq',
  quizbites: 'QuizBites',
  quizbytes: 'QuizBytes',
  photorestore: 'PhotoRestore',
};

export async function sendOtpEmail(email: string, code: string, site: string): Promise<void> {
  const siteName = SITE_NAMES[site] || site;

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: `Your ${siteName} login code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:22px;font-weight:700;color:#1e293b;">${siteName}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e293b;">Your login code</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#64748b;">
                Sign in to <strong>${siteName}</strong>. Expires in 10 minutes.
              </p>
              <!-- OTP Block -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1e293b;font-variant-numeric:tabular-nums;">
                      ${code.split('').join(' ')}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
                If you didn&rsquo;t request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px;text-align:center;border-top:1px solid #f1f5f9;">
              <span style="font-size:12px;color:#cbd5e1;">&copy; ${new Date().getFullYear()} ${siteName}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
