(() => {
  const owner = 'suhyeong10';
  const repository = `${owner}/suhyeong10.github.io`;
  const api = 'https://api.github.com';
  const authOrigin = document.querySelector('.site-admin').dataset.githubAuthOrigin;
  const flowKey = 'suhyeong10.editor-oauth-flow';
  const sessionKey = 'suhyeong10.editor-oauth-session';
  const editorPaths = /^(?:_posts\/[0-9]{4}-[0-9]{2}-[0-9]{2}-[^/]+\.md|_data\/added_publications\/[^/]+\.json)$/u;
  const toggle = document.getElementById('admin-toggle');
  const options = document.getElementById('admin-options');
  const signOut = document.getElementById('admin-sign-out');
  const auth = document.getElementById('admin-auth');
  const authForm = document.getElementById('admin-auth-form');
  const tokenField = document.getElementById('admin-token');
  const authStatus = document.getElementById('auth-status');
  const cancel = document.getElementById('admin-cancel');
  const connect = document.getElementById('admin-connect');
  let token;
  let nextAction;
  let oauthSession;

  function setOptions(open) {
    options.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  function clearSession() {
    token = undefined;
    oauthSession = undefined;
    if (authOrigin) {
      try { sessionStorage.removeItem(sessionKey); } catch { /* Keep this tab signed out. */ }
    }
    signOut.hidden = true;
  }

  function requestHeaders(credential) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${credential}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function openEditor(action) {
    window.dispatchEvent(new Event(action));
  }

  function showAuth(action, status = '') {
    nextAction = action;
    authStatus.textContent = status;
    if (!auth.open) auth.showModal();
    (tokenField || connect).focus();
  }

  async function verifySession(credential) {
    const response = await fetch(new URL('/session', authOrigin), {
      headers: { Authorization: `Bearer ${credential}` },
      signal: AbortSignal.timeout(10000)
    });
    return response.ok && (await response.json()).login === owner;
  }

  async function restoreOAuth() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const incoming = fragment.get('site-auth');
    const loginError = fragment.get('site-auth-error');
    if (incoming !== null || loginError !== null) {
      history.replaceState(history.state, '', location.pathname + location.search);
    }

    let flow;
    let savedSession;
    try {
      savedSession = sessionStorage.getItem(sessionKey);
      if (incoming !== null || loginError !== null) {
        flow = sessionStorage.getItem(flowKey);
        sessionStorage.removeItem(flowKey);
      }
    } catch { /* The editor can still show its sign-in dialog. */ }

    if (loginError !== null && flow && (fragment.get('flow') === flow || loginError === 'invalid_state')) {
      showAuth(undefined, loginError === 'not_owner'
        ? 'Only @suhyeong10 can edit this website.'
        : loginError === 'missing_installation'
          ? 'The GitHub App needs write access to the homepage repository.'
          : 'GitHub sign-in could not finish. Please try again.');
      return;
    }

    const completedLogin = Boolean(incoming && flow && fragment.get('flow') === flow);
    const credential = completedLogin ? incoming : savedSession;
    if (!credential) return;
    try {
      if (!await verifySession(credential)) throw new Error('Expired or invalid session.');
      if (completedLogin) sessionStorage.setItem(sessionKey, credential);
      oauthSession = credential;
      signOut.hidden = false;
      if (completedLogin) {
        const action = fragment.get('action');
        if (action === 'blog') openEditor('open-blog-editor');
        else if (action === 'publication') openEditor('open-publication-editor');
        else setOptions(true);
      }
    } catch {
      clearSession();
      if (completedLogin) showAuth(undefined, 'GitHub sign-in could not finish. Please try again.');
    }
  }

  toggle.addEventListener('click', () => {
    if (authOrigin && !oauthSession) {
      showAuth(undefined);
      return;
    }
    setOptions(options.hidden);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-admin')) setOptions(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !options.hidden) {
      setOptions(false);
      toggle.focus();
    }
  });

  options.addEventListener('click', (event) => {
    const action = event.target.closest('[data-admin-action]')?.dataset.adminAction;
    if (!action) return;
    setOptions(false);
    toggle.focus();

    if (token || oauthSession) {
      openEditor(action);
      return;
    }

    showAuth(action);
  });

  signOut.addEventListener('click', () => {
    clearSession();
    setOptions(false);
    toggle.focus();
  });

  cancel.addEventListener('click', () => auth.close());
  auth.addEventListener('cancel', (event) => {
    if (connect.disabled) event.preventDefault();
  });
  auth.addEventListener('close', () => {
    if (tokenField) tokenField.value = '';
    nextAction = undefined;
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (authOrigin) {
      const url = new URL('/login', authOrigin);
      const flow = crypto.randomUUID();
      try {
        sessionStorage.setItem(flowKey, flow);
      } catch {
        authStatus.textContent = 'Allow browser storage for this site to use GitHub sign-in.';
        return;
      }
      url.searchParams.set('return', location.pathname);
      url.searchParams.set('flow', flow);
      if (nextAction) url.searchParams.set('action', nextAction === 'open-blog-editor' ? 'blog' : 'publication');
      location.assign(url);
      return;
    }
    const credential = tokenField.value.trim();
    const action = nextAction;
    tokenField.value = '';

    if (!credential.startsWith('github_pat_')) {
      authStatus.textContent = 'Enter a fine-grained GitHub access token.';
      tokenField.focus();
      return;
    }

    connect.disabled = cancel.disabled = true;
    authStatus.textContent = 'Checking GitHub account…';

    try {
      const response = await fetch(`${api}/user`, {
        headers: requestHeaders(credential),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        throw new Error('GitHub could not verify the token. Check that it is valid and try again.');
      }
      const account = await response.json();
      if (account.id !== 115800583 || account.login?.toLowerCase() !== owner) {
        throw new Error('Only @suhyeong10 can edit this website.');
      }
      if (!auth.open || nextAction !== action) return;

      token = credential;
      signOut.hidden = false;
      auth.close();
      openEditor(action);
    } catch (error) {
      if (auth.open) {
        authStatus.textContent = error instanceof TypeError || error.name === 'TimeoutError'
          ? 'GitHub is unreachable. Try again in a moment.'
          : error.message;
        tokenField.focus();
      }
    } finally {
      connect.disabled = cancel.disabled = false;
    }
  });

  async function createFile(path, contents, message) {
    if (authOrigin) {
      if (!oauthSession) throw new Error('Sign in with GitHub from the + button before publishing.');
      let response;
      try {
        response = await fetch(new URL('/publish', authOrigin), {
          method: 'POST',
          headers: { Authorization: `Bearer ${oauthSession}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({ path, contents, message })
        });
      } catch {
        throw new Error('The publishing service is unreachable. Your draft is ready to retry.');
      }
      if (response.status === 401) clearSession();
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      throw new Error(result.message || 'Unable to publish. Try again in a moment.');
    }
    if (!token) throw new Error('Reconnect GitHub from the + button before publishing.');
    if (!editorPaths.test(path)) throw new Error('This file is outside the site editor.');
    const fileUrl = `${api}/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const bytes = new TextEncoder().encode(contents);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);

    let response;
    try {
      response = await fetch(fileUrl, {
        method: 'PUT',
        headers: { ...requestHeaders(token), 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ message, content: btoa(binary), branch: 'main' })
      });
    } catch {
      throw new Error('GitHub is unreachable. Your draft is ready to retry.');
    }

    if (response.status === 201) return response.json();
    if (response.status === 401) {
      clearSession();
      throw new Error('This token has expired or been revoked. Close the editor and reconnect GitHub from the + button.');
    }
    if (response.status === 403 || response.status === 404) {
      throw new Error('GitHub denied the write. Select suhyeong10.github.io and grant Contents read and write permission to your token.');
    }

    if (response.status === 409 || response.status === 422) {
      const check = await fetch(`${fileUrl}?ref=main`, {
        headers: requestHeaders(token),
        signal: AbortSignal.timeout(12000)
      }).catch(() => null);
      if (check?.ok) {
        const file = await check.json();
        if (file.content?.replace(/\s/g, '') === btoa(binary)) return { content: file };
        throw new Error('A different entry already uses this URL. Change the title and try again.');
      }
    }

    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `GitHub could not publish this entry (HTTP ${response.status}).`);
  }

  window.siteAdmin = Object.freeze({ createFile });

  if (authOrigin) {
    document.addEventListener('DOMContentLoaded', restoreOAuth, { once: true });
  } else {
    window.addEventListener('pagehide', () => {
      clearSession();
      tokenField.value = '';
    });
  }
})();
