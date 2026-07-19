// Manuskrip bootstrap: load state, wire modules, own the save path.
import { loadProject, autosave, flush, exportJson, importJson, kvGet, setProjectKey, projectKeyForUser } from './store.js';
import { initBinder } from './binder.js';
import { initEditor } from './editor.js';
import { initInspector } from './inspector.js';
import { initTheme } from './theme.js';
import { initPalette } from './palette.js';
import { initExportDoc } from './export-doc.js';
import { initAbout } from './about.js';
import { assistantDefaults } from './assistant.js';
import { initAuth } from './auth.js';
import { initSync } from './sync.js';
import { initFormat } from './format.js';
import { initSearch } from './search.js';
import { blankDoc } from './store.js';

const app = {
  state: null,
  currentDocId: null,
  save() {
    autosave(this.state, (s) => {
      const st = document.getElementById('st-saved');
      st.textContent = s === 'dirty' ? 'menyimpan…' : 'tersimpan';
      st.classList.toggle('dirty', s === 'dirty');
    });
  },
  openDoc(id) {
    this.currentDocId = id;
    this.state.settings.lastDocId = id;
    this.renderEditor?.();
    this.renderBinder?.();
    this.renderInspector?.();
    this.save();
    closeDrawers();
  },
  exportProject() { flush(this.state).then(() => { exportJson(this.state); this.logActivity?.('ekspor-json'); }); },
};

// mobile slide-over drawers
function closeDrawers() {
  document.getElementById('binder').classList.remove('open');
  document.getElementById('inspector').classList.remove('open');
  document.getElementById('drawer-scrim').hidden = true;
}
function toggleDrawer(id) {
  const el = document.getElementById(id);
  const open = !el.classList.contains('open');
  closeDrawers();
  if (open) {
    el.classList.add('open');
    document.getElementById('drawer-scrim').hidden = false;
  }
}

async function boot() {
  // scope the workspace to whoever is signed in on this device before loading
  const session = await kvGet('session');
  setProjectKey(projectKeyForUser(session?.sub));

  app.state = await loadProject();
  app.currentDocId = app.state.settings.lastDocId && app.state.documents[app.state.settings.lastDocId]
    ? app.state.settings.lastDocId : Object.keys(app.state.documents)[0] || null;
  assistantDefaults(app.state);
  await initAuth(app);
  await initSync(app);

  await initTheme(app);
  initEditor(app);
  initFormat(app);
  initBinder(app);
  initInspector(app);
  initPalette(app);
  initSearch(app);
  initExportDoc(app);
  initAbout(app);

  // distraction-free / focus mode
  const toggleFocus = (on) => document.body.classList.toggle('focus', on ?? !document.body.classList.contains('focus'));
  document.getElementById('btn-focus').addEventListener('click', () => toggleFocus());
  document.getElementById('focus-exit').addEventListener('click', () => toggleFocus(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('focus')) toggleFocus(false);
  });

  // screenplay template: new document, Courier font, Fountain-style scaffold
  const SCREENPLAY = [
    'INT. LOKASI - MALAM', '',
    'Deskripsi aksi. Tuliskan apa yang terlihat di layar, ringkas dan sekarang.', '',
    '                    NAMA TOKOH',
    '          (nada bicara)',
    '     Dialog tokoh ditulis di sini, di bawah namanya.', '',
    '                    TOKOH LAIN',
    '     Balasan dialog.', '',
    'CUT TO:', '',
    'EXT. LOKASI LAIN - SIANG', '',
    'Aksi berikutnya.',
  ].join('\n');
  document.getElementById('btn-new-screenplay').addEventListener('click', () => {
    const node = app.addNode('document');
    node.title = 'Skenario';
    app.state.documents[node.id] = Object.assign(blankDoc(), { body: SCREENPLAY });
    app.state.project.mode = 'screenplay';
    document.getElementById('mode-select').value = 'screenplay';
    app.setFont?.('courier');
    app.openDoc(node.id);
    app.renderBinder();
    app.logActivity?.('templat-skenario');
  });

  // mobile drawers
  document.getElementById('btn-toggle-binder').addEventListener('click', () => toggleDrawer('binder'));
  document.getElementById('btn-toggle-inspector').addEventListener('click', () => toggleDrawer('inspector'));
  document.getElementById('drawer-scrim').addEventListener('click', closeDrawers);
  document.querySelectorAll('.close-drawer').forEach(b => b.addEventListener('click', closeDrawers));

  // manual save: button + Ctrl/Cmd+S (autosave still runs on every pause)
  const saveNow = async () => {
    await flush(app.state);
    app.logActivity?.('simpan', `${app.state.project.title}`);
    app.syncNow?.();
    const st = document.getElementById('st-saved');
    st.textContent = 'tersimpan'; st.classList.remove('dirty');
  };
  document.getElementById('btn-save').addEventListener('click', saveNow);
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
  });

  // toolbar: project title + mode
  const title = document.getElementById('project-title');
  title.value = app.state.project.title;
  title.addEventListener('input', () => { app.state.project.title = title.value; app.save(); });
  const mode = document.getElementById('mode-select');
  mode.value = app.state.project.mode;
  mode.addEventListener('change', () => { app.state.project.mode = mode.value; app.save(); });

  // export / import
  document.getElementById('btn-export').addEventListener('click', () => app.exportProject());
  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('Impor akan menggantikan proyek yang sedang terbuka. Ekspor dulu jika ragu. Lanjutkan?')) return;
    try {
      app.state = await importJson(file);
      await flush(app.state);
      location.reload();
    } catch (err) { alert('Gagal impor: ' + err.message); }
  });

  // never lose a word: flush on tab close
  window.addEventListener('beforeunload', () => { flush(app.state); });
  window.addEventListener('visibilitychange', () => { if (document.hidden) flush(app.state); });
}

boot();
