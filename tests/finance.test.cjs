const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../public/js/finance.js");
const F = global.Finance;
function ledger() {
  const b = F.blank();
  b.wallets = [
    { id: "a", type: "Bank", opening: 1000 },
    { id: "b", type: "Bank", opening: 100 },
  ];
  return b;
}
test("transfer fee, income, expenses and adjustment use separate flows", () => {
  const b = ledger();
  b.tx = [
    F.entry({ type: "transfer", wallet: "a", to: "b", amount: 200, fee: 5 }),
    F.entry({ type: "income", wallet: "a", amount: 60 }),
    F.entry({ type: "adjustDown", wallet: "b", amount: 7 }),
    F.entry({ wallet: "a", amount: 10 }),
  ];
  assert.equal(F.balance(b, b.wallets[0]), 845);
  assert.equal(F.balance(b, b.wallets[1]), 293);
  const s = F.stats(b, F.day(), F.day());
  assert.deepEqual([s.inc, s.out, s.net], [60, 15, 45]);
  assert.equal(F.worth(b).wallet, 1138);
});
test("holding basis survives partial sale and costs", () => {
  const b = ledger(),
    p = { id: "inv", qty: 3, cost: 20, price: 30 };
  b.positions = [p];
  b.trades = [
    {
      position: p.id,
      date: "2026-01-01",
      side: "Beli",
      qty: 2,
      price: 22,
      fee: 1,
    },
    {
      position: p.id,
      date: "2026-01-02",
      side: "Jual",
      qty: 1,
      price: 25,
      fee: 0,
    },
  ];
  assert.deepEqual(F.holding(b, p), {
    qty: 4,
    cost: 84,
    value: 120,
    gain: 36,
    realized: 4,
  });
});
test("debt principal payment reduces liabilities and cash together", () => {
  const b = ledger();
  const d = { id: "d", type: "Utang", amount: 300 };
  b.debts = [d];
  const before = F.worth(b).total;
  b.tx.push(
    F.entry({ type: "capitalOut", wallet: "a", amount: 80, ref: d.id }),
  );
  assert.equal(F.remaining(b, d), 220);
  assert.equal(F.worth(b).total, before);
  assert.equal(F.stats(b, F.day(), F.day()).out, 0);
});
test("recurring transactions month end anchor and duplicate protection", () => {
  const b = ledger();
  b.rules = [
    {
      id: "rent",
      enabled: true,
      amount: 20,
      next: "2026-01-31",
      end: "2026-03-31",
      anchor: 31,
      every: "Bulanan",
      wallet: "a",
      type: "expense",
    },
  ];
  assert.equal(F.dueRules(b, "2026-04-01"), 3);
  assert.equal(F.dueRules(b, "2026-04-01"), 0);
  assert.deepEqual(
    b.tx.map((x) => x.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.equal(b.rules[0].enabled, false);
});
test("goals transfer without changing portfolio, budget boundaries", () => {
  const b = ledger();
  const g = { id: "g", opening: 0 };
  b.tx = [
    F.entry({
      date: "2026-11-01",
      type: "transfer",
      wallet: "a",
      to: "b",
      amount: 30,
      ref: g.id,
    }),
  ];
  assert.equal(F.targetPaid(b, g), 30);
  assert.equal(F.worth(b).total, 1100);
  assert.equal(F.periodRows(b, "2026-11-02", "2026-11-04").length, 0);
  assert.equal(
    F.limit({ mode: "Persentase", income: 500, alloc: { A: 20 } }, "A"),
    100,
  );
  assert.equal(F.limit({ mode: "Nominal tetap", alloc: { A: 20 } }, "A"), 20);
});
test("calculator respects precedence and rejects invalid or nonfinite values", () => {
  assert.equal(F.calc("100 + 2*3"), 106);
  for (const expr of ["a", "1/0", "-1", "2..1"])
    assert.throws(() => F.calc(expr));
});
