(() => {
  const current = document.getElementById('recent-news');
  if (!current) return;

  const seoulDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const [year, month, day] = seoulDate.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1 - 6, 1));
  const cutoffYear = monthStart.getUTCFullYear();
  const cutoffMonth = monthStart.getUTCMonth();
  const monthEnd = new Date(Date.UTC(cutoffYear, cutoffMonth + 1, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(cutoffYear, cutoffMonth, Math.min(day, monthEnd))).toISOString().slice(0, 10);
  const archive = document.getElementById('older-news');
  const older = document.getElementById('older-news-items');

  for (const item of Array.from(current.children)) {
    const date = item.querySelector('time').dateTime;
    // Keep month-only entries in the cutoff month, since their exact date is unknown.
    if (date < cutoff.slice(0, date.length)) older.append(item);
  }

  document.getElementById('recent-news-title').hidden = false;
  document.getElementById('recent-news-empty').hidden = current.children.length > 0;
  current.hidden = current.children.length === 0;
  if (older.children.length > 0) {
    document.getElementById('older-news-count').textContent = '(' + older.children.length + ')';
    archive.hidden = false;
  }
})();
