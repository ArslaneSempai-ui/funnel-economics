/**
 * What nobody here can know, and what a reader supplies instead.
 *
 * The funnel rates are measured. Everything that turns them into money is not, and the
 * separation matters more here than in a compliance tool: a growth deck's usual failure is
 * a confident dollar figure resting on a revenue-per-customer somebody guessed in a
 * meeting.
 *
 * Each one is editable on the screen and swept, so the page can say which of them decide
 * the ranking and which are along for the ride.
 */

export type Assumptions = {
  /** Annual revenue from one retained customer. */
  annualRevenuePerCustomer: number;
  /**
   * What it costs to acquire one paid visit.
   *
   * Not used in the step pricing — it is here because the mix question is meaningless
   * without it. Turning up paid spend changes every rate on the dashboard, and whether
   * that is good depends entirely on this number against the revenue above.
   */
  costPerPaidVisit: number;
  /** How long a fix takes to ship, in months. Delay is a cost nobody puts on the chart. */
  monthsToShip: number;
};

export const ASSUMPTIONS: Assumptions = {
  annualRevenuePerCustomer: 1_200,
  costPerPaidVisit: 2.40,
  monthsToShip: 3,
};

/** Sanity bounds: a screen that accepts $2 a year per customer is lying to its reader. */
export const BOUNDS: Record<keyof Assumptions, [number, number]> = {
  annualRevenuePerCustomer: [50, 50_000],
  costPerPaidVisit: [0.05, 50],
  monthsToShip: [0.5, 18],
};
