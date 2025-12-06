
// lib/utils.js

function normalizeIp(ip) {
  if (!ip) return null;
  ip = ip.replace(/^::ffff:/, ''); // IPv4-mapped IPv6
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function isPrivateIp(ip) {
  if (!ip) return false;
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    (ip.startsWith('172.') && (() => {
      const second = parseInt(ip.split('.')[1], 10);
      return second >= 16 && second <= 31;
    })())
  );
}

function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let ip = xff.find(ip => !isPrivateIp(ip)) || xff[0] ||
           req.headers['x-real-ip'] ||
           req.headers['x-vercel-ip'] ||
           req.socket?.remoteAddress ||
           req.connection?.remoteAddress;

  return normalizeIp(ip);
}

function getVisitContext(req) {
  return {
    clientIP: getClientIp(req),
    userAgent: req.headers['user-agent'] || '',
    referer: req.headers['referer'] || req.headers['referrer'] || '',
    proto: req.headers['x-forwarded-proto'] || 'https',
    host: req.headers.host || '',
    path: (req.url || '/').split('?')[0],
  };
}

// التهدئة: مثال بسيط — تجاهل IPs الخاصة/localhost
function shouldSendForIp(ip) {
  if (!ip) return false;
  if (ip === '127.0.0.1') return false;
  if (isPrivateIp(ip)) return false;
  return true;
}

module.exports = { getVisitContext, shouldSendForIp, isPrivateIp };
