/**
 * What fixing each step is actually worth — which is not what the leak chart says.
 *
 * The instruction a growth team receives is "fix the worst step", and a funnel chart is
 * what they are given to identify it. The chart cannot do that, and the reason is
 * structural rather than a matter of reading it more carefully:
 *
 * **A funnel chart contains no costs.** Two points of signup and ten points of activation
 * are both "an improvement" on a chart. One is a week of copywriting and the other is a
 * quarter of engineering, and nothing on the page distinguishes them.
 *
 * **A funnel chart contains no volumes downstream.** Points added near the top flow
 * through every step after them, multiplied by the whole population. Points added near the
 * bottom apply to whoever is left.
 *
 * Put the two together and the ranking by return spreads across a factor of fifteen — on a
 * chart where every step looks like a bar next to another bar.
 *
 * The sharpest way to see it: **the same funnel, with different beliefs about what can be
 * moved and at what price, produces a different answer — and the chart does not move a
 * pixel.** The ranking was never a property of the funnel. `compare()` below shows it.
 *
 * ---
 *
 * Measured by **re-running the funnel**, not by multiplying rates on a page. The two agree
 * only when every step is independent of every other, which they are here and are not in
 * life: a signup flow that filters harder produces fewer, better signups, and a
 * spreadsheet that multiplies the old activation rate by the new signup count silently
 * assumes otherwise. Re-running keeps the tool honest about a thing it cannot see, and
 * makes it easy to fix on the day the population model learns to represent it.
 */

import { generate, SCENARIO, reached, STEPS } from "./population.ts";
import { ASSUMPTIONS } from "./assumptions.ts";
import { isMain } from "./cli.ts";
import type { Assumptions } from "./assumptions.ts";
import type { Scenario, Step } from "./population.ts";

export type Improvable = Exclude<Step, "visit">;

/**
 * What it costs to move a step, and how far it can be moved.
 *
 * Both are chosen, and both are the honest weak point of this tool: nobody can hand you
 * the price of two points of activation. They are inputs, they are swept, and the page
 * reports which of them decide the ranking.
 *
 * The shape is not arbitrary, though. Steps near the top are cheap to move and cannot move
 * far — a landing page is a week of work and there is only so much copy can do. Steps near
 * the bottom are expensive and can move a long way, because they are product problems.
 */
export const LEVERS: Record<Improvable, { cost: number; ceiling: number; what: string }> = {
  signup: { cost: 40_000, ceiling: 0.04, what: "landing page, form length, social proof" },
  activate: { cost: 120_000, ceiling: 0.10, what: "onboarding flow, first-run experience, guided setup" },
  subscribe: { cost: 180_000, ceiling: 0.06, what: "pricing page, trial length, sales assist" },
  retain: { cost: 260_000, ceiling: 0.08, what: "product depth, support, lifecycle messaging" },
};

export type Priced = {
  step: Improvable;
  /** Points of improvement being priced. */
  points: number;
  /** Extra people retained at the end of the funnel, per year. */
  extraRetained: number;
  /** Annual revenue that represents. */
  extraRevenue: number;
  cost: number;
  /** Revenue per dollar spent. The number that decides. */
  perDollar: number;
  /** Rank by conversion rate — how a funnel chart orders them. */
  leakRank: number;
  /** Rank by return — how they should be ordered. */
  valueRank: number;
};

const retained = (s: Scenario) => generate(s).filter((u) => reached(u, "retain")).length;

/**
 * Price one step's improvement by re-running the funnel with it applied.
 *
 * The improvement is applied from month zero, unlike the scenario's own mid-period change:
 * the question here is "what would this be worth", not "what did this do".
 */
export function price(
  step: Improvable,
  points: number,
  s: Scenario = SCENARIO,
  a: Assumptions = ASSUMPTIONS,
): { extraRetained: number; extraRevenue: number } {
  const before = retained({ ...s, improve: null });
  const after = retained({ ...s, improve: { step, by: points, from: 0 } });

  /* The scenario covers `months` months; annualise so the number sits beside a budget. */
  const perYear = (n: number) => (n * 12) / s.months;
  const extraRetained = perYear(after - before);

  return { extraRetained, extraRevenue: extraRetained * a.annualRevenuePerCustomer };
}

export function priceAll(
  s: Scenario = SCENARIO,
  a: Assumptions = ASSUMPTIONS,
  levers: Record<Improvable, { cost: number; ceiling: number; what: string }> = LEVERS,
): Priced[] {
  const steps = Object.keys(levers) as Improvable[];

  const priced = steps.map((step) => {
    const points = levers[step].ceiling;
    const { extraRetained, extraRevenue } = price(step, points, s, a);
    const cost = levers[step].cost;
    return {
      step, points, extraRetained, extraRevenue, cost,
      perDollar: cost === 0 ? Infinity : extraRevenue / cost,
      leakRank: 0, valueRank: 0,
    };
  });

  /*
   * How a funnel chart orders them: worst conversion rate first.
   *
   * Not by absolute people lost, which would put the first step first in every funnel ever
   * drawn and would be a straw man. A chart shows rates, a reader compares rates, and the
   * lowest one is what "the worst step" means to everybody who has ever been handed one.
   */
  const users = generate({ ...s, improve: null });
  const rate = (step: Improvable, from: Step) => {
    const eligible = users.filter((u) => reached(u, from)).length;
    return eligible === 0 ? 1 : users.filter((u) => reached(u, step)).length / eligible;
  };
  const rates: Record<Improvable, number> = {
    signup: rate("signup", "visit"),
    activate: rate("activate", "signup"),
    subscribe: rate("subscribe", "activate"),
    retain: rate("retain", "subscribe"),
  };

  const byLeak = [...priced].sort((x, y) => rates[x.step] - rates[y.step]);
  const byValue = [...priced].sort((x, y) => y.perDollar - x.perDollar);
  for (const p of priced) {
    p.leakRank = byLeak.findIndex((x) => x.step === p.step) + 1;
    p.valueRank = byValue.findIndex((x) => x.step === p.step) + 1;
  }

  return byValue;
}

/**
 * The same funnel, priced under different beliefs about the levers.
 *
 * This is the demonstration. Nothing about the users changes — the chart, the rates, the
 * intervals, every bar is identical. Only what somebody believes about the cost and reach
 * of each fix changes, and the ranking inverts.
 *
 * Which means the ranking was never in the funnel. It was in the levers, and the levers are
 * the part nobody writes down.
 */
export type Levers = Record<Improvable, { cost: number; ceiling: number; what: string }>;

export function compare(
  alternative: Partial<Levers>,
  s: Scenario = SCENARIO,
  a: Assumptions = ASSUMPTIONS,
): { base: Priced[]; other: Priced[]; reordered: boolean } {
  const base = priceAll(s, a);
  const other = priceAll(s, a, { ...LEVERS, ...alternative } as Levers);
  return {
    base, other,
    reordered: base.map((p) => p.step).join() !== other.map((p) => p.step).join(),
  };
}

/**
 * Named situations a reader can put the tool in with one click.
 *
 * The finding is that the ranking moves when a belief about a lever moves. An interface
 * that requires typing two numbers into two boxes before anything happens does not
 * demonstrate that — it asks the reader to take it on trust and then do data entry.
 *
 * Each of these is a sentence somebody would actually say in a planning meeting, and each
 * is a real position rather than a value picked to make the order flip. The page reports
 * what happens, including when nothing does.
 */
export const SCENARIOS: { id: string; levers: Partial<Levers> }[] = [
  { id: "depart", levers: {} },
  {
    id: "pageEpuisee",
    levers: { signup: { cost: 90_000, ceiling: 0.01, what: "a landing page already rebuilt twice" } },
  },
  {
    id: "onboardingFacile",
    levers: { activate: { cost: 40_000, ceiling: 0.10, what: "an onboarding flow the team has done before" } },
  },
  {
    id: "retentionUrgente",
    levers: { retain: { cost: 520_000, ceiling: 0.16, what: "retention with a doubled budget and a doubled ceiling" } },
  },
];

/** The sentence the tool exists to produce. */
export function verdict(priced: Priced[]): string {
  const best = priced[0]!;
  const worst = priced[priced.length - 1]!;
  const leakiest = priced.find((p) => p.leakRank === 1)!;
  const money = (x: number) => "$" + Math.round(x).toLocaleString("en-GB");

  const spread = `The best and worst places to spend differ by **${(best.perDollar / worst.perDollar).toFixed(0)}×** ` +
    `— \`${best.step}\` returns ${best.perDollar.toFixed(1)}× the money put into it, \`${worst.step}\` returns ` +
    `${worst.perDollar.toFixed(1)}×. Nothing on a funnel chart distinguishes them: it carries no costs and no ` +
    `downstream volumes, so the two facts that decide are the two it does not contain.`;

  const chart = best.step === leakiest.step
    ? ` Here the chart happens to point at the right step, which is luck rather than method — ` +
      `see the reordering below, where the same chart points at a different one.`
    : ` The chart's worst step, \`${leakiest.step}\`, is ${(best.perDollar / leakiest.perDollar).toFixed(1)}× ` +
      `worse value than \`${best.step}\`.`;

  return spread + chart;
}

if (isMain(import.meta)) {
  const priced = priceAll();
  const money = (x: number) => "$" + Math.round(x).toLocaleString("en-GB");

  console.log("\nWhat one improvement to each step is worth\n");
  console.log("step        points   extra retained/yr    extra revenue      cost      per $   leak rank");
  console.log("─".repeat(96));

  for (const p of priced) {
    console.log(
      `${p.step.padEnd(11)}${("+" + (p.points * 100).toFixed(0) + " pt").padStart(7)}` +
      `${Math.round(p.extraRetained).toLocaleString("en-GB").padStart(19)}` +
      `${money(p.extraRevenue).padStart(17)}${money(p.cost).padStart(11)}` +
      `${p.perDollar.toFixed(2).padStart(8)}×${String(p.leakRank).padStart(11)}`,
    );
  }

  console.log("\n" + verdict(priced).replace(/\*\*/g, "").replace(/`/g, "") + "\n");

  /*
   * The same funnel, under a different belief about one lever.
   *
   * A team that has already rebuilt its landing page twice does not get four more points
   * out of it cheaply. Nothing about the users changes here — every bar on the chart is
   * identical — and the ranking moves.
   */
  const c = compare({ signup: { cost: 90_000, ceiling: 0.01, what: "a landing page already rebuilt twice" } });
  if (c.reordered) {
    console.log("The same funnel, one lever believed differently\n");
    console.log("  signup is now $90,000 for one point rather than $40,000 for four —");
    console.log("  a page that has already been rebuilt twice. Nothing else changes.\n");
    console.log("  order by return, before:  " + c.base.map((p) => p.step).join(" → "));
    console.log("  order by return, after:   " + c.other.map((p) => p.step).join(" → "));
    console.log("\n  The chart did not move a pixel. The ranking was never in the funnel.\n");
  }

  console.log("What each lever actually is\n");
  for (const p of priced) console.log(`  ${p.step.padEnd(11)}${LEVERS[p.step].what}`);

  console.log(
    "\nPriced by re-running the funnel, not by multiplying rates on a page. The two agree only" +
    "\nwhen the steps are independent of each other — which they are in this model and are not" +
    "\nin life, and that limitation is stated rather than hidden behind a spreadsheet.\n",
  );
}
