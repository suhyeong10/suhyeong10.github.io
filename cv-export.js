(() => {
  const cv = document.querySelector('.cv-page');
  const button = document.getElementById('cv-export');
  if (!cv || !button) return;

  const colors = { ink: '#212823', accent: '#07536b', muted: '#56615b', rule: '#c6cfca' };
  const body = { size: 10.1, line: 12.85, color: colors.ink };
  const small = { size: 9.15, line: 11.9, color: colors.muted };
  const entryTitle = { ...body, weight: 'bold' };
  const page = { top: 44, side: 47, bottom: 48 };
  // PDF's standard Helvetica uses WinAnsi. Use the browser's text layout for
  // other glyphs to keep future multilingual content readable.
  const winAnsi = /^[\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/;
  const text = (element) => element?.textContent.replace(/\s+/g, ' ').trim() || '';

  function renderPdf(JsPdf) {
    const doc = new JsPdf({ format: 'a4', unit: 'pt', compress: true, putOnlyUsedFonts: true });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - page.side;
    const bottom = height - page.bottom;
    const available = width - page.side * 2;
    const canvas = document.createElement('canvas');
    const canvasContext = canvas.getContext('2d');
    const graphemes = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
    let y = page.top;

    function setFont(style) {
      doc.setFont('helvetica', style.weight || 'normal').setFontSize(style.size).setTextColor(style.color);
    }

    function setCanvasFont(context, style) {
      context.font = `${style.weight || 'normal'} ${style.size}px Arial, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    }

    function measure(line, style) {
      if (!winAnsi.test(line)) {
        if (!canvasContext) throw new Error('This browser could not draw the CV text.');
        setCanvasFont(canvasContext, style);
        return canvasContext.measureText(line).width;
      }
      setFont(style);
      return doc.getTextWidth(line);
    }

    function wrap(value, style, maxWidth = available) {
      if (!value) return [];
      const lines = [];
      let line = '';
      for (const word of value.split(' ')) {
        const joined = line ? line + ' ' + word : word;
        if (measure(joined, style) <= maxWidth) {
          line = joined;
          continue;
        }
        if (line) lines.push(line);
        if (measure(word, style) <= maxWidth) {
          line = word;
          continue;
        }
        line = '';
        const clusters = graphemes
          ? Array.from(graphemes.segment(word), (part) => part.segment)
          : [...word];
        for (const cluster of clusters) {
          if (line && measure(line + cluster, style) > maxWidth) {
            lines.push(line);
            line = '';
          }
          line += cluster;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    function newPage() {
      doc.addPage();
      y = page.top;
    }

    function print(line, x, top, style, { link, alignRight = false } = {}) {
      const textWidth = measure(line, style);
      const left = alignRight ? x - textWidth : x;
      if (winAnsi.test(line)) {
        setFont(style);
        doc.text(line, left, top + style.size * .86);
      } else {
        const scale = 3;
        const imageWidth = Math.ceil(textWidth + 2);
        const imageHeight = Math.ceil(style.line + 2);
        canvas.width = imageWidth * scale;
        canvas.height = imageHeight * scale;
        canvasContext.scale(scale, scale);
        setCanvasFont(canvasContext, style);
        canvasContext.fillStyle = style.color;
        canvasContext.fillText(line, 0, style.size * .86);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', left, top, imageWidth, imageHeight);
      }
      if (link) doc.link(left, top, Math.max(1, textWidth), style.line, { url: link });
    }

    function lineBlock(lines, style, { x = page.side, link } = {}) {
      for (const line of lines) {
        if (y + style.line > bottom) newPage();
        print(line, x, y, style, { link });
        y += style.line;
      }
    }

    function rule(at, color = colors.rule, weight = .55) {
      doc.setDrawColor(color).setLineWidth(weight).line(page.side, at, right, at);
    }

    function formatEntry(entry) {
      const title = entry.querySelector('h3');
      const date = text(entry.querySelector('.cv-entry-date'));
      const dateWidth = date ? Math.min(125, measure(date, small)) : 0;
      const dateLines = date ? wrap(date, small, dateWidth + .01) : [];
      const titleLines = wrap(text(title), entryTitle, available - (date ? dateWidth + 15 : 0));
      const details = [
        { lines: wrap(text(entry.querySelector('.cv-entry-meta')), small), style: small },
        { lines: wrap(text(entry.querySelector('.cv-entry-description')), body), style: body },
        ...[...entry.querySelectorAll('.cv-entry-details li')].map((bullet) => ({
          lines: wrap(text(bullet), body, available - 11), style: body, bullet: true
        }))
      ].filter((part) => part.lines.length);
      const headingRows = Math.max(titleLines.length, dateLines.length);
      const headingHeight = headingRows * entryTitle.line;
      const detailHeight = details.reduce((sum, part) => sum + part.lines.length * part.style.line + 1.6, 0);
      return { titleLines, dateLines, details, headingRows, headingHeight, height: headingHeight + detailHeight,
        link: title?.querySelector('a')?.href };
    }

    function printEntry(entry) {
      for (let index = 0; index < entry.headingRows; index += 1) {
        if (y + entryTitle.line > bottom) newPage();
        if (entry.dateLines[index]) print(entry.dateLines[index], right, y, small, { alignRight: true });
        if (entry.titleLines[index]) print(entry.titleLines[index], page.side, y, entryTitle, { link: entry.link });
        y += entryTitle.line;
      }
      for (const part of entry.details) {
        y += 1.6;
        if (part.bullet) {
          if (y + part.style.line > bottom) newPage();
          print('•', page.side, y, part.style);
        }
        lineBlock(part.lines, part.style, { x: page.side + (part.bullet ? 11 : 0) });
      }
    }

    const name = text(cv.querySelector('h1'));
    const sectionTitle = { size: 13, line: 17, weight: 'bold', color: colors.accent };
    doc.setProperties({ title: `${name} — Curriculum Vitae`, author: name, subject: 'Curriculum Vitae' });
    const eyebrow = { size: 8.75, line: 13, weight: 'bold', color: colors.accent };
    lineBlock(['CURRICULUM VITAE'], eyebrow);
    y += 4;
    const nameStyle = { size: 29, line: 34, weight: 'bold', color: colors.ink };
    lineBlock(wrap(name, nameStyle), nameStyle);
    y += 5;
    let contactX = page.side;
    const dotGap = 9;
    for (const contact of cv.querySelectorAll('.cv-contact li')) {
      const value = text(contact);
      if (!value) continue;
      const contactWidth = measure(value, small);
      if (contactX !== page.side && contactX + contactWidth + dotGap * 2 > right) {
        y += small.line;
        contactX = page.side;
      }
      if (contactX !== page.side) {
        print('·', contactX + dotGap * .8, y, small);
        contactX += dotGap * 2;
      }
      const link = contact.querySelector('a')?.href;
      if (contactWidth > available) {
        lineBlock(wrap(value, small), small, { link });
        contactX = page.side;
      } else {
        print(value, contactX, y, small, { link });
        contactX += contactWidth;
      }
    }
    y += small.line + 10;
    rule(y, colors.accent, 1.15);
    y += 17;

    for (const section of cv.querySelectorAll('.cv-section')) {
      const titleLines = wrap(text(section.querySelector('h2')), sectionTitle);
      const entries = [...section.querySelectorAll('.cv-entry')].map(formatEntry);
      if (!titleLines.length || !entries.length) continue;
      const headingHeight = titleLines.length * sectionTitle.line + 7;
      const first = entries[0];
      const pageSpace = bottom - page.top;
      const firstMinimum = first.height + headingHeight <= pageSpace
        ? first.height : body.line * 2;
      if (y + headingHeight + firstMinimum > bottom) newPage();
      lineBlock(titleLines, sectionTitle);
      rule(y + 1);
      y += 7;
      for (const [index, entry] of entries.entries()) {
        const minimum = entry.height <= pageSpace ? entry.height : body.line * 2;
        if (index > 0 && y + minimum > bottom) newPage();
        printEntry(entry);
        y += 6.5;
      }
      y += 9;
    }

    const pageCount = doc.getNumberOfPages();
    for (let index = 1; index <= pageCount; index += 1) {
      doc.setPage(index);
      rule(height - 38);
      print(name, page.side, height - 29, small);
      print(`${index} / ${pageCount}`, right, height - 29, small, { alignRight: true });
    }
    return doc;
  }

  let exporting = false;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (exporting || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    exporting = true;
    button.setAttribute('aria-busy', 'true');
    const status = document.getElementById('cv-export-status');
    if (status) status.textContent = 'Preparing PDF…';
    try {
      const JsPdf = window.jspdf?.jsPDF;
      if (!JsPdf) throw new Error('The PDF exporter could not load.');
      const doc = renderPdf(JsPdf);
      await doc.save('Suhyeong-Park-CV.pdf', { returnPromise: true });
      if (status) status.textContent = '';
    } catch (error) {
      if (status) status.textContent = 'PDF export failed. Reload the page and try again.';
      else window.alert(error.message || 'PDF export failed. Reload the page and try again.');
    } finally {
      exporting = false;
      button.removeAttribute('aria-busy');
    }
  });
})();
