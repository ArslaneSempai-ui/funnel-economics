/**
 * Funnels built to mislead, rather than funnels drawn from the ordinary run.
 *
 * Every measurement in this repository is honest about its intervals and its assumptions,
 * and none of that protects against the failure that actually happens: a number that is
 * arithmetically correct and means the opposite of what it appears to.
 *
 * These are constructed. Each one is a funnel where the obvious reading is wrong, with the
 * true state of the world available to check against — which is the one thing a real
 * dashboard never gives you. They are not scored as a rate; the point is that each trap is
 * **named**, and a named trap is one somebody can look for.
 *
 * The first is the one that matters. It is not a curiosity.
 */

import { generate, SCENARIO } from "./population.ts";
import { measure, measureBy, measureMonth } from "./funnel.ts";
import { wilson } from "./interval.ts";
import { isMain } from "./cli.ts";

export type Trap = {
  id: string;
  name: string;
  /** What the dashboard appears to say. */
  appears: string;
  /** What is actually true. */
  truth: string;
  /** How to catch it, in one instruction somebody can follow on Monday. */
  caught: string;
  /** The figures, measured. */
  evidence: () => string[];
};

const pc = (x: number) => (x * 100).toFixed(1) + " %";

export const TRAPS: Trap[] = [
  {
    id: "T-SIMPSON",
    name: "Every segment improved and the total fell",
    appears:
      "Signup conversion dropped from month 0 to month 5. Whatever shipped in month 3 " +
      "made things worse, and should be rolled back.",
    truth:
      "Signup improved by two points in both channels — it was shipped deliberately and it " +
      "worked. Paid traffic went from a fifth of the mix to two thirds over the same period, " +
      "and paid converts at half the rate organic does. The mix moved, not the product.",
    caught:
      "Never compare an aggregate rate across periods when the mix can move. Split by " +
      "channel first, every time — and if the channel split is not in your data, that is " +
      "the finding.",
    evidence: () => {
      const users = generate();
      const first = measureMonth(users, 0);
      const last = measureMonth(users, SCENARIO.months - 1);
      const line = (label: string, a: number, b: number) =>
        `  ${label.padEnd(22)}${pc(a).padStart(8)}  →  ${pc(b).padStart(8)}   ${b > a ? "up" : "DOWN"}`;

      const byChan = (m: number, c: "organic" | "paid") =>
        measureBy(users.filter((u) => u.month === m), c)[0]!.rate;

      return [
        line("everyone", first[0]!.rate, last[0]!.rate),
        line("  organic only", byChan(0, "organic"), byChan(SCENARIO.months - 1, "organic")),
        line("  paid only", byChan(0, "paid"), byChan(SCENARIO.months - 1, "paid")),
        `  paid share of traffic ${pc(SCENARIO.paidShareStart).padStart(8)}  →  ${pc(SCENARIO.paidShareEnd).padStart(8)}`,
      ];
    },
  },
  {
    id: "T-SURVIVOR",
    name: "The last step looks best because only the best get there",
    appears:
      "Retention is 76 % — the healthiest step in the funnel. Nothing to do here.",
    truth:
      "Retention is measured on people who already signed up, activated and paid. They are " +
      "the most committed users the funnel produces, three filters deep. A 76 % rate among " +
      "them says nothing about whether the product retains anybody else, because nobody " +
      "else is in the denominator.",
    caught:
      "Read every step's rate together with the size of its denominator. A rate on 2,600 " +
      "people who survived three filters is a different kind of object from a rate on " +
      "120,000 arrivals, and putting them in the same column invites the comparison.",
    evidence: () => {
      const rates = measure(generate());
      return rates.map((r) =>
        `  ${r.step.padEnd(12)}${pc(r.rate).padStart(8)}   on ${r.entered.toLocaleString("en-GB").padStart(8)} people` +
        `   ${r.precision.toFixed(1)} pts wide`);
    },
  },
  {
    id: "T-PRECISION",
    name: "A decimal place that is not there",
    appears:
      "Retention moved from 75.9 % to 77.1 %. Up 1.2 points — the lifecycle work is paying off.",
    truth:
      "The interval on that rate is over three points wide. A 1.2-point move is inside it, " +
      "which means the two numbers are the same number as far as this sample can tell. The " +
      "dashboard printed a decimal place it had not earned.",
    caught:
      "Ask for the denominator before believing a decimal. 2,600 observations buy you " +
      "roughly ±1.7 points at 95 %; anything finer is decoration.",
    evidence: () => {
      const r = measure(generate())[3]!;
      const [lo, hi] = wilson(r.converted, r.entered);
      return [
        `  retain: ${r.converted.toLocaleString("en-GB")} of ${r.entered.toLocaleString("en-GB")}`,
        `  rate ${pc(r.rate)}, 95 % interval [${pc(lo)} – ${pc(hi)}] — ${(hi - lo) * 100 > 1.2 ? "wider" : "narrower"} than the 1.2-point "improvement"`,
      ];
    },
  },
  {
    id: "T-VOLUME",
    name: "The rate fell and the business grew",
    appears: "Signup conversion is down. The top of the funnel is broken.",
    truth:
      "More traffic at a lower rate can produce more customers than less traffic at a " +
      "higher one. A rate is a ratio, and a ratio deliberately throws away the number that " +
      "pays the bills.",
    caught:
      "Put the count beside every rate. If a chart shows only percentages, it cannot tell " +
      "you whether the business grew.",
    evidence: () => {
      /*
       * A different scenario from the rest of this page: traffic grows 18 % a month.
       *
       * The published funnel has flat traffic, so a falling rate there also means falling
       * counts — the first version of this trap printed evidence that contradicted its own
       * claim. A trap needs a world where it happens; saying which world is the honest part.
       */
      const users = generate({ ...SCENARIO, visitGrowth: 0.18 });
      const m0 = users.filter((u) => u.month === 0);
      const mN = users.filter((u) => u.month === SCENARIO.months - 1);
      const signups = (xs: typeof users) => xs.filter((u) => u.reached !== "visit").length;
      return [
        `  month 0:  ${pc(signups(m0) / m0.length)} of ${m0.length.toLocaleString("en-GB")} = ${signups(m0).toLocaleString("en-GB")} signups`,
        `  month ${SCENARIO.months - 1}:  ${pc(signups(mN) / mN.length)} of ${mN.length.toLocaleString("en-GB")} = ${signups(mN).toLocaleString("en-GB")} signups`,
        `  (this trap runs on a variant where traffic grows 18 % a month — the published funnel is flat)`,
      ];
    },
  },
  {
    id: "T-RANK",
    name: "Ranking two steps the sample cannot tell apart",
    appears: "Activation is our second-worst step, so it is second on the roadmap.",
    truth:
      "Two steps whose intervals overlap are not ranked by any sample that produced them. " +
      "Ordering a roadmap by a difference smaller than the measurement error is ordering it " +
      "at random, with a chart to blame afterwards.",
    caught:
      "Before ranking, check whether the intervals overlap. If they do, the ranking is a " +
      "coin toss and the honest output is a tie.",
    evidence: () => {
      const rates = measure(generate());
      return rates.map((r) => `  ${r.step.padEnd(12)}[${pc(r.low)} – ${pc(r.high)}]`);
    },
  },
];

if (isMain(import.meta)) {
  console.log(`\n${TRAPS.length} funnels built to mislead\n`);

  for (const t of TRAPS) {
    console.log(`── ${t.id} — ${t.name}`);
    console.log(`\n   Appears to say:  ${t.appears.replace(/\s+/g, " ")}`);
    console.log(`\n   Actually:        ${t.truth.replace(/\s+/g, " ")}\n`);
    for (const line of t.evidence()) console.log(line);
    console.log(`\n   How to catch it: ${t.caught.replace(/\s+/g, " ")}\n`);
  }

  console.log(
    "None of these is a mistake in the arithmetic. Every number above is correct, and every\n" +
    "one of them means something other than what it appears to. That is the failure mode a\n" +
    "confidence interval does not protect against, and the reason this list is named rather\n" +
    "than scored.\n",
  );
}
