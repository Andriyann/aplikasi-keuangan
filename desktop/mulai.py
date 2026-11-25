"""Run the personal MyUang app on this computer using only Python 3."""
import json
import os
import socket
import sqlite3
import threading
import urllib.error
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "public" if (ROOT / "public").is_dir() else ROOT.parent / "public"
STATE = Path(os.environ.get("MYUANG_DATA", str(Path.home() / ".myuang")))
PORT = int(os.environ.get("MYUANG_PORT", "8788"))
ORIGIN = f"http://127.0.0.1:{PORT}"


def db():
    return sqlite3.connect(STATE / "buku.db", timeout=8)


class App(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, format, *args):
        pass

    def incoming_allowed(self, write=False):
        if self.headers.get("Host") != f"127.0.0.1:{PORT}":
            self.send_error(403)
            return False
        if write and (self.headers.get("Origin") != ORIGIN or
                      self.headers.get_content_type() != "application/json"):
            self.send_error(403)
            return False
        return True

    def reply(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self, limit):
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= limit:
            raise ValueError("Ukuran permintaan tidak valid.")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        if not self.incoming_allowed():
            return
        path = urlsplit(self.path).path
        if path == "/api/book":
            with db() as conn:
                record = conn.execute("SELECT rev, body FROM book WHERE id=1").fetchone()
            return self.reply({"mode": "desktop", "revision": record[0] if record else 0,
                               "book": json.loads(record[1]) if record else None, "name": ""})
        if path == "/api/prices":
            url = os.environ.get("MYUANG_PRICES_URL", "")
            if not url.startswith("https://"):
                return self.reply({"error": "Feed harga belum dikonfigurasi."}, 503)
            try:
                with urllib.request.urlopen(url, timeout=8) as reply:
                    result = json.loads(reply.read(1000000))
                return self.reply({k: result[k] for k in ("date", "currency", "prices")})
            except (ValueError, KeyError, OSError):
                return self.reply({"error": "Feed harga tidak tersedia."}, 502)
        if path == "/":
            self.path = "/myuang.html"
        super().do_GET()

    def list_directory(self, path):
        self.send_error(404)

    def do_PUT(self):
        if not self.incoming_allowed(True):
            return
        if self.path != "/api/book":
            return self.send_error(404)
        try:
            obj = self.read_json(3500000)
            rev, book = obj["revision"], obj["book"]
            if type(rev) is not int or rev < 0 or not isinstance(book, dict) or not (book.get("vault") == 1 or book.get("version") == 1):
                raise ValueError("Buku tidak valid.")
            body = json.dumps(book, ensure_ascii=False)
            with db() as conn:
                if rev == 0:
                    cur = conn.execute("INSERT OR IGNORE INTO book VALUES(1,1,?)", (body,))
                else:
                    cur = conn.execute("UPDATE book SET rev=rev+1,body=? WHERE id=1 AND rev=?", (body, rev))
                changed = cur.rowcount
            self.reply({"revision": rev + 1} if changed else {"error": "Konflik versi."}, 200 if changed else 409)
        except (KeyError, TypeError, ValueError):
            self.reply({"error": "Format buku tidak valid."}, 400)

    def do_POST(self):
        if not self.incoming_allowed(True):
            return
        if self.path != "/api/advisor":
            return self.send_error(404)
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            return self.reply({"error": "Model AI belum dikonfigurasi."}, 503)
        try:
            args = self.read_json(9000)
            query = {"model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), "store": False,
                     "max_output_tokens": 600, "instructions": "Jelaskan angka ringkasan keuangan dalam bahasa pengguna. Jangan mengarang data. Jika diminta roasting, tetap ramah.",
                     "input": json.dumps({"question": args["question"], "summary": args["summary"]})}
            req = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(query).encode(),
                                         headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as remote:
                res = json.loads(remote.read(500000))
            answer = " ".join(c.get("text", "") for o in res.get("output", []) for c in o.get("content", [])).strip()
            if not answer:
                raise ValueError()
            self.reply({"answer": answer})
        except (ValueError, KeyError, OSError):
            self.reply({"error": "Penyedia AI gagal memproses pertanyaan."}, 502)


def main():
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS book(id INTEGER PRIMARY KEY, rev INTEGER NOT NULL, body TEXT NOT NULL)")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), App)
    except OSError as error:
        raise SystemExit(f"Port {PORT} sedang digunakan. Tutup sesi MyUang sebelumnya atau pilih MYUANG_PORT lain.") from error
    print(f"MyUang berjalan di {ORIGIN}/ — tekan Ctrl+C untuk menutup.", flush=True)
    if not os.environ.get("MYUANG_NO_BROWSER"):
        threading.Timer(0.4, lambda: webbrowser.open(ORIGIN)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
