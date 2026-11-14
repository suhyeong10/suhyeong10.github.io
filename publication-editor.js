(() => {
  const form = document.getElementById('publication-editor-form');
  if (!form) return;

  const draftStorageKey = 'suhyeong10.publication-draft.v1';
  const fieldNames = ['title', 'authors', 'venue', 'year', 'publication_date', 'paper', 'project', 'model', 'code', 'co_first_author', 'figure_alt'];
  const fields = form.querySelector('fieldset');
  const status = document.getElementById('publication-editor-status');
  const draftNote = document.getElementById('publication-draft-note');
  const result = document.getElementById('publication-editor-result');
  const addAnother = document.getElementById('publication-add-another');
  const imageInput = form.elements.figure_file;
  const imageAlt = form.elements.figure_alt;
  const imageControls = document.getElementById('publication-image-controls');
  const imagePreview = document.getElementById('publication-image-preview');
  const removeImage = document.getElementById('publication-image-remove');
  const publishButton = form.querySelector('[type="submit"]');
  let figure;
  let commitDraft;
  let publishing = false;
  let imageJob = 0;
  let processingImage = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function updatePreview() {
    imageControls.hidden = !figure;
    imageAlt.disabled = !figure;
    if (figure) imagePreview.src = `data:image/webp;base64,${figure.content}`;
    else imagePreview.removeAttribute('src');
  }

  function isPreparedImage(image) {
    return typeof image?.path === 'string' && image.path.startsWith('assets/uploads/') &&
      image.url === `/${image.path}` && typeof image.content === 'string';
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftStorageKey));
      if (!draft) return;
      for (const name of fieldNames) {
        const input = form.elements[name];
        const value = draft.fields?.[name];
        if (input.type === 'checkbox') input.checked = value === true;
        else if (typeof value === 'string') input.value = value;
      }
      if (isPreparedImage(draft.figure)) figure = draft.figure;
      if (typeof draft.commit?.key === 'string' && typeof draft.commit.path === 'string' &&
          typeof draft.commit.addedAt === 'string') {
        commitDraft = draft.commit;
      }
      draftNote.textContent = 'Draft restored from this browser.';
    } catch {
      draftNote.textContent = 'Browser storage is unavailable. Keep this page open to retain your draft.';
    }
  }

  function persistDraft() {
    const values = Object.fromEntries(fieldNames.map((name) => {
      const input = form.elements[name];
      return [name, input.type === 'checkbox' ? input.checked : input.value];
    }));
    const draft = { fields: values, figure, commit: commitDraft };
    try {
      if (Object.values(values).some(Boolean) || figure) {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        draftNote.textContent = 'Draft saved in this browser.';
      } else {
        localStorage.removeItem(draftStorageKey);
        draftNote.textContent = 'Drafts are saved in this browser.';
      }
    } catch {
      draftNote.textContent = 'This browser could not save the full draft. Keep this page open while you write.';
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify({ fields: values }));
      } catch {
        // Keep the draft available in the current page.
      }
    }
  }

  function pathForTitle(title) {
    const slug = title.normalize('NFKD').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 64)
      .replace(/^-|-$/g, '');
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

  async function handleImage() {
    const file = imageInput.files[0];
    imageInput.value = '';
    if (!file) return;

    const job = ++imageJob;
    processingImage = true;
    publishButton.disabled = true;
    setStatus('Preparing image…');
    try {
      const prepared = await window.siteAdmin.prepareImage(file);
      if (job !== imageJob) return;
      if (!isPreparedImage(prepared)) throw new Error('The prepared image is invalid.');
      figure = prepared;
      imageAlt.value = '';
      updatePreview();
      persistDraft();
      setStatus('Image ready.');
    } catch (error) {
      if (job === imageJob) setStatus(error?.message || 'Choose a different image.', true);
    } finally {
      if (job === imageJob) {
        processingImage = false;
        publishButton.disabled = false;
      }
    }
  }

  imageInput.addEventListener('change', handleImage);
  removeImage.addEventListener('click', () => {
    ++imageJob;
    processingImage = false;
    publishButton.disabled = false;
    figure = undefined;
    imageAlt.value = '';
    updatePreview();
    persistDraft();
    setStatus('Image removed.');
    imageInput.focus();
  });

  form.addEventListener('input', (event) => {
    if (event.target !== imageInput) persistDraft();
  });

  addAnother.addEventListener('click', () => {
    result.hidden = true;
    form.hidden = false;
    setStatus('');
    form.elements.title.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publishing || processingImage || form.closest('[data-auth-required]').hidden) return;

    const values = new FormData(form);
    const title = values.get('title').trim();
    const authors = values.get('authors').split(',').map((name) => name.trim()).filter(Boolean);
    const venue = values.get('venue').trim();
    const year = Number(values.get('year'));
    const publicationDate = values.get('publication_date');
    const paper = values.get('paper').trim();
    const project = values.get('project').trim();
    const model = values.get('model').trim();
    const code = values.get('code').trim();

    if (!title || !authors.length || !venue || !Number.isInteger(year) || year < 1000 || year > 9999) {
      setStatus('Enter a title, at least one author, a venue or type, and a four-digit year.', true);
      return;
    }
    if (!isWebUrl(paper) || [project, model, code].some((url) => url && !isWebUrl(url))) {
      setStatus('Use http:// or https:// for publication links.', true);
      return;
    }
    if (publicationDate && Number(publicationDate.split('-')[0]) !== year) {
      setStatus('The publication date and year must match.', true);
      return;
    }

    const publication = { title, authors, venue, year, paper };
    if (publicationDate) publication.publication_date = publicationDate;
    if (values.has('co_first_author')) publication.co_first_author = true;
    if (project) publication.project = project;
    if (model) publication.model = model;
    if (code) publication.code = code;
    if (figure) {
      publication.figure = figure.url;
      const alt = values.get('figure_alt').trim();
      if (alt) publication.figure_alt = alt;
    }

    const key = JSON.stringify(publication);
    if (commitDraft?.key !== key) {
      commitDraft = { key, path: pathForTitle(title), addedAt: new Date().toISOString() };
    }
    persistDraft();

    publishing = true;
    fields.disabled = true;
    publishButton.disabled = true;
    setStatus('Publishing…');

    try {
      const record = { ...publication, added_at: commitDraft.addedAt };
      await window.siteAdmin.createFile(
        commitDraft.path,
        `${JSON.stringify(record, null, 2)}\n`,
        `Add publication: ${title}`,
        figure ? [figure] : []
      );
      form.reset();
      setStatus('');
      commitDraft = undefined;
      figure = undefined;
      updatePreview();
      persistDraft();
      form.hidden = true;
      result.hidden = false;
      result.focus();
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setStatus(`Could not publish the publication.${detail}`, true);
    } finally {
      publishing = false;
      fields.disabled = false;
      publishButton.disabled = false;
      if (!form.hidden) publishButton.focus();
    }
  });

  restoreDraft();
  updatePreview();
})();
