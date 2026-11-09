// Transactional email sender.
//
// With SMTP_* env vars set, sends real mail through nodemailer. Without them
// (local dev), every email is written to backend/logs/emails/*.html so the
// flow stays fully testable and nothing is silently lost.
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const SMTP_HOST = process.env.SMTP_HOST;
const FROM = process.env.MAIL_FROM || 'UR Online <no-reply@ur-online.mg>';
const APP_URL = env.APP_URL;

let transport = null;
if (SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

const LOG_DIR = path.resolve('logs/emails');

// Branded, inline-styled HTML shell (email clients ignore external CSS).
export function renderEmail({ title, greeting, body, ctaLabel, ctaUrl, footer }) {
  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0"><tr><td style="border-radius:12px;background:linear-gradient(135deg,#3b2d8f,#6d28d9)">
         <a href="${APP_URL}${ctaUrl}" style="display:inline-block;padding:13px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${ctaLabel}</a>
       </td></tr></table>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="padding:0 0 18px;text-align:center;font-family:Arial,sans-serif">
          <span style="font-size:20px;font-weight:bold;color:#3b2d8f">🎓 UR Online</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:36px 36px 32px;font-family:Arial,sans-serif;color:#111827">
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827">${title}</h1>
          ${greeting ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151">${greeting}</p>` : ''}
          <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">${body}</p>
          ${cta}
        </td></tr>
        <tr><td style="padding:20px 12px;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6">
          ${footer ?? 'Université Références — plateforme officielle UR Online.<br/>Vous recevez cet e-mail car vous avez un compte sur UR Online.'}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

// Fire-and-forget send; never throws (an email failure must not break the API).
export async function sendEmail({ to, subject, html }) {
  try {
    if (transport) {
      await transport.sendMail({ from: FROM, to, subject, html });
      return { sent: true, via: 'smtp' };
    }
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const safe = String(to).replace(/[^a-z0-9@._-]/gi, '_');
    const file = path.join(LOG_DIR, `${Date.now()}-${safe}.html`);
    fs.writeFileSync(file, `<!-- To: ${to} | Subject: ${subject} -->\n${html}`);
    console.log(`📧 [mail:file] ${to} — "${subject}" → ${file}`);
    return { sent: true, via: 'file', file };
  } catch (e) {
    console.error('📧 email failed:', e.message);
    return { sent: false, error: e.message };
  }
}
