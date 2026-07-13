// Layer 3: optional LLM assistant. Off by default, admin supplies the key.
// Config (provider/base/model/key/enable) lives in the admin account page;
// writers only see a ready-to-use chat box. Never sends the whole manuscript —
// only what the writer types plus, optionally, the active selection.
import { kvGet, kvSet } from './store.js';

const PROVIDERS = [
  { id: 'gemini', label: 'Google AI Studio', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest' },
  { id: 'groq', label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', base: '', model: '' },
];

let sessionKey = '';   // in memory; persisted to kv only if admin ticks "simpan kunci"
let chat = [];         // {role, content} for the current session

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

export function assistantDefaults(state) {
  state.language.assistant ??= { enabled: false, provider: 'gemini', baseUrl: '', model: '', storeKey: false };
  return state.language.assistant;
}

async function resolveKey() {
  if (sessionKey) return sessionKey;
  return (await kvGet('aiKey')) || '';
}

// --- admin: the configuration form ---
export function renderAssistantConfig(app, container) {
  const cfg = assistantDefaults(app.state);
  container.append(el('h3', {}, 'Asisten AI'));

  const enable = el('input', { type: 'checkbox', checked: cfg.enabled });
  container.append(el('label', { style: 'flex-direction:row;align-items:center' }, enable, ' Aktifkan asisten untuk semua penulis'));
  container.append(el('p', { className: 'insp-note' },
    'Peringatan: teks yang dikirim ke penyedia gratis dapat dipakai melatih model mereka. ' +
    'Budiasta hanya mengirim yang penulis ketik dan (opsional) teks yang disorot — tidak pernah seluruh naskah.'));

  const detail = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  container.append(detail);

  async function renderDetail() {
    detail.textContent = '';
    detail.hidden = !cfg.enabled;
    if (!cfg.enabled) return;

    const prov = el('select', {}, ...PROVIDERS.map(p => el('option', { value: p.id, textContent: p.label, selected: cfg.provider === p.id })));
    const baseUrl = el('input', { placeholder: 'Base URL', value: cfg.baseUrl || PROVIDERS.find(p => p.id === cfg.provider)?.base || '' });
    const model = el('input', { placeholder: 'Model (mis. gemini-2.5-flash)', value: cfg.model || PROVIDERS.find(p => p.id === cfg.provider)?.model || '' });
    const key = el('input', { type: 'password', placeholder: 'Kunci API', value: await resolveKey() });
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

    // Test the connection and load the model list, so the admin picks a valid id
    const testBtn = el('button', { textContent: 'Uji & muat daftar model' });
    const testOut = el('div', { className: 'insp-note' });
    const modelPick = el('select', { hidden: true });
    modelPick.addEventListener('change', () => {
      model.value = modelPick.value; cfg.model = modelPick.value; app.save();
    });
    testBtn.addEventListener('click', async () => {
      testOut.textContent = 'Menghubungi penyedia…';
      modelPick.hidden = true; modelPick.textContent = '';
      const k = key.value.trim() || await resolveKey();
      if (!k || !baseUrl.value.trim()) { testOut.textContent = 'Isi base URL dan kunci API dahulu.'; return; }
      try {
        const ids = await listModels({ baseUrl: baseUrl.value.trim() }, k);
        if (!ids.length) { testOut.textContent = 'Tersambung, tetapi daftar model kosong. Isi nama model manual.'; return; }
        for (const id of ids) modelPick.append(el('option', { value: id, textContent: id, selected: id === cfg.model }));
        modelPick.hidden = false;
        // if the current model isn't in the list, adopt the first as a safe default
        if (!ids.includes(cfg.model)) { model.value = ids[0]; cfg.model = ids[0]; modelPick.value = ids[0]; app.save(); }
        testOut.textContent = `Tersambung. ${ids.length} model tersedia — pilih di bawah.`;
      } catch (e) {
        testOut.textContent = 'Gagal: ' + e.message;
      }
    });

    detail.append(
      el('label', {}, 'Penyedia', prov),
      el('label', {}, 'Base URL', baseUrl),
      el('label', {}, 'Kunci API', key),
      el('label', { style: 'flex-direction:row;align-items:center' }, storeKey, ' Simpan kunci di peramban ini (agar penulis tak perlu mengetik ulang)'),
      testBtn, testOut,
      el('label', {}, 'Model', model),
      modelPick,
      el('p', { className: 'insp-note' },
        'Jika chat memberi error 404, biasanya nama model salah. Klik “Uji & muat daftar model”, lalu pilih salah satu (mis. gemini-2.0-flash atau gemini-2.5-flash).'),
      el('p', { className: 'insp-note' }, 'Setelah aktif, penulis melihat kotak chat siap pakai di tab Bahasa.'),
    );
  }

  enable.addEventListener('change', () => { cfg.enabled = enable.checked; app.save(); renderDetail(); });
  renderDetail();
}

// --- writer: the ready-to-use chat box ---
export async function renderAssistantChat(app, container) {
  const cfg = assistantDefaults(app.state);
  container.append(el('div', { className: 'col-head', style: 'border:none;padding:0;margin-top:8px' }, 'Asisten AI'));

  const key = await resolveKey();
  const ready = cfg.enabled && cfg.baseUrl && cfg.model && key;
  if (!ready) {
    const msg = cfg.enabled
      ? 'Asisten aktif tetapi belum lengkap. Admin melengkapi base URL, model, dan kunci di halaman akun (admin).'
      : (app.isAdmin?.()
          ? 'Asisten mati. Aktifkan dan isi kunci API di panel akun Anda (tombol nama di kanan atas → Asisten AI).'
          : 'Asisten belum diaktifkan oleh admin.');
    container.append(el('p', { className: 'insp-note' }, msg));
    return;
  }

  const msgs = el('div', { className: 'chat-msgs' });
  function renderMsgs() {
    msgs.textContent = '';
    for (const m of chat) msgs.append(el('div', { className: 'chat-msg ' + (m.role === 'user' ? 'user' : 'ai') }, m.content));
    msgs.scrollTop = msgs.scrollHeight;
  }
  renderMsgs();

  const input = el('textarea', { placeholder: 'Tanya atau minta bantuan menyunting… (Enter untuk kirim, Shift+Enter baris baru)' });
  const useSel = el('input', { type: 'checkbox', checked: true });
  const sendBtn = el('button', { className: 'apply', textContent: 'Kirim' });

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    let content = text;
    if (useSel.checked) {
      const sel = app.getSelection?.() || '';
      if (sel.trim()) content = `Teks terpilih:\n"""${sel.slice(0, 4000)}"""\n\nPermintaan: ${text}`;
    }
    chat.push({ role: 'user', content });
    chat.push({ role: 'assistant', content: '…' });
    renderMsgs();
    app.logActivity?.('ai-chat', cfg.provider);
    const payload = [
      { role: 'system', content: 'Kamu asisten menulis berbahasa Indonesia untuk aplikasi Budiasta. Bantu penulis menyunting, meringkas, memberi saran, atau menjawab pertanyaan. Jawab ringkas dan jelas dalam bahasa Indonesia. Jangan menilai gaya penulis.' },
      ...chat.slice(0, -1),
    ];
    const key = await resolveKey();
    try {
      let reply;
      try {
        reply = await callModel(cfg, key, payload);
      } catch (err) {
        // Model retired/unknown? Fetch the live list, switch to a valid one, retry once.
        if (err.status === 404) {
          const ids = await listModels(cfg, key).catch(() => []);
          const better = pickModel(ids, cfg.model);
          if (better && better !== cfg.model) {
            cfg.model = better; app.save();
            chat[chat.length - 1].content = `(mengganti model ke ${better}…)`;
            renderMsgs();
            reply = await callModel(cfg, key, payload);
          } else throw err;
        } else throw err;
      }
      chat[chat.length - 1].content = reply || '(kosong)';
    } catch (err) {
      chat[chat.length - 1].content = 'Gagal: ' + err.message;
    }
    renderMsgs();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  const clear = el('button', { textContent: 'Bersihkan' });
  clear.addEventListener('click', () => { chat = []; renderMsgs(); });

  container.append(
    el('div', { className: 'chat-box' },
      msgs,
      el('div', { className: 'chat-input-row' }, input, sendBtn),
      el('div', { className: 'insp-row', style: 'align-items:center' },
        el('label', { style: 'flex-direction:row;align-items:center;flex:1' }, useSel, ' Sertakan teks yang disorot'),
        clear),
    ),
  );
}

async function callModel(cfg, key, messages) {
  const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: cfg.model, temperature: 0.3, messages }),
  });
  if (!res.ok) { const e = new Error(await errText(res, cfg.model)); e.status = res.status; throw e; }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Prefer a general flash chat model; avoid non-chat variants (embedding, tts,
// image, vision-only, thinking). Fall back to the first id if nothing matches.
function pickModel(ids, current) {
  if (!ids?.length) return null;
  const bad = /embedding|aqa|image|imagen|vision|tts|audio|veo|learnlm|gemma/i;
  const usable = ids.filter(id => id !== current && !bad.test(id));
  const prefer = [
    id => /gemini-flash-latest/i.test(id),
    id => /gemini-[\d.]+-flash$/i.test(id),
    id => /flash/i.test(id) && !/lite|thinking/i.test(id),
    id => /flash/i.test(id),
    () => true,
  ];
  for (const test of prefer) { const hit = usable.find(test); if (hit) return hit; }
  return usable[0] || null;
}

// GET the provider's model list (OpenAI-compatible /models). Ids may carry a
// "models/" prefix on Gemini — strip it so chat/completions accepts them.
async function listModels(cfg, key) {
  const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/models', {
    headers: { 'Authorization': 'Bearer ' + key },
  });
  if (!res.ok) throw new Error(await errText(res));
  const data = await res.json();
  const raw = data.data || data.models || [];
  return raw.map(m => (m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
}

// Turn a failed response into a readable message: pull the provider's own
// error text (Gemini returns JSON like {error:{message,status}}) instead of "404 .".
async function errText(res, model) {
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  let detail = body;
  try { detail = JSON.parse(body)?.error?.message || body; } catch { /* not json */ }
  detail = (detail || '').slice(0, 240);
  if (res.status === 404) {
    return `404 — model tidak ditemukan${model ? ` ("${model}")` : ''}. ` +
      `Buka panel admin → “Uji & muat daftar model” lalu pilih model yang valid. ${detail}`.trim();
  }
  if (res.status === 401 || res.status === 403) return `${res.status} — kunci API ditolak. ${detail}`.trim();
  if (res.status === 429) return `429 — kuota penyedia habis. ${detail}`.trim();
  return `${res.status} ${res.statusText || ''} ${detail}`.trim();
}
