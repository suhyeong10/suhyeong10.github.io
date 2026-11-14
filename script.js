(() => {
  const owner = 'suhyeong10';
  const repository = `${owner}/suhyeong10.github.io`;
  const api = 'https://api.github.com';
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

  function setOptions(open) {
    options.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  function clearSession() {
    token = undefined;
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

  toggle.addEventListener('click', () => setOptions(options.hidden));

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

    if (token) {
      openEditor(action);
      return;
    }

    nextAction = action;
    authStatus.textContent = '';
    auth.showModal();
    tokenField.focus();
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
    tokenField.value = '';
    nextAction = undefined;
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
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

  window.addEventListener('pagehide', () => {
    clearSession();
    tokenField.value = '';
  });
})();
