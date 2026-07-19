# Budiasta

**Asta Tumuju ing Budi** — tangan yang dipimpin oleh akal pikiran menuju kebijaksanaan.

Studio menulis lokal-pertama di peramban — untuk novelis, penyair, kolumnis, dan penulis skenario.
Vanilla JS, tanpa build step, tanpa server, tanpa telemetri. Naskah Anda tinggal di perangkat Anda
(IndexedDB) dan dapat diunduh kapan saja.

**Live:** https://kapanthron.github.io/budiasta/

Dibuat dan dikembangkan oleh **Panthron Mahagama**.

## Fitur
- **Binder** — pohon dokumen: tambah, ganti nama, urutkan, hapus.
- **Editor** — autosave otomatis setiap jeda + tombol Simpan / Ctrl+S, hitung kata, pagu kata,
  waktu baca. Tata letak responsif: di ponsel, binder dan panel menjadi laci geser.
- **Panel Bahasa** — mesin aturan PUEBI/EYD sepenuhnya luring dari `data/puebi_eyd_rules.json`.
  Setiap temuan menyebut id aturannya, dengan Terapkan/Abaikan. Mode puisi membisukan aturan
  kapital dan tanda baca.
- **Asisten AI (opsional)** — mati secara bawaan. Masukkan kunci API Anda sendiri
  (Groq / Google AI Studio / OpenRouter / endpoint OpenAI-compatible apa pun). Hanya seleksi
  atau paragraf aktif yang dikirim — tidak pernah seluruh naskah.
- **Kamus** — muat `kbbi.json` hasil ekstraksi Anda sendiri (`tools/kbbi_pdf_to_json.py`).
  Tidak pernah dibundel; kamus adalah kompilasi berhak cipta.
- **Unduh & bagikan** — TXT, DOC (Word), PDF (lewat dialog cetak), atau menu bagikan ponsel.
- **Font sendiri** — pasang berkas .ttf/.otf/.woff2; tersimpan di peramban.
- **Tema** — 4 tema berbasis token + sakelar terang/gelap satu ketukan.
- **Snapshot & Laci Cuts** — tidak ada kata yang hilang; Ctrl+Shift+X memarkir seleksi.
- **Tentang** — halaman Tentang dapat disunting pemilik lewat kunci admin lokal.
- **Masuk dengan Google** — opsional. Siapa pun yang punya akun Google bisa masuk ke akunnya
  masing-masing, dan **setiap akun punya naskahnya sendiri** yang terpisah (disimpan per akun
  di peramban, dan ikut ke perangkat lain lewat server jika server aktif). Akun pertama yang
  masuk di sebuah peramban menjadi admin: akses penuh (sunting Tentang tanpa kunci, kelola
  daftar admin, lihat/unduh log aktivitas). Setiap tindakan penting (masuk, simpan,
  buat/hapus/ganti nama dokumen, unduh, bagikan, panggilan AI) dicatat dengan ID akun Google
  dan waktunya.

### Penyiapan login Google (sekali, oleh pemilik)
1. Buka [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create Credentials → **OAuth client ID** → Web application.
3. Tambahkan Authorized JavaScript origin: `https://kapanthron.github.io`
   (dan `http://localhost:8000` untuk pengembangan).
4. Buka aplikasi → tombol **Masuk** → tempel Client ID.

## Server gratis (simpan karya + pelacakan admin)

Budiasta menyertakan backend gratis berbasis **Google Apps Script**: karya setiap pemakai
tersimpan ke Google Drive milik pemilik situs, dan setiap aktivitas tercatat di spreadsheet
**"Budiasta Data"** — admin bisa melacak dari panel dalam aplikasi atau langsung membuka
spreadsheet-nya. Kredensial admin diperiksa di server, bukan di halaman.

### Penyiapan server (sekali, gratis, tanpa kartu kredit)
1. Buka [script.google.com](https://script.google.com) → **New project**, tempel seluruh isi
   [`server/budiasta-server.gs`](server/budiasta-server.gs).
2. Di baris atas skrip, isi `ADMIN_ID` dan `ADMIN_PASS` dengan kredensial asli Anda.
   (Sandi tinggal di proyek Apps Script pribadi Anda — jangan pernah menaruhnya di repo publik.)
3. **Deploy → New deployment → Web app** — *Execute as: Me*, *Who has access: Anyone* → salin URL `/exec`.
4. Tulis URL itu ke [`data/config.json`](data/config.json) (`"serverUrl"`) lewat tombol ✏️ di GitHub,
   agar semua pemakai tersambung — atau tempel di dialog **Masuk** untuk satu peramban saja.

Sesudah tersambung: naskah ikut tersimpan ke server (maksimal sekali per menit, plus saat
tombol Simpan ditekan), tombol **Muat dari server** menarik simpanan terakhir, dan bagian
**Admin server** (ID + sandi) menampilkan semua pengguna, karya, dan aktivitas — bisa diunduh
sebagai JSON.

Catatan jujur: identitas pengirim (email/Google ID) disertakan oleh aplikasi dan belum
diverifikasi ulang di server, jadi log ini jejak kerja yang baik, bukan bukti forensik.

## Menjalankan lokal
```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

## KBBI luring (opsional)
```bash
pip install pymupdf
python3 tools/kbbi_pdf_to_json.py KBBI_Lengkap.pdf --out kbbi.json
```
Lalu buka tab **Bahasa → Muat kbbi.json**. Berkas tidak pernah meninggalkan mesin Anda.

## Deploy
Push ke `main` memicu `.github/workflows/deploy.yml`, yang memverifikasi isi situs lalu
menerbitkannya ke GitHub Pages.

Rencana dan keputusan desain: [`docs/PLAN.md`](docs/PLAN.md).
