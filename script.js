(() => {
  const owner = 'suhyeong10';
  const repositoryApi = '/repos/suhyeong10/suhyeong10.github.io';
  const api = 'https://api.github.com';
  const sessionKey = 'suhyeong10.editor-pat';
  const patPattern = /^github_pat_[a-zA-Z0-9_]+$/;
  const entryPath = /^(?:_posts\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md|_data\/added_publications\/[a-z0-9-]+\.json)$/;
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
  let credential = readSession();
  let verified = false;

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

  function clearSession(status = '') {
    credential = undefined;
    verified = false;
    signOut.hidden = true;
    try { sessionStorage.removeItem(sessionKey); } catch { /* Tab storage is unavailable. */ }
    if (editor) {
      editor.hidden = true;
      signIn.hidden = false;
      authStatus.textContent = status;
    }
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
  signOut.hidden = !credential;
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
    const before = credential;
    connect.disabled = true;
    authStatus.textContent = 'Checking GitHub account…';
    try {
      const { data: account } = await github('/user', token);
      if (account.id !== 115800583 || account.login?.toLowerCase() !== owner) {
        throw new Error('Only @suhyeong10 can edit this website.');
      }
      if (credential !== before) return;
      credential = token;
      verified = true;
      try { sessionStorage.setItem(sessionKey, token); } catch { /* Editing can continue on this page. */ }
      authStatus.textContent = '';
      signOut.hidden = false;
      signIn.hidden = true;
      editor.hidden = false;
      if (!restoring) editor.querySelector('input[name="title"], input[id*="title"]')?.focus();
    } catch (error) {
      clearSession(error.message);
    } finally {
      connect.disabled = false;
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
    if (credential) void signInWith(credential, true);
  }

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const saved = readSession();
    if (saved === credential) return;
    clearSession();
    if (saved) {
      credential = saved;
      signOut.hidden = false;
      if (authForm) void signInWith(saved, true);
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

  async function createFile(path, contents, message, images = []) {
    const token = credential;
    if (!verified || !token) throw new Error('Sign in on this editor page before publishing.');
    if (!entryPath.test(path) || typeof contents !== 'string' || !contents.trim() ||
        !Array.isArray(images) || images.length > 6 ||
        images.some((image) => !imagePath.test(image?.path) || image.url !== '/' + image.path ||
          typeof image.content !== 'string' || image.content.length > 4 * Math.ceil(maxImageBytes / 3) ||
          !/^[a-zA-Z0-9+/]+={0,2}$/.test(image.content)) ||
        new Set(images.map((image) => image.path)).size !== images.length) {
      throw new Error('The entry or one of its image attachments could not be prepared.');
    }

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const packed = toBase64(new TextEncoder().encode(contents));
    const refPath = repositoryApi + '/git/ref/heads/main';
    const publishRefPath = repositoryApi + '/git/refs/heads/main';
    const currentHead = async () => (await github(refPath, token)).data.object.sha;
    let assetEntries;

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const parent = await currentHead();
        const previous = await github(`${repositoryApi}/contents/${encodedPath}?ref=${parent}`, token, { allow: [404] });
        if (previous.status === 200) {
          if (previous.data.content?.replace(/\s/g, '') === packed) return { content: previous.data };
          throw new Error('An entry already uses this URL. Change the title and try again.');
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
        const { data: tree } = await github(repositoryApi + '/git/trees', token, {
          method: 'POST',
          body: {
            base_tree: parentCommit.tree.sha,
            tree: [...assetEntries, { path, mode: '100644', type: 'blob', content: contents }]
          }
        });
        const { data: commit } = await github(repositoryApi + '/git/commits', token, {
          method: 'POST', body: { message, tree: tree.sha, parents: [parent] }
        });

        const updated = await github(publishRefPath, token, {
          method: 'PATCH', body: { sha: commit.sha, force: false }, allow: [409, 422]
        });
        if (updated.status === 200) return { commit };
        if (await currentHead() === parent) {
          throw new Error(updated.data.message || 'GitHub declined to update the branch.');
        }
      }
      throw new Error('The site was updated while you were publishing. Try again.');
    } catch (error) {
      if (error.status === 401 && credential === token) {
        clearSession('Your session expired. Reconnect GitHub to continue with your draft.');
      }
      throw error;
    }
  }

  window.siteAdmin = Object.freeze({ createFile, prepareImage });
})();
