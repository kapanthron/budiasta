// Panel Bahasa: Periksa (PUEBI/EYD findings) and Kamus (writer-supplied KBBI).
import { loadRules, check } from './rules-engine.js';
import { renderAssistantChat } from './assistant.js';
import { kvGet, kvSet } from './store.js';

// Accept several JSON shapes, not only the PDF-tool output: an array of
// {lemma,...}, an {entries:[...]} wrapper, or an object map {lemma: entry}.
function normalizeKbbi(data) {
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    if (Array.isArray(data.entries)) arr = data.entries;
    else arr = Object.entries(data).map(([k, v]) =>
      (v && typeof v === 'object') ? { lemma: v.lemma || k, ...v }
        : { lemma: k, senses: [{ n: 1, definition: String(v) }] });
  }
  if (!Array.isArray(arr)) return null;
  arr = arr.filter(e => e && e.lemma);
  return arr.length ? arr : null;
}
const buildKbbiIndex = (arr) => new Map(arr.map(en => [String(en.lemma).toLowerCase(), en]));

let kbbi = null;          // array of entries, loaded from the writer's own file
let kbbiIndex = null;     // Map lemma -> entry
let lastFindings = [];

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

export async function renderBahasaTab(app, body) {
  await loadRules();
  if (!kbbi) {
    const stored = await kvGet('kbbi');
    if (Array.isArray(stored) && stored.length) { kbbi = stored; kbbiIndex = buildKbbiIndex(stored); }
  }
  body.textContent = '';

  // --- Periksa ---
  const run = el('button', { textContent: 'Periksa dokumen' });
  const results = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  run.addEventListener('click', () => {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    lastFindings = check(doc.body, {
      mode: app.state.project.mode,
      disabledRules: app.state.language.disabledRules,
      ignored: app.state.language.ignoredFindings,
    });
    renderFindings(app, results, doc);
  });
  body.append(
    el('div', { className: 'col-head', style: 'border:none;padding:0' }, 'Periksa'),
    el('p', { className: 'insp-note' },
      'Aturan PUEBI/EYD berjalan sepenuhnya luring. Setiap temuan menyebut id aturannya. Tidak ada nilai, tidak ada koreksi otomatis.'),
    run, results,
  );

  // --- Kamus ---
  body.append(el('div', { className: 'col-head', style: 'border:none;padding:0;margin-top:8px' }, 'Kamus'));
  const kamusOut = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  if (!kbbi) {
    body.append(
      el('p', { className: 'insp-note' },
        'Sudah punya berkas kbbi.json? Klik tombol di bawah dan pilih berkasnya — TIDAK wajib dari PDF. ' +
        'Skrip tools/kbbi_pdf_to_json.py hanyalah salah satu cara membuatnya. ' +
        'Format yang diterima: array objek berisi field "lemma" (dan "senses"), atau peta {lema: definisi}. ' +
        'Berkas tetap di peramban ini, tidak pernah dikirim ke mana pun.'),
    );
    const load = el('button', { textContent: 'Muat kbbi.json…' });
    load.addEventListener('click', () => document.getElementById('file-kbbi').click());
    document.getElementById('file-kbbi').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); }
      catch { alert('Berkas ini bukan JSON yang sah.'); return; }
      const arr = normalizeKbbi(data);
      if (!arr) { alert('JSON dimuat, tetapi tidak ditemukan entri berisi "lemma". Pastikan bentuknya array objek {lemma, senses} atau peta {lema: definisi}.'); return; }
      kbbi = arr;
      kbbiIndex = buildKbbiIndex(arr);
      await kvSet('kbbi', arr);   // simpan agar tak perlu muat ulang tiap buka
      app.logActivity?.('muat-kbbi', arr.length + ' lema');
      app.renderInspector();
    };
    body.append(load);
  } else {
    const lookupBtn = el('button', { textContent: 'Cari kata terpilih' });
    const q = el('input', { placeholder: 'atau ketik lema…' });
    const doLookup = (term) => renderEntry(app, kamusOut, term.trim().toLowerCase());
    lookupBtn.addEventListener('click', () => doLookup(app.getSelection() || q.value));
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLookup(q.value); });
    const forget = el('button', { textContent: 'Hapus kamus' });
    forget.addEventListener('click', async () => {
      if (!confirm('Hapus kamus KBBI dari peramban ini?')) return;
      kbbi = null; kbbiIndex = null; await kvSet('kbbi', null);
      app.renderInspector();
    });
    body.append(el('div', { className: 'insp-row' }, q, lookupBtn),
      el('p', { className: 'insp-note' }, `${kbbi.length} lema tersimpan di peramban ini.`),
      kamusOut, el('div', { className: 'insp-row' }, forget));
  }

  // --- Asisten: kotak chat siap pakai (setelan ada di halaman admin) ---
  await renderAssistantChat(app, body);
}

function renderFindings(app, out, doc) {
  out.textContent = '';
  if (!lastFindings.length) {
    out.append(el('p', { className: 'insp-note' }, 'Tidak ada temuan pada lapisan aturan. Itu saja — bukan nilai.'));
    return;
  }
  out.append(el('p', { className: 'insp-note' }, `${lastFindings.length} temuan.`));
  for (const f of lastFindings) {
    const card = el('div', { className: 'card' });
    card.dataset.sev = f.severity;
    const ctx = excerpt(doc.body, f);
    const ex = el('span', { className: 'excerpt' }, ctx.before, el('mark', {}, ctx.mid), ctx.after);
    card.append(
      el('span', { className: 'rule-id' }, `${f.ruleId} · ${f.title}`),
      ex,
      el('span', { className: 'stmt' }, f.statement || f.suggest || ''),
    );
    const actions = el('div', { className: 'card-actions' });
    if (f.replacement != null && f.replacement !== (f.raw ?? f.text)) {
      const apply = el('button', { className: 'apply', textContent: `Terapkan: ${f.replacement}` });
      apply.addEventListener('click', () => {
        app.applyEdit(f.start, f.end, f.replacement);
        lastFindings = lastFindings.filter(x => x !== f);
        shift(lastFindings, f.start, f.replacement.length - (f.end - f.start));
        renderFindings(app, out, doc);
      });
      actions.append(apply);
    }
    const ignore = el('button', { textContent: 'Abaikan' });
    ignore.addEventListener('click', () => {
      app.state.language.ignoredFindings.push({ ruleId: f.ruleId, text: f.text, scope: 'project' });
      lastFindings = lastFindings.filter(x => !(x.ruleId === f.ruleId && x.text === f.text));
      app.save();
      renderFindings(app, out, doc);
    });
    actions.append(ignore);
    card.append(actions);
    out.append(card);
  }
}

function shift(findings, from, delta) {
  for (const f of findings) if (f.start > from) { f.start += delta; f.end += delta; }
}

function excerpt(body, f) {
  const a = Math.max(0, f.start - 30), b = Math.min(body.length, f.end + 30);
  return {
    before: (a > 0 ? '…' : '') + body.slice(a, f.start),
    mid: body.slice(f.start, f.end),
    after: body.slice(f.end, b) + (b < body.length ? '…' : ''),
  };
}

function renderEntry(app, out, term) {
  out.textContent = '';
  if (!term) return;
  const entry = kbbiIndex.get(term);
  if (!entry) {
    out.append(el('p', { className: 'insp-note' }, `“${term}” tidak ada dalam KBBI yang dimuat.`));
    const addVocab = el('button', { textContent: 'Tambah ke kosakata proyek' });
    addVocab.addEventListener('click', () => {
      if (!app.state.language.vocabulary.includes(term)) app.state.language.vocabulary.push(term);
      app.save();
      out.append(el('p', { className: 'insp-note' }, 'Ditambahkan.'));
    });
    out.append(addVocab,
      el('p', { className: 'insp-note' }, 'Atau tandai sebagai kata asing dan miringkan (M02), atau cari padanan Indonesianya.'));
    return;
  }
  const card = el('div', { className: 'card' });
  card.append(el('strong', {}, entry.lemma), el('span', {}, ' '),
    ...(entry.wordClass || []).map(w => el('span', { className: 'badge' }, w)),
    ...(entry.labels || []).map(l => el('span', { className: 'badge' }, l)),
    el('span', { className: 'badge' }, 'baku'));
  for (const s of entry.senses || []) {
    card.append(el('div', { className: 'kamus-sense' }, `${s.n}. ${s.definition}` + (s.example ? ` — ${s.example}` : '')));
  }
  for (const sub of entry.subEntries || []) {
    card.append(el('div', { className: 'kamus-sense' },
      el('strong', {}, sub.lemma), ': ' + (sub.senses?.[0]?.definition || '')));
  }
  out.append(card);
}
