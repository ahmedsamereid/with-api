
// api/index.js

// حمّل dotenv اختياريًا للتطوير المحلي فقط
if (process.env.VERCEL !== '1') {
  try {
    require('dotenv').config();
  } catch (e) {
    // تطوير محلي فقط
    console.warn('dotenv not loaded (likely running in production on Vercel).');
  }
}

const { getVisitContext, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

// استثناء الستاتيك (favicon, صور, CSS, JS, خطوط...)
// لو عايز ترسل حتى في favicon اشطب الامتدادات أو استثني /favicon.ico تحديدًا
const STATIC_EXT_REGEX = /\.(css|js|png|jpg|jpeg|svg|ico|gif|webp|pdf|map|woff2?|ttf|eot|txt)$/i;

module.exports = async (req, res) => {
  // السماح بـ GET و HEAD فقط
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  // منع إرسال لأي طلب ستاتيك (اختياري)
  const pathOnly = (req.url || '/').split('?')[0];
  if (STATIC_EXT_REGEX.test(pathOnly)) {
    res.statusCode = 204; // No Content
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  // استخراج السياق (IP, UA, Referer...)
  const ctx = getVisitContext(req);

  // قراءة Query Params فقط (بدون أي طلبات خارجية)
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host || '';
  const url = req.url || '/';
  let urlObj;
  try {
    urlObj = new URL(`${proto}://${host}${url}`);
  } catch {
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

  // التحكم في التهدئة + شرط الأسرار
  const ip = ctx.clientIP;
  const canSend = shouldSendForIp(ip);
  const { EMAIL_TO, EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;
  const hasSecrets = Boolean(EMAIL_TO && EMAIL_USER && EMAIL_APP_PASSWORD);

  if (canSend && hasSecrets) {
    // إرسال صامت في الخلفية (fire-and-forget)
    (async () => {
      try {
        await sendVisitEmail({ payload, context: ctx });
        // لا تطبع شيء في الإنتاج عشان الصمت الكامل
        if (process.env.VERCEL !== '1') {
          console.log(`[EMAIL] sent silently for ${ip}`);
        }
      } catch (err) {
        // سجّل الخطأ محليًا فقط
        if (process.env.VERCEL !== '1') {
          console.error('[EMAIL] failed:', err?.message || err);
        }
      }
    })();
  }

  // رد صامت دائمًا
  res.statusCode = 204; // No Content
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
};
