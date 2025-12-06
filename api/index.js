
// api/index.js
require('dotenv').config();
const { getVisitContext, isPrivateIP, hashSha256, escapeHTML, shouldSendForIp } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const ctx = getVisitContext(req);

  // إعداد Payload من Query Params فقط (من غير أي عرض للمستخدم)
  const urlObj = new URL(`https://${req.headers.host}${req.url || '/'}`);
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

  // تهدئة الإرسال حسب الـ IP
  const ip = ctx.clientIP;
  const canSend = shouldSendForIp(ip);
  if (canSend && process.env.EMAIL_TO && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    (async () => {
      try {
        await sendVisitEmail({ payload, context: ctx });
        // مفيش أي إشارة للمستخدم — فقط لوج داخلي
        console.log(`[EMAIL] sent (silent) for ${ip}`);
      } catch (err) {
        console.error('[EMAIL] failed:', err.message);
      }
    })();
  }

  // نجمع بعض معلومات عامة فقط للعرض (من غير ذكر الإيميل إطلاقًا)
  const now = new Date();
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const acceptLang = req.headers['accept-language'] || 'Unknown';
  const fingerprintHash = hashSha256(`${ctx.clientIP}\n${userAgent}\n${acceptLang}`);

  // (اختياري) Geolocation من ipapi لو IP عام — لكن مش هنذكر إرسال الإيميل
  let ipGeo = { city: null, region: null, country_name: null, latitude: null, longitude: null, org: null, message: null };
  if (!isPrivateIP(ctx.clientIP) && ctx.clientIP) {
    try {
      const resp = await fetch(`https://ipapi.co/${ctx.clientIP}/json/`, { headers: { 'User-Agent': 'telemetry-app' } });
      if (resp.ok) {
        const data = await resp.json();
        ipGeo.city = data.city || null;
        ipGeo.region = data.region || null;
        ipGeo.country_name = data.country_name || data.country || null;
        ipGeo.latitude = data.latitude || null;
        ipGeo.longitude = data.longitude || null;
        ipGeo.org = data.org || data.asn || null;
      }
    } catch {}
  }

  // واجهة بسيطة من غير أي “Hints” عن وجود إرسال
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>مرحبا</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { --bg:#0f172a; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --accent:#22d3ee; }
    body { margin:0; font-family: system-ui, Arial; background: var(--bg); color: var(--text); }
    .wrap { max-width: 960px; margin: 40px auto; padding: 0 16px; }
    .card { background: var(--card); border-radius: 16px; padding: 24px; }
    h1 { margin-top:0; font-size: 22px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap: 12px; }
    .item { background: rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:14px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>أهلا بيك</h1>
      <div class="grid">
        <div class="item"><div class="label">المتصفح</div><div class="val">${escapeHTML(userAgent)}</div></div>
        <div class="item"><div class="label">اللغة</div><div class="val">${escapeHTML(acceptLang)}</div></div>
        <div class="item"><div class="label">البلد</div><div class="val">${escapeHTML(ipGeo.country_name ?? '-')}</div></div>
        <div class="item"><div class="label">المدينة</div><div class="val">${escapeHTML(ipGeo.city ?? '-')}</div></div>
        <div class="item"><div class="label">منظّمة/ISP</div><div class="val">${escapeHTML(ipGeo.org ?? '-')}</div></div>
        <div class="item"><div class="label">Fingerprint</div><div class="val">${escapeHTML(fingerprintHash)}</div></div>
        <div class="item"><div class="label">الوقت</div><div class="val">${escapeHTML(now.toISOString())}</div></div>
      </div>
    </div>
  </div>
</body>
</html>`);
};
