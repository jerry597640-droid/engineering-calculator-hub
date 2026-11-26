/**
 * TEST ONLY: fail-closed gateway kernel.  This is not a complete login system.
 * An authenticated, server-side authorize() adapter and verified asset binding
 * must be provided before any deployment.  Never use a client boolean as proof.
 */

const NO_STORE = 'private, no-store, max-age=0';

function reject(status, message) {
  return new Response(message, {
    status,
    headers: { 'cache-control': NO_STORE, 'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff', 'vary': 'Cookie' }
  });
}

/** Parse only canonical, explicit tool paths. Unknown paths are never assets. */
export function toolIdForPath(pathname) {
  if (typeof pathname !== 'string' || pathname.includes('%') || pathname.includes('\\') ||
      pathname.includes('//') || /[\u0000-\u0020\u007f]/.test(pathname)) return null;
  const match = /^\/tools\/([a-z0-9][a-z0-9-]{0,79})(\/.*)$/.exec(pathname);
  if (!match || match[2].split('/').some(part => part === '.' || part === '..')) return null;
  return match[1];
}

/**
 * authorize(request, toolId) resolves only to 'allow', 'login', or 'deny'.
 * It MUST verify the user's identity and current authorization server-side.
 * Errors fail closed. assets.fetch is called only after the check succeeds.
 */
export function createProtectedGateway({ authorize, assets } = {}) {
  return async function handle(request) {
    if (!(request instanceof Request)) throw new TypeError('Request required');
    if (request.method !== 'GET' && request.method !== 'HEAD') return reject(405, 'Method not allowed');
    let url;
    try { url = new URL(request.url); } catch { return reject(400, 'Invalid URL'); }
    const toolId = toolIdForPath(url.pathname);
    if (!toolId) return reject(404, 'Not found');
    if (typeof authorize !== 'function' || typeof assets?.fetch !== 'function') {
      return reject(503, 'Authorization unavailable');
    }
    let decision;
    try { decision = await authorize(request, toolId); }
    catch { return reject(503, 'Authorization unavailable'); }
    if (decision === 'login') return reject(401, 'Authentication required');
    if (decision !== 'allow') return reject(403, 'Access denied');
    let upstream;
    try { upstream = await assets.fetch(request); }
    catch { return reject(503, 'Asset service unavailable'); }
    const headers = new Headers(upstream.headers);
    headers.set('cache-control', NO_STORE);
    headers.set('x-content-type-options', 'nosniff');
    headers.set('vary', 'Cookie');
    headers.delete('set-cookie');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status, statusText: upstream.statusText, headers
    });
  };
}

