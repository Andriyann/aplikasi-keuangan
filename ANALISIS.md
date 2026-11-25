# Pemetaan Budggt ke MyUang

Observasi pada 25 November 2026 menggunakan halaman publik https://budggt.com/ dan antarmuka akun yang pengguna izinkan. Pengamatan dilakukan melalui menu, ringkasan dan dialog yang terlihat. Seluruh ilustrasi dan contoh transaksi MyUang dibuat terpisah. Data pribadi, sesi, PIN, source internal, dan akses langganan Budggt tidak disertakan dalam paket.

| Area referensi | Dasar observasi | Implementasi MyUang |
| --- | --- | --- |
| Home | Dashboard menampilkan periode aktif, sisa harian, kalender, progres alokasi, aktivitas terbaru, dana darurat dan tagihan. | Ringkasan, filter periode, kalender yang terhubung ke transaksi, arus kas dan alokasi. |
| Dompet dan transaksi | Saldo awal, penyesuaian, urutan, transfer, filter waktu/dompet/jenis/subkategori/tag, dan kotak masuk terlihat pada menu akun atau penjelasan publik. | Satu jurnal memperbarui dua sisi transfer. Biaya transfer memengaruhi pengeluaran. Perubahan saldo terpisah dari pendapatan dan belanja. |
| Budget | Menu periode dan arsip, kebutuhan/keinginan/tabungan, kategori, subkategori, sumber pemasukan. Halaman publik menjelaskan dua metode dan enam langkah. | Wizard dengan cek overlap periode dan total persen; salin budget, arsip dan kelompok pengeluaran kustom. Subkategori dicatat dan dapat dicari. |
| Goals dan aset | Akun menyediakan Goal Baru, Tambah Aset, dompet & akun, aset likuid serta aset tetap. | Target memiliki saldo, tenggat, dompet tujuan dan riwayat setoran. Kekayaan bersih mencakup aset, investasi dan kewajiban. |
| Laporan | Skor berdasarkan tabungan, disiplin budget, dana darurat dan utang. Ekspor Excel/CSV menawarkan pemilihan rentang dan data. | Formula skor MyUang, indikator arus kas, tren enam bulan, ekspor kategori data atau workbook multi-lembar. Bobot dan rumus internal Budggt tidak dapat diverifikasi. |
| Advisor, scan dan profil | Advisor menampilkan chat baru, roasting, analisis dan riwayat. Profil berisi tema, privasi, preferensi, notifikasi, PIN, kredit dan langganan. Publik menjelaskan scan per item. | Analisis lokal, opsi penyedia AI, OCR lokal dan tinjauan per item. PIN milik buku MyUang, preferensi, avatar, tutorial, pengingat, PWA. Sistem identitas dan layanan pelanggan menggunakan lingkungan MyUang. |
| Automasi (Max) | Akun menampilkan dialog upgrade, sehingga rincian editor, jadwal dan eksekusinya belum dapat diamati. | Rancangan mandiri untuk transaksi berulang, transfer, penanganan akhir bulan, jeda dan pencatatan tertunda. |
| Utang/piutang (Max) | Modul dikunci. Nama fitur tercantum pada dialog paket. | Rancangan mandiri untuk pokok, pihak, tenggat, cicilan, penerimaan, saldo dan keterkaitan dengan dompet. |
| Portofolio investasi (Max) | Dialog mencantumkan deposito, reksa dana, obligasi, saham & ETF, kripto, emas, valas dan update harga harian. | Portofolio pencatatan dengan kelas tersebut, unit, biaya, transaksi, imbal hasil, basis biaya rata-rata, penilaian manual/CSV/feed. |
| Paket berbayar dan kredit | Referensi menjual langganan serta kredit terkait AI. | Semua modul MyUang dibuka langsung. Pembelian paket, isi ulang kredit Budggt, bonus kredit, dukungan pelanggan Budggt, dan billing Budggt tidak diperlukan dalam model akses MyUang. |

## Cakupan verifikasi

Transfer berbiaya dan valuasi posisi diperiksa melalui Chrome pada MyUang. Pengujian mesin perhitungan mencakup saldo dua dompet, biaya dan penyesuaian, periode, alokasi persen/tetap, pengurangan pokok, harga rata-rata, penjualan parsial, transaksi berulang akhir bulan serta pencegahan duplikasi. Pembacaan gambar contoh diuji memakai model Indonesia dan Inggris. File XLSX yang dihasilkan berhasil dibaca kembali dengan tipe angka terjaga.

Layanan AI generatif dan pasokan harga eksternal baru aktif setelah konfigurasi pemilik tersedia. Otomasi terlewat diproses saat pengguna membuka buku. Aplikasi tidak memindahkan uang nyata, mengirim order bursa, atau menarik data rekening. Formula laporan, jadwal, OCR dan desain dibuat untuk MyUang. Kesetaraan langkah per langkah pada layar Max tidak dapat diverifikasi dari akun referensi.
