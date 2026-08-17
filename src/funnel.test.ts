import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generate, reached, TRUE_RATES, SCENARIO } from "./population.ts";
import { measure, measureBy, measureMonth, worstStep, endToEnd } from "./funnel.ts";
import { price, priceAll, compare, LEVERS } from "./value.ts";
import { bands } from "./sensitivity.ts";
import { TRAPS } from "./adversarial.ts";
import { compareAll } from "./baselines.ts";
import { INVENTORY, MUST_DECLARE } from "./inventory.ts";
import { ASSUMPTIONS } from "./assumptions.ts";

test("the draw is reproducible", () => {
  const a = generate({ ...SCENARIO, visitsPerMonth: 2_000 });
  const b = generate({ ...SCENARIO, visitsPerMonth: 2_000 });
  assert.equal(a.length, b.length);
  assert.deepEqual(a.slice(0, 50), b.slice(0, 50));
  assert.notDeepEqual(a.slice(0, 50), generate({ ...SCENARIO, visitsPerMonth: 2_000, seed: 99 }).slice(0, 50));
});

test("the measurement recovers the rates the generator was built with", () => {
  /*
   * The one check a real funnel cannot run, and the reason for generating people rather
   * than totals: here the true rates exist, so the measurement can be held against them.
   * If this drifts, every other number in the repository is measuring something else.
   */
  const users = generate({ ...SCENARIO, improve: null, paidShareEnd: SCENARIO.paidShareStart });
  for (const channel of ["organic", "paid"] as const) {
    const rates = measureBy(users, channel);
    for (const r of rates) {
      const truth = TRUE_RATES[channel][r.step];
      assert.ok(Math.abs(r.rate - truth) < 0.02,
        `${channel}/${r.step}: measured ${r.rate.toFixed(3)} against a true ${truth}`);
    }
  }
});

test("a step is never ranked against one it cannot be distinguished from", () => {
  /*
   * "Fix the worst step" assumes the worst step is identifiable. Two steps whose intervals
   * overlap are not ranked by the sample that produced them, and saying which is worse
   * would be inventing a fact.
   */
  const small = measure(generate({ ...SCENARIO, visitsPerMonth: 300, months: 1 }));
  const w = worstStep(small);
  assert.ok(!w.identifiable,
    "on 300 visits the steps must not be separable — if they are, the interval is wrong");

  const large = worstStep(measure(generate()));
  for (const t of large.tied) {
    assert.ok(t.low <= large.worst.high, "a step declared tied must actually overlap");
  }
});

test("no rate is reported without enough observations behind it", () => {
  const tiny = measure(generate({ ...SCENARIO, visitsPerMonth: 40, months: 1 }));
  assert.ok(tiny.some((r) => !r.reportable), "some step must fall under the reporting floor");
});

test("improving a step never produces fewer customers", () => {
  /* A monotonicity the arithmetic guarantees and a refactor can quietly break. */
  for (const step of Object.keys(LEVERS) as (keyof typeof LEVERS)[]) {
    const { extraRetained } = price(step, LEVERS[step].ceiling);
    assert.ok(extraRetained > 0, `${step}: improving it produced ${extraRetained} extra customers`);
  }
});

test("the ranking is a property of the levers, not of the funnel", () => {
  /*
   * The finding this whole tool exists to make. Nothing about the users changes — the
   * chart, the rates, the intervals, every bar is identical. Only what somebody believes
   * about one lever changes, and the order moves.
   *
   * If this ever stops reordering, the demonstration on the page is no longer true and the
   * page has to say something else.
   */
  const c = compare({ signup: { cost: 90_000, ceiling: 0.01, what: "already rebuilt twice" } });
  assert.equal(c.reordered, true, "the alternative levers must reorder the ranking");
  assert.notEqual(c.base[0]!.step, c.other[0]!.step, "and must change what comes first");
});

test("the money assumptions do not decide the ranking; the lever costs do", () => {
  /*
   * Revenue per customer scales every step equally, so it moves every figure on the page
   * and changes nothing about which to fix first. That is worth asserting, because it is
   * the assumption a reader is most likely to argue about and the one that matters least.
   */
  const b = bands();
  for (const key of MUST_DECLARE.assumptions) {
    const found = b.find((x) => x.name === key)!;
    assert.equal(found.decides, false, `${key} should not reorder the ranking, and does`);
  }
  const levers = b.filter((x) => x.name.startsWith("cost of fixing"));
  assert.ok(levers.some((x) => x.decides), "if no lever cost decides, the sweep is measuring nothing");
});

test("every trap's evidence supports the claim it is making", () => {
  /*
   * The first version of the volume trap ran on a funnel with flat traffic, where a falling
   * rate also means falling counts — it printed evidence contradicting its own claim. A
   * trap needs a world where it happens, and the evidence has to show it happening.
   */
  for (const t of TRAPS) {
    const lines = t.evidence();
    assert.ok(lines.length > 0, `${t.id} produced no evidence`);
    assert.ok(t.appears.length > 30 && t.truth.length > 30 && t.caught.length > 30,
      `${t.id} is missing one of appears/truth/caught`);
  }

  const simpson = TRAPS.find((t) => t.id === "T-SIMPSON")!.evidence().join("\n");
  assert.match(simpson, /everyone.*DOWN/s, "the aggregate must fall, or there is no paradox");
  assert.ok((simpson.match(/\bup\b/g) ?? []).length >= 2, "both segments must rise");

  const volume = TRAPS.find((t) => t.id === "T-VOLUME")!.evidence().join("\n");
  const counts = [...volume.matchAll(/= ([\d,]+) signups/g)].map((m) => Number(m[1]!.replace(/,/g, "")));
  assert.ok(counts[1]! > counts[0]!, "the count must grow while the rate falls, or the trap is not one");
});

test("the tool is compared against deciding without it", () => {
  const rows = compareAll();
  assert.ok(rows.length >= 4, "at least the no-data strategies must be there");
  const tool = rows.find((r) => r.strategy === "this tool")!;
  for (const r of rows) {
    assert.ok(tool.perDollar >= r.perDollar - 1e-9,
      `${r.strategy} beats the tool — the tool is picking the wrong step`);
  }
});

test("nothing the tool runs on is missing from the inventory", () => {
  const declared = new Set(INVENTORY.map((f) => f.name));
  for (const key of MUST_DECLARE.assumptions) {
    assert.ok(declared.has(key), `${key} is an input and the inventory omits it`);
  }
  assert.ok(declared.has("LEVERS"), "the levers are the load-bearing choice and must be declared");
  for (const f of INVENTORY.filter((x) => x.provenance === "chosen")) {
    assert.ok(f.note && f.note.length > 20, `${f.name} is chosen and says nothing about why`);
  }
});

test("nothing claims to be retrieved, and the page says why", () => {
  /*
   * The compliance tools cite the Code of Federal Regulations. There is no equivalent for
   * growth — the available benchmarks are published by companies selling the thing being
   * benchmarked. Citing one would look like rigour and be the opposite, so this tool cites
   * nothing and the absence is declared rather than left as an empty column.
   */
  assert.equal(INVENTORY.filter((f) => f.provenance === "retrieved").length, 0);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /no retrieved|cites nothing|nothing is retrieved/i,
    "the README must say why there are no citations, not just have none");
});
