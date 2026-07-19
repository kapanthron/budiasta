// Formatting toolbar over the plain-text page: undo/redo, Markdown marks
// (**bold**, *italic*, ~~strike~~), and per-document alignment. Keeping the text
// plain means PUEBI apply, cuts, search, and word count all keep working.

export function initFormat(app) {
  const page = document.getElementById('page');

  function commit() {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    doc.body = page.value;
    app.refreshStatus?.();
    app.save();
  }

  function wrap(sym) {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    page.focus();
    const a = page.selectionStart, b = page.selectionEnd;
    const sel = page.value.slice(a, b);
    if (a === b) {
      page.setRangeText(sym + sym, a, b, 'end');
      const caret = a + sym.length;
      page.setSelectionRange(caret, caret);
    } else {
      // toggle off if the selection is already wrapped
      const before = page.value.slice(a - sym.length, a);
      const after = page.value.slice(b, b + sym.length);
      if (before === sym && after === sym) {
        page.setRangeText(sel, a - sym.length, b + sym.length, 'end');
      } else {
        page.setRangeText(sym + sel + sym, a, b, 'end');
      }
    }
    commit();
  }

  function undo(redo) {
    page.focus();
    try { document.execCommand(redo ? 'redo' : 'undo'); } catch { /* unsupported */ }
    commit();
  }

  function setAlign(align) {
    const doc = app.state.documents[app.currentDocId];
    if (!doc) return;
    doc.align = align;
    applyAlign();
    app.logActivity?.('rata', align);
    app.save();
  }

  function applyAlign() {
    const doc = app.state.documents[app.currentDocId];
    const align = doc?.align || 'left';
    page.style.textAlign = align;
    for (const b of document.querySelectorAll('.fmt-align'))
      b.classList.toggle('on', b.dataset.align === align);
  }

  // Cuts button (mobile has no Ctrl+Shift+X). Keep the textarea selection on tap.
  const cutsBtn = document.getElementById('fmt-cuts');
  cutsBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  cutsBtn.addEventListener('click', () => {
    const ok = app.cutSelection?.();
    if (ok) app.showInspectorTab?.('cuts');
    else flash(cutsBtn, 'Sorot dulu');
  });
  function flash(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = orig; }, 1200);
  }

  document.getElementById('fmt-undo').addEventListener('click', () => undo(false));
  document.getElementById('fmt-redo').addEventListener('click', () => undo(true));
  document.getElementById('fmt-bold').addEventListener('click', () => wrap('**'));
  document.getElementById('fmt-italic').addEventListener('click', () => wrap('*'));
  document.getElementById('fmt-strike').addEventListener('click', () => wrap('~~'));
  for (const b of document.querySelectorAll('.fmt-align'))
    b.addEventListener('click', () => setAlign(b.dataset.align));

  page.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**'); }
    else if (k === 'i') { e.preventDefault(); wrap('*'); }
  });

  app.syncFormatBar = applyAlign;   // editor calls this on every doc open
  applyAlign();
}
