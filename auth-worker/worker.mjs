const SITE_ORIGIN = 'https://suhyeong10.github.io';
const GITHUB_API = 'https://api.github.com';
const OWNER_ID = 115800583;
const OWNER_LOGIN = 'suhyeong10';
const REPOSITORY_ID = 1277109219;
const REPOSITORY = 'suhyeong10/suhyeong10.github.io';
const OAUTH_COOKIE = '__Host-site-oauth';
const STATE_LIFETIME = 600;
const SESSION_LIFETIME = 3600;
const MAX_PUBLISH_BYTES = 400_000;
const CONTENT_PATH = /^(?:_posts\/\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,80}\.md|_data\/added_publications\/[a-z0-9][a-z0-9-]{1,110}\.json)$/;
const FLOW_ID = /^[a-zA-Z0-9_-]{16,128}$/;
const TEXT = new TextEncoder();

function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function base64url(bytes) {
  return base64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64url(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) => character.charCodeAt(0));
}

function randomValue() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function importKey(secret) {
  const bytes = decodeBase64url(secret);
  if (bytes.length !== 32) throw new Error('Invalid session-key length');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(key, purpose, payload) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: TEXT.encode(purpose) },
    key,
    TEXT.encode(JSON.stringify(payload))
  );
  return base64url(nonce) + '.' + base64url(new Uint8Array(cipher));
}

async function unseal(key, purpose, value) {
  if (!value || value.length > 4096 || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value)) return null;

  try {
    const [nonce, cipher] = value.split('.').map(decodeBase64url);
    if (nonce.length !== 12) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: TEXT.encode(purpose) },
      key,
      cipher
    );
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return payload.exp > now() ? payload : null;
  } catch {
    return null;
  }
}

function baseHeaders() {
  return new Headers({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
}

function json(body, status, origin) {
  const headers = baseHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Vary', 'Origin');
  if (origin === SITE_ORIGIN) headers.set('Access-Control-Allow-Origin', SITE_ORIGIN);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(target, cookie) {
  const headers = baseHeaders();
  headers.set('Location', target.toString());
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function loginCookie(value, lifetime) {
  return OAUTH_COOKIE + '=' + value + '; Path=/; Max-Age=' + lifetime + '; HttpOnly; Secure; SameSite=Lax';
}

function getLoginCookie(request) {
  const entry = (request.headers.get('Cookie') ?? '').split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(OAUTH_COOKIE + '='));
  return entry?.slice(OAUTH_COOKIE.length + 1);
}

function siteReturn(path) {
  try {
    const target = new URL(path || '/', SITE_ORIGIN);
    if (target.origin === SITE_ORIGIN) return target;
  } catch {
    // Untrusted return locations fall back to the homepage.
  }
  return new URL('/', SITE_ORIGIN);
}

function returnToSite(login, values) {
  const target = siteReturn(login?.returnPath);
  const params = new URLSearchParams(values);
  if (login?.flow) params.set('flow', login.flow);
  target.hash = params.toString();
  return redirect(target, loginCookie('', 0));
}

function github(token, path, options = {}) {
  return fetch(GITHUB_API + path, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'User-Agent': 'Suhyeong-Park-Website-Editor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  });
}

async function startLogin(url, env, key) {
  const action = url.searchParams.get('action');
  const flow = url.searchParams.get('flow') || '';
  const login = {
    state: randomValue(),
    verifier: randomValue(),
    flow: FLOW_ID.test(flow) ? flow : '',
    action: action === 'blog' || action === 'publication' ? action : '',
    returnPath: siteReturn(url.searchParams.get('return')).pathname,
    exp: now() + STATE_LIFETIME
  };

  const cookie = await seal(key, 'oauth-state-v1', login);
  const challenge = await crypto.subtle.digest('SHA-256', TEXT.encode(login.verifier));
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: url.origin + '/callback',
    state: login.state,
    code_challenge: base64url(new Uint8Array(challenge)),
    code_challenge_method: 'S256'
  }).toString();
  return redirect(authorize, loginCookie(cookie, STATE_LIFETIME));
}

async function hasRepositoryAccess(token) {
  const response = await github(token, '/user/installations?per_page=100');
  if (!response.ok) return false;
  const { installations } = await response.json();
  const installation = installations?.find((item) => item.account?.id === OWNER_ID &&
    !item.suspended_at && item.permissions?.contents === 'write');
  if (!installation) return false;
  const repoResponse = await github(token, '/user/installations/' + installation.id + '/repositories?per_page=100');
  if (!repoResponse.ok) return false;
  const { repositories } = await repoResponse.json();
  return repositories?.some((item) => item.id === REPOSITORY_ID) === true;
}

async function finishLogin(request, url, env, key) {
  const login = await unseal(key, 'oauth-state-v1', getLoginCookie(request));
  if (!login || url.searchParams.get('state') !== login.state) {
    return returnToSite(login, { 'site-auth-error': 'invalid_state' });
  }
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error')) return returnToSite(login, { 'site-auth-error': 'denied' });

  try {
    const exchange = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: url.origin + '/callback',
        code_verifier: login.verifier,
        repository_id: String(REPOSITORY_ID)
      })
    });
    if (!exchange.ok) return returnToSite(login, { 'site-auth-error': 'exchange_failed' });
    const grant = await exchange.json();
    const token = grant.access_token;
    if (typeof token !== 'string' || !token.startsWith('ghu_')) {
      return returnToSite(login, { 'site-auth-error': 'exchange_failed' });
    }

    const response = await github(token, '/user');
    if (!response.ok) return returnToSite(login, { 'site-auth-error': 'exchange_failed' });
    const user = await response.json();
    if (user.id !== OWNER_ID || user.login?.toLowerCase() !== OWNER_LOGIN) {
      return returnToSite(login, { 'site-auth-error': 'not_owner' });
    }
    if (!await hasRepositoryAccess(token)) {
      return returnToSite(login, { 'site-auth-error': 'missing_installation' });
    }

    const expiresIn = Number(grant.expires_in);
    const lifetime = expiresIn > 0 ? Math.min(SESSION_LIFETIME, expiresIn) : SESSION_LIFETIME;
    const session = await seal(key, 'editor-session-v1', { token, owner: OWNER_ID, exp: now() + lifetime });
    return returnToSite(login, { 'site-auth': session, action: login.action });
  } catch {
    return returnToSite(login, { 'site-auth-error': 'exchange_failed' });
  }
}

async function idempotentResult(session, path, content, origin) {
  const existing = await github(session.token, path + '?ref=main');
  if (!existing.ok) return null;
  const file = await existing.json();
  if (file.content?.replace(/\s/g, '') !== content) {
    return json({ message: 'A different entry already uses this filename. Change the title and try again.' }, 409, origin);
  }
  return json({ content: { path: file.path, sha: file.sha, html_url: file.html_url } }, 200, origin);
}

async function publish(request, session, origin) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return json({ message: 'Send a JSON publication request.' }, 415, origin);
  }

  if (Number(request.headers.get('Content-Length')) > MAX_PUBLISH_BYTES) {
    return json({ message: 'This entry exceeds the size limit.' }, 413, origin);
  }

  let record;
  try {
    const raw = await request.text();
    if (TEXT.encode(raw).length > MAX_PUBLISH_BYTES) {
      return json({ message: 'This entry exceeds the size limit.' }, 413, origin);
    }
    record = JSON.parse(raw);
  } catch {
    return json({ message: 'The entry could not be decoded.' }, 400, origin);
  }

  const { path, contents, message } = record ?? {};
  if (typeof path !== 'string' || !CONTENT_PATH.test(path) ||
      typeof contents !== 'string' || !contents.trim() ||
      typeof message !== 'string' || !message.trim() || message.length > 500) {
    return json({ message: 'Enter a valid blog post or publication.' }, 400, origin);
  }

  const content = base64(TEXT.encode(contents));
  const apiPath = '/repos/' + REPOSITORY + '/contents/' + path;
  try {
    const response = await github(session.token, apiPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content, branch: 'main' })
    });

    if (response.status === 201) {
      const { content: file, commit } = await response.json();
      return json({
        content: { path: file.path, sha: file.sha, html_url: file.html_url },
        commit: { sha: commit.sha, html_url: commit.html_url }
      }, 201, origin);
    }
    if (response.status === 401) return json({ message: 'Your GitHub session expired. Sign in again.' }, 401, origin);
    if (response.status === 403 || response.status === 404) {
      return json({ message: 'GitHub denied the write. Check the app installation and its Contents permission.' }, 403, origin);
    }
    if (response.status === 409 || response.status === 422) {
      const previous = await idempotentResult(session, apiPath, content, origin);
      if (previous) return previous;
    }
    return json({ message: 'GitHub could not save this entry. Try again.' }, 502, origin);
  } catch {
    return json({ message: 'GitHub did not respond. Your editor can retry the same entry.' }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const loginRoute = url.pathname === '/login' || url.pathname === '/callback';
    const apiRoute = url.pathname === '/session' || url.pathname === '/publish';

    if (apiRoute && origin !== SITE_ORIGIN) return json({ message: 'This origin cannot call the site editor.' }, 403, null);
    if (apiRoute && request.method === 'OPTIONS') {
      const headers = baseHeaders();
      headers.set('Access-Control-Allow-Origin', SITE_ORIGIN);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Vary', 'Origin');
      return new Response(null, { status: 204, headers });
    }

    if (loginRoute && request.method === 'GET') {
      try {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new Error('GitHub App not configured');
        const key = await importKey(env.SESSION_KEY);
        return url.pathname === '/login'
          ? await startLogin(url, env, key)
          : await finishLogin(request, url, env, key);
      } catch {
        const fallback = {
          returnPath: url.searchParams.get('return'),
          flow: FLOW_ID.test(url.searchParams.get('flow') ?? '') ? url.searchParams.get('flow') : ''
        };
        return returnToSite(fallback, { 'site-auth-error': 'unavailable' });
      }
    }

    if ((url.pathname === '/session' && request.method === 'GET') ||
        (url.pathname === '/publish' && request.method === 'POST')) {
      let key;
      try {
        key = await importKey(env.SESSION_KEY);
      } catch {
        return json({ message: 'The GitHub sign-in service has not been configured.' }, 503, origin);
      }
      const credential = request.headers.get('Authorization')?.match(/^Bearer ([a-zA-Z0-9_.-]+)$/i)?.[1];
      const session = await unseal(key, 'editor-session-v1', credential);
      if (session?.owner !== OWNER_ID || !session.token?.startsWith('ghu_')) {
        return json({ message: 'Sign in with the website owner’s GitHub account.' }, 401, origin);
      }

      if (url.pathname === '/session') return json({ login: OWNER_LOGIN }, 200, origin);
      return publish(request, session, origin);
    }

    return json({ message: 'This site editor endpoint does not exist.' }, 404, origin);
  }
};
