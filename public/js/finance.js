/* One ledger drives wallet balances, planning and reporting. Amounts are in the book currency. */
(() => {
  "use strict";
  const id = () => crypto.randomUUID();
  const day = (d = new Date()) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const date = (s) => new Date(s + "T12:00:00");
  const days = (a, b) => Math.round((date(b) - date(a)) / 86400000);
  const plus = (s, n) => {
    const d = date(s);
    d.setDate(d.getDate() + n);
    return day(d);
  };
  const shiftMonth = (s, n, anchor = date(s).getDate()) => {
    const d = date(s);
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(
      Math.min(
        anchor,
        new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
      ),
    );
    return day(d);
  };
  const month = (s) => [
    s.slice(0, 7) + "-01",
    plus(shiftMonth(s.slice(0, 7) + "-01", 1), -1),
  ];
  const sum = (rows, fn) => rows.reduce((n, x) => n + fn(x), 0);
  const groups = ["Kebutuhan", "Keinginan", "Tabungan"];
  const categories = {
    "Makan & minum": "Kebutuhan",
    Transportasi: "Kebutuhan",
    Tagihan: "Kebutuhan",
    Belanja: "Keinginan",
    Hiburan: "Keinginan",
    Menabung: "Tabungan",
    Lainnya: "Kebutuhan",
    "Biaya transfer": "Kebutuhan",
  };
  function blank(name = "") {
    return {
      version: 1,
      prefs: {
        name,
        theme: "Terang",
        accent: "Violet",
        language: "id",
        currency: "IDR",
        hidden: false,
        reminder: "",
        ai: false,
      },
      wallets: [],
      tx: [],
      plans: [],
      goals: [],
      assets: [],
      debts: [],
      positions: [],
      trades: [],
      rules: [],
      bills: [],
      inbox: [],
      chats: [],
      categories: { ...categories },
      incomeCats: ["Gaji", "Usaha", "Bonus", "Lainnya"],
      quotesDate: "",
    };
  }
  function entry(data) {
    return {
      id: id(),
      date: day(),
      type: "expense",
      wallet: "",
      to: "",
      amount: 0,
      fee: 0,
      category: "Lainnya",
      sub: "",
      tags: "",
      note: "",
      ...data,
    };
  }
  function flow(t, w) {
    if (t.type === "transfer")
      return (
        (t.to === w ? t.amount : 0) -
        (t.wallet === w ? t.amount + (t.fee || 0) : 0)
      );
    if (t.wallet !== w) return 0;
    return ["income", "adjustUp", "capitalIn"].includes(t.type)
      ? t.amount
      : -t.amount;
  }
  function balance(b, w, until = "9999") {
    return (
      w.opening +
      sum(
        b.tx.filter((t) => t.date <= until),
        (t) => flow(t, w.id),
      )
    );
  }
  const cost = (t) =>
    t.type === "expense" ? t.amount : t.type === "transfer" ? t.fee || 0 : 0;
  const periodRows = (b, start, end) =>
    b.tx.filter((t) => t.date >= start && t.date <= end);
  function stats(b, start, end) {
    const rows = periodRows(b, start, end),
      inc = sum(rows, (t) => (t.type === "income" ? t.amount : 0)),
      out = sum(rows, cost),
      cats = {},
      byGroup = {};
    for (const t of rows) {
      const v = cost(t);
      if (!v) continue;
      const cat = t.type === "transfer" ? "Biaya transfer" : t.category;
      cats[cat] = (cats[cat] || 0) + v;
      const g = b.categories[cat] || "Kebutuhan";
      byGroup[g] = (byGroup[g] || 0) + v;
    }
    const goalIds = new Set(b.goals.map((g) => g.id));
    for (const t of rows)
      if (t.type === "transfer" && goalIds.has(t.ref))
        byGroup.Tabungan = (byGroup.Tabungan || 0) + t.amount;
    return { inc, out, net: inc - out, cats, byGroup, rows };
  }
  function active(b, at = day()) {
    return b.plans.find((p) => !p.archived && p.start <= at && p.end >= at);
  }
  const limit = (p, g) =>
    p
      ? p.mode === "Persentase"
        ? (p.income * (p.alloc[g] || 0)) / 100
        : p.alloc[g] || 0
      : 0;
  const targetPaid = (b, d) =>
    sum(
      b.tx.filter((t) => t.ref === d.id),
      (t) => t.amount,
    );
  const remaining = (b, d) => Math.max(0, d.amount - targetPaid(b, d));
  const isCredit = (w) => ["Kartu kredit", "PayLater"].includes(w.type);
  function holding(b, p) {
    let qty = p.qty,
      cost = qty * p.cost,
      realized = 0;
    for (const t of b.trades
      .filter((t) => t.position === p.id)
      .sort((x, y) => x.date.localeCompare(y.date))) {
      if (t.side === "Beli") {
        qty += t.qty;
        cost += t.qty * t.price + t.fee;
      } else {
        const avg = qty ? cost / qty : 0;
        realized += t.qty * (t.price - avg) - t.fee;
        qty -= t.qty;
        cost -= t.qty * avg;
      }
    }
    return {
      qty,
      cost,
      value: qty * p.price,
      gain: qty * p.price - cost,
      realized,
    };
  }
  function worth(b) {
    const wallet = sum(b.wallets, (w) => balance(b, w)),
      assets = sum(b.assets, (a) => a.value),
      invest = sum(b.positions, (p) => holding(b, p).value),
      loans = sum(
        b.debts,
        (d) => remaining(b, d) * (d.type === "Piutang" ? 1 : -1),
      );
    return {
      wallet,
      assets,
      invest,
      loans,
      total: wallet + assets + invest + loans,
    };
  }
  function health(b, s, p, length = 30) {
    const cash = sum(
        b.wallets.filter((w) => !isCredit(w)),
        (w) => Math.max(0, balance(b, w)),
      ),
      planned = p ? sum(Object.keys(p.alloc), (g) => limit(p, g)) : 0;
    const reference = s.out
        ? (s.out * 30) / Math.max(1, length)
        : p
          ? (planned * 30) / Math.max(1, days(p.start, p.end) + 1)
          : 0,
      coverage = reference ? cash / reference : null;
    const debt =
      sum(
        b.debts.filter((d) => d.type === "Utang"),
        (d) => remaining(b, d),
      ) + sum(b.wallets.filter(isCredit), (w) => Math.max(0, -balance(b, w)));
    const cap = (v) => Math.max(0, Math.min(1, v));
    const parts = [
      s.inc ? cap(s.net / s.inc / 0.2) : null,
      planned ? cap(1 - Math.max(0, s.out - planned) / planned) : null,
      coverage === null ? null : cap(coverage / 6),
      debt || s.inc ? (debt + s.inc ? cap(s.inc / (debt + s.inc)) : 1) : null,
    ];
    const known = parts.filter((x) => x !== null);
    return {
      cash,
      coverage,
      score: known.length
        ? Math.round((sum(known, (x) => x) / known.length) * 100)
        : null,
    };
  }
  function dueRules(b, today = day()) {
    let count = 0;
    for (const r of b.rules.filter((r) => r.enabled)) {
      let iterations = 0;
      while (
        r.next <= today &&
        (!r.end || r.next <= r.end) &&
        iterations++ < 500
      ) {
        const key = r.id + "@" + r.next;
        if (!b.tx.some((t) => t.schedule === key)) {
          b.tx.push(
            entry({
              schedule: key,
              date: r.next,
              type: r.type,
              wallet: r.wallet,
              to: r.to || "",
              fee: r.fee || 0,
              category: r.category,
              amount: r.amount,
              note: r.name,
            }),
          );
          count++;
        }
        r.next =
          r.every === "Harian"
            ? plus(r.next, 1)
            : r.every === "Mingguan"
              ? plus(r.next, 7)
              : shiftMonth(r.next, 1, r.anchor);
      }
      if (r.end && r.next > r.end) r.enabled = false;
    }
    return count;
  }
  function calc(expression) {
    const str = String(expression).replace(/\s/g, "").replace(/,/g, ".");
    if (!/^\d+(?:\.\d+)?(?:[+*/-]\d+(?:\.\d+)?)*$/.test(str))
      throw Error("Gunakan angka atau operasi sederhana, misalnya 25000+5000.");
    const parts = str.match(/\d+(?:\.\d+)?|[+*/-]/g);
    let total = 0,
      term = Number(parts[0]);
    for (let i = 1; i < parts.length; i += 2) {
      const v = Number(parts[i + 1]);
      switch (parts[i]) {
        case "*":
          term *= v;
          break;
        case "/":
          term /= v;
          break;
        case "+":
          total += term;
          term = v;
          break;
        case "-":
          total += term;
          term = -v;
      }
    }
    const value = Math.round((total + term) * 100) / 100;
    if (!Number.isFinite(value) || value < 0 || value > 1e14)
      throw Error("Nominal di luar batas.");
    return value;
  }
  function sample() {
    const b = blank(""),
      today = day(),
      start = month(today)[0],
      end = month(today)[1];
    b.wallets = [
      ["Bank utama", "Bank", 6800000],
      ["Dompet digital", "E-wallet", 975000],
      ["Tunai", "Tunai", 875000],
      ["Rekening tujuan", "Tabungan", 2600000],
    ].map(([name, type, opening]) => ({ id: id(), name, type, opening }));
    const [bank, ew, cash] = b.wallets;
    for (let k = 0; k < 6; k++) {
      const base = shiftMonth(start, -k);
      let j = 0;
      for (const [note, cat, amt, w] of [
        ["Gaji bulanan", "Gaji", 7400000, bank],
        ["Belanja mingguan", "Belanja", 325000, bank],
        ["Langganan internet", "Tagihan", 260000, bank],
        ["Makan siang", "Makan & minum", 45000, ew],
        ["Kereta komuter", "Transportasi", 18000, ew],
        ["Belanja pasar", "Makan & minum", 188500, cash],
        ["Tiket bioskop", "Hiburan", 65000, ew],
        ["Makan malam", "Makan & minum", 112000, ew],
      ]) {
        const dt = plus(
          base,
          k
            ? j * 3
            : Math.floor((j * Math.max(0, date(today).getDate() - 1)) / 7),
        );
        b.tx.push(
          entry({
            date: dt,
            type: j ? "expense" : "income",
            wallet: w.id,
            amount: Math.round(amt * (k ? 1 - k * 0.045 : 1)),
            note,
            category: cat,
          }),
        );
        j++;
      }
    }
    b.plans.push({
      id: id(),
      name: "Budget bulanan",
      start,
      end,
      income: 7400000,
      mode: "Persentase",
      alloc: { Kebutuhan: 50, Keinginan: 30, Tabungan: 20 },
    });
    b.goals.push({
      id: id(),
      name: "Dana liburan",
      amount: 8000000,
      opening: 2600000,
      due: shiftMonth(today, 6),
      wallet: b.wallets[3].id,
    });
    b.bills.push({
      id: id(),
      name: "Internet rumah",
      amount: 260000,
      due: plus(today, 5),
    });
    return b;
  }
  globalThis.Finance = {
    id,
    day,
    date,
    days,
    plus,
    shiftMonth,
    month,
    sum,
    groups,
    blank,
    entry,
    flow,
    balance,
    cost,
    periodRows,
    stats,
    active,
    limit,
    targetPaid,
    remaining,
    isCredit,
    holding,
    worth,
    health,
    dueRules,
    calc,
    sample,
  };
})();
