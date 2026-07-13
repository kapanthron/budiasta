// Layer 3: optional LLM assistant. Off by default, admin supplies the key.
// Config (provider/base/model/key/enable) lives in the admin account page;
// writers only see a ready-to-use chat box. Never sends the whole manuscript —
// only what the writer types plus, optionally, the active selection.
import { kvGet, kvSet } from './store.js';

const PROVIDERS = [
  { id: 'gemini', label: 'Google AI Studio', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
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

    detail.append(
      el('label', {}, 'Penyedia', prov),
      el('label', {}, 'Base URL', baseUrl),
      el('label', {}, 'Model', model),
      el('label', {}, 'Kunci API', key),
      el('label', { style: 'flex-direction:row;align-items:center' }, storeKey, ' Simpan kunci di peramban ini (agar penulis tak perlu mengetik ulang)'),
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
    try {
      const reply = await callModel(cfg, await resolveKey(), [
        { role: 'system', content: 'Kamu asisten menulis berbahasa Indonesia untuk aplikasi Budiasta. Bantu penulis menyunting, meringkas, memberi saran, atau menjawab pertanyaan. Jawab ringkas dan jelas dalam bahasa Indonesia. Jangan menilai gaya penulis.' },
        ...chat.slice(0, -1),
      ]);
      chat[chat.length - 1].content = reply || '(kosong)';
    } catch (err) {
      chat[chat.length - 1].content = 'Gagal: ' + err.message + '. Periksa kunci, model, dan kuota penyedia.';
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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
