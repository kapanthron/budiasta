// Manuskrip bootstrap: load state, wire modules, own the save path.
import { loadProject, autosave, flush, exportJson, importJson } from './store.js';
import { initBinder } from './binder.js';
import { initEditor } from './editor.js';
import { initInspector } from './inspector.js';
import { initTheme } from './theme.js';
import { initPalette } from './palette.js';
import { initExportDoc } from './export-doc.js';
import { initAbout } from './about.js';
import { assistantDefaults } from './assistant.js';

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
  exportProject() { flush(this.state).then(() => exportJson(this.state)); },
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
  app.state = await loadProject();
  app.currentDocId = app.state.settings.lastDocId && app.state.documents[app.state.settings.lastDocId]
    ? app.state.settings.lastDocId : Object.keys(app.state.documents)[0] || null;
  assistantDefaults(app.state);

  await initTheme(app);
  initEditor(app);
  initBinder(app);
  initInspector(app);
  initPalette(app);
  initExportDoc(app);
  initAbout();

  // mobile drawers
  document.getElementById('btn-toggle-binder').addEventListener('click', () => toggleDrawer('binder'));
  document.getElementById('btn-toggle-inspector').addEventListener('click', () => toggleDrawer('inspector'));
  document.getElementById('drawer-scrim').addEventListener('click', closeDrawers);
  document.querySelectorAll('.close-drawer').forEach(b => b.addEventListener('click', closeDrawers));

  // manual save: button + Ctrl/Cmd+S (autosave still runs on every pause)
  const saveNow = async () => {
    await flush(app.state);
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
