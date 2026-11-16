export function markExternalLinks(container) {
  for (const link of container.querySelectorAll('a[href]')) {
    const webLink = link.protocol === 'https:' || link.protocol === 'http:';
    if (!webLink || link.origin === location.origin || link.hasAttribute('download')) continue;
    link.target = '_blank';
    link.relList.add('noopener');
  }
}

markExternalLinks(document);
