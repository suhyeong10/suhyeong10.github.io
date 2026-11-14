(() => {
  const dialog = document.getElementById('publication-editor');
  if (!dialog) return;

  const form = document.getElementById('publication-editor-form');
  const fields = form.querySelector('fieldset');
  const status = document.getElementById('publication-editor-status');
  const closeButton = form.querySelector('[data-close-publication-editor]');
  const publishButton = form.querySelector('[type="submit"]');
  let draft;
  let publishing = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function pathForTitle(title) {
    const slug = title.normalize('NFKD').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 64)
      .replace(/^-|-$/g, '');
    const id = crypto.randomUUID();
    return `_data/added_publications/${slug || 'publication'}-${id}.json`;
  }

  function isWebUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  window.addEventListener('open-publication-editor', () => {
    if (!dialog.open) dialog.showModal();
  });

  closeButton.addEventListener('click', () => dialog.close());

  dialog.addEventListener('cancel', (event) => {
    if (publishing) event.preventDefault();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publishing) return;

    const values = new FormData(form);
    const title = values.get('title').trim();
    const authors = values.get('authors').split(',').map((name) => name.trim()).filter(Boolean);
    const venue = values.get('venue').trim();
    const year = Number(values.get('year'));
    const paper = values.get('paper').trim();
    const project = values.get('project').trim();
    const code = values.get('code').trim();

    if (!title || !authors.length || !venue) {
      setStatus('Enter a title, at least one author, and a venue or type.', true);
      return;
    }

    if (!isWebUrl(paper) || (project && !isWebUrl(project)) || (code && !isWebUrl(code))) {
      setStatus('Use http:// or https:// for publication links.', true);
      return;
    }

    const publication = { title, authors, venue, year, paper };
    if (project) publication.project = project;
    if (code) publication.code = code;
    const key = JSON.stringify(publication);
    if (draft?.key !== key) {
      draft = { key, path: pathForTitle(title), addedAt: new Date().toISOString() };
    }

    publishing = true;
    fields.disabled = true;
    publishButton.disabled = true;
    closeButton.disabled = true;
    setStatus('Publishing…');

    try {
      const record = { ...publication, added_at: draft.addedAt };
      await window.siteAdmin.createFile(draft.path, `${JSON.stringify(record, null, 2)}\n`, `Add publication: ${title}`);
      form.reset();
      draft = undefined;
      setStatus('Publication saved. It will appear after GitHub Pages rebuilds.');
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setStatus(`Could not publish the publication.${detail}`, true);
    } finally {
      publishing = false;
      fields.disabled = false;
      publishButton.disabled = false;
      closeButton.disabled = false;
      closeButton.focus();
    }
  });
})();
