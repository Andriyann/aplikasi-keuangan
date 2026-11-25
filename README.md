# MyUang

Aplikasi keuangan pribadi berbahasa Indonesia untuk browser desktop dan ponsel. Ruang demo berisi contoh sintetis. Pilih **Mulai catatan saya**, buka **Dompet → Tambah dompet**, lalu masukkan saldo awal. Buat alokasi di **Budget** dan catat transaksi pertama.

## Menjalankan aplikasi

- **Paket aplikasi** — ekstrak ZIP. Buka `Mulai-MyUang.cmd` di Windows atau jalankan `python3 mulai.py` pada macOS/Linux dari folder hasil ekstraksi. Windows juga dapat memakai `py -3 mulai.py`. Dibutuhkan Python 3.8 atau lebih baru. Tidak ada paket Python tambahan. Browser membuka aplikasi di http://127.0.0.1:8788/.
- **Dari source** — jalankan `python3 desktop/mulai.py` dari akar proyek. Antarmuka yang dijalankan sama dengan aplikasi rilis. Untuk uji mesin perhitungan jalankan `node --test tests/finance.test.cjs` menggunakan Node 22.13 atau lebih baru.
- **Tanpa Python** — buka `public/myuang.html` langsung di Chrome. Mode ini menyimpan buku pada browser dan lokasi file tersebut. Untuk OCR, instalasi PWA, feed harga dan model AI eksternal, jalankan server lokal atau akses situs privat.
- **Di HP** — buka situs yang sudah diterbitkan dengan akun pemilik. Gunakan menu browser untuk memasangnya ke layar utama. Server desktop hanya menerima koneksi dari komputer tempat server dijalankan.

Paket aplikasi dan versi web memiliki buku masing-masing. Pindah antarkeduanya melalui **Profil → Cadangkan JSON**, lalu **Pulihkan JSON** pada buku tujuan. Pemulihan mengganti isi buku aktif. Cadangan dari buku ber-PIN memerlukan PIN asal.

## Penyimpanan

Pada situs privat, buku pribadi terikat ke identitas pemilik di database D1 dan dapat diakses lintas perangkat. Pembaruan buku memakai nomor revisi untuk mendeteksi perubahan bersamaan. Jika terjadi konflik, muat ulang lalu terapkan lagi perubahan. Saat server tidak tersedia, aplikasi memberi tahu bahwa buku pribadi belum dapat disimpan.

Pada desktop, SQLite menyimpan buku pribadi di `~/.myuang/buku.db` (di Windows di folder profil pengguna). `MYUANG_DATA` mengatur lokasi penyimpanan. `MYUANG_PORT` mengatur port lokal. Demo selalu tersimpan pada browser. PIN opsional mengenkripsi isi buku di sisi browser menggunakan AES-GCM dengan kunci turunan PBKDF2. Setiap pembukaan ulang membutuhkan PIN. Simpan cadangan dan PIN secara terpisah.

## Modul dan hubungan antarcatatan

| Modul | Alur |
| --- | --- |
| Ringkasan | Saldo gabungan, aktivitas hari ini, ringkasan periode, budget harian, tren enam bulan, kalender, transaksi terakhir, realisasi, dana darurat dan tagihan mendatang. Klik hari di kalender untuk melihat transaksinya. |
| Dompet & transaksi | Tunai, bank, tabungan, e-wallet, kartu kredit dan PayLater. Atur urutan, koreksi saldo, beli dengan kartu, bayar tagihan, bayar sebagian, pemasukan, pengeluaran dan transfer dengan biaya. Tersedia kalkulator nominal, kategori/subkategori, tag, input massal, pencarian dan filter. |
| Budget | Wizard enam langkah, periode bulanan atau kustom, metode persentase atau nominal tetap, kebutuhan/keinginan/tabungan, pos tambahan, sumber pemasukan, salin periode dan arsip. Peringatan muncul saat realisasi melebihi alokasi. |
| Goals | Target, tenggat, saldo awal, dompet tujuan serta setoran dari dompet lain. Setoran menambah realisasi pos tabungan dan tetap dihitung sebagai transfer pada arus kas. |
| Aset | Aset likuid dan tetap. Kekayaan bersih menggabungkan saldo dompet, aset, nilai posisi investasi, piutang, dan utang. Hindari mencatat kepemilikan yang sama di dua modul. |
| Utang & piutang | Catat pihak, pokok, jatuh tempo, cicilan dan pelunasan. Pokok awal merepresentasikan posisi yang sudah ada. Pembayaran pokok utang atau penerimaan pokok piutang mengubah dompet dan sisa pokok tanpa menaikkan belanja atau pendapatan. |
| Investasi | Deposito, reksa dana, obligasi, saham, ETF, kripto, emas dan valas. Simpan posisi awal, catat beli/jual melalui dompet, unit, biaya, harga perolehan rata-rata, laba/rugi terealisasi maupun belum terealisasi. Catat bunga, dividen, kupon atau distribusi. Harga per unit memakai mata uang buku. Semua transaksi pada modul ini merupakan pencatatan. |
| Automasi | Pemasukan, pengeluaran atau transfer berulang harian, mingguan, bulanan. Dukungan tanggal akhir, jeda dan tanggal akhir bulan. Saat buku dibuka, jadwal terlewat diproses dengan kunci unik per jadwal dan tanggal. |
| Scan struk & kotak masuk | Pengenalan gambar lokal (Tesseract, Indonesia dan Inggris). Periksa item serta nominal, simpan sebagai draf, kemudian pilih dompet dan kategori sebelum membukukan masing-masing item. |
| Advisor & laporan | Analisis lokal, roasting, tujuan tabungan, chat dan riwayat. Laporan menyediakan rentang tanggal, kesehatan finansial, kategori, tren, ekspor CSV dan Excel asli dengan beberapa lembar. Model AI generatif dapat dihubungkan di server. |
| Profil | Nama, avatar, tampilan terang/gelap, aksen Violet/Neon/Pastel, navigasi Indonesia/English, 12 mata uang, sembunyikan nominal, PIN, cadangan, tutorial, pengingat saat aplikasi terbuka dan PWA. Sejumlah penjelasan rinci menggunakan bahasa Indonesia. |

### Integrasi opsional

**AI generatif.** Atur `OPENAI_API_KEY` dan jika perlu `OPENAI_MODEL` di lingkungan server. Untuk desktop, atur sebelum menjalankan peluncur. Di aplikasi pilih **Profil → Pengaturan AI → Model AI eksternal**. Pertanyaan dan ringkasan periode dikirim ke penyedia saat pengguna mengirim pertanyaan. Pengeluaran API mengikuti akun penyedia. Analisis lokal, OCR dan ekspor berfungsi tanpa kunci.

**Harga pasar.** Server membaca URL HTTPS yang ditentukan melalui `MYUANG_PRICES_URL`. Format JSON berikut merupakan contoh kontrak, dengan angka ilustratif.

```json
{"date":"2026-11-25","currency":"IDR","prices":{"EMAS-GRAM":1000000,"DEMO":1200}}
```

Gunakan harga per unit dalam mata uang buku dan kode yang sama dengan posisi. MyUang mencoba memperbarui pada pembukaan buku pribadi atau pergantian hari ketika aplikasi terbuka. Harga lama tetap terlihat bersama tanggalnya jika sumber tidak tersedia. **Investasi → Impor harga CSV** menerima pasangan kode dan harga per baris. Tombol **Ubah harga** dapat dipakai untuk satu posisi.

**PWA dan pengingat.** Aset antarmuka disimpan untuk pemuatan ulang. OCR dan Excel disertakan dalam paket desktop. Pada situs terpasang, modul tambahan disimpan setelah pertama dimuat. Pengingat menggunakan waktu perangkat saat aplikasi terbuka. Modul server dan sinkronisasi memerlukan koneksi.

### Source dan deployment

- `public/js/finance.js` menyatukan transaksi, saldo, alokasi, investasi dan penjadwalan.
- `public/js/app.js`, `actions.js`, `storage.js`, `language.js` membentuk antarmuka serta penyimpanan. Aset, model OCR, lisensi dan pustaka Excel berada di `public/`.
- `app/api/` memuat API buku, harga, dan AI untuk situs privat. Identitas berasal dari autentikasi hosting. `db/schema.ts` dan `drizzle/` mendefinisikan tabel dan migrasi. `desktop/` berisi implementasi lokal yang berdiri sendiri.
- Untuk membangun versi Worker, gunakan Node 22.13+ dan jalankan `npm ci`, lalu `npm run build`. Untuk pengembangan gunakan `npm run dev`. Pada deployment terpisah sediakan binding D1 `DB`, terapkan migrasi SQL di `drizzle/`, dan gunakan autentikasi hosting tepercaya yang memasok identitas pengguna ke API. Jangan mengekspos Worker dengan header identitas yang dapat ditetapkan sembarang klien. Server desktop siap dipakai lokal tanpa infrastruktur tersebut.
- `python3 scripts/package-desktop.py /folder/keluaran` membuat ZIP aplikasi dari source.
- Lihat `ANALISIS.md` untuk pemetaan terhadap referensi dan bagian yang tidak bisa diverifikasi dari akun.
