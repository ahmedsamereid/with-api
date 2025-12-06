// lib/utils.js
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const throttleEnabled =
  String(process.env.EMAIL_THROTTLE_ENABLED || 'false').toLowerCase() === 'true';

const THROTTLE_MS =
  (parseInt(process.env.EMAIL_THROTTLE_MINUTES || '10', 10) || 10) *
  60 *
  1000;

const throttleMap = new Map();

/** تهدئة حسب الـ IP */
function shouldSendForIp(ip) {
  if (!ip) return true;
  if (!throttleEnabled) return true;
  const last = throttleMap.get(ip);
  const now = Date.now();
  if (!last || now - last > THROTTLE_MS) {
    throttleMap.set(ip, now);
    return true;
  }
  return false;
}

/** هل الـ IP خاص/محلي؟ */
function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
}

/** تنظيف IP */
function normalizeIP(ip) {
  if (!ip) return '';
  ip = ip.replace('::ffff:', '').trim();
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip;
}

/** استخراج بيانات الزيارة */
function getVisitContext(req) {
  const rawIP =
    req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress;

  const clientIP = normalizeIP(rawIP);
  const clientPort = req.socket?.remotePort;

  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https');

  const hostHeader = req.headers.host || '';
  let host = hostHeader;
  let headerPort = null;
  if (hostHeader.includes(':')) {
    const [h, p] = hostHeader.split(':');
    host = h;
    headerPort = p;
  }

  const xfPort = req.headers['x-forwarded-port']
    ? String(req.headers['x-forwarded-port'])
    : null;

  const defaultPort = proto === 'https' ? '443' : '80';
  const serverPort = xfPort || headerPort || defaultPort;

  const path = req.originalUrl || req.url || '/';
  const referer = req.get?.('referer') || req.get?.('referrer') || 'unknown';
  const ua = req.get?.('user-agent') || 'Unknown';

  const fullUrl = `${proto}://${host}${
    serverPort !== '80' && serverPort !== '443' ? `:${serverPort}` : ''
  }${path}`;

  const time = new Date().toISOString();

  return {
    clientIP,
    clientPort,
    proto,
    host,
    serverPort,
    path,
    referer,
    ua,
    fullUrl,
    time,
  };
}

/** مساعد: جلب JSON عن طريق https (fallback لو مفيش fetch) */
function httpsGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'node.js',
          Accept: 'application/json',
        },
      };

      const req = https.request(opts, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw || '{}');
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid JSON from GeoIP provider'));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Timeout'));
      });
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** جلب بيانات الجيو من ipapi.co (يدعم fallback لو مفيش fetch) */
async function getGeoData(ip) {
  try {
    // لو Private IP يبقى مالوش فايدة
    if (isPrivateIP(ip)) {
      return {
        country: 'Local Network',
        country_code: 'LAN',
        region: 'Local',
        city: 'Local',
        org: 'Local',
        latitude: null,
        longitude: null,
      };
    }

    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;

    let data = null;

    if (typeof fetch === 'function') {
      // لو في fetch عالمي (Node 18+ أو بيئة تدعمه)
      const res = await fetch(url, { headers: { 'User-Agent': 'node.js' }, timeout: 5000 }).catch(err => { throw err; });
      data = await res.json().catch(() => null);
    } else {
      // fallback لاستخدام https
      data = await httpsGetJson(url, 5000).catch(() => null);
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('Empty geo response');
    }

    return {
      country: data.country_name || 'Unknown',
      country_code: data.country || 'XX',
      region: data.region || data.region_code || 'Unknown',
      city: data.city || 'Unknown',
      org: data.org || data.asn || data.org_name || 'Unknown ISP',
      latitude:
        data.latitude || data.lat || (data.loc ? data.loc.split(',')[0] : null) || null,
      longitude:
        data.longitude || data.lon || (data.loc ? data.loc.split(',')[1] : null) || null,
    };
  } catch (err) {
    // لو فيه أي غلطة — ارجع Unknown عشان الكود يفضل شغال
    console.error('GeoIP error:', err && err.message ? err.message : err);
    return {
      country: 'Unknown',
      country_code: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      org: 'Unknown',
      latitude: null,
      longitude: null,
    };
  }
}

/** SHA-256 */
function hashSha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/** HTML escape */
function escapeHTML(str) {
  if (str === null || str === undefined) return '-';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  getVisitContext,
  isPrivateIP,
  hashSha256,
  escapeHTML,
  shouldSendForIp,
  getGeoData,
};