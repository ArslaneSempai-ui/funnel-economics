/**
 * The figures this README is allowed to state.
 *
 * Typing a figure by hand gives it no link to the thing it describes; generating it does.
 * Every other repository here learned that the expensive way — one of them published a
 * headline that disagreed with its own code three separate times — so this one starts with
 * the generator rather than arriving at it.
 */

import { generate, SCENARIO } from "./population.ts";
import { measure, worstStep, endToEnd } from "./funnel.ts";
import { priceAll, compare, verdict, LEVERS } from "./value.ts";
import { bands } from "./sensitivity.ts";
import { TRAPS } from "./adversarial.ts";
import { compareAll } from "./baselines.ts";
import { INVENTORY } from "./inventory.ts";
import { markdown } from "./provenance.ts";
import { ASSUMPTIONS } from "./assumptions.ts";
import { run as emit, table } from "./figures.ts";

const users = generate();
const rates = measure(users);
const priced = priceAll();
const pc = (x: number) => (x * 100).toFixed(1) + " %";
const money = (x: number) => "$" + Math.round(x).toLocaleString("en-GB");
const n = (x: number) => Math.round(x).toLocaleString("en-GB");

const best = priced[0]!;
const worst = priced[priced.length - 1]!;

const finding =
  `**The finding.** The best and worst places to spend on this funnel differ by ` +
  `**${(best.perDollar / worst.perDollar).toFixed(0)}×** — \`${best.step}\` returns ` +
  `${best.perDollar.toFixed(1)}× the money put into it, \`${worst.step}\` returns ` +
  `${worst.perDollar.toFixed(1)}×. A funnel chart cannot tell you that, and not because you ` +
  `are reading it wrong: it carries **no costs and no downstream volumes**, which are the ` +
  `only two facts that decide. Change one belief about what a fix costs — nothing about the ` +
  `users, not a single bar on the chart — and the order changes.`;

const funnelTable = table(
  ["Step", "Entered", "Converted", "Rate", "95 % interval", "± points"],
  rates.map((r) => [
    "`" + r.step + "`", n(r.entered), n(r.converted), pc(r.rate),
    `[${pc(r.low)} – ${pc(r.high)}]`, r.precision.toFixed(1),
  ]),
);

const e = endToEnd(users);
const w = worstStep(rates);
const funnelNote =
  `${n(e.retained)} of ${n(e.entered)} visits end up retained — **${pc(e.rate)}** ` +
  `[${(e.low * 100).toFixed(2)}–${(e.high * 100).toFixed(2)}].\n\n` +
  `Worst step by rate: \`${w.worst.step}\` at ${pc(w.worst.rate)}. ` +
  (w.identifiable
    ? "No other step's interval reaches it, so the ranking holds — which is not the usual case."
    : `But \`${w.tied.map((t) => t.step).join("`, `")}\` overlap${w.tied.length === 1 ? "s" : ""} it. ` +
      `This sample cannot say which is worse, and the tool refuses to.`);

const valueTable = table(
  ["Step", "Points", "Extra customers/yr", "Extra revenue", "Cost", "Per $", "Chart rank"],
  priced.map((p) => [
    "`" + p.step + "`", "+" + (p.points * 100).toFixed(0) + " pt", n(p.extraRetained),
    money(p.extraRevenue), money(p.cost), `**${p.perDollar.toFixed(2)}×**`, p.leakRank,
  ]),
);

const reorder = (() => {
  const c = compare({ signup: { cost: 90_000, ceiling: 0.01, what: "a page already rebuilt twice" } });
  if (!c.reordered) return "On these levers the ranking does not move.";
  return `Suppose the landing page has already been rebuilt twice, so signup is ` +
    `**$90,000 for one point** rather than $40,000 for four. Nothing about the users changes. ` +
    `Not one bar on the chart moves.\n\n` +
    `| | Order by return |\n|---|---|\n` +
    `| before | ${c.base.map((p) => "`" + p.step + "`").join(" → ")} |\n` +
    `| after | ${c.other.map((p) => "`" + p.step + "`").join(" → ")} |\n\n` +
    `The ranking was never a property of the funnel. It is a property of the levers — and the ` +
    `levers are the part nobody writes down.`;
})();

const sensitivity = (() => {
  const b = bands();
  const t = table(
    ["Input", "In use", "Ranking unchanged over", "Verdict"],
    b.map((x) => [
      "`" + x.name + "`",
      x.current >= 100 ? money(x.current) : x.current.toFixed(2),
      (x.current >= 100 ? money(x.from) + " – " + money(x.to) : x.from.toFixed(2) + " – " + x.to.toFixed(2)),
      x.decides ? "**decides**" : "no effect on the order",
    ]),
  );
  return `${t}\n\nThe revenue per customer scales every step equally, so it moves every figure ` +
    `on the page and changes nothing about which to fix first. That is the assumption a reader ` +
    `is most likely to argue about, and the one that matters least. The lever costs are the ` +
    `opposite: the least known numbers here, and the only ones that reorder the answer.`;
})();

const traps = TRAPS.map((t) =>
  `### ${t.name}\n\n` +
  `**Appears to say.** ${t.appears.replace(/\s+/g, " ")}\n\n` +
  `**Actually.** ${t.truth.replace(/\s+/g, " ")}\n\n` +
  "```\n" + t.evidence().join("\n") + "\n```\n\n" +
  `**How to catch it.** ${t.caught.replace(/\s+/g, " ")}`,
).join("\n\n");

const baselines = (() => {
  const rows = compareAll();
  const t = table(
    ["Way of deciding", "What it needs", "Picks", "Return"],
    rows.map((r) => [
      r.strategy === "this tool" ? `**${r.strategy}**` : r.strategy,
      r.needs, "`" + r.step + "`", r.perDollar.toFixed(2) + "×",
    ]),
  );
  const chart = rows.find((r) => r.strategy === "fix the worst step")!;
  const tool = rows[0]!;
  const note = chart.step === tool.step
    ? `**The chart agrees with the analysis here, and that is worth saying plainly rather than ` +
      `hiding.** On this funnel a reader would have reached the same answer for free. What the ` +
      `analysis adds is knowing *that* the chart is right — and the sweep above shows how little ` +
      `has to change for it to stop being.`
    : `A chart would have picked \`${chart.step}\`, at ${chart.perDollar.toFixed(2)}× against ` +
      `${tool.perDollar.toFixed(2)}×.`;
  return `${t}\n\n${note}`;
})();

const provenance = markdown(INVENTORY, table);

emit(new URL("../README.md", import.meta.url).pathname,
  { finding, funnelTable, funnelNote, valueTable, reorder, sensitivity, traps, baselines, provenance });
