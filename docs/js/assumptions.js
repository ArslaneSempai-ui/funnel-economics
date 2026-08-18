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
export const ASSUMPTIONS = {
    annualRevenuePerCustomer: 1_200,
    costPerPaidVisit: 2.40,
    monthsToShip: 3,
};
/** Sanity bounds: a screen that accepts $2 a year per customer is lying to its reader. */
export const BOUNDS = {
    annualRevenuePerCustomer: [50, 50_000],
    costPerPaidVisit: [0.05, 50],
    monthsToShip: [0.5, 18],
};
