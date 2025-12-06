
// api/test-email.js
require('dotenv').config();
const { getVisitContext } = require('../lib/utils');
const { sendVisitEmail } = require('../lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }
  try {
    const ctx = getVisitContext(req);
    const payload = { test: true, message: 'اختبار إرسال إيميل (silent)' };
    await sendVisitEmail({ payload, context: ctx });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, message: 'تم إرسال إيميل الاختبار' }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
