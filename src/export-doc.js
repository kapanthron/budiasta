// Download & share the manuscript: TXT, DOC (Word-compatible HTML), PDF via print, Web Share.
import { walkDocs } from './store.js';

export function initExportDoc(app) {
  const dlg = document.getElementById('export-dialog');
  const scopeSel = document.getElementById('exp-scope');

  document.getElementById('btn-download').addEventListener('click', () => dlg.showModal());
  document.getElementById('exp-close').addEventListener('click', () => dlg.close());

  // [{title, body}] for the chosen scope, in binder order
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

  function download(blob, ext) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const asText = (parts) => parts.map(p => `${p.title}\n\n${p.body}`).join('\n\n* * *\n\n');

  document.getElementById('exp-txt').addEventListener('click', () => {
    const parts = collect();
    if (!parts.length) return;
    download(new Blob([asText(parts)], { type: 'text/plain;charset=utf-8' }), 'txt');
    app.logActivity?.('unduh-txt', scopeSel.value);
  });

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paras = (body) => body.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

  document.getElementById('exp-doc').addEventListener('click', () => {
    const parts = collect();
    if (!parts.length) return;
    // Word opens HTML documents saved as .doc; this needs no zip library.
    const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">` +
      `<title>${esc(app.state.project.title)}</title></head>` +
      `<body style="font-family:Georgia,serif;font-size:12pt;line-height:1.6">` +
      parts.map(p => `<h1>${esc(p.title)}</h1>${paras(p.body)}`).join('<br clear="all" style="page-break-before:always">') +
      `</body></html>`;
    download(new Blob(['﻿', html], { type: 'application/msword' }), 'doc');
    app.logActivity?.('unduh-doc', scopeSel.value);
  });

  document.getElementById('exp-pdf').addEventListener('click', () => {
    const parts = collect();
    if (!parts.length) return;
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
    dlg.close();
    app.logActivity?.('unduh-pdf', scopeSel.value);
    window.print();
  });

  document.getElementById('exp-share').addEventListener('click', async () => {
    const parts = collect();
    if (!parts.length) return;
    const text = asText(parts);
    const file = new File([text], `${baseName()}.txt`, { type: 'text/plain' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: app.state.project.title });
        app.logActivity?.('bagikan', scopeSel.value);
      } else if (navigator.share) {
        await navigator.share({ title: app.state.project.title, text: text.slice(0, 20000) });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Peramban ini tidak punya menu bagikan. Teks sudah disalin ke papan klip.');
      }
    } catch { /* user cancelled the share sheet */ }
  });
}
