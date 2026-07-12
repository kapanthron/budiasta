# budiasta · Manuskrip

*asta tumuju ing budi*

Studio menulis lokal-pertama di peramban — untuk novelis, penyair, kolumnis, dan penulis skenario.
Vanilla JS, tanpa build step, tanpa server, tanpa telemetri. Naskah Anda tinggal di mesin Anda
(IndexedDB), dan dapat diekspor sebagai JSON kapan saja.

**Live:** https://kapanthron.github.io/budiasta/

## Yang sudah ada (v1)
- **Binder** — pohon dokumen: tambah, ganti nama, urutkan, hapus.
- **Editor** — halaman polos dengan autosave setiap jeda, hitung kata, pagu kata untuk kolumnis,
  waktu baca, dan penghitung sesi.
- **Panel Bahasa** — mesin aturan PUEBI/EYD yang berjalan sepenuhnya luring dari
  `data/puebi_eyd_rules.json`. Setiap temuan menyebut id aturannya (mis. `W01`), dengan tombol
  Terapkan/Abaikan. Mode puisi membisukan aturan kapital dan tanda baca. Tidak ada nilai,
  tidak ada koreksi otomatis.
- **Kamus** — muat `kbbi.json` hasil ekstraksi Anda sendiri (lihat di bawah). Tidak pernah
  dibundel: kamus adalah kompilasi berhak cipta dan tetap menjadi pustaka pribadi.
- **Snapshot** — simpan versi, pulihkan dengan aman (keadaan sekarang di-snapshot dulu).
- **Laci Cuts** — Ctrl+Shift+X memindahkan seleksi ke laci, bukan ke tempat sampah.
- **Tema & tipografi** — 4 tema berbasis token CSS, kendali huruf/ukuran/jarak baris/lebar ukur.
- **Palet perintah** — Ctrl/Cmd+K.
- **Ekspor/Impor** — seluruh proyek sebagai satu berkas JSON.

## Menjalankan lokal
Sajikan folder ini dengan server statis apa pun (modul ES butuh http, bukan file://):

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

## KBBI luring (opsional)
```bash
pip install pymupdf
python3 tools/kbbi_pdf_to_json.py KBBI_Lengkap.pdf --out kbbi.json
```
Lalu buka tab **Bahasa → Muat kbbi.json**. Berkas tidak pernah meninggalkan mesin Anda dan
sudah masuk `.gitignore`.

## Deploy
Setiap push ke `main` (atau cabang pengembangan ini) memicu `.github/workflows/deploy.yml`,
yang memverifikasi isi situs (bukan placeholder "hello world") lalu menerbitkannya ke GitHub Pages.

Rencana lengkap dan keputusan desain: [`docs/PLAN.md`](docs/PLAN.md).
