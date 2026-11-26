/** TEST ONLY until a complete audited session/login flow is integrated. */
const COOKIE_NAME = '__Host-ech-access';
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function accessToken(request) {
  const raw = request.headers.get('cookie');
  if (!raw || raw.length > 16384) return null;
  const matches = raw.split(';').map(v => v.trim()).filter(v => v.startsWith(COOKIE_NAME + '='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE_NAME.length + 1);
  return token.length <= 8192 && JWT.test(token) ? token : null;
}

/** PostgREST validates the JWT; the RPC evaluates the current database RLS. */
export function createSupabaseAuthorizer({ url, publishableKey, fetchImpl = fetch } = {}) {
  let base;
  try { base = new URL(url); } catch { throw new TypeError('Invalid Supabase URL'); }
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) ||
      base.pathname !== '/' || base.search || base.hash || base.username || base.password || base.port ||
      typeof publishableKey !== 'string' || !publishableKey.startsWith('sb_publishable_') ||
      typeof fetchImpl !== 'function') throw new TypeError('Invalid Supabase configuration');
  return async function authorize(request, toolId) {
    const token = accessToken(request);
    if (!token) return 'login';
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(toolId)) return 'deny';
    const response = await fetchImpl(`${base.origin}/rest/v1/rpc/ech_has_tool_access`, {
      method: 'POST',
      headers: { apikey: publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ requested_tool_id: toolId }),
      cache: 'no-store', redirect: 'error'
    });
    if (response.status === 401) return 'login';
    if (response.status === 403) return 'deny';
    if (!response.ok) throw new Error('Authorization service unavailable');
    const allowed = await response.json();
    if (allowed !== true && allowed !== false) throw new Error('Invalid authorization response');
    return allowed ? 'allow' : 'deny';
  };
}
