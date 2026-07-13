// Theme + typography + custom fonts + custom colors + ligatures + dark/light toggle.
import { kvGet, kvSet, uid } from './store.js';

const THEMES = [
  { id: 'lontar', label: 'Lontar (terang)', dark: false },
  { id: 'kertas', label: 'Kertas (terang)', dark: false },
  { id: 'sepia', label: 'Sepia (terang)', dark: false },
  { id: 'gading', label: 'Gading (terang)', dark: false },
  { id: 'pantai', label: 'Pantai (terang)', dark: false },
  { id: 'mawar', label: 'Mawar (terang)', dark: false },
  { id: 'kabut', label: 'Kabut (terang)', dark: false },
  { id: 'surya', label: 'Surya (terang)', dark: false },
  { id: 'senja', label: 'Senja (gelap)', dark: true },
  { id: 'malam-hujan', label: 'Malam Hujan (gelap)', dark: true },
  { id: 'hutan', label: 'Hutan (gelap)', dark: true },
  { id: 'kopi', label: 'Kopi (gelap)', dark: true },
  { id: 'laut', label: 'Laut (gelap)', dark: true },
  { id: 'nokturno', label: 'Nokturno (gelap)', dark: true },
  { id: 'custom', label: 'Tema khusus…', dark: false },
];
const isDark = (id) => THEMES.find(t => t.id === id)?.dark ?? false;

// Built-in writer families as system-font stacks (no web fonts: CSP + offline).
// They render when the OS has the face, otherwise fall back gracefully.
const BUILTIN_FONTS = [
  ['georgia', 'Georgia (serif)', 'Georgia, "Times New Roman", serif'],
  ['times', 'Times New Roman', '"Times New Roman", Times, serif'],
  ['garamond', 'Garamond', 'Garamond, "EB Garamond", "Apple Garamond", "Cormorant Garamond", serif'],
  ['baskerville', 'Baskerville', 'Baskerville, "Libre Baskerville", "Baskerville Old Face", "Goudy Old Style", serif'],
  ['palatino', 'Palatino', '"Palatino Linotype", Palatino, "Book Antiqua", serif'],
  ['bookantiqua', 'Book Antiqua', '"Book Antiqua", "Palatino Linotype", Palatino, serif'],
  ['cambria', 'Cambria', 'Cambria, "PT Serif", Georgia, serif'],
  ['constantia', 'Constantia', 'Constantia, "Nimbus Roman", Georgia, serif'],
  ['charter', 'Charter', 'Charter, "Bitstream Charter", "Georgia", serif'],
  ['iowan', 'Iowan Old Style', '"Iowan Old Style", "Palatino Linotype", Palatino, serif'],
  ['merriweather', 'Merriweather', 'Merriweather, "PT Serif", Georgia, serif'],
  ['system', 'Sistem (sans)', 'system-ui, -apple-system, "Segoe UI", sans-serif'],
  ['helvetica', 'Helvetica / Arial', 'Helvetica, Arial, "Helvetica Neue", sans-serif'],
  ['verdana', 'Verdana', 'Verdana, Geneva, sans-serif'],
  ['courier', 'Courier (skenario)', '"Courier Prime", "Courier New", Courier, monospace'],
  ['mono', 'Mono', '"SF Mono", Consolas, "Liberation Mono", monospace'],
];
const CUSTOM_KEYS = ['surface', 'surface2', 'ink', 'accent', 'page', 'line'];

let customFonts = [];

export async function initTheme(app) {
  const root = document.documentElement;
  const sel = document.getElementById('theme-select');
  for (const t of THEMES) sel.append(new Option(t.label, t.id));

  const s = app.state.settings;
  s.lastLightTheme ??= 'lontar';
  s.lastDarkTheme ??= 'senja';
  s.typography.ligatures ??= false;
  s.customTheme ??= { surface: '#f4efe3', surface2: '#ece5d3', ink: '#26241e', accent: '#31456e', page: '#faf7ee', line: '#d4c9ac' };

  function familyCss(key) {
    const custom = customFonts.find(f => 'custom:' + f.id === key);
    if (custom) return `"${custom.name}", Georgia, serif`;
    return (BUILTIN_FONTS.find(([k]) => k === key) || BUILTIN_FONTS[0])[2];
  }

  function applyCustomColors(on) {
    const c = s.customTheme;
    const map = { surface: '--surface', surface2: '--surface-2', ink: '--ink', accent: '--accent', page: '--page', line: '--line' };
    for (const k of CUSTOM_KEYS) {
      if (on) root.style.setProperty(map[k], c[k]);
      else root.style.removeProperty(map[k]);
    }
    if (on) {
      // derive a couple of dependents so the UI stays legible
      root.style.setProperty('--surface-3', c.surface2);
      root.style.setProperty('--sel', c.accent + '33');
      root.style.setProperty('--focus-ring', c.accent);
      root.style.setProperty('--accent-ink', c.page);
      root.style.setProperty('--ink-soft', c.ink + 'aa');
    } else {
      ['--surface-3', '--sel', '--focus-ring', '--accent-ink', '--ink-soft'].forEach(v => root.style.removeProperty(v));
    }
  }

  function apply() {
    const custom = s.themeId === 'custom';
    root.dataset.theme = (s.themeId === 'lontar' || custom) ? '' : s.themeId;
    applyCustomColors(custom);
    const ty = s.typography;
    root.style.setProperty('--font-page', familyCss(ty.family));
    root.style.setProperty('--page-size', ty.size + 'px');
    root.style.setProperty('--page-leading', String(ty.leading));
    root.style.setProperty('--page-measure', ty.measure + 'ch');
    root.style.setProperty('--page-ligatures', ty.ligatures ? 'common-ligatures contextual' : 'none');
    sel.value = s.themeId;
    document.getElementById('btn-dark').textContent = isDark(s.themeId) ? '☀' : '◐';
  }

  const themeDlg = document.getElementById('theme-dialog');
  sel.addEventListener('change', () => {
    setTheme(sel.value);
    if (sel.value === 'custom') openCustomTheme();
  });

  function setTheme(id) {
    s.themeId = id;
    if (id !== 'custom') { if (isDark(id)) s.lastDarkTheme = id; else s.lastLightTheme = id; }
    apply(); app.save();
  }
  document.getElementById('btn-dark').addEventListener('click', () => {
    setTheme(isDark(s.themeId) ? s.lastLightTheme : s.lastDarkTheme);
  });

  // custom color pickers
  function openCustomTheme() {
    for (const k of CUSTOM_KEYS) {
      const input = document.getElementById('ct-' + k);
      input.value = s.customTheme[k];
      input.oninput = () => { s.customTheme[k] = input.value; s.themeId = 'custom'; apply(); app.save(); };
    }
    themeDlg.showModal();
  }
  document.getElementById('ct-close').addEventListener('click', () => themeDlg.close());

  // --- custom fonts ---
  const fontList = document.getElementById('custom-fonts');
  const familySel = document.getElementById('typo-family');

  async function loadStoredFonts() {
    customFonts = (await kvGet('fonts')) || [];
    for (const f of customFonts) {
      const bytes = await kvGet('font:' + f.id);
      if (!bytes) continue;
      try { const face = new FontFace(f.name, bytes); await face.load(); document.fonts.add(face); }
      catch { /* skip corrupt */ }
    }
    renderFontOptions();
  }

  function renderFontOptions() {
    familySel.textContent = '';
    for (const [k, label] of BUILTIN_FONTS) familySel.append(new Option(label, k));
    for (const f of customFonts) familySel.append(new Option(f.name + ' (font sendiri)', 'custom:' + f.id));
    familySel.value = s.typography.family;
    if (familySel.selectedIndex < 0) familySel.value = 'georgia';

    fontList.textContent = '';
    for (const f of customFonts) {
      const row = document.createElement('div');
      row.className = 'font-row';
      const name = document.createElement('span'); name.textContent = f.name;
      const del = document.createElement('button'); del.textContent = 'Hapus';
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
    try { const face = new FontFace(name, bytes); await face.load(); document.fonts.add(face); }
    catch { alert('Berkas ini tidak bisa dibaca sebagai font.'); return; }
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
  const ligatures = document.getElementById('typo-ligatures');
  document.getElementById('btn-typography').addEventListener('click', () => {
    const ty = s.typography;
    familySel.value = ty.family;
    ligatures.checked = !!ty.ligatures;
    for (const [inputId, key, labelId, fmt] of controls) {
      document.getElementById(inputId).value = ty[key];
      document.getElementById(labelId).textContent = fmt(ty[key]);
    }
    dlg.showModal();
  });
  familySel.addEventListener('change', () => { s.typography.family = familySel.value; apply(); app.save(); });
  ligatures.addEventListener('change', () => { s.typography.ligatures = ligatures.checked; apply(); app.save(); });
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
  app.setFont = (key) => { s.typography.family = key; renderFontOptions(); apply(); app.save(); };
  await loadStoredFonts();
  apply();
}

export { THEMES };
