/**
 * Measuring the funnel, with the thing dashboards leave off.
 *
 * Every analytics tool prints a step rate to one decimal place. Almost none of them prints
 * how much of that decimal place is real. A step measured on 400 people carries roughly
 * ±5 points of interval, which means "18.2 % against 20.1 %" is a sentence about noise —
 * and it is exactly the sentence that gets a quarter of work assigned to it.
 *
 * So every rate here arrives with its interval, and the tool refuses to rank two steps it
 * cannot tell apart. That refusal is the point: the most common funnel decision is "fix the
 * worst step", and the worst step is frequently not distinguishable from the second-worst.
 */

import { generate, reached, STEPS, CHANNELS, SCENARIO } from "./population.ts";
import { wilson, ENOUGH } from "./interval.ts";
import { isMain } from "./cli.ts";
import type { User, Step, Channel, Scenario } from "./population.ts";

export type StepRate = {
  step: Exclude<Step, "visit">;
  /** The step people had to have reached to be eligible for this one. */
  from: Step;
  entered: number;
  converted: number;
  rate: number;
  low: number;
  high: number;
  /** Width of the 95 % interval, in points. The number a dashboard never shows. */
  precision: number;
  /** Enough observations to report a rate at all. */
  reportable: boolean;
};

const PAIRS: { step: Exclude<Step, "visit">; from: Step }[] = [
  { step: "signup", from: "visit" },
  { step: "activate", from: "signup" },
  { step: "subscribe", from: "activate" },
  { step: "retain", from: "subscribe" },
];

export function measure(users: User[]): StepRate[] {
  return PAIRS.map(({ step, from }) => {
    const eligible = users.filter((u) => reached(u, from));
    const converted = eligible.filter((u) => reached(u, step)).length;
    const [low, high] = wilson(converted, eligible.length);
    return {
      step, from,
      entered: eligible.length,
      converted,
      rate: eligible.length === 0 ? 0 : converted / eligible.length,
      low, high,
      precision: (high - low) * 100,
      reportable: eligible.length >= ENOUGH,
    };
  });
}

/** The same, split by channel — which is where an aggregate stops being trustworthy. */
export function measureBy(users: User[], channel: Channel): StepRate[] {
  return measure(users.filter((u) => u.channel === channel));
}

export function measureMonth(users: User[], month: number): StepRate[] {
  return measure(users.filter((u) => u.month === month));
}

/**
 * Which step is worst, and whether the question can be answered at all.
 *
 * "Fix the worst step" is the most common instruction a growth team receives, and it
 * assumes the worst step is identifiable. Two steps whose intervals overlap are not
 * ranked — saying which is worse would be inventing a fact.
 *
 * Note this ranks by *rate*, which is the wrong basis for deciding what to fix. That is
 * what `value.ts` is for, and separating the two is deliberate: the leakiest step and the
 * most valuable step to fix are usually not the same one, and running them together is how
 * that gets missed.
 */
export function worstStep(rates: StepRate[]): {
  worst: StepRate | null;
  /** Steps whose interval overlaps the worst — indistinguishable from it. */
  tied: StepRate[];
  identifiable: boolean;
} {
  const usable = rates.filter((r) => r.reportable);
  /*
   * NO REPORTABLE STEP IS A REFUSAL, NOT AN ANSWER.
   *
   * The previous shape declared `worst: StepRate` and got it from `reduce(..., usable[0]!)`.
   * On an empty `usable` that reduce returns `undefined` without iterating, and the filter
   * below never runs its callback — so nothing threw. The function returned
   * `{ worst: undefined, tied: [], identifiable: true }`: the strongest verdict it can give,
   * *"the worst step is identifiable"*, produced from zero observations, with the type
   * claiming a `StepRate` that was not there. Reachable through `measureBy` and
   * `measureMonth`, which slice the population down as far as the caller likes.
   *
   * A tool whose stated discipline is refusing to rank what it cannot separate must refuse
   * hardest when it has separated nothing at all.
   */
  if (usable.length === 0) return { worst: null, tied: [], identifiable: false };
  const worst = usable.reduce((lo, r) => (r.rate < lo.rate ? r : lo), usable[0]!);
  const tied = usable.filter((r) => r.step !== worst.step && r.low <= worst.high);
  return { worst, tied, identifiable: tied.length === 0 };
}

/** End-to-end: of everyone who arrived, how many are still here at the end. */
export function endToEnd(users: User[]): { entered: number; retained: number; rate: number; low: number; high: number } {
  const retained = users.filter((u) => reached(u, "retain")).length;
  const [low, high] = wilson(retained, users.length);
  return { entered: users.length, retained, rate: users.length === 0 ? 0 : retained / users.length, low, high };
}

if (isMain(import.meta)) {
  const users = generate();
  const rates = measure(users);
  const pc = (x: number) => (x * 100).toFixed(1) + " %";

  console.log(`\n${users.length.toLocaleString("en-GB")} visits over ${SCENARIO.months} months\n`);
  console.log("step         entered    converted    rate      95 % interval    ± points");
  console.log("─".repeat(76));

  for (const r of rates) {
    console.log(
      `${r.step.padEnd(12)}${r.entered.toLocaleString("en-GB").padStart(8)}` +
      `${r.converted.toLocaleString("en-GB").padStart(13)}   ${pc(r.rate).padStart(7)}` +
      `   [${(r.low * 100).toFixed(1)}–${(r.high * 100).toFixed(1)}]`.padEnd(19) +
      `${r.precision.toFixed(1).padStart(8)}`,
    );
  }

  const e = endToEnd(users);
  console.log(
    `\nEnd to end: ${e.retained.toLocaleString("en-GB")} of ${e.entered.toLocaleString("en-GB")} ` +
    `— ${pc(e.rate)} [${(e.low * 100).toFixed(2)}–${(e.high * 100).toFixed(2)}]`,
  );

  const w = worstStep(rates);
  console.log(
    w.worst === null
      ? `\nWorst step by rate: no step has ${ENOUGH} observations behind it — this sample ` +
        `cannot name one, and will not.`
      : `\nWorst step by rate: ${w.worst.step} at ${pc(w.worst.rate)}.` +
        (w.identifiable
          ? " No other step's interval reaches it — the ranking holds."
          : ` But ${w.tied.map((t) => t.step).join(", ")} overlap${w.tied.length === 1 ? "s" : ""} it. ` +
            `This sample cannot say which is worse.`),
  );

  console.log("\nBy channel\n");
  console.log("step         " + CHANNELS.map((c) => c.padStart(16)).join(""));
  console.log("─".repeat(46));
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, measureBy(users, c)]));
  for (let i = 0; i < PAIRS.length; i++) {
    console.log(
      PAIRS[i]!.step.padEnd(12) +
      CHANNELS.map((c) => pc(byChannel[c]![i]!.rate).padStart(16)).join(""),
    );
  }

  console.log(
    "\nPaid converts worse at the top and better at the bottom. That is the ordinary shape" +
    "\nof paid acquisition — and it means the aggregate rate moves whenever the mix moves," +
    "\nfor reasons that have nothing to do with the product. See `npm run adversarial`.\n",
  );
}
