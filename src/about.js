// Tentang Budiasta — content editable behind a local admin key.
// A local-first app has no server, so "admin" means: whoever set the key on this browser.
import { kvGet, kvSet } from './store.js';

const DEFAULT_ABOUT = `Budiasta adalah studio menulis lokal-pertama di peramban — untuk novelis, penyair, kolumnis, dan penulis skenario.

Naskah Anda tinggal di perangkat Anda sendiri, tersimpan otomatis pada setiap jeda, dan bisa diunduh kapan saja sebagai TXT, DOC, atau PDF. Panel Bahasa memeriksa ejaan menurut PUEBI/EYD sepenuhnya luring, dan setiap temuan menyebut aturan yang menjadi dasarnya.

Nama Budiasta berasal dari falsafah Jawa: tangan yang dipimpin oleh akal pikiran menuju kebijaksanaan.`;

const CREDIT = 'Dibuat dan dikembangkan oleh Panthron Mahagama.';

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function initAbout(app) {
  const dlg = document.getElementById('about-dialog');
  const content = document.getElementById('about-content');
  const editBtn = document.getElementById('about-edit');
  let editing = false;

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  };

  async function render() {
    const text = (await kvGet('about')) || DEFAULT_ABOUT;
    content.textContent = '';
    content.append(
      el('h2', {}, 'Budiasta'),
      el('p', { className: 'tagline' }, 'Asta Tumuju ing Budi — tangan yang dipimpin oleh akal pikiran menuju kebijaksanaan.'),
      ...text.split(/\n{2,}/).map(p => el('p', {}, p)),
      el('p', { className: 'insp-note' }, CREDIT),
    );
    editBtn.textContent = 'Ubah (admin)';
    editing = false;
  }

  async function startEdit() {
    // an admin signed in with Google has full access; others need the local key
    if (!app.isAdmin?.()) {
      const storedKey = await kvGet('adminKey');
      const entered = prompt(storedKey
        ? 'Kunci admin:'
        : 'Belum ada kunci admin. Buat kunci baru untuk mengunci halaman ini:');
      if (entered == null || !entered.trim()) return;
      const digest = await hash(entered);
      if (storedKey && digest !== storedKey) { alert('Kunci salah.'); return; }
      if (!storedKey) await kvSet('adminKey', digest);
    }

    const current = (await kvGet('about')) || DEFAULT_ABOUT;
    content.textContent = '';
    const ta = el('textarea', { value: current });
    content.append(
      el('h2', {}, 'Ubah halaman Tentang'),
      el('p', { className: 'insp-note' }, 'Pisahkan paragraf dengan baris kosong. Tajuk, tagline, dan kredit pembuat tidak berubah.'),
      ta,
    );
    editBtn.textContent = 'Simpan';
    editing = true;
    editBtn.onclickSave = async () => {
      await kvSet('about', ta.value.trim() || DEFAULT_ABOUT);
      app.logActivity?.('ubah-tentang');
      await render();
    };
  }

  editBtn.addEventListener('click', () => {
    if (editing) editBtn.onclickSave?.(); else startEdit();
  });
  document.getElementById('about-close').addEventListener('click', () => dlg.close());
  document.getElementById('btn-about').addEventListener('click', async () => {
    await render();
    dlg.showModal();
  });
}
