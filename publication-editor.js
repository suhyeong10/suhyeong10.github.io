(() => {
  const form = document.getElementById('publication-editor-form');
  if (!form) return;

  const editSearch = new URLSearchParams(location.search);
  const editing = editSearch.has('edit');
  const entryPath = editSearch.get('edit');
  const validEntryPath = /^_data\/added_publications\/[a-z0-9-]+\.json$/.test(entryPath || '');
  const draftStorageKey = 'suhyeong10.publication-draft.v1' + (editing ? ':' + entryPath : '');
  const fieldNames = ['title', 'authors', 'venue', 'year', 'publication_date', 'paper', 'project', 'model', 'code', 'co_first_author', 'figure_alt'];
  const fields = form.querySelector('fieldset');
  const status = document.getElementById('publication-editor-status');
  const draftNote = document.getElementById('publication-draft-note');
  const loadPanel = document.getElementById('publication-editor-load');
  const loadStatus = document.getElementById('publication-editor-load-status');
  const loadRetry = document.getElementById('publication-editor-load-retry');
  const conflict = document.getElementById('publication-draft-conflict');
  const result = document.getElementById('publication-editor-result');
  const imageInput = form.elements.figure_file;
  const imageAlt = form.elements.figure_alt;
  const imageControls = document.getElementById('publication-image-controls');
  const imagePreview = document.getElementById('publication-image-preview');
  const removeImage = document.getElementById('publication-image-remove');
  const publishButton = form.querySelector('[type="submit"]');
  const deleteZone = document.getElementById('publication-delete-zone');
  const deleteButton = document.getElementById('publication-delete');
  const deleteConfirmation = document.getElementById('publication-delete-confirmation');
  const confirmDelete = document.getElementById('publication-confirm-delete');
  const cancelDelete = document.getElementById('publication-cancel-delete');

  let base;
  let baseFields;
  let figure;
  let removeFigure = false;
  let commitDraft;
  let staleDraft;
  let publishing = false;
  let finished = false;
  let imageJob = 0;
  let processingImage = false;
  let loadJob = 0;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function setDeleteConfirmation(open) {
    deleteConfirmation.hidden = !open;
    deleteButton.hidden = open;
  }

  function syncControls() {
    fields.disabled = publishing || Boolean(staleDraft);
    publishButton.disabled = publishing || processingImage || Boolean(staleDraft);
    deleteButton.disabled = confirmDelete.disabled = cancelDelete.disabled = publishing || processingImage;
  }

  function currentFigure() {
    return figure?.url || (!removeFigure && base?.publication.figure) || '';
  }

  function updatePreview() {
    const current = currentFigure();
    imageControls.hidden = !current;
    imageAlt.disabled = !current;
    if (figure) imagePreview.src = `data:image/webp;base64,${figure.content}`;
    else if (current) imagePreview.src = current;
    else imagePreview.removeAttribute('src');
  }

  function isPreparedImage(image) {
    return typeof image?.path === 'string' && /^assets\/uploads\/[a-z0-9-]+\.webp$/.test(image.path) &&
      image.url === `/${image.path}` && typeof image.content === 'string';
  }

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftStorageKey));
    } catch {
      draftNote.textContent = 'Browser storage is unavailable. Keep this page open to retain your draft.';
      return undefined;
    }
  }

  function applyDraft(draft, merge = false) {
    for (const name of fieldNames) {
      const input = form.elements[name];
      const value = draft.fields?.[name];
      if (merge && draft.baseFields && value === draft.baseFields[name]) continue;
      if (input.type === 'checkbox') {
        if (typeof value === 'boolean') input.checked = value;
      } else if (typeof value === 'string') input.value = value;
    }
    figure = isPreparedImage(draft.figure) ? draft.figure : undefined;
    removeFigure = draft.removeFigure === true;
    if (!editing && typeof draft.commit?.key === 'string' && typeof draft.commit.path === 'string' &&
        typeof draft.commit.addedAt === 'string') {
      commitDraft = draft.commit;
    }
    draftNote.textContent = 'Draft restored from this browser.';
  }

  function clearDraft() {
    try { localStorage.removeItem(draftStorageKey); } catch { /* Browser storage is unavailable. */ }
  }

  function fieldValues() {
    return Object.fromEntries(fieldNames.map((name) => {
      const input = form.elements[name];
      return [name, input.type === 'checkbox' ? input.checked : input.value];
    }));
  }

  function persistDraft() {
    const values = fieldValues();
    const draft = { fields: values, baseFields, figure, removeFigure, commit: commitDraft, sha: base?.sha };
    try {
      if (Object.values(values).some(Boolean) || figure) {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        draftNote.textContent = 'Draft saved in this browser.';
      } else {
        clearDraft();
        draftNote.textContent = 'Drafts are saved in this browser.';
      }
    } catch {
      draftNote.textContent = 'This browser could not save the full draft. Keep this page open while you write.';
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify({ ...draft, figure: undefined }));
      } catch {
        // Keep the draft available in the current page.
      }
    }
  }

  function fillExisting(publication) {
    form.reset();
    for (const name of fieldNames) {
      const input = form.elements[name];
      const value = publication[name];
      if (name === 'authors') input.value = publication.authors.join(', ');
      else if (input.type === 'checkbox') input.checked = value === true;
      else if (value != null) input.value = String(value);
    }
    figure = undefined;
    removeFigure = false;
    draftNote.textContent = '';
  }

  async function loadExisting() {
    if (!window.siteAdmin.isSignedIn() || finished) return;
    const job = ++loadJob;
    form.hidden = true;
    loadPanel.hidden = false;
    loadRetry.hidden = true;
    loadStatus.textContent = 'Loading publication…';
    if (!validEntryPath) {
      loadStatus.textContent = 'This publication link is invalid.';
      return;
    }

    try {
      const remote = await window.siteAdmin.readEntry(entryPath);
      if (job !== loadJob) return;
      const publication = JSON.parse(remote.contents);
      if (!publication || !Array.isArray(publication.authors) || typeof publication.title !== 'string') {
        throw new Error('The saved publication could not be read.');
      }
      base = { publication, sha: remote.sha };
      fillExisting(publication);
      baseFields = fieldValues();
      const draft = readDraft();
      staleDraft = draft && draft.sha !== remote.sha ? draft : undefined;
      if (draft && !staleDraft) applyDraft(draft);
      conflict.hidden = !staleDraft;
      setStatus('');
      setDeleteConfirmation(false);
      updatePreview();
      syncControls();
      loadPanel.hidden = true;
      form.hidden = false;
    } catch (error) {
      if (job !== loadJob) return;
      loadStatus.textContent = error.status === 404 ? 'This publication was removed or is no longer available.' : error.message;
      loadRetry.hidden = error.status === 404;
    }
  }

  function onAuth(signedIn) {
    if (!editing || finished) return;
    if (signedIn) void loadExisting();
    else {
      ++loadJob;
      form.hidden = true;
    }
  }

  function pathForTitle(title) {
    const slug = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64).replace(/^-|-$/g, '');
    return `_data/added_publications/${slug || 'publication'}-${crypto.randomUUID()}.json`;
  }

  function isWebUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  function isSiteUrl(value) {
    return /^\/(?!\/)[^\\\s]+$/.test(value) && new URL(value, location.origin).origin === location.origin;
  }

  function isPublicationDate(value, year) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.test(value) ||
        Number(value.slice(0, 4)) !== year) return false;
    if (value.length === 7) return true;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function showResult(kind) {
    finished = true;
    clearDraft();
    form.hidden = true;
    result.hidden = false;
    document.getElementById('publication-result-heading').textContent = kind === 'delete' ? 'Publication deleted' : 'Publication saved';
    document.getElementById('publication-result-description').textContent = kind === 'delete'
      ? 'It will disappear from Home and Publications after GitHub Pages rebuilds.'
      : 'Your changes will appear after GitHub Pages rebuilds.';
    result.focus();
  }

  async function handleImage() {
    const file = imageInput.files[0];
    imageInput.value = '';
    if (!file) return;

    const job = ++imageJob;
    processingImage = true;
    syncControls();
    setStatus('Preparing image…');
    try {
      const prepared = await window.siteAdmin.prepareImage(file);
      if (job !== imageJob) return;
      if (!isPreparedImage(prepared)) throw new Error('The prepared image is invalid.');
      figure = prepared;
      removeFigure = false;
      imageAlt.value = '';
      updatePreview();
      persistDraft();
      setStatus('Image ready.');
    } catch (error) {
      if (job === imageJob) setStatus(error?.message || 'Choose a different image.', true);
    } finally {
      if (job === imageJob) {
        processingImage = false;
        syncControls();
      }
    }
  }

  imageInput.addEventListener('change', handleImage);
  removeImage.addEventListener('click', () => {
    ++imageJob;
    processingImage = false;
    syncControls();
    figure = undefined;
    removeFigure = Boolean(base?.publication.figure);
    imageAlt.value = '';
    updatePreview();
    persistDraft();
    setStatus('Image removed.');
    imageInput.focus();
  });
  form.addEventListener('input', (event) => {
    if (event.target !== imageInput) persistDraft();
  });

  document.getElementById('publication-restore-draft').addEventListener('click', () => {
    applyDraft(staleDraft, true);
    staleDraft = undefined;
    conflict.hidden = true;
    updatePreview();
    syncControls();
    persistDraft();
  });
  document.getElementById('publication-discard-draft').addEventListener('click', () => {
    clearDraft();
    staleDraft = undefined;
    conflict.hidden = true;
    syncControls();
  });
  loadRetry.addEventListener('click', loadExisting);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publishing || processingImage || staleDraft || !window.siteAdmin.isSignedIn() || (editing && !base)) return;

    const values = new FormData(form);
    const title = values.get('title').trim();
    const authors = values.get('authors').split(',').map((name) => name.trim()).filter(Boolean);
    const venue = values.get('venue').trim();
    const year = Number(values.get('year'));
    const publicationDate = values.get('publication_date').trim();
    const paper = values.get('paper').trim();
    const project = values.get('project').trim();
    const model = values.get('model').trim();
    const code = values.get('code').trim();

    if (!title || !authors.length || !venue || !Number.isInteger(year) || year < 1000 || year > 9999) {
      setStatus('Enter a title, at least one author, a venue or type, and a four-digit year.', true);
      return;
    }
    if (!isWebUrl(paper) || [model, code].some((url) => url && !isWebUrl(url)) ||
        (project && !isWebUrl(project) && !isSiteUrl(project))) {
      setStatus('Use http:// or https:// for external links. A project or blog link can also start with a single /.', true);
      return;
    }
    if (publicationDate && !isPublicationDate(publicationDate, year)) {
      setStatus('Enter a valid YYYY-MM-DD or YYYY-MM publication date in the selected year.', true);
      return;
    }

    const publication = { ...base?.publication, title, authors, venue, year, paper };
    const current = currentFigure();
    const optional = {
      publication_date: publicationDate,
      co_first_author: values.has('co_first_author'),
      project, model, code,
      figure: current,
      figure_alt: current ? values.get('figure_alt').trim() : ''
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value) publication[key] = value;
      else delete publication[key];
    }
    if (figure || removeFigure) {
      for (const key of ['figure_credit', 'figure_license', 'figure_source']) delete publication[key];
    }

    if (!editing) {
      const key = JSON.stringify(publication);
      if (commitDraft?.key !== key) {
        commitDraft = { key, path: pathForTitle(title), addedAt: new Date().toISOString() };
      }
      publication.added_at = commitDraft.addedAt;
    }
    persistDraft();

    publishing = true;
    syncControls();
    setStatus(editing ? 'Saving changes…' : 'Publishing…');

    try {
      const contents = `${JSON.stringify(publication, null, 2)}\n`;
      const images = figure ? [figure] : [];
      if (editing) await window.siteAdmin.updateEntry(entryPath, contents, `Update publication: ${title}`, images, base.sha);
      else await window.siteAdmin.createFile(commitDraft.path, contents, `Add publication: ${title}`, images);
      showResult('save');
    } catch (error) {
      if (editing && error.status === 409) await loadExisting();
      else setStatus(`Could not save the publication. ${error.message || ''}`, true);
    } finally {
      publishing = false;
      syncControls();
      if (!form.hidden && !publishButton.disabled && !form.closest('[data-auth-required]').hidden) publishButton.focus();
    }
  });

  deleteButton.addEventListener('click', () => {
    setDeleteConfirmation(true);
    cancelDelete.focus();
  });
  cancelDelete.addEventListener('click', () => {
    setDeleteConfirmation(false);
    deleteButton.focus();
  });
  confirmDelete.addEventListener('click', async () => {
    if (!base || publishing || !window.siteAdmin.isSignedIn()) return;
    publishing = true;
    syncControls();
    setStatus('Deleting publication…');
    try {
      await window.siteAdmin.deleteEntry(entryPath, `Delete publication: ${base.publication.title}`, base.sha);
      showResult('delete');
    } catch (error) {
      if (error.status === 409) {
        await loadExisting();
        setStatus('GitHub has a newer version. Review it before deleting.', true);
      } else setStatus(`Could not delete the publication. ${error.message || ''}`, true);
    } finally {
      publishing = false;
      syncControls();
    }
  });

  if (editing) {
    document.getElementById('publication-editor-title').textContent = 'Edit publication';
    document.title = 'Edit publication · Suhyeong Park';
    publishButton.textContent = 'Save changes';
    deleteZone.hidden = false;
    window.addEventListener('site-admin-auth', (event) => onAuth(event.detail.signedIn));
    onAuth(window.siteAdmin.isSignedIn());
  } else {
    const draft = readDraft();
    if (draft) applyDraft(draft);
    updatePreview();
    form.hidden = false;
  }
})();
