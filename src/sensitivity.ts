/**
 * Which of these numbers decide the answer, and which are along for the ride.
 *
 * The funnel rates are measured. Everything that turns them into a ranking is not: what a
 * customer is worth, what each fix costs, how far each step can move. Those are inputs, and
 * a growth deck's usual failure is a confident ordering resting on a revenue-per-customer
 * somebody guessed in a meeting.
 *
 * So each one is swept, and the page reports the range over which the **ranking** does not
 * change — not the range over which the numbers do not change, which would be a much
 * weaker and much easier claim. The numbers move constantly; what matters is whether the
 * first thing to fix is still the first thing to fix.
 */

import { priceAll, LEVERS } from "./value.ts";
import { ASSUMPTIONS, BOUNDS } from "./assumptions.ts";
import { SCENARIO } from "./population.ts";
import { isMain } from "./cli.ts";
import type { Assumptions } from "./assumptions.ts";
import type { Improvable } from "./value.ts";

export type Band = {
  name: string;
  current: number;
  /** The range over which the ranking is unchanged. */
  from: number;
  to: number;
  decides: boolean;
  /** What the ranking becomes outside the band, if it changes. */
  becomes: string | null;
};

const order = (a: Assumptions, levers = LEVERS) =>
  priceAll(SCENARIO, a, levers).map((p) => p.step).join(" → ");

function walk(
  low: number, high: number, current: number,
  apply: (v: number) => string,
  steps = 30,
): Band["from"] extends never ? never : { from: number; to: number; becomes: string | null } {
  const reference = apply(current);
  let becomes: string | null = null;

  const march = (toward: number): number => {
    for (let i = 1; i <= steps; i++) {
      const v = current + ((toward - current) * i) / steps;
      const o = apply(v);
      if (o !== reference) { becomes ??= o; return current + ((toward - current) * (i - 1)) / steps; }
    }
    return toward;
  };

  const from = march(low);
  const to = march(high);
  return { from, to, becomes };
}

export function bands(): Band[] {
  const out: Band[] = [];

  /* The money assumptions. */
  for (const key of Object.keys(BOUNDS) as (keyof Assumptions)[]) {
    const [low, high] = BOUNDS[key];
    const current = ASSUMPTIONS[key];
    const { from, to, becomes } = walk(low, high, current, (v) => order({ ...ASSUMPTIONS, [key]: v }));
    out.push({
      name: key, current, from, to,
      decides: from > low + 1e-9 || to < high - 1e-9,
      becomes,
    });
  }

  /*
   * The levers, which are the part that actually decides — and the part nobody writes down.
   * Swept over a factor of five each way, because "what does a landing page rebuild cost"
   * is not a figure anybody knows to within less than that.
   */
  for (const step of Object.keys(LEVERS) as Improvable[]) {
    const base = LEVERS[step].cost;
    const { from, to, becomes } = walk(base / 5, base * 5, base, (v) =>
      order(ASSUMPTIONS, { ...LEVERS, [step]: { ...LEVERS[step], cost: v } }));
    out.push({
      name: `cost of fixing ${step}`, current: base, from, to,
      decides: from > base / 5 + 1e-9 || to < base * 5 - 1e-9,
      becomes,
    });
  }

  return out;
}

if (isMain(import.meta)) {
  const money = (x: number) => (x >= 100 ? "$" + Math.round(x).toLocaleString("en-GB") : x.toFixed(2));

  console.log("\nWhich of these decide the ranking?\n");
  console.log("input                        in use        ranking unchanged over        verdict");
  console.log("─".repeat(96));

  for (const b of bands()) {
    console.log(
      `${b.name.padEnd(28)}${money(b.current).padStart(10)}` +
      `${(money(b.from) + " – " + money(b.to)).padStart(30)}   ` +
      (b.decides ? "decides" : "no effect on the order"),
    );
  }

  console.log("\nWhere the order changes\n");
  for (const b of bands().filter((x) => x.decides && x.becomes)) {
    console.log(`  ${b.name}: outside ${money(b.from)}–${money(b.to)} the order becomes`);
    console.log(`    ${b.becomes}\n`);
  }

  console.log(
    "The revenue per customer scales every step equally, so it moves every figure on the page\n" +
    "and changes nothing about which to fix first. The lever costs are the opposite: they are\n" +
    "the least known numbers here and the only ones that reorder the answer.\n",
  );
}
