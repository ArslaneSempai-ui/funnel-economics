/**
 * Against doing no analysis at all.
 *
 * A tool that recommends something is only worth its complexity if the recommendation beats
 * what somebody would have done without it. The four strategies below are the ones actually
 * used in the room, and three of them need no model — a funnel chart, a budget, or nothing.
 *
 * "Fix the worst step" is what a funnel chart invites. "Fix retention" is what the last
 * article anybody read said. "Fix the cheapest" is what a constrained quarter produces. If
 * the analysis cannot beat those, it is decoration with a methodology section.
 */

import { priceAll, LEVERS } from "./value.ts";
import { isMain } from "./cli.ts";
import type { Priced, Improvable } from "./value.ts";

export type Strategy = { name: string; needs: string; pick: (p: Priced[]) => Priced };

export const STRATEGIES: Strategy[] = [
  {
    name: "this tool",
    needs: "the funnel, the levers, a price per customer",
    pick: (p) => p[0]!,
  },
  {
    name: "fix the worst step",
    needs: "a funnel chart",
    pick: (p) => p.find((x) => x.leakRank === 1)!,
  },
  {
    name: "fix retention",
    needs: "nothing",
    pick: (p) => p.find((x) => x.step === "retain")!,
  },
  {
    name: "fix the cheapest",
    needs: "a budget",
    pick: (p) => p.reduce((lo, x) => (x.cost < lo.cost ? x : lo), p[0]!),
  },
];

export type Comparison = { strategy: string; needs: string; step: Improvable; revenue: number; cost: number; perDollar: number };

export function compareAll(): Comparison[] {
  const priced = priceAll();
  return STRATEGIES.map((s) => {
    const p = s.pick(priced);
    return { strategy: s.name, needs: s.needs, step: p.step, revenue: p.extraRevenue, cost: p.cost, perDollar: p.perDollar };
  });
}

if (isMain(import.meta)) {
  const rows = compareAll();
  const money = (x: number) => "$" + Math.round(x).toLocaleString("en-GB");
  const best = rows[0]!;

  console.log("\nWhat each way of deciding actually picks\n");
  console.log("strategy               needs                                       picks       return");
  console.log("─".repeat(92));

  for (const r of rows) {
    console.log(
      `${r.strategy.padEnd(23)}${r.needs.padEnd(44)}${r.step.padEnd(12)}${r.perDollar.toFixed(2).padStart(7)}×`,
    );
  }

  const worst = rows.reduce((lo, r) => (r.perDollar < lo.perDollar ? r : lo), rows[0]!);
  console.log(
    `\nThe spread between the best and worst way of deciding is ` +
    `${(best.perDollar / worst.perDollar).toFixed(0)}× on the same funnel.\n`,
  );

  const chart = rows.find((r) => r.strategy === "fix the worst step")!;
  console.log(
    chart.step === best.step
      ? "Note that the chart agrees with the analysis here. That is worth saying plainly rather\n" +
        "than hiding: on this funnel a reader would have reached the same answer for free. The\n" +
        "sensitivity sweep shows how little has to change for that to stop being true.\n"
      : `A funnel chart would have picked ${chart.step}, at ${chart.perDollar.toFixed(2)}× against ` +
        `${best.perDollar.toFixed(2)}×.\n`,
  );
}
