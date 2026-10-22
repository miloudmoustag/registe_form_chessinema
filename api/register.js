const { getSupabaseClient } = require('../lib/supabase');

const INSTITUTIONS = new Set(['FST', 'FP', 'ENSA', 'ENCG', 'ESEF', 'FE', 'EST']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CIN_PATTERN = /^[A-Z]{1,2}[0-9]{5,7}$/;

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(payload);
}

function parseRegistration(body) {
  const value = (field, maxLength) =>
    typeof body?.[field] === 'string' ? body[field].trim().slice(0, maxLength) : '';

  const registration = {
    fn: value('fn', 100),
    ln: value('ln', 100),
    em: value('em', 254).toLowerCase(),
    ph: value('ph', 30),
    cin: value('cin', 9).toUpperCase(),
    inst: value('inst', 10).toUpperCase(),
    lv: value('lv', 100),
    tkt: value('tkt', 80).toUpperCase(),
  };

  if (
    !registration.fn ||
    !registration.ln ||
    !EMAIL_PATTERN.test(registration.em) ||
    !/^0[0-9]{9}$/.test(registration.ph.replace(/\s/g, '')) ||
    !CIN_PATTERN.test(registration.cin) ||
    !INSTITUTIONS.has(registration.inst) ||
    !registration.lv ||
    !registration.tkt
  ) {
    return null;
  }

  return registration;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 8_192) {
    return sendJson(res, 413, { error: 'request_too_large' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (error) {
      return sendJson(res, 400, { success: false, error: 'invalid_input' });
    }
  }

  const registration = parseRegistration(body);
  if (!registration) {
    return sendJson(res, 400, { success: false, error: 'invalid_input' });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('register_chessinema', {
      p_first_name: registration.fn,
      p_last_name: registration.ln,
      p_email: registration.em,
      p_phone: registration.ph,
      p_cin: registration.cin,
      p_institution: registration.inst,
      p_level: registration.lv,
      p_ticket: registration.tkt,
    });

    if (error) {
      console.error('Registration RPC failed:', error.code || 'unknown');
      return sendJson(res, 503, { success: false, error: 'service_unavailable' });
    }

    if (data?.success) {
      return sendJson(res, 200, { success: true });
    }

    const knownErrors = new Set(['invalid_ticket', 'email_exists', 'cin_exists']);
    if (knownErrors.has(data?.error)) {
      return sendJson(res, 409, { success: false, error: data.error });
    }

    return sendJson(res, 503, { success: false, error: 'service_unavailable' });
  } catch (error) {
    console.error('Registration API is not configured or unavailable.');
    return sendJson(res, 503, { success: false, error: 'service_unavailable' });
  }
};
