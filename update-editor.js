(() => {
  const form = document.getElementById('update-editor-form');
  if (!form) return;

  const editPath = new URLSearchParams(location.search).get('edit');
  const validPath = /^_data\/updates\/[a-z0-9-]+\.json$/;
  const storageKey = 'suhyeong10.update-draft.v1' + (editPath ? ':' + editPath : '');
  const fieldNames = ['date', 'before', 'label', 'url', 'after'];
  const fields = form.querySelector('fieldset');
  const linkOptions = document.getElementById('update-link-options');
  const draftNote = document.getElementById('update-draft-note');
  const status = document.getElementById('update-editor-status');
  const loadPanel = document.getElementById('update-editor-load');
  const loadStatus = document.getElementById('update-load-status');
  const retry = document.getElementById('update-load-retry');
  const conflict = document.getElementById('update-draft-conflict');
  const applyDraft = document.getElementById('update-restore-draft');
  const acceptLatest = document.getElementById('update-accept-latest');
  const saveButton = document.getElementById('update-save');
  const deleteZone = document.getElementById('update-delete-zone');
  const deleteButton = document.getElementById('update-delete');
  const confirmation = document.getElementById('update-delete-confirmation');
  const cancelButton = document.getElementById('update-cancel-delete');
  const confirmButton = document.getElementById('update-confirm-delete');
  const result = document.getElementById('update-editor-result');
  let base;
  let reviewed = false;
  let pendingDraft;
  let newPath;
  let loadJob = 0;
  let working = false;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }

  function fieldValues() {
    return Object.fromEntries(fieldNames.map((name) => [name, form.elements[name].value]));
  }

  function editableFields(record) {
    return Object.fromEntries(fieldNames.map((name) => [name, typeof record?.[name] === 'string' ? record[name] : '']));
  }

  function fill(record) {
    for (const [name, value] of Object.entries(editableFields(record))) form.elements[name].value = value;
    linkOptions.open = Boolean(form.elements.label.value || form.elements.url.value || form.elements.after.value);
  }

  function readDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey));
      return draft?.values && typeof draft.values === 'object' ? draft : undefined;
    } catch {
      return undefined;
    }
  }

  function saveDraft() {
    if (editPath && !reviewed) return;
    const values = fieldValues();
    const baseline = base ? editableFields(base.record) : undefined;
    const changed = baseline ? fieldNames.some((name) => values[name] !== baseline[name])
      : fieldNames.slice(1).some((name) => values[name]) || newPath;
    try {
      if (changed) {
        localStorage.setItem(storageKey, JSON.stringify({ values, baseline, sha: base?.sha, path: newPath }));
      } else {
        localStorage.removeItem(storageKey);
      }
      draftNote.textContent = changed ? 'Draft saved in this browser.' : '';
    } catch {
      draftNote.textContent = 'This browser could not save your draft. Keep this page open.';
    }
  }

  function syncControls() {
    fields.disabled = working || Boolean(editPath && !reviewed);
    saveButton.disabled = deleteButton.disabled = fields.disabled;
    confirmButton.disabled = cancelButton.disabled = working;
  }

  function showConfirmation(open) {
    confirmation.hidden = !open;
    deleteButton.hidden = open;
  }

  async function loadExisting(needsReview = false) {
    if (!window.siteAdmin.isSignedIn() || !result.hidden) return;
    const job = ++loadJob;
    form.hidden = true;
    loadPanel.hidden = false;
    retry.hidden = true;
    loadStatus.textContent = 'Loading update…';
    if (!validPath.test(editPath)) {
      loadStatus.textContent = 'This update link is invalid.';
      return;
    }
    try {
      const { contents, sha } = await window.siteAdmin.readEntry(editPath);
      if (job !== loadJob || !window.siteAdmin.isSignedIn()) return;
      const record = JSON.parse(contents);
      if (typeof record?.date !== 'string') throw new Error('This update could not be read.');
      base = { record, sha };
      const draft = readDraft();
      pendingDraft = draft && draft.sha !== sha ? draft : undefined;
      reviewed = !needsReview && !pendingDraft;
      fill(draft?.sha === sha ? draft.values : record);
      conflict.hidden = reviewed;
      applyDraft.hidden = !pendingDraft;
      showConfirmation(false);
      draftNote.textContent = reviewed && draft ? 'Draft restored from this browser.' : '';
      setStatus('');
      syncControls();
      loadPanel.hidden = true;
      form.hidden = false;
    } catch (error) {
      if (job !== loadJob) return;
      loadStatus.textContent = error.status === 404 ? 'This update is no longer available.'
        : error.message || 'Could not load this update.';
      retry.hidden = error.status === 404;
    }
  }

  function setReview(useDraft) {
    if (useDraft && pendingDraft) {
      const values = editableFields(base.record);
      for (const name of fieldNames) {
        if (pendingDraft.values[name] !== pendingDraft.baseline?.[name]) {
          values[name] = pendingDraft.values[name];
        }
      }
      fill(values);
    } else {
      fill(base.record);
    }
    reviewed = true;
    pendingDraft = undefined;
    conflict.hidden = true;
    syncControls();
    saveDraft();
    form.elements.before.focus();
  }

  function isAllowedUrl(value) {
    try {
      if (/^\/(?!\/)[^\\\s]*$/.test(value)) return new URL(value, location.origin).origin === location.origin;
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function buildRecord() {
    const { date, before: opening, label: link, url: target, after: ending } = fieldValues();
    const fullDate = date.length === 7 ? date + '-01' : date;
    const dateValue = new Date(fullDate + 'T00:00:00Z');
    const before = opening.trim();
    const label = link.trim();
    const url = target.trim();
    const after = ending.trim();
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date) || !Number.isFinite(dateValue.valueOf()) ||
        dateValue.toISOString().slice(0, 10) !== fullDate) {
      throw new Error('Enter a valid month or date.');
    }
    const record = { ...base?.record, date, before };
    for (const field of ['label', 'url', 'after']) delete record[field];
    if (url !== base?.record.url) delete record.fallback_url;
    if (label || url || after) {
      linkOptions.open = true;
      if (!label || !url || !isAllowedUrl(url)) throw new Error('Enter link text and a valid web or site URL.');
      record.before = before ? before + ' ' : '';
      record.label = label;
      record.url = url;
      if (after) record.after = /^[.,;:!?)}\]]/.test(after) ? after : ' ' + after;
      return record;
    }
    if (!before) throw new Error('Write an update or add a link.');
    return record;
  }

  function finish(removing) {
    try { localStorage.removeItem(storageKey); } catch { /* The update is already saved. */ }
    form.hidden = true;
    result.hidden = false;
    document.getElementById('update-result-title').textContent = removing ? 'Update deleted' : 'Update saved';
    document.getElementById('update-result-description').textContent = removing
      ? 'The item will disappear from Recently after GitHub Pages rebuilds.'
      : 'Your update will appear in Recently after GitHub Pages rebuilds.';
    result.focus();
  }

  async function publish(removing) {
    if (!window.siteAdmin.isSignedIn() || working || (editPath && !reviewed)) return;
    let record;
    try {
      if (!removing) record = buildRecord();
    } catch (error) {
      setStatus(error.message, true);
      return;
    }
    if (!editPath) {
      newPath ||= '_data/updates/' + crypto.randomUUID() + '.json';
    }
    saveDraft();
    working = true;
    syncControls();
    setStatus(removing ? 'Deleting update…' : 'Saving update…');
    try {
      if (removing) {
        await window.siteAdmin.deleteEntry(editPath, 'Delete site update: ' + base.record.date, base.sha);
      } else {
        const contents = JSON.stringify(record, null, 2) + '\n';
        if (editPath) {
          await window.siteAdmin.updateEntry(editPath, contents, 'Edit site update: ' + record.date, [], base.sha);
        } else {
          await window.siteAdmin.createFile(newPath, contents, 'Add site update: ' + record.date);
        }
      }
      finish(removing);
    } catch (error) {
      if (editPath && error.status === 409) await loadExisting(true);
      else setStatus(error.message || 'Could not save this update.', true);
    } finally {
      working = false;
      syncControls();
    }
  }

  form.addEventListener('input', saveDraft);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void publish(false);
  });
  retry.addEventListener('click', () => { void loadExisting(); });
  applyDraft.addEventListener('click', () => setReview(true));
  acceptLatest.addEventListener('click', () => setReview(false));
  deleteButton.addEventListener('click', () => {
    showConfirmation(true);
    cancelButton.focus();
  });
  cancelButton.addEventListener('click', () => {
    showConfirmation(false);
    deleteButton.focus();
  });
  confirmButton.addEventListener('click', () => { void publish(true); });

  if (editPath) {
    document.title = 'Edit update · Suhyeong Park';
    document.getElementById('update-editor-title').textContent = 'Edit update';
    saveButton.textContent = 'Save changes';
    deleteZone.hidden = false;
    window.addEventListener('site-admin-auth', (event) => {
      if (event.detail.signedIn) void loadExisting();
      else {
        ++loadJob;
        showConfirmation(false);
      }
    });
    if (window.siteAdmin.isSignedIn()) void loadExisting();
  } else {
    const draft = readDraft();
    if (draft) {
      fill(draft.values);
      if (validPath.test(draft.path || '')) newPath = draft.path;
      draftNote.textContent = 'Draft restored from this browser.';
    } else {
      form.elements.date.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    }
    form.hidden = false;
  }
})();
