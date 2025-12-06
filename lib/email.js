// lib/email.js
const nodemailer = require('nodemailer');

function escapeHTML(str) {
  if (str === null || str === undefined) return '-';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label, value) {
  return `<tr><td style="border:1px solid #e5e7eb;padding:8px;background:#fafafa;width:180px;"><b>\( {escapeHTML(label)}</b></td><td style="border:1px solid #e5e7eb;padding:8px;"> \){escapeHTML(value ?? '-')}</td></tr>`;
}

function composeEmailHtml(payload, ctx) {
  const prettyPayload = `<pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #eee;padding:10px;border-radius:6px;overflow-x:auto;">${escapeHTML(JSON.stringify(payload, null, 2))}</pre>`;
  return `
    <div style="font-family:system-ui,sans-serif;max-width:700px;margin:20px auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <h2 style="margin:0 0 16px 0;color:#1f2937;">زيارة جديدة للموقع</h2>
      <table style="border-collapse:collapse;width:100%;background:#fff;">\( {row('Full URL', ctx.fullUrl)} \){row('Protocol', ctx.proto)}\( {row('Host', ctx.host)} \){row('Server Port', ctx.serverPort)}\( {row('Path', ctx.path)} \){row('Referer', ctx.referer)}\( {row('Client IP', ctx.clientIP)} \){row('Client Port', ctx.clientPort)}\( {row('User-Agent', ctx.ua)} \){row('Time (UTC)', ctx.time)}</table>
      <h3 style="margin:20px 0 8px 0;color:#1f2937;">Payload من الباك إند</h3>
      ${prettyPayload}
    </div>`;
}

async function sendVisitEmail({ payload, context }) {
  // ←←← التصحيح الغلطة اللي كانت بتخلي الإيميل يفشل
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  const recipientEmails = process.env.EMAIL_TO
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);

  if (recipientEmails.length === 0) {
    throw new Error('EMAIL_TO فارغ أو فيه مشكلة في الـ .env');
  }

  const subject = `زيارة جديدة: ${context.path}`;

  await transporter.sendMail({
    from: `"\( {process.env.APP_NAME || 'IP Logger'}" < \){process.env.EMAIL_USER}>`,
    to: recipientEmails,                    // array → يبعت للكل
    subject,
    text: `زيارة جديدة من \( {context.clientIP}\n \){context.fullUrl}\n\n${JSON.stringify(payload, null, 2)}`,
    html: composeEmailHtml(payload, context),
  });

  console.log(`تم إرسال الإيميل بنجاح إلى ${recipientEmails.length} حساب:`, recipientEmails.join(', '));
}

module.exports = { sendVisitEmail };