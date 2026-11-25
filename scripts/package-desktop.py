"""Build the portable MyUang desktop ZIP. Usage: python3 scripts/package-desktop.py out"""
import sys
import zipfile
from pathlib import Path
base = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out / "MyUang-Aplikasi.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted((base / "public").rglob("*")):
        if p.is_file() and p.name != "favicon.svg":
            z.write(p, "MyUang/" + str(p.relative_to(base)))
    for n in ["mulai.py", "Mulai-MyUang.command", "Mulai-MyUang.cmd"]:
        z.write(base / "desktop" / n, "MyUang/" + n)
    for n in ["README.md", "ANALISIS.md"]:
        z.write(base / n, "MyUang/" + n)
    z.writestr("MyUang/BACA-DULU.txt", """MyUang — aplikasi keuangan pribadi
Ekstrak seluruh folder sebelum menjalankan.
Windows: buka Mulai-MyUang.cmd (Python 3), atau jalankan py -3 mulai.py.
macOS/Linux: buka Terminal di folder ini, lalu ketik python3 mulai.py.
Browser membuka MyUang. Pilih Mulai catatan saya untuk memulai buku pribadi.
Tanpa Python: buka public/myuang.html di Chrome. OCR dan fitur server memerlukan peluncur.
Bantuan lengkap: README.md. Pemetaan fitur referensi: ANALISIS.md.
""")
print(out / "MyUang-Aplikasi.zip")
