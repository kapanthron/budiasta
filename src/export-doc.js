// Download & share: pick any combination of TXT / DOC / PDF / Markdown.
import { walkDocs } from './store.js';

export function initExportDoc(app) {
  const dlg = document.getElementById('export-dialog');
  const scopeSel = document.getElementById('exp-scope');

  document.getElementById('btn-download').addEventListener('click', () => dlg.showModal());
  document.getElementById('exp-close').addEventListener('click', () => dlg.close());

  function collect() {
    if (scopeSel.value === 'doc') {
      const doc = app.state.documents[app.currentDocId];
      if (!doc) return [];
      let title = 'Dokumen';
      walkDocs(app.state.tree, (n) => { if (n.id === app.currentDocId) title = n.title; });
      return [{ title, body: doc.body }];
    }
    const parts = [];
    walkDocs(app.state.tree, (n) => {
      const d = app.state.documents[n.id];
      if (d && d.body.trim()) parts.push({ title: n.title, body: d.body });
    });
    return parts;
  }

  const baseName = () => (app.state.project.title || 'budiasta').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_');
  const asText = (parts) => parts.map(p => `${p.title}\n\n${p.body}`).join('\n\n* * *\n\n');
  const asMarkdown = (parts) => parts.map(p => `# ${p.title}\n\n${p.body}`).join('\n\n---\n\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // render the Markdown marks we support into inline HTML for DOC output
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>');
  const paras = (body) => body.split(/\n{2,}/).map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('\n');

  function docHtml(parts) {
    return `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">` +
      `<title>${esc(app.state.project.title)}</title></head>` +
      `<body style="font-family:Georgia,serif;font-size:12pt;line-height:1.6">` +
      parts.map(p => `<h1>${esc(p.title)}</h1>${paras(p.body)}`).join('<br clear="all" style="page-break-before:always">') +
      `</body></html>`;
  }

  function chosen() {
    return {
      txt: document.getElementById('fmt-txt').checked,
      doc: document.getElementById('fmt-docx').checked,
      pdf: document.getElementById('fmt-pdf').checked,
      md: document.getElementById('fmt-md').checked,
    };
  }

  function blobFor(fmt, parts) {
    if (fmt === 'txt') return { blob: new Blob([asText(parts)], { type: 'text/plain;charset=utf-8' }), ext: 'txt' };
    if (fmt === 'md') return { blob: new Blob([asMarkdown(parts)], { type: 'text/markdown;charset=utf-8' }), ext: 'md' };
    if (fmt === 'doc') return { blob: new Blob(['﻿', docHtml(parts)], { type: 'application/msword' }), ext: 'doc' };
    return null;
  }

  function saveBlob(blob, ext) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printPdf(parts) {
    const area = document.getElementById('print-area');
    area.textContent = '';
    parts.forEach((p, i) => {
      const h = document.createElement('h1');
      h.textContent = p.title;
      if (i > 0) h.className = 'doc-break';
      area.append(h);
      for (const para of p.body.split(/\n{2,}/)) {
        const el = document.createElement('p');
        el.textContent = para;
        area.append(el);
      }
    });
    window.print();
  }

  document.getElementById('exp-download').addEventListener('click', () => {
    const parts = collect();
    if (!parts.length) { alert('Tidak ada isi untuk diunduh.'); return; }
    const c = chosen();
    if (!c.txt && !c.doc && !c.pdf && !c.md) { alert('Centang minimal satu format.'); return; }
    const done = [];
    for (const fmt of ['txt', 'md', 'doc']) {
      if (!c[fmt]) continue;
      const b = blobFor(fmt, parts);
      saveBlob(b.blob, b.ext); done.push(fmt);
    }
    app.logActivity?.('unduh', done.join('+') + (c.pdf ? '+pdf' : '') + ' · ' + scopeSel.value);
    if (c.pdf) { dlg.close(); printPdf(parts); }
  });

  document.getElementById('exp-share').addEventListener('click', async () => {
    const parts = collect();
    if (!parts.length) return;
    const c = chosen();
    const files = [];
    for (const fmt of ['txt', 'md', 'doc']) {
      if (!c[fmt]) continue;
      const b = blobFor(fmt, parts);
      files.push(new File([b.blob], `${baseName()}.${b.ext}`, { type: b.blob.type }));
    }
    if (!files.length) files.push(new File([asText(parts)], `${baseName()}.txt`, { type: 'text/plain' }));
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: app.state.project.title });
        app.logActivity?.('bagikan', files.map(f => f.name.split('.').pop()).join('+'));
      } else if (navigator.share) {
        await navigator.share({ title: app.state.project.title, text: asText(parts).slice(0, 20000) });
      } else {
        await navigator.clipboard.writeText(asText(parts));
        alert('Peramban ini tidak punya menu bagikan. Teks sudah disalin ke papan klip.');
      }
    } catch { /* cancelled */ }
    if (c.pdf) printPdf(parts);
  });
}
