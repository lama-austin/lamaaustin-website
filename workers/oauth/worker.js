// GitHub login for the admin panel (/admin/), deployed as the Cloudflare
// Worker "lama-oauth" at https://oauth.lamaaustin.com.
//
// This file is NOT deployed automatically. To change the live Worker:
// Cloudflare dashboard → Workers & Pages → lama-oauth → Edit code → paste
// this file → Deploy.
//
// Required Worker variables (Settings → Variables and Secrets):
//   GITHUB_CLIENT_ID      from the GitHub OAuth app
//   GITHUB_CLIENT_SECRET  from the GitHub OAuth app (store as a secret)
// The OAuth app's "Authorization callback URL" must be
// https://oauth.lamaaustin.com/callback
//
// Flow: the admin panel opens this in a popup → we redirect to GitHub →
// GitHub redirects back to /callback with a code → we exchange it for a
// token and hand it to the admin panel window via postMessage.

// The only site allowed to receive a token. Without this check, any website
// could open this popup and be handed the visitor's GitHub token.
const ALLOWED_ORIGIN = 'https://lamaaustin.com';
const REDIRECT_URI = 'https://oauth.lamaaustin.com/callback';
const PROVIDER = 'github';

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set('scope', 'repo');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', url.searchParams.get('state') || '');
    return Response.redirect(authUrl.toString(), 302);
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    return callbackPage('error', { error: tokenData.error_description || tokenData.error || 'No token returned' });
  }
  return callbackPage('success', { token: tokenData.access_token, provider: PROVIDER });
}

// Decap/Sveltia handshake: the popup announces "authorizing:github", the
// admin page replies, and the popup answers with the result — but only to
// ALLOWED_ORIGIN, and only if the reply actually came from it.
function callbackPage(status, payload) {
  const message = `authorization:${PROVIDER}:${status}:${JSON.stringify(payload)}`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<p>Signing in… you can close this window if it doesn't close by itself.</p>
<script>
  (function () {
    var allowed = ${JSON.stringify(ALLOWED_ORIGIN)};
    var message = ${JSON.stringify(message).replace(/</g, '\\u003c')};
    if (!window.opener) return;
    window.addEventListener('message', function (e) {
      if (e.origin !== allowed) return;
      window.opener.postMessage(message, allowed);
    });
    window.opener.postMessage(${JSON.stringify(`authorizing:${PROVIDER}`)}, allowed);
  })();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/auth' || pathname === '/callback') {
      return handleAuth(request, env);
    }
    return new Response('Not found', { status: 404 });
  },
};
