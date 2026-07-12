// Manuskrip bootstrap: load state, wire modules, own the save path.
import { loadProject, autosave, flush, exportJson, importJson } from './store.js';
import { initBinder } from './binder.js';
import { initEditor } from './editor.js';
import { initInspector } from './inspector.js';
import { initTheme } from './theme.js';
import { initPalette } from './palette.js';

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
  },
  exportProject() { flush(this.state).then(() => exportJson(this.state)); },
};

async function boot() {
  app.state = await loadProject();
  app.currentDocId = app.state.settings.lastDocId && app.state.documents[app.state.settings.lastDocId]
    ? app.state.settings.lastDocId : Object.keys(app.state.documents)[0] || null;

  initTheme(app);
  initEditor(app);
  initBinder(app);
  initInspector(app);
  initPalette(app);

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
