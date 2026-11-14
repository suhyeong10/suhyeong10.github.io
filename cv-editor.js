(() => {
  const toggle = document.getElementById('cv-edit-toggle');
  const dialog = document.getElementById('cv-editor-dialog');
  if (!toggle || !dialog) return;

  const path = '_data/cv.json';
  const controls = document.querySelectorAll('[data-cv-edit-control]');
  const form = document.getElementById('cv-editor-form');
  const commonFields = document.getElementById('cv-editor-common');
  const entryFields = document.getElementById('cv-editor-entry-fields');
  const publicationFields = document.getElementById('cv-editor-publication-fields');
  const heading = document.getElementById('cv-editor-title');
  const status = document.getElementById('cv-editor-status');
  const notice = document.getElementById('cv-edit-notice');
  const cancel = document.getElementById('cv-editor-close');
  const submit = document.getElementById('cv-editor-submit');
  const refresh = document.getElementById('cv-editor-refresh');
  const entryKeys = ['organization', 'date', 'location', 'href', 'description'];

  let expanded = false;
  let saved = false;
  let busy = false;
  let loadSequence = 0;
  let openedBy;
  let active;

  function setStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  }

  function setExpanded(value) {
    expanded = value;
    toggle.setAttribute('aria-pressed', String(expanded));
    for (const control of controls) control.hidden = !expanded;
  }

  function setFields(publication, disabled) {
    commonFields.disabled = disabled;
    entryFields.hidden = publication;
    entryFields.disabled = publication || disabled;
    publicationFields.hidden = !publication;
    publicationFields.disabled = !publication || disabled;
    submit.disabled = disabled;
  }

  function selectCollection(data, scope, sectionName) {
    if (scope === 'publications') return { entries: data.publications, name: 'Publications' };
    const section = /^\d+$/.test(scope) && data.sections?.[Number(scope)];
    if (!Array.isArray(section?.entries) || (sectionName && section.title !== sectionName)) {
      throw new Error('This CV section changed. Refresh the page and try again.');
    }
    return { entries: section.entries, name: section.title };
  }

  function validLink(value, local = false) {
    if (/\s/.test(value) || value.includes('\\')) return false;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return local && value.startsWith('/') && !value.startsWith('//');
    }
  }

  function fill(entry, publication) {
    form.elements.title.value = entry.title || '';
    if (publication) {
      form.elements.authors.value = (entry.authors || []).join(', ');
      for (const key of ['venue', 'year', 'paper']) form.elements[key].value = entry[key] ?? '';
      return;
    }
    for (const key of entryKeys) form.elements[key].value = entry[key] ?? '';
    form.elements.bullets.value = (entry.bullets || []).join('\n');
  }

  function values(publication, original) {
    const field = (key) => form.elements[key].value.trim();
    const next = { ...original, title: field('title') };
    if (!next.title) throw new Error('Enter a title.');
    if (publication) {
      next.authors = field('authors').split(',').map((name) => name.trim()).filter(Boolean);
      next.venue = field('venue');
      next.year = Number(field('year'));
      next.paper = field('paper');
      if (!next.authors.length || !next.venue) throw new Error('Enter the authors and the venue or publication type.');
      if (!Number.isInteger(next.year) || next.year < 1000 || next.year > 9999) throw new Error('Enter a four-digit year.');
      if (!validLink(next.paper)) throw new Error('Enter an HTTP or HTTPS paper URL.');
      return next;
    }
    if (field('href') && !validLink(field('href'), true)) throw new Error('Use HTTP, HTTPS, or a link within this site.');
    for (const key of entryKeys) {
      const value = field(key);
      if (value) next[key] = value;
      else delete next[key];
    }
    const bullets = field('bullets').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (bullets.length) next.bullets = bullets;
    else delete next.bullets;
    return next;
  }

  toggle.addEventListener('click', () => {
    if (saved || !window.siteAdmin?.isSignedIn()) return;
    setExpanded(!expanded);
  });

  for (const button of controls) {
    button.addEventListener('click', async () => {
      if (!expanded || saved || !window.siteAdmin?.isSignedIn()) return;
      const sequence = ++loadSequence;
      const scope = button.dataset.cvSection;
      const publication = scope === 'publications';
      const existing = button.hasAttribute('data-cv-edit') || button.hasAttribute('data-cv-entry');
      const entryId = button.dataset.cvEntry;
      openedBy = button;
      active = undefined;
      form.reset();
      setFields(publication, true);
      refresh.hidden = true;
      heading.textContent = existing ? 'Edit CV entry' : 'Add CV entry';
      setStatus('Loading CV…');
      dialog.showModal();
      cancel.focus();
      try {
        const { contents, sha } = await window.siteAdmin.readEntry(path);
        if (sequence !== loadSequence || !dialog.open) return;
        const data = JSON.parse(contents);
        const { entries, name } = selectCollection(data, scope, button.dataset.cvSectionName);
        if (!Array.isArray(entries)) throw new Error('This CV section could not be read.');
        const index = existing && entryId ? entries.findIndex((entry) => entry.id === entryId) : -1;
        if (existing && index < 0) throw new Error('This entry changed on GitHub. Refresh the CV before editing it.');
        const entry = existing ? entries[index] : { id: crypto.randomUUID() };
        active = { data, entries, index, entry, sha, publication };
        heading.textContent = (existing ? 'Edit ' : 'Add ') + (publication ? 'publication' : 'entry · ' + name);
        fill(entry, publication);
        setFields(publication, false);
        setStatus('');
        form.elements.title.focus();
      } catch (error) {
        if (sequence !== loadSequence || !dialog.open) return;
        setStatus(error?.message || 'Could not load the CV.', true);
        refresh.hidden = false;
      }
    });
  }

  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    loadSequence++;
    if (saved) notice.querySelector('a')?.focus();
    else if (!openedBy?.hidden) openedBy?.focus();
    else toggle.focus();
  });
  window.addEventListener('site-admin-auth', (event) => {
    if (event.detail?.signedIn) return;
    setExpanded(false);
    if (dialog.open && !busy) dialog.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!active || busy || !window.siteAdmin?.isSignedIn()) return;

    let next;
    try {
      next = values(active.publication, active.entry);
    } catch (error) {
      setStatus(error.message, true);
      return;
    }

    const applied = active;
    if (applied.index < 0) applied.entries.unshift(next);
    else applied.entries[applied.index] = next;
    const signature = JSON.stringify(next);
    if (applied.signature !== signature) {
      applied.signature = signature;
      applied.revision = crypto.randomUUID();
    }
    const revision = applied.revision;

    busy = true;
    cancel.disabled = true;
    setFields(applied.publication, true);
    setStatus('Saving changes…');
    try {
      const contents = JSON.stringify({ ...applied.data, revision }, null, 2) + '\n';
      const result = await window.siteAdmin.updateEntry(path, contents, 'Update curriculum vitae', [], applied.sha);
      saved = true;
      setExpanded(false);
      notice.hidden = false;
      dialog.close();
      window.dispatchEvent(new CustomEvent('site-cv-commit', { detail: { sha: result?.commit?.sha, path, revision } }));
    } catch (error) {
      if (applied.index < 0) applied.entries.shift();
      else applied.entries[applied.index] = applied.entry;
      setStatus(error?.message || 'Could not save the CV.', true);
      if (error?.status === 409 || error?.status === 404) refresh.hidden = false;
    } finally {
      busy = false;
      cancel.disabled = false;
      if (!window.siteAdmin.isSignedIn() && dialog.open) dialog.close();
      if (!saved && !refresh.hidden) cancel.focus();
      else if (!saved) setFields(applied.publication, false);
    }
  });
})();
