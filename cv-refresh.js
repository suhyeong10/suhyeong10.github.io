(() => {
  const page = document.querySelector('.cv-page');
  if (!page) return;

  const pendingKey = 'suhyeong10.cv-pending-revision';
  const exportButton = document.getElementById('cv-export');
  const pencil = document.getElementById('cv-edit-toggle');
  const notice = document.getElementById('cv-edit-notice');
  const refreshLink = notice?.querySelector('a');
  let generation = 0;
  let pending;

  try { pending = sessionStorage.getItem(pendingKey); } catch { /* Poll in this tab if storage is unavailable. */ }

  function syncControls() {
    const waiting = Boolean(pending);
    exportButton.disabled = waiting;
    pencil.disabled = waiting;
    if (notice) notice.hidden = !waiting;
  }

  function clearPending() {
    pending = undefined;
    try { sessionStorage.removeItem(pendingKey); } catch { /* Tab storage is unavailable. */ }
    syncControls();
  }

  async function waitForPages(revision) {
    const run = ++generation;
    const started = performance.now();
    while (run === generation && performance.now() - started < 120000) {
      const url = new URL(location.href);
      url.hash = '';
      url.searchParams.set('cv', Date.now());
      if (refreshLink) refreshLink.href = url.href;
      try {
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const next = new DOMParser().parseFromString(await response.text(), 'text/html');
          const renderedRevision = next.querySelector('.cv-page')?.dataset.cvRevision;
          if (renderedRevision === revision && run === generation) {
            clearPending();
            location.replace(url);
            return;
          }
        }
      } catch { /* Retry while Pages rebuilds. */ }
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  window.addEventListener('site-cv-commit', (event) => {
    const revision = event.detail.revision;
    if (typeof revision !== 'string' || !revision) return;
    pending = revision;
    try { sessionStorage.setItem(pendingKey, revision); } catch { /* Poll without persistent storage. */ }
    syncControls();
    void waitForPages(revision);
  });

  if (pending === page.dataset.cvRevision) clearPending();
  else if (pending) {
    syncControls();
    void waitForPages(pending);
  }
})();
