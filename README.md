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
- **Masuk dengan Google** — opsional. Akun pertama yang masuk di sebuah peramban menjadi
  admin: akses penuh (sunting Tentang tanpa kunci, kelola daftar admin, lihat/unduh log
  aktivitas). Setiap tindakan penting (masuk, simpan, buat/hapus/ganti nama dokumen, unduh,
  bagikan, panggilan AI) dicatat dengan ID akun Google dan waktunya.

### Penyiapan login Google (sekali, oleh pemilik)
1. Buka [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create Credentials → **OAuth client ID** → Web application.
3. Tambahkan Authorized JavaScript origin: `https://kapanthron.github.io`
   (dan `http://localhost:8000` untuk pengembangan).
4. Buka aplikasi → tombol **Masuk** → tempel Client ID.

Catatan jujur: Budiasta tidak punya server, jadi peran admin ditegakkan di antarmuka dan
log aktivitas tersimpan di peramban masing-masing pemakai (dapat diunduh sebagai JSON).
Untuk penegakan sungguhan lintas perangkat dibutuhkan backend.

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
