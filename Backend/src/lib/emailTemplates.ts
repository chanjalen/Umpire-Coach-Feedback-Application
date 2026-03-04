/**
 * Shared email template system for Bluelyticsdash.
 * All emails share the same branded shell — only the inner content differs.
 */

const BRAND_COLOR   = '#4f46e5'; // indigo-600
const BRAND_NAME    = 'Bluelyticsdash';
const CURRENT_YEAR  = new Date().getFullYear();

// ─── Base shell ───────────────────────────────────────────────────────────────

function base(body: string, footerNote?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">${BRAND_NAME}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
            ${footerNote ? `<p style="color:#6b7280;font-size:12px;margin:0 0 6px">${footerNote}</p>` : ''}
            <p style="color:#9ca3af;font-size:12px;margin:0">&copy; ${CURRENT_YEAR} ${BRAND_NAME}. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Shared components ────────────────────────────────────────────────────────

function btn(label: string, url: string): string {
  return `
    <p style="margin:28px 0 0">
      <a href="${url}"
        style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.1px">
        ${label}
      </a>
    </p>
  `;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px">${text}</h1>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">`;
}

function pill(label: string): string {
  return `<span style="display:inline-block;background:#ede9fe;color:${BRAND_COLOR};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px">${label}</span>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

/** 1. Email verification */
export function verificationEmail(opts: { firstName: string; verifyUrl: string }): string {
  const body = `
    ${heading('Verify your email address')}
    ${para(`Hi ${opts.firstName}, welcome to ${BRAND_NAME}!`)}
    ${para('Click the button below to confirm your email address and activate your account. This link expires in <strong>72 hours</strong>.')}
    ${btn('Verify Email', opts.verifyUrl)}
  `;
  return base(body, `If you didn't create a ${BRAND_NAME} account, you can safely ignore this email.`);
}

/** 2. Org invite */
export function inviteEmail(opts: { orgName: string; role: string; joinUrl: string }): string {
  const body = `
    ${heading(`You've been invited to join ${opts.orgName}`)}
    ${para(`You've been invited to join <strong>${opts.orgName}</strong> on ${BRAND_NAME} as a ${pill(opts.role)}.`)}
    ${para('Click below to accept the invitation and set up your account.')}
    ${btn('Accept Invitation', opts.joinUrl)}
  `;
  return base(body, `If you weren't expecting this invitation, you can safely ignore this email.`);
}

/** 3. Incident filed (sent to admins) */
export function incidentFiledEmail(opts: { gameTitle: string; dashboardUrl: string }): string {
  const body = `
    ${pill('Admin Alert')}
    <div style="height:12px"></div>
    ${heading('New incident reported')}
    ${para(`An incident has been filed for <strong>${opts.gameTitle}</strong> and requires your attention.`)}
    ${para('Log in to your admin dashboard to review the details and take any necessary action.')}
    ${btn('View Incident', opts.dashboardUrl)}
  `;
  return base(body, `You're receiving this because you are an admin in this organization.`);
}

/** 4. Submission open */
export function submissionOpenEmail(opts: { firstName: string; gameTitle: string; submitUrl: string }): string {
  const body = `
    ${heading('Ratings are now open')}
    ${para(`Hi ${opts.firstName},`)}
    ${para(`The rating period for <strong>${opts.gameTitle}</strong> is now open. Please submit your ratings at your earliest convenience.`)}
    ${btn('Submit Ratings', opts.submitUrl)}
  `;
  return base(body, `You're receiving this because you were assigned to this game.`);
}

/** 5. Reminder — day 3 */
export function reminderDay3Email(opts: { firstName: string; gameTitle: string; submitUrl: string }): string {
  const body = `
    ${heading('Friendly reminder — ratings pending')}
    ${para(`Hi ${opts.firstName},`)}
    ${para(`Just a reminder that your ratings for <strong>${opts.gameTitle}</strong> haven't been submitted yet.`)}
    ${para('It only takes a couple of minutes — click below to complete them.')}
    ${btn('Submit Ratings', opts.submitUrl)}
  `;
  return base(body, `You're receiving this because you were assigned to this game.`);
}

/** 6. Reminder — day 7 (more urgent) */
export function reminderDay7Email(opts: { firstName: string; gameTitle: string; submitUrl: string }): string {
  const body = `
    ${pill('Final Reminder')}
    <div style="height:12px"></div>
    ${heading('Ratings closing soon')}
    ${para(`Hi ${opts.firstName},`)}
    ${para(`Your ratings for <strong>${opts.gameTitle}</strong> are still outstanding. The submission window is closing soon — please submit before it closes.`)}
    ${btn('Submit Now', opts.submitUrl)}
  `;
  return base(body, `You're receiving this because you were assigned to this game.`);
}

/** 7. Manual reminder (triggered by admin) */
export function reminderManualEmail(opts: { firstName: string; gameTitle: string; submitUrl: string }): string {
  const body = `
    ${heading('Ratings reminder')}
    ${para(`Hi ${opts.firstName},`)}
    ${para(`Your admin has sent a reminder that your ratings for <strong>${opts.gameTitle}</strong> are still pending.`)}
    ${para('Please log in and submit your ratings as soon as possible.')}
    ${btn('Submit Ratings', opts.submitUrl)}
    ${divider()}
    ${para(`<span style="color:#6b7280;font-size:13px">If you've already submitted, you can ignore this message.</span>`)}
  `;
  return base(body, `You're receiving this because you were assigned to this game.`);
}
