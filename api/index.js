// api/index.js
require('dotenv').config();
const { getVisitContext, isPrivateIP, hashSha256, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

// قايمة فيديوهات يوتيوب (كل مرة هيختار واحد عشوائي)
const YOUTUBE_VIDEOS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',           // Rick Astley - Never Gonna Give You Up
  'https://www.youtube.com/watch?v=9bZkp7q19f0',           // PSY - GANGNAM STYLE
  'https://www.youtube.com/watch?v=kJQP7kiw5Fk',           // Luis Fonsi - Despacito
  'https://www.youtube.com/watch?v=OPf0YbXqDm0',           // UK Drill
  'https://www.youtube.com/watch?v=CevxZvSJLk8',           // Russian Cat
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',           // Me at the zoo
  'https://www.youtube.com/watch?v=Z0Uh3OJCx3o',           // Nyan Cat
  'https://www.youtube.com/watch?v=UBX5Hk0V2nE',           // Shrek Retold
  'https://www.youtube.com/watch?v=60ItHLz5WEA',           // Charlie bit my finger
  'https://www.youtube.com/watch?v=kffacxfA7G4',           // Baby Shark (لو عايز تعذب الناس)
  // أضف أي فيديوهات تانية هنا
];

module.exports = async (req, res) => {
  // دعم HEAD requests (للـ uptime monitors)
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const ctx = getVisitContext(req);

  // بناء الـ payload من الـ query params
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const urlObj = new URL(`\( {proto}:// \){req.headers.host}${req.url || '/'}`);
  const qp = urlObj.searchParams;

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

  // إرسال الإيميل في الخلفية (التراكينج لسه شغال تمام)
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

  // اختيار فيديو يوتيوب عشوائي
  const randomVideo = YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];

  // ريدايركت فوري بدون أي UI أو HTML
  res.statusCode = 302;
  res.setHeader('Location', randomVideo);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end();
};