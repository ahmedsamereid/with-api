
// lib/utils.js

const throttleEnabled = String(process.env.EMAIL_THROTTLE_ENABLED || 'false').toLowerCase() === 'true';
const THROTTLE_MS = (parseInt(process.env.EMAIL_THROTTLE_MINUTES || '10', 10) || 10) * 60 * 1000;
const throttleMap = new Map();

function normalizeIP(ip) {
  if (!ip) return '';
  ip = ip.replace('::ffff:', '').trim();
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip;
}

function getVisitContext(req) {
  const rawIP = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress;
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

  const xfPort = req.headers['x-forwarded-port'] ? String(req.headers['x-forwarded-port']) : null;
  const defaultPort = proto === 'https' ? '443' : '80';
  const serverPort = xfPort || headerPort || defaultPort;

  const path = req.originalUrl || req.url || '/';
  const time = new Date().toISOString();

  return { clientIP, clientPort, proto, host, serverPort, path, fullUrl: `${proto}://${host}${(serverPort !== '80' && serverPort !== '443') ? `:${serverPort}` : ''}${path}`, time };
}

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

module.exports = {
  getVisitContext,
  shouldSendForIp,
};
