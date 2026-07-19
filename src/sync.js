// Server sync: save works to the owner's free Apps Script backend, mirror the
// activity log there, and give the server-admin (id + password, checked
// server-side) a live view of users and activities.
import { kvGet, kvSet, uid, flush, putProjectAt } from './store.js';
import { setRemoteLogger } from './activity.js';

let serverUrl = '';
let dirty = false;
let syncing = false;
let deviceId = '';

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

async function call(action, payload = {}) {
  // text/plain keeps the request "simple" so Apps Script needs no CORS preflight
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function ident(app) {
  return app.session
    ? { email: app.session.email, sub: app.session.sub }
    : { email: 'tamu', sub: 'device-' + deviceId };
}

function chip(text, title = '') {
  const st = document.getElementById('st-sync');
  if (st) { st.textContent = text; st.title = title; }
}

export async function initSync(app) {
  deviceId = (await kvGet('deviceId')) || '';
  if (!deviceId) { deviceId = uid(); await kvSet('deviceId', deviceId); }

  serverUrl = (await kvGet('serverUrl')) || '';
  if (!serverUrl) {
    try {
      const cfg = await (await fetch('data/config.json')).json();
      serverUrl = cfg.serverUrl || '';
    } catch { /* config optional */ }
  }
  chip(serverUrl ? 'server: siap' : '');

  // every local save marks the project as needing a server push
  const origSave = app.save.bind(app);
  app.save = () => { dirty = true; origSave(); };

  app.syncNow = () => syncNow(app);
  app.renderServerSection = (container) => renderServerSection(app, container);

  // On login, fetch this account's manuscript from the server into its local key.
  app.pullUserWorkspace = async (destKey) => {
    if (!serverUrl) return false;
    try {
      const r = await call('load', { user: ident(app) });
      if (r.ok && r.project) { await putProjectAt(destKey, r.project); return true; }
    } catch { /* offline or not found */ }
    return false;
  };

  // mirror activity entries to the server, fire-and-forget
  setRemoteLogger((entry) => {
    if (!serverUrl) return;
    call('log', { user: { email: entry.user, sub: entry.sub }, type: entry.type, detail: entry.detail }).catch(() => {});
  });

  // push at most once a minute while dirty, and when the tab goes to background
  setInterval(() => { if (dirty && serverUrl && !syncing) syncNow(app); }, 60000);
  window.addEventListener('visibilitychange', () => {
    if (document.hidden && dirty && serverUrl) syncNow(app);
  });
}

export async function syncNow(app) {
  if (!serverUrl || syncing) return;
  syncing = true;
  chip('server: ⟳');
  try {
    await flush(app.state);
    const words = Object.values(app.state.documents).reduce((n, d) => n + (d.body.match(/\S+/g) || []).length, 0);
    const r = await call('save', { user: ident(app), project: app.state, words });
    if (!r.ok) throw new Error(r.error || 'gagal');
    dirty = false;
    chip('server: ✓ ' + new Date().toLocaleTimeString('id-ID').slice(0, 5), 'Tersimpan di server ' + r.savedAt);
  } catch (e) {
    chip('server: luring', 'Sinkron gagal: ' + e.message + '. Naskah tetap aman di perangkat ini.');
  } finally { syncing = false; }
}

async function loadFromServer(app) {
  if (!serverUrl) return;
  if (!confirm('Muat naskah dari server? Ini menggantikan naskah di perangkat ini (versi sekarang di-flush dulu ke penyimpanan lokal).')) return;
  try {
    const r = await call('load', { user: ident(app) });
    if (!r.ok) { alert(r.error === 'not found' ? 'Belum ada simpanan di server untuk akun ini.' : 'Gagal: ' + r.error); return; }
    await flush(r.project);
    location.reload();
  } catch (e) { alert('Gagal memuat: ' + e.message); }
}

// One section serving both dialogs: server status + sync actions + admin login.
function renderServerSection(app, container) {
  container.append(el('h3', {}, 'Server'));

  if (!serverUrl) {
    const input = el('input', { placeholder: 'https://script.google.com/macros/s/…/exec', style: 'width:100%' });
    const save = el('button', { textContent: 'Simpan URL server' });
    save.addEventListener('click', async () => {
      serverUrl = input.value.trim();
      await kvSet('serverUrl', serverUrl);
      chip(serverUrl ? 'server: siap' : '');
      alert(serverUrl ? 'Tersambung. Naskah akan ikut tersimpan ke server.' : 'URL kosong.');
    });
    container.append(
      el('p', { className: 'insp-note' },
        'Belum ada server. Pemilik men-deploy server/budiasta-server.gs (gratis, Google Apps Script) lalu menaruh URL-nya di data/config.json — atau tempel di sini untuk peramban ini saja.'),
      input, save,
    );
  } else {
    const push = el('button', { textContent: 'Simpan ke server sekarang' });
    push.addEventListener('click', () => syncNow(app));
    const pull = el('button', { textContent: 'Muat dari server' });
    pull.addEventListener('click', () => loadFromServer(app));
    container.append(
      el('p', { className: 'insp-note' },
        'Naskah tersimpan otomatis ke server (maks. sekali per menit) atas nama ' +
        (app.session ? app.session.email : 'perangkat tamu ini') + '.'),
      el('div', { className: 'insp-row' }, push, pull),
    );

    // --- server-admin: credentials are verified by the server, not the page ---
    const out = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    const id = el('input', { placeholder: 'ID admin', autocomplete: 'off' });
    const pass = el('input', { type: 'password', placeholder: 'Sandi admin' });
    const loginBtn = el('button', { textContent: 'Masuk admin server' });
    loginBtn.addEventListener('click', async () => {
      out.textContent = 'Memeriksa…';
      try {
        const cred = { id: id.value.trim(), pass: pass.value };
        const r = await call('adminLogin', cred);
        if (!r.ok) { out.textContent = 'ID atau sandi salah.'; return; }
        await renderAdminData(cred, out);
      } catch (e) { out.textContent = 'Gagal menghubungi server: ' + e.message; }
    });
    container.append(el('h3', {}, 'Admin server'),
      el('div', { className: 'insp-row' }, id, pass), loginBtn, out);
  }
}

async function renderAdminData(cred, out) {
  const [act, usr] = await Promise.all([
    call('adminActivity', { ...cred, limit: 200 }),
    call('adminUsers', cred),
  ]);
  out.textContent = '';

  out.append(el('h3', {}, `Pengguna & karya (${usr.rows?.length || 0})`));
  const users = el('div', { className: 'activity-list' });
  for (const [key, email, pid, title, words, updatedAt] of usr.rows || []) {
    users.append(el('div', { className: 'activity-row' },
      el('strong', {}, email || key), ` — “${title}” · ${words} kata · `,
      el('span', { className: 'insp-note' }, new Date(updatedAt).toLocaleString('id-ID'))));
  }
  out.append(users);

  out.append(el('h3', {}, `Aktivitas server (${act.rows?.length || 0} terakhir)`));
  const list = el('div', { className: 'activity-list' });
  for (const [t, email, sub, type, detail] of act.rows || []) {
    list.append(el('div', { className: 'activity-row' },
      el('span', { className: 'insp-note' }, new Date(t).toLocaleString('id-ID') + ' '),
      el('strong', {}, type + ' '), detail ? detail + ' ' : '',
      el('span', { className: 'insp-note' }, `— ${email}${sub ? ' (' + sub + ')' : ''}`)));
  }
  out.append(list);

  const dl = el('button', { textContent: 'Unduh log server (JSON)' });
  dl.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ users: usr.rows, activity: act.rows }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'budiasta-server-log.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  out.append(dl);
}
