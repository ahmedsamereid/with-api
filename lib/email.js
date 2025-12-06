// lib/email.js
const nodemailer = require('nodemailer');

async function sendVisitEmail({ payload, context }) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  // اللي بيخلّي الإيميل يروح للثلاثة مع بعض
  const recipients = process.env.EMAIL_TO
    .split(',')
    .map(e => e.trim())
    .filter(e => e.includes('@'));

  const mailOptions = {
    from: `"IP Logger" <${process.env.EMAIL_USER}>`,
    to: recipients, // array → nodemailer بيبعت للكل
    subject: `زيارة جديدة • \( {context.clientIP} • \){new Date().toLocaleString('ar-EG')}`,
    text: `IP: ${context.clientIP}
URL: ${context.fullUrl}
User-Agent: ${context.ua}
Referer: ${context.referer}

Payload:
${JSON.stringify(payload, null, 2)}`,
    html: `<div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;border-radius:10px;">
      <h2 style="color:#c00;">زيارة جديدة</h2>
      <p><b>IP:</b> ${context.clientIP}</p>
      <p><b>URL:</b> <a href="\( {context.fullUrl}"> \){context.fullUrl}</a></p>
      <p><b>User-Agent:</b> ${context.ua}</p>
      <p><b>Referer:</b> ${context.referer || 'مباشر'}</p>
      <pre style="background:#fff;padding:15px;border-radius:8px;">${JSON.stringify(payload, null, 2)}</pre>
    </div>`,
  };

  await transporter.sendMail(mailOptions);
  console.log('تم إرسال الإيميل لـ:', recipients.join(', '));
}

module.exports = { sendVisitEmail };