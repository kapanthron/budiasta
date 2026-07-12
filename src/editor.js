// Editor: textarea page, autosave, word counts, cuts shortcut, status bar.
import { uid } from './store.js';

export const countWords = (t) => (t.match(/[\wÀ-ÿ'-]+/g) || []).length;

export function initEditor(app) {
  const page = document.getElementById('page');
  const stWords = document.getElementById('st-words');
  const stSession = document.getElementById('st-session');
  const stCeiling = document.getElementById('st-ceiling');
  const stRead = document.getElementById('st-read');
  let sessionBase = null;

  function render() {
    const doc = app.state.documents[app.currentDocId];
    page.value = doc ? doc.body : '';
    page.disabled = !doc;
    sessionBase = doc ? countWords(doc.body) : 0;
    status();
  }

  function status() {
    const doc = app.state.documents[app.currentDocId];
    const words = doc ? countWords(doc.body) : 0;
    stWords.textContent = `${words} kata`;
    const delta = words - (sessionBase ?? words);
    stSession.textContent = `sesi ${delta >= 0 ? '+' : ''}${delta}`;
    stRead.textContent = `${Math.max(1, Math.round(words / 200))} mnt baca`;
    const ceiling = doc?.ceilingWords || 0;
    if (ceiling > 0) {
      stCeiling.hidden = false;
      const over = words - ceiling;
      stCeiling.dataset.over = over > 0 ? '1' : '0';
      stCeiling.textContent = over > 0 ? `${over} kata di atas pagu ${ceiling}` : `pagu ${ceiling}`;
    } else stCeiling.hidden = true;
  }

  page.addEventListener('input', () => {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    doc.body = page.value;
    status();
    app.save();
  });

  // Ctrl/Cmd+Shift+X: send selection to the cuts drawer. Nothing is ever destroyed.
  page.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      app.cutSelection();
    }
  });

  app.cutSelection = () => {
    const doc = app.state.documents[app.currentDocId];
    const { selectionStart: a, selectionEnd: b } = page;
    if (!doc || a === b) return;
    const text = page.value.slice(a, b);
    app.state.cuts.unshift({ id: uid(), fromDocumentId: app.currentDocId, text, cutAt: new Date().toISOString() });
    page.setRangeText('', a, b, 'start');
    doc.body = page.value;
    status();
    app.save();
    app.renderInspector?.();
  };

  app.applyEdit = (start, end, replacement) => {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    page.setRangeText(replacement, start, end, 'end');
    doc.body = page.value;
    status();
    app.save();
  };

  app.getSelection = () => page.value.slice(page.selectionStart, page.selectionEnd);
  app.renderEditor = render;
  app.refreshStatus = status;
  render();
}
