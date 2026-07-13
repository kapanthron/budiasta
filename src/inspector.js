// Inspector: Dokumen / Bahasa / Snapshot / Cuts tabs.
import { uid } from './store.js';
import { renderBahasaTab } from './bahasa.js';

export function initInspector(app) {
  const tabs = document.getElementById('insp-tabs');
  const body = document.getElementById('insp-body');
  let active = 'info';

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    active = btn.dataset.tab;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  };
  const field = (labelText, input) => el('label', {}, labelText, input);

  function render() {
    body.textContent = '';
    const doc = app.state.documents[app.currentDocId];
    if (active === 'bahasa') return renderBahasaTab(app, body);
    if (!doc) { body.append(el('p', { className: 'insp-note' }, 'Pilih dokumen di binder.')); return; }
    if (active === 'info') renderInfo(doc);
    if (active === 'snapshots') renderSnapshots(doc);
    if (active === 'cuts') renderCuts();
  }

  function bind(input, obj, key, numeric = false) {
    input.addEventListener('input', () => {
      obj[key] = numeric ? (parseInt(input.value, 10) || 0) : input.value;
      app.save(); app.refreshStatus?.();
    });
    return input;
  }

  function renderInfo(doc) {
    const syn = el('textarea', { value: doc.synopsis, placeholder: 'Sinopsis satu paragraf…' });
    const notes = el('textarea', { value: doc.notes, placeholder: 'Catatan kerja…' });
    const pov = el('input', { value: doc.pov, placeholder: 'Sudut pandang' });
    const target = el('input', { type: 'number', min: 0, value: doc.targetWords || '' });
    const ceiling = el('input', { type: 'number', min: 0, value: doc.ceilingWords || '' });
    const status = el('select', {},
      ...['draft', 'revisi', 'final'].map(s => el('option', { value: s, textContent: s, selected: doc.status === s })));
    status.addEventListener('change', () => { doc.status = status.value; app.save(); });
    body.append(
      field('Sinopsis', bind(syn, doc, 'synopsis')),
      field('Catatan', bind(notes, doc, 'notes')),
      el('div', { className: 'insp-row' }, field('POV', bind(pov, doc, 'pov')), field('Status', status)),
      el('div', { className: 'insp-row' },
        field('Target kata', bind(target, doc, 'targetWords', true)),
        field('Pagu kata (maks.)', bind(ceiling, doc, 'ceilingWords', true))),
      el('p', { className: 'insp-note' }, 'Pagu untuk kolumnis: status bar menghitung kata yang harus dipangkas, bukan nilai rapor.'),
    );
  }

  function renderSnapshots(doc) {
    const take = el('button', { textContent: '+ Ambil snapshot' });
    take.addEventListener('click', () => {
      const title = prompt('Nama snapshot', new Date().toLocaleString('id-ID')) ?? '';
      if (title === null) return;
      (app.state.snapshots[app.currentDocId] ??= []).unshift(
        { id: uid(), title: title || new Date().toLocaleString('id-ID'), takenAt: new Date().toISOString(), body: doc.body });
      app.save(); render();
    });
    body.append(take);
    const list = app.state.snapshots[app.currentDocId] || [];
    if (!list.length) body.append(el('p', { className: 'insp-note' }, 'Belum ada snapshot. Snapshot otomatis diambil sebelum pemulihan.'));
    for (const s of list) {
      const restore = el('button', { textContent: 'Pulihkan' });
      restore.addEventListener('click', () => {
        // snapshot the present before rolling back — never lose a word
        (app.state.snapshots[app.currentDocId] ??= []).unshift(
          { id: uid(), title: 'sebelum pemulihan', takenAt: new Date().toISOString(), body: doc.body });
        doc.body = s.body;
        app.renderEditor(); app.save(); render();
      });
      body.append(el('div', { className: 'card' },
        el('strong', {}, s.title),
        el('span', { className: 'insp-note' }, `${new Date(s.takenAt).toLocaleString('id-ID')} · ${s.body.length} karakter`),
        el('div', { className: 'card-actions' }, restore)));
    }
  }

  function renderCuts() {
    body.append(el('p', { className: 'insp-note' },
      'Sorot teks lalu tekan Ctrl+Shift+X untuk memindahkannya ke sini. Tidak ada yang dibuang.'));
    if (!app.state.cuts.length) body.append(el('p', { className: 'insp-note' }, 'Laci masih kosong.'));
    for (const cut of app.state.cuts) {
      const restore = el('button', { textContent: 'Kembalikan ke kursor' });
      restore.addEventListener('click', () => {
        const page = document.getElementById('page');
        app.applyEdit(page.selectionStart, page.selectionEnd, cut.text);
        app.state.cuts = app.state.cuts.filter(c => c.id !== cut.id);
        app.save(); render();
      });
      const drop = el('button', { textContent: 'Buang' });
      drop.addEventListener('click', () => {
        if (!confirm('Buang potongan ini untuk selamanya?')) return;
        app.state.cuts = app.state.cuts.filter(c => c.id !== cut.id);
        app.save(); render();
      });
      body.append(el('div', { className: 'card' },
        el('span', { className: 'excerpt' }, cut.text.length > 220 ? cut.text.slice(0, 220) + '…' : cut.text),
        el('span', { className: 'insp-note' }, new Date(cut.cutAt).toLocaleString('id-ID')),
        el('div', { className: 'card-actions' }, restore, drop)));
    }
  }

  app.renderInspector = render;
  render();
}
