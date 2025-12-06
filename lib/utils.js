// lib/utils.js
const crypto = require('crypto');

const throttleEnabled = String(process.env.EMAIL_THROTTLE_ENABLED || 'false').toLowerCase() === 'true';
const THROTTLE_MINUTES = parseInt(process.env.EMAIL_THROTTLE_MINUTES || '10', 10);
const THROTTLE_MS = isNaN(THROTTLE_MINUTES) ? 10 * 60 * 1000 : THROTTLE_MINUTES * 60 * 1000;

const throttleMap = new Map();

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

function isPrivateIP(ip) {
  if (!ip) return true;
  ip = ip.trim();
  if (ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    return second >= 16 && second <= 31;
  }
  if (ip.startsWith('fd') || ip.startsWith('fc') || ip.startsWith('fe80::')) return true;
  return false;
}

function normalizeIP(raw) {
  if (!raw) return 'unknown';
  let ip = String(raw).split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip || 'unknown';
}

function getVisitContext(req) {
  const rawIP = req.headers['x-forwarded-for'] ||
                req.headers['x-real-ip'] ||
                req.ip ||
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress ||
                'unknown';

  const clientIP = normalizeIP(rawIP);
  const clientPort = req.socket?.remotePort || req.connection?.remotePort || '-';

  const protoHeader = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'];
  const protoFromHeader = protoHeader ? String(protoHeader).split(',')[0].trim() : null;
  const proto = protoFromHeader || req.protocol || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
  const isSecure = proto === 'https';

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

  const referer = req.headers.referer || req.headers.referrer || '-';
  const ua = req.headers['user-agent'] || 'Unknown';

  const portPart = (serverPort === '80' || serverPort === '443') ? '' : `:${serverPort}`;
  const fullUrl = `\( {isSecure ? 'https' : 'http'}:// \){host}\( {portPart} \){req.originalUrl || req.url || '/'}`;

  const time = new Date().toISOString();

  return {
    clientIP,
    clientPort,
    proto: isSecure ? 'https' : 'http',
    host,
    serverPort,
    path: req.originalUrl || req.url || '/',
    referer,
    ua,
    fullUrl,
    time,
  };
}

function hashSha256(str) {
  return crypto.createHash('sha256').update(String(str || '')).digest('hex');
}

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