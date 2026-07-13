// Find within the current document, or across every document in the project.
import { walkDocs } from './store.js';

export function initSearch(app) {
  const bar = document.getElementById('search-bar');
  const input = document.getElementById('search-input');
  const count = document.getElementById('search-count');
  const results = document.getElementById('search-results');
  const page = document.getElementById('page');
  let matches = [];   // [start] offsets in the current doc
  let idx = -1;

  function open() {
    bar.hidden = false;
    const sel = page.value.slice(page.selectionStart, page.selectionEnd);
    if (sel && sel.length < 60) input.value = sel;
    input.focus(); input.select();
    run();
  }
  function close() {
    bar.hidden = true; results.hidden = true; results.textContent = '';
    page.focus();
  }

  function run() {
    const q = input.value;
    matches = [];
    results.hidden = true;
    if (!q) { count.textContent = ''; return; }
    const body = page.value.toLowerCase();
    const needle = q.toLowerCase();
    let i = body.indexOf(needle);
    while (i !== -1) { matches.push(i); i = body.indexOf(needle, i + needle.length); }
    count.textContent = matches.length ? `1/${matches.length}` : '0';
    if (matches.length) { idx = 0; go(0); }
  }

  function go(n) {
    if (!matches.length) return;
    idx = (n + matches.length) % matches.length;
    const start = matches[idx];
    const end = start + input.value.length;
    page.focus();
    page.setSelectionRange(start, end);
    // nudge the textarea to scroll the match into view
    const before = page.value.slice(0, start);
    const lines = before.split('\n').length;
    page.scrollTop = Math.max(0, (lines - 4) * parseFloat(getComputedStyle(page).lineHeight || '24'));
    count.textContent = `${idx + 1}/${matches.length}`;
  }

  function searchAll() {
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    results.textContent = '';
    let total = 0;
    walkDocs(app.state.tree, (node) => {
      const doc = app.state.documents[node.id];
      if (!doc) return;
      const body = doc.body.toLowerCase();
      let c = 0, i = body.indexOf(q);
      const firstAt = i;
      while (i !== -1) { c++; i = body.indexOf(q, i + q.length); }
      if (!c) return;
      total += c;
      const hit = document.createElement('div');
      hit.className = 'hit';
      const ctxStart = Math.max(0, firstAt - 24);
      const snippet = doc.body.slice(ctxStart, firstAt + q.length + 24);
      hit.innerHTML = '';
      const strong = document.createElement('strong'); strong.textContent = node.title;
      hit.append(strong, document.createTextNode(` (${c}) — …${snippet}…`));
      hit.addEventListener('click', () => {
        app.openDoc(node.id);
        input.value = q;
        run();
      });
      results.append(hit);
    });
    if (!total) results.append(Object.assign(document.createElement('div'), { className: 'hit', textContent: 'Tidak ditemukan di dokumen mana pun.' }));
    results.hidden = false;
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); go(idx + (e.shiftKey ? -1 : 1)); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  document.getElementById('search-next').addEventListener('click', () => go(idx + 1));
  document.getElementById('search-prev').addEventListener('click', () => go(idx - 1));
  document.getElementById('search-all').addEventListener('click', searchAll);
  document.getElementById('search-close').addEventListener('click', close);
  document.getElementById('btn-search').addEventListener('click', () => bar.hidden ? open() : close());
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); open(); }
  });

  app.openSearch = open;
}
