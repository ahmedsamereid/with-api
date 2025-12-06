// lib/utils.js
const crypto = require('crypto');
const fetch = require('node-fetch'); // مهم لو لسه مستخدم Node قديم

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

/** جلب بيانات الجيو من ipapi.co */
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

    const res = await fetch(`https://ipapi.co/${ip}/json/`);

    const data = await res.json();

    return {
      country: data.country_name || 'Unknown',
      country_code: data.country || 'XX',
      region: data.region || 'Unknown',
      city: data.city || 'Unknown',
      org: data.org || data.asn || 'Unknown ISP',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };
  } catch (err) {
    console.error('GeoIP error:', err);
    return {
      country: 'Unknown',
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