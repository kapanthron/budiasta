// Command palette (Ctrl/Cmd+K): commands + document jump in one list.
import { walkDocs } from './store.js';
import { THEMES } from './theme.js';

export function initPalette(app) {
  const dlg = document.getElementById('palette-dialog');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  let items = [], selIdx = 0;

  const commands = () => [
    { label: 'Dokumen baru', hint: 'binder', run: () => app.addNode('document') },
    { label: 'Map baru', hint: 'binder', run: () => app.addNode('folder') },
    { label: 'Kirim seleksi ke Cuts', hint: 'Ctrl+Shift+X', run: () => app.cutSelection() },
    { label: 'Ekspor proyek (JSON)', hint: 'berkas', run: () => app.exportProject() },
    ...THEMES.map(t => ({ label: `Tema: ${t.label}`, hint: 'tema', run: () => app.setTheme(t.id) })),
  ];

  function open() {
    items = commands();
    walkDocs(app.state.tree, (n) => items.push({ label: n.title, hint: 'buka dokumen', run: () => app.openDoc(n.id) }));
    input.value = '';
    render('');
    dlg.showModal();
    input.focus();
  }

  function render(q) {
    const ql = q.toLowerCase();
    const vis = items.filter(i => i.label.toLowerCase().includes(ql)).slice(0, 12);
    list.textContent = '';
    selIdx = 0;
    vis.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = item.label;
      const hint = document.createElement('span');
      hint.className = 'hint'; hint.textContent = item.hint;
      li.append(hint);
      if (i === 0) li.classList.add('sel');
      li.addEventListener('click', () => { dlg.close(); item.run(); });
      list.append(li);
    });
    list._vis = vis;
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    const vis = list._vis || [];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : vis.length - 1)) % Math.max(1, vis.length);
      [...list.children].forEach((li, i) => li.classList.toggle('sel', i === selIdx));
    } else if (e.key === 'Enter' && vis[selIdx]) {
      dlg.close(); vis[selIdx].run();
    }
  });

  document.getElementById('btn-palette').addEventListener('click', open);
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
  });
}
