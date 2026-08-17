/**
 * Every number this tool puts on a page, and where it came from.
 *
 * This is the only tool in the portfolio with **no retrieved figures at all**, and that is
 * worth saying rather than quietly leaving the column empty. The compliance tools rest on
 * the Code of Federal Regulations: a public text, dated, quotable, needing no defence from
 * me. There is no equivalent for growth. Industry conversion benchmarks exist, they are
 * published by companies selling the thing being benchmarked, and citing one would look
 * like rigour while being the opposite.
 *
 * So nothing here is retrieved, and the page says so. What is measured is measured on a
 * population I designed; what turns it into money is assumed and swept; what decides the
 * ranking is chosen and is the honest weak point.
 *
 * The uncomfortable line is `LEVERS`. The whole finding rests on it — the ranking is a
 * property of the levers, not of the funnel, which is precisely why the levers being
 * unknowable is the finding rather than a footnote to it.
 */

import { ASSUMPTIONS } from "./assumptions.ts";
import { LEVERS } from "./value.ts";
import { TRUE_RATES, SCENARIO } from "./population.ts";
import type { Inventory } from "./provenance.ts";

export const INVENTORY: Inventory = [
  /* ── measured ── */
  {
    name: "step rates",
    provenance: "measured",
    what: "conversion at each step, with a 95 % interval",
    note: "measured on the synthetic population below — see `TRUE_RATES`",
  },
  {
    name: "worstStep",
    provenance: "measured",
    what: "which step converts worst, and whether the sample can say so at all",
    note: "returns a tie when intervals overlap, rather than inventing a ranking",
  },
  {
    name: "extraRetained",
    provenance: "measured",
    what: "customers a given improvement produces, per year",
    note: "by re-running the funnel, not by multiplying rates on a page",
  },
  {
    name: "traps",
    provenance: "measured",
    what: "five funnels where the obvious reading is wrong",
    note: "each checked against the generator's ground truth, which a real dashboard has not got",
  },

  /* ── assumed ── */
  {
    name: "annualRevenuePerCustomer",
    provenance: "assumed",
    what: "what one retained customer is worth in a year",
    note: "your finance team knows this; the sweep shows it does not change the ranking",
  },
  {
    name: "costPerPaidVisit",
    provenance: "assumed",
    what: "what one paid visit costs",
    note: "your ad platform knows this exactly",
  },
  {
    name: "monthsToShip",
    provenance: "assumed",
    what: "how long a fix takes to reach users",
    note: "your own delivery history",
  },

  /* ── chosen ── */
  {
    name: "LEVERS",
    provenance: "chosen",
    what: "what each fix costs, and how far it can move its step",
    note: "the load-bearing choice: the ranking is a property of these, not of the funnel — and nobody publishes them",
  },
  {
    name: "TRUE_RATES",
    provenance: "chosen",
    what: "the generator's per-channel conversion rates",
    note: "shaped so paid converts worse at the top and better at the bottom, which is what makes the mix matter",
  },
  {
    name: "SCENARIO",
    provenance: "chosen",
    what: `${SCENARIO.months} months, ${SCENARIO.visitsPerMonth.toLocaleString("en-GB")} visits a month, paid share ${(SCENARIO.paidShareStart * 100).toFixed(0)} % → ${(SCENARIO.paidShareEnd * 100).toFixed(0)} %`,
    note: "the mix shift is deliberate; it is what produces the Simpson's-paradox trap",
  },
  {
    name: "no retrieved figures",
    provenance: "chosen",
    what: "the decision to cite nothing",
    note: "growth benchmarks are published by companies selling the thing benchmarked; citing one would look like rigour and be the opposite",
  },
];

export const MUST_DECLARE = {
  assumptions: Object.keys(ASSUMPTIONS),
  levers: Object.keys(LEVERS),
  channels: Object.keys(TRUE_RATES),
};
