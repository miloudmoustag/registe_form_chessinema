const { getSupabaseClient } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_available_ticket_count');

    if (error) {
      console.error('Ticket count RPC failed:', error.code || 'unknown');
      return res.status(503).json({ error: 'service_unavailable' });
    }

    const count = data === null ? null : Number(data);
    return res.status(200).json({
      count: Number.isFinite(count) && count >= 0 ? count : null,
    });
  } catch (error) {
    console.error('Ticket count API is not configured or unavailable.');
    return res.status(503).json({ error: 'service_unavailable' });
  }
};
