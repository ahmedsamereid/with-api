
// lib/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

async function sendVisitEmail({ payload, context }) {
  const subject = `زيارة جديدة: ${context.path} (${context.host}:${context.serverPort})`;
  const text =
`زيارة جديدة
Full URL: ${context.fullUrl}
Protocol: ${context.proto}
Host: ${context.host}
Server Port: ${context.serverPort}
Path: ${context.path}
Referer: ${context.referer}
Client IP: ${context.clientIP}
Client Port: ${context.clientPort}
User-Agent: ${context.ua}
Time (UTC): ${context.time}
Payload:
${JSON.stringify(payload, null, 2)}
`;

  const info = await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'App'}" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject,
    text,
    html: `<pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #eee;padding:10px;border-radius:6px;">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`,
  });
  return info;
}

module.exports = { sendVisitEmail };
