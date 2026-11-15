(() => {
  const { counterOrigin, siteOrigin, pagePath } = document.currentScript.dataset;
  if (location.protocol !== 'https:' || location.origin !== siteOrigin) return;

  const requestOptions = { credentials: 'omit', referrerPolicy: 'no-referrer' };
  if (navigator.doNotTrack !== '1') {
    const visit = new URL('/count', counterOrigin);
    visit.searchParams.set('p', pagePath);
    visit.searchParams.set('rnd', Date.now());
    fetch(visit, { ...requestOptions, mode: 'no-cors', keepalive: true }).catch(() => {
      // The site remains usable when analytics requests are blocked.
    });
  }

  const counter = document.querySelector('.site-visit-count');
  if (!counter) return;

  fetch(new URL('/counter/TOTAL.json', counterOrigin), requestOptions)
    .then((response) => response.ok ? response.json() : null)
    .then((stats) => {
      if (typeof stats?.count !== 'string' || !/^[\d,]+$/.test(stats.count)) return;
      counter.querySelector('[data-visit-count]').textContent = `Visits ${stats.count}`;
      counter.hidden = false;
    })
    .catch(() => {
      // Keep the footer free of placeholder counts if analytics is unavailable.
    });
})();
