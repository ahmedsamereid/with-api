
// lib/utils.js

function normalizeIp(ip) {
  if (!ip) return null;
  // شيل IPv4-mapped IPv6 prefix
  ip = ip.replace(/^::ffff:/, '');
  // لو localhost IPv6
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function isPrivateIp(ip) {
  // فلترة العناوين الخاصة (RFC1918) لو ظهرت في الـ XFF
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
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
  // 1) جرّب x-forwarded-for: أول IP هو غالبًا العميل
  const xff = (req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // اختَر أول IP عام (لو الأول خاص)، وإلا خُد أول واحد
  let ip = xff.find(ip => !isPrivateIp(ip)) || xff[0];

  // 2) بدائل شائعة على Vercel/بعض البروكسيز
  ip = ip ||
    req.headers['x-real-ip'] ||
    req.headers['x-vercel-ip'] || // موجود أحيانًا على Vercel
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress;

  return normalizeIp(ip);
}

function getVisitContext(req) {
  const clientIP = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || '';
  const url = req.url || '/';

  return {
    clientIP,
    userAgent,
    referer,
    proto,
    host,
    path: url.split('?')[0],
  };
}

function shouldSendForIp(ip) {
  // مثلاً: امنع الإرسال عن الـ localhost أو العناوين الخاصة
  if (!ip) return false;
  if (ip === '127.0.0.1') return false;
  if (isPrivateIp(ip)) return false;
  return true;
}

module.exports = { getClientIp, getVisitContext, shouldSendForIp };
