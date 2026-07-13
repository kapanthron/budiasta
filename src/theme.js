// Theme + typography + custom fonts + dark/light toggle. Token-driven, persisted.
import { kvGet, kvSet, uid } from './store.js';

const THEMES = [
  { id: 'lontar', label: 'Lontar (terang)', dark: false },
  { id: 'senja', label: 'Senja (gelap)', dark: true },
  { id: 'pantai', label: 'Pantai (terang)', dark: false },
  { id: 'malam-hujan', label: 'Malam Hujan (gelap)', dark: true },
];
const isDark = (id) => THEMES.find(t => t.id === id)?.dark ?? false;

const BUILTIN_FAMILIES = {
  georgia: 'Georgia, "Times New Roman", serif',
  palatino: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"SF Mono", Consolas, "Liberation Mono", monospace',
};
let customFonts = []; // [{id, name}] — bytes live in IndexedDB under kv:font:<id>

export async function initTheme(app) {
  const root = document.documentElement;
  const sel = document.getElementById('theme-select');
  for (const t of THEMES) sel.append(new Option(t.label, t.id));

  const s = app.state.settings;
  s.lastLightTheme ??= 'lontar';
  s.lastDarkTheme ??= 'senja';

  function familyCss(key) {
    const custom = customFonts.find(f => 'custom:' + f.id === key);
    if (custom) return `"${custom.name}", Georgia, serif`;
    return BUILTIN_FAMILIES[key] || BUILTIN_FAMILIES.georgia;
  }

  function apply() {
    root.dataset.theme = s.themeId === 'lontar' ? '' : s.themeId;
    const ty = s.typography;
    root.style.setProperty('--font-page', familyCss(ty.family));
    root.style.setProperty('--page-size', ty.size + 'px');
    root.style.setProperty('--page-leading', String(ty.leading));
    root.style.setProperty('--page-measure', ty.measure + 'ch');
    sel.value = s.themeId;
    document.getElementById('btn-dark').textContent = isDark(s.themeId) ? '☀' : '◐';
  }

  sel.addEventListener('change', () => { setTheme(sel.value); });

  function setTheme(id) {
    s.themeId = id;
    if (isDark(id)) s.lastDarkTheme = id; else s.lastLightTheme = id;
    apply(); app.save();
  }
  document.getElementById('btn-dark').addEventListener('click', () => {
    setTheme(isDark(s.themeId) ? s.lastLightTheme : s.lastDarkTheme);
  });

  // --- custom fonts (FontFace API, bytes persisted in IndexedDB) ---
  const fontList = document.getElementById('custom-fonts');
  const familySel = document.getElementById('typo-family');

  async function loadStoredFonts() {
    customFonts = (await kvGet('fonts')) || [];
    for (const f of customFonts) {
      const bytes = await kvGet('font:' + f.id);
      if (!bytes) continue;
      try {
        const face = new FontFace(f.name, bytes);
        await face.load();
        document.fonts.add(face);
      } catch { /* corrupt font file — skip */ }
    }
    renderFontOptions();
  }

  function renderFontOptions() {
    // rebuild the <select>: builtins + customs
    familySel.textContent = '';
    for (const [k, label] of [['georgia', 'Georgia (serif)'], ['palatino', 'Palatino (serif)'], ['system', 'Sistem (sans)'], ['mono', 'Mono']])
      familySel.append(new Option(label, k));
    for (const f of customFonts) familySel.append(new Option(f.name + ' (font sendiri)', 'custom:' + f.id));
    familySel.value = s.typography.family;
    if (familySel.selectedIndex < 0) familySel.value = 'georgia';

    fontList.textContent = '';
    for (const f of customFonts) {
      const row = document.createElement('div');
      row.className = 'font-row';
      const name = document.createElement('span');
      name.textContent = f.name;
      const del = document.createElement('button');
      del.textContent = 'Hapus';
      del.addEventListener('click', async () => {
        customFonts = customFonts.filter(x => x.id !== f.id);
        await kvSet('fonts', customFonts);
        await kvSet('font:' + f.id, null);
        if (s.typography.family === 'custom:' + f.id) { s.typography.family = 'georgia'; apply(); app.save(); }
        renderFontOptions();
      });
      row.append(name, del);
      fontList.append(row);
    }
  }

  const fontInput = document.getElementById('file-font');
  document.getElementById('btn-add-font').addEventListener('click', () => fontInput.click());
  fontInput.addEventListener('change', async () => {
    const file = fontInput.files[0];
    fontInput.value = '';
    if (!file) return;
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^\w \-]/g, ' ').trim() || 'Font';
    const bytes = await file.arrayBuffer();
    try {
      const face = new FontFace(name, bytes);
      await face.load();
      document.fonts.add(face);
    } catch { alert('Berkas ini tidak bisa dibaca sebagai font.'); return; }
    const entry = { id: uid(), name };
    customFonts.push(entry);
    await kvSet('fonts', customFonts);
    await kvSet('font:' + entry.id, bytes);
    s.typography.family = 'custom:' + entry.id;
    renderFontOptions(); apply(); app.save();
  });

  // typography dialog
  const dlg = document.getElementById('typo-dialog');
  const controls = [
    ['typo-size', 'size', 'typo-size-v', (v) => v + 'px'],
    ['typo-leading', 'leading', 'typo-leading-v', (v) => v],
    ['typo-measure', 'measure', 'typo-measure-v', (v) => v + 'ch'],
  ];
  document.getElementById('btn-typography').addEventListener('click', () => {
    const ty = s.typography;
    familySel.value = ty.family;
    for (const [inputId, key, labelId, fmt] of controls) {
      document.getElementById(inputId).value = ty[key];
      document.getElementById(labelId).textContent = fmt(ty[key]);
    }
    dlg.showModal();
  });
  familySel.addEventListener('change', () => { s.typography.family = familySel.value; apply(); app.save(); });
  for (const [inputId, key, labelId, fmt] of controls) {
    document.getElementById(inputId).addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      s.typography[key] = v;
      document.getElementById(labelId).textContent = fmt(v);
      apply(); app.save();
    });
  }
  document.getElementById('typo-close').addEventListener('click', () => dlg.close());

  app.applyTheme = apply;
  app.setTheme = setTheme;
  await loadStoredFonts();
  apply();
}

export { THEMES };
