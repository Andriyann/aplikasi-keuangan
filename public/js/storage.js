"use strict";
const b64 = (array) =>
  btoa(
    Array.from(new Uint8Array(array), (x) => String.fromCharCode(x)).join(""),
  );
const bytes = (s) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
const enc = new TextEncoder(),
  dec = new TextDecoder();
async function keyFor(pin, s) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: 310000, salt: s },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function seal(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sessionKey,
      enc.encode(JSON.stringify(data)),
    );
  return { vault: 1, salt: b64(salt), iv: b64(iv), data: b64(cipher) };
}
async function decryptBook(vault, pin) {
  try {
    const s = bytes(vault.salt),
      key = await keyFor(pin, s),
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(vault.iv) },
        key,
        bytes(vault.data),
      );
    return { data: JSON.parse(dec.decode(plain)), key, s };
  } catch {
    throw Error("PIN salah atau cadangan rusak.");
  }
}
function validate(b) {
  if (
    b?.version !== 1 ||
    !b.prefs ||
    !b.categories ||
    ![
      "wallets",
      "tx",
      "plans",
      "assets",
      "debts",
      "positions",
      "trades",
      "goals",
      "rules",
      "bills",
      "inbox",
      "chats",
      "incomeCats",
    ].every((k) => Array.isArray(b[k]))
  )
    throw Error("Format buku MyUang tidak valid.");
  try {
    new Intl.NumberFormat("id", {
      style: "currency",
      currency: b.prefs.currency,
    });
  } catch {
    throw Error("Mata uang cadangan tidak valid.");
  }
  for (const r of b.rules)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.next) ||
      !["Bulanan", "Mingguan", "Harian"].includes(r.every)
    )
      throw Error("Jadwal dalam cadangan tidak valid.");
  for (const x of b.tx)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
      x.date > F.day() ||
      !Number.isFinite(x.amount) ||
      x.amount < 0 ||
      !b.wallets.some((w) => w.id === x.wallet) ||
      (x.type === "transfer" && !b.wallets.some((w) => w.id === x.to))
    )
      throw Error("Transaksi dalam cadangan tidak valid.");
}
async function writeBook(next) {
  const payload = sessionKey ? await seal(next) : next;
  if (cloud && mode === "personal") {
    const r = await fetch("/api/book", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: rev, book: payload }),
    });
    if (!r.ok)
      throw Error(
        r.status === 409
          ? "Perubahan belum tersimpan. Muat ulang karena buku sudah diubah pada perangkat lain."
          : "Buku belum tersimpan di server. Periksa koneksi.",
      );
    rev = (await r.json()).revision;
  } else {
    const save = () => {
      const current = JSON.parse(localStorage.getItem(storageKey) || "null");
      if ((current?.revision || 0) !== rev)
        throw Error("Buku berubah pada tab lain. Muat ulang terlebih dahulu.");
      localStorage.setItem(
        storageKey,
        JSON.stringify({ revision: rev + 1, book: payload }),
      );
      rev++;
    };
    if (navigator.locks) await navigator.locks.request(storageKey, save);
    else save();
  }
}
async function change(fn) {
  if (writing) throw Error("Tunggu hingga penyimpanan selesai.");
  writing = true;
  try {
    const next = structuredClone(book);
    fn(next);
    validate(next);
    await writeBook(next);
    book = next;
    render();
  } finally {
    writing = false;
  }
}
function setPin() {
  modal(
    "Kunci PIN",
    f(
      "PIN baru (4–12 angka)",
      "pin",
      "",
      "password",
      [],
      'inputmode="numeric" pattern="[0-9]{4,12}" required autocomplete="new-password"',
    ) +
      f(
        "Ulangi PIN",
        "confirm",
        "",
        "password",
        [],
        'required autocomplete="new-password"',
      ) +
      note(
        "PIN mengenkripsi buku dan diperlukan setiap kali dibuka. Simpan PIN di tempat aman untuk dapat memulihkan cadangan.",
      ),
    async (v) => {
      if (v.pin !== v.confirm) throw Error("Kedua PIN berbeda.");
      const old = [sessionKey, salt];
      salt = crypto.getRandomValues(new Uint8Array(16));
      try {
        sessionKey = await keyFor(v.pin, salt);
        await change(() => {});
      } catch (e) {
        [sessionKey, salt] = old;
        throw e;
      }
    },
  );
}
let serverMode = "cloud";
const modeLabel = () =>
  !cloud
    ? "Buku pribadi di browser ini"
    : serverMode === "desktop"
      ? "Buku lokal di komputer ini"
      : "Buku pribadi tersinkron";
const portable =
  location.protocol === "file:" ||
  document.documentElement.dataset.portable === "true";
async function start(nextMode = localStorage.getItem("myuang.mode") || "demo") {
  if (has()) close();
  sessionKey = null;
  salt = null;
  locked = null;
  book = null;
  chatId = "";
  planView = "";
  filters = {};
  page = "Ringkasan";
  rev = 0;
  mode = nextMode;
  cloud = !portable;
  storageKey = "myuang.v1." + mode;
  $("#app").innerHTML =
    '<main class="emptyhero"><h1>MyUang</h1><p>Membuka buku…</p></main>';
  try {
    let raw = null,
      name = "";
    if (cloud && mode === "personal") {
      const r = await fetch("/api/book", { cache: "no-store" });
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Masuk ke situs dengan akun pemilik untuk membuka buku pribadi."
            : "Buku pribadi belum dapat dimuat. Periksa koneksi dan coba lagi.",
        );
      const d = await r.json();
      serverMode = d.mode || "cloud";
      rev = d.revision;
      raw = d.book;
      name = d.name || "";
    } else {
      const d = JSON.parse(localStorage.getItem(storageKey) || "null");
      rev = d?.revision || 0;
      raw = d?.book;
    }
    localStorage.setItem("myuang.mode", mode);
    if (raw?.vault) {
      locked = raw;
      $("#app").innerHTML =
        '<main class="emptyhero"><h1>MyUang</h1><p>Buku terkunci.</p><button id="unlockbtn">Masukkan PIN</button></main>';
      const unlock = () =>
        modal(
          "Buka buku MyUang",
          f(
            "PIN",
            "pin",
            "",
            "password",
            [],
            'required inputmode="numeric" autocomplete="current-password"',
          ),
          async (v) => {
            const d = await decryptBook(raw, v.pin);
            validate(d.data);
            sessionKey = d.key;
            salt = d.s;
            book = d.data;
            await ready(false);
          },
          "Buka",
        );
      $("#unlockbtn").onclick = unlock;
      unlock();
      return;
    }
    book = raw || (mode === "demo" ? F.sample() : F.blank(name));
    validate(book);
    await ready(!raw);
  } catch (e) {
    book = null;
    $("#app").innerHTML =
      '<main class="emptyhero"><h1>MyUang</h1><p>' +
      esc(e.message) +
      '</p><p class="actions" style="justify-content:center;margin-top:16px"><button id="retrybook">Coba lagi</button><button id="samplebook">Buka demo</button></p></main>';
    $("#retrybook").onclick = () => start(mode);
    $("#samplebook").onclick = () => start("demo");
  }
}
async function ready(isNew) {
  const initial = structuredClone(book);
  const count = F.dueRules(initial);
  if (
    isNew ||
    count ||
    JSON.stringify(initial.rules) !== JSON.stringify(book.rules)
  ) {
    await writeBook(initial);
    book = initial;
  }
  const p = F.active(book);
  range = p ? [p.start, p.end] : F.month(today);
  render();
  if (count) toast(count + " transaksi terjadwal dicatat.");
  if (
    mode === "personal" &&
    cloud &&
    book.positions.length &&
    book.quotesDate !== today
  )
    refreshPrices(false).catch(() => {});
}
async function switchBook() {
  await start(mode === "demo" ? "personal" : "demo");
}
setInterval(async () => {
  if (!book || writing) return;
  const now = F.day();
  if (now !== today) {
    today = now;
    await change((b) => F.dueRules(b, today)).catch((e) => toast(e.message));
    if (cloud && mode === "personal" && book.positions.length)
      refreshPrices(false).catch(() => {});
  }
  const t = new Date(),
    hr =
      String(t.getHours()).padStart(2, "0") +
      ":" +
      String(t.getMinutes()).padStart(2, "0"),
    k = storageKey + ".reminded";
  if (
    book.prefs.reminder &&
    hr >= book.prefs.reminder &&
    localStorage.getItem(k) !== today
  ) {
    toast("Waktunya memeriksa catatan keuangan hari ini.");
    localStorage.setItem(k, today);
  }
}, 30000);
if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker.register("./myuang-sw.js").catch(() => {});
start();
