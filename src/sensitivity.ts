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
  /**
   * Nothing in the model reads this input — so its "no effect on the order" is a certainty
   * of the wiring, not a finding of the sweep.
   *
   * The distinction is the whole point of this file, and it was missing. Two of the three
   * assumptions — `costPerPaidVisit` and `monthsToShip` — are editable on the screen, swept
   * here, and read by no line of the pricing. The table published them in the same column,
   * with the same verdict, as `annualRevenuePerCustomer`, whose "no effect" IS a measured
   * result: it scales every step equally, so it moves every figure on the page and reorders
   * nothing. A reader could not tell a robustness result from a disconnected wire.
   *
   * Measured, never listed: an input is inert when moving it from one end of its own sweep
   * to the other leaves every priced figure identical. A list of names would go stale the
   * day one of them is wired up, which is exactly the day the claim would start lying.
   */
  inerte: boolean;
  /** What the ranking becomes outside the band, if it changes. */
  becomes: string | null;
};

const order = (a: Assumptions, levers = LEVERS) =>
  priceAll(SCENARIO, a, levers).map((p) => p.step).join(" → ");

/**
 * Every figure the pricing produces, in one comparable string.
 *
 * `order()` is deliberately blind to magnitude — that is what makes it the right test for
 * "does this reorder". It is the wrong test for "does the model read this at all", and using
 * it for both is how an unread input earned a verdict that sounded like a measurement.
 */
const empreinte = (a: Assumptions, levers = LEVERS) =>
  priceAll(SCENARIO, a, levers)
    .map((p) => `${p.step}:${p.extraRetained}:${p.extraRevenue}:${p.cost}:${p.perDollar}`)
    .join("|");

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
      inerte: empreinte({ ...ASSUMPTIONS, [key]: low }) === empreinte({ ...ASSUMPTIONS, [key]: high }),
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
    const lever = (v: number) => ({ ...LEVERS, [step]: { ...LEVERS[step], cost: v } });
    out.push({
      name: `cost of fixing ${step}`, current: base, from, to,
      decides: from > base / 5 + 1e-9 || to < base * 5 - 1e-9,
      inerte: empreinte(ASSUMPTIONS, lever(base / 5)) === empreinte(ASSUMPTIONS, lever(base * 5)),
      becomes,
    });
  }

  return out;
}

/**
 * The three verdicts, and why there are three rather than two.
 *
 * "No effect on the order" is a real result when the input moves every figure and reorders
 * nothing. It is not a result at all when nothing reads the input: that verdict then says
 * something about the wiring while sounding like something about the funnel. The tool's own
 * adversarial list names exactly this failure — a number that is arithmetically correct and
 * means the opposite of what it appears to — so it does not get to publish one.
 */
export const verdictOf = (b: Band): string =>
  b.inerte ? "not read by the model" : b.decides ? "decides" : "no effect on the order";

if (isMain(import.meta)) {
  const money = (x: number) => (x >= 100 ? "$" + Math.round(x).toLocaleString("en-GB") : x.toFixed(2));

  console.log("\nWhich of these decide the ranking?\n");
  console.log("input                        in use        ranking unchanged over        verdict");
  console.log("─".repeat(96));

  for (const b of bands()) {
    console.log(
      `${b.name.padEnd(28)}${money(b.current).padStart(10)}` +
      `${(money(b.from) + " – " + money(b.to)).padStart(30)}   ` +
      verdictOf(b),
    );
  }

  console.log("\nWhere the order changes\n");
  for (const b of bands().filter((x) => x.decides && x.becomes)) {
    console.log(`  ${b.name}: outside ${money(b.from)}–${money(b.to)} the order becomes`);
    console.log(`    ${b.becomes}\n`);
  }

  const inertes = bands().filter((b) => b.inerte);
  if (inertes.length > 0) {
    console.log("Read by nothing in the model\n");
    for (const b of inertes) {
      console.log(`  ${b.name.padEnd(28)}editable on the screen, swept here, and never read`);
    }
    console.log(
      "\n  Their stability is a fact about the wiring, not about the funnel. Filing them under\n" +
      "  the same verdict as a swept result is the failure this tool spends a page naming.\n",
    );
  }

  console.log(
    "The revenue per customer scales every step equally, so it moves every figure on the page\n" +
    "and changes nothing about which to fix first. The lever costs are the opposite: they are\n" +
    "the least known numbers here and the only ones that reorder the answer.\n",
  );
}
