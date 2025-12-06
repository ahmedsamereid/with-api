
// lib/utils.js
const crypto = require('crypto');

function normalizeIP(ip) {
  if (!ip) return '';
  ip = String(ip).replace('::ffff:', '').trim();
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip;
}

function getVisitContext(req) {
  const rawIP = req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '';
  const clientIP = normalizeIP(rawIP);

  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const hostHeader = req.headers.host || '';
  const host = hostHeader.includes(':') ? hostHeader.split(':')[0] : hostHeader;
  const headerPort = hostHeader.includes(':') ? hostHeader.split(':')[1] : null;
  const xfPort = req.headers['x-forwarded-port'] ? String(req.headers['x-forwarded-port']) : null;
  const defaultPort = proto === 'https' ? '443' : '80';
  const serverPort = xfPort || headerPort || defaultPort;

  const path = req.url || '/';
  const referer = req.headers['referer'] || req.headers['referrer'] || 'unknown';
  const ua = req.headers['user-agent'] || 'Unknown';
  const fullUrl = `${proto}://${host}${(serverPort && serverPort !== '80' && serverPort !== '443') ? `:${serverPort}` : ''}${path}`;
  const time = new Date().toISOString();

  return { clientIP, clientPort: req.socket?.remotePort, proto, host, serverPort, path, referer, ua, fullUrl, time };
}

// تهدئة الإرسال (in-memory)
const throttleEnabled = String(process.env.EMAIL_THROTTLE_ENABLED || 'false').toLowerCase() === 'true';
const THROTTLE_MS = (parseInt(process.env.EMAIL_THROTTLE_MINUTES || '10', 10) || 10) * 60 * 1000;
const throttleMap = new Map();

function shouldSendForIp(ip) {
  if (!throttleEnabled) return true;
  const last = throttleMap.get(ip);
  const now = Date.now();
  if (!last || now - last > THROTTLE_MS) {
    throttleMap.set(ip, now);
    return true;
  }
  return false;
}

function isPrivateIP(ip) {
  if (!ip) return true;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') || ip.startsWith('172.21.') || ip.startsWith('172.22.') || ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') || ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') || ip.startsWith('172.31.')
  );
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '-';
  return String(str)
    .replace(/&/g, '&amp;')
