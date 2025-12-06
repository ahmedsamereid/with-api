
// lib/email.js
const nodemailer = require('nodemailer');

function escapeHTML(str) {
  if (str === null || str === undefined) return '-';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function row(label, value) {
  return `<tr><td style="border:1px solid #e5e7eb;padding:8px;background:#fafafa;width:180px;"><b>${escapeHTML(label)}</b></td><td style="border:1px solid #e5e7eb;padding:8px;">${escapeHTML(value ?? '-')}</td></tr>`;
}

function composeEmailHtml(payload, ctx) {
  const prettyPayload = `<pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #eee;padding:10px;border-radius:6px;">${escapeHTML(JSON.stringify(payload, null, 2))}</pre>`;
  return `
    <h2 style="margin:0 0 8px 0;">زيارة جديدة</h2>
    <table style="border-collapse:collapse;width:100%;max-width:700px;">
      ${row('Full URL', ctx.fullUrl)}
      ${row('Protocol', ctx.proto)}
      ${row('Host', ctx.host)}
      ${row('Server Port', ctx.serverPort)}
      ${row('Path', ctx.path)}
      ${row('Time (UTC)', ctx.time)}
      ${row('Client IP', ctx.clientIP)}
      ${row('Client Port', ctx.clientPort)}
    </table>
    <h3 style="margin:16px 0 6px 0;">Payload</h3>
    ${prettyPayload}
  `;
}

async function sendVisitEmail({ payload, context }) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  const subject = `زيارة جديدة: ${context.path} (${context.host}:${context.serverPort})`;

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'App'}" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject,
    text:
`زيارة جديدة

Full URL: ${context.fullUrl}
Protocol: ${context.proto}
Host: ${context.host}
Server Port: ${context.serverPort}
Path: ${context.path}
Time (UTC): ${context.time}
Client IP: ${context.clientIP}
Client Port: ${context.clientPort}

Payload:
${JSON.stringify(payload, null, 2)}
`,
    html: composeEmailHtml(payload, context),
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendVisitEmail };
