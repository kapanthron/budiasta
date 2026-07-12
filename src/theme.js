// Theme + typography: token-driven, persisted in settings.
const THEMES = [
  { id: 'lontar', label: 'Lontar (terang)' },
  { id: 'senja', label: 'Senja (gelap)' },
  { id: 'pantai', label: 'Pantai (terang)' },
  { id: 'malam-hujan', label: 'Malam Hujan (gelap)' },
];
const FAMILIES = {
  georgia: 'Georgia, "Times New Roman", serif',
  palatino: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"SF Mono", Consolas, "Liberation Mono", monospace',
};

export function initTheme(app) {
  const root = document.documentElement;
  const sel = document.getElementById('theme-select');
  for (const t of THEMES) sel.append(new Option(t.label, t.id));

  function apply() {
    const s = app.state.settings;
    root.dataset.theme = s.themeId === 'lontar' ? '' : s.themeId;
    const ty = s.typography;
    root.style.setProperty('--font-page', FAMILIES[ty.family] || FAMILIES.georgia);
    root.style.setProperty('--page-size', ty.size + 'px');
    root.style.setProperty('--page-leading', String(ty.leading));
    root.style.setProperty('--page-measure', ty.measure + 'ch');
    sel.value = s.themeId;
  }

  sel.addEventListener('change', () => { app.state.settings.themeId = sel.value; apply(); app.save(); });

  // typography dialog
  const dlg = document.getElementById('typo-dialog');
  const family = document.getElementById('typo-family');
  const controls = [
    ['typo-size', 'size', 'typo-size-v', (v) => v + 'px'],
    ['typo-leading', 'leading', 'typo-leading-v', (v) => v],
    ['typo-measure', 'measure', 'typo-measure-v', (v) => v + 'ch'],
  ];
  document.getElementById('btn-typography').addEventListener('click', () => {
    const ty = app.state.settings.typography;
    family.value = ty.family;
    for (const [inputId, key, labelId, fmt] of controls) {
      const input = document.getElementById(inputId);
      input.value = ty[key];
      document.getElementById(labelId).textContent = fmt(ty[key]);
    }
    dlg.showModal();
  });
  family.addEventListener('change', () => { app.state.settings.typography.family = family.value; apply(); app.save(); });
  for (const [inputId, key, labelId, fmt] of controls) {
    document.getElementById(inputId).addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      app.state.settings.typography[key] = v;
      document.getElementById(labelId).textContent = fmt(v);
      apply(); app.save();
    });
  }
  document.getElementById('typo-close').addEventListener('click', () => dlg.close());

  app.applyTheme = apply;
  app.setTheme = (id) => { app.state.settings.themeId = id; apply(); app.save(); };
  apply();
}

export { THEMES };
