
// api/index.js
require('dotenv').config();
const { getVisitContext, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

// استثناء الستاتيك (favicon, صور, CSS, JS, خطوط...)
const STATIC_EXT_REGEX = /\.(css|js|png|jpg|jpeg|svg|ico|gif|webp|pdf|map|woff2?|ttf|eot|txt)$/i;

module.exports = async (req, res) => {
  // اسمح بـ GET/HEAD فقط
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  // تجاهل ملفات الستاتيك تمامًا (لا إرسال ولا UI)
  const pathOnly = (req.url || '/').split('?')[0];
  if (STATIC_EXT_REGEX.test(pathOnly)) {
    res.statusCode = 204; // No Content
    return res.end();
  }

  // استخراج السياق (بدون طباعة أي شيء للمستخدم)
  const ctx = getVisitContext(req);

  // بناء الـ payload من Query فقط (صامت)
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const urlObj = new URL(`${proto}://${req.headers.host}${req.url || '/'}`);
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

  // تهدئة + شرط وجود المتغيرات السرية
  const ip = ctx.clientIP;
  const canSend = shouldSendForIp(ip);
  if (canSend && process.env.EMAIL_TO && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    // إرسال صامت في الخلفية (من غير أي إشارة للزائر)
    (async () => {
      try {
        await sendVisitEmail({ payload, context: ctx });
        // يمكن الإبقاء على هذا اللوج للتشخيص؛ لو عايز صمت كامل، أشيله.
        console.log(`[EMAIL] sent silently for ${ip}`);
      } catch (err) {
        console.error('[EMAIL] failed:', err.message);
      }
    })();
  }

  // === اختر واحد من الردود الصامتة أدناه ===

  // (أ) رد 204 No Content (صمت تام بلا أي UI)
  // res.statusCode = 204;
  // return res.end();

  // (ب) صفحة فارغة جدًا (لا معلومات، لا تلميحات)
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><html><head><meta charset="utf-8"><title></title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`);
};
