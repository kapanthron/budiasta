// Layer 3: optional LLM assistant. Off by default, writer's own key, never the manuscript —
// only the selection (or current paragraph), capped. All providers speak the OpenAI
// chat-completions format; Gemini via its OpenAI-compatible endpoint.
import { kvGet, kvSet } from './store.js';

const PROVIDERS = [
  { id: 'groq', label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'gemini', label: 'Google AI Studio', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { id: 'openrouter', label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', base: '', model: '' },
];

let sessionKey = ''; // in memory unless the writer opts to store it

export function assistantDefaults(state) {
  state.language.assistant ??= { enabled: false, provider: 'groq', baseUrl: '', model: '', storeKey: false };
  return state.language.assistant;
}

export function renderAssistant(app, body) {
  const cfg = assistantDefaults(app.state);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  };

  body.append(el('div', { className: 'col-head', style: 'border:none;padding:0;margin-top:8px' }, 'Asisten (AI)'));

  const enable = el('input', { type: 'checkbox', checked: cfg.enabled });
  body.append(el('label', { style: 'flex-direction:row;align-items:center' }, enable, ' Aktifkan asisten (kunci API Anda sendiri)'));
  body.append(el('p', { className: 'insp-note' },
    'Peringatan: teks yang dikirim ke penyedia gratis dapat dipakai melatih model mereka. ' +
    'Budiasta hanya mengirim seleksi atau paragraf aktif — tidak pernah seluruh naskah.'));

  const detail = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  body.append(detail);

  async function renderDetail() {
    detail.textContent = '';
    detail.hidden = !cfg.enabled;
    if (!cfg.enabled) return;

    const prov = el('select', {}, ...PROVIDERS.map(p => el('option', { value: p.id, textContent: p.label, selected: cfg.provider === p.id })));
    const baseUrl = el('input', { placeholder: 'Base URL', value: cfg.baseUrl || PROVIDERS.find(p => p.id === cfg.provider)?.base || '' });
    const model = el('input', { placeholder: 'Model (mis. gemini-2.5-flash)', value: cfg.model || PROVIDERS.find(p => p.id === cfg.provider)?.model || '' });
    const key = el('input', { type: 'password', placeholder: 'Kunci API', value: sessionKey || (cfg.storeKey ? (await kvGet('aiKey')) || '' : '') });
    const storeKey = el('input', { type: 'checkbox', checked: cfg.storeKey });

    prov.addEventListener('change', () => {
      cfg.provider = prov.value;
      const p = PROVIDERS.find(x => x.id === prov.value);
      baseUrl.value = p.base; model.value = p.model;
      cfg.baseUrl = p.base; cfg.model = p.model;
      app.save();
    });
    baseUrl.addEventListener('input', () => { cfg.baseUrl = baseUrl.value.trim(); app.save(); });
    model.addEventListener('input', () => { cfg.model = model.value.trim(); app.save(); });
    key.addEventListener('input', async () => {
      sessionKey = key.value.trim();
      if (cfg.storeKey) await kvSet('aiKey', sessionKey);
    });
    storeKey.addEventListener('change', async () => {
      cfg.storeKey = storeKey.checked;
      await kvSet('aiKey', storeKey.checked ? (sessionKey || key.value.trim()) : null);
      app.save();
    });

    const run = el('button', { textContent: 'Periksa AI (seleksi / paragraf)' });
    const out = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    run.addEventListener('click', () => checkWithAi(app, { ...cfg, key: key.value.trim() }, out, el));

    detail.append(
      el('label', {}, 'Penyedia', prov),
      el('label', {}, 'Base URL', baseUrl),
      el('label', {}, 'Model', model),
      el('label', {}, 'Kunci API', key),
      el('label', { style: 'flex-direction:row;align-items:center' }, storeKey, ' Simpan kunci di peramban ini'),
      run, out,
    );
  }

  enable.addEventListener('change', () => { cfg.enabled = enable.checked; app.save(); renderDetail(); });
  renderDetail();
}

function pickContext(app) {
  const sel = app.getSelection();
  if (sel.trim()) return sel.slice(0, 4000);
  const page = document.getElementById('page');
  const body = page.value, pos = page.selectionStart;
  const a = body.lastIndexOf('\n\n', pos), b = body.indexOf('\n\n', pos);
  return body.slice(a < 0 ? 0 : a + 2, b < 0 ? body.length : b).slice(0, 4000);
}

async function checkWithAi(app, cfg, out, el) {
  out.textContent = '';
  const text = pickContext(app);
  if (!text.trim()) { out.append(el('p', { className: 'insp-note' }, 'Sorot teks atau letakkan kursor pada sebuah paragraf.')); return; }
  if (!cfg.key || !cfg.baseUrl || !cfg.model) { out.append(el('p', { className: 'insp-note' }, 'Isi base URL, model, dan kunci API dahulu.')); return; }
  out.append(el('p', { className: 'insp-note' }, `Mengirim ±${Math.ceil(text.length / 4)} token…`));
  try {
    const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Kamu editor bahasa Indonesia. Balas HANYA JSON: {"findings":[{"kutipan":"...","masalah":"...","saran":"..."}]}. Maksimal 8 temuan. Periksa ejaan PUEBI, kata baku, dan kejelasan kalimat. Jangan menilai gaya penulis.' },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const findings = JSON.parse(json).findings || [];
    out.textContent = '';
    if (!findings.length) { out.append(el('p', { className: 'insp-note' }, 'Model tidak menemukan apa-apa.')); return; }
    for (const f of findings) {
      out.append(el('div', { className: 'card' },
        el('span', { className: 'rule-id' }, 'AI · saran'),
        el('span', { className: 'excerpt' }, f.kutipan || ''),
        el('span', { className: 'stmt' }, (f.masalah || '') + (f.saran ? ' → ' + f.saran : '')),
      ));
    }
    out.append(el('p', { className: 'insp-note' }, 'Saran, bukan koreksi. Terapkan sendiri jika setuju.'));
  } catch (err) {
    out.textContent = '';
    out.append(el('p', { className: 'insp-note' }, 'Gagal: ' + err.message + '. Periksa kunci, model, dan kuota penyedia.'));
  }
}
