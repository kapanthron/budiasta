// Google sign-in (Google Identity Services) + admin role + account panel.
// Static app, no server: the ID token is decoded client-side for identification,
// the admin role is enforced by the UI, and the activity log lives in this browser.
import { kvGet, kvSet } from './store.js';
import { logActivity, getActivity, clearActivity, exportActivity } from './activity.js';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(part))));
}

export async function initAuth(app) {
  const userBtn = document.getElementById('btn-user');
  const loginDlg = document.getElementById('login-dialog');
  const loginBody = document.getElementById('login-body');
  const acctDlg = document.getElementById('account-dialog');
  const acctBody = document.getElementById('account-body');

  app.session = (await kvGet('session')) || null;
  let admins = (await kvGet('admins')) || [];
  app.isAdmin = () => !!app.session && admins.includes(app.session.email);

  function refreshChip() {
    userBtn.textContent = app.session
      ? (app.session.name || app.session.email).split(' ')[0] + (app.isAdmin() ? ' ★' : '')
      : 'Masuk';
  }

  async function onCredential(response) {
    let claims;
    try { claims = decodeJwt(response.credential); } catch { return; }
    app.session = {
      sub: claims.sub, email: claims.email, name: claims.name || '',
      picture: claims.picture || '', loginAt: new Date().toISOString(),
    };
    await kvSet('session', app.session);
    if (!admins.length) {           // first account to sign in on this browser becomes admin
      admins = [app.session.email];
      await kvSet('admins', admins);
    }
    await logActivity(app, 'masuk', `Google ID ${claims.sub}`);
    refreshChip();
    loginDlg.close();
    renderAccount();
  }

  async function renderLogin() {
    loginBody.textContent = '';
    const clientId = (await kvGet('googleClientId')) || '';
    if (!clientId) {
      const input = el('input', { placeholder: 'xxxxxxxx.apps.googleusercontent.com', style: 'width:100%' });
      const save = el('button', { textContent: 'Simpan Client ID' });
      save.addEventListener('click', async () => {
        if (!input.value.trim()) return;
        await kvSet('googleClientId', input.value.trim());
        renderLogin();
      });
      loginBody.append(
        el('p', {}, 'Masuk dengan Google butuh penyiapan sekali oleh pemilik situs:'),
        el('ol', {},
          el('li', {}, 'Buka console.cloud.google.com → APIs & Services → Credentials.'),
          el('li', {}, 'Create Credentials → OAuth client ID → Web application.'),
          el('li', {}, 'Tambahkan Authorized JavaScript origin: https://kapanthron.github.io'),
          el('li', {}, 'Salin Client ID-nya ke sini:')),
        input, save,
        el('p', { className: 'insp-note' }, 'Client ID bukan rahasia; ia hanya mengikat tombol masuk ke situs ini.'),
      );
      return;
    }
    const holder = el('div', { id: 'gsi-button' });
    loginBody.append(
      el('p', {}, 'Masuk untuk mencatat aktivitas atas nama akun Anda.'),
      holder,
      el('p', { className: 'insp-note' },
        'Tanpa masuk pun Budiasta tetap berfungsi penuh sebagai tamu. Akun pertama yang masuk di peramban ini menjadi admin.'),
    );
    try {
      await loadGsi();
      google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
      google.accounts.id.renderButton(holder, { theme: 'outline', size: 'large', text: 'signin_with' });
    } catch {
      holder.append(el('p', { className: 'insp-note' },
        'Skrip Google gagal dimuat. Periksa koneksi, atau Client ID dan origin yang terdaftar.'));
    }
  }

  let gsiPromise = null;
  function loadGsi() {
    return gsiPromise ??= new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = GSI_SRC; s.async = true;
      s.onload = res; s.onerror = rej;
      document.head.append(s);
    });
  }

  async function renderAccount() {
    acctBody.textContent = '';
    if (!app.session) return;
    const s = app.session;
    acctBody.append(
      el('h3', {}, s.name || s.email),
      el('p', { className: 'insp-note' }, `${s.email} · Google ID ${s.sub}` + (app.isAdmin() ? ' · admin' : '')),
    );

    if (app.isAdmin()) {
      // admin: full access — activity log, admin list, client ID reset
      const list = (await getActivity()).slice().reverse();
      const table = el('div', { className: 'activity-list' });
      for (const a of list.slice(0, 100)) {
        table.append(el('div', { className: 'activity-row' },
          el('span', { className: 'insp-note' }, new Date(a.t).toLocaleString('id-ID')),
          el('strong', {}, ' ' + a.type + ' '),
          el('span', {}, a.detail ? a.detail + ' ' : ''),
          el('span', { className: 'insp-note' }, '— ' + a.user)));
      }
      const expBtn = el('button', { textContent: 'Unduh log (JSON)' });
      expBtn.addEventListener('click', async () => exportActivity(await getActivity()));
      const clearBtn = el('button', { textContent: 'Kosongkan log' });
      clearBtn.addEventListener('click', async () => {
        if (!confirm('Hapus seluruh log aktivitas?')) return;
        await clearActivity(); renderAccount();
      });

      const adminInput = el('input', { value: admins.join(', '), style: 'width:100%' });
      const adminSave = el('button', { textContent: 'Simpan daftar admin' });
      adminSave.addEventListener('click', async () => {
        admins = adminInput.value.split(',').map(x => x.trim()).filter(Boolean);
        if (!admins.includes(s.email) && !confirm('Anda menghapus diri sendiri dari admin. Lanjutkan?')) {
          adminInput.value = admins.concat(s.email).join(', ');
          admins = adminInput.value.split(',').map(x => x.trim()).filter(Boolean);
        }
        await kvSet('admins', admins);
        await logActivity(app, 'ubah-admin', admins.join(','));
        refreshChip();
      });
      const resetClient = el('button', { textContent: 'Ganti Google Client ID' });
      resetClient.addEventListener('click', async () => { await kvSet('googleClientId', ''); acctDlg.close(); });

      acctBody.append(
        el('h3', {}, `Log aktivitas (${list.length})`),
        table,
        el('div', { className: 'insp-row' }, expBtn, clearBtn),
        el('h3', {}, 'Admin (email, pisahkan koma)'),
        adminInput, adminSave, resetClient,
        el('p', { className: 'insp-note' },
          'Catatan jujur: tanpa server, peran admin dan log ini hidup di peramban masing-masing pemakai — ini jejak kerja, bukan pagar keamanan.'),
      );
    }

    const logout = el('button', { textContent: 'Keluar' });
    logout.addEventListener('click', async () => {
      await logActivity(app, 'keluar');
      app.session = null;
      await kvSet('session', null);
      refreshChip();
      acctDlg.close();
    });
    acctBody.append(el('div', { className: 'dialog-actions' }, logout));
  }

  userBtn.addEventListener('click', async () => {
    if (app.session) { await renderAccount(); acctDlg.showModal(); }
    else { await renderLogin(); loginDlg.showModal(); }
  });
  document.getElementById('login-close').addEventListener('click', () => loginDlg.close());
  document.getElementById('account-close').addEventListener('click', () => acctDlg.close());

  app.logActivity = (type, detail) => logActivity(app, type, detail);
  refreshChip();
}
