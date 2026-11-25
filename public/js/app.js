"use strict";
const F = Finance,
  $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let book,
  mode = "demo",
  cloud = false,
  rev = 0,
  page = "Ringkasan",
  today = F.day(),
  range = F.month(today),
  filters = {},
  planView = "",
  chatId = "",
  sessionKey = null,
  salt = null,
  locked = null,
  writing = false,
  storageKey = "",
  installEvent,
  showArchived = false;
const navGroups = [
  ["Ruang pribadi", ["Ringkasan", "Transaksi", "Dompet", "Laporan"]],
  ["Perencanaan", ["Budget", "Goals", "Automasi"]],
  ["Portofolio", ["Aset", "Utang & piutang", "Investasi"]],
  ["Lainnya", ["Advisor", "Profil"]],
];
const symbols = {
  Ringkasan: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  Transaksi: "M4 7h15l-4-4m4 14H4l4 4M20 7l-4 4M4 17l4-4",
  Dompet: "M3 7h16a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7l15-4v4 M21 11h-6v4h6",
  Laporan: "M4 3v17h17M8 15v-4m5 4V7m5 8v-6",
  Budget: "M12 3v9h9A9 9 0 1 1 12 3z M15 2v7h7a8 8 0 0 0-7-7z",
  Goals: "M3 21V4m0 0c5-5 11 4 17 0l-2 5 2 4c-6 4-12-5-17 0",
  Automasi: "m14 2-10 12h7l-1 8 10-13h-7z",
  Aset: "m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  "Utang & piutang": "M3 6h18v13H3z M3 10h18m-14 5h4",
  Investasi: "M3 17l6-6 4 3 8-9m-5 0h5v5",
  Advisor:
    "m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z M20 17v5m-2.5-2.5h5",
  Profil: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M3 21c0-8 18-8 18 0",
  eye: "M2 12c6-10 14-10 20 0-6 10-14 10-20 0z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  plus: "M12 4v16M4 12h16",
  down: "M12 3v15m-5-5 5 5 5-5",
  up: "M12 21V6m-5 5 5-5 5 5",
  calendar: "M3 5h18v16H3z M7 3v4m10-4v4M3 10h18",
  menu: "M3 6h18M3 12h18M3 18h18",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M12 2v3m0 14v3M2 12h3m14 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  close: "M5 5l14 14M19 5 5 19",
  check: "m4 12 5 5L20 6",
  folder: "M3 5h7l2 3h9v12H3z",
};
const icon = (n) =>
  '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="' +
  (symbols[n] || symbols.Dompet) +
  '"/></svg>';
const translations = {
  Ringkasan: "Overview",
  Transaksi: "Transactions",
  Dompet: "Wallets",
  Laporan: "Reports",
  Perencanaan: "Planning",
  Portofolio: "Portfolio",
  Lainnya: "Other",
  "Ruang pribadi": "Workspace",
  Aset: "Assets",
  "Utang & piutang": "Debts & receivables",
  Investasi: "Investments",
  Automasi: "Automation",
  Profil: "Profile",
  "Tambah transaksi": "Add transaction",
  "Ruang demo": "Demo workspace",
  "Buku pribadi": "Personal ledger",
  "Keuangan pribadi": "Personal finance",
  "Saldo dompet": "Wallet balance",
  Pemasukan: "Income",
  Pengeluaran: "Expenses",
  "Sisa budget": "Budget left",
  "Arus kas": "Cash flow",
  "Realisasi budget": "Budget usage",
  "Transaksi terbaru": "Recent transactions",
  "Lihat semua": "View all",
  "Budget harian tersisa": "Daily budget left",
  "Belum ada data.": "No data yet.",
  Simpan: "Save",
  Batal: "Cancel",
  Hapus: "Delete",
  Ubah: "Edit",
  Tambah: "Add",
  "Bagian dari kekayaan bersih": "Part of your net worth",
  "Arus masuk dan keluar selama enam bulan terakhir.":
    "Income and expenses over the last six months.",
  "Hari ini": "Today",
  Pengaturan: "Settings",
  "Unduh laporan": "Export report",
  "Akses cepat": "Quick access",
  "Aktivitas bulan ini": "Activity this month",
  "Tagihan mendatang": "Upcoming bills",
  "Dana darurat": "Emergency fund",
  "Mulai catatan saya": "Start my ledger",
  "Coba data contoh": "Explore sample data",
  Kebutuhan: "Needs",
  Keinginan: "Wants",
  Tabungan: "Savings",
  Tanggal: "Date",
  Nominal: "Amount",
  Nama: "Name",
  Jenis: "Type",
  Kategori: "Category",
  Catatan: "Note",
  Tujuan: "Destination",
  Kembali: "Back",
  Bahasa: "Language",
  "Mata uang": "Currency",
  Tema: "Theme",
  Warna: "Accent",
  "Pengaturan profil": "Profile settings",
};
const T = (s) => (book?.prefs.language === "en" ? translations[s] || s : s);
const money = (n, raw = false) =>
  !raw && book.prefs.hidden
    ? "••••"
    : new Intl.NumberFormat(book.prefs.language === "en" ? "en-US" : "id-ID", {
        style: "currency",
        currency: book.prefs.currency,
        maximumFractionDigits: book.prefs.currency === "IDR" ? 0 : 2,
      }).format(n || 0);
const fmt = (s, full = false) =>
  new Intl.DateTimeFormat(
    book.prefs.language === "en" ? "en-GB" : "id-ID",
    full
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short" },
  ).format(F.date(s));
const act = (k, label, cls = "", v = "") =>
  '<button type="button" data-a="' +
  esc(k) +
  '" data-id="' +
  esc(v) +
  '" class="' +
  cls +
  '">' +
  label +
  "</button>";
const txt = (k, l, c = "", v = "") => act(k, esc(T(l)), c, v);
const glyph = (n) => '<span class="glyph">' + icon(n) + "</span>";
const pill = (s) => '<span class="pill">' + esc(s) + "</span>";
const empty = (s = "Belum ada data.") =>
  '<div class="empty">' + esc(T(s)) + "</div>";
const panel = (title, body, action = "") =>
  '<section class="panel"><div class="sectionhead"><h2>' +
  esc(T(title)) +
  "</h2>" +
  action +
  "</div>" +
  body +
  "</section>";
const row = (n, title, sub, end = "", actions = "") =>
  '<div class="row">' +
  glyph(n) +
  '<div class="body"><b>' +
  esc(title) +
  "</b><small>" +
  esc(sub) +
  "</small></div>" +
  end +
  (actions ? '<div class="actions">' + actions + "</div>" : "") +
  "</div>";
const progress = (name, used, max) =>
  '<div class="budgetrow"><div class="split"><b>' +
  esc(T(name)) +
  "</b><small>" +
  esc(money(used)) +
  " / " +
  esc(money(max)) +
  '</small></div><div class="progress"><i class="' +
  (used > max ? "over" : "") +
  '" style="width:' +
  Math.min(100, Math.max(0, max ? (used / max) * 100 : used ? 100 : 0)) +
  '%"></i></div>' +
  (used > max ? '<small class="negative">Melebihi alokasi</small>' : "") +
  "</div>";
const metric = (n, label, value, cls = "") =>
  '<div class="metric"><div class="flex"><span class="mini ' +
  cls +
  '">' +
  icon(n) +
  "</span><small>" +
  esc(T(label)) +
  "</small></div><b>" +
  esc(value) +
  "</b></div>";
const walletName = (id) => book.wallets.find((w) => w.id === id)?.name || "—";
const typeNames = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  adjustUp: "Penyesuaian (+)",
  adjustDown: "Penyesuaian (−)",
  capitalIn: "Dana masuk portofolio",
  capitalOut: "Dana keluar portofolio",
};
const edit = (kind, id) => txt("edit-" + kind, "Ubah", "smallbtn", id);
const del = (kind, id) => txt("del-" + kind, "Hapus", "smallbtn", id);
const buttons = (kind, id) => edit(kind, id) + del(kind, id);
function txRows(rows, compact = false) {
  return rows.length
    ? [...rows]
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => {
          const sign = ["income", "adjustUp", "capitalIn"].includes(t.type)
            ? "+"
            : t.type === "transfer"
              ? ""
              : "−";
          return row(
            t.type === "transfer" ? "Transaksi" : sign === "+" ? "down" : "up",
            t.note || T(typeNames[t.type]),
            [
              fmt(t.date),
              walletName(t.wallet) +
                (t.type === "transfer" ? " → " + walletName(t.to) : ""),
              t.category,
              t.sub,
              t.tags,
            ]
              .filter(Boolean)
              .join(" · "),
            '<b class="amount ' +
              (sign === "+" ? "positive" : "") +
              '">' +
              sign +
              esc(money(t.amount)) +
              "</b>",
            compact
              ? ""
              : (t.ref || t.trade || t.schedule ? "" : edit("tx", t.id)) +
                  (t.trade ? "" : del("tx", t.id)),
          );
        })
        .join("")
    : empty("Belum ada transaksi untuk pilihan ini.");
}
const rangeText = () => fmt(range[0]) + " – " + fmt(range[1], true);
function trend(end = range[1]) {
  const data = Array.from({ length: 6 }, (_, i) => {
    const m = F.month(F.shiftMonth(end, i - 5));
    return {
      s: F.stats(book, ...m),
      month: new Intl.DateTimeFormat(book.prefs.language, {
        month: "short",
      }).format(F.date(m[0])),
    };
  });
  const max = Math.max(1, ...data.flatMap((v) => [v.s.inc, v.s.out]));
  return (
    '<div class="inline"><span class="legend"><i class="dot"></i>' +
    T("Pemasukan") +
    '</span><span class="legend"><i class="dot alt"></i>' +
    T("Pengeluaran") +
    '</span></div><div class="chart" role="img" aria-label="Tren enam bulan">' +
    data
      .map(
        (x) =>
          '<div class="barset" title="' +
          esc(x.month + " · " + money(x.s.inc) + " / " + money(x.s.out)) +
          '"><i style="height:' +
          (100 * x.s.inc) / max +
          '%"></i><i style="height:' +
          (100 * x.s.out) / max +
          '%"></i></div>',
      )
      .join("") +
    '</div><div class="months">' +
    data.map((x) => "<span>" + esc(x.month) + "</span>").join("") +
    "</div>"
  );
}
function calendar() {
  const [a, z] = F.month(range[1]),
    rows = F.periodRows(book, a, z);
  return (
    '<div class="calendar">' +
    ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"]
      .map((x) => "<small>" + x + "</small>")
      .join("") +
    "<i></i>".repeat((F.date(a).getDay() + 6) % 7) +
    Array.from({ length: F.date(z).getDate() }, (_, i) => {
      const d = F.plus(a, i);
      return act(
        "day",
        String(i + 1),
        (d === today ? "today " : "") +
          (rows.some((t) => t.date === d) ? "used" : ""),
        d,
      );
    }).join("") +
    "</div>"
  );
}
function dashboard() {
  const w = F.worth(book),
    p = book.plans.find(
      (x) => !x.archived && x.start <= range[0] && x.end >= range[1],
    ),
    s = F.stats(book, ...range),
    ps = p ? F.stats(book, p.start, p.end) : s,
    h = F.health(book, s, p, F.days(...range) + 1),
    budget = p
      ? F.sum(Object.keys(p.alloc), (g) => F.limit(p, g)) -
        F.sum(Object.keys(ps.byGroup), (g) => ps.byGroup[g])
      : null;
  const now = F.stats(book, today, today);
  return (
    '<div class="hero"><div><div class="flex"><b>' +
    T("Saldo dompet") +
    "</b>" +
    act("hide", icon("eye"), "eye") +
    '</div><div class="big">' +
    esc(money(w.wallet)) +
    '</div><div class="dim">' +
    book.wallets.length +
    " dompet &nbsp; · &nbsp; " +
    T("Bagian dari kekayaan bersih") +
    '</div><div class="dim">' +
    T("Hari ini") +
    " &nbsp; +" +
    money(now.inc) +
    " &nbsp; / &nbsp; −" +
    money(now.out) +
    '</div></div><img class="art" alt="" src="./media/wallet-stack.webp"></div><div class="stats">' +
    metric("down", "Pemasukan", money(s.inc), "pos") +
    metric("up", "Pengeluaran", money(s.out), "neg") +
    metric("Budget", "Sisa budget", budget === null ? "—" : money(budget)) +
    '</div><div class="cols">' +
    panel("Arus kas", trend(), txt("nav", "Laporan", "link", "Laporan")) +
    panel(
      "Realisasi budget",
      p
        ? Object.keys(p.alloc)
            .map((g) => progress(g, ps.byGroup[g] || 0, F.limit(p, g)))
            .join("")
        : empty("Buat budget untuk melihat pemakaian per pos."),
      txt("nav", "Budget", "link", "Budget"),
    ) +
    '</div><div class="cols">' +
    panel(
      "Transaksi terbaru",
      txRows(
        [...s.rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-5),
        true,
      ),
      txt("nav", "Lihat semua", "link", "Transaksi"),
    ) +
    panel(
      "Aktivitas bulan ini",
      calendar(),
      '<span class="muted">' +
        esc(fmt(range[1], true).split(" ").slice(1).join(" ")) +
        "</span>",
    ) +
    '</div><div class="cards">' +
    panel(
      "Budget harian tersisa",
      '<b class="badgeamount">' +
        (budget === null || today < p.start || today > p.end
          ? "—"
          : money(
              Math.max(0, budget) / Math.max(1, F.days(today, p.end) + 1),
            )) +
        '</b><p class="subline">Sisa alokasi dibagi hari tersisa dalam periode.</p>',
    ) +
    panel(
      "Dana darurat",
      '<b class="badgeamount">' +
        (h.coverage === null
          ? "—"
          : book.prefs.hidden
            ? "••••"
            : h.coverage.toFixed(1) + " bulan") +
        '</b><p class="subline">Saldo likuid dibagi estimasi pengeluaran bulanan.</p>',
    ) +
    panel("Tagihan mendatang", billList(true), txt("bill", "Tambah", "link")) +
    "</div>"
  );
}
function billList(compact = false) {
  const rows = [...book.bills, ...book.debts.filter((d) => d.type === "Utang")]
    .filter((d) => F.remaining(book, d) > 0)
    .sort((a, b) => a.due.localeCompare(b.due));
  return rows.length
    ? rows
        .slice(0, compact ? 3 : 999)
        .map((d) =>
          row(
            "calendar",
            d.name,
            fmt(d.due, true),
            "<b>" + money(F.remaining(book, d)) + "</b>",
            txt("pay", "Bayar", "smallbtn", d.id),
          ),
        )
        .join("")
    : empty("Tidak ada tagihan mendatang.");
}
function field(
  label,
  name,
  value = "",
  type = "text",
  options = [],
  extra = "",
) {
  let control =
    type === "select"
      ? '<select name="' +
        name +
        '" ' +
        extra +
        ">" +
        options
          .map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, T(o)];
            return (
              '<option value="' +
              esc(v) +
              '" ' +
              (String(v) === String(value) ? "selected" : "") +
              ">" +
              esc(l) +
              "</option>"
            );
          })
          .join("") +
        "</select>"
      : type === "textarea"
        ? '<textarea name="' +
          name +
          '" ' +
          extra +
          ">" +
          esc(value) +
          "</textarea>"
        : '<input name="' +
          name +
          '" type="' +
          type +
          '" value="' +
          esc(value) +
          '" ' +
          extra +
          ">";
  return '<label class="field">' + esc(T(label)) + control + "</label>";
}
const ws = () => book.wallets.map((w) => [w.id, w.name]);
function transactions() {
  const q = (filters.search || "").toLowerCase(),
    all = book.tx.filter(
      (t) =>
        (!filters.start || t.date >= filters.start) &&
        (!filters.end || t.date <= filters.end) &&
        (!filters.wallet || [t.wallet, t.to].includes(filters.wallet)) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.category || t.category === filters.category) &&
        (!q ||
          [t.note, t.tags, t.sub, t.category]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  return (
    '<div class="actions">' +
    txt("bulk", "Tambah banyak") +
    txt("scan", "Scan struk") +
    txt("inbox", "Kotak masuk (" + book.inbox.length + ")") +
    txt("export", "Ekspor") +
    '</div><div class="filters" id="filters">' +
    field("Cari catatan, tag, subkategori", "search", filters.search) +
    field("Mulai", "start", filters.start, "date") +
    field("Sampai", "end", filters.end, "date") +
    field("Dompet", "wallet", filters.wallet, "select", [
      ["", "Semua dompet"],
      ...ws(),
    ]) +
    field("Jenis", "type", filters.type, "select", [
      ["", "Semua jenis"],
      ...Object.entries(typeNames),
    ]) +
    field("Kategori", "category", filters.category, "select", [
      ["", "Semua kategori"],
      ...Object.keys(book.categories),
      ...book.incomeCats,
    ]) +
    txt("filter", "Terapkan") +
    txt("clearfilter", "Reset", "link") +
    "</div>" +
    panel(
      "Riwayat transaksi",
      txRows(all),
      "<span>" + all.length + " transaksi</span>",
    )
  );
}
function wallets() {
  return (
    '<div class="cards">' +
    book.wallets
      .map((w, i) =>
        panel(
          w.name,
          '<div class="split">' +
            pill(w.type) +
            '<b class="badgeamount">' +
            money(F.balance(book, w)) +
            '</b></div><div class="actions stickyactions">' +
            txt("adjust", "Sesuaikan saldo", "smallbtn", w.id) +
            (F.isCredit(w)
              ? txt("cardpay", "Bayar kartu", "smallbtn", w.id)
              : "") +
            buttons("wallet", w.id) +
            (i ? txt("move", "Naik", "smallbtn", w.id) : "") +
            "</div>",
        ),
      )
      .join("") +
    "</div>" +
    (book.wallets.length
      ? ""
      : panel(
          "Dompet pertama",
          empty("Tambahkan dompet untuk mencatat saldo awal dan transaksi."),
        )) +
    panel(
      "Tagihan & cicilan",
      billList(),
      txt("bill", "Tambah tagihan", "link"),
    )
  );
}
function budget() {
  const visible = book.plans.filter((p) => showArchived || !p.archived);
  const archive = txt(
    "showArchive",
    showArchived ? "Sembunyikan arsip" : "Tampilkan arsip",
    "smallbtn",
  );
  const p =
    visible.find((p) => p.id === planView) || F.active(book) || visible.at(-1);
  if (!p)
    return (
      archive +
      panel(
        "Budget pertama",
        empty("Pilih periode, metode alokasi, dan pos anggaran."),
        txt("plan", "Atur budget", "primary"),
      )
    );
  const s = F.stats(book, p.start, p.end);
  return (
    '<div class="tabs">' +
    archive +
    [...visible]
      .reverse()
      .map((x) =>
        txt(
          "viewplan",
          x.name + " · " + fmt(x.start),
          x.id === p.id ? "selected" : "",
          x.id,
        ),
      )
      .join("") +
    "</div>" +
    panel(
      p.name,
      '<p class="muted">' +
        fmt(p.start, true) +
        " – " +
        fmt(p.end, true) +
        " · " +
        esc(p.mode) +
        '</p><div class="stats">' +
        metric("down", "Pendapatan rencana", money(p.income)) +
        metric(
          "Budget",
          "Total alokasi",
          money(F.sum(Object.keys(p.alloc), (g) => F.limit(p, g))),
        ) +
        metric("up", "Pengeluaran", money(s.out)) +
        "</div>" +
        Object.keys(p.alloc)
          .map((g) => progress(g, s.byGroup[g] || 0, F.limit(p, g)))
          .join(""),
      '<div class="actions">' +
        edit("plan", p.id) +
        txt(
          "archivePlan",
          p.archived ? "Pulihkan" : "Arsipkan",
          "smallbtn",
          p.id,
        ) +
        txt("copyplan", "Salin periode", "smallbtn", p.id) +
        del("plan", p.id) +
        "</div>",
    ) +
    '<div class="cards">' +
    panel(
      "Kategori & subkategori",
      Object.entries(book.categories)
        .map(([k, g]) =>
          row(
            "Budget",
            k,
            g + (book.subs?.[k]?.length ? " · " + book.subs[k].join(", ") : ""),
            "",
            txt("category", "Atur", "smallbtn", k),
          ),
        )
        .join(""),
      txt("category", "Tambah", "link"),
    ) +
    panel(
      "Sumber pemasukan",
      book.incomeCats.map((s) => pill(s)).join(" "),
      txt("incomeCat", "Tambah", "link"),
    ) +
    "</div>"
  );
}
function listPage(kind) {
  const collections = {
    goal: "goals",
    asset: "assets",
    debt: "debts",
    invest: "positions",
    rule: "rules",
  };
  const items = book[collections[kind]];
  const w = F.worth(book);
  const top =
    kind === "asset"
      ? '<div class="stats">' +
        metric("Aset", "Kekayaan bersih", money(w.total)) +
        metric("Dompet", "Saldo dompet", money(w.wallet)) +
        metric("Investasi", "Portofolio", money(w.invest)) +
        "</div>"
      : kind === "invest"
        ? '<div class="stats">' +
          metric("Investasi", "Nilai portofolio", money(w.invest)) +
          metric(
            "Budget",
            "Modal tersisa",
            money(F.sum(items, (p) => F.holding(book, p).cost)),
          ) +
          metric(
            "Laporan",
            "Laba/rugi belum terealisasi",
            money(F.sum(items, (p) => F.holding(book, p).gain)),
          ) +
          '</div><div class="actions">' +
          txt("refreshPrice", "Perbarui harga") +
          txt("csvPrice", "Impor harga CSV") +
          "</div>"
        : kind === "debt"
          ? '<div class="stats">' +
            ["Utang", "Piutang"]
              .map((k) =>
                metric(
                  "Utang & piutang",
                  "Sisa " + k.toLowerCase(),
                  money(
                    F.sum(
                      items.filter((x) => x.type === k),
                      (x) => F.remaining(book, x),
                    ),
                  ),
                ),
              )
              .join("") +
            metric(
              "calendar",
              "Jatuh tempo ≤ 7 hari",
              String(
                items.filter(
                  (x) => F.remaining(book, x) > 0 && x.due <= F.plus(today, 7),
                ).length,
              ),
            ) +
            "</div>"
          : "";
  return (
    top +
    '<div class="cards">' +
    items
      .map((x) => {
        let info = "",
          extra = "";
        if (kind === "goal") {
          const v = x.opening + F.targetPaid(book, x);
          info =
            progress("Terkumpul", v, x.amount) +
            '<p class="subline">' +
            fmt(x.due, true) +
            " · " +
            esc(walletName(x.wallet)) +
            "</p>";
          extra = txt("contribute", "Setor dana", "smallbtn", x.id);
        }
        if (kind === "asset")
          info =
            pill(x.type) +
            '<p class="badgeamount">' +
            money(x.value) +
            '</p><p class="subline">' +
            esc(x.note) +
            "</p>";
        if (kind === "debt") {
          info =
            pill(x.type) +
            '<p class="subline">' +
            esc(x.party) +
            " · " +
            fmt(x.due, true) +
            "</p>" +
            progress("Terbayar", F.targetPaid(book, x), x.amount);
          if (F.remaining(book, x) > 0)
            extra = txt(
              "pay",
              x.type === "Utang" ? "Bayar cicilan" : "Terima pembayaran",
              "smallbtn",
              x.id,
            );
        }
        if (kind === "invest") {
          const h = F.holding(book, x);
          info =
            pill(x.type) +
            '<p class="badgeamount">' +
            money(h.value) +
            '</p><p class="subline">' +
            esc(x.symbol) +
            " · " +
            (book.prefs.hidden ? "••••" : Number(h.qty.toFixed(6))) +
            " unit · " +
            money(x.price) +
            '/unit</p><p class="subline">Harga per ' +
            fmt(x.asof, true) +
            '</p><p class="subline">Laba/rugi terealisasi ' +
            money(h.realized) +
            "</p>";
          extra =
            txt("yield", "Catat imbal hasil", "smallbtn", x.id) +
            txt("trade", "Beli / jual", "smallbtn", x.id) +
            txt("price", "Ubah harga", "smallbtn", x.id);
        }
        if (kind === "rule") {
          info =
            pill(x.enabled ? "Aktif" : "Dijeda") +
            '<p class="badgeamount">' +
            money(x.amount) +
            '</p><p class="subline">' +
            esc(x.every) +
            " · " +
            fmt(x.next, true) +
            " · " +
            esc(walletName(x.wallet)) +
            "</p>";
          extra = txt(
            "toggleRule",
            x.enabled ? "Jeda" : "Aktifkan",
            "smallbtn",
            x.id,
          );
        }
        return panel(
          x.name,
          info +
            '<div class="actions stickyactions">' +
            extra +
            buttons(kind, x.id) +
            "</div>",
        );
      })
      .join("") +
    "</div>" +
    (!items.length
      ? panel(
          page,
          empty("Belum ada catatan. Gunakan tombol tambah untuk memulai."),
        )
      : "") +
    (kind === "invest"
      ? panel(
          "Riwayat beli & jual",
          [...book.trades]
            .reverse()
            .map((t) =>
              row(
                "Investasi",
                t.side +
                  " · " +
                  (book.positions.find((p) => p.id === t.position)?.name || ""),
                fmt(t.date, true),
                " <b>" + money(t.qty * t.price) + "</b>",
              ),
            )
            .join("") || empty(),
        )
      : "")
  );
}
function reports() {
  const s = F.stats(book, ...range),
    p = F.active(book, range[1]),
    h = F.health(book, s, p, F.days(...range) + 1);
  return (
    '<div class="stats">' +
    metric("down", "Pemasukan", money(s.inc), "pos") +
    metric("up", "Pengeluaran", money(s.out), "neg") +
    metric("Laporan", "Arus kas bersih", money(s.net)) +
    '</div><div class="cols">' +
    panel("Arus kas", trend()) +
    panel(
      "Skor kesehatan finansial",
      '<p class="badgeamount">' +
        (h.score === null ? "—" : h.score + " / 100") +
        '</p><p class="subline">Indikator MyUang dari rasio tabungan, kepatuhan budget, dana darurat, dan beban utang. Komponen yang belum memiliki data dikecualikan.</p>',
    ) +
    '</div><div class="cols">' +
    panel(
      "Pengeluaran per kategori",
      Object.entries(s.cats)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => progress(k, v, s.out))
        .join("") || empty(),
    ) +
    panel(
      "Insight periode",
      esc(localAnswer("analisis", s)),
      txt("reportAI", "Tanya Advisor", "link"),
    ) +
    "</div>"
  );
}
function localAnswer(q, s = F.stats(book, ...range)) {
  const top = Object.entries(s.cats).sort((a, b) => b[1] - a[1])[0],
    net = money(s.net);
  if (!s.rows.length)
    return "Belum ada transaksi pada periode ini. Catat pemasukan atau pengeluaran pertama untuk melihat pola.";
  if (/roast/i.test(q))
    return top
      ? "Kalau " +
          top[0] +
          " punya kartu member, kamu mungkin sudah VIP. Pos ini menyerap " +
          money(top[1]) +
          " dari " +
          money(s.out) +
          " pengeluaran periode ini."
      : "Pengeluaran masih nol selama periode ini.";
  if (/tabung|goal|beli|target/i.test(q))
    return (
      "Selisih pemasukan dan pengeluaran periode ini " +
      net +
      ". " +
      (book.goals.length
        ? "Target pertama, " +
          book.goals[0].name +
          ", masih membutuhkan " +
          money(
            Math.max(
              0,
              book.goals[0].amount -
                book.goals[0].opening -
                F.targetPaid(book, book.goals[0]),
            ),
          ) +
          "."
        : "Tambahkan target dengan tenggat di menu Goals.")
    );
  return (
    "Pemasukan " +
    money(s.inc) +
    " dan pengeluaran " +
    money(s.out) +
    " menghasilkan arus kas bersih " +
    net +
    ". " +
    (top
      ? "Pengeluaran terbesar ada di " +
        top[0] +
        " sebesar " +
        money(top[1]) +
        "."
      : "Belum ada pengeluaran.")
  );
}
function advisor() {
  const chat = book.chats.find((c) => c.id === chatId) || book.chats.at(-1);
  chatId = chat?.id || "";
  return (
    '<div class="cols">' +
    panel(
      "Percakapan",
      '<p class="subline">' +
        (book.prefs.ai
          ? "Model AI eksternal aktif untuk pertanyaan yang kamu kirim."
          : "Analisis lokal menggunakan angka pada periode terpilih.") +
        '</p><div class="conversation">' +
        (chat?.messages || [])
          .map(
            (m) =>
              '<div class="chatline ' +
              (m.role === "user" ? "user" : "") +
              '">' +
              esc(book.prefs.hidden ? "••••" : m.text) +
              "</div>",
          )
          .join("") +
        '</div><div class="actions">' +
        [
          "Analisis keuanganku",
          "Roasting pengeluaranku",
          "Bagaimana target tabunganku?",
        ]
          .map((q) => txt("ask", q, "smallbtn", q))
          .join("") +
        '</div><form id="askform" class="filters">' +
        field(
          "Pertanyaan",
          "question",
          "",
          "text",
          [],
          'required maxlength="1000"',
        ) +
        '<button class="primary">Kirim</button></form>',
    ) +
    panel(
      "Riwayat chat",
      [...book.chats]
        .reverse()
        .map((c) =>
          row(
            "Advisor",
            c.name,
            fmt(c.date),
            txt("openchat", "Buka", "smallbtn", c.id),
            del("chat", c.id),
          ),
        )
        .join("") || empty(),
      txt("newchat", "Chat baru", "link"),
    ) +
    "</div>"
  );
}
function profile() {
  return (
    '<div class="cards">' +
    panel(
      "Pengaturan profil",
      row(
        "Profil",
        (book.prefs.avatar || "") +
          " " +
          (book.prefs.name || "Pengguna MyUang"),
        mode === "demo" ? "Data contoh" : modeLabel(),
      ) +
        '<div class="actions">' +
        txt("prefs", "Ubah preferensi") +
        txt("avatar", "Ganti avatar") +
        txt(
          "switch",
          mode === "demo" ? "Mulai catatan saya" : "Coba data contoh",
        ) +
        "</div>",
    ) +
    panel(
      "Privasi & data",
      '<div class="actions">' +
        txt("pin", sessionKey ? "Ubah PIN" : "Aktifkan PIN") +
        (sessionKey ? txt("lock", "Kunci sekarang") : "") +
        txt(
          "hide",
          book.prefs.hidden ? "Tampilkan nominal" : "Sembunyikan nominal",
        ) +
        txt("backup", "Cadangkan JSON") +
        txt("restore", "Pulihkan JSON") +
        "</div>",
    ) +
    panel(
      "Aplikasi",
      '<div class="actions">' +
        txt("install", "Install aplikasi") +
        txt("guide", "Tutorial") +
        txt("changes", "Yang baru") +
        txt("reminder", "Pengingat harian") +
        "</div>",
    ) +
    panel(
      "Layanan lanjutan",
      '<p class="subline">Automasi, utang-piutang, investasi dan OCR tersedia di semua buku. Pengaturan AI dan sumber harga dijelaskan di panduan.</p><div class="actions">' +
        txt("aiPrefs", "Pengaturan AI") +
        txt("guide", "Panduan") +
        "</div>",
    ) +
    "</div>"
  );
}
const config = {
  Ringkasan: [
    "Posisi keuangan dan aktivitasmu dalam satu periode.",
    "tx",
    "Tambah transaksi",
  ],
  Transaksi: [
    "Catatan masuk, keluar, dan transfer antar dompet.",
    "tx",
    "Tambah transaksi",
  ],
  Dompet: [
    "Saldo tunai, rekening, e-wallet, kartu kredit dan PayLater.",
    "wallet",
    "Tambah dompet",
  ],
  Budget: [
    "Atur alokasi dan pantau pemakaian tiap pos.",
    "plan",
    "Buat budget",
  ],
  Goals: ["Pisahkan dana untuk tujuan dengan tenggat.", "goal", "Tambah goal"],
  Aset: [
    "Pantau aset likuid, aset tetap, dan kekayaan bersih.",
    "asset",
    "Tambah aset",
  ],
  "Utang & piutang": [
    "Catat sisa pokok, jatuh tempo, dan cicilan.",
    "debt",
    "Tambah catatan",
  ],
  Investasi: [
    "Lacak unit, modal, harga terakhir, dan perubahan nilai.",
    "invest",
    "Tambah instrumen",
  ],
  Automasi: [
    "Jadwalkan transaksi masuk atau keluar secara berulang.",
    "rule",
    "Buat automasi",
  ],
  Advisor: [
    "Baca pola pengeluaran dan diskusikan targetmu.",
    "newchat",
    "Chat baru",
  ],
  Laporan: [
    "Tinjau arus kas, kesehatan keuangan, dan tren enam bulan.",
    "export",
    "Unduh laporan",
  ],
  Profil: [
    "Kelola preferensi, privasi, dan cadangan buku.",
    "prefs",
    "Pengaturan",
  ],
};
const content = () =>
  ({
    Ringkasan: dashboard,
    Transaksi: transactions,
    Dompet: wallets,
    Budget: budget,
    Goals: () => listPage("goal"),
    Aset: () => listPage("asset"),
    "Utang & piutang": () => listPage("debt"),
    Investasi: () => listPage("invest"),
    Automasi: () => listPage("rule"),
    Laporan: reports,
    Advisor: advisor,
    Profil: profile,
  })[page]();
function render() {
  if (!book) return;
  document.body.dataset.theme = book.prefs.theme;
  document.body.dataset.accent = book.prefs.accent;
  document.documentElement.lang = book.prefs.language;
  document.title = T(page) + " · MyUang";
  const nav = (n) =>
    act(
      "nav",
      icon(n) + "<span>" + esc(T(n)) + "</span>",
      "nav " + (page === n ? "active" : ""),
      n,
    );
  const [sub, cmd, label] = config[page];
  $("#app").innerHTML =
    '<aside><div class="brand"><span class="brandmark">' +
    icon("Dompet") +
    "</span>MyUang</div>" +
    navGroups
      .map(([g, ns]) => "<small>" + T(g) + "</small>" + ns.map(nav).join(""))
      .join("") +
    '<div class="sidebarfoot">' +
    act(
      "switch",
      '<span class="avatar">' +
        icon("folder") +
        "</span><span><b>" +
        T(mode === "demo" ? "Ruang demo" : "Buku pribadi") +
        "</b><em>" +
        T(mode === "demo" ? "Mulai catatan saya" : "Coba data contoh") +
        "</em></span>",
      "workspace",
    ) +
    '</div></aside><div class="right"><header><div class="flex">' +
    act("menu", icon("menu"), "icon mobile") +
    '<span class="crumb">MyUang &nbsp; / &nbsp; <b>' +
    T(page) +
    '</b></span></div><div class="flex">' +
    (mode === "demo" ? txt("switch", "Ruang demo", "demo") : "") +
    act("theme", icon("sun"), "icon") +
    act("nav", icon("Profil"), "icon", "Profil") +
    '</div></header><main class="page"><div class="titleline"><div><h1>' +
    T(page) +
    '</h1><p class="subtitle">' +
    esc(T(sub)) +
    '</p></div><div class="actions">' +
    act(
      cmd,
      (cmd === "tx" || label.startsWith("Tambah") || cmd === "plan"
        ? icon("plus") + " "
        : "") + esc(T(label)),
      "primary",
    ) +
    "</div></div>" +
    (["Ringkasan", "Laporan", "Advisor"].includes(page)
      ? '<div class="actions" style="margin:-8px 0 14px">' +
        act("range", icon("calendar") + " " + esc(rangeText()), "smallbtn") +
        "</div>"
      : "") +
    content() +
    '</main></div><nav class="mbar">' +
    ["Ringkasan", "Transaksi", "Budget", "Profil"]
      .map((n) => act("nav", icon(n) + T(n), page === n ? "active" : "", n))
      .join("") +
    act("menu", icon("menu") + "Menu") +
    "</nav>";
  document
    .querySelectorAll("button.icon,.hero .eye")
    .forEach((b) =>
      b.setAttribute(
        "aria-label",
        {
          menu: "Menu",
          theme: "Ganti tema",
          hide: "Sembunyikan atau tampilkan nominal",
          nav: "Profil",
        }[b.dataset.a] || "Menu",
      ),
    );
}
