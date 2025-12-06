// lib/utils.js
const crypto = require('crypto');

// ======== إعدادات الـ Throttle ========
const throttleEnabled = String(process.env.EMAIL_THROTTLE_ENABLED || 'false').toLowerCase() === 'true';
const THROTTLE_MINUTES = parseInt(process.env.EMAIL_THROTTLE_MINUTES || '10', 10);
const THROTTLE_MS = isNaN(THROTTLE_MINUTES) ? 10 * 60 * 1000 : THROTTLE_MINUTES * 60 * 1000;

// في بيئة Serverless (مثل Vercel) الـ Map دي هتتعيش فقط طول الـ invocation
// يعني كل طلب جديد = Map جديدة → الـ throttle هيشتغل بس جوا نفس الـ cold start
// ده كويس جدًا للاختبار وللحماية من السكربتات اللي بتعمل 1000 طلب في ثانية
const throttleMap = new Map();

/** هل نرسل الإيميل لهذا الـ IP؟ */
function shouldSendForIp(ip) {
  if (!ip || ip === 'unknown') return true;
  if (!throttleEnabled) return true;

  const now = Date.now();
  const lastSent = throttleMap.get(ip);

  if (!lastSent || now - lastSent > THROTTLE_MS) {
    throttleMap.set(ip, now);
    return true;
  }
  return false;
}

/** هل الـ IP داخلي أو خاص؟ (RFC 1918 + localhost) */
function isPrivateIP(ip) {
  if (!ip) return true;
  ip = ip.trim();

  // IPv4
  if (ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    return second >= 16 && second <= 31;
  }
  // IPv6 localhost & unique local
  if (ip.startsWith('fd') || ip.startsWith('fc') || ip.startsWith('fe80:')) return true;

  return false;
}

/** تنظيف وتطبيع الـ IP من كللـ headers */
function normalizeIP(raw) {
  if (!raw) return 'unknown';

  let ip = String(raw).split(',')[0].trim(); // أول IP في x-forwarded-for

  // إزالة IPv6-mapped IPv4
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return ip || 'unknown';
}

/** استخراج كل بيانات الزيارة بدقة عالية */
function getVisitContext(req) {
  // === IP ===
  const rawIP = req.headers['x-forwarded-for'] ||
                req.headers['x-forwarded-for'] ||
                req.ip ||
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress ||
                req.connection?.socket?.remoteAddress;

  const clientIP = normalizeIP(rawIP);
  const clientPort = req.socket?.remotePort || req.connection?.remotePort || '-';

  // === Protocol ===
  const protoHeader = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'];
  const proto = protoHeader ? String(protoHeader).split(',')[0].trim() : req.protocol || 'https';
  const isSecure = proto === 'https' || req.secure || req.headers['x-forwarded-ssl'] === 'on';

  // === Host & Port ===
  const hostHeader = req.headers.host || req.hostname || 'unknown';
  let host = hostHeader;
  let headerPort = null;

  if (hostHeader.includes(':')) {
    const parts = hostHeader.split(':');
    host = parts[0];
    headerPort = parts[1];
  }

  const forwardedPort = req.headers['x-forwarded-port'];
  const serverPort = forwardedPort || headerPort || (isSecure ? '443' : '80');

  // === باقي البيانات ===
  const path = req.originalUrl || req.url || '/';
  const referer = req.get('referer') || req.get('referrer') || '-';
  const ua = req.get('user-agent') || 'Unknown';

  // === Full URL ===
  const portPart = (serverPort === '80' || serverPort === '443') ? '' : `:${serverPort}`;
  const fullUrl = `\( {isSecure ? 'https' : 'http'}:// \){host}\( {portPart} \){path}`;

  const time = new Date().toISOString();

  return {
    clientIP,
    clientPort,
    proto: isSecure ? 'https' : 'http',
    host,
    serverPort,
    path,
    referer,
    ua,
    fullUrl,
    time,
  };
}

/** SHA-256 hash */
function hashSha256(str) {
  return crypto.createHash('sha256').update(String(str || '')).digest('hex');
}

/** HTML escape (آمن جدًا) */
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
  normalizeIP,
  shouldSendForIp,
  hashSha256,
  escapeHTML,
  throttleEnabled,
  THROTTLE_MS,
};