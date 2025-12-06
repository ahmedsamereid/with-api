// lib/utils.js → استبدل الدالة دي فقط
function getVisitContext(req) {
  // === IP ===
  const rawIP = req.headers['x-forwarded-for'] ||
                req.headers['x-real-ip'] ||
                req.ip ||
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress ||
                req.connection?.socket?.remoteAddress ||
                'unknown';

  const clientIP = normalizeIP(rawIP);
  const clientPort = req.socket?.remotePort || req.connection?.remotePort || '-';

  // === Protocol ===
  const protoHeader = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'];
  const protoFromHeader = protoHeader ? String(protoHeader).split(',')[0].trim() : null;
  const proto = protoFromHeader || req.protocol || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
  const isSecure = proto === 'https';

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

  // === باقي البيانات (بدون req.get أبدًا) ===
  const referer = req.headers.referer || req.headers.referrer || '-';
  const ua = req.headers['user-agent'] || 'Unknown';

  // === Full URL ===
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