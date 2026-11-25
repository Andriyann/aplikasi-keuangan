"use strict";
const kinds = {
  wallet: "wallets",
  tx: "tx",
  plan: "plans",
  goal: "goals",
  asset: "assets",
  debt: "debts",
  invest: "positions",
  rule: "rules",
  bill: "bills",
  chat: "chats",
};
let submitFn,
  afterForm,
  toastTimer,
  wizardDraft = null,
  ocrWorker = null;
const note = (s) => '<p class="subline wide">' + esc(s) + "</p>";
const f = (l, n, v = "", type = "text", opts = [], extra = "") =>
  field(l, n, v, type, opts, extra);
const req = (l, n, v = "", type = "text") =>
  f(l, n, v, type, [], 'required maxlength="180"');
const sel = (l, n, v, opts) => f(l, n, v, "select", opts, "required");
const amount = (l, n, v = "", positive = true) =>
  f(
    l,
    n,
    v,
    "text",
    [],
    'inputmode="decimal" required maxlength="40" placeholder="0"',
  );
const positive = (v) => {
  const n = F.calc(v);
  if (n <= 0) throw Error("Nominal harus lebih besar dari nol.");
  return n;
};
const units = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e14)
    throw Error("Jumlah unit tidak valid.");
  return n;
};
const unitInput = (l, n, v) =>
  f(l, n, v, "number", [], 'required min="0" max="100000000000000" step="any"');
const walletOptions = () => {
  if (!book.wallets.length)
    throw Error("Tambahkan dompet terlebih dahulu di menu Dompet.");
  return ws();
};
const allGroups = () => [
  ...new Set([...F.groups, ...Object.values(book.categories)]),
];
const expcats = () => Object.keys(book.categories);
const has = () => $("#modal").open;
const close = () => {
  if (has()) $("#modal").close();
  submitFn = null;
};
function toast(s) {
  clearTimeout(toastTimer);
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
function modal(title, html, fn = null, button = "Simpan", setup = null) {
  const d = $("#modal");
  submitFn = fn;
  $("#dialogBody").innerHTML =
    '<div class="sectionhead"><h2>' +
    esc(T(title)) +
    "</h2>" +
    act("close", icon("close"), "icon") +
    "</div>" +
    (fn
      ? '<form id="modalform"><div class="formgrid">' +
        html +
        '</div><p class="err" role="alert"></p><div class="footer">' +
        txt("close", "Batal") +
        '<button class="primary" type="submit">' +
        esc(T(button)) +
        "</button></div></form>"
      : html + '<p class="err" role="alert"></p>');
  d.querySelector('[data-a="close"]').setAttribute("aria-label", "Tutup");
  if (!d.open) d.showModal();
  if (setup) setup();
}
function addOrEdit(b, k, id, data) {
  const rows = b[kinds[k]];
  if (id) {
    const current = rows.find((x) => x.id === id);
    if (!current) throw Error("Catatan sudah berubah.");
    Object.assign(current, data);
  } else rows.push({ id: F.id(), ...data });
}
const inp = (n) => $('#modalform [name="' + n + '"]');
function selectChoices(el, opts, selected) {
  el.innerHTML = opts
    .map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, T(o)];
      return (
        '<option value="' +
        esc(v) +
        '" ' +
        (selected === v ? "selected" : "") +
        ">" +
        esc(l) +
        "</option>"
      );
    })
    .join("");
}
function txForm(id = "", seed = {}) {
  const opts = walletOptions(),
    x = id ? book.tx.find((t) => t.id === id) : seed;
  modal(
    id ? "Ubah transaksi" : "Tambah transaksi",
    sel("Jenis", "type", x.type || "expense", [
      ["expense", "Pengeluaran"],
      ["income", "Pemasukan"],
      ["transfer", "Transfer"],
    ]) +
      req("Tanggal", "date", x.date || today, "date") +
      amount("Nominal", "amount", x.amount) +
      sel("Dompet asal", "wallet", x.wallet || opts[0][0], opts) +
      sel("Dompet tujuan", "to", x.to || opts[1]?.[0], opts) +
      amount("Biaya transfer", "fee", x.fee || 0) +
      sel("Kategori", "category", x.category, expcats()) +
      f(
        "Subkategori",
        "sub",
        x.sub || "",
        "text",
        [],
        'list="sublist" maxlength="100"',
      ) +
      '<datalist id="sublist"></datalist>' +
      f("Tag (pisahkan koma)", "tags", x.tags || "") +
      f("Catatan", "note", x.note || "") +
      note(
        "Kolom nominal menerima hitungan seperti 25000+5000. Masukkan angka tanpa pemisah ribuan.",
      ),
    async (v) => {
      if (v.type === "transfer" && v.wallet === v.to)
        throw Error("Pilih dua dompet yang berbeda.");
      await change((b) => {
        addOrEdit(b, "tx", id, {
          ...F.entry(),
          ...v,
          id: id || F.id(),
          amount: positive(v.amount),
          fee: v.type === "transfer" ? F.calc(v.fee) : 0,
          category: v.type === "transfer" ? "Transfer" : v.category,
          to: v.type === "transfer" ? v.to : "",
          sub: v.type === "transfer" ? "" : v.sub,
        });
        if (seed.inboxId)
          b.inbox = b.inbox.filter((i) => i.id !== seed.inboxId);
      });
    },
    "Simpan",
    () => {
      const update = () => {
        const transfer = inp("type").value === "transfer";
        for (const n of ["to", "fee"]) {
          inp(n).closest("label").hidden = !transfer;
          inp(n).disabled = !transfer;
        }
        for (const n of ["category", "sub"]) {
          inp(n).closest("label").hidden = transfer;
          inp(n).disabled = transfer;
        }
        selectChoices(
          inp("category"),
          inp("type").value === "income" ? book.incomeCats : expcats(),
          x.category,
        );
        subs();
      };
      const subs = () => {
        $("#sublist").innerHTML = (book.subs?.[inp("category").value] || [])
          .map((z) => '<option value="' + esc(z) + '">')
          .join("");
      };
      inp("type").onchange = update;
      inp("category").onchange = subs;
      update();
    },
  );
}
function record(kind, id = "") {
  const x = book[kinds[kind]].find((t) => t.id === id) || {},
    p = (label, key, def = "") => req(label, key, x[key] ?? def),
    d = (label, key, def = today) => req(label, key, x[key] || def, "date");
  let title, html, read;
  if (kind === "wallet") {
    title = "Dompet";
    html =
      p("Nama dompet", "name") +
      sel("Jenis", "type", x.type, [
        "Tunai",
        "Bank",
        "E-wallet",
        "Tabungan",
        "Kartu kredit",
        "PayLater",
      ]) +
      amount("Saldo awal / tagihan awal", "opening", Math.abs(x.opening || 0)) +
      note(
        "Untuk kartu kredit dan PayLater, nominal awal adalah tagihan yang belum dibayar.",
      );
    read = (v) => ({
      ...v,
      opening: F.calc(v.opening) * (F.isCredit(v) ? -1 : 1),
    });
  }
  if (kind === "asset") {
    title = "Aset";
    html =
      p("Nama aset", "name") +
      sel("Kelompok", "type", x.type, ["Likuid", "Tetap"]) +
      amount("Nilai taksiran", "value", x.value) +
      f("Catatan", "note", x.note) +
      note(
        "Masukkan aset yang belum dicatat sebagai dompet atau investasi agar kekayaan bersih tidak terhitung dua kali.",
      );
    read = (v) => ({ ...v, value: positive(v.value) });
  }
  if (kind === "goal") {
    title = "Goal";
    html =
      p("Nama tujuan", "name") +
      amount("Target dana", "amount", x.amount) +
      amount("Dana awal yang sudah disisihkan", "opening", x.opening || 0) +
      d("Tenggat", "due", F.shiftMonth(today, 6)) +
      sel("Dompet tabungan", "wallet", x.wallet, walletOptions()) +
      note(
        "Setoran berikutnya membuat transfer dari dompet sumber ke dompet tabungan.",
      );
    read = (v) => ({
      ...v,
      amount: positive(v.amount),
      opening: F.calc(v.opening),
    });
  }
  if (kind === "debt" || kind === "bill") {
    title = kind === "bill" ? "Tagihan" : "Utang / piutang";
    html =
      p("Nama catatan", "name") +
      (kind === "debt"
        ? sel("Jenis", "type", x.type, ["Utang", "Piutang"]) +
          p("Pihak terkait", "party")
        : "") +
      amount("Jumlah awal", "amount", x.amount) +
      d("Jatuh tempo", "due") +
      note(
        kind === "debt"
          ? "Pokok awal merupakan saldo utang/piutang yang sudah ada. Cicilan mengubah saldo dompet dan sisa pokok."
          : "Pembayaran membuat transaksi pengeluaran di dompet yang dipilih.",
      );
    read = (v) => {
      const total = positive(v.amount);
      if (total < F.targetPaid(book, x))
        throw Error("Jumlah lebih kecil dari pembayaran tercatat.");
      if (id && F.targetPaid(book, x) && v.type !== x.type)
        throw Error("Jenis sudah memiliki pembayaran.");
      return { ...v, amount: total };
    };
  }
  if (kind === "invest") {
    title = "Instrumen investasi";
    html =
      p("Nama instrumen", "name") +
      sel("Kelas aset", "type", x.type, [
        "Deposito",
        "Reksa dana",
        "Obligasi",
        "Saham",
        "ETF",
        "Kripto",
        "Emas",
        "Valuta asing",
      ]) +
      p("Simbol / kode", "symbol") +
      unitInput("Unit awal", "qty", x.qty || 0) +
      amount("Harga perolehan awal per unit", "cost", x.cost || 0) +
      amount("Harga terakhir per unit", "price", x.price) +
      d("Tanggal harga", "asof") +
      note(
        "Posisi awal adalah kepemilikan yang sudah ada. Gunakan Beli / jual untuk transaksi berikutnya.",
      );
    read = (v) => {
      if (
        id &&
        book.trades.some((t) => t.position === id) &&
        (Number(v.qty) !== x.qty || F.calc(v.cost) !== x.cost)
      )
        throw Error("Posisi awal sudah memiliki riwayat beli / jual.");
      return {
        ...v,
        symbol: v.symbol.trim().toUpperCase(),
        qty: units(v.qty),
        cost: F.calc(v.cost),
        price: positive(v.price),
      };
    };
  }
  if (kind === "rule") {
    title = "Automasi";
    const opts = walletOptions();
    html =
      p("Nama jadwal", "name") +
      sel("Jenis", "type", x.type, [
        ["expense", "Pengeluaran"],
        ["income", "Pemasukan"],
        ["transfer", "Transfer"],
      ]) +
      amount("Nominal", "amount", x.amount) +
      sel("Dompet", "wallet", x.wallet, opts) +
      sel("Dompet tujuan", "to", x.to || opts[1]?.[0], opts) +
      amount("Biaya transfer", "fee", x.fee || 0) +
      sel("Kategori", "category", x.category, expcats()) +
      sel("Berulang", "every", x.every, ["Bulanan", "Mingguan", "Harian"]) +
      d("Jadwal berikut", "next") +
      f("Berakhir (opsional)", "end", x.end, "date") +
      note("Transaksi yang jatuh tempo dibuat satu kali ketika buku dibuka.");
    read = (v) => {
      if (v.end && v.end < v.next)
        throw Error("Tanggal akhir lebih awal dari jadwal.");
      if (v.type === "transfer" && v.to === v.wallet)
        throw Error("Pilih dua dompet berbeda.");
      return {
        ...v,
        to: v.type === "transfer" ? v.to : "",
        fee: v.type === "transfer" ? F.calc(v.fee) : 0,
        category: v.type === "transfer" ? "Transfer" : v.category,
        amount: positive(v.amount),
        enabled: x.enabled ?? true,
        anchor: F.date(v.next).getDate(),
      };
    };
  }
  modal(
    (id ? "Ubah " : "Tambah ") + title,
    html,
    async (v) => {
      if (v.name && !v.name.trim()) throw Error("Nama wajib diisi.");
      const data = read(v);
      if (
        kind === "wallet" &&
        book.wallets.some(
          (w) =>
            w.id !== id && w.name.toLowerCase() === v.name.trim().toLowerCase(),
        )
      )
        throw Error("Nama dompet sudah digunakan.");
      await change((b) => {
        addOrEdit(b, kind, id, data);
        if (kind === "rule") F.dueRules(b);
      });
    },
    "Simpan",
    kind === "rule"
      ? () => {
          const swap = () => {
            const transfer = inp("type").value === "transfer";
            for (const n of ["to", "fee", "category"]) {
              const el = inp(n);
              el.disabled = n === "category" ? transfer : !transfer;
              el.closest("label").hidden = el.disabled;
            }
            selectChoices(
              inp("category"),
              inp("type").value === "income" ? book.incomeCats : expcats(),
              x.category,
            );
          };
          inp("type").onchange = swap;
          swap();
        }
      : null,
  );
}
function wizard(id = "", copy = false) {
  const src = book.plans.find((x) => x.id === id),
    start = src ? (copy ? F.plus(src.end, 1) : src.start) : F.month(today)[0],
    end = src
      ? copy
        ? F.plus(F.shiftMonth(start, 1), -1)
        : src.end
      : F.month(today)[1];
  wizardDraft = {
    id: copy ? "" : id,
    step: 0,
    name: src?.name || "Budget bulanan",
    start,
    end,
    income: src?.income || 0,
    mode: src?.mode || "Persentase",
    alloc: {
      ...(src?.alloc || { Kebutuhan: 50, Keinginan: 30, Tabungan: 20 }),
    },
  };
  wizardStep();
}
function wizardStep() {
  const w = wizardDraft,
    steps = [
      "Nama budget",
      "Periode",
      "Metode alokasi",
      "Pendapatan rencana",
      "Alokasi tiap pos",
      "Periksa budget",
    ];
  let html = "";
  switch (w.step) {
    case 0:
      html = req("Nama", "name", w.name);
      break;
    case 1:
      html =
        req("Tanggal mulai", "start", w.start, "date") +
        req("Tanggal akhir", "end", w.end, "date");
      break;
    case 2:
      html = sel("Metode", "mode", w.mode, ["Persentase", "Nominal tetap"]);
      break;
    case 3:
      html = amount("Pendapatan rencana", "income", w.income);
      break;
    case 4:
      html = allGroups()
        .map((g, i) =>
          amount(
            g + (w.mode === "Persentase" ? " (%)" : ""),
            "g" + i,
            w.alloc[g] || 0,
          ),
        )
        .join("");
      break;
    case 5:
      html =
        '<div class="wide"><b>' +
        esc(w.name) +
        "</b><p>" +
        fmt(w.start, true) +
        " – " +
        fmt(w.end, true) +
        "</p><p>" +
        esc(w.mode) +
        " · " +
        money(w.income) +
        "</p>" +
        Object.entries(w.alloc)
          .map(
            ([g, v]) =>
              "<p>" +
              esc(g) +
              " · " +
              (w.mode === "Persentase" ? v + "% · " : "") +
              money(F.limit(w, g)) +
              "</p>",
          )
          .join("") +
        "</div>";
      break;
  }
  modal(
    "Budget · " + (w.step + 1) + "/6",
    note(steps[w.step]) +
      html +
      (w.step
        ? '<div class="wide">' + txt("backwizard", "Kembali", "link") + "</div>"
        : ""),
    async (v) => {
      if (w.step === 1) {
        if (v.end < v.start) throw Error("Tanggal akhir lebih awal.");
        if (
          book.plans.some(
            (p) => p.id !== w.id && p.start <= v.end && p.end >= v.start,
          )
        )
          throw Error("Periode bertumpang tindih dengan budget lain.");
      }
      if (w.step === 3) v.income = positive(v.income);
      if (w.step === 4) {
        const alloc = Object.fromEntries(
          allGroups().map((g, i) => [g, F.calc(v["g" + i])]),
        );
        if (
          w.mode === "Persentase" &&
          Math.abs(Object.values(alloc).reduce((a, b) => a + b, 0) - 100) >
            0.001
        )
          throw Error("Total persentase harus 100%.");
        w.alloc = alloc;
      } else Object.assign(w, v);
      if (w.step < 5) {
        w.step++;
        wizardStep();
        return false;
      }
      const { step, id, ...p } = w;
      await change((b) => addOrEdit(b, "plan", id, p));
      planView = id || book.plans.at(-1).id;
      render();
    },
    w.step === 5 ? "Simpan" : "Lanjut",
  );
}
function pay(id) {
  const x = [...book.debts, ...book.bills].find((x) => x.id === id);
  const isBill = book.bills.some((b) => b.id === id),
    max = F.remaining(book, x);
  modal(
    x.type === "Piutang" ? "Terima cicilan" : "Bayar tagihan / cicilan",
    note(x.name + " · Sisa " + money(max)) +
      sel("Dompet", "wallet", "", walletOptions()) +
      amount("Nominal", "amount", max) +
      req("Tanggal", "date", today, "date"),
    async (v) => {
      const amt = positive(v.amount);
      if (amt > max + 0.00001) throw Error("Pembayaran melebihi sisa pokok.");
      await change((b) =>
        b.tx.push(
          F.entry({
            ...v,
            amount: amt,
            type: isBill
              ? "expense"
              : x.type === "Piutang"
                ? "capitalIn"
                : "capitalOut",
            category: isBill ? "Tagihan" : "Pokok utang/piutang",
            note: x.name,
            ref: id,
          }),
        ),
      );
    },
  );
}
function trade(id) {
  const p = book.positions.find((p) => p.id === id);
  modal(
    "Catat beli / jual",
    sel("Transaksi", "side", "Beli", ["Beli", "Jual"]) +
      unitInput("Jumlah unit", "qty", "") +
      amount("Harga per unit", "price", p.price) +
      amount("Biaya", "fee", 0) +
      sel("Dompet penyelesaian", "wallet", "", walletOptions()) +
      req("Tanggal", "date", today, "date"),
    async (v) => {
      const qty = units(v.qty),
        price = positive(v.price),
        fee = F.calc(v.fee),
        value = qty * price + (v.side === "Beli" ? fee : -fee);
      if (qty <= 0 || value <= 0)
        throw Error("Periksa unit dan biaya transaksi.");
      if (book.trades.some((t) => t.position === id && t.date > v.date))
        throw Error(
          "Tanggal harus sama atau sesudah transaksi terakhir instrumen.",
        );
      if (v.side === "Jual" && qty > F.holding(book, p).qty + 1e-9)
        throw Error("Unit yang dijual melebihi kepemilikan.");
      await change((b) => {
        const tradeId = F.id();
        b.trades.push({ ...v, id: tradeId, position: id, qty, price, fee });
        b.tx.push(
          F.entry({
            date: v.date,
            wallet: v.wallet,
            type: v.side === "Beli" ? "capitalOut" : "capitalIn",
            amount: value,
            trade: tradeId,
            category: "Investasi",
            note: v.side + " " + p.name,
          }),
        );
        if (v.date >= p.asof) {
          const position = b.positions.find((x) => x.id === id);
          position.price = price;
          position.asof = v.date;
        }
      });
    },
  );
}
async function remove(kind, id) {
  const x = book[kinds[kind]].find((x) => x.id === id);
  if (!x) return;
  modal(
    "Hapus catatan",
    note(x.name || x.note || "Transaksi") +
      note("Catatan ini akan dihapus dari buku aktif."),
    async () => {
      if (
        kind === "wallet" &&
        (book.tx.some((t) => t.wallet === id || t.to === id) ||
          [...book.goals, ...book.rules].some(
            (y) => y.wallet === id || y.to === id,
          ))
      )
        throw Error(
          "Dompet masih digunakan oleh transaksi, goal, atau automasi.",
        );
      if (
        ["goal", "debt", "bill"].includes(kind) &&
        book.tx.some((t) => t.ref === id)
      )
        throw Error("Masih ada setoran atau pembayaran yang terhubung.");
      if (kind === "invest" && book.trades.some((t) => t.position === id))
        throw Error("Masih ada transaksi pada instrumen ini.");
      if (kind === "tx" && x.trade)
        throw Error("Transaksi terhubung ke portofolio.");
      await change((b) => {
        b[kinds[kind]] = b[kinds[kind]].filter((t) => t.id !== id);
      });
    },
    "Hapus",
  );
}
function prefs() {
  const p = book.prefs;
  modal(
    "Pengaturan profil",
    f("Nama", "name", p.name) +
      sel("Tema", "theme", p.theme, ["Terang", "Gelap"]) +
      sel("Warna", "accent", p.accent, ["Violet", "Neon", "Pastel"]) +
      sel("Bahasa", "language", p.language, [
        ["id", "Indonesia"],
        ["en", "English"],
      ]) +
      sel("Mata uang", "currency", p.currency, [
        "IDR",
        "USD",
        "SGD",
        "MYR",
        "THB",
        "PHP",
        "VND",
        "JPY",
        "CNY",
        "KRW",
        "EUR",
        "GBP",
      ]) +
      note(
        "Setiap buku menggunakan satu mata uang. Ubah mata uang sebelum mencatat saldo atau transaksi.",
      ),
    async (v) => {
      if (
        v.currency !== p.currency &&
        [
          book.tx,
          book.wallets,
          book.assets,
          book.debts,
          book.positions,
          book.goals,
          book.plans,
          book.bills,
          book.rules,
        ].some((a) => a.length)
      )
        throw Error("Buku sudah berisi nominal. Gunakan mata uang yang sama.");
      await change((b) => Object.assign(b.prefs, v));
    },
  );
}
function category(key) {
  modal(
    "Kategori & subkategori",
    req("Nama kategori", "name", key) +
      req("Pos budget", "group", book.categories[key] || "Kebutuhan") +
      f(
        "Subkategori (pisahkan koma)",
        "subs",
        (book.subs?.[key] || []).join(", "),
      ) +
      note("Nama pos baru akan tersedia saat mengatur budget."),
    async (v) => {
      const name = v.name.trim(),
        group = v.group.trim();
      if (
        !name ||
        !group ||
        ["__proto__", "prototype", "constructor"].includes(name) ||
        ["__proto__", "prototype", "constructor"].includes(group)
      )
        throw Error("Nama tidak valid.");
      if (name !== key && Object.hasOwn(book.categories, name))
        throw Error("Kategori sudah ada.");
      if (key === "Biaya transfer" && name !== key)
        throw Error("Nama kategori biaya transfer dipakai otomatis.");
      await change((b) => {
        b.subs ||= {};
        if (key && name !== key) {
          delete b.categories[key];
          delete b.subs[key];
          for (const t of [...b.tx, ...b.rules])
            if (t.category === key) t.category = name;
        }
        b.categories[name] = group;
        b.subs[name] = [
          ...new Set(
            v.subs
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ];
      });
    },
  );
}
function bulk() {
  modal(
    "Tambah banyak transaksi",
    sel("Dompet", "wallet", "", walletOptions()) +
      sel("Jenis", "type", "expense", [
        ["expense", "Pengeluaran"],
        ["income", "Pemasukan"],
      ]) +
      req("Tanggal", "date", today, "date") +
      f(
        "Satu baris per transaksi",
        "lines",
        "",
        "textarea",
        [],
        'required placeholder="Makan siang;25000;Makan & minum"',
      ) +
      note(
        "Format tiap baris: catatan;nominal;kategori. Semua baris diperiksa sebelum disimpan.",
      ),
    async (v) => {
      const cats = v.type === "income" ? book.incomeCats : expcats(),
        rows = v.lines
          .trim()
          .split(/\r?\n/)
          .map((line, i) => {
            const [note, amt, cat, ...rest] = line
              .split(";")
              .map((s) => s.trim());
            if (rest.length || !note || !cats.includes(cat))
              throw Error(
                "Periksa kategori atau format pada baris " + (i + 1) + ".",
              );
            return F.entry({
              note,
              amount: positive(amt),
              category: cat,
              date: v.date,
              wallet: v.wallet,
              type: v.type,
            });
          });
      await change((b) => b.tx.push(...rows));
    },
  );
}
function inbox() {
  modal(
    "Kotak masuk",
    book.inbox
      .map((x) =>
        row(
          "Transaksi",
          x.note,
          "Draf dari struk",
          "<b>" + money(x.amount) + "</b>",
          txt("acceptDraft", "Periksa", "smallbtn", x.id) +
            txt("dropDraft", "Buang", "smallbtn", x.id),
        ),
      )
      .join("") || empty("Belum ada draf hasil scan."),
  );
}
function getScript(url) {
  return new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = url;
    el.onload = ok;
    el.onerror = () => no(Error("Aset gagal dimuat. Periksa berkas aplikasi."));
    document.head.append(el);
  });
}
function parseReceipt(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (
      /(?:subtotal|sub total|^total|tunai|change|cash|kembali|bayar|grand total|debit|kredit)/i.test(
        line.trim(),
      )
    )
      continue;
    const m = line
      .trim()
      .match(/^(.+?[a-zA-Z].*?)\s+(?:rp\.?\s*)?([0-9][\d., ]*)$/i);
    if (!m) continue;
    let v = m[2].trim().replace(/\s/g, "");
    if (book.prefs.currency === "IDR")
      v = v.replace(/[.,]00$/, "").replace(/[.,]/g, "");
    else v = v.replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
    if (Number(v) > 0) rows.push(m[1].trim() + ";" + Number(v));
  }
  return rows.join("\n");
}
function scanner() {
  modal(
    "Scan struk",
    f("Foto struk", "photo", "", "file", [], 'accept="image/*"') +
      '<div class="wide">' +
      txt("readPhoto", "Baca foto") +
      ' <span id="ocrstatus" class="subline"></span></div>' +
      f(
        "Item hasil baca",
        "items",
        "",
        "textarea",
        [],
        'placeholder="Nama item;nominal"',
      ) +
      note(
        "Periksa setiap item dan total terhadap struk. Baris yang disimpan masuk ke kotak masuk untuk dikategorikan.",
      ),
    async (v) => {
      let items = v.items
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, i) => {
          let parts = line.split(";");
          if (parts.length !== 2 || !parts[0].trim())
            throw Error("Periksa baris " + (i + 1) + ".");
          return {
            id: F.id(),
            note: parts[0].trim(),
            amount: positive(parts[1]),
          };
        });
      if (!items.length)
        throw Error(
          "Belum ada item. Pilih foto atau masukkan item secara manual.",
        );
      await change((b) => b.inbox.push(...items));
    },
    "Simpan draf",
  );
}
async function readPhoto() {
  const file = inp("photo").files[0];
  if (!file) throw Error("Pilih foto struk terlebih dahulu.");
  if (location.protocol === "file:")
    throw Error(
      "Jalankan MyUang melalui MULAI atau localhost untuk memindai foto.",
    );
  if (file.size > 15e6) throw Error("Gunakan foto di bawah 15 MB.");
  const status = $("#ocrstatus"),
    field = inp("items");
  if (!window.Tesseract) await getScript("./vendor/ocr/tesseract.min.js");
  const base = new URL("./vendor/ocr/", location.href).href;
  status.textContent = "Membaca gambar…";
  const worker = await Tesseract.createWorker("ind+eng", 1, {
    workerPath: base + "worker.min.js",
    corePath: base + "tesseract-core-lstm.js",
    langPath: base,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text")
        status.textContent = Math.round(m.progress * 100) + "%";
    },
  });
  try {
    const r = await worker.recognize(file);
    field.value = parseReceipt(r.data.text);
    status.textContent = field.value
      ? "Periksa hasil di bawah."
      : "Item belum terbaca. Periksa hasil mentah atau isi manual.";
    const raw = document.createElement("details");
    const label = document.createElement("summary");
    label.textContent = "Teks hasil OCR";
    const pre = document.createElement("p");
    pre.textContent = r.data.text;
    raw.append(label, pre);
    status.after(raw);
  } finally {
    await worker.terminate();
  }
}
function dl(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function exporter() {
  modal(
    "Ekspor laporan",
    sel("Format", "format", "Excel", ["Excel", "CSV"]) +
      sel("Data", "data", "Transaksi", [
        "Transaksi",
        "Dompet",
        "Budget",
        "Goals",
        "Aset",
        "Utang & piutang",
        "Investasi",
        "Semua lembar",
      ]) +
      req("Mulai (transaksi)", "start", range[0], "date") +
      req("Sampai (transaksi)", "end", range[1], "date"),
    async (v) => {
      if (v.end < v.start) throw Error("Periksa rentang tanggal.");
      const sheets = {
        Transaksi: [
          [
            "Tanggal",
            "Jenis",
            "Dompet",
            "Tujuan",
            "Kategori",
            "Subkategori",
            "Nominal",
            "Biaya",
            "Tag",
            "Catatan",
          ],
          ...F.periodRows(book, v.start, v.end).map((t) => [
            t.date,
            typeNames[t.type],
            walletName(t.wallet),
            t.to ? walletName(t.to) : "",
            t.category,
            t.sub,
            t.amount,
            t.fee || 0,
            t.tags,
            t.note,
          ]),
        ],
        Dompet: [
          ["Dompet", "Jenis", "Saldo"],
          ...book.wallets.map((w) => [w.name, w.type, F.balance(book, w)]),
        ],
        Budget: [
          ["Periode", "Awal", "Akhir", "Pos", "Alokasi", "Terpakai"],
          ...book.plans.flatMap((p) =>
            Object.keys(p.alloc).map((g) => [
              p.name,
              p.start,
              p.end,
              g,
              F.limit(p, g),
              F.stats(book, p.start, p.end).byGroup[g] || 0,
            ]),
          ),
        ],
        Goals: [
          ["Nama", "Tenggat", "Target", "Terkumpul"],
          ...book.goals.map((x) => [
            x.name,
            x.due,
            x.amount,
            x.opening + F.targetPaid(book, x),
          ]),
        ],
        Aset: [
          ["Nama", "Jenis", "Nilai"],
          ...book.assets.map((x) => [x.name, x.type, x.value]),
        ],
        "Utang & piutang": [
          ["Nama", "Jenis", "Pihak", "Jatuh tempo", "Pokok", "Sisa"],
          ...book.debts.map((x) => [
            x.name,
            x.type,
            x.party,
            x.due,
            x.amount,
            F.remaining(book, x),
          ]),
        ],
        Investasi: [
          ["Instrumen", "Kode", "Kelas", "Unit", "Harga", "Nilai", "Modal"],
          ...book.positions.map((x) => {
            const h = F.holding(book, x);
            return [x.name, x.symbol, x.type, h.qty, x.price, h.value, h.cost];
          }),
        ],
      };
      const names = v.data === "Semua lembar" ? Object.keys(sheets) : [v.data];
      if (v.format === "CSV") {
        if (names.length > 1)
          throw Error(
            "Pilih satu jenis data untuk CSV atau gunakan Excel untuk semua lembar.",
          );
        const csv = sheets[names[0]]
          .map((row) =>
            row
              .map(
                (x) =>
                  '"' +
                  String(
                    typeof x === "string" && /^[=+@\-\t\r]/.test(x)
                      ? "'" + x
                      : (x ?? ""),
                  ).replace(/"/g, '""') +
                  '"',
              )
              .join(","),
          )
          .join("\r\n");
        dl(
          new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
          "MyUang-" + names[0] + ".csv",
        );
      } else {
        if (!window.writeXlsxFile)
          await getScript("./vendor/excel/write-excel-file.min.js");
        const tables = names.map((n) =>
          sheets[n].map((row) =>
            row.map((value) => ({
              type: typeof value === "number" ? Number : String,
              value: value ?? "",
            })),
          ),
        );
        await writeXlsxFile(
          names.length === 1 ? tables[0] : tables,
          names.length === 1
            ? { sheet: names[0], fileName: "MyUang.xlsx" }
            : { sheets: names, fileName: "MyUang.xlsx" },
        );
      }
    },
    "Unduh",
  );
}
async function ask(q) {
  if (!q.trim()) throw Error("Tuliskan pertanyaan.");
  const s = F.stats(book, ...range);
  let answer;
  if (book.prefs.ai) {
    const r = await fetch("/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        summary: {
          currency: book.prefs.currency,
          start: range[0],
          end: range[1],
          income: s.inc,
          expenses: s.out,
          categories: s.cats,
        },
      }),
    });
    if (!r.ok)
      throw Error(
        "Model AI belum tersedia. Pilih analisis lokal di Profil → Pengaturan AI, atau konfigurasi kunci di server.",
      );
    answer = (await r.json()).answer;
  } else answer = localAnswer(q, s);
  await change((b) => {
    let c = b.chats.find((x) => x.id === chatId);
    if (!c) {
      c = { id: F.id(), name: q.slice(0, 48), date: today, messages: [] };
      b.chats.push(c);
      chatId = c.id;
    }
    if (!c.messages.length) c.name = q.slice(0, 48);
    c.messages.push(
      { role: "user", text: q },
      { role: "assistant", text: answer },
    );
  });
}
function applyPrices(b, data) {
  if (data.currency !== b.prefs.currency)
    throw Error("Mata uang sumber berbeda dari buku.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > today)
    throw Error("Tanggal harga tidak valid.");
  let n = 0;
  for (const p of b.positions) {
    const price = Number(data.prices[p.symbol]);
    if (Number.isFinite(price) && price > 0 && data.date >= p.asof) {
      p.price = price;
      p.asof = data.date;
      n++;
    }
  }
  if (!n) throw Error("Tidak ada harga baru yang cocok dengan kode instrumen.");
  b.quotesDate = data.date;
}
async function refreshPrices(manual = true) {
  if (!cloud) {
    if (manual)
      throw Error(
        "Gunakan impor harga CSV di versi perangkat. Feed harian tersedia pada server yang dikonfigurasi.",
      );
    return;
  }
  const r = await fetch("/api/prices");
  if (!r.ok) {
    if (manual)
      throw Error(
        "Feed harga belum tersedia. Kamu dapat mengimpor CSV atau mengubah harga per instrumen.",
      );
    return;
  }
  const data = await r.json();
  await change((b) => applyPrices(b, data));
  if (manual) toast("Harga diperbarui.");
}
const guide =
  "Mulai dari Dompet untuk menambahkan rekening atau uang tunai dan saldo awal. Pilih Tambah transaksi untuk mencatat pemasukan, pengeluaran, atau transfer dengan biaya.\n\nBudget memakai periode sendiri dan alokasi persentase atau nominal tetap. Goals mencatat transfer ke dompet tujuan. Tagihan serta utang/piutang menerima pembayaran penuh atau sebagian.\n\nAutomasi membuat transaksi yang jatuh tempo saat buku dibuka, termasuk jadwal yang terlewat. Investasi menghitung modal rata-rata dan kekayaan bersih dari posisi dan transaksi beli/jual. Harga bisa diubah manual, diimpor CSV, atau memakai feed harian yang dikonfigurasi pemilik server.\n\nScan struk berjalan pada perangkat. Periksa draf hasil OCR sebelum memasukkannya ke transaksi. Ekspor Excel/CSV tersedia di Laporan. Cadangan JSON dapat dibuat di Profil.\n\nPengingat tampil saat aplikasi terbuka. Untuk pemasangan di HP, buka situs melalui HTTPS, lalu pilih Install atau Tambah ke Layar Utama di menu browser.";
const openGuide = (title, body) =>
  modal(title, '<p class="guide">' + esc(body) + "</p>");
const go = (n) => {
  if (!config[n]) return;
  page = n;
  document.body.classList.remove("menuopen");
  render();
  window.scrollTo(0, 0);
};
async function action(k, id) {
  if (k === "close") {
    close();
    return;
  }
  if (k === "menu") {
    document.body.classList.toggle("menuopen");
    return;
  }
  if (k === "nav") {
    go(id);
    return;
  }
  if (k.startsWith("del-")) return remove(k.slice(4), id);
  if (k.startsWith("edit-")) {
    const kind = k.slice(5);
    return kind === "tx"
      ? txForm(id)
      : kind === "plan"
        ? wizard(id)
        : record(kind, id);
  }
  if (["wallet", "asset", "goal", "debt", "bill", "invest", "rule"].includes(k))
    return record(k);
  switch (k) {
    case "tx":
      if (!book.wallets.length) return record("wallet");
      return txForm();
    case "plan":
      return wizard();
    case "copyplan":
      return wizard(id, true);
    case "backwizard":
      wizardDraft.step--;
      return wizardStep();
    case "showArchive":
      showArchived = !showArchived;
      return render();
    case "archivePlan":
      return change((b) => {
        const p = b.plans.find((x) => x.id === id);
        p.archived = !p.archived;
        planView = "";
      });
    case "viewplan":
      planView = id;
      return render();
    case "bulk":
      return bulk();
    case "scan":
      return scanner();
    case "readPhoto":
      return readPhoto();
    case "inbox":
      return inbox();
    case "acceptDraft": {
      const x = book.inbox.find((x) => x.id === id);
      return txForm("", { ...x, inboxId: x.id });
    }
    case "dropDraft":
      await change((b) => {
        b.inbox = b.inbox.filter((x) => x.id !== id);
      });
      return inbox();
    case "prefs":
      return prefs();
    case "category":
      return category(id);
    case "incomeCat":
      return modal("Sumber pemasukan", req("Nama", "name"), async (v) => {
        const n = v.name.trim();
        if (!n || book.incomeCats.includes(n))
          throw Error("Gunakan nama baru.");
        await change((b) => b.incomeCats.push(n));
      });
    case "range":
      return modal(
        "Periode laporan",
        req("Tanggal mulai", "start", range[0], "date") +
          req("Tanggal akhir", "end", range[1], "date") +
          '<div class="wide actions">' +
          txt("quickrange", "Bulan ini", "smallbtn", "0") +
          txt("quickrange", "Bulan lalu", "smallbtn", "-1") +
          txt("quickrange", "Budget aktif", "smallbtn", "active") +
          "</div>",
        (v) => {
          if (v.end < v.start) throw Error("Periksa rentang tanggal.");
          range = [v.start, v.end];
          render();
        },
        "Terapkan",
      );
    case "quickrange": {
      const p = F.active(book);
      if (id === "active" && !p) throw Error("Belum ada budget aktif.");
      const v =
        id === "active"
          ? [p.start, p.end]
          : F.month(F.shiftMonth(today, Number(id)));
      inp("start").value = v[0];
      inp("end").value = v[1];
      return;
    }
    case "day":
      filters = { start: id, end: id };
      return go("Transaksi");
    case "filter":
      filters = Object.fromEntries(
        [...document.querySelectorAll("#filters input,#filters select")].map(
          (x) => [x.name, x.value],
        ),
      );
      if (filters.start && filters.end && filters.end < filters.start)
        throw Error("Periksa tanggal filter.");
      return render();
    case "clearfilter":
      filters = {};
      return render();
    case "adjust": {
      const w = book.wallets.find((x) => x.id === id);
      return modal(
        "Sesuaikan saldo",
        note(w.name + " · Saldo sekarang " + money(F.balance(book, w))) +
          f(
            "Saldo sebenarnya (boleh negatif)",
            "actual",
            F.balance(book, w),
            "number",
            [],
            'step="any" required',
          ) +
          f("Catatan", "note", "Penyesuaian saldo"),
        async (v) => {
          const diff = Number(v.actual) - F.balance(book, w);
          if (!Number.isFinite(diff) || !diff)
            throw Error("Masukkan saldo yang berbeda.");
          await change((b) =>
            b.tx.push(
              F.entry({
                wallet: id,
                type: diff > 0 ? "adjustUp" : "adjustDown",
                amount: Math.abs(diff),
                category: "Penyesuaian",
                note: v.note,
              }),
            ),
          );
        },
      );
    }
    case "cardpay": {
      const w = book.wallets.find((x) => x.id === id),
        opts = ws().filter(([k]) => k !== id);
      if (!opts.length) throw Error("Tambahkan dompet sumber pembayaran.");
      return txForm("", {
        type: "transfer",
        wallet: opts[0][0],
        to: id,
        amount: Math.max(0, -F.balance(book, w)),
        note: "Pembayaran " + w.name,
      });
    }
    case "move":
      return change((b) => {
        const i = b.wallets.findIndex((w) => w.id === id);
        if (i > 0)
          [b.wallets[i - 1], b.wallets[i]] = [b.wallets[i], b.wallets[i - 1]];
      });
    case "pay":
      return pay(id);
    case "trade":
      return trade(id);
    case "toggleRule":
      return change((b) => {
        const r = b.rules.find((x) => x.id === id);
        r.enabled = !r.enabled;
        if (r.enabled && r.next < today) r.next = today;
        F.dueRules(b);
      });
    case "contribute": {
      const g = book.goals.find((x) => x.id === id),
        opts = ws().filter(([i]) => i !== g.wallet);
      if (!opts.length)
        throw Error("Tambahkan dompet sumber yang berbeda dari dompet tujuan.");
      return modal(
        "Setor dana ke goal",
        sel("Dompet sumber", "wallet", "", opts) +
          amount("Nominal", "amount") +
          req("Tanggal", "date", today, "date") +
          note("Tujuan: " + walletName(g.wallet)),
        async (v) =>
          change((b) =>
            b.tx.push(
              F.entry({
                ...v,
                type: "transfer",
                to: g.wallet,
                amount: positive(v.amount),
                category: "Transfer",
                ref: id,
                note: "Setoran · " + g.name,
              }),
            ),
          ),
      );
    }
    case "avatar":
      return modal(
        "Ganti avatar",
        sel("Avatar", "avatar", book.prefs.avatar || "👤", [
          "👤",
          "🌿",
          "🦊",
          "🐼",
          "🌙",
          "☀️",
          "🐱",
          "🪴",
        ]),
        (v) =>
          change((b) => {
            b.prefs.avatar = v.avatar;
          }),
      );
    case "yield": {
      const p = book.positions.find((x) => x.id === id);
      return modal(
        "Catat imbal hasil",
        sel("Jenis pendapatan", "kind", "Bunga", [
          "Bunga",
          "Dividen",
          "Kupon",
          "Distribusi",
        ]) +
          sel("Dompet penerima", "wallet", "", walletOptions()) +
          amount("Nominal bersih", "amount") +
          req("Tanggal", "date", today, "date"),
        (v) =>
          change((b) => {
            b.tx.push(
              F.entry({
                date: v.date,
                wallet: v.wallet,
                type: "income",
                amount: positive(v.amount),
                category: v.kind,
                note: v.kind + " · " + p.name,
              }),
            );
            if (!b.incomeCats.includes(v.kind)) b.incomeCats.push(v.kind);
          }),
      );
    }
    case "price": {
      const x = book.positions.find((x) => x.id === id);
      return modal(
        "Ubah harga instrumen",
        amount("Harga per unit", "price", x.price) +
          req("Tanggal harga", "asof", today, "date"),
        async (v) =>
          change((b) =>
            Object.assign(
              b.positions.find((y) => y.id === id),
              { price: positive(v.price), asof: v.asof },
            ),
          ),
      );
    }
    case "refreshPrice":
      return refreshPrices();
    case "csvPrice":
      return modal(
        "Impor harga CSV",
        req("Tanggal harga", "date", today, "date") +
          f(
            "CSV kode,harga",
            "csv",
            "",
            "textarea",
            [],
            'required placeholder="BBCA,9500"',
          ) +
          note("Harga per unit dalam mata uang buku, tanpa pemisah ribuan."),
        async (v) => {
          const prices = {};
          for (const l of v.csv.trim().split(/\r?\n/)) {
            const [s, p, ...extra] = l.split(",");
            if (extra.length || !s || !p)
              throw Error("Format CSV tidak valid.");
            prices[s.trim().toUpperCase()] = positive(p);
          }
          await change((b) =>
            applyPrices(b, {
              date: v.date,
              currency: b.prefs.currency,
              prices,
            }),
          );
        },
      );
    case "theme":
      return change((b) => {
        b.prefs.theme = b.prefs.theme === "Gelap" ? "Terang" : "Gelap";
      });
    case "hide":
      return change((b) => {
        b.prefs.hidden = !b.prefs.hidden;
      });
    case "switch":
      return switchBook();
    case "export":
      return exporter();
    case "newchat":
      return change((b) => {
        const c = { id: F.id(), name: "Chat baru", date: today, messages: [] };
        b.chats.push(c);
        chatId = c.id;
        page = "Advisor";
      });
    case "openchat":
      chatId = id;
      return render();
    case "ask":
      return ask(id);
    case "reportAI":
      go("Advisor");
      return ask("Analisis laporan periode ini");
    case "aiPrefs":
      return modal(
        "Pengaturan AI",
        sel("Mode analisis", "ai", String(!!book.prefs.ai), [
          ["false", "Analisis lokal"],
          ["true", "Model AI eksternal"],
        ]) +
          note(
            "Mode eksternal mengirim pertanyaan dan ringkasan kategori, pemasukan, serta pengeluaran periode ke penyedia AI saat kamu mengirim pertanyaan. Memerlukan API key di server.",
          ),
        async (v) => {
          if (v.ai === "true" && !cloud)
            throw Error("Mode eksternal tersedia pada versi server.");
          await change((b) => {
            b.prefs.ai = v.ai === "true";
          });
        },
      );
    case "backup": {
      const out = sessionKey ? await seal(book) : book;
      dl(
        new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
        "MyUang-" + mode + "-" + today + ".json",
      );
      return;
    }
    case "restore":
      return modal(
        "Pulihkan cadangan",
        f(
          "File JSON MyUang",
          "file",
          "",
          "file",
          [],
          'accept=".json,application/json" required',
        ) +
          f("PIN cadangan (jika terenkripsi)", "backupPin", "", "password") +
          note("Isi buku yang sedang dibuka akan diganti dengan isi cadangan."),
        async (v) => {
          if (v.file.size > 3500000) throw Error("Cadangan terlalu besar.");
          let data = JSON.parse(await v.file.text());
          if (data.vault) data = (await decryptBook(data, v.backupPin)).data;
          validate(data);
          await change((b) => {
            for (const k of Object.keys(b)) delete b[k];
            Object.assign(b, data);
          });
        },
        "Ganti isi buku",
      );
    case "pin":
      return setPin();
    case "lock":
      return start(mode);
    case "guide":
      return openGuide("Tutorial MyUang", guide);
    case "changes":
      return openGuide(
        "Yang baru",
        "MyUang 1.0 menyatukan dompet, budget, target, aset, utang-piutang, investasi dan automasi. Modul lanjutan bisa dipakai langsung.",
      );
    case "reminder":
      return modal(
        "Pengingat harian",
        f(
          "Waktu pengingat (kosong untuk mati)",
          "time",
          book.prefs.reminder,
          "time",
        ) + note("Pengingat muncul saat MyUang terbuka pada perangkat ini."),
        async (v) =>
          change((b) => {
            b.prefs.reminder = v.time;
          }),
      );
    case "install":
      if (installEvent) {
        await installEvent.prompt();
        installEvent = null;
        return;
      }
      return openGuide(
        "Install MyUang",
        "Android / Chrome: buka menu browser, lalu Install aplikasi.\niPhone / Safari: Bagikan → Tambah ke Layar Utama.\nLaptop: gunakan ikon instalasi di bilah alamat browser. Fitur ini memerlukan HTTPS atau localhost.",
      );
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-a]");
  if (!b || writing) return;
  if (
    !b.closest("aside") &&
    document.body.classList.contains("menuopen") &&
    b.dataset.a !== "menu"
  )
    document.body.classList.remove("menuopen");
  b.disabled = true;
  try {
    await action(b.dataset.a, b.dataset.id);
  } catch (err) {
    const out = has() ? $("#dialogBody .err") : null;
    if (out) out.textContent = err.message;
    else toast(err.message);
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (writing) return;
  const form = e.target,
    btn =
      form.querySelector("[type=submit]") ||
      form.querySelector("button.primary");
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;
  try {
    const v = Object.fromEntries(new FormData(form));
    if (form.id === "modalform" && submitFn) {
      const fn = submitFn;
      const ok = await fn(v);
      if (ok !== false && submitFn === fn) {
        close();
        toast("Selesai");
      }
    }
    if (form.id === "askform") await ask(v.question);
  } catch (err) {
    const out = form.querySelector(".err");
    if (out) out.textContent = err.message;
    else toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
});
