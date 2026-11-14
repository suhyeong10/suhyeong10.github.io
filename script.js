(() => {
  const owner = 'suhyeong10';
  const repositoryApi = '/repos/suhyeong10/suhyeong10.github.io';
  const api = 'https://api.github.com';
  const sessionKey = 'suhyeong10.editor-pat';
  const patPattern = /^github_pat_[a-zA-Z0-9_]+$/;
  const entryPath = /^(?:(?:_posts\/\d{4}-\d{2}-\d{2}-|projects\/)[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:md|markdown)|_data\/added_publications\/[a-z0-9-]+\.json)$/;
  const contentSha = /^[a-f0-9]{40}$/i;
  const imagePath = /^assets\/uploads\/[a-z0-9-]+\.webp$/;
  const maxImageBytes = 700 * 1024;
  const toggle = document.getElementById('admin-toggle');
  const options = document.getElementById('admin-options');
  const signOut = document.getElementById('admin-sign-out');
  const signIn = document.getElementById('editor-sign-in');
  const authForm = document.getElementById('admin-auth-form');
  const tokenField = document.getElementById('admin-token');
  const connect = document.getElementById('admin-connect');
  const authStatus = document.getElementById('auth-status');
  const editor = document.querySelector('[data-auth-required]');
  const ownerActions = document.querySelectorAll('[data-owner-only]');
  let credential = readSession();
  let verified = false;
  let authAttempt = 0;

  class GitHubError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function readSession() {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      return patPattern.test(saved || '') ? saved : undefined;
    } catch {
      return undefined;
    }
  }

  function setOptions(open) {
    options.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  function showAuthState(status = '') {
    signOut.hidden = !verified;
    ownerActions.forEach((actions) => { actions.hidden = !verified; });
    if (editor) {
      editor.hidden = !verified;
      signIn.hidden = verified;
      authStatus.textContent = status;
      connect.disabled = false;
    }
    window.dispatchEvent(new CustomEvent('site-admin-auth', { detail: { signedIn: verified } }));
  }

  function clearSession(status = '') {
    authAttempt += 1;
    credential = undefined;
    verified = false;
    try { sessionStorage.removeItem(sessionKey); } catch { /* Tab storage is unavailable. */ }
    showAuthState(status);
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
  signOut.addEventListener('click', () => {
    clearSession();
    setOptions(false);
    toggle.focus();
  });

  async function github(path, token, { method = 'GET', body, allow = [] } = {}) {
    let response;
    try {
      response = await fetch(api + path, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw new GitHubError('GitHub is unreachable. Try again in a moment.', 0);
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok || allow.includes(response.status)) return { status: response.status, data };

    if (response.status === 401) throw new GitHubError('This token has expired or been revoked. Enter a current token.', 401);
    if (response.status === 403 || response.status === 404) {
      throw new GitHubError('GitHub denied access. Check that the token has Contents read and write for suhyeong10.github.io.', response.status);
    }
    throw new GitHubError(data.message || `GitHub returned HTTP ${response.status}.`, response.status);
  }

  async function signInWith(token, restoring = false) {
    const attempt = ++authAttempt;
    if (connect) {
      connect.disabled = true;
      authStatus.textContent = 'Checking GitHub account…';
    }
    try {
      const { data: account } = await github('/user', token);
      if (attempt !== authAttempt) return;
      if (account.id !== 115800583 || account.login?.toLowerCase() !== owner) {
        throw new Error('Only @suhyeong10 can edit this website.');
      }
      credential = token;
      verified = true;
      try { sessionStorage.setItem(sessionKey, token); } catch { /* Editing can continue on this page. */ }
      showAuthState();
      if (!restoring) editor?.querySelector('input[name="title"], input[id*="title"]')?.focus();
    } catch (error) {
      if (attempt !== authAttempt) return;
      if (restoring && error.status === 0) {
        showAuthState('GitHub could not verify this tab’s session. Reload to retry or enter the token again.');
      } else {
        clearSession(error.message);
      }
    }
  }

  if (authForm) {
    authForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (connect.disabled) return;
      const token = tokenField.value.trim();
      tokenField.value = '';
      if (!patPattern.test(token)) {
        authStatus.textContent = 'Enter a fine-grained GitHub access token.';
        tokenField.focus();
        return;
      }
      void signInWith(token);
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const saved = readSession();
    if (saved === credential) return;
    clearSession();
    if (saved) {
      credential = saved;
      void signInWith(saved, true);
    }
  });

  function toBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  async function prepareImage(file) {
    const fileName = file?.name || '';
    const rasterType = /^image\/(?:png|jpe?g|webp|gif|avif)$/i;
    if (!file || !(rasterType.test(file.type) || (!file.type && /\.(?:png|jpe?g|webp|gif|avif)$/i.test(fileName)))) {
      throw new Error('Choose a PNG, JPEG, WebP, GIF, or AVIF image.');
    }
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap || !bitmap.width || !bitmap.height) throw new Error('This image could not be opened.');
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      let scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      let blob;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', attempt === 0 ? .87 : .8));
        if (!blob || blob.type !== 'image/webp') throw new Error('This browser could not encode the image as WebP.');
        if (blob.size <= maxImageBytes) break;
        scale *= .75;
      }
      if (blob.size > maxImageBytes) throw new Error('Choose a smaller image.');
      const name = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40).replace(/^-+|-+$/g, '') || 'image';
      const path = `assets/uploads/${name}-${crypto.randomUUID()}.webp`;
      const content = toBase64(new Uint8Array(await blob.arrayBuffer()));
      return { path, url: '/' + path, content };
    } finally {
      bitmap.close();
    }
  }

  function fileRoute(path) {
    if (typeof path !== 'string' || !entryPath.test(path)) throw new Error('This entry cannot be edited here.');
    return `${repositoryApi}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  function requireOwner() {
    if (!verified || !credential) throw new Error('Sign in with the website owner’s GitHub account first.');
    return credential;
  }

  function handleExpiredSession(error, token) {
    if (error.status === 401 && credential === token) {
      clearSession('Your session expired. Reconnect GitHub to continue.');
    }
  }

  function readBase64(value) {
    const binary = atob(value.replace(/\s/g, ''));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      .decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  }

  async function readEntry(path) {
    const token = requireOwner();
    try {
      const { status, data } = await github(fileRoute(path) + '?ref=main', token, { allow: [404] });
      if (status === 404) throw new GitHubError('This entry is no longer on GitHub.', 404);
      if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string' ||
          !contentSha.test(data.sha)) throw new Error('GitHub could not read this entry as an editable text file.');
      return { contents: readBase64(data.content), sha: data.sha };
    } catch (error) {
      handleExpiredSession(error, token);
      throw error;
    }
  }

  async function writeEntry(path, contents, message, images, expectedSha = null) {
    const token = requireOwner();
    const route = fileRoute(path);
    const removing = contents === null;
    if (typeof message !== 'string' || !message.trim() ||
        (expectedSha !== null && !contentSha.test(expectedSha)) ||
        (removing && expectedSha === null) ||
        (!removing && (typeof contents !== 'string' || !contents.trim())) ||
        !Array.isArray(images) || images.length > 6 ||
        images.some((image) => !imagePath.test(image?.path) || image.url !== '/' + image.path ||
          typeof image.content !== 'string' || image.content.length > 4 * Math.ceil(maxImageBytes / 3) ||
          !/^[a-zA-Z0-9+/]+={0,2}$/.test(image.content)) ||
        new Set(images.map((image) => image.path)).size !== images.length) {
      throw new Error('The entry or one of its image attachments could not be prepared.');
    }

    const packed = removing ? null : toBase64(new TextEncoder().encode(contents));
    const refPath = repositoryApi + '/git/ref/heads/main';
    const publishRefPath = repositoryApi + '/git/refs/heads/main';
    const currentHead = async () => (await github(refPath, token)).data.object.sha;
    let assetEntries;

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const parent = await currentHead();
        const previous = await github(route + '?ref=' + parent, token, { allow: [404] });
        if (previous.status === 200) {
          const stale = expectedSha !== null && previous.data.sha !== expectedSha;
          const creating = expectedSha === null;
          const unchanged = !removing && previous.data.content?.replace(/\s/g, '') === packed;
          if (unchanged && (!images.length || creating || stale)) {
            const matches = await Promise.all(images.map(async (image) => {
              const existing = await github(`${repositoryApi}/contents/${image.path}?ref=${parent}`, token, { allow: [404] });
              return existing.status === 200 && existing.data.content?.replace(/\s/g, '') === image.content;
            }));
            if (matches.every(Boolean)) return { content: previous.data };
          }
          if (creating) throw new GitHubError('An entry already uses this URL. Change the title and try again.', 409);
          if (stale) throw new GitHubError('This entry changed on GitHub. Reload the latest version before saving or deleting.', 409);
        } else if (expectedSha !== null) {
          if (removing) return { content: null };
          throw new GitHubError('This entry was deleted on GitHub. Use a new entry to publish it again.', 404);
        }

        if (!assetEntries) {
          assetEntries = [];
          for (const image of images) {
            const { data: blob } = await github(repositoryApi + '/git/blobs', token, {
              method: 'POST', body: { content: image.content, encoding: 'base64' }
            });
            assetEntries.push({ path: image.path, mode: '100644', type: 'blob', sha: blob.sha });
          }
        }

        const { data: parentCommit } = await github(repositoryApi + '/git/commits/' + parent, token);
        const entry = {
          path,
          mode: '100644',
          type: 'blob',
          ...(removing ? { sha: null } : { content: contents })
        };
        const { data: tree } = await github(repositoryApi + '/git/trees', token, {
          method: 'POST',
          body: {
            base_tree: parentCommit.tree.sha,
            tree: [...assetEntries, entry]
          }
        });
        const { data: commit } = await github(repositoryApi + '/git/commits', token, {
          method: 'POST', body: { message, tree: tree.sha, parents: [parent] }
        });

        const updated = await github(publishRefPath, token, {
          method: 'PATCH', body: { sha: commit.sha, force: false }, allow: [409, 422]
        });
        if (updated.status === 200) {
          if (removing) return { commit, content: null };
          const result = tree.tree?.find((item) => item.path === path);
          if (result?.sha) return { commit, content: { path, sha: result.sha } };
          const stored = await github(route + '?ref=' + commit.sha, token);
          return { commit, content: stored.data };
        }
        if (await currentHead() === parent) {
          throw new Error(updated.data.message || 'GitHub declined to update the branch.');
        }
      }
      throw new Error('The site was updated while you were publishing. Try again.');
    } catch (error) {
      handleExpiredSession(error, token);
      throw error;
    }
  }

  function createFile(path, contents, message, images = []) {
    return writeEntry(path, contents, message, images);
  }

  function updateEntry(path, contents, message, images, sha) {
    if (!contentSha.test(sha)) throw new Error('Reload the entry before saving your changes.');
    return writeEntry(path, contents, message, images, sha);
  }

  function deleteEntry(path, message, sha) {
    if (!contentSha.test(sha)) throw new Error('Reload the entry before deleting it.');
    return writeEntry(path, null, message, [], sha);
  }

  window.siteAdmin = Object.freeze({ createFile, prepareImage, readEntry, updateEntry, deleteEntry, isSignedIn: () => verified });
  if (credential) void signInWith(credential, true);
})();
