/**
 * The users, and where each of them stopped.
 *
 * A funnel is normally handed to you as five numbers — visits, signups, activations,
 * subscriptions, retained — and every question worth asking needs the individuals behind
 * them. Whether a step got better or the traffic got better. Whether the worst step is
 * distinguishable from the second-worst. Whether an improvement in every segment can show
 * up as a decline overall. None of that survives aggregation, and all of it is routine.
 *
 * So this generates people, not totals, and the aggregate is computed from them like it is
 * in real life.
 *
 * ---
 *
 * Two channels, deliberately. Paid traffic converts worse at the top and better at the
 * bottom than organic: someone who clicked an ad is less interested and more qualified at
 * once. That is not a quirk added for interest — it is the ordinary shape of paid
 * acquisition, and it is what makes the aggregate rate move for reasons that have nothing
 * to do with the product.
 *
 * The draw is seeded. Without a fixed seed two measurements cannot be compared, and you
 * end up crediting a change for what was a different sample.
 */
export const STEPS = ["visit", "signup", "activate", "subscribe", "retain"];
export const CHANNELS = ["organic", "paid"];
function draw(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        return state / 4_294_967_296;
    };
}
/**
 * The per-step conversion rates, by channel.
 *
 * These are the generator's ground truth — the thing a real funnel does not hand you and
 * this one does, so the measurement can be checked against something. They are chosen, and
 * chosen to have a specific property worth demonstrating: **paid is worse at the top and
 * better at the bottom**, so the aggregate depends on the mix.
 */
export const TRUE_RATES = {
    organic: { signup: 0.22, activate: 0.55, subscribe: 0.18, retain: 0.74 },
    paid: { signup: 0.10, activate: 0.62, subscribe: 0.31, retain: 0.81 },
};
export const SCENARIO = {
    visitsPerMonth: 20_000,
    visitGrowth: 0,
    months: 6,
    paidShareStart: 0.20,
    paidShareEnd: 0.65,
    improve: { step: "signup", by: 0.02, from: 3 },
    seed: 20260817,
};
export function generate(s = SCENARIO) {
    const r = draw(s.seed);
    const users = [];
    for (let month = 0; month < s.months; month++) {
        const t = s.months === 1 ? 0 : month / (s.months - 1);
        const paidShare = s.paidShareStart + (s.paidShareEnd - s.paidShareStart) * t;
        const visits = Math.round(s.visitsPerMonth * Math.pow(1 + s.visitGrowth, month));
        for (let i = 0; i < visits; i++) {
            const channel = r() < paidShare ? "paid" : "organic";
            const rates = { ...TRUE_RATES[channel] };
            if (s.improve && month >= s.improve.from) {
                rates[s.improve.step] = Math.min(0.99, rates[s.improve.step] + s.improve.by);
            }
            let reached = "visit";
            for (const step of ["signup", "activate", "subscribe", "retain"]) {
                if (r() >= rates[step])
                    break;
                reached = step;
            }
            users.push({ channel, month, reached });
        }
    }
    return users;
}
const ORDER = { visit: 0, signup: 1, activate: 2, subscribe: 3, retain: 4 };
/** Did this user reach at least this step? */
export const reached = (u, step) => ORDER[u.reached] >= ORDER[step];
